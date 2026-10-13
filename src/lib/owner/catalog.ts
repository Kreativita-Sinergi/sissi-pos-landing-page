// Katalog (produk, varian, kategori, modifier, diskon) untuk dasbor pemilik.
// Bentuk record = sissi-service/docs/api.md "Sync v1"; validasi = internal/syncapi/entity_*.go.
// Aturan tulis: edit mengirim SELURUH field data record terbaru + perubahan, dengan base_updated_at;
// record baru tanpa base_updated_at. Kuantitas stok = mili-satuan (1 pcs = 1000).
import { newId } from "./api";
import type { Change, ChangeResult, SyncRecord, WritableEntity } from "./types";
import { zonedDay, zonedDayStartMs } from "./tz";

export type Category = SyncRecord & { name: string; sort_order: number };

export type VariantDimension = { name: string; values: string[] };

export type Product = SyncRecord & {
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  sku: string | null;
  barcode: string | null;
  image_url: string | null;
  is_active: boolean;
  cost_price: number | null;
  track_stock: boolean;
  min_stock: number;
  unit: string;
  is_taxable: boolean;
  is_cookable: boolean;
  barcodes: string[];
  modifier_group_ids: string[];
  duration_min: number | null;
  variant_options: VariantDimension[];
};

export type Variant = SyncRecord & {
  product_id: string;
  name: string;
  price: number;
  sku: string | null;
  barcode: string | null;
  is_active: boolean;
  cost_price: number | null;
  min_stock: number | null;
  barcodes: string[];
  sort_order: number;
  options: Record<string, string>;
  image_url: string | null;
};

export type ModifierOption = { id: string; name: string; price: number; cost_price?: number | null; [key: string]: unknown };

export type ModifierGroup = SyncRecord & {
  name: string;
  min_select: number;
  max_select: number;
  options: ModifierOption[];
  sort_order: number;
};

export type Discount = SyncRecord & {
  name: string;
  type: "percent" | "fixed";
  value: number;
  scope: "cart" | "category" | "product";
  target_ids: string[];
  min_purchase: number;
  starts_at: string | null;
  ends_at: string | null;
  auto_apply: boolean;
  is_active: boolean;
};

/** Batas server (internal/catalog) — sama dengan batas form aplikasi (`variant_options.dart`, `barcode_editor.dart`). */
export const LIMITS = {
  maxPrice: 1_000_000_000,
  maxQty: 1_000_000_000_000,
  productName: 100,
  description: 300,
  code: 40,
  unit: 20,
  categoryName: 60,
  /** Nama varian (gabungan nilai, mis. "L / Es"). */
  variantName: 60,
  /** Nama pilihan/dimensi varian, mis. "Ukuran". */
  dimensionName: 30,
  /** Satu nilai pilihan varian, mis. "Large". */
  variantValue: 40,
  dimensionValues: 20,
  maxCombos: 100,
  extraBarcodes: 10,
  modifierGroups: 10,
  modifierOptions: 30,
  modifierName: 60,
  modifierMaxSelect: 20,
  maxDurationMin: 10080,
  discountName: 60,
  discountTargets: 200,
} as const;

/** Pilihan satuan di aplikasi (`product_units.dart`); satuan lain ditulis sendiri dan disimpan huruf kecil. */
export const PRODUCT_UNITS = ["pcs", "porsi", "cup", "kg", "gram", "liter", "ml", "pack", "box", "botol", "lusin", "meter"];

