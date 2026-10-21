// Tim di dasbor pemilik: karyawan + PIN, gaji (payroll), kehadiran (koreksi manual), slip gaji.
// Data dibaca lewat GET /owner/data/{employees,attendances,payslips,business_settings} dan ditulis lewat
// POST /owner/changes — mesin sync yang sama dengan aplikasi (api.md "Dasbor pemilik › Kelola data › Tahap lanjut").
//
// Rumus rekap & gaji di file ini SALINAN langsung logika aplikasi (Dart → TS) agar angka web = angka app:
//  - sissi-app/lib/features/team/models/attendance.dart     (evaluateClockIn, AttendanceRecap.compute)
//  - sissi-app/lib/features/team/models/payroll_calc.dart   (computePayslip, perMinute, payslipNumber, monthOf)
//  - sissi-app/lib/features/team/widgets/team_labels.dart   (label baris slip, status, peran)
//  - sissi-app/lib/features/team/data/team_repository.dart  (bentuk perubahan yang dikirim)
// Perbedaan yang disengaja: app memakai jam perangkat; web memakai zona usaha (`business.timezone`) — sama bila
// perangkat berada di zona usaha.
//
// PIN: hanya dikirim sekali sebagai `pin` (polos, di-hash server) saat disimpan. `pin_hash` dari pull dibuang segera
// setelah ditarik (yang disimpan di memori hanya `has_pin`), dan PIN tidak pernah disimpan di browser.

import { pullAll, pushChanges } from "./api";
import { toLeave, type LeaveRequest } from "./leavePlan";
import { readAttendance, type AttendanceRules } from "./settings";
import type { ChangeResult, SyncRecord, WritableEntity } from "./types";
import { zonedDay, zonedHHMM, zoneOffsetMs, zonedToday } from "./tz";

// ——— Tipe record ———

/** `staff` = Karyawan (absen saja): tanpa akses POS & tanpa PIN (api.md "Peran `staff` & jabatan"). */
export type Role = "owner" | "cashier" | "kitchen" | "staff";
export type PayType = "none" | "daily" | "monthly" | "hourly";
export type AttendanceStatus = "ontime" | "late" | "permit" | "sick" | "leave" | "absent";
export type SlipStatus = "draft" | "issued" | "paid";

/** `employees.payroll` (rupiah bulat; `amount` = per hari / bulan / jam sesuai `type`). */
export type PayrollConfig = {
  type: PayType;
  amount: number;
  late_per_minute: number;
  absent_per_day: number;
  allowance_per_day: number;
  overtime_per_hour: number;
};

/**
 * Akses dari HP pribadi (api.md "Akun karyawan & Ruang Karyawan"): tidak bisa login · Ruang Karyawan (bawaan) ·
 * sesuai tugas. Pemilik selalu `full` (diabaikan server).
 */
export type PersonalAccess = "none" | "staff_space" | "full";
export const PERSONAL_ACCESS: PersonalAccess[] = ["none", "staff_space", "full"];
/** Pilihan akses per peran: `staff` tidak boleh `full` (server menolak). */
export const accessOptionsFor = (role: Role): PersonalAccess[] => (role === "staff" ? ["none", "staff_space"] : PERSONAL_ACCESS);

/** Karyawan tanpa `pin_hash` (diganti `has_pin`). */
export type Employee = {
  id: string;
  updated_at: string;
  created_at: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: Role;
  /** Jabatan (label bebas, 1–40 karakter); tidak memengaruhi izin. */
  job_title: string | null;
  is_active: boolean;
  has_pin: boolean;
  payroll: PayrollConfig | null;
  personal_access: PersonalAccess;
  /** `null` = semua outlet. */
  outlet_ids: string[] | null;
  /** Hanya baca (server). */
  has_password: boolean;
  invite_expires_at: string | null;
  bound_device_id: string | null;
  bound_at: string | null;
};

export type Attendance = SyncRecord & {
  outlet_id: string;
  employee_id: string;
  date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: AttendanceStatus;
  late_minutes: number;
  note: string;
  source: "pin" | "manual" | "self";
  edited_by: string | null;
  edit_reason: string;
  /** Pengajuan disetujui yang menghasilkan absen manual ini (null selainnya). */
  leave_request_id?: string | null;
};

export type PayslipLine = { label: string; kind: "earning" | "deduction"; amount: number };

export type Payslip = SyncRecord & {
  employee_id: string;
  period_start: string;
  period_end: string;
  number: string;
  lines: PayslipLine[];
  gross: number;
  deductions: number;
  net: number;
  status: SlipStatus;
  issued_at: string | null;
  paid_at: string | null;
  note: string;
};

