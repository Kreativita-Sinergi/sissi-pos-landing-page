// Konfirmasi ulang identitas untuk aksi sensitif dasbor (api.md "Dasbor pemilik › Nomor 14"):
// server menolak perubahan dengan 422 yang pesan per kolomnya diawali `CONFIRM_REQUIRED:` bila sesi belum
// dikonfirmasi ≤ 10 menit terakhir. Web lalu menampilkan dialog password/Google → POST /owner/auth/confirm → kirim ulang.
import { ApiError } from "@/lib/sissiApi";

export const CONFIRM_PREFIX = "CONFIRM_REQUIRED:";

/** Galat permintaan karena konfirmasi ulang dibutuhkan? */
export function isConfirmRequired(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 422) return false;
  return err.details.some((d) => d.message?.startsWith(CONFIRM_PREFIX)) || err.message.startsWith(CONFIRM_PREFIX);
}

/** Pesan manusiawi dari galat CONFIRM_REQUIRED (tanpa awalan kode). */
export function confirmReason(err: unknown): string {
  if (err instanceof ApiError) {
    const d = err.details.find((x) => x.message?.startsWith(CONFIRM_PREFIX));
    if (d) return d.message.slice(CONFIRM_PREFIX.length).trim();
  }
  return "Konfirmasi password untuk melanjutkan.";
}

/** Sesi masih dalam jendela konfirmasi (dari `session.confirmed_until`). */
export function isConfirmed(confirmedUntil: string | null | undefined, now = Date.now()): boolean {
  return !!confirmedUntil && Date.parse(confirmedUntil) > now;
}