/** Kunci pembanding kode (barcode/SKU): tanpa spasi tepi, tanpa beda huruf besar/kecil — seperti aplikasi. */
export function codeKey(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Harga produk bervarian = harga varian aktif termurah (semua varian bila tak ada yang aktif) — `VariantMatrix.cheapestPrice`. */
export function cheapestPrice(variants: { price: number | null; is_active?: boolean; active?: boolean }[]): number | null {
  const isOn = (v: { is_active?: boolean; active?: boolean }) => v.is_active ?? v.active ?? true;
  const active = variants.filter(isOn);
  const pool = (active.length ? active : variants).map((v) => v.price).filter((p): p is number => typeof p === "number");
  return pool.length ? Math.min(...pool) : null;
}

/** Harga untuk daftar produk (`product_price_summary.dart`): hanya varian aktif; tanpa varian aktif = harga produk. */
export function priceSummary(p: Product, variants: Variant[]): { min: number; max: number } {
  const active = variants.filter((v) => v.product_id === p.id && v.is_active);
  if (!active.length) return { min: p.price, max: p.price };
  const prices = active.map((v) => v.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

// ——— Perubahan ———

const META_KEYS = new Set(["id", "business_id", "created_at", "updated_at", "deleted_at"]);

/** Semua field data record (tanpa id/business_id/created_at/updated_at/deleted_at) — kunci yang tidak dikenal web tetap ikut. */
export function recordData(r: SyncRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) if (!META_KEYS.has(k)) out[k] = v;
  return out;
}

export function editChange(entity: WritableEntity, rec: SyncRecord, patch: Record<string, unknown>): Change {
  return { entity, op: "upsert", id: rec.id, data: { ...recordData(rec), ...patch }, base_updated_at: rec.updated_at };
}

export function createChange(entity: WritableEntity, data: Record<string, unknown>, id: string = newId()): Change {
  return { entity, op: "upsert", id, data };
}

export function deleteChange(entity: WritableEntity, rec: SyncRecord): Change {
  return { entity, op: "delete", id: rec.id, base_updated_at: rec.updated_at };
}

export type ResultSummary = { applied: number; conflict: number; rejected: number; total: number };

export function summarize(results: ChangeResult[]): ResultSummary {
  const s = { applied: 0, conflict: 0, rejected: 0, total: results.length };
  for (const r of results) s[r.status]++;
  return s;
}

export const CONFLICT_MESSAGE = "Data ini baru diubah di perangkat lain — sudah dimuat ulang.";

/** Pesan satu hasil yang gagal untuk ditampilkan ke pemilik. */
export function resultMessage(r: ChangeResult): string {
  if (r.status === "conflict") return r.code === "DELETED" ? "Data sudah dihapus di perangkat lain." : CONFLICT_MESSAGE;
  const detail = (r.details ?? []).map((d) => `${fieldLabel(d.field)}: ${d.message}`).join("; ");
  return detail || r.message || "Ditolak server.";
}

/** Peta field → pesan dari `details` (field bersarang `options[0].name` tetap utuh). */
export function resultFieldErrors(r: ChangeResult | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!r || r.status !== "rejected") return out;
  for (const d of r.details ?? []) if (d.field && !out[d.field]) out[d.field] = d.message;
  if (!r.details?.length && r.message) out._ = r.message;
  return out;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nama",
  price: "Harga",
  cost_price: "Modal",
  sku: "SKU",
  barcode: "Barcode",
  barcodes: "Barcode tambahan",
  unit: "Satuan",
  category_id: "Kategori",
  min_stock: "Stok minimum",
  duration_min: "Durasi",
  modifier_group_ids: "Modifier",
  description: "Deskripsi",
  product_id: "Produk",
  options: "Opsi",
  value: "Nilai",
  target_ids: "Target",
  ends_at: "Tanggal selesai",
  min_select: "Minimal pilih",
  max_select: "Maksimal pilih",
};

export function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

// ——— Angka ———

/** Mili-satuan → satuan (1000 → 1). */
export function fromMilli(q: number | null | undefined): number {
  return typeof q === "number" && Number.isFinite(q) ? q / 1000 : 0;
}

/** `1,25` (maks. 3 desimal, format Indonesia). */
export function formatQty(milli: number | null | undefined): string {
  return fromMilli(milli).toLocaleString("id-ID", { maximumFractionDigits: 3 });
}

/**
 * Teks jumlah → mili-satuan, sama dengan `parseQty` aplikasi: "2", "1,5", "0.5", "1.250,5" (titik ribuan bila ada koma
 * atau berpola ribuan, mis. "1.500" = 1500). Maks. 9 digit bulat & 3 desimal; tidak boleh negatif. null = tidak sah.
 */
export function parseQty(text: string): number | null {
  const raw = text.trim();
  const thousands = raw.includes(",") || /^-?\d{1,3}(\.\d{3})+$/.test(raw);
  const t = thousands ? raw.replace(/\./g, "").replace(/,/g, ".") : raw;
  if (!/^\d{1,9}(\.\d{1,3})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  return Number(whole) * 1000 + Number(frac.padEnd(3, "0") || "0");
}

/** Mili-satuan → teks isian seperti aplikasi (0 = kosong, `2500` → "2,5", `1250500` → "1.250,5"). */
export function milliToInput(milli: number | null | undefined): string {
  return milli ? formatQty(milli) : "";
}

/**
 * Teks rupiah → bilangan bulat. Menerima `15000`, `15.000`, `Rp 15.000`, `15000,00`. Kosong → null.
 * Mengembalikan NaN bila tidak bisa dibaca.
 */
export function parseRupiah(s: string): number | null {
  let t = s.trim().replace(/^rp\.?/i, "").replace(/\s/g, "");
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) return Number(t.replace(/[.,]/g, ""));
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(t)) t = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d+[.,]\d{1,2}$/.test(t)) t = t.replace(",", ".");
  else return NaN;
  return Math.round(Number(t));
}

