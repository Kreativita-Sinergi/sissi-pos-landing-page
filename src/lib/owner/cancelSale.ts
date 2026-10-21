// Batal (void) / refund transaksi dari dasbor web (api.md "Dasbor pemilik › Nomor 14", entitas sync `sales` —
// `cancelSale` di sissi-service/internal/syncapi/entity_sale.go). Mengikuti app (`SaleRepository.cancel`):
//  - void dari open/unpaid/partial/paid; refund dari paid/partial; alasan wajib;
//  - uang yang sudah diterima dikembalikan sebagai pembayaran NEGATIF baru (bersih per metode asal, atau metode lain
//    pilihan pemilik) sehingga jumlah bersih transaksi = 0;
//  - perubahan hanya berisi `status`, `void_reason`, `approved_by` (= pemilik) dan `payments` = pengembalian baru saja
//    (entitas sync memulai dari record tersimpan; pembayaran lama tidak perlu dikirim ulang — dan DTO detail tidak
//    memuat `shift_id`/`cashier_id`-nya sehingga tidak bisa dikirim "apa adanya");
//  - dari web pengembalian TANPA `shift_id` (uang keluar di luar laci kasir), `cashier_id` = pemilik, `paid_at` = sekarang.
//  - transaksi DP reservasi yang masih `open` (= "Kembalikan DP", D10 app `SaleRepository.cancel`): pengembalian
//    ber-`purpose: "deposit_refund"` + re-date (`paid_at` = sekarang, `shift_id` null) — api.md "DP reservasi";
//    transaksi reservasi yang sudah ditagih = pembatalan biasa (tanggal omzet tetap).
//  - "Kembalikan DP" atas PESANAN AWAL (B3: DP open tanpa meja ber-item, `deposit ∈ {held,to_process} ∧ items_count > 0`)
//    WAJIB membawa `items: []` di perubahan pembatalan yang sama (api.md "Pesanan awal (B3)" butir 5) — server
//    mengosongkan pesanan awal sehingga record batal 0 item; jangan kirim pengosongan terpisah.
//  - Batal/refund penuh SESUDAH refund sebagian (api.md "Refund sebagian per item" › kompatibilitas): `refundPlan`
//    menjumlah bersih per metode termasuk pembayaran negatif ber-`purpose: "refund"` (metode bebas, jadi bisa lewat
//    metode lain: dikurangkan dari metode positif) → hanya SISA yang dikembalikan (Σ bersih transaksi = 0);
//    pengembalian dari web tidak pernah ber-`purpose: "refund"` (ditolak server).
// Bedanya dengan app: stok barang & poin pelanggan TIDAK dikembalikan otomatis (gerakan stok `refund` dan mutasi poin
// hanya dari app) — ditampilkan sebagai catatan di dialog.
import { ApiError } from "@/lib/sissiApi";
import { newId, pushChanges } from "./api";
import { requestErrorMessage } from "./credit";
import type { Change, ChangeResult, PaymentMethod, SaleDetail } from "./types";

export type CancelKind = "void" | "refunded";

export const CANCEL_REASONS = ["Salah input", "Pelanggan batal", "Pelanggan komplain", "Transaksi ganda"];

export const REFUND_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Tunai" },
  { value: "qris", label: "QRIS" },
  { value: "card", label: "Kartu" },
  { value: "transfer", label: "Transfer" },
];

export const canVoid = (status: string) => ["open", "unpaid", "partial", "paid"].includes(status);
export const canRefund = (status: string) => status === "paid" || status === "partial";

/** Pembatalan = "Kembalikan DP" (transaksi DP reservasi yang masih `open`; cermin app). */
export const isDepositRefund = (sale: Pick<SaleDetail, "status" | "reservation_id">) => !!sale.reservation_id && sale.status === "open";

/**
 * Transaksi pesanan awal reservasi (B3): DP masih dipegang (tamu belum datang) dan sudah ber-item. Diturunkan dari
 * `deposit` server (`held|to_process` = open tanpa meja) + `items_count` — tanpa field baru (api.md "Pesanan awal (B3)").
 */
export const isPreorderDeposit = (sale: { deposit?: string | null; items_count?: number | null }) =>
  (sale.deposit === "held" || sale.deposit === "to_process") && (sale.items_count ?? 0) > 0;

type CancelTarget = Pick<SaleDetail, "id" | "outlet_id" | "updated_at" | "status" | "reservation_id"> & {
  deposit?: string | null;
  items_count?: number | null;
};

/** Pesanan awal reservasi TANPA DP (tidak ada uang dipegang): "Hapus pesanan awal", bukan "Kembalikan DP" (istilah app). */
export const isPreorderWithoutDeposit = (sale: { deposit?: string | null; items_count?: number | null; paid_total: number }) =>
  isPreorderDeposit(sale) && sale.paid_total <= 0;

/**
 * Reservasi pembawa DP/pesanan awal masih **Direservasi** (`deposit: "held"`): pembatalan dari dasbor hanya menutup
 * transaksinya, reservasinya tetap aktif (bukan "reservasinya ditutup").
 */
export const reservationStillActive = (sale: { deposit?: string | null }) => sale.deposit === "held";

/**
 * "Hapus pesanan awal" dari dasbor hanya untuk reservasi yang sudah batal/tidak datang (`to_process`). Selama reservasi
 * masih Direservasi, pesanan awal diubah/dihapus lewat aplikasi (mem-void pembawanya dari dasbor membuat reservasi itu
 * tidak bisa lagi menerima DP/pesanan awal — id pembawa tetap per reservasi).
 */
export const canDeletePreorderFromWeb = (sale: { deposit?: string | null; items_count?: number | null; paid_total: number }) =>
  !(isPreorderWithoutDeposit(sale) && reservationStillActive(sale));

