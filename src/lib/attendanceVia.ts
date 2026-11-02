// Label "via" absen — sama di web karyawan (/karyawan) & dasbor pemilik (Tim › Absen), cermin app.
// Kontrak: sissi-pos-service/docs/api.md "Absen karyawan lewat web" › Keterangan "via".
// Modul murni (tanpa impor) agar bisa dites unit langsung dengan `node --test`.

export type AttendanceSource = "pin" | "manual" | "self";
export type AttendanceVia = "app" | "web";

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

/**
 * Tabel label kontrak: `pin` → Perangkat toko (PIN) · `self` + `web` → Website · `self` + `app`/`null` → Aplikasi HP ·
 * `manual` → Dicatat pemilik. `*_via` `null` dibaca dari `source`.
 */
export function viaLabel(source: string, via: string | null | undefined): string {
  if (source === "pin") return "Perangkat toko (PIN)";
  if (source === "manual") return "Dicatat pemilik";
  if (source === "self") return via === "web" ? "Website" : "Aplikasi HP";
  // Nilai source baru yang belum dikenal: pakai via bila ada.
  if (via === "web") return "Website";
  if (via === "app") return "Aplikasi HP";
  return "—";
}

export type ViaSummary = {
  /** "Website", atau "Masuk: Website · Pulang: Aplikasi HP" bila jalurnya berbeda. */
  label: string;
  /** Absen `self` yang jamnya terisi tanpa geo → tanda tambahan "tanpa lokasi". */
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
    row.source === "self" && ((!!row.clock_in_at && !row.clock_in_geo) || (!!row.clock_out_at && !row.clock_out_geo));
  return { label, noLocation };
}

/** Satu teks: label via + ", tanpa lokasi" bila perlu. */
export function viaText(row: ViaRow): string | null {
  const s = viaSummary(row);
  if (!s) return null;
  return s.noLocation ? `${s.label} · tanpa lokasi` : s.label;
}
