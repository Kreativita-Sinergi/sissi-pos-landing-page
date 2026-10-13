// Operasi stok dasbor pemilik: stok opname, pembelian (PO) + supplier, transfer antar outlet.
// Cermin `InventoryDocsRepository` + `inventory_models.dart` aplikasi (sissi-app/lib/features/inventory/).
// Bentuk record = api.md "Sync v1" (`stock_opnames`, `purchase_orders`, `stock_transfers`, `suppliers`, `raw_materials`);
// validasi = sissi-service/internal/syncapi/entity_inventory.go & entity_stock_movement.go.
//
// Urutan tulis web (aman bila terputus di tengah): kirim perubahan dokumen dulu; gerakan stok (`opname`/`in`/`transfer`,
// `ref_id` = id dokumen) + `avg_cost` bahan baku baru dikirim setelah dokumen `applied`. Gerakan memakai id baru yang sama
// saat dikirim ulang (ledger append-only: kiriman identik = `applied`), jadi "Coba lagi" tidak menggandakan stok.
// Kuantitas = mili-satuan (1 pcs = 1000); uang = rupiah bulat.
import { ApiError } from "@/lib/sissiApi";
import { newId, pushChanges } from "./api";
import { formatQty, resultMessage } from "./catalog";
import { costOfQty } from "./productForm";
import type { Change, ChangeResult, StockRow, SyncRecord, WritableEntity } from "./types";
import { zonedDay } from "./tz";

const ent = (e: "stock_opnames" | "purchase_orders" | "stock_transfers" | "suppliers" | "raw_materials" | "stock_movements") =>
  e as unknown as WritableEntity;

// ——— Barang ———

/** Barang yang dirujuk baris dokumen & ledger: produk (+varian) **atau** bahan baku (`ItemRef`). */
export type ItemRef = { product_id: string | null; variant_id: string | null; raw_material_id: string | null };

export function itemKey(r: ItemRef): string {
  return r.raw_material_id ? `r:${r.raw_material_id}` : `p:${r.product_id ?? ""}/${r.variant_id ?? ""}`;
}

export function refOfRow(r: StockRow): ItemRef {
  return r.kind === "raw_material"
    ? { product_id: null, variant_id: null, raw_material_id: r.raw_material_id }
    : { product_id: r.product_id, variant_id: r.variant_id ?? null, raw_material_id: null };
}

function refOf(j: Record<string, unknown>): ItemRef | null {
  const raw = typeof j.raw_material_id === "string" && j.raw_material_id ? j.raw_material_id : null;
  const product = typeof j.product_id === "string" && j.product_id ? j.product_id : null;
  if (raw) return { product_id: null, variant_id: null, raw_material_id: raw };
  if (product) return { product_id: product, variant_id: typeof j.variant_id === "string" && j.variant_id ? j.variant_id : null, raw_material_id: null };
  return null;
}

const refJson = (r: ItemRef) => ({ product_id: r.product_id, raw_material_id: r.raw_material_id, variant_id: r.raw_material_id ? null : r.variant_id });

const int = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback);

function listOf(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : [];
}

/** Teks jumlah + satuan: `2,5 kg`. */
export function qtyWithUnit(milli: number, unit: string): string {
  return unit ? `${formatQty(milli)} ${unit}` : formatQty(milli);
}

