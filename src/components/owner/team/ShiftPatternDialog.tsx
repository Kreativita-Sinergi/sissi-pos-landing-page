"use client";

import React, { useState } from "react";
import { CalendarSync, Trash2 } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, errorMessage, focusRing, Spinner } from "@/components/admin/ui";
import { ChipGroup } from "@/components/owner/editing";
import {
  applyPattern,
  isAllOff,
  makeOff,
  patternDayLabel,
  saveShiftPatterns,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  WEEKDAYS,
  type PatternWeek,
} from "@/lib/owner/shiftSchedule";
import type { Employee } from "@/lib/owner/team";
import type { TeamCtx } from "./shared";

// Shift tetap satu karyawan — cermin `shift_pattern_sheet.dart`: pilih shift (boleh lebih dari satu) lalu hari-harinya
// → Terapkan; ulangi untuk hari lain. Hari tanpa shift = libur. Berlaku setiap minggu sampai diubah. Disimpan ke
// `business_settings.shift_patterns` dengan menggabungkan (kunci karyawan lain & pengaturan lain tetap).

export type PatternTarget = { employee: Employee; key: number } | null;

export function ShiftPatternDialog({
  target,
  ctx,
  businessId,
  onClose,
}: {
  target: PatternTarget;
  ctx: TeamCtx;
  businessId: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={!!target}
      title={target ? `Shift tetap · ${target.employee.name}` : ""}
      description="Berlaku setiap minggu sampai diubah"
      icon={<CalendarSync size={20} aria-hidden className="text-brand-ink" />}
      onClose={onClose}
      dismissible={!busy}
    >
      {target && <PatternForm key={target.key} employee={target.employee} ctx={ctx} businessId={businessId} busy={busy} setBusy={setBusy} onDone={onClose} />}
    </Modal>
  );
}