export type OutletLite = { id: string; name: string; kitchen: boolean | null };

export type TeamData = {
  employees: Employee[];
  attendances: Attendance[];
  payslips: Payslip[];
  /** Pengajuan izin/sakit/cuti (kunci Pro `staff`; kosong bila Gratis). */
  leaves: LeaveRequest[];
  rules: AttendanceRules;
  outlets: OutletLite[];
};

export type TeamEntity = "employees" | "attendances" | "payslips" | "leave_requests";

// ——— Normalisasi data tarikan ———

const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : 0);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const PAY_TYPES: PayType[] = ["none", "daily", "monthly", "hourly"];

/** Cermin `PayrollConfig.parse`: `null` bila belum diatur/rusak. */
export function parsePayroll(v: unknown): PayrollConfig | null {
  if (!isObj(v)) return null;
  const type = PAY_TYPES.includes(v.type as PayType) ? (v.type as PayType) : "none";
  return {
    type,
    amount: int(v.amount),
    late_per_minute: int(v.late_per_minute),
    absent_per_day: int(v.absent_per_day),
    allowance_per_day: int(v.allowance_per_day),
    overtime_per_hour: int(v.overtime_per_hour),
  };
}

/** Karyawan ikut penggajian (`PayrollConfig.isPaid`). */
export const isPaid = (c: PayrollConfig | null): c is PayrollConfig => !!c && c.type !== "none" && c.amount > 0;

/** Record `employees` → Employee; `pin_hash` dibuang di sini (tidak pernah disimpan di state). */
export function toEmployee(r: SyncRecord): Employee {
  const role: Role = r.role === "owner" || r.role === "kitchen" || r.role === "staff" ? r.role : "cashier";
  const access = PERSONAL_ACCESS.includes(r.personal_access as PersonalAccess) ? (r.personal_access as PersonalAccess) : "staff_space";
  return {
    id: r.id,
    updated_at: r.updated_at,
    created_at: typeof r.created_at === "string" ? r.created_at : r.updated_at,
    name: String(r.name ?? ""),
    email: typeof r.email === "string" ? r.email : null,
    phone: typeof r.phone === "string" ? r.phone : null,
    role,
    job_title: normalizeJobTitle(r.job_title),
    is_active: r.is_active !== false,
    has_pin: typeof r.pin_hash === "string" && r.pin_hash !== "",
    payroll: parsePayroll(r.payroll),
    // Baris lama (sebelum migrasi server) = Ruang Karyawan, semua outlet.
    personal_access: role === "owner" ? "full" : role === "staff" && access === "full" ? "staff_space" : access,
    outlet_ids: Array.isArray(r.outlet_ids) ? r.outlet_ids.filter((x): x is string => typeof x === "string") : null,
    has_password: r.has_password === true,
    invite_expires_at: typeof r.invite_expires_at === "string" ? r.invite_expires_at : null,
    bound_device_id: typeof r.bound_device_id === "string" ? r.bound_device_id : null,
    bound_at: typeof r.bound_at === "string" ? r.bound_at : null,
  };
}

function toPayslip(r: SyncRecord): Payslip {
  const lines = (Array.isArray(r.lines) ? r.lines : []).filter(isObj).map((l) => ({
    label: String(l.label ?? ""),
    kind: l.kind === "deduction" ? ("deduction" as const) : ("earning" as const),
    amount: int(l.amount),
  }));
  return { ...(r as Payslip), lines, note: typeof r.note === "string" ? r.note : "" };
}

function toAttendance(r: SyncRecord): Attendance {
  return { ...(r as Attendance), late_minutes: int(r.late_minutes), note: typeof r.note === "string" ? r.note : "" };
}

function toOutlet(r: SyncRecord): OutletLite {
  const s = isObj(r.settings) ? r.settings : {};
  const f = isObj(s.features) ? s.features : {};
  return { id: r.id, name: String(r.name ?? ""), kitchen: typeof f.kitchen === "boolean" ? f.kitchen : null };
}

/** Tarik semua data tim. `staff=false` (paket Gratis) → kehadiran & slip tidak ditarik. */
export async function loadTeam(staff: boolean, signal?: AbortSignal): Promise<TeamData> {
  const [emp, att, slips, leaves, settings, outlets] = await Promise.all([
    pullAll("employees", signal),
    staff ? pullAll("attendances", signal) : Promise.resolve([]),
    staff ? pullAll("payslips", signal) : Promise.resolve([]),
    staff ? pullAll("leave_requests", signal) : Promise.resolve([]),
    pullAll("business_settings", signal),
    pullAll("outlets", signal),
  ]);
  return {
    employees: emp.map(toEmployee),
    attendances: att.map(toAttendance),
    payslips: slips.map(toPayslip),
    leaves: leaves.map(toLeave),
    rules: readAttendance(settings[0]?.settings),
    outlets: outlets.map(toOutlet),
  };
}