/** `+Rp1.000` / `-Rp1.000` / `Rp0` (`formatSignedRupiah`). */
export function signedRupiah(n: number): string {
  const s = `Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
  return n > 0 ? `+${s}` : n < 0 ? `-${s}` : s;
}

/** Selisih bertanda: `+2`, `-1,5`. */
export function signedQty(milli: number): string {
  return milli > 0 ? `+${formatQty(milli)}` : formatQty(milli);
}

// ——— Opname ———

export type OpnameStatus = "counting" | "posted" | "canceled";
export type OpnameLine = ItemRef & { system_qty: number; counted_qty: number | null };
export type Opname = SyncRecord & {
  outlet_id: string;
  status: OpnameStatus;
  started_at: string;
  posted_at: string | null;
  lines: OpnameLine[];
  note: string;
  employee_id: string;
};

export function opnameLines(v: unknown): OpnameLine[] {
  const out: OpnameLine[] = [];
  for (const j of listOf(v)) {
    const ref = refOf(j);
    if (!ref) continue;
    out.push({ ...ref, system_qty: int(j.system_qty), counted_qty: typeof j.counted_qty === "number" ? Math.trunc(j.counted_qty) : null });
  }
  return out;
}

export const asOpname = (r: SyncRecord): Opname => ({ ...(r as Opname), lines: opnameLines(r.lines), note: String(r.note ?? "") });

const lineJson = (l: OpnameLine) => ({ ...refJson(l), system_qty: l.system_qty, counted_qty: l.counted_qty });

/** Selisih hitung − sistem (0 bila belum dihitung). */
export const opnameDiff = (l: OpnameLine) => (l.counted_qty === null ? 0 : l.counted_qty - l.system_qty);

export type OpnameSummary = {
  total: number;
  counted: number;
  surplus: number;
  shortage: number;
  surplusValue: number;
  shortageValue: number;
  uncounted: number;
  netValue: number;
};

/** Ringkasan opname (`OpnameSummary.of`): nilai selisih = |selisih| × harga satuan (rata-rata bahan / modal produk). */
export function opnameSummary(lines: OpnameLine[], unitCost: (r: ItemRef) => number | null): OpnameSummary {
  let counted = 0;
  let surplus = 0;
  let shortage = 0;
  let plus = 0;
  let minus = 0;
  for (const l of lines) {
    if (l.counted_qty === null) continue;
    counted++;
    const d = opnameDiff(l);
    const cost = unitCost(l);
    const value = cost === null ? 0 : costOfQty(Math.abs(d), cost);
    if (d > 0) {
      surplus++;
      plus += value;
    } else if (d < 0) {
      shortage++;
      minus += value;
    }
  }
  return { total: lines.length, counted, surplus, shortage, surplusValue: plus, shortageValue: minus, uncounted: lines.length - counted, netValue: plus - minus };
}

/** Mulai sesi hitung (`startOpname`): stok sistem saat ini sebagai awal (dibekukan ulang saat tiap baris dihitung). */
export function opnameStartChange(m: { outlet_id: string; employee_id: string; items: { ref: ItemRef; qty: number }[]; note?: string }): Change {
  return {
    entity: ent("stock_opnames"),
    op: "upsert",
    id: newId(),
    data: {
      outlet_id: m.outlet_id,
      status: "counting",
      started_at: new Date().toISOString(),
      lines: m.items.map((i) => lineJson({ ...i.ref, system_qty: i.qty, counted_qty: null })),
      note: (m.note ?? "").trim(),
      employee_id: m.employee_id,
    },
  };
}

/** Simpan hasil hitung (`countOpname`, beberapa baris sekaligus): `system_qty` baris yang dihitung dibekukan ke stok saat ini. */
export function opnameCountChange(o: Opname, counts: Map<string, { ref: ItemRef; counted: number | null }>, current: Map<string, number>): Change {
  const lines = o.lines.map((l) => ({ ...l }));
  for (const [key, c] of counts) {
    const i = lines.findIndex((l) => itemKey(l) === key);
    const system = current.get(key) ?? (i >= 0 ? lines[i].system_qty : 0);
    const next: OpnameLine = { ...c.ref, system_qty: system, counted_qty: c.counted };
    if (i < 0) lines.push(next);
    else lines[i] = next;
  }
  return { entity: ent("stock_opnames"), op: "upsert", id: o.id, data: { lines: lines.map(lineJson) }, base_updated_at: o.updated_at };
}

export function opnameStatusChange(o: Opname, status: "posted" | "canceled", at: string): Change {
  return {
    entity: ent("stock_opnames"),
    op: "upsert",
    id: o.id,
    data: status === "posted" ? { status, posted_at: at } : { status },
    base_updated_at: o.updated_at,
  };
}

// ——— Gerakan stok ———

export type MoveType = "in" | "opname" | "transfer";

/** Satu gerakan stok baru (`StockLedger.record`). */
export function moveChange(m: {
  outlet_id: string;
  ref: ItemRef;
  qty_delta: number;
  type: MoveType;
  ref_id: string;
  employee_id: string;
  occurred_at: string;
  note?: string;
  unit_cost?: number | null;
}): Change {
  return {
    entity: ent("stock_movements"),
    op: "upsert",
    id: newId(),
    data: {
      outlet_id: m.outlet_id,
      ...refJson(m.ref),
      qty_delta: m.qty_delta,
      type: m.type,
      ref_id: m.ref_id,
      note: m.note ?? "",
      unit_cost: m.unit_cost ?? null,
      employee_id: m.employee_id,
      occurred_at: m.occurred_at,
    },
  };
}

/** Gerakan `opname` sebesar selisih tiap baris yang dihitung (selisih 0 dilewati). */
export function opnameMoves(o: Opname, employeeId: string, at: string): Change[] {
  return o.lines
    .filter((l) => opnameDiff(l) !== 0)
    .map((l) => moveChange({ outlet_id: o.outlet_id, ref: l, qty_delta: opnameDiff(l), type: "opname", ref_id: o.id, employee_id: employeeId, occurred_at: at }));
}

// ——— Supplier ———

export type Supplier = SyncRecord & { name: string; phone: string | null; email: string | null; address: string; notes: string };

export type SupplierDraft = { name: string; phone: string; email: string; address: string; notes: string };

export function supplierData(d: SupplierDraft): Record<string, unknown> {
  const clean = (v: string) => (v.trim() ? v.trim() : null);
  return { name: d.name.trim(), phone: clean(d.phone), email: clean(d.email), address: d.address.trim(), notes: d.notes.trim() };
}

/** Nomor HP Indonesia → 62… untuk wa.me (kosong bila tidak terbaca). */
export function waNumber(phone: string | null | undefined): string {
  const d = (phone ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("62")) return d;
  if (d.startsWith("0")) return `62${d.slice(1)}`;
  if (d.startsWith("8")) return `62${d}`;
  return d;
}

// ——— PO ———

export type PoStatus = "draft" | "ordered" | "partial" | "received" | "canceled";
export type PoLine = ItemRef & { qty_ordered: number; qty_received: number; unit_cost: number };
export type PurchaseOrder = SyncRecord & {
  outlet_id: string;
  supplier_id: string | null;
  number: string;
  status: PoStatus;
  lines: PoLine[];
  ordered_at: string | null;
  expected_at: string | null;
  note: string;
};

export function poLines(v: unknown): PoLine[] {
  const out: PoLine[] = [];
  for (const j of listOf(v)) {
    const ref = refOf(j);
    if (!ref) continue;
    out.push({ ...ref, qty_ordered: int(j.qty_ordered), qty_received: int(j.qty_received), unit_cost: int(j.unit_cost) });
  }
  return out;
}

export const asPo = (r: SyncRecord): PurchaseOrder => ({ ...(r as PurchaseOrder), lines: poLines(r.lines), note: String(r.note ?? "") });

const poLineJson = (l: PoLine) => ({ ...refJson(l), qty_ordered: l.qty_ordered, qty_received: l.qty_received, unit_cost: l.unit_cost });

export const poRemaining = (l: PoLine) => Math.max(0, l.qty_ordered - l.qty_received);
export const poLineTotal = (l: PoLine) => costOfQty(l.qty_ordered, l.unit_cost);
export const poTotal = (lines: PoLine[]) => lines.reduce((s, l) => s + poLineTotal(l), 0);

export const poEditable = (s: PoStatus) => s === "draft" || s === "ordered";
export const poClosed = (s: PoStatus) => s === "received" || s === "canceled";
export const poOpen = (s: PoStatus) => s === "ordered" || s === "partial";

/** Semua baris penuh → diterima; sebagian → sebagian (`statusAfterReceive`). */
export function statusAfterReceive(lines: PoLine[]): PoStatus {
  if (lines.every((l) => l.qty_received >= l.qty_ordered)) return "received";
  if (lines.some((l) => l.qty_received > 0)) return "partial";
  return "ordered";
}

const PO_CHARS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ";

/** Nomor PO `PO-yyMMdd-XXXX` (tanggal zona usaha, akhiran acak — sama dengan aplikasi). */
export function newPoNumber(now = new Date()): string {
  const day = zonedDay(now).replace(/-/g, "").slice(2);
  const rnd = crypto.getRandomValues(new Uint32Array(4));
  return `PO-${day}-${Array.from(rnd, (n) => PO_CHARS[n % PO_CHARS.length]).join("")}`;
}

export function poCreateChange(m: { outlet_id: string; supplier_id: string | null; lines: PoLine[]; expected_at: string | null; note: string; order: boolean }): Change {
  const at = new Date().toISOString();
  return {
    entity: ent("purchase_orders"),
    op: "upsert",
    id: newId(),
    data: {
      outlet_id: m.outlet_id,
      supplier_id: m.supplier_id,
      number: newPoNumber(),
      status: m.order ? "ordered" : "draft",
      lines: m.lines.map(poLineJson),
      ordered_at: m.order ? at : null,
      expected_at: m.expected_at,
      note: m.note.trim(),
    },
  };
}

export function poUpdateChange(po: PurchaseOrder, m: { supplier_id: string | null; lines: PoLine[]; expected_at: string | null; note: string }): Change {
  return {
    entity: ent("purchase_orders"),
    op: "upsert",
    id: po.id,
    data: { supplier_id: m.supplier_id, lines: m.lines.map(poLineJson), expected_at: m.expected_at, note: m.note.trim() },
    base_updated_at: po.updated_at,
  };
}

export function poStatusChange(po: PurchaseOrder, status: "ordered" | "canceled"): Change {
  const data: Record<string, unknown> = { status };
  if (status === "ordered") data.ordered_at = new Date().toISOString();
  return { entity: ent("purchase_orders"), op: "upsert", id: po.id, data, base_updated_at: po.updated_at };
}

export function poDeleteChange(po: PurchaseOrder): Change {
  return { entity: ent("purchase_orders"), op: "delete", id: po.id, base_updated_at: po.updated_at };
}

/** Harga rata-rata bergerak: `(stok×avg + qty×harga)/(stok+qty)` dibulatkan setengah ke atas; stok ≤ 0 → harga baru. */
export function movingAverage(stock: number, avg: number, qty: number, price: number): number {
  if (qty <= 0) return avg;
  if (stock <= 0) return price;
  const total = BigInt(stock) * BigInt(avg) + BigInt(qty) * BigInt(price);
  const count = BigInt(stock + qty);
  return Number((total + count / BigInt(2)) / count);
}

export type RawMaterialRec = SyncRecord & { name: string; unit: string; avg_cost: number; min_stock: number; is_active: boolean };

/**
 * Penerimaan barang (`receivePo`, boleh sebagian). [received] = tambahan diterima per barang (mili, dijepit ke sisa),
 * [costs] = harga beli aktual per barang. Hasil: perubahan PO (kirim dulu) + lanjutan (avg_cost bahan baku, lalu gerakan
 * `in` ber-`ref_id`/`unit_cost`, catatan = nomor PO). [materials]/[totals] = bahan baku terbaru & stok total bisnis (mili)
 * sebelum penerimaan — rata-rata bergerak berlaku untuk seluruh bisnis.
 */
export function receivePlan(
  po: PurchaseOrder,
  m: {
    received: Map<string, number>;
    costs: Map<string, number>;
    employee_id: string;
    materials: Map<string, RawMaterialRec>;
    totals: Map<string, number>;
  }
): { record: Change; follow: Change[]; status: PoStatus } | null {
  const at = new Date().toISOString();
  const lines = po.lines.map((l) => ({ ...l }));
  const avg: Change[] = [];
  const moves: Change[] = [];
  let any = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const key = itemKey(l);
    const add = Math.min(Math.max(m.received.get(key) ?? 0, 0), poRemaining(l));
    if (add <= 0) continue;
    any = true;
    const cost = m.costs.get(key) ?? l.unit_cost;
    if (l.raw_material_id) {
      const cur = m.materials.get(l.raw_material_id);
      if (cur) {
        const next = movingAverage(m.totals.get(key) ?? 0, cur.avg_cost, add, cost);
        if (next !== cur.avg_cost) avg.push({ entity: ent("raw_materials"), op: "upsert", id: cur.id, data: { avg_cost: next }, base_updated_at: cur.updated_at });
      }
    }
    moves.push(moveChange({ outlet_id: po.outlet_id, ref: l, qty_delta: add, type: "in", unit_cost: cost, ref_id: po.id, note: po.number, employee_id: m.employee_id, occurred_at: at }));
    // Setelah ada barang diterima (partial) server membekukan baris kecuali qty_received → harga baris tetap; harga aktual
    // tetap tercatat di gerakan `in` & rata-rata bahan baku. (Aplikasi menimpa harga baris → ditolak server di kasus ini.)
    lines[i] = { ...l, qty_received: l.qty_received + add, unit_cost: po.status === "partial" ? l.unit_cost : cost };
  }
  if (!any) return null;
  const status = statusAfterReceive(lines);
  return {
    record: {
      entity: ent("purchase_orders"),
      op: "upsert",
      id: po.id,
      data: { status, lines: lines.map(poLineJson), ordered_at: po.ordered_at ?? at },
      base_updated_at: po.updated_at,
    },
    follow: [...avg, ...moves],
    status,
  };
}

// ——— Transfer ———

export type TransferStatus = "pending" | "completed" | "canceled";
export type TransferLine = ItemRef & { qty: number };
export type StockTransfer = SyncRecord & {
  from_outlet_id: string;
  to_outlet_id: string;
  status: TransferStatus;
  lines: TransferLine[];
  note: string;
  employee_id: string;
  completed_at: string | null;
};

export function transferLines(v: unknown): TransferLine[] {
  const out: TransferLine[] = [];
  for (const j of listOf(v)) {
    const ref = refOf(j);
    if (ref) out.push({ ...ref, qty: int(j.qty) });
  }
  return out;
}

export const asTransfer = (r: SyncRecord): StockTransfer => ({ ...(r as StockTransfer), lines: transferLines(r.lines), note: String(r.note ?? "") });

export function transferCreateChange(m: { from_outlet_id: string; to_outlet_id: string; lines: TransferLine[]; note: string; employee_id: string }): Change {
  return {
    entity: ent("stock_transfers"),
    op: "upsert",
    id: newId(),
    data: {
      from_outlet_id: m.from_outlet_id,
      to_outlet_id: m.to_outlet_id,
      status: "pending",
      lines: m.lines.map((l) => ({ ...refJson(l), qty: l.qty })),
      note: m.note.trim(),
      employee_id: m.employee_id,
    },
  };
}

export function transferStatusChange(t: StockTransfer, status: "completed" | "canceled", at: string): Change {
  return {
    entity: ent("stock_transfers"),
    op: "upsert",
    id: t.id,
    data: status === "completed" ? { status, completed_at: at } : { status },
    base_updated_at: t.updated_at,
  };
}

/** Dua gerakan `transfer` per baris: −qty di outlet asal, +qty di outlet tujuan (`completeTransfer`). */
export function transferMoves(t: StockTransfer, employeeId: string, at: string): Change[] {
  const out: Change[] = [];
  for (const l of t.lines) {
    for (const [outlet, delta] of [
      [t.from_outlet_id, -l.qty],
      [t.to_outlet_id, l.qty],
    ] as const) {
      if (delta !== 0) out.push(moveChange({ outlet_id: outlet, ref: l, qty_delta: delta, type: "transfer", ref_id: t.id, employee_id: employeeId, occurred_at: at }));
    }
  }
  return out;
}

// ——— Kirim ———

export class CommitError extends Error {
  constructor(
    message: string,
    readonly result?: ChangeResult,
    /** Dokumen sudah tersimpan tetapi lanjutan (gerakan stok) belum — bisa dikirim ulang dengan perubahan yang sama. */
    readonly pending?: Change[]
  ) {
    super(message);
  }
}

/** Kirim satu perubahan dokumen; selain `applied` → CommitError (record server ikut, untuk memuat ulang saat konflik). */
export async function commitRecord(change: Change): Promise<SyncRecord | null> {
  const [r] = await pushChanges([change]);
  if (!r || r.status !== "applied") throw new CommitError(r ? resultMessage(r) : "Ditolak server.", r);
  return r.record ?? null;
}

/** Kirim lanjutan (avg_cost & gerakan stok). Yang gagal dikembalikan lewat CommitError.pending agar bisa dicoba lagi. */
export async function commitFollow(changes: Change[]): Promise<ChangeResult[]> {
  if (!changes.length) return [];
  let results: ChangeResult[];
  try {
    results = await pushChanges(changes);
  } catch (err) {
    throw new CommitError(err instanceof ApiError ? err.message : "Tidak dapat terhubung ke server.", undefined, changes);
  }
  const failed = results.map((r, i) => ({ r, c: changes[i] })).filter((x) => x.r.status !== "applied");
  // Konflik avg_cost (bahan baku baru diubah di perangkat lain) tidak menghalangi stok; gerakan yang gagal dikirim ulang.
  const moves = failed.filter((x) => x.c.entity === ent("stock_movements"));
  if (moves.length) throw new CommitError(`${moves.length} gerakan stok gagal: ${resultMessage(moves[0].r)}`, moves[0].r, moves.map((x) => x.c));
  return results;
}

// ——— Lain-lain ———

/** Total stok per barang (mili) dari baris /owner/stock. */
export function stockMap(rows: StockRow[]): Map<string, number> {
  return new Map(rows.map((r) => [itemKey(refOfRow(r)), r.qty]));
}

/** `YYYY-MM-DD` hari ini di zona usaha. */
export const todayDay = () => zonedDay(new Date());
