// Tipe web karyawan (absen). Kontrak: sissi-pos-service/docs/api.md "Absen karyawan lewat web (2026-11-02)".
import type { AttendanceSource, AttendanceVia } from "../attendanceVia";

export type StaffRole = "cashier" | "kitchen" | "staff" | "waiter";

export type StaffUser = { id: string; name: string; role: StaffRole | string; job_title: string | null };
export type StaffBusiness = { id: string; name: string; timezone: string };
export type StaffOutlet = { id: string; name: string };

export type StaffSession = {
  user: StaffUser;
  business: StaffBusiness;
  outlets: StaffOutlet[];
  /** Paket Gratis (fitur `staff` tidak ada): absen ditolak server (`PRO_REQUIRED`), riwayat tetap bisa dibaca. */
  locked: boolean;
  session: { expires_at: string; idle_expires_at: string };
};

export type StaffGeo = {
  lat: number;
  lng: number;
  accuracy_m: number;
  distance_m: number | null;
  outside_area: boolean;
  mocked: boolean;
};

export type StaffAttendanceStatus = "ontime" | "late" | "permit" | "sick" | "leave" | "absent";

export type StaffAttendance = {
  id: string;
  /** Tanggal lokal usaha, YYYY-MM-DD. */
  date: string;
  outlet_id: string;
  outlet_name: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: StaffAttendanceStatus | string;
  late_minutes: number;
  source: AttendanceSource | string;
  clock_in_via: AttendanceVia | null;
  clock_out_via: AttendanceVia | null;
  clock_in_geo: StaffGeo | null;
  clock_out_geo: StaffGeo | null;
  note: string;
  /** Absen masuk di luar jadwal (sejak 2026-11-11; server lama tidak mengirim). Tetap terhitung hadir tepat waktu. */
  unscheduled?: boolean;
  /** Alasan telat dari karyawan (≤ 200; sejak 2026-11-11). */
  late_reason?: string;
  /** Jam selesai aturan efektif tanggal baris (RFC 3339); `null`/tidak ada = tanpa jam selesai (sejak 2026-11-11). */
  due_out_at?: string | null;
  /** Tidak absen pulang: belum pulang dan sudah ada absen masuk di tanggal sesudahnya (sejak 2026-11-11). */
  missed_clock_out?: boolean;
};

export type StaffToday = {
  /** Waktu server (RFC 3339 UTC). */
  now: string;
  /** Tanggal hari ini di zona usaha. */
  date: string;
  /** `null` bila karyawan tidak punya outlet aktif (`geo` lalu bawaan, `enabled: false`). */
  outlet_id: string | null;
  /** Aturan efektif hari ini (jadwal shift bila ada; `shift` aditif sejak 2026-11-02, server lama tidak mengirim). */
  rules: {
    work_start: string;
    work_end: string;
    /** `null` (sejak 2026-11-02) = telat tidak dihitung. */
    late_tolerance_min: number | null;
    off_day: boolean;
    shift?: { name: string; start: string; end: string } | null;
    /** Hari ini di luar jadwal (sejak 2026-11-11): karyawan memakai jadwal tetapi tidak punya shift hari ini. */
    unscheduled?: boolean;
    /** `false` = pemilik belum pernah menyimpan Jam kerja (sejak 2026-11-11; tidak dikirim server lama → anggap true). */
    work_hours_set?: boolean;
  };
  geo: { enabled: boolean; radius_m: number; outside: "flag" | "reject"; has_location: boolean };
  /** Absen hari ini bila sudah ada jam masuk, selainnya absen terakhir yang masih terbuka (bisa beberapa hari lalu). */
  attendance: StaffAttendance | null;
  /** Absen masuk hari ini boleh (sejak 2026-11-11; server lama tidak mengirim → anggap true). */
  can_clock_in?: boolean;
  locked: boolean;
};

export type ClockGeoInput = { lat: number; lng: number; accuracy_m: number };

export type ClockInput = {
  outlet_id: string;
  action: "in" | "out";
  geo: ClockGeoInput | null;
  /** Karyawan sudah menyetujui "di luar area, tetap absen?" (jawaban atas 409 OUTSIDE_AREA_CONFIRM). */
  confirm_outside?: boolean;
  /** Jawaban atas 409 UNSCHEDULED_CONFIRM ("tidak punya shift hari ini, tetap catat?"). */
  confirm_unscheduled?: boolean;
  /** Jawaban atas 409 LATE_CONFIRM; `late_reason` opsional (≤ 200). */
  confirm_late?: boolean;
  /** Jawaban atas 409 OFF_DAY_CONFIRM ("hari ini jadwalmu libur, tetap catat?"). */
  confirm_off_day?: boolean;
  late_reason?: string;
};

export type StaffHistorySummary = {
  present: number;
  ontime: number;
  late: number;
  late_minutes: number;
  permit: number;
  sick: number;
  leave: number;
  absent: number;
  /** Jumlah baris Tidak absen pulang (sejak 2026-11-11). */
  missed_clock_out?: number;
  /** Jumlah baris di luar jadwal (sudah termasuk di `ontime`; sejak 2026-11-11). */
  unscheduled?: number;
};

export type StaffHistory = { month: string; items: StaffAttendance[]; summary: StaffHistorySummary };

export type StaffLoginInput = { identifier: string; password: string; remember_me: boolean; device_id?: string };
export type StaffAcceptInput = { password: string; remember_me?: boolean; device_id?: string };
