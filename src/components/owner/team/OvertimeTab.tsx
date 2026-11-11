"use client";

import React, { useId, useMemo, useState } from "react";
import { Check, ChevronRight, Clock, Plus, ShieldCheck, Undo2, X } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { Badge, btn, EmptyState, errorMessage, Field, focusRing, formatDateTime, inputClass, Notice, Section, Spinner, TimeAgo } from "@/components/admin/ui";
import { Select } from "@/components/owner/Select";
import { durationLabel } from "@/lib/duration";
import { decideOvertime, OVERTIME_DECIDED_ELSEWHERE, recordOvertime, type OvertimeDecision } from "@/lib/owner/overtime";
import {
  OVERTIME_NOTE_MAX,
  OVERTIME_OWNER_BACK_DAYS,
  OVERTIME_REASON_MAX,
  overtimeMinutes,
  overtimeOrder,
  shiftBack,
  validateOwnerOvertime,
  type OvertimeRequest,
  type OvertimeStatus,
} from "@/lib/owner/overtimePlan";
import { ROLE_LABEL } from "@/lib/owner/team";
import { formatDayLong, zonedToday } from "@/lib/owner/tz";
import { LEAVE_STATUS_LABEL, type LeaveFilter } from "./LeaveTab";
import { Avatar, type TeamCtx } from "./shared";

// Lembur (tahap 2, api.md "Lembur"): pengajuan dari HP karyawan → Setujui/Tolak; yang disetujui bisa dibatalkan
// (alasan wajib); pemilik bisa "Catat lembur" langsung (langsung disetujui). Gaji memakai lembur disetujui saja.

const STATUS_TONE: Record<OvertimeStatus, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

