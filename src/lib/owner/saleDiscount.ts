// Diskon per baris & persetujuan diskon kasir di rincian/daftar transaksi dasbor.
// Kontrak: sissi-pos-service/docs/api.md "Alasan diskon baris & DP pesanan berjalan (2026-10-21)" dan
// "Persetujuan diskon kasir (pin_for_discount, 2026-10-21 rev. 2)". Server lama: field tidak ada → tanpa tampilan.
import type { SaleDetail, SaleItem, SaleListItem } from "./types";

/** Alasan diskon baris yang ditampilkan: hanya bila baris berdiskon dan alasannya tidak kosong. */
export function lineDiscountReason(it: Pick<SaleItem, "discount" | "discount_reason">): string | null {
  if (!(it.discount > 0)) return null;
  const r = it.discount_reason?.trim();
  return r ? r : null;
}

/** Diskon kasir diberi tanpa persetujuan pemilik (setelan PIN diskon aktif) — penanda server. */
export const isDiscountUnapproved = (s: Pick<SaleListItem, "discount_unapproved">): boolean => s.discount_unapproved === true;

/** Nama pemilik yang menyetujui diskon (PIN), atau null. */
export function discountApprover(s: Pick<SaleDetail, "discount_approved_by_name">): string | null {
  const n = s.discount_approved_by_name?.trim();
  return n ? n : null;
}
