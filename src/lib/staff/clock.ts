// Logika murni halaman absen karyawan: jam server, tanggal, bulan, tombol berikutnya. Tanpa impor runtime (dites unit).
import type { StaffAttendance, StaffToday } from "./types";

/**
 * Selisih jam server − jam browser (ms). `t0`/`t1` = Date.now() sebelum & sesudah permintaan; titik tengah dipakai
 * agar latensi jaringan tidak menggeser jam. Jam yang ditampilkan = `Date.now() + offset` (bukan jam browser mentah).
 */
export function clockOffset(serverNow: string, t0: number, t1: number): number {
  const s = Date.parse(serverNow);
  if (Number.isNaN(s)) return 0;
  return Math.round(s - (t0 + t1) / 2);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, make: () => Intl.DateTimeFormat): Intl.DateTimeFormat {
  let f = fmtCache.get(key);
  if (!f) {
    f = make();
    fmtCache.set(key, f);
  }
  return f;
}

function safeZone(tz: string | undefined): string {
  if (!tz) return "Asia/Jakarta";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "Asia/Jakarta";
  }
}

/** Jam:menit:detik di zona usaha. */
export function zonedClock(ms: number, tz: string): { hm: string; s: string } {
  const f = fmt(`clock:${tz}`, () =>
    new Intl.DateTimeFormat("en-GB", { timeZone: safeZone(tz), hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
  );
  const parts = Object.fromEntries(f.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return { hm: `${parts.hour}:${parts.minute}`, s: parts.second };
}

/** ISO → "08:12" di zona usaha; kosong → "—". */
export function formatTime(iso: string | null | undefined, tz: string): string {
  if (!iso) return "—";
  const d = Date.parse(iso);
  if (Number.isNaN(d)) return "—";
  return zonedClock(d, tz).hm;
}

/** Tanggal di zona usaha (YYYY-MM-DD). */
export function zonedDate(ms: number, tz: string): string {
  const f = fmt(`date:${tz}`, () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: safeZone(tz), year: "numeric", month: "2-digit", day: "2-digit" })
  );
  return f.format(new Date(ms));
}

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function ymd(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** "2026-11-02" → "Senin, 2 November 2026". */
export function formatDateLong(date: string): string {
  const p = ymd(date);
  if (!p) return date;
  const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return `${DAYS[wd]}, ${p[2]} ${MONTHS[p[1] - 1]} ${p[0]}`;
}

/** "2026-11-02" → { day: "Sen", date: "2", month: "Nov" } (daftar riwayat). */
export function dateParts(date: string): { weekday: string; day: string; month: string } {
  const p = ymd(date);
  if (!p) return { weekday: "", day: date, month: "" };
  const wd = new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay();
  return { weekday: DAYS[wd].slice(0, 3), day: String(p[2]), month: MONTHS_SHORT[p[1] - 1] };
}

/** "2026-11" → "November 2026". */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  return `${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

/**
 * Pilihan bulan riwayat: bulan ini + 12 bulan sebelumnya (server menolak > 12 bulan ke belakang & bulan depan, 422).
 */
export function monthOptions(current: string, count = 13): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(current);
  if (!m) return [current];
  let y = Number(m[1]);
  let mo = Number(m[2]);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`${y}-${String(mo).padStart(2, "0")}`);
    mo -= 1;
    if (mo === 0) {
      mo = 12;
      y -= 1;
    }
  }
  return out;
}

export type NextStep =
  | { kind: "in" }
  | { kind: "out"; carried: boolean }
  | { kind: "done" }
  | { kind: "closed"; status: string };

const CLOSED = new Set(["permit", "sick", "leave", "absent"]);

/**
 * Tombol berikutnya dari data hari ini. Baris kemarin yang masih terbuka (server mengembalikannya bila belum pulang)
 * → `out` dengan `carried: true`.
 */
export function nextStep(today: Pick<StaffToday, "date" | "attendance">): NextStep {
  const a: StaffAttendance | null = today.attendance;
  if (!a) return { kind: "in" };
  if (CLOSED.has(a.status) && !a.clock_in_at) return { kind: "closed", status: a.status };
  if (!a.clock_in_at) return { kind: "in" };
  if (!a.clock_out_at) return { kind: "out", carried: a.date < today.date };
  // Baris kemarin sudah lengkap → hari ini belum absen.
  if (a.date < today.date) return { kind: "in" };
  return { kind: "done" };
}

export type ClockState = "working" | "due" | "missed" | "done";

/**
 * Keadaan absen pulang baris (api.md "Absen pulang terlupa"): Selesai / Tidak absen pulang (`missed_clock_out`) /
 * Belum absen pulang (lewat `due_out_at`) / Bekerja. `null` = belum ada jam masuk. Field lama tidak ada → false/null.
 */
export function clockState(a: Pick<StaffAttendance, "clock_in_at" | "clock_out_at" | "due_out_at" | "missed_clock_out"> | null, now: number): ClockState | null {
  if (!a || !a.clock_in_at) return null;
  if (a.clock_out_at) return "done";
  if (a.missed_clock_out) return "missed";
  const due = a.due_out_at ? Date.parse(a.due_out_at) : NaN;
  if (Number.isFinite(due) && now >= due) return "due";
  return "working";
}

/** "2026-11-09" → "9 Nov" (tombol absen pulang shift sebelumnya). */
export function formatDateShort(date: string): string {
  const p = ymd(date);
  return p ? `${p[2]} ${MONTHS_SHORT[p[1] - 1]}` : date;
}

export const STATUS_LABEL: Record<string, string> = {
  ontime: "Tepat waktu",
  late: "Terlambat",
  permit: "Izin",
  sick: "Sakit",
  leave: "Cuti",
  absent: "Alpa",
};

export const ROLE_LABEL: Record<string, string> = { cashier: "Kasir", kitchen: "Dapur", staff: "Karyawan", waiter: "Pelayan" };

/** `next` hanya boleh path relatif di bawah /karyawan (bukan halaman masuk) — mencegah open redirect. */
export function safeStaffNext(next: string | null | undefined): string {
  if (!next || next.startsWith("//") || next.includes("\\")) return "/karyawan";
  if (!/^\/karyawan(?:[/?#]|$)/.test(next) || /^\/karyawan\/masuk/.test(next)) return "/karyawan";
  return next;
}
