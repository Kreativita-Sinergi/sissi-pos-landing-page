// Lembur di dasbor pemilik: setujui / tolak / batalkan pengajuan karyawan dan catat langsung (POST /owner/changes,
// api.md "Lembur (tahap 2)"). Status final (ditolak/dibatalkan) beku → server membalas conflict.

import { newId, pushChanges } from "./api";
import { OVERTIME_NOTE_MAX, type OvertimeRequest } from "./overtimePlan";
import { outcome, type TeamOutcome } from "./team";
import type { Change } from "./types";

export const OVERTIME_DECIDED_ELSEWHERE = "Pengajuan lembur sudah diubah di perangkat lain — daftar dimuat ulang.";

export type OvertimeDecision = "approve" | "reject" | "cancel";

/**
 * Kiriman keputusan pemilik (murni): pending → approved/rejected (catatan opsional ≤ 200), approved → cancelled (alasan
 * wajib). Galat → string. Keputusan lain dari status yang tidak cocok ditolak di klien.
 */
export function overtimeDecisionChange(r: OvertimeRequest, decision: OvertimeDecision, ownerId: string, note: string, now: string): Change | string {
  const n = note.trim();
  if (n.length > OVERTIME_NOTE_MAX) return `Catatan paling banyak ${OVERTIME_NOTE_MAX} karakter.`;
  if (decision === "cancel" && !n) return "Tulis alasan pembatalan.";
  if (decision === "cancel" ? r.status !== "approved" : r.status !== "pending") return "Status lembur sudah berubah.";
  const status = decision === "approve" ? "approved" : decision === "reject" ? "rejected" : "cancelled";
  return {
    entity: "overtime_requests",
    op: "upsert",
    id: r.id,
    data: { status, decided_by: ownerId, decided_at: now, decision_note: n },
    base_updated_at: r.updated_at,
  };
}

/** Kiriman "Catat lembur" pemilik (murni): `source: "owner"`, langsung disetujui. */
export function ownerOvertimeChange(
  p: { employeeId: string; outletId: string | null; date: string; minutes: number; reason: string; ownerId: string },
  id: string,
  now: string
): Change {
  return {
    entity: "overtime_requests",
    op: "upsert",
    id,
    data: {
      employee_id: p.employeeId,
      outlet_id: p.outletId,
      date: p.date,
      minutes: p.minutes,
      reason: p.reason.trim(),
      source: "owner",
      status: "approved",
      decided_by: p.ownerId,
      decided_at: now,
      decision_note: "",
    },
  };
}

export async function decideOvertime(p: { request: OvertimeRequest; decision: OvertimeDecision; ownerId: string; note: string }): Promise<TeamOutcome> {
  const c = overtimeDecisionChange(p.request, p.decision, p.ownerId, p.note, new Date().toISOString());
  if (typeof c === "string") return { status: "rejected", record: null, message: c, fields: { decision_note: c } };
  const [r] = await pushChanges([c]);
  return outcome(r);
}

export async function recordOvertime(p: {
  employeeId: string;
  outletId: string | null;
  date: string;
  minutes: number;
  reason: string;
  ownerId: string;
}): Promise<TeamOutcome> {
  const [r] = await pushChanges([ownerOvertimeChange(p, newId(), new Date().toISOString())]);
  return outcome(r);
}