/**
 * Uang yang harus dikembalikan per metode asal: bersih per metode (termasuk pengembalian sebelumnya), lalu metode yang
 * bersihnya NEGATIF (refund sebagian / sisa DP yang dikembalikan lewat metode lain — metode bebas) mengurangi metode
 * positif, mulai dari yang terbesar. Jadi Σ rencana = max(0, Σ semua pembayaran) dan Σ sesudah batal = 0 (server
 * menolak pengembalian yang melebihi Σ dibayar). Hanya yang > 0, urutan metode pertama muncul.
 */
export function refundPlan(payments: Pick<SaleDetail["payments"][number], "method" | "amount">[]): { method: string; amount: number }[] {
  const net = new Map<string, number>();
  for (const p of payments) net.set(p.method, (net.get(p.method) ?? 0) + p.amount);
  const plan = [...net].filter(([, v]) => v > 0).map(([method, amount]) => ({ method, amount }));
  let owed = [...net.values()].reduce((a, v) => (v < 0 ? a - v : a), 0);
  // sort stabil: seri → urutan metode pertama muncul.
  for (const p of [...plan].sort((a, b) => b.amount - a.amount)) {
    if (owed <= 0) break;
    const take = Math.min(p.amount, owed);
    p.amount -= take;
    owed -= take;
  }
  return plan.filter((p) => p.amount > 0);
}

export type RefundLine = { from: string; method: PaymentMethod; amount: number };

export type CancelInput = { kind: CancelKind; reason: string; refunds: RefundLine[] };

export function cancelProblem(input: CancelInput): string | null {
  const r = input.reason.trim();
  if (!r) return "Alasan wajib diisi.";
  if (r.length > 200) return "Alasan maksimal 200 karakter.";
  return null;
}

/** Perubahan `sales` siap kirim. */
export function cancelChange(
  sale: CancelTarget,
  input: CancelInput,
  ownerId: string,
  now = new Date()
): Change {
  const at = now.toISOString();
  const deposit = isDepositRefund(sale);
  return {
    entity: "sales",
    op: "upsert",
    id: sale.id,
    // Entitas sync mengatur pembatalan lewat aturan transisi status (tidak kalah konflik); server mewajibkan
    // base_updated_at dari web. DTO detail belum memuat `updated_at` → waktu muat (sekarang).
    base_updated_at: sale.updated_at ?? at,
    data: {
      status: input.kind,
      void_reason: input.reason.trim(),
      approved_by: ownerId,
      // Re-date: pembatalan DP dihitung pada hari diproses, di luar laci kasir.
      ...(deposit ? { paid_at: at, shift_id: null } : {}),
      // Pesanan awal: kosongkan item dalam pembatalan yang sama (butir 5). Hanya untuk transaksi yang menurut server
      // belum bermeja — `items: []` atas pesanan meja yang sudah berjalan ditolak server.
      ...(deposit && isPreorderDeposit(sale) ? { items: [] } : {}),
      payments: input.refunds
        .filter((r) => r.amount > 0)
        .map((r) => ({
          id: newId(),
          sale_id: sale.id,
          outlet_id: sale.outlet_id,
          method: r.method,
          amount: -r.amount,
          received: 0,
          change: 0,
          shift_id: null,
          cashier_id: ownerId,
          paid_at: at,
          ...(deposit ? { purpose: "deposit_refund" } : {}),
        })),
    },
  };
}

export type CancelOutcome = { ok: true } | { ok: false; message: string; reload: boolean };

/** Pesanan awal yang di server sudah bermeja (tamu didudukkan di perangkat lain): `items: []` ditolak (butir 5). */
export const SEATED_ELSEWHERE = "Tamu reservasi ini sudah didudukkan dan pesanannya berjalan di perangkat kasir. Muat ulang lalu ulangi.";

function friendly(msg: string): string {
  if (msg === "Uang yang sudah diterima harus dicatat dikembalikan saat membatalkan") {
    return "Ada pembayaran yang belum terlihat di dasbor (mungkin baru tersinkron dari perangkat). Muat ulang lalu ulangi.";
  }
  if (msg === "Transaksi sudah dibatalkan" || msg === "Transaksi yang dibatalkan tidak dapat diubah") return "Transaksi ini sudah dibatalkan.";
  return msg;
}

function resultMessage(r: ChangeResult | undefined): string {
  if (!r) return "Server tidak mengembalikan hasil.";
  if ((r.details ?? []).some((d) => d.field === "items")) return SEATED_ELSEWHERE;
  const details = [...new Set((r.details ?? []).map((d) => friendly(d.message)).filter(Boolean))];
  return details.length ? details.join(" ") : friendly(r.message || "Pembatalan ditolak server.");
}

/** Kirim pembatalan. Galat jaringan dilempar; 422 permintaan (guard server) → `{ ok: false }`. */
export async function cancelSale(sale: CancelTarget, input: CancelInput, ownerId: string): Promise<CancelOutcome> {
  let r: ChangeResult | undefined;
  try {
    [r] = await pushChanges([cancelChange(sale, input, ownerId)]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 422) {
      const message = friendly(requestErrorMessage(err, () => err.message));
      return { ok: false, message, reload: /sudah dibatalkan/.test(message) };
    }
    throw err;
  }
  if (r?.status === "applied") return { ok: true };
  if (r?.status === "conflict") return { ok: false, message: "Transaksi ini baru diubah di perangkat lain — sudah dimuat ulang. Periksa lalu ulangi.", reload: true };
  const message = resultMessage(r);
  return { ok: false, message, reload: /muat ulang|sudah dibatalkan/i.test(message) };
}
