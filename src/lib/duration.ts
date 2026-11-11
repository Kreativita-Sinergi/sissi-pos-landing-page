// Format durasi menit bersama (dasbor pemilik & web karyawan), cermin `durationLabel` app:
// < 60 → "25 mnt"; ≥ 60 → "13 j 4 mnt"; menit 0 → "2 j". Murni (tanpa impor) agar bisa dites unit.

/** "1 j 30 mnt" / "2 j" / "45 mnt". Nilai negatif/rusak → "0 mnt". */
export function durationLabel(minutes: number): string {
  const total = Number.isFinite(minutes) && minutes > 0 ? Math.floor(minutes) : 0;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} mnt`;
  if (m === 0) return `${h} j`;
  return `${h} j ${m} mnt`;
}
