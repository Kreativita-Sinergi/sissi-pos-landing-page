// Logika murni pengajuan izin/sakit/cuti (tanpa impor runtime agar bisa dites `node --test` tanpa bundler).
// Cermin sissi-app/lib/features/leave/models/leave_request.dart (`leaveDays`, `planLeaveApproval`) dan
// lib/features/leave/data/leave_repository.dart (`approve`: absen manual per tanggal, `edit_reason` "Pengajuan disetujui").

export type LeaveKind = "permit" | "sick" | "leave";
export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

/** Batas isi (cermin `LeaveLimits` app & validasi server). */
export const LEAVE_NOTE_MAX = 200;

/** `edit_reason` absen yang ditulis saat pengajuan disetujui (nilai data, sama dengan app). */
export const APPROVED_EDIT_REASON = "Pengajuan disetujui";

const DAY_MS = 86_400_000;
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));

/** Semua tanggal `from..to` (termasuk), `YYYY-MM-DD`. Kosong bila tanggal rusak atau terbalik. */
export function leaveDays(from: string, to: string): string[] {
  if (!isDay(from) || !isDay(to)) return [];
  const out: string[] = [];
  for (let t = Date.parse(`${from}T00:00:00Z`), e = Date.parse(`${to}T00:00:00Z`); t <= e && out.length <= 366; t += DAY_MS) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

/** Hari ISO `YYYY-MM-DD` (1 = Senin … 7 = Minggu) — sama dengan `DateTime.weekday` Dart. */
export function weekdayOf(day: string): number {
  const d = new Date(`${day}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export type LeaveApproval = { written: string[]; offDays: string[]; clockedIn: string[] };

export const skippedAny = (p: LeaveApproval) => p.offDays.length > 0 || p.clockedIn.length > 0;

/**
 * Rencana persetujuan `days`: hari libur dilewati lebih dulu, lalu tanggal yang sudah punya jam masuk; sisanya ditulis.
 * Cermin `planLeaveApproval` (urutan cek sama).
 */
export function planLeaveApproval(
  days: string[],
  isOffDay: (day: string) => boolean,
  hasClockIn: (day: string) => boolean
): LeaveApproval {
  const plan: LeaveApproval = { written: [], offDays: [], clockedIn: [] };
  for (const d of days) {
    if (isOffDay(d)) plan.offDays.push(d);
    else if (hasClockIn(d)) plan.clockedIn.push(d);
    else plan.written.push(d);
  }
  return plan;
}

type AttendanceLite = { id: string; employee_id: string; date: string; clock_in_at: string | null; outlet_id: string; updated_at: string };
type LeaveLite = { id: string; employee_id: string; outlet_id: string | null; kind: LeaveKind; date_from: string; date_to: string };

/** Rencana untuk pengajuan `r` dari absen yang ada & hari libur mingguan (`off_days`, 1 = Senin … 7 = Minggu). */
export function planFor(r: LeaveLite, attendances: AttendanceLite[], offDays: number[]): LeaveApproval {
  const clocked = new Set(
    attendances.filter((a) => a.employee_id === r.employee_id && a.clock_in_at && a.date >= r.date_from && a.date <= r.date_to).map((a) => a.date)
  );
  return planLeaveApproval(
    leaveDays(r.date_from, r.date_to),
    (d) => offDays.includes(weekdayOf(d)),
    (d) => clocked.has(d)
  );
}

export type PlannedChange = {
  entity: "leave_requests" | "attendances";
  op: "upsert";
  id: string;
  data: Record<string, unknown>;
  base_updated_at?: string;
};

/**
 * SATU kiriman persetujuan: perubahan status pengajuan (berbasis `updated_at`) lebih dulu, lalu absen `manual` per
 * tanggal yang ditulis. Baris absen yang sudah ada (tanpa jam masuk) ditimpa dengan id & outletnya sendiri (berbasis);
 * baris baru memakai id deterministik `idFor(date)` dan outlet pengajuan, atau `fallbackOutlet`.
 */
export async function approvalChanges(p: {
  request: LeaveLite & { updated_at: string };
  plan: LeaveApproval;
  attendances: AttendanceLite[];
  ownerId: string;
  note: string;
  decidedAt: string;
  fallbackOutlet: string;
  idFor: (date: string) => Promise<string>;
}): Promise<PlannedChange[]> {
  const r = p.request;
  const out: PlannedChange[] = [
    {
      entity: "leave_requests",
      op: "upsert",
      id: r.id,
      data: { status: "approved", decided_by: p.ownerId, decided_at: p.decidedAt, decision_note: p.note.trim() },
      base_updated_at: r.updated_at,
    },
  ];
  const existing = new Map(p.attendances.filter((a) => a.employee_id === r.employee_id).map((a) => [a.date, a]));
  for (const date of p.plan.written) {
    const cur = existing.get(date) ?? null;
    const change: PlannedChange = {
      entity: "attendances",
      op: "upsert",
      id: cur?.id ?? (await p.idFor(date)),
      data: {
        source: "manual",
        outlet_id: cur?.outlet_id ?? r.outlet_id ?? p.fallbackOutlet,
        employee_id: r.employee_id,
        date,
        status: r.kind,
        clock_in_at: null,
        clock_out_at: null,
        late_minutes: 0,
        note: "",
        edit_reason: APPROVED_EDIT_REASON,
        edited_by: p.ownerId,
        // Server menolak absen ini (DEPENDS_ON_REJECTED) bila pengajuannya ternyata tidak disetujui.
        leave_request_id: r.id,
      },
    };
    if (cur) change.base_updated_at = cur.updated_at;
    out.push(change);
  }
  return out;
}

// ——— Label tanggal (leave_labels.dart) ———

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const parts = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return { y, m, d };
};

/** "20 Okt 2026" · "20–21 Okt 2026" · "30 Okt – 2 Nov 2026" · "30 Des 2026 – 2 Jan 2027" — `leaveRangeLabel`. */
export function leaveRangeLabel(from: string, to: string): string {
  if (!isDay(from) || !isDay(to)) return `${from} – ${to}`;
  const a = parts(from);
  const b = parts(to);
  const full = (p: { y: number; m: number; d: number }) => `${p.d} ${MONTHS[p.m - 1]} ${p.y}`;
  if (a.y === b.y && a.m === b.m) return a.d === b.d ? full(a) : `${a.d}–${full(b)}`;
  if (a.y === b.y) return `${a.d} ${MONTHS[a.m - 1]} – ${full(b)}`;
  return `${full(a)} – ${full(b)}`;
}

/** "Min 18 Okt, Sel 20 Okt" — `leaveDayList`. */
export function leaveDayList(days: string[]): string {
  return days
    .map((day) => {
      const p = parts(day);
      return `${DAYS[weekdayOf(day)]} ${p.d} ${MONTHS[p.m - 1]}`;
    })
    .join(", ");
}

// ——— Record `leave_requests` (api.md "Pengajuan izin/sakit/cuti") ———

export type LeaveRequest = {
  id: string;
  updated_at: string;
  created_at: string;
  deleted_at: string | null;
  employee_id: string;
  outlet_id: string | null;
  kind: LeaveKind;
  date_from: string;
  date_to: string;
  reason: string;
  status: LeaveStatus;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string;
};

const KINDS: LeaveKind[] = ["permit", "sick", "leave"];
const STATUSES: LeaveStatus[] = ["pending", "approved", "rejected", "cancelled"];
const str = (v: unknown) => (typeof v === "string" ? v : "");
const strOrNull = (v: unknown) => (typeof v === "string" && v !== "" ? v : null);

/** Record mentah → LeaveRequest (nilai tidak dikenal = bawaan app: izin / menunggu). */
export function toLeave(r: { id: string; updated_at: string; deleted_at: string | null; [key: string]: unknown }): LeaveRequest {
  return {
    id: r.id,
    updated_at: r.updated_at,
    created_at: str(r.created_at) || r.updated_at,
    deleted_at: r.deleted_at,
    employee_id: str(r.employee_id),
    outlet_id: strOrNull(r.outlet_id),
    kind: KINDS.includes(r.kind as LeaveKind) ? (r.kind as LeaveKind) : "permit",
    date_from: str(r.date_from),
    date_to: str(r.date_to),
    reason: str(r.reason),
    status: STATUSES.includes(r.status as LeaveStatus) ? (r.status as LeaveStatus) : "pending",
    decided_by: strOrNull(r.decided_by),
    decided_at: strOrNull(r.decided_at),
    decision_note: str(r.decision_note),
  };
}

/** Urutan daftar: terbaru diajukan dulu (`watchAll` app). */
export const byNewest = (a: LeaveRequest, b: LeaveRequest) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0);