/** Ganti/ tambah satu record hasil simpan ke data lokal (tanpa tarik ulang semuanya). */
export function mergeRecord(data: TeamData, entity: TeamEntity, rec: SyncRecord): TeamData {
  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i < 0) return [...list, item];
    const next = [...list];
    next[i] = item;
    return next;
  };
  if (entity === "employees") return { ...data, employees: upsert(data.employees, toEmployee(rec)) };
  if (entity === "attendances") return { ...data, attendances: upsert(data.attendances, toAttendance(rec)) };
  if (entity === "leave_requests") return { ...data, leaves: upsert(data.leaves, toLeave(rec)) };
  return { ...data, payslips: upsert(data.payslips, toPayslip(rec)) };
}

// ——— Tanggal (zona usaha) ———

const DAY_MS = 86_400_000;

/** "HH:MM" / "H.MM" → menit sejak tengah malam; null bila tidak sah (`parseClockMinutes` app). */
export function parseClockMinutes(text: string): number | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(text.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** `YYYY-MM-DD` → hari ISO (1 = Senin … 7 = Minggu). */
export function isoWeekday(day: string): number {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Tanggal + menit lokal (zona usaha) → milidetik UTC. */
export function zonedAt(day: string, minutes: number): number {
  return Date.parse(`${day}T00:00:00Z`) - zoneOffsetMs() + minutes * 60_000;
}

/** `YYYY-MM` → { start, end } tanggal pertama & terakhir bulan (keduanya termasuk) — `monthOf` app. */
export function monthOf(month: string): { start: string; end: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

/** Daftar tanggal [start..end] (termasuk) — `daysBetween` app. */
export function daysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`), e = Date.parse(`${end}T00:00:00Z`); t <= e; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** 12 bulan terakhir (terbaru dulu) — `recentMonths` app. */
export function recentMonths(count = 12, today = zonedToday()): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  });
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

/** Batas paling awal absen manual: 3 bulan ke belakang (pemilih tanggal di `manual_attendance_sheet.dart`). */
export function manualMinDay(today = zonedToday()): string {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 - 3, d)).toISOString().slice(0, 10);
}

/** Jam lokal "07:58" dari waktu tersimpan (UTC); "—" bila kosong. */
export function clockLabel(at: string | null | undefined): string {
  return at ? zonedHHMM(at) || "—" : "—";
}

// ——— Aturan kehadiran (attendance.dart) ———

const startMinute = (r: AttendanceRules) => parseClockMinutes(r.work_start) ?? 8 * 60;
const endMinute = (r: AttendanceRules) => parseClockMinutes(r.work_end) ?? 17 * 60;
const isOffDay = (r: AttendanceRules, day: string) => r.off_days.includes(isoWeekday(day));

/**
 * Absen masuk pada menit lokal `minute` hari `day`: terlambat bila lewat jam mulai + toleransi; menit telat dihitung
 * dari jam mulai. Hari libur tidak pernah terlambat. Cermin `evaluateClockIn`.
 */
export function evaluateClockIn(rules: AttendanceRules, day: string, minute: number): { status: "ontime" | "late"; late_minutes: number } {
  if (isOffDay(rules, day)) return { status: "ontime", late_minutes: 0 };
  const late = minute - startMinute(rules);
  if (late > rules.late_tolerance_min) return { status: "late", late_minutes: Math.min(late, 1440) };
  return { status: "ontime", late_minutes: 0 };
}

export type DayKind = AttendanceStatus | "off" | "upcoming";

export type Recap = {
  days: { day: string; kind: DayKind; row: Attendance | null }[];
  late_minutes: number;
  worked_minutes: number;
  overtime_minutes: number;
};

export const recapCount = (r: Recap, kind: DayKind) => r.days.filter((d) => d.kind === kind).length;
export const recapPresent = (r: Recap) => recapCount(r, "ontime") + recapCount(r, "late");

/**
 * Rekap satu karyawan untuk tiap hari di `days`. Hari tanpa catatan: libur bila hari libur mingguan, "belum tiba" bila
 * setelah hari ini / sebelum karyawan ada (`since`), hari ini belum berakhir = belum tiba, selain itu alpa. Hari libur
 * yang tetap masuk dihitung hadir. Cermin `AttendanceRecap.compute`.
 */
export function computeRecap(days: string[], rows: Attendance[], rules: AttendanceRules, today: string, since: string | null): Recap {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  const out: Recap = { days: [], late_minutes: 0, worked_minutes: 0, overtime_minutes: 0 };
  for (const day of days) {
    const row = byDate.get(day) ?? null;
    if (!row) {
      let kind: DayKind;
      if (day > today || (since !== null && day < since)) kind = "upcoming";
      else if (isOffDay(rules, day)) kind = "off";
      else if (day === today) kind = "upcoming";
      else kind = "absent";
      out.days.push({ day, kind, row: null });
      continue;
    }
    const status: AttendanceStatus = (["ontime", "late", "permit", "sick", "leave", "absent"] as const).includes(row.status) ? row.status : "ontime";
    out.days.push({ day, kind: status, row });
    if (status !== "ontime" && status !== "late") continue;
    if (status === "late") out.late_minutes += row.late_minutes;
    const inAt = row.clock_in_at ? Date.parse(row.clock_in_at) : NaN;
    const outAt = row.clock_out_at ? Date.parse(row.clock_out_at) : NaN;
    if (Number.isNaN(inAt) || Number.isNaN(outAt) || outAt < inAt) continue;
    out.worked_minutes += Math.floor((outAt - inAt) / 60_000);
    const end = zonedAt(day, endMinute(rules));
    if (outAt > end) {
      const from = inAt > end ? inAt : end;
      out.overtime_minutes += Math.floor((outAt - from) / 60_000);
    }
  }
  return out;
}

// ——— Gaji (payroll_calc.dart) ———

export type PayItemType = "base" | "allowance" | "overtime" | "late" | "absent";
export type PayItem = { type: PayItemType; amount: number; quantity: number; rate: number };
export type PayslipDraft = { items: PayItem[]; gross: number; deductions: number; net: number };

export const EMPTY_DRAFT: PayslipDraft = { items: [], gross: 0, deductions: 0, net: 0 };
export const isDeduction = (t: PayItemType) => t === "late" || t === "absent";
export const amountOf = (d: PayslipDraft, t: PayItemType) => d.items.filter((i) => i.type === t).reduce((a, i) => a + i.amount, 0);

/** (menit × tarif per jam) / 60, dibulatkan half-up (`perMinute`). */
export const perMinute = (minutes: number, ratePerHour: number) => Math.floor((minutes * ratePerHour + 30) / 60);

/**
 * Slip dari pengaturan gaji & rekap (fungsi murni; cermin `computePayslip`):
 * - bulanan: gaji pokok tetap; harian: upah × hari hadir; per jam: upah × jam kerja reguler (tanpa lembur).
 * - tunjangan hadir × hari hadir; lembur = menit setelah jam selesai × tarif.
 * - potongan: telat × menit, alpa × hari (izin/sakit/cuti tidak dipotong).
 * - total potongan dibatasi pendapatan (gaji bersih tidak pernah negatif).
 */
export function computePayslip(c: PayrollConfig, recap: Recap): PayslipDraft {
  if (c.type === "none") return EMPTY_DRAFT;
  const present = recapPresent(recap);
  const regular = Math.max(0, recap.worked_minutes - recap.overtime_minutes);
  const items: PayItem[] = [
    c.type === "monthly"
      ? { type: "base", amount: c.amount, quantity: 0, rate: 0 }
      : c.type === "daily"
        ? { type: "base", amount: present * c.amount, quantity: present, rate: c.amount }
        : { type: "base", amount: perMinute(regular, c.amount), quantity: regular, rate: c.amount },
  ];
  if (c.allowance_per_day > 0 && present > 0) {
    items.push({ type: "allowance", amount: present * c.allowance_per_day, quantity: present, rate: c.allowance_per_day });
  }
  if (c.overtime_per_hour > 0 && recap.overtime_minutes > 0) {
    items.push({ type: "overtime", amount: perMinute(recap.overtime_minutes, c.overtime_per_hour), quantity: recap.overtime_minutes, rate: c.overtime_per_hour });
  }
  const gross = items.reduce((a, i) => a + i.amount, 0);
  let room = gross;
  const deduct = (type: PayItemType, quantity: number, rate: number) => {
    const amount = Math.min(quantity * rate, room);
    if (amount <= 0) return;
    room -= amount;
    items.push({ type, amount, quantity, rate });
  };
  if (c.late_per_minute > 0) deduct("late", recap.late_minutes, c.late_per_minute);
  if (c.absent_per_day > 0) deduct("absent", recapCount(recap, "absent"), c.absent_per_day);
  return { items, gross, deductions: gross - room, net: room };
}

/** Nomor slip: satu per karyawan per bulan (`GJ-202609-1A2B3C`) — `payslipNumber`. */
export function payslipNumber(periodStart: string, employeeId: string): string {
  const short = employeeId.replace(/-/g, "");
  return `GJ-${periodStart.slice(0, 4)}${periodStart.slice(5, 7)}-${short.slice(Math.max(0, short.length - 6)).toUpperCase()}`;
}

// ——— Label (app_id.arb / team_labels.dart) ———

export const ROLE_LABEL: Record<Role, string> = { owner: "Pemilik", cashier: "Kasir", kitchen: "Dapur", staff: "Karyawan (absen saja)" };

/** Pilihan jabatan umum (disusun klien; hanya mengisi `job_title` teks). "Lainnya" = ketik sendiri. */
export const JOB_TITLE_PRESETS = ["CS", "Pelayan", "Barista", "Kurir", "Admin", "Kebersihan", "Keamanan"] as const;
export const JOB_TITLE_MAX = 40;

/** `job_title` → string ter-trim atau `null` (kosong/spasi = null, cermin server). */
export function normalizeJobTitle(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

/** "Kasir · Barista" — peran + jabatan (bila ada) untuk daftar. */
export const roleLine = (e: Pick<Employee, "role" | "job_title">): string => (e.job_title ? `${ROLE_LABEL[e.role]} · ${e.job_title}` : ROLE_LABEL[e.role]);
export const ACCESS_LABEL: Record<PersonalAccess, string> = {
  none: "Tidak bisa login",
  staff_space: "Ruang Karyawan",
  full: "Sesuai tugas",
};
export const ACCESS_HINT: Record<PersonalAccess, string> = {
  none: "Karyawan hanya memakai PIN di perangkat toko. Sesi di HP pribadinya dihentikan.",
  staff_space: "Dari HP pribadi hanya absen, riwayat absen, slip gaji, dan pengajuan izin miliknya.",
  full: "Dari HP pribadi bisa bekerja sesuai tugasnya (kasir/dapur) di outlet yang dipilih.",
};

/** Keadaan akun HP pribadi karyawan (untuk daftar & lembar ubah). */
export type AccountState = "owner" | "disabled" | "bound" | "active" | "invited" | "none";
export function accountState(e: Employee, now = Date.now()): AccountState {
  if (e.role === "owner") return "owner";
  if (e.personal_access === "none") return "disabled";
  if (e.bound_device_id) return "bound";
  const invited = !!e.invite_expires_at && Date.parse(e.invite_expires_at) > now;
  if (invited) return "invited";
  return e.has_password ? "active" : "none";
}
export const ACCOUNT_LABEL: Record<AccountState, string> = {
  owner: "Pemilik",
  disabled: "Tidak bisa login",
  bound: "Terhubung ke HP",
  active: "Akun dibuat",
  invited: "Undangan terkirim",
  none: "Belum diundang",
};

export const ROLE_HINT: Record<Role, string> = {
  owner: "Pemilik: semua menu, termasuk produk, laporan, tim, dan pengaturan.",
  cashier: "Kasir: transaksi, pesanan, riwayat, pelanggan, dan absen.",
  kitchen: "Dapur: layar dapur dan pesanan.",
  staff: "Karyawan (absen saja): tanpa akses kasir dan tanpa PIN. Absen, slip gaji, dan pengajuan dari HP pribadi (Ruang Karyawan); tanpa HP pribadi, absennya dicatat lewat Tim › Absen.",
};
export const PAY_TYPE_LABEL: Record<PayType, string> = { monthly: "Bulanan", daily: "Harian", hourly: "Per jam", none: "Tidak digaji" };
export const PAY_TYPE_HINT: Record<PayType, string> = {
  monthly: "Gaji tetap per bulan; alpa bisa dipotong.",
  daily: "Dibayar per hari hadir (tepat waktu atau terlambat).",
  hourly: "Dibayar per jam dari absen masuk sampai pulang.",
  none: "Tidak ikut perhitungan gaji (mis. pemilik).",
};
export const PAY_AMOUNT_LABEL: Record<Exclude<PayType, "none">, string> = {
  monthly: "Gaji per bulan",
  daily: "Upah per hari hadir",
  hourly: "Upah per jam kerja",
};
export const STATUS_LABEL: Record<DayKind, string> = {
  ontime: "Tepat waktu",
  late: "Terlambat",
  permit: "Izin",
  sick: "Sakit",
  leave: "Cuti",
  absent: "Alpa",
  off: "Libur",
  upcoming: "",
};
export const DAY_LETTER: Record<DayKind, string> = { ontime: "H", late: "T", permit: "I", sick: "S", leave: "C", absent: "A", off: "L", upcoming: "" };
export const SLIP_STATUS_LABEL: Record<SlipStatus, string> = { paid: "Dibayar", issued: "Terbit", draft: "Belum terbit" };

/** Rupiah gaya app (`formatRupiah` di money.dart: "Rp 150.000") — dipakai di label baris slip yang tersimpan. */
export function appRupiah(n: number): string {
  return `${n < 0 ? "-" : ""}Rp ${Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

/** "1 j 30 mnt" / "45 mnt" — `durationLabel`. */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} mnt`;
  if (m === 0) return `${h} j`;
  return `${h} j ${m} mnt`;
}

/** Ringkasan satu baris: "Harian · Rp 150.000/hari" — `payrollSummary`. */
export function payrollSummary(c: PayrollConfig): string {
  if (c.type === "monthly") return `Bulanan · ${appRupiah(c.amount)}/bulan`;
  if (c.type === "daily") return `Harian · ${appRupiah(c.amount)}/hari`;
  if (c.type === "hourly") return `Per jam · ${appRupiah(c.amount)}/jam`;
  return PAY_TYPE_LABEL.none;
}

/** Label baris slip dari komponen hitungan — `payItemLabel`. */
export function payItemLabel(item: PayItem, type: PayType): string {
  switch (item.type) {
    case "base":
      if (type === "monthly") return "Gaji pokok (bulanan)";
      if (type === "daily") return `Upah harian · ${item.quantity} hari × ${appRupiah(item.rate)}`;
      return `Upah per jam · ${durationLabel(item.quantity)} × ${appRupiah(item.rate)}`;
    case "allowance":
      return `Tunjangan hadir · ${item.quantity} hari`;
    case "overtime":
      return `Lembur · ${durationLabel(item.quantity)}`;
    case "late":
      return `Terlambat · ${item.quantity} mnt`;
    case "absent":
      return `Alpa · ${item.quantity} hari`;
  }
}

export function payslipLinesOf(draft: PayslipDraft, type: PayType): PayslipLine[] {
  return draft.items.map((i) => ({ label: payItemLabel(i, type), kind: isDeduction(i.type) ? "deduction" : "earning", amount: i.amount }));
}

/** Fakta rekap untuk lencana ("Hadir 20 hari", "Terlambat 2× · 35 mnt", …); fakta bernilai 0 disembunyikan kecuali Hadir. */
export function recapFacts(r: Recap): [string, string][] {
  const all: [string, string][] = [
    ["Hadir", `${recapPresent(r)} hari`],
    ["Terlambat", `${recapCount(r, "late")}× · ${durationLabel(r.late_minutes)}`],
    ["Izin", `${recapCount(r, "permit")}`],
    ["Sakit", `${recapCount(r, "sick")}`],
    ["Cuti", `${recapCount(r, "leave")}`],
    ["Alpa", `${recapCount(r, "absent")}`],
    ["Libur", `${recapCount(r, "off")}`],
  ];
  return all.filter((f, i) => i === 0 || !f[1].startsWith("0"));
}

// ——— Validasi (validators.dart / pin_setup_dialog.dart) ———

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const isEmail = (v: string) => EMAIL.test(v.trim());

/** `0812…`, `62812…`, `+62812…`, `812…` → `+62…`; null bila tidak sah — `PhoneNumber.tryParse`. */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (!/^\d+$/.test(d)) return null;
  if (d.startsWith("62")) d = d.slice(2);
  else if (d.startsWith("0")) d = d.slice(1);
  if (d.startsWith("0")) return null;
  if (!/^8\d{7,12}$/.test(d)) return null;
  return `+62${d}`;
}

/** PIN mudah ditebak: semua angka sama atau berurutan naik/turun — `_isTrivial`. */
export function isTrivialPin(pin: string): boolean {
  const d = [...pin].map((c) => c.charCodeAt(0));
  const same = d.every((c) => c === d[0]);
  let up = true;
  let down = true;
  for (let i = 1; i < d.length; i++) {
    up &&= d[i] === d[i - 1] + 1;
    down &&= d[i] === d[i - 1] - 1;
  }
  return same || up || down;
}

export const isPinFormat = (pin: string) => /^\d{6}$/.test(pin);

// ——— Id deterministik (UUID v5, namespace URL — sama dengan app) ———

const NS_URL = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

async function uuidV5(name: string, namespace = NS_URL): Promise<string> {
  const ns = namespace.replace(/-/g, "").match(/../g)!.map((h) => parseInt(h, 16));
  const bytes = new Uint8Array([...ns, ...new TextEncoder().encode(name)]);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-1", bytes)).slice(0, 16);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Id baris kehadiran yang sama di semua perangkat — `attendanceIdFor`. */
export const attendanceIdFor = (businessId: string, employeeId: string, date: string) =>
  uuidV5(`sissi-attendance:${businessId}:${employeeId}:${date}`);

/** Id slip: satu per karyawan per periode — `issuePayslip`. */
export const payslipIdFor = (businessId: string, employeeId: string, from: string, to: string) =>
  uuidV5(`sissi-payslip:${businessId}:${employeeId}:${from}:${to}`);

// ——— Simpan (POST /owner/changes) ———

export type TeamOutcome =
  | { status: "applied"; record: SyncRecord | null }
  | { status: "conflict"; record: SyncRecord | null; message: string }
  | { status: "rejected"; record: SyncRecord | null; message: string; fields: Record<string, string> };

const CONFLICT = "Data ini baru diubah di perangkat lain — sudah dimuat ulang. Periksa lalu simpan lagi.";

/** Pesan server → bahasa layar app bila dikenali. */
function friendly(msg: string): string {
  if (/Email sudah terdaftar/i.test(msg)) return "Email ini sudah dipakai karyawan lain.";
  if (/Nomor HP sudah terdaftar/i.test(msg)) return "Nomor HP ini sudah dipakai karyawan lain.";
  if (/sudah terbit/i.test(msg)) return "Slip gaji ini sudah terbit dan tidak dapat diubah.";
  return msg;
}

export function outcome(r: ChangeResult | undefined): TeamOutcome {
  if (!r) return { status: "rejected", record: null, message: "Server tidak mengembalikan hasil.", fields: {} };
  if (r.status === "applied") return { status: "applied", record: r.record ?? null };
  if (r.status === "conflict") return { status: "conflict", record: r.record ?? null, message: CONFLICT };
  const fields: Record<string, string> = {};
  for (const d of r.details ?? []) if (d.field && !fields[d.field]) fields[d.field] = friendly(d.message);
  const first = Object.values(fields)[0];
  return { status: "rejected", record: r.record ?? null, message: friendly(first ?? r.message ?? "Perubahan ditolak server."), fields };
}

async function pushOne(entity: WritableEntity, id: string, data: Record<string, unknown>, base?: string): Promise<TeamOutcome> {
  const [r] = await pushChanges([base ? { entity, op: "upsert", id, data, base_updated_at: base } : { entity, op: "upsert", id, data }]);
  return outcome(r);
}

export type EmployeeDraft = {
  name: string;
  role: Role;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  /** Hanya dikirim bila diisi (berubah dari data tersimpan); `null` = hapus jabatan. */
  job_title?: string | null;
  /** Hanya dikirim bila diisi (berubah dari data tersimpan). */
  personal_access?: PersonalAccess;
  outlet_ids?: string[] | null;
};

/**
 * Tambah (`base` null; `pin` opsional ikut dikirim sekali) atau ubah data karyawan. Hanya field form yang dikirim
 * (PIN & gaji tidak tersentuh) — `saveEmployee`.
 */
export function saveEmployee(id: string, d: EmployeeDraft, base: Employee | null, pin?: string): Promise<TeamOutcome> {
  const data: Record<string, unknown> = { name: d.name, email: d.email, phone: d.phone, role: d.role, is_active: d.is_active };
  if (d.job_title !== undefined) data.job_title = d.job_title;
  if (d.personal_access !== undefined) data.personal_access = d.personal_access;
  if (d.outlet_ids !== undefined) data.outlet_ids = d.outlet_ids;
  // `staff` tanpa PIN: server menolak `pin` bukan null untuk peran itu.
  if (!base && pin && d.role !== "staff") data.pin = pin;
  return pushOne("employees", id, data, base?.updated_at);
}

/** Lepas ikatan HP pribadi (`bound_device_id: null`) — karyawan bisa masuk lagi dari HP baru; sesi lama dicabut server. */
export function unbindDevice(e: Employee): Promise<TeamOutcome> {
  return pushOne("employees", e.id, { bound_device_id: null }, e.updated_at);
}

/** Setel/ganti PIN 6 digit (`setPin`) atau cabut (`pin: null`, `revokePin`). */
export function savePin(e: Employee, pin: string | null): Promise<TeamOutcome> {
  return pushOne("employees", e.id, { pin }, e.updated_at);
}

/** Pengaturan gaji (`savePayroll`; semua kunci, tanpa null — `toWire`). */
export function savePayroll(e: Employee, c: PayrollConfig): Promise<TeamOutcome> {
  return pushOne("employees", e.id, { payroll: { ...c } }, e.updated_at);
}

export type ManualAttendance = {
  employee_id: string;
  date: string;
  status: AttendanceStatus;
  clock_in_at: string | null;
  clock_out_at: string | null;
  late_minutes: number;
  note: string;
  reason: string;
  edited_by: string;
};

/** Absen manual / koreksi (pemilik; alasan wajib) — `saveManual`. */
export async function saveManualAttendance(
  m: ManualAttendance,
  ctx: { businessId: string; outletId: string; existing: Attendance | null }
): Promise<TeamOutcome> {
  const id = ctx.existing?.id ?? (await attendanceIdFor(ctx.businessId, m.employee_id, m.date));
  const late = m.status === "late" ? m.late_minutes : 0;
  const clockOut = m.clock_in_at ? m.clock_out_at : null;
  return pushOne(
    "attendances",
    id,
    {
      source: "manual",
      outlet_id: ctx.existing?.outlet_id ?? ctx.outletId,
      employee_id: m.employee_id,
      date: m.date,
      status: m.status,
      clock_in_at: m.clock_in_at,
      clock_out_at: clockOut,
      late_minutes: late,
      note: m.note,
      edit_reason: m.reason,
      edited_by: m.edited_by,
    },
    ctx.existing?.updated_at
  );
}

/** Terbitkan slip (beku setelah ini) — `issuePayslip`. Slip draf yang sudah ada untuk periode itu ditimpa. */
export async function issuePayslip(p: {
  businessId: string;
  employeeId: string;
  start: string;
  end: string;
  lines: PayslipLine[];
  existing: Payslip | null;
}): Promise<TeamOutcome> {
  if (p.existing && p.existing.status !== "draft") {
    return { status: "rejected", record: null, message: "Slip gaji ini sudah terbit dan tidak dapat diubah.", fields: {} };
  }
  const id = p.existing?.id ?? (await payslipIdFor(p.businessId, p.employeeId, p.start, p.end));
  const gross = p.lines.filter((l) => l.kind === "earning").reduce((a, l) => a + l.amount, 0);
  const deductions = p.lines.filter((l) => l.kind === "deduction").reduce((a, l) => a + l.amount, 0);
  return pushOne(
    "payslips",
    id,
    {
      employee_id: p.employeeId,
      period_start: p.start,
      period_end: p.end,
      number: p.existing?.number ?? payslipNumber(p.start, p.employeeId),
      lines: p.lines,
      gross,
      deductions,
      net: gross - deductions,
      status: "issued",
      issued_at: new Date().toISOString(),
    },
    p.existing?.updated_at
  );
}

/** Tandai slip sudah dibayar (final) — `markPaid`. Web tidak mencatat kas keluar laci (kas = perangkat). */
export function markPayslipPaid(slip: Payslip): Promise<TeamOutcome> {
  return pushOne("payslips", slip.id, { status: "paid", paid_at: new Date().toISOString() }, slip.updated_at);
}

// ——— Baris Gaji (team_providers.dart › payrollRowsProvider) ———

export type PayrollRow = {
  employee: Employee;
  config: PayrollConfig | null;
  recap: Recap;
  draft: PayslipDraft;
  slip: Payslip | null;
  configured: boolean;
  net: number;
  /** Kehadiran berubah setelah slip terbit (hitungan ≠ slip). */
  changedAfterIssue: boolean;
};

/** Rekap satu karyawan untuk bulan `month` (`recapFor`). */
export function recapFor(e: Employee, month: string, rows: Attendance[], rules: AttendanceRules, today = zonedToday()): Recap {
  const m = monthOf(month);
  return computeRecap(
    daysBetween(m.start, m.end),
    rows.filter((r) => r.employee_id === e.id && r.date >= m.start && r.date <= m.end),
    rules,
    today,
    zonedDay(e.created_at) || null
  );
}

/** Baris Gaji: karyawan aktif + yang punya slip bulan itu; pemilik tanpa pengaturan gaji tidak ikut. */
export function payrollRows(data: TeamData, month: string, today = zonedToday()): PayrollRow[] {
  const m = monthOf(month);
  const slips = new Map(data.payslips.filter((s) => s.period_start === m.start && s.period_end === m.end).map((s) => [s.employee_id, s]));
  return [...data.employees]
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" }))
    .filter((e) => (e.is_active || slips.has(e.id)) && (e.role !== "owner" || e.payroll !== null || slips.has(e.id)))
    .map((e) => {
      const config = e.payroll;
      const recap = recapFor(e, month, data.attendances, data.rules, today);
      const draft = config ? computePayslip(config, recap) : EMPTY_DRAFT;
      const slip = slips.get(e.id) ?? null;
      const configured = isPaid(config);
      return {
        employee: e,
        config,
        recap,
        draft,
        slip,
        configured,
        net: slip?.net ?? draft.net,
        changedAfterIssue: !!slip && slip.status !== "draft" && configured && (slip.net !== draft.net || slip.gross !== draft.gross),
      };
    });
}
