// Pemetaan galat web karyawan → pesan Bahasa Indonesia. Murni (hanya impor fungsi murni) agar bisa dites unit.
import { durationLabel } from "../duration";

// Galat dibaca secara "duck typing" (code/status/details/retryAfter) — cocok dengan ApiError & StaffApiError.

export type ErrorLike = {
  code?: string;
  status?: number;
  message?: string;
  retryAfter?: number | null;
  details?: { field: string; message: string }[];
};

export type StaffMessage = {
  title?: string;
  text: string;
  tone: "danger" | "warning" | "info";
};

function asErr(err: unknown): ErrorLike | null {
  return err && typeof err === "object" && "code" in err ? (err as ErrorLike) : null;
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  return `${Math.ceil(seconds / 60)} menit`;
}

/** Jarak meter → "120 m" / "1,4 km". */
export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  const km = Math.round(m / 100) / 10;
  return `${km.toLocaleString("id-ID")} km`;
}

/** Galat umum (jaringan, batas laju, server) yang sama untuk semua aksi. */
function common(e: ErrorLike): StaffMessage | null {
  switch (e.code) {
    case "NETWORK_ERROR":
      return { title: "Tidak ada koneksi", text: "Tidak dapat terhubung ke server. Periksa internet lalu coba lagi.", tone: "danger" };
    case "TIMEOUT":
      return { title: "Server lambat merespons", text: "Coba lagi sebentar lagi.", tone: "danger" };
    case "RATE_LIMITED":
      return {
        title: "Terlalu banyak percobaan",
        text: e.retryAfter ? `Tunggu ${formatWait(e.retryAfter)} lalu coba lagi.` : "Tunggu sebentar lalu coba lagi.",
        tone: "warning",
      };
    case "CSRF_REJECTED":
      return { text: "Permintaan ditolak server (alamat situs tidak diizinkan). Hubungi pemilik usaha.", tone: "danger" };
    case "SERVICE_UNAVAILABLE":
      return { text: "Layanan sedang dalam perbaikan. Coba lagi beberapa saat lagi.", tone: "warning" };
    default:
      return null;
  }
}

const FALLBACK: StaffMessage = { text: "Terjadi kesalahan. Coba lagi sebentar lagi.", tone: "danger" };

/** Login `/karyawan/masuk`. `STAFF_ONLY` ditangani pemanggil (dialihkan ke /masuk). */
export function loginErrorMessage(err: unknown): StaffMessage {
  const e = asErr(err);
  if (!e) return FALLBACK;
  switch (e.code) {
    case "INVALID_CREDENTIALS":
      return { text: "No. HP/email atau kata sandi salah.", tone: "danger" };
    case "STAFF_ONLY":
      return { title: "Ini akun pemilik", text: "Masuk lewat halaman dasbor pemilik.", tone: "warning" };
    case "EMPLOYEE_LOGIN_DISABLED":
      return {
        title: "Akunmu belum diizinkan masuk",
        text: "Pemilik belum mengaktifkan akses akun pribadi untukmu. Minta pemilik mengaturnya di Tim › karyawan, atau absen dengan PIN di perangkat toko.",
        tone: "warning",
      };
    case "VALIDATION_ERROR":
      return { text: "Periksa no. HP/email dan kata sandi.", tone: "danger" };
    default:
      return common(e) ?? { text: e.message || FALLBACK.text, tone: "danger" };
  }
}

/** Aktivasi undangan lewat website (`POST /staff/auth/accept/{code}`). */
export function acceptErrorMessage(err: unknown): StaffMessage {
  const e = asErr(err);
  if (!e) return FALLBACK;
  switch (e.code) {
    case "INVITE_INVALID":
    case "NOT_FOUND":
      return {
        title: "Undangan tidak berlaku",
        text: "Kode sudah dipakai, kedaluwarsa, atau dibatalkan. Minta pemilik mengirim undangan baru.",
        tone: "danger",
      };
    case "EMPLOYEE_LOGIN_DISABLED":
      return loginErrorMessage(err);
    case "VALIDATION_ERROR":
      return { text: e.details?.[0]?.message || "Kata sandi belum memenuhi syarat.", tone: "danger" };
    default:
      return common(e) ?? { text: e.message || FALLBACK.text, tone: "danger" };
  }
}

/** Angka dari `details[{field,message}]` (mis. `distance_m`, `radius_m`); `null` bila tidak ada/rusak. */
export function detailNumber(err: unknown, field: string): number | null {
  const raw = asErr(err)?.details?.find((x) => x.field === field)?.message;
  return raw !== undefined && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
}

/** Teks dari `details[{field,message}]` (mis. `shift_name`, `work_start`); `null` bila tidak ada/kosong. */
export function detailText(err: unknown, field: string): string | null {
  const raw = asErr(err)?.details?.find((x) => x.field === field)?.message;
  return raw ? raw : null;
}

/** Batas alasan telat (kontrak: `late_reason` ≤ 200). */
export const LATE_REASON_MAX = 200;

export type LateAsk = { minutes: number | null; shiftName: string | null; shiftStart: string | null; tolerance: number | null };

