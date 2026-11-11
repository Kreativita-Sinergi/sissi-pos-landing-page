// Lembur (tahap 2, api.md "Lembur (tahap 2, entitas sync `overtime_requests`)") — bagian murni: bentuk record,
// validasi catat pemilik, dan jumlah lembur disetujui per tanggal untuk gaji/rekap. Kiriman ada di `overtime.ts`.

export type OvertimeStatus = "pending" | "approved" | "rejected" | "cancelled";
export type OvertimeSource = "employee" | "owner";

export type OvertimeRequest = {
  id: string;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
  employee_id: string;
  outlet_id: string | null;
  date: string;
  minutes: number;
  reason: string;
  source: OvertimeSource;
  status: OvertimeStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
};

export const OVERTIME_REASON_MAX = 300;
export const OVERTIME_NOTE_MAX = 200;
/** Catat langsung pemilik: hari ini … hari ini − 62. */
export const OVERTIME_OWNER_BACK_DAYS = 62;

const STATUSES: OvertimeStatus[] = ["pending", "approved", "rejected", "cancelled"];
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

export function toOvertime(r: { id: string; updated_at: string; deleted_at: string | null; [key: string]: unknown }): OvertimeRequest {
  const m = typeof r.minutes === "number" && Number.isFinite(r.minutes) ? Math.trunc(r.minutes) : 0;
  return {
    id: r.id,
    updated_at: r.updated_at,
    created_at: str(r.created_at) || r.updated_at,
    deleted_at: r.deleted_at,
    employee_id: str(r.employee_id),
    outlet_id: strOrNull(r.outlet_id),
    date: str(r.date).slice(0, 10),
    minutes: m,
    reason: str(r.reason),
    source: r.source === "owner" ? "owner" : "employee",
    status: STATUSES.includes(r.status as OvertimeStatus) ? (r.status as OvertimeStatus) : "pending",
    decided_by: strOrNull(r.decided_by),
    decided_at: strOrNull(r.decided_at),
    decision_note: str(r.decision_note),
  };
}

/** Menunggu dulu, lalu terbaru diajukan. */
export function overtimeOrder(a: OvertimeRequest, b: OvertimeRequest): number {
  if ((a.status === "pending") !== (b.status === "pending")) return a.status === "pending" ? -1 : 1;
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}

/** Menit lembur disetujui per tanggal untuk satu karyawan (tanpa tombstone). */
export function approvedOvertimeByDay(list: OvertimeRequest[], employeeId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of list) {
    if (r.employee_id !== employeeId || r.status !== "approved" || r.deleted_at) continue;
    out.set(r.date, (out.get(r.date) ?? 0) + r.minutes);
  }
  return out;
}

/** Validasi "Catat lembur" pemilik → galat per kolom (kosong = sah). */
export function validateOwnerOvertime(
  v: { employeeId: string | null; date: string; hours: number; minutes: number; reason: string },
  today: string
): Record<string, string> {
  const err: Record<string, string> = {};
  if (!v.employeeId) err.employee = "Pilih karyawan.";
  const min = shiftBack(today, OVERTIME_OWNER_BACK_DAYS);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || v.date > today || v.date < min) err.date = `Pilih tanggal hari ini sampai ${OVERTIME_OWNER_BACK_DAYS} hari ke belakang.`;
  const total = overtimeMinutes(v.hours, v.minutes);
  if (total === null || total < 1 || total > 1440) err.minutes = "Durasi 1 menit sampai 24 jam.";
  if (v.reason.trim().length > OVERTIME_REASON_MAX) err.reason = `Alasan paling banyak ${OVERTIME_REASON_MAX} karakter.`;
  return err;
}

/** Jam + menit → total menit; `null` bila tidak sah (bukan bilangan bulat ≥ 0, menit ≥ 60). */
export function overtimeMinutes(hours: number, minutes: number): number | null {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes >= 60) return null;
  return hours * 60 + minutes;
}

export function shiftBack(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}
