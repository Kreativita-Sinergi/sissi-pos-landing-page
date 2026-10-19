// Pengajuan izin/sakit/cuti di dasbor pemilik: setujui / tolak lewat POST /owner/changes (api.md "Dasbor pemilik ›
// Kelola data › Pengajuan izin/sakit/cuti"). Cermin sissi-app/lib/features/leave/data/leave_repository.dart.
// Setujui = SATU kiriman: status pengajuan lebih dulu + absen `manual` per tanggal (server menulis absen hanya bila
// keputusan pengajuan diterapkan).

import { pushChanges } from "./api";
import { approvalChanges, LEAVE_NOTE_MAX, type LeaveApproval, type LeaveRequest } from "./leavePlan";
import { attendanceIdFor, outcome, type Attendance } from "./team";
import type { SyncRecord } from "./types";

export const LEAVE_DECIDED_ELSEWHERE = "Pengajuan sudah diputuskan/diubah di perangkat lain — daftar dimuat ulang.";

export type LeaveDecisionResult =
  | { status: "applied"; leave: SyncRecord | null; attendances: SyncRecord[]; failedDays: number }
  | { status: "stale"; message: string }
  | { status: "rejected"; message: string; fields: Record<string, string> };

function checkNote(note: string): string | null {
  return note.trim().length > LEAVE_NOTE_MAX ? `Catatan paling banyak ${LEAVE_NOTE_MAX} karakter.` : null;
}

/** Pemilik `ownerId` menyetujui `r` sesuai `plan` (tanggal libur & berjam masuk sudah disisihkan). */
export async function approveLeave(p: {
  request: LeaveRequest;
  plan: LeaveApproval;
  attendances: Attendance[];
  ownerId: string;
  businessId: string;
  fallbackOutlet: string;
  note: string;
}): Promise<LeaveDecisionResult> {
  const bad = checkNote(p.note);
  if (bad) return { status: "rejected", message: bad, fields: { decision_note: bad } };
  const changes = await approvalChanges({
    request: p.request,
    plan: p.plan,
    attendances: p.attendances,
    ownerId: p.ownerId,
    note: p.note,
    decidedAt: new Date().toISOString(),
    fallbackOutlet: p.fallbackOutlet,
    idFor: (date) => attendanceIdFor(p.businessId, p.request.employee_id, date),
  });
  const results = await pushChanges(changes);
  return settle(p.request.id, results);
}

/** Pemilik `ownerId` menolak `r` (catatan opsional ≤ 200). */
export async function rejectLeave(p: { request: LeaveRequest; ownerId: string; note: string }): Promise<LeaveDecisionResult> {
  const bad = checkNote(p.note);
  if (bad) return { status: "rejected", message: bad, fields: { decision_note: bad } };
  const results = await pushChanges([
    {
      entity: "leave_requests",
      op: "upsert",
      id: p.request.id,
      data: { status: "rejected", decided_by: p.ownerId, decided_at: new Date().toISOString(), decision_note: p.note.trim() },
      base_updated_at: p.request.updated_at,
    },
  ]);
  return settle(p.request.id, results);
}

function settle(id: string, results: Awaited<ReturnType<typeof pushChanges>>): LeaveDecisionResult {
  const mine = results.find((r) => r.entity === "leave_requests" && r.id === id);
  const leave = outcome(mine);
  // conflict = sudah final/diubah di server (mis. karyawan membatalkan); rejected tanpa kolom = aturan server menolak.
  if (leave.status === "conflict" || (leave.status === "rejected" && mine?.code !== "VALIDATION_ERROR")) {
    return { status: "stale", message: LEAVE_DECIDED_ELSEWHERE };
  }
  if (leave.status === "rejected") return { status: "rejected", message: leave.message, fields: leave.fields };
  const att = results.filter((r) => r.entity === "attendances");
  return {
    status: "applied",
    leave: leave.record,
    attendances: att.flatMap((r) => (r.status === "applied" && r.record ? [r.record] : [])),
    failedDays: att.filter((r) => r.status !== "applied").length,
  };
}