function PatternForm({
  employee,
  ctx,
  businessId,
  busy,
  setBusy,
  onDone,
}: {
  employee: Employee;
  ctx: TeamCtx;
  businessId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { templates, patterns } = ctx.data.shifts;
  const existing = !!patterns[employee.id];
  const [week, setWeek] = useState<PatternWeek>(() => ({ ...(patterns[employee.id] ?? {}) }));
  const [pickShifts, setPickShifts] = useState<string[]>([]);
  const [pickDays, setPickDays] = useState<number[]>([]);
  const [confirmAllOff, setConfirmAllOff] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Karyawan tanpa shift tetap & belum ada hari diisi → "Belum diatur" (bukan "Libur") — `_blank` app.
  const blank = !existing && isAllOff(week);
  const everyDay = pickDays.length === 7;
  const canApply = pickShifts.length > 0 && pickDays.length > 0;
  const apply = () => {
    setWeek((w) => applyPattern(w, templates, pickShifts, pickDays));
    setPickDays([]);
  };

  const save = async (remove: boolean) => {
    if (busy) return;
    // Pilihan yang belum di-"Terapkan" ikut tersimpan (sama dengan app).
    const final = remove ? null : canApply ? applyPattern(week, templates, pickShifts, pickDays) : week;
    setBusy(true);
    setError(null);
    try {
      const out = await saveShiftPatterns(ctx.data.settingsRecord, businessId, employee.id, final);
      ctx.merge("business_settings", out);
      if (out.status === "applied") {
        toast.success(remove ? "Shift tetap dihapus; karyawan ikut Jam kerja." : "Shift tetap disimpan.");
        onDone();
      } else setError(out.message);
    } catch (er) {
      setError(errorMessage(er));
    } finally {
      setBusy(false);
      setConfirmAllOff(false);
      setConfirmRemove(false);
    }
  };

  const onSave = () => {
    const final = canApply ? applyPattern(week, templates, pickShifts, pickDays) : week;
    if (isAllOff(final)) setConfirmAllOff(true);
    else void save(false);
  };

  const step = (n: number, title: string, hint?: string) => (
    <p className="text-[13.5px] font-semibold text-text-heading">
      <span className="mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-tint text-[11.5px] text-brand-ink">{n}</span>
      {title}
      {hint && <span className="font-normal text-text-muted"> · {hint}</span>}
    </p>
  );

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        {step(1, "Pilih shift", "boleh lebih dari satu")}
        <ChipGroup
          label="Pilih shift"
          options={templates.map((t) => ({ value: t.id, label: `${t.name} ${t.start}–${t.end}` }))}
          selected={pickShifts}
          onChange={setPickShifts}
          disabled={busy}
        />
      </div>

      <div className="space-y-2">
        {step(2, "Untuk hari")}
        <div className="flex flex-wrap items-center gap-2">
          <ChipGroup
            label="Untuk hari"
            options={WEEKDAYS.map((d) => ({ value: d, label: WEEKDAY_SHORT[d - 1] }))}
            selected={pickDays}
            onChange={(v) => setPickDays([...v].sort((a, b) => a - b))}
            disabled={busy}
          />
          <button
            type="button"
            aria-pressed={everyDay}
            disabled={busy}
            onClick={() => setPickDays(everyDay ? [] : [...WEEKDAYS])}
            className={`min-h-9 rounded-full px-3 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-tint disabled:opacity-50 ${focusRing}`}
          >
            {everyDay ? "Kosongkan" : "Setiap hari"}
          </button>
        </div>
        <button type="button" className={`${btn.secondary} w-full sm:w-auto`} disabled={!canApply || busy} onClick={apply}>
          {pickDays.length > 0 ? `Terapkan ke ${pickDays.length} hari` : "Terapkan ke hari terpilih"}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-[13.5px] font-semibold text-text-heading">Jadwal setiap minggu</p>
        <ul className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle">
          {WEEKDAYS.map((d) => {
            const ids = week[String(d)] ?? [];
            const label = ids.length ? (patternDayLabel(ids, templates) ?? "Ikut jam kerja") : null;
            return (
              <li key={d} className="flex min-h-12 items-center gap-3 px-3 py-2">
                <span className="w-[70px] shrink-0 text-[13.5px] font-semibold text-text-heading">{WEEKDAY_LONG[d - 1]}</span>
                <span
                  className={`min-w-0 flex-1 truncate text-[13.5px] ${label ? "text-text-body" : blank ? "text-text-muted" : "font-semibold text-warning"}`}
                >
                  {label ?? (blank ? "Belum diatur" : "Libur")}
                </span>
                {ids.length > 0 && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setWeek((w) => makeOff(w, d))}
                    className={`shrink-0 rounded-[8px] px-2 py-1 text-[12.5px] font-semibold text-text-body hover:bg-bg-muted hover:text-text-heading disabled:opacity-50 ${focusRing}`}
                  >
                    Jadikan libur
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-[12.5px] leading-relaxed text-text-muted">
          Hari tanpa shift = libur. Dua shift sehari dihitung satu rentang: telat dari mulai shift pertama, lembur setelah shift
          terakhir. Untuk tanggal tertentu, ubah langsung di kotak jadwal.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-[13.5px] text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        {existing && (
          <button type="button" className={`${btn.ghost} text-danger sm:mr-auto`} disabled={busy} onClick={() => setConfirmRemove(true)}>
            <Trash2 size={16} aria-hidden /> Hapus shift tetap
          </button>
        )}
        <div className="flex flex-col-reverse gap-2 sm:ml-auto sm:flex-row">
          <button type="button" className={btn.secondary} disabled={busy} onClick={onDone}>
            Batal
          </button>
          <button type="button" className={btn.primary} disabled={busy} onClick={onSave}>
            {busy && <Spinner />} Simpan
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmAllOff}
        title="Semua hari libur?"
        confirmLabel="Simpan"
        busy={busy}
        onConfirm={() => void save(false)}
        onClose={() => setConfirmAllOff(false)}
      >
        Belum ada shift di hari mana pun, jadi karyawan ini dianggap libur setiap hari. Pilih shift dan hari lalu klik Terapkan bila
        bukan itu maksudnya.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirmRemove}
        title="Hapus shift tetap?"
        confirmLabel="Hapus"
        tone="danger"
        busy={busy}
        onConfirm={() => void save(true)}
        onClose={() => setConfirmRemove(false)}
      >
        {employee.name} kembali ikut Jam kerja. Jadwal per tanggal yang sudah diatur tetap berlaku.
      </ConfirmDialog>
    </div>
  );
}