/** Margin kotor % dari harga & modal; null bila modal kosong atau harga 0. */
export function marginPercent(price: number, cost: number | null): number | null {
  if (cost === null || cost === undefined || !price) return null;
  return Math.round(((price - cost) / price) * 1000) / 10;
}

export type PriceOp = { kind: "set" | "pct" | "rp"; amount: number; round: 0 | 100 | 500 | 1000 };

/** Terapkan aturan harga massal (dibulatkan ke kelipatan terdekat, dijepit 0..maks). */
export function applyPriceOp(old: number, op: PriceOp): number {
  let v = op.kind === "set" ? op.amount : op.kind === "pct" ? old * (1 + op.amount / 100) : old + op.amount;
  if (op.round) v = Math.round(v / op.round) * op.round;
  return Math.min(LIMITS.maxPrice, Math.max(0, Math.round(v)));
}

// ——— Tanggal diskon (zona usaha) ———
// Aplikasi menyimpan periode sebagai rentang tanggal penuh: awal hari pertama (00:00) s.d. akhir hari terakhir
// (23:59:59) waktu perangkat, dikirim sebagai UTC `toIso8601String()` ("2026-10-12T17:00:00.000Z"). Web memakai zona
// usaha (`business.timezone`, lihat `./tz`) — sama dengan perangkat yang jamnya di zona usaha.

/** RFC3339 → `YYYY-MM-DD` (zona usaha) untuk <input type=date>. */
export function isoToDay(iso: string | null | undefined): string {
  if (!iso) return "";
  return zonedDay(iso);
}

/** `YYYY-MM-DD` → awal hari (00:00:00) atau akhir hari (23:59:59) di zona usaha sebagai UTC ISO, bentuk sama dengan aplikasi. */
export function dayToIso(day: string, end = false): string | null {
  const t = zonedDayStartMs(day);
  return Number.isNaN(t) ? null : new Date(t + (end ? 86_399_000 : 0)).toISOString();
}

/** Persen teks ("10", "12,5") → basis poin; maks. 2 desimal, 0–100 (`parsePercentToBasisPoints` aplikasi). */
export function parsePercentBp(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const bp = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return bp > 10000 ? null : bp;
}

// ——— Urutan & pencarian ———

export const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "id", { sensitivity: "base" });

export function sortCategories(list: Category[]): Category[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || byName(a, b));
}

export function sortVariants(list: Variant[]): Variant[] {
  return [...list].sort((a, b) => a.sort_order - b.sort_order || byName(a, b));
}

export function norm(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

/** Nilai kosong → null (server menolak teks kosong untuk SKU/barcode). */
export function nullIfBlank(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}
