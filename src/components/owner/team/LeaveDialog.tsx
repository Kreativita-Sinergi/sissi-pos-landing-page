"use client";

import React, { useId, useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, errorMessage, Field, formatDateTime, inputClass, Notice, Spinner } from "@/components/admin/ui";
import { approveLeave, rejectLeave } from "@/lib/owner/leave";
import { LEAVE_NOTE_MAX, leaveDayList, planFor, type LeaveRequest } from "@/lib/owner/leavePlan";
import { ROLE_LABEL } from "@/lib/owner/team";
import { LEAVE_KIND_LABEL, LeaveStatusBadge, leaveRangeText } from "./LeaveTab";
import type { TeamCtx } from "./shared";

// Detail pengajuan + Setujui/Tolak (cermin `leave_decision_sheet.dart`). Setujui menampilkan rencana lebih dulu:
// jumlah hari yang dicatat sebagai izin/sakit/cuti di Kehadiran dan tanggal yang dilewati (libur, sudah absen masuk).

export type LeaveTarget = { id: string; key: number } | null;

type Mode = "view" | "approve" | "reject";

export function LeaveDialog({
  target,
  ctx,
  owner,
  businessId,
  fallbackOutlet,
  onClose,
}: {
  target: LeaveTarget;
  ctx: TeamCtx;
  owner: { id: string; name: string };
  businessId: string;
  /** Outlet untuk baris absen baru bila pengajuan tanpa outlet (outlet terpilih / pertama). */
  fallbackOutlet: string;
  onClose: () => void;
}) {
  const request = target ? (ctx.data.leaves.find((r) => r.id === target.id) ?? null) : null;
  const [busy, setBusy] = useState(false);
  const title = request ? `Pengajuan ${LEAVE_KIND_LABEL[request.kind].toLowerCase()}` : "Pengajuan";
  return (
    <Modal open={!!target} title={title} onClose={() => !busy && onClose()} dismissible={!busy}>
      {target && !request && <p>Pengajuan tidak ditemukan.</p>}
      {target && request && (
        <LeaveBody
          key={target.key}
          request={request}
          ctx={ctx}
          owner={owner}
          businessId={businessId}
          fallbackOutlet={fallbackOutlet}
          busy={busy}
          setBusy={setBusy}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function LeaveBody({
  request: r,
  ctx,
  owner,
  businessId,
  fallbackOutlet,
  busy,
  setBusy,
  onDone,
}: {
  request: LeaveRequest;
  ctx: TeamCtx;
  owner: { id: string; name: string };
  businessId: string;
  fallbackOutlet: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>("view");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const employee = ctx.data.employees.find((e) => e.id === r.employee_id) ?? null;
  const decider = r.decided_by ? (ctx.data.employees.find((e) => e.id === r.decided_by)?.name ?? "Pemilik") : null;
  const outlet = r.outlet_id ? ctx.data.outlets.find((o) => o.id === r.outlet_id)?.name : null;
  const plan = useMemo(() => planFor(r, ctx.data.attendances, ctx.data.rules.off_days), [r, ctx.data.attendances, ctx.data.rules.off_days]);
  const kind = LEAVE_KIND_LABEL[r.kind];
  const tooLong = note.trim().length > LEAVE_NOTE_MAX;

  const submit = async () => {
    if (tooLong) return;
    setBusy(true);
    setError(null);
    try {
      const out =
        mode === "approve"
          ? await approveLeave({ request: r, plan, attendances: ctx.data.attendances, ownerId: owner.id, businessId, fallbackOutlet, note })
          : await rejectLeave({ request: r, ownerId: owner.id, note });
      if (out.status === "stale") {
        toast.error(out.message);
        ctx.reload();
        onDone();
        return;
      }
      if (out.status === "rejected") {
        setError(out.fields.decision_note ?? out.message);
        return;
      }
      if (out.leave) ctx.merge("leave_requests", { status: "applied", record: out.leave });
      for (const a of out.attendances) ctx.merge("attendances", { status: "applied", record: a });
      if (mode === "approve") {
        toast.success(`Pengajuan disetujui. ${out.attendances.length} hari dicatat di Kehadiran.`);
        if (out.failedDays > 0) {
          toast.error(`${out.failedDays} hari gagal dicatat (absen baru diubah di perangkat lain). Periksa di Kehadiran.`);
          ctx.reload();
        }
      } else toast.success("Pengajuan ditolak.");
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-2.5 text-[14px]">
        <Row label="Karyawan">
          <span className="break-words">{employee?.name ?? "Karyawan terhapus"}</span>
          {employee && <span className="text-text-muted"> · {ROLE_LABEL[employee.role]}</span>}
        </Row>
        <Row label="Jenis">{kind}</Row>
        <Row label="Tanggal">
          <span className="tabular-nums">{leaveRangeText(r)}</span>
        </Row>
        {outlet && <Row label="Outlet">{outlet}</Row>}
        <Row label="Alasan">
          <span className="whitespace-pre-line break-words">{r.reason.trim() || "—"}</span>
        </Row>
        <Row label="Status">
          <LeaveStatusBadge status={r.status} />
        </Row>
        <Row label="Diajukan">{formatDateTime(r.created_at)}</Row>
        {r.decided_at && (
          <Row label="Diputuskan">
            {formatDateTime(r.decided_at)}
            {decider && <span className="text-text-muted"> · {decider}</span>}
          </Row>
        )}
        {r.decision_note.trim() && (
          <Row label="Catatan pemilik">
            <span className="whitespace-pre-line break-words">{r.decision_note}</span>
          </Row>
        )}
      </dl>

      {r.status === "pending" && mode === "view" && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btn.secondary} onClick={() => setMode("reject")}>
            <X size={16} aria-hidden /> Tolak
          </button>
          <button type="button" className={btn.primary} onClick={() => setMode("approve")}>
            <Check size={16} aria-hidden /> Setujui
          </button>
        </div>
      )}

      {r.status === "pending" && mode !== "view" && (
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          {mode === "approve" && (
            <div className="rounded-[12px] bg-bg-muted px-3.5 py-3 text-[13.5px]" role="status">
              <p className="font-semibold text-text-heading">
                {plan.written.length > 0
                  ? `Disetujui = ${plan.written.length} hari dicatat sebagai ${kind.toLowerCase()} di Kehadiran.`
                  : "Tidak ada tanggal yang dicatat di Kehadiran — semua tanggal dilewati."}
              </p>
              {plan.offDays.length > 0 && <p className="mt-1 break-words text-text-body">Dilewati, hari libur: {leaveDayList(plan.offDays)}</p>}
              {plan.clockedIn.length > 0 && <p className="mt-1 break-words text-text-body">Dilewati, sudah absen masuk: {leaveDayList(plan.clockedIn)}</p>}
            </div>
          )}
          <Field
            id={`${id}-note`}
            label="Catatan untuk karyawan (opsional)"
            error={tooLong ? `Catatan paling banyak ${LEAVE_NOTE_MAX} karakter.` : undefined}
            hint={`${note.trim().length}/${LEAVE_NOTE_MAX}`}
          >
            <textarea
              id={`${id}-note`}
              className={`${inputClass} min-h-[64px] py-2`}
              rows={2}
              value={note}
              aria-invalid={tooLong || undefined}
              placeholder={mode === "approve" ? "Mis. Semoga cepat sembuh" : "Mis. Hari itu jadwal penuh"}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {error && (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={btn.secondary} onClick={() => setMode("view")} disabled={busy}>
              Kembali
            </button>
            <button type="button" className={mode === "approve" ? btn.primary : btn.danger} onClick={submit} disabled={busy || tooLong}>
              {busy && <Spinner />}
              {mode === "approve" ? "Ya, setujui" : "Ya, tolak"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(84px,30%)_1fr] gap-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className="min-w-0 text-text-heading">{children}</dd>
    </div>
  );
}
