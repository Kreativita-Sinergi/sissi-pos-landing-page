// Label "via" absen — sama di web karyawan (/karyawan) & dasbor pemilik (Tim › Absen), cermin app.
// Kontrak: sissi-pos-service/docs/api.md "Absen karyawan lewat web" › Keterangan "via".
// Modul murni (tanpa impor) agar bisa dites unit langsung dengan `node --test`.

export type AttendanceSource = "pin" | "manual" | "self";
/** Jalur pengisian satu jam (per jam, bukan per baris), diisi server. */
export type AttendanceVia = "pin" | "app" | "web" | "manual";

/** Bagian record absen yang dibutuhkan untuk label via (owner `Attendance` & `StaffAttendance` sama-sama cocok). */
export type ViaRow = {
  source: AttendanceSource | string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  clock_in_via?: AttendanceVia | string | null;
  clock_out_via?: AttendanceVia | string | null;
  clock_in_geo?: unknown;
  clock_out_geo?: unknown;
};

const VIA_LABEL: Record<string, string> = {
  pin: "Perangkat toko (PIN)",
  app: "Aplikasi HP",
  web: "Website",
  manual: "Dicatat pemilik",
};
const SOURCE_LABEL: Record<string, string> = {
  pin: "Perangkat toko (PIN)",
  self: "Aplikasi HP",
  manual: "Dicatat pemilik",
};

/**
 * Label satu jam: `*_via` `pin`/`app`/`web`/`manual` → labelnya; `null` (baris lama) → dari `source` baris
 * (`pin` → Perangkat toko (PIN), `self` → Aplikasi HP, `manual` → Dicatat pemilik).
 */
export function viaLabel(source: string, via: string | null | undefined): string {
  if (via && VIA_LABEL[via]) return VIA_LABEL[via];
  return SOURCE_LABEL[source] ?? "—";
}

/** Jam yang diisi lewat HP/web (atau `self` lama tanpa via) tanpa geo → "tanpa lokasi". */
export function missingLocation(source: string, via: string | null | undefined, geo: unknown): boolean {
  if (geo) return false;
  if (via) return via === "app" || via === "web";
  return source === "self";
}

export type ViaSummary = {
  /** "Website", atau "Masuk: Website · Pulang: Aplikasi HP" bila jalurnya berbeda. */
  label: string;
  /** Ada jam yang diisi lewat app/web (atau `self` lama) tanpa geo → tanda tambahan "tanpa lokasi". */
  noLocation: boolean;
};

/** Ringkasan via satu baris absen; `null` bila belum ada jam (status izin/sakit/cuti/alpa). */
export function viaSummary(row: ViaRow): ViaSummary | null {
  if (!row.clock_in_at && !row.clock_out_at) return null;
  const inLabel = row.clock_in_at ? viaLabel(row.source, row.clock_in_via) : null;
  const outLabel = row.clock_out_at ? viaLabel(row.source, row.clock_out_via) : null;
  let label: string;
  if (inLabel && outLabel && inLabel !== outLabel) label = `Masuk: ${inLabel} · Pulang: ${outLabel}`;
  else label = (inLabel ?? outLabel) as string;
  const noLocation =
    (!!row.clock_in_at && missingLocation(row.source, row.clock_in_via, row.clock_in_geo)) ||
    (!!row.clock_out_at && missingLocation(row.source, row.clock_out_via, row.clock_out_geo));
  return { label, noLocation };
}

/** Satu teks: label via + ", tanpa lokasi" bila perlu. */
export function viaText(row: ViaRow): string | null {
  const s = viaSummary(row);
  if (!s) return null;
  return s.noLocation ? `${s.label} · tanpa lokasi` : s.label;
}