export function OvertimeStatusBadge({ status }: { status: OvertimeStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{LEAVE_STATUS_LABEL[status]}</Badge>;
}

export type OvertimeTarget = { id: string; key: number } | null;

export function OvertimeSection({
  ctx,
  filter,
  onOpen,
  onRecord,
}: {
  ctx: TeamCtx;
  filter: LeaveFilter;
  onOpen: (id: string) => void;
  onRecord: () => void;
}) {
  const names = useMemo(() => new Map(ctx.data.employees.map((e) => [e.id, e.name])), [ctx.data.employees]);
  const all = useMemo(() => [...ctx.data.overtime].sort(overtimeOrder), [ctx.data.overtime]);
  const list = filter === "pending" ? all.filter((r) => r.status === "pending") : all;
  return (
    <Section
      className="mt-4"
      title="Lembur"
      description="Gaji hanya menghitung lembur yang disetujui — bukan dari jam pulang."
      bodyClass=""
      actions={
        <button type="button" className={btn.secondary} onClick={onRecord}>
          <Plus size={16} aria-hidden /> Catat lembur
        </button>
      }
    >
      {list.length === 0 ? (
        <EmptyState icon={<Clock size={22} aria-hidden />} title={filter === "pending" && all.length > 0 ? "Tidak ada lembur yang menunggu" : "Belum ada lembur"}>
          Pengajuan lembur dari HP karyawan muncul di sini.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {list.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => onOpen(r.id)}
                className={`flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}
              >
                <Avatar name={names.get(r.employee_id) ?? "?"} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="min-w-0 truncate font-semibold text-text-heading">{names.get(r.employee_id) ?? "Karyawan terhapus"}</span>
                    <Badge tone="brand">Lembur {durationLabel(r.minutes)}</Badge>
                    <OvertimeStatusBadge status={r.status} />
                  </span>
                  <span className="mt-0.5 block text-[13px] text-text-body tabular-nums">{formatDayLong(r.date)}</span>
                  {r.reason.trim() && <span className="mt-0.5 line-clamp-2 text-[13.5px] break-words text-text-muted">{r.reason.trim()}</span>}
                  <span className="mt-1 block text-[12.5px] text-text-muted">
                    {r.source === "owner" ? "Dicatat pemilik" : "Diajukan"} <TimeAgo value={r.created_at} />
                  </span>
                </span>
                <ChevronRight size={16} aria-hidden className="mt-2.5 shrink-0 text-text-muted" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

type Mode = "view" | OvertimeDecision;

/** Detail lembur + Setujui / Tolak (pending) atau Batalkan lembur (disetujui). */
export function OvertimeDialog({ target, ctx, owner, onClose }: { target: OvertimeTarget; ctx: TeamCtx; owner: { id: string }; onClose: () => void }) {
  const request = target ? (ctx.data.overtime.find((r) => r.id === target.id) ?? null) : null;
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={!!target} title="Lembur" onClose={() => !busy && onClose()} dismissible={!busy}>
      {target && !request && <p>Pengajuan lembur tidak ditemukan.</p>}
      {target && request && <OvertimeBody key={target.key} request={request} ctx={ctx} owner={owner} busy={busy} setBusy={setBusy} onDone={onClose} />}
    </Modal>
  );
}

function OvertimeBody({
  request: r,
  ctx,
  owner,
  busy,
  setBusy,
  onDone,
}: {
  request: OvertimeRequest;
  ctx: TeamCtx;
  owner: { id: string };
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
  const tooLong = note.trim().length > OVERTIME_NOTE_MAX;
  const needNote = mode === "cancel" && !note.trim();

  const submit = async () => {
    if (mode === "view" || tooLong || needNote) return;
    setBusy(true);
    setError(null);
    try {
      const out = await decideOvertime({ request: r, decision: mode, ownerId: owner.id, note });
      if (out.status === "conflict" || (out.status === "rejected" && !out.fields.decision_note)) {
        toast.error(out.status === "conflict" ? OVERTIME_DECIDED_ELSEWHERE : out.message);
        ctx.reload();
        onDone();
        return;
      }
      if (out.status === "rejected") {
        setError(out.fields.decision_note ?? out.message);
        return;
      }
      ctx.merge("overtime_requests", out);
      toast.success(mode === "approve" ? "Lembur disetujui." : mode === "reject" ? "Lembur ditolak." : "Lembur dibatalkan.");
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
        <Row label="Tanggal">{formatDayLong(r.date)}</Row>
        <Row label="Durasi">
          <span className="tabular-nums">{durationLabel(r.minutes)}</span>
        </Row>
        <Row label="Alasan">
          <span className="whitespace-pre-line break-words">{r.reason.trim() || "—"}</span>
        </Row>
        <Row label="Status">
          <OvertimeStatusBadge status={r.status} />
        </Row>
        <Row label={r.source === "owner" ? "Dicatat" : "Diajukan"}>{formatDateTime(r.created_at)}</Row>
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

      {mode === "view" && r.status === "pending" && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btn.secondary} onClick={() => setMode("reject")}>
            <X size={16} aria-hidden /> Tolak
          </button>
          <button type="button" className={btn.primary} onClick={() => setMode("approve")}>
            <Check size={16} aria-hidden /> Setujui
          </button>
        </div>
      )}
      {mode === "view" && r.status === "approved" && (
        <div className="flex justify-end">
          <button type="button" className={btn.secondary} onClick={() => setMode("cancel")}>
            <Undo2 size={16} aria-hidden /> Batalkan lembur
          </button>
        </div>
      )}

      {mode !== "view" && (
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          {mode === "approve" && (
            <p className="rounded-[12px] bg-bg-muted px-3.5 py-3 text-[13.5px] font-semibold text-text-heading" role="status">
              Disetujui = {durationLabel(r.minutes)} lembur dihitung di gaji bulan tanggal {formatDayLong(r.date)}.
            </p>
          )}
          <Field
            id={`${id}-note`}
            label={mode === "cancel" ? "Alasan pembatalan" : "Catatan untuk karyawan (opsional)"}
            error={tooLong ? `Catatan paling banyak ${OVERTIME_NOTE_MAX} karakter.` : undefined}
            hint={`${note.trim().length}/${OVERTIME_NOTE_MAX}`}
          >
            <textarea
              id={`${id}-note`}
              className={`${inputClass} min-h-[64px] py-2`}
              rows={2}
              value={note}
              aria-invalid={tooLong || undefined}
              placeholder={mode === "cancel" ? "Mis. Salah tanggal" : mode === "approve" ? "Mis. Terima kasih sudah membantu" : "Mis. Tidak ada permintaan lembur hari itu"}
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
            <button type="button" className={mode === "approve" ? btn.primary : btn.danger} onClick={submit} disabled={busy || tooLong || needNote}>
              {busy && <Spinner />}
              {mode === "approve" ? "Ya, setujui" : mode === "reject" ? "Ya, tolak" : "Ya, batalkan lembur"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** "Catat lembur" pemilik: karyawan aktif, tanggal hari ini … −62 hari, durasi jam + menit, alasan opsional. */
export function RecordOvertimeDialog({
  open,
  ctx,
  owner,
  outletId,
  onClose,
}: {
  open: boolean;
  ctx: TeamCtx;
  owner: { id: string; name: string };
  outletId: string | null;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} title="Catat lembur" onClose={() => !busy && onClose()} dismissible={!busy}>
      {open && <RecordForm ctx={ctx} owner={owner} outletId={outletId} busy={busy} setBusy={setBusy} onDone={onClose} />}
    </Modal>
  );
}

function RecordForm({
  ctx,
  owner,
  outletId,
  busy,
  setBusy,
  onDone,
}: {
  ctx: TeamCtx;
  owner: { id: string; name: string };
  outletId: string | null;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const today = zonedToday();
  const employees = ctx.data.employees.filter((e) => e.is_active).sort((a, b) => a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" }));
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("1");
  const [mins, setMins] = useState("0");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const h = hours.trim() === "" ? 0 : Number(hours);
    const m = mins.trim() === "" ? 0 : Number(mins);
    const err = validateOwnerOvertime({ employeeId, date, hours: h, minutes: m, reason }, today);
    setErrors(err);
    if (Object.keys(err).length || !employeeId) return;
    setBusy(true);
    setFormError(null);
    try {
      const out = await recordOvertime({ employeeId, outletId, date, minutes: overtimeMinutes(h, m)!, reason, ownerId: owner.id });
      if (out.status === "applied") {
        ctx.merge("overtime_requests", out);
        toast.success("Lembur dicatat.");
        onDone();
      } else if (out.status === "rejected") {
        setErrors(out.fields);
        setFormError(out.message);
      } else {
        setFormError(out.message);
        ctx.reload();
      }
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${id}-emp`} label="Karyawan" error={errors.employee ?? errors.employee_id}>
        <Select
          id={`${id}-emp`}
          value={employeeId ?? ""}
          placeholder="Pilih karyawan"
          invalid={!!errors.employee}
          onChange={(v) => setEmployeeId(v || null)}
          options={employees.map((e) => ({ value: e.id, label: e.name, description: ROLE_LABEL[e.role] }))}
        />
      </Field>
      <Field id={`${id}-date`} label="Tanggal" error={errors.date}>
        <input
          id={`${id}-date`}
          type="date"
          className={inputClass}
          min={shiftBack(today, OVERTIME_OWNER_BACK_DAYS)}
          max={today}
          value={date}
          aria-invalid={!!errors.date || undefined}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold text-text-heading">Durasi</legend>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <input
              id={`${id}-h`}
              inputMode="numeric"
              className={`${inputClass} w-[84px] tabular-nums`}
              value={hours}
              aria-label="Jam"
              aria-invalid={!!errors.minutes || undefined}
              onChange={(e) => setHours(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
            <span className="text-[14px] text-text-body">jam</span>
          </label>
          <label className="flex items-center gap-1.5">
            <input
              id={`${id}-m`}
              inputMode="numeric"
              className={`${inputClass} w-[84px] tabular-nums`}
              value={mins}
              aria-label="Menit"
              aria-invalid={!!errors.minutes || undefined}
              onChange={(e) => setMins(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
            <span className="text-[14px] text-text-body">menit</span>
          </label>
        </div>
        {errors.minutes && (
          <p role="alert" className="mt-1.5 text-[12.5px] font-semibold text-danger">
            {errors.minutes}
          </p>
        )}
      </fieldset>
      <Field id={`${id}-reason`} label="Alasan (opsional)" error={errors.reason} hint={`${reason.trim().length}/${OVERTIME_REASON_MAX}`}>
        <textarea
          id={`${id}-reason`}
          className={`${inputClass} min-h-[64px] py-2`}
          rows={2}
          value={reason}
          placeholder="Mis. Stok opname akhir bulan"
          aria-invalid={!!errors.reason || undefined}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <p className="flex items-center gap-2 rounded-[12px] bg-bg-muted px-3 py-2.5 text-[12.5px] text-text-body">
        <ShieldCheck size={16} aria-hidden className="shrink-0 text-brand-ink" />
        Dicatat oleh {owner.name} (Pemilik) dan langsung disetujui.
      </p>
      {formError && (
        <p role="alert" className="text-[13px] text-danger">
          {formError}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onDone} disabled={busy}>
          Batal
        </button>
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy && <Spinner />}
          Catat lembur
        </button>
      </div>
    </form>
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
