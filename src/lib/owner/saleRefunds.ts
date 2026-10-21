// Refund sebagian per item di dasbor (api.md "Refund sebagian per item (2026-10-21)"; cermin app
// `lib/features/sales/models/partial_refund.dart`). Web hanya MENAMPILKAN: refund sebagian dicatat dari aplikasi kasir
// (perubahan `sales` ber-kunci `refund`); angka laporan/ringkasan sudah dihitung server memakai tagihan sesudah refund.
// `total` transaksi tetap nilai asli; `refunded_total` = Σ refund sebagian; uangnya = pembayaran negatif ber-`purpose:
// "refund"`. Batal/refund penuh sesudahnya hanya mengembalikan SISA per metode (`refundPlan` di `cancelSale.ts` sudah
// menjumlah bersih semua pembayaran, termasuk pembayaran refund sebagian).
import type { SaleDetail, SaleItem, SaleListItem, SaleRefund } from "./types";

type Totals = Pick<SaleListItem, "total" | "status"> & { refunded_total?: number | null };

/** Σ refund sebagian (server lama: 0). */
export const refundedTotalOf = (s: { refunded_total?: number | null }): number => Math.max(0, s.refunded_total ?? 0);

/** Tagihan sesudah refund sebagian (`total − refunded_total`) — angka yang masuk omzet di tanggal transaksi. */
export const netTotalOf = (s: Totals): number => s.total - refundedTotalOf(s);

/** Transaksi masih berlaku (belum batal/refund penuh) yang sudah direfund sebagian. */
export const hasPartialRefund = (s: Totals): boolean => refundedTotalOf(s) > 0 && s.status !== "void" && s.status !== "refunded";

/** Nominal baris daftar: tagihan setelah refund sebagian; transaksi batal/refund penuh tetap nilai asli (dicoret). */
export const shownTotalOf = (s: Totals): number => (hasPartialRefund(s) ? netTotalOf(s) : s.total);

/**
 * Sisa tagihan (kasbon) = tagihan setelah refund − Σ pembayaran. `paid_total` sudah termasuk pembayaran negatif refund
 * sebagian, jadi `total − paid_total` keliru (transaksi lunas yang direfund sebagian tampak berutang).
 */
export const outstandingOf = (s: Totals & { paid_total: number }): number => Math.max(0, netTotalOf(s) - s.paid_total);

/**
 * Baris total di rincian: transaksi berlaku yang direfund sebagian → "Total" biasa + "Refund sebagian" + "Total setelah
 * refund" (tebal); transaksi batal/refund penuh sesudah refund sebagian → "Total" tebal + "Refund sebagian" sebagai riwayat
 * saja (tanpa total setelah refund — sudah tidak berlaku).
 */
export function receiptTotals(s: Totals): { totalStrong: boolean; refunded: number | null; netTotal: number | null } {
  const refunded = refundedTotalOf(s);
  if (hasPartialRefund(s)) return { totalStrong: false, refunded, netTotal: netTotalOf(s) };
  return { totalStrong: true, refunded: refunded > 0 ? refunded : null, netTotal: null };
}

/** Qty yang sudah dikembalikan per indeks baris `items` (Σ semua refund). Indeks di luar daftar tetap dihitung. */
export function refundedQtyByIndex(refunds: readonly SaleRefund[] | null | undefined): Map<number, number> {
  const out = new Map<number, number>();
  for (const r of refunds ?? []) for (const l of r.lines ?? []) out.set(l.index, (out.get(l.index) ?? 0) + l.quantity);
  return out;
}

export type RefundEntryLine = { name: string; variant_name: string | null; quantity: number; amount: number };

/** Satu baris riwayat refund untuk tampilan: waktu, alasan, metode uang kembali, nominal, barang yang kembali. */
export type RefundEntry = {
  id: string;
  at: string;
  reason: string;
  amount: number;
  /** Metode uang kembali (unik, urutan pertama muncul); kosong = refund Rp0 (mis. barang gratis). */
  methods: string[];
  lines: RefundEntryLine[];
};

export function refundEntries(s: Pick<SaleDetail, "items"> & { refunds?: SaleRefund[] | null }): RefundEntry[] {
  return (s.refunds ?? []).map((r) => ({
    id: r.id,
    at: r.refunded_at,
    reason: r.reason,
    amount: r.amount,
    methods: [...new Set((r.payments ?? []).map((p) => p.method))],
    lines: (r.lines ?? []).map((l) => {
      const it: Pick<SaleItem, "name" | "variant_name"> | undefined = s.items[l.index];
      return { name: it?.name ?? `Baris ${l.index + 1}`, variant_name: it?.variant_name ?? null, quantity: l.quantity, amount: l.amount };
    }),
  }));
}
