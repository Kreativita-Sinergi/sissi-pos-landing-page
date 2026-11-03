"use client";

import React, { useMemo, useState } from "react";
import { CalendarClock, CalendarSync, Check, ChevronLeft, ChevronRight, Clock, Coffee, Eraser } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, EmptyState, errorMessage, focusRing, iconBtn, Section, Spinner } from "@/components/admin/ui";
import {
  addDays,
  cellView,
  dayLongLabel,
  dayShortLabel,
  fallbackOption,
  findAssignment,
  mondayOf,
  saveShiftAssignment,
  weekLabel,
  weekOf,
  type CellTone,
  type ShiftChoice,
} from "@/lib/owner/shiftSchedule";
import { zonedToday } from "@/lib/owner/tz";
import type { Employee } from "@/lib/owner/team";
import { Avatar, type TeamCtx } from "./shared";
import { ShiftPatternDialog } from "./ShiftPatternDialog";

// Tim › Jadwal (pemilik) — cermin `shift_schedule_tab.dart`: kisi seminggu karyawan × hari. Klik nama = shift tetap
// (berlaku tiap minggu, `shift_patterns`); klik sel = pengecualian tanggal itu saja (`shift_assignments`). Warna sumber
// sama dengan app: pengecualian oranye, shift tetap hitam, Jam kerja abu. HP: pilih hari lalu daftar karyawan.

const TONE_TITLE: Record<CellTone, string> = {
  exception: "text-brand-deep",
  pattern: "text-text-heading",
  off: "text-warning",
  global: "text-text-muted",
};