/** Isi dialog 409 LATE_CONFIRM dari `details`. */
export function lateAsk(err: unknown): LateAsk {
  return {
    minutes: detailNumber(err, "late_minutes"),
    shiftName: detailText(err, "shift_name"),
    shiftStart: detailText(err, "shift_start"),
    tolerance: detailNumber(err, "late_tolerance_min"),
  };
}

/** "Shift Pagi mulai 08:00 (toleransi 10 menit). Kamu telat 25 mnt." (≥ 60 → "1 j 5 mnt") — bagian yang tidak ada dilewati. */
export function lateAskText(a: LateAsk): string {
  const parts: string[] = [];
  if (a.shiftName || a.shiftStart) {
    let t = a.shiftName ? `Shift ${a.shiftName}` : "Shift";
    if (a.shiftStart) t += ` mulai ${a.shiftStart}`;
    if (a.tolerance !== null) t += ` (toleransi ${a.tolerance} menit)`;
    parts.push(`${t}.`);
  }
  parts.push(a.minutes !== null ? `Kamu telat ${durationLabel(a.minutes)}.` : "Kamu terlambat.");
  return parts.join(" ");
}

/** Absen masuk/pulang. `sentGeo` = apakah lokasi ikut terkirim (membedakan pesan OUTSIDE_AREA). */
export function clockErrorMessage(err: unknown, ctx: { action: "in" | "out"; sentGeo: boolean }): StaffMessage {
  const e = asErr(err);
  if (!e) return FALLBACK;
  const verb = ctx.action === "in" ? "masuk" : "pulang";
  switch (e.code) {
    case "ALREADY_CLOCKED":
      return { title: `Sudah absen ${verb}`, text: `Absen ${verb} sudah tercatat sebelumnya (mungkin dari aplikasi atau tab lain).`, tone: "info" };
    case "NOT_CLOCKED_IN":
      return { title: "Belum absen masuk", text: "Tidak ada absen masuk yang masih terbuka. Absen masuk dulu.", tone: "warning" };
    case "ATTENDANCE_DAY_CLOSED":
      return {
        title: "Hari ini sudah tercatat",
        text: "Hari ini tercatat izin, sakit, cuti, atau alpa. Hubungi pemilik bila ini keliru.",
        tone: "warning",
      };
    case "OUTSIDE_AREA": {
      // Kontrak: `[{ field: "distance_m", message: "340" }]` (meter, teks angka) atau `[{ field: "geo" }]` (tanpa lokasi).
      const raw = e.details?.find((x) => x.field === "distance_m")?.message;
      const d = raw !== undefined && raw !== "" && Number.isFinite(Number(raw)) ? Number(raw) : null;
      const noGeo = !ctx.sentGeo || !!e.details?.some((x) => x.field === "geo");
      if (d !== null)
        return {
          title: "Di luar area outlet",
          text: `Lokasimu sekitar ${formatDistance(d)} dari outlet. Outlet ini hanya menerima absen di lokasi — mendekat lalu coba lagi.`,
          tone: "danger",
        };
      return {
        title: noGeo ? "Lokasi dibutuhkan" : "Di luar area outlet",
        text: noGeo
          ? "Outlet ini hanya menerima absen di lokasi. Izinkan akses lokasi untuk situs ini di pengaturan browser, lalu coba lagi."
          : e.message || "Lokasimu di luar area outlet. Outlet ini hanya menerima absen di lokasi.",
        tone: "danger",
      };
    }
    // Biasanya dijawab lewat dialog; pesan ini cadangan bila konfirmasi tidak bisa ditampilkan.
    case "UNSCHEDULED_CONFIRM":
      return { title: "Tidak ada shift hari ini", text: "Kamu tidak punya shift hari ini. Konfirmasi dulu untuk tetap mencatat masuk kerja.", tone: "warning" };
    case "LATE_CONFIRM":
      return { title: "Kamu terlambat", text: `${lateAskText(lateAsk(e))} Konfirmasi dulu untuk mencatat absen masuk.`, tone: "warning" };
    case "PRO_REQUIRED":
      return { title: "Fitur ini butuh Sissi Pro", text: "Hubungi pemilik usaha untuk mengaktifkan Sissi Pro.", tone: "warning" };
    case "FORBIDDEN":
      return { text: "Kamu tidak terdaftar di outlet ini. Pilih outlet lain atau hubungi pemilik.", tone: "danger" };
    case "VALIDATION_ERROR": {
      const geo = e.details?.some((d) => d.field?.startsWith("geo"));
      if (e.details?.some((d) => d.field === "late_reason"))
        return { text: `Alasan telat maksimal ${LATE_REASON_MAX} karakter.`, tone: "danger" };
      return geo
        ? { text: "Data lokasi dari browser tidak valid. Coba lagi.", tone: "danger" }
        : { text: e.details?.[0]?.message || e.message || FALLBACK.text, tone: "danger" };
    }
    case "UNAUTHORIZED":
      return { text: "Sesi berakhir. Silakan masuk lagi.", tone: "warning" };
    default:
      return common(e) ?? { text: e.message || FALLBACK.text, tone: "danger" };
  }
}

/** Galat jaringan (bukan jawaban server) — aman diulang dengan Idempotency-Key yang sama. */
export function isNetworkError(err: unknown): boolean {
  const e = asErr(err);
  return e?.code === "NETWORK_ERROR" || e?.code === "TIMEOUT";
}
