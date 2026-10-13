// Zona waktu usaha untuk dasbor pemilik (kontrak: `OwnerSession.business.timezone`, disimpan di
// `business_settings.settings.timezone`). Server menghitung hari/jam laporan di zona ini; web memakai zona yang sama
// untuk semua tampilan & perhitungan tanggal (periode preset, "hari ini", jam, batas hari diskon).
//
// Zona aktif disimpan di modul ini dan diset OwnerShell setiap kali sesi dimuat (`setOwnerZone`), lalu isi halaman
// dipasang ulang bila zona berubah — jadi helper di sini cukup membaca zona aktif tanpa perlu diteruskan lewat props.
// Indonesia tanpa DST → offset tetap, sehingga batas hari bisa dihitung dengan aritmetika biasa.

export const OWNER_TIMEZONES = ["Asia/Jakarta", "Asia/Pontianak", "Asia/Makassar", "Asia/Jayapura"] as const;
export type OwnerTimezone = (typeof OWNER_TIMEZONES)[number];

const OFFSET_HOURS: Record<OwnerTimezone, number> = {
  "Asia/Jakarta": 7,
  "Asia/Pontianak": 7,
  "Asia/Makassar": 8,
  "Asia/Jayapura": 9,
};

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Nilai tidak dikenal / kosong → WIB (sama dengan server). */
export function normalizeZone(v: unknown): OwnerTimezone {
  return typeof v === "string" && (OWNER_TIMEZONES as readonly string[]).includes(v) ? (v as OwnerTimezone) : "Asia/Jakarta";
}

let active: OwnerTimezone = "Asia/Jakarta";

/** Dipanggil OwnerShell setelah sesi dimuat. */
export function setOwnerZone(tz: unknown): OwnerTimezone {
  active = normalizeZone(tz);
  return active;
}

export function ownerZone(): OwnerTimezone {
  return active;
}

/** "WIB" | "WITA" | "WIT". */
export function zoneLabel(tz: OwnerTimezone = active): "WIB" | "WITA" | "WIT" {
  const h = OFFSET_HOURS[tz];
  return h === 9 ? "WIT" : h === 8 ? "WITA" : "WIB";
}

export function zoneOffsetMs(tz: OwnerTimezone = active): number {
  return OFFSET_HOURS[tz] * HOUR;
}

// ——— Tanggal & jam ———

const toMs = (v: string | number | Date) => (v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v));

/** `YYYY-MM-DD` hari ini (zona usaha) dikurangi `daysBack`. */
export function zonedToday(daysBack = 0): string {
  return new Date(Date.now() + zoneOffsetMs() - daysBack * DAY).toISOString().slice(0, 10);
}

/** Waktu → `YYYY-MM-DD` di zona usaha; "" bila tidak sah. */
export function zonedDay(value: string | number | Date): string {
  const t = toMs(value);
  return Number.isNaN(t) ? "" : new Date(t + zoneOffsetMs()).toISOString().slice(0, 10);
}

/** Waktu → jam 0–23 di zona usaha; NaN bila tidak sah. */
export function zonedHour(value: string | number | Date): number {
  const t = toMs(value);
  return Number.isNaN(t) ? Number.NaN : new Date(t + zoneOffsetMs()).getUTCHours();
}

/** Waktu → `HH:mm` (24 jam) di zona usaha; "" bila tidak sah. */
export function zonedHHMM(value: string | number | Date): string {
  const t = toMs(value);
  return Number.isNaN(t) ? "" : new Date(t + zoneOffsetMs()).toISOString().slice(11, 16);
}

/** `YYYY-MM-DD` → milidetik UTC untuk 00:00 (atau 23:59:59.999 bila `end`) di zona usaha; NaN bila tidak sah. */
export function zonedDayStartMs(day: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return Number.NaN;
  return Date.parse(`${day}T00:00:00Z`) - zoneOffsetMs();
}

// ——— Format (Intl dengan zona aktif; formatter di-cache per zona) ———

const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(key: string, opts: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const k = `${active}|${key}`;
  let f = cache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("id-ID", { ...opts, timeZone: active });
    cache.set(k, f);
  }
  return f;
}

function valid(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** `14.05`. */
export function formatTime(value: string | null | undefined): string {
  const d = valid(value);
  return d ? fmt("time", { hour: "2-digit", minute: "2-digit" }).format(d) : "—";
}

/** `13 Okt`. */
export function formatShortDate(value: string | null | undefined): string {
  const d = valid(value);
  return d ? fmt("short", { day: "numeric", month: "short" }).format(d) : "—";
}

/** `13 Okt 2026`. */
export function formatDate(value: string | null | undefined): string {
  const d = valid(value);
  return d ? fmt("date", { dateStyle: "medium" }).format(d) : "—";
}

/** `13 Okt 2026, 14.05`. */
export function formatDateTime(value: string | null | undefined): string {
  const d = valid(value);
  return d ? fmt("datetime", { dateStyle: "medium", timeStyle: "short" }).format(d) : "—";
}

/** `13 Okt 14.05` (atau hanya jam bila `timeOnly`). */
export function formatStamp(iso: string, timeOnly = false): string {
  if (!valid(iso)) return "—";
  return timeOnly ? formatTime(iso) : `${formatShortDate(iso)} ${formatTime(iso)}`;
}

/** `Senin, 13 Okt 2026` dari `YYYY-MM-DD` (tanggal kalender — tidak bergeser oleh zona). */
export function formatDayLong(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}
