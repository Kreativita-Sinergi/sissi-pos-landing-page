"use client";

import React, { useId, useState } from "react";
import { CalendarPlus, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, errorMessage, Field, inputClass, Spinner } from "@/components/admin/ui";
import { Segmented } from "@/components/owner/editing";
import { Select } from "@/components/owner/Select";
import {
  clockLabel,
  evaluateClockIn,
  manualMinDay,
  parseClockMinutes,
  ROLE_LABEL,
  saveManualAttendance,
  zonedAt,
  type Attendance,
  type AttendanceStatus,
} from "@/lib/owner/team";
import { zonedToday } from "@/lib/owner/tz";
import type { TeamCtx } from "./shared";

// Absen manual / koreksi kehadiran (pemilik; alasan wajib) — cermin `manual_attendance_sheet.dart`. Dikirim sebagai
// `source: "manual"` dengan `edited_by` = pemilik yang masuk dan `edit_reason`. Jam dibaca di zona usaha.

export type ManualTarget = { employeeId: string | null; date: string | null; key: number } | null;

type Choice = "present" | "permit" | "sick" | "leave" | "absent";
const CHOICES: { value: Choice; label: string }[] = [
  { value: "present", label: "Hadir" },
  { value: "permit", label: "Izin" },
  { value: "sick", label: "Sakit" },
  { value: "leave", label: "Cuti" },
  { value: "absent", label: "Alpa" },
];

