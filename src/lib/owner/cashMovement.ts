// Kas masuk/keluar dari dasbor web (api.md "Dasbor pemilik › Nomor 14", entitas sync `cash_movements`): hanya baris
// baru untuk shift yang SEDANG BUKA (laci fisik di outlet), `cashier_id` = pemilik. Kategori & teks alasan mengikuti
// app (cash_movement_sheet.dart: "Kategori · catatan"). Server: `amount` 1…MaxMoney, `reason` ≤ 200, outlet = outlet shift.
import { ApiError } from "@/lib/sissiApi";
import { newId, pushChanges } from "./api";
import { requestErrorMessage, resultMessage } from "./credit";
import type { Change } from "./types";

export type CashType = "in" | "out";

/** Kategori yang masuk akal per arah kas (urutan & label app). */
export const CASH_CATEGORIES: Record<CashType, string[]> = {
  in: ["Tambahan uang kembalian", "Setoran modal", "Lainnya"],
  out: ["Beli bahan", "Operasional", "Gaji harian", "Setor ke pemilik", "Lainnya"],
};

/** "Kategori · catatan" (atau salah satunya). */
export function composeCashReason(category: string, note: string): string {
  const n = note.trim();
  return n ? `${category} · ${n}` : category;
}

export type CashInput = { type: CashType; amount: number; category: string; note: string };

export function cashProblem(input: CashInput): { field: "amount" | "note"; message: string } | null {
  if (!Number.isFinite(input.amount) || !Number.isInteger(input.amount) || input.amount <= 0) return { field: "amount", message: "Isi nominal lebih dari 0." };
  if (input.amount > 1_000_000_000) return { field: "amount", message: "Nominal terlalu besar." };
  if (composeCashReason(input.category, input.note).length > 200) return { field: "note", message: "Catatan terlalu panjang." };
  return null;
}

export function cashChange(shift: { id: string; outlet_id: string }, input: CashInput, ownerId: string, id = newId()): Change {
  return {
    entity: "cash_movements",
    op: "upsert",
    id,
    data: {
      shift_id: shift.id,
      outlet_id: shift.outlet_id,
      type: input.type,
      amount: input.amount,
      reason: composeCashReason(input.category, input.note),
      cashier_id: ownerId,
    },
  };
}

/** Catat kas. `{ ok: false }` untuk penolakan server (mis. shift sudah ditutup); galat jaringan dilempar. */
export async function recordCash(shift: { id: string; outlet_id: string }, input: CashInput, ownerId: string): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const [r] = await pushChanges([cashChange(shift, input, ownerId)]);
    return r?.status === "applied" ? { ok: true } : { ok: false, message: resultMessage(r) };
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) return { ok: false, message: requestErrorMessage(err, () => err.message) };
    throw err;
  }
}
