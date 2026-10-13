// Pelunasan kasbon dari dasbor web (api.md "Dasbor pemilik (web) › Kelola data › Tahap lanjut"):
// `POST /owner/changes` entitas `sale_payments` — hanya record baru, `amount` > 0, `shift_id` null (uang dicatat di
// luar laci kasir), transaksi `unpaid|partial`. Aturan lain dari entitas sync (sama dengan app):
//  - metode `cash|qris|card|transfer`; Σ pembayaran ≤ total (lebih → `rejected` "Jumlah pembayaran melebihi total"),
//  - tunai: `received − change = amount`; non-tunai: `received = change = 0`,
//  - `cashier_id` = pemilik (sesi), `paid_at` = sekarang. Status transaksi diturunkan server.
import { ApiError } from "@/lib/sissiApi";
import { newId, pushChanges } from "./api";
import type { Change, ChangeResult, PaymentMethod } from "./types";

export const SETTLE_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Tunai" },
  { value: "qris", label: "QRIS" },
  { value: "card", label: "Kartu" },
  { value: "transfer", label: "Transfer" },
];

/** Penjelasan perbedaan web vs app: pembayaran web tidak masuk shift mana pun. */
export const OUTSIDE_DRAWER_NOTE = "Uang dicatat di luar laci kasir; tidak memengaruhi hitungan kas shift.";

/** Transaksi yang bisa dilunasi dari web. */
export function isCreditOpen(status: string): boolean {
  return status === "unpaid" || status === "partial";
}

export type SettleTarget = { id: string; outlet_id: string; total: number; paid_total: number };

export type SettleInput = {
  method: PaymentMethod;
  /** Bagian tagihan yang dilunasi (rupiah bulat > 0, ≤ sisa). */
  amount: number;
  /** Tunai: uang diterima (≥ amount). Diabaikan untuk non-tunai. */
  received?: number;
};

export const remainingOf = (s: Pick<SettleTarget, "total" | "paid_total">) => Math.max(0, s.total - s.paid_total);

/** Validasi lokal (pesan sama dengan app). `null` = sah. */
export function settleProblem(remaining: number, input: SettleInput): { field: "amount" | "received"; message: string } | null {
  const { amount, method } = input;
  if (!Number.isFinite(amount) || !Number.isInteger(amount) || amount <= 0) return { field: "amount", message: "Nominal harus lebih dari 0" };
  if (amount > remaining) return { field: "amount", message: "Jumlah pembayaran melebihi sisa tagihan." };
  if (method === "cash") {
    const r = input.received ?? amount;
    if (!Number.isFinite(r) || !Number.isInteger(r)) return { field: "received", message: "Isi uang diterima." };
    if (r < amount) return { field: "received", message: "Uang tunai yang diterima kurang." };
  }
  return null;
}

/** Perubahan `sale_payments` siap kirim. */
export function settleChange(sale: SettleTarget, input: SettleInput, cashierId: string, id = newId(), paidAt = new Date()): Change {
  const cash = input.method === "cash";
  const received = cash ? Math.max(input.received ?? input.amount, input.amount) : 0;
  return {
    entity: "sale_payments",
    op: "upsert",
    id,
    data: {
      sale_id: sale.id,
      outlet_id: sale.outlet_id,
      shift_id: null,
      method: input.method,
      amount: input.amount,
      received,
      change: cash ? received - input.amount : 0,
      cashier_id: cashierId,
      paid_at: paidAt.toISOString(),
    },
  };
}

export type SettleOutcome = { ok: true } | { ok: false; message: string };

/** Pesan galat dari hasil `rejected`/`conflict` per perubahan (pesan per kolom server bila ada). */
export function resultMessage(r: ChangeResult | undefined): string {
  if (!r) return "Server tidak mengembalikan hasil.";
  const details = [...new Set((r.details ?? []).map((d) => friendly(d.message)).filter(Boolean))];
  if (details.length) return details.join(" ");
  return friendly(r.message || "Pembayaran ditolak server.");
}

/** Pesan galat permintaan (ApiError 422 dsb.). */
export function requestErrorMessage(err: unknown, fallback: (e: unknown) => string): string {
  if (err instanceof ApiError && err.details.length) {
    const msgs = [...new Set(err.details.map((d) => friendly(d.message)).filter(Boolean))];
    if (msgs.length) return msgs.join(" ");
  }
  return fallback(err);
}

// Pesan server yang terlalu teknis diganti teks app.
function friendly(msg: string): string {
  if (msg === "Jumlah pembayaran melebihi total") return "Jumlah pembayaran melebihi sisa tagihan. Muat ulang — mungkin sudah dibayar dari perangkat lain.";
  return msg;
}

/** Catat satu pelunasan/cicilan. Galat jaringan/permintaan dilempar (ApiError). */
export async function settleCredit(sale: SettleTarget, input: SettleInput, cashierId: string): Promise<SettleOutcome> {
  const [r] = await pushChanges([settleChange(sale, input, cashierId)]);
  if (r?.status === "applied") return { ok: true };
  return { ok: false, message: resultMessage(r) };
}

export type SettleAllItem = { sale: SettleTarget & { receipt_no: string }; ok: boolean; message?: string };
export type SettleAllSummary = { items: SettleAllItem[]; paidCount: number; paidAmount: number; failedCount: number };

const CHANGE_INDEX = /^changes\[(\d+)\]/;

/**
 * "Lunasi semua": setiap transaksi dilunasi penuh (sisa saat ini) dengan satu metode, dikirim berurutan dalam satu
 * kiriman (diproses server per perubahan, urut). Tunai = uang pas (tanpa kembalian), seperti app.
 * Bila server menolak seluruh kiriman (422 `changes[i]`, mis. transaksi itu baru saja lunas), transaksi tersebut
 * ditandai gagal dan sisanya dikirim ulang sekali.
 */
export async function settleAll(
  sales: (SettleTarget & { receipt_no: string })[],
  method: PaymentMethod,
  cashierId: string
): Promise<SettleAllSummary> {
  const items: SettleAllItem[] = [];
  let pending = sales.filter((s) => remainingOf(s) > 0);
  for (let attempt = 0; attempt < 2 && pending.length; attempt++) {
    const changes = pending.map((s) => settleChange(s, { method, amount: remainingOf(s) }, cashierId));
    let results: ChangeResult[];
    try {
      results = await pushChanges(changes);
    } catch (err) {
      const bad = new Map<number, string>();
      if (err instanceof ApiError && err.status === 422) {
        for (const d of err.details) {
          const m = CHANGE_INDEX.exec(d.field);
          if (m) bad.set(Number(m[1]), friendly(d.message));
        }
      }
      if (!bad.size || attempt === 1) throw err;
      for (const [i, message] of bad) if (pending[i]) items.push({ sale: pending[i], ok: false, message });
      pending = pending.filter((_, i) => !bad.has(i));
      continue;
    }
    pending.forEach((s, i) => {
      const r = results[i];
      items.push(r?.status === "applied" ? { sale: s, ok: true } : { sale: s, ok: false, message: resultMessage(r) });
    });
    pending = [];
  }
  const paid = items.filter((i) => i.ok);
  return {
    items,
    paidCount: paid.length,
    paidAmount: paid.reduce((a, i) => a + remainingOf(i.sale), 0),
    failedCount: items.length - paid.length,
  };
}