export function ScheduleTab({ ctx, businessId }: { ctx: TeamCtx; businessId: string }) {
  const today = zonedToday();
  const [monday, setMonday] = useState(() => mondayOf(today));
  const days = useMemo(() => weekOf(monday), [monday]);
  const [dayIndex, setDayIndex] = useState(() => Math.max(0, days.indexOf(today)));
  const [cell, setCell] = useState<{ employee: Employee; day: string; key: number } | null>(null);
  const [pattern, setPattern] = useState<{ employee: Employee; key: number } | null>(null);

  const { rules, shifts } = ctx.data;
  const employees = useMemo(
    () => ctx.data.employees.filter((e) => e.is_active).sort((a, b) => a.name.localeCompare(b.name, "id-ID")),
    [ctx.data.employees]
  );
  const thisWeek = monday === mondayOf(today);
  const goWeek = (next: string) => {
    setMonday(next);
    setDayIndex(mondayOf(today) === next ? weekOf(next).indexOf(today) : 0);
  };
  const moveWeek = (weeks: number) => goWeek(addDays(monday, 7 * weeks));

  if (shifts.templates.length === 0) {
    return (
      <Section>
        <EmptyState icon={<CalendarClock size={22} aria-hidden />} title="Buat daftar shift dulu">
          Misalnya Pagi 07:00–15:00 dan Sore 15:00–23:00 — di aplikasi Sissi: Pengaturan › Karyawan &amp; absen › Daftar shift.
          Setelah itu, susun jadwal tiap karyawan di sini.
        </EmptyState>
      </Section>
    );
  }

  const nav = (
    <div className="flex items-center gap-1">
      <button type="button" className={iconBtn} onClick={() => moveWeek(-1)} aria-label="Minggu sebelumnya" title="Minggu sebelumnya">
        <ChevronLeft size={18} aria-hidden />
      </button>
      <span className="min-w-[150px] text-center text-[14px] font-semibold text-text-heading" aria-live="polite">
        {weekLabel(monday)}
      </span>
      <button type="button" className={iconBtn} onClick={() => moveWeek(1)} aria-label="Minggu berikutnya" title="Minggu berikutnya">
        <ChevronRight size={18} aria-hidden />
      </button>
      {!thisWeek && (
        <button type="button" className={`${btn.ghost} min-h-9 px-3 text-[13px]`} onClick={() => goWeek(mondayOf(today))}>
          Minggu ini
        </button>
      )}
    </div>
  );

  return (
    <>
      <Section
        title="Jadwal shift"
        description="Klik nama untuk mengatur shift tetap (berlaku tiap minggu). Klik kotak untuk mengubah tanggal tertentu saja — tampil oranye. Tanpa shift tetap, karyawan ikut Jam kerja."
        actions={nav}
        bodyClass=""
      >
        <Legend />
        {employees.length === 0 ? (
          <EmptyState icon={<CalendarClock size={22} aria-hidden />} title="Belum ada karyawan aktif." />
        ) : (
          <>
            {/* Layar lebar: kisi seminggu. */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
                <thead>
                  <tr className="border-y border-border-subtle bg-bg-muted/60">
                    <th scope="col" className="w-[190px] px-4 py-2 text-[12.5px] font-semibold text-text-muted">
                      Karyawan
                    </th>
                    {days.map((d) => (
                      <th
                        key={d}
                        scope="col"
                        className={`px-1.5 py-2 text-center text-[12.5px] font-semibold ${d === today ? "text-brand-ink" : "text-text-muted"}`}
                      >
                        {dayShortLabel(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {employees.map((e) => (
                    <tr key={e.id}>
                      <th scope="row" className="px-2 py-1.5 font-normal">
                        <button
                          type="button"
                          onClick={() => setPattern({ employee: e, key: Date.now() })}
                          className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-1.5 text-left hover:bg-bg-muted ${focusRing}`}
                        >
                          <Avatar name={e.name} size={30} />
                          <span className="min-w-0">
                            <span className="block truncate text-[14px] font-semibold text-text-heading">{e.name}</span>
                            <span className="block truncate text-[12px] font-medium text-brand-ink">
                              {shifts.patterns[e.id] ? "Ubah shift tetap" : "Atur shift tetap"}
                            </span>
                          </span>
                        </button>
                      </th>
                      {days.map((d) => (
                        <td key={d} className={`p-1 ${d === today ? "bg-brand-tint/40" : ""}`}>
                          <button
                            type="button"
                            onClick={() => setCell({ employee: e, day: d, key: Date.now() })}
                            aria-label={`${e.name}, ${dayLongLabel(d)}`}
                            className={`flex min-h-[52px] w-full flex-col justify-center rounded-[10px] border border-transparent px-2 py-1.5 text-left hover:border-border-active hover:bg-white ${focusRing}`}
                          >
                            <CellText view={cellView(rules, d, shifts, e.id)} />
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* HP: pilih hari lalu daftar karyawan. */}
            <div className="md:hidden">
              <div role="tablist" aria-label="Pilih hari" className="grid grid-cols-7 gap-1 border-y border-border-subtle bg-bg-muted/60 px-2 py-2">
                {days.map((d, i) => {
                  const on = i === dayIndex;
                  const [wd, num] = dayShortLabel(d).split(" ");
                  return (
                    <button
                      key={d}
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setDayIndex(i)}
                      className={`flex min-h-12 flex-col items-center justify-center rounded-[10px] text-[12px] font-semibold ${
                        on ? "bg-brand-deep text-white" : d === today ? "bg-white text-brand-ink" : "text-text-body"
                      } ${focusRing}`}
                    >
                      <span>{wd}</span>
                      <span className="text-[15px]">{num}</span>
                    </button>
                  );
                })}
              </div>
              <ul className="divide-y divide-border-subtle">
                {employees.map((e) => {
                  const d = days[dayIndex] ?? days[0];
                  return (
                    <li key={e.id} className="flex items-center gap-1 py-1 pl-2 pr-2">
                      <button
                        type="button"
                        onClick={() => setCell({ employee: e, day: d, key: Date.now() })}
                        aria-label={`${e.name}, ${dayLongLabel(d)}`}
                        className={`flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-bg-muted ${focusRing}`}
                      >
                        <Avatar name={e.name} size={32} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-text-heading">{e.name}</span>
                          <CellText view={cellView(rules, d, shifts, e.id)} inline />
                        </span>
                        <ChevronRight size={16} aria-hidden className="shrink-0 text-text-muted" />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        onClick={() => setPattern({ employee: e, key: Date.now() })}
                        aria-label={`${shifts.patterns[e.id] ? "Ubah" : "Atur"} shift tetap ${e.name}`}
                        title={shifts.patterns[e.id] ? "Ubah shift tetap" : "Atur shift tetap"}
                      >
                        <CalendarSync size={18} aria-hidden />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}
      </Section>

      <CellDialog target={cell} ctx={ctx} businessId={businessId} onClose={() => setCell(null)} />
      <ShiftPatternDialog target={pattern} ctx={ctx} businessId={businessId} onClose={() => setPattern(null)} />
    </>
  );
}

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${cls}`} />
      {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 text-[12.5px] text-text-muted sm:px-5">
      {item("bg-brand-deep", "Tanggal ini saja")}
      {item("bg-text-heading", "Shift tetap")}
      {item("bg-text-muted/60", "Jam kerja")}
    </div>
  );
}

function CellText({ view, inline = false }: { view: ReturnType<typeof cellView>; inline?: boolean }) {
  const title = `font-semibold ${TONE_TITLE[view.tone]}`;
  const sub = view.tone === "global" ? "text-text-muted" : "text-text-body";
  // Titik oranye = pengecualian tanggal ini (beda dari "Libur" shift tetap yang warnanya mirip).
  const dot = view.tone === "exception" && <span aria-hidden className="mr-1 inline-block h-1.5 w-1.5 -translate-y-px rounded-full bg-brand-deep align-middle" />;
  const sr = view.tone === "exception" && <span className="sr-only"> (tanggal ini saja)</span>;
  if (inline) {
    return (
      <span className="block truncate text-[12.5px]">
        {dot}
        <span className={title}>{view.title}</span>
        {sr}
        {view.sub && <span className={sub}> · {view.sub}</span>}
      </span>
    );
  }
  return (
    <>
      <span className={`block truncate text-[13px] leading-tight ${title}`}>
        {dot}
        {view.title}
        {sr}
      </span>
      {view.sub && <span className={`mt-0.5 block truncate text-[12px] leading-tight ${sub}`}>{view.sub}</span>}
    </>
  );
}

// ——— Lembar sel: shift / Libur / ikut shift tetap atau Jam kerja ———

type CellTarget = { employee: Employee; day: string; key: number } | null;

function CellDialog({ target, ctx, businessId, onClose }: { target: CellTarget; ctx: TeamCtx; businessId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={!!target}
      title={target?.employee.name ?? ""}
      description={target ? dayLongLabel(target.day) : undefined}
      icon={<CalendarClock size={20} aria-hidden className="text-brand-ink" />}
      onClose={onClose}
      dismissible={!busy}
    >
      {target && <CellOptions key={target.key} target={target} ctx={ctx} businessId={businessId} busy={busy} setBusy={setBusy} onDone={onClose} />}
    </Modal>
  );
}

function CellOptions({
  target,
  ctx,
  businessId,
  busy,
  setBusy,
  onDone,
}: {
  target: NonNullable<CellTarget>;
  ctx: TeamCtx;
  businessId: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { employee, day } = target;
  const { shifts, rules } = ctx.data;
  const existing = findAssignment(ctx.data.assignmentRecords, employee.id, day);
  const kind = existing?.kind === "shift" || existing?.kind === "off" ? existing.kind : "default";
  const fallback = fallbackOption(rules, day, shifts, employee.id);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Jam salinan beda dengan templat sekarang (templat diubah setelah dijadwalkan) → tampilkan "(jam lama)".
  const matches = (t: { name: string; start: string; end: string }) =>
    kind === "shift" && existing?.name === t.name && existing?.start === t.start && existing?.end === t.end;
  const stale = kind === "shift" && !shifts.templates.some(matches);

  const pick = async (value: string, choice: ShiftChoice) => {
    if (busy) return;
    setBusy(true);
    setPending(value);
    setError(null);
    try {
      const out = await saveShiftAssignment(businessId, employee.id, day, choice, existing);
      if (!out) return onDone();
      ctx.merge("shift_assignments", out);
      if (out.status === "applied") {
        toast.success("Jadwal disimpan.");
        onDone();
      } else if (out.status === "rejected") setError(out.message);
    } catch (er) {
      setError(errorMessage(er));
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  const option = (value: string, label: string, hint: string, icon: React.ReactNode, selected: boolean, onPick?: () => void) => (
    <li key={value}>
      <button
        type="button"
        disabled={busy || !onPick}
        aria-pressed={selected}
        onClick={onPick}
        className={`flex w-full items-center gap-3 rounded-[12px] border px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
          selected ? "border-brand-primary bg-brand-tint" : "border-border-subtle bg-white hover:border-border-active"
        } ${focusRing}`}
      >
        <span className={`shrink-0 ${selected ? "text-brand-ink" : "text-text-muted"}`}>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-text-heading">{label}</span>
          <span className="block text-[12.5px] text-text-muted">{hint}</span>
        </span>
        {pending === value ? <Spinner /> : selected ? <Check size={18} aria-hidden className="text-brand-ink" /> : null}
      </button>
    </li>
  );

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {stale && existing && option("stale", `${existing.name} (jam lama)`, `${existing.start}–${existing.end}`, <Clock size={18} aria-hidden />, true)}
        {shifts.templates.map((t) =>
          option(t.id, t.name, `${t.start}–${t.end}`, <Clock size={18} aria-hidden />, matches(t), () => pick(t.id, { kind: "shift", template: t }))
        )}
        {option(
          "off",
          "Libur",
          "Tidak ditunggu absennya; bila tetap masuk, dihitung hadir tepat waktu",
          <Coffee size={18} aria-hidden />,
          kind === "off",
          () => pick("off", { kind: "off" })
        )}
        {option("default", fallback.label, fallback.hint, <Eraser size={18} aria-hidden />, kind === "default", () => pick("default", { kind: "default" }))}
      </ul>
      {error && (
        <p role="alert" className="text-[13.5px] text-danger">
          {error}
        </p>
      )}
      <p className="text-[12.5px] text-text-muted">Hanya mengubah tanggal ini. Untuk setiap minggu, atur shift tetap dari nama karyawan.</p>
    </div>
  );
}