export function ManualAttendanceDialog({
  target,
  ctx,
  owner,
  businessId,
  outletId,
  onClose,
}: {
  target: ManualTarget;
  ctx: TeamCtx;
  owner: { id: string; name: string };
  businessId: string;
  /** Outlet untuk baris baru (outlet terpilih / outlet pertama). */
  outletId: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Judul ikut pilihan karyawan/tanggal di formulir: "Koreksi kehadiran" bila sudah ada catatan.
  const [override, setOverride] = useState<{ key: number; title: string } | null>(null);
  const initialExists =
    !!target?.employeeId && ctx.data.attendances.some((a) => a.employee_id === target.employeeId && a.date === (target.date ?? zonedToday()));
  const title = target && override?.key === target.key ? override.title : initialExists ? "Koreksi kehadiran" : "Absen manual";
  const setTitle = (t: string) => target && setOverride({ key: target.key, title: t });
  return (
    <Modal open={!!target} title={title} icon={<CalendarPlus size={20} aria-hidden className="text-brand-ink" />} onClose={onClose} dismissible={!busy}>
      {target && (
        <ManualForm
          key={target.key}
          target={target}
          ctx={ctx}
          owner={owner}
          businessId={businessId}
          outletId={outletId}
          busy={busy}
          setBusy={setBusy}
          setTitle={setTitle}
          onDone={onClose}
        />
      )}
    </Modal>
  );
}

function choiceOf(row: Attendance | null): Choice {
  if (!row) return "present";
  if (row.status === "permit" || row.status === "sick" || row.status === "leave" || row.status === "absent") return row.status;
  return "present";
}

function ManualForm({
  target,
  ctx,
  owner,
  businessId,
  outletId,
  busy,
  setBusy,
  setTitle,
  onDone,
}: {
  target: NonNullable<ManualTarget>;
  ctx: TeamCtx;
  owner: { id: string; name: string };
  businessId: string;
  outletId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  setTitle: (t: string) => void;
  onDone: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const today = zonedToday();
  const employees = [...ctx.data.employees].sort((a, b) => Number(b.is_active) - Number(a.is_active) || a.name.localeCompare(b.name, "id-ID"));
  const find = (emp: string | null, date: string) =>
    emp ? (ctx.data.attendances.find((a) => a.employee_id === emp && a.date === date) ?? null) : null;

  const [employeeId, setEmployeeId] = useState<string | null>(target.employeeId);
  const [date, setDate] = useState(target.date ?? today);
  const prefill = (emp: string | null, day: string) => {
    const row = find(emp, day);
    return {
      choice: choiceOf(row),
      inText: row?.clock_in_at ? clockLabel(row.clock_in_at) : "",
      outText: row?.clock_out_at ? clockLabel(row.clock_out_at) : "",
      note: row?.note ?? "",
    };
  };
  const [f, setF] = useState(() => ({ ...prefill(target.employeeId, target.date ?? today), reason: "" }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const existing = find(employeeId, date);

  const pick = (emp: string | null, day: string) => {
    setTitle(find(emp, day) ? "Koreksi kehadiran" : "Absen manual");
    setEmployeeId(emp);
    setDate(day);
    setF((p) => ({ ...prefill(emp, day), reason: p.reason }));
    setErrors({});
  };

  const present = f.choice === "present";
  const inMin = parseClockMinutes(f.inText);
  const outMin = parseClockMinutes(f.outText);
  const verdict = present && inMin !== null ? evaluateClockIn(ctx.data.rules, date, inMin) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const err: Record<string, string> = {};
    if (!employeeId) err.employee = "Wajib diisi";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today || date < manualMinDay(today)) err.date = "Pilih tanggal 3 bulan terakhir sampai hari ini";
    if (present) {
      if (!f.inText.trim()) err.in = "Wajib diisi";
      else if (inMin === null) err.in = "Format jam HH:MM";
      if (f.outText.trim() && outMin === null) err.out = "Format jam HH:MM";
      else if (outMin !== null && inMin !== null && outMin < inMin) err.out = "Jam pulang sebelum jam masuk";
    }
    if (!f.reason.trim()) err.reason = "Wajib diisi";
    setErrors(err);
    if (Object.keys(err).length || !employeeId) return;

    const status: AttendanceStatus = f.choice === "present" ? (verdict?.status ?? "ontime") : f.choice;
    const clockIn = present && inMin !== null ? new Date(zonedAt(date, inMin)).toISOString() : null;
    const clockOut = present && outMin !== null ? new Date(zonedAt(date, outMin)).toISOString() : null;
    setBusy(true);
    setFormError(null);
    try {
      const out = await saveManualAttendance(
        {
          employee_id: employeeId,
          date,
          status,
          clock_in_at: clockIn,
          clock_out_at: clockOut,
          late_minutes: verdict?.late_minutes ?? 0,
          note: f.note.trim(),
          reason: f.reason.trim(),
          edited_by: owner.id,
        },
        { businessId, outletId, existing }
      );
      ctx.merge("attendances", out);
      if (out.status === "applied") {
        toast.success("Kehadiran tersimpan.");
        onDone();
      } else {
        if (out.status === "rejected") setErrors(out.fields);
        setFormError(out.message);
      }
    } catch (er) {
      setFormError(errorMessage(er));
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<typeof f>) => {
    setF((p) => ({ ...p, ...patch }));
    setErrors({});
    setFormError(null);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${id}-emp`} label="Karyawan" error={errors.employee ?? errors.employee_id}>
        <Select
          id={`${id}-emp`}
          value={employeeId ?? ""}
          placeholder="Pilih karyawan"
          invalid={!!errors.employee}
          onChange={(v) => pick(v || null, date)}
          options={employees.map((e) => ({
            value: e.id,
            label: e.name,
            description: e.is_active ? ROLE_LABEL[e.role] : `${ROLE_LABEL[e.role]} · Nonaktif`,
          }))}
        />
      </Field>
      <Field id={`${id}-date`} label="Tanggal" error={errors.date}>
        <input
          id={`${id}-date`}
          type="date"
          className={inputClass}
          min={manualMinDay(today)}
          max={today}
          value={date}
          aria-invalid={!!errors.date || undefined}
          onChange={(e) => pick(employeeId, e.target.value)}
        />
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Status</p>
        <div className="overflow-x-auto">
          <Segmented label="Status" options={CHOICES} value={f.choice} onChange={(c) => set({ choice: c })} />
        </div>
        {errors.status && <p className="mt-1 text-[13px] text-danger">{errors.status}</p>}
      </div>
      {present && (
        <div>
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-in`} label="Jam masuk" error={errors.in ?? errors.clock_in_at}>
              <input
                id={`${id}-in`}
                className={`${inputClass} tabular-nums`}
                inputMode="numeric"
                placeholder="08:00"
                maxLength={5}
                value={f.inText}
                aria-invalid={!!errors.in || undefined}
                onChange={(e) => set({ inText: e.target.value.replace(/[^0-9:.]/g, "") })}
              />
            </Field>
            <Field id={`${id}-out`} label="Jam pulang (opsional)" error={errors.out ?? errors.clock_out_at}>
              <input
                id={`${id}-out`}
                className={`${inputClass} tabular-nums`}
                inputMode="numeric"
                placeholder="17:00"
                maxLength={5}
                value={f.outText}
                aria-invalid={!!errors.out || undefined}
                onChange={(e) => set({ outText: e.target.value.replace(/[^0-9:.]/g, "") })}
              />
            </Field>
          </div>
          {verdict && (
            <p className={`mt-1.5 text-[13px] ${verdict.status === "late" ? "text-warning" : "text-text-muted"}`}>
              {verdict.status === "late"
                ? `Tercatat terlambat ${verdict.late_minutes} menit menurut jam kerja.`
                : "Tercatat tepat waktu menurut jam kerja."}
            </p>
          )}
        </div>
      )}
      <Field id={`${id}-note`} label="Catatan (opsional)" error={errors.note}>
        <input id={`${id}-note`} className={inputClass} maxLength={200} value={f.note} onChange={(e) => set({ note: e.target.value })} />
      </Field>
      <Field id={`${id}-reason`} label="Alasan perubahan" error={errors.reason ?? errors.edit_reason}>
        <textarea
          id={`${id}-reason`}
          className={`${inputClass} min-h-[64px] py-2`}
          maxLength={200}
          rows={2}
          placeholder="Mis. Lupa absen pulang, sudah dikonfirmasi"
          value={f.reason}
          aria-invalid={!!errors.reason || undefined}
          onChange={(e) => set({ reason: e.target.value })}
        />
      </Field>
      <p className="flex items-center gap-2 rounded-[12px] bg-bg-muted px-3 py-2.5 text-[12.5px] text-text-body">
        <ShieldCheck size={16} aria-hidden className="shrink-0 text-brand-ink" />
        Tercatat sebagai input manual oleh {owner.name} (Pemilik).
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
          Simpan absen
        </button>
      </div>
    </form>
  );
}
