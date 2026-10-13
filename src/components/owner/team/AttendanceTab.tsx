"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, Clock, Info, Pencil } from "lucide-react";
import { Badge, btn, EmptyState, focusRing, iconBtn, Section, StatCard, tdClass, thClass } from "@/components/admin/ui";
import { Segmented } from "@/components/owner/editing";
import { Select } from "@/components/owner/Select";
import {
  clockLabel,
  DAY_LETTER,
  durationLabel,
  isoWeekday,
  manualMinDay,
  monthOf,
  recapFacts,
  recapFor,
  recapPresent,
  ROLE_LABEL,
  STATUS_LABEL,
  type Attendance,
  type DayKind,
  type Employee,
} from "@/lib/owner/team";
import { formatDayLong, zonedToday } from "@/lib/owner/tz";
import { WEEKDAYS, WEEKDAYS_SHORT } from "../labels";
import { Avatar, DayBadge, dayTone, MonthSelect, type TeamCtx } from "./shared";

// Tab Kehadiran — cermin `attendance_today.dart` (papan hari ini) & `attendance_history.dart` (kisi sebulan + rekap).
// Absen masuk/pulang dengan PIN hanya di perangkat kasir; dari web pemilik mencatat absen manual / koreksi.

const CELL_TONE: Record<string, string> = {
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
  brand: "bg-brand-tint text-brand-ink",
  neutral: "bg-bg-muted text-text-muted",
};

export function AttendanceTab({
  ctx,
  view,
  month,
  employeeFilter,
  onView,
  onMonth,
  onEmployee,
  onManual,
}: {
  ctx: TeamCtx;
  view: "today" | "history";
  month: string;
  employeeFilter: string;
  onView: (v: "today" | "history") => void;
  onMonth: (m: string) => void;
  onEmployee: (id: string) => void;
  onManual: (employeeId: string | null, date: string | null) => void;
}) {
  const rules = ctx.data.rules;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Tampilan kehadiran"
          options={[
            { value: "today", label: "Hari ini" },
            { value: "history", label: "Riwayat" },
          ]}
          value={view}
          onChange={onView}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/dasbor/pengaturan#absensi" className={btn.ghost}>
            <Clock size={16} aria-hidden /> Aturan jam kerja
          </Link>
          <button type="button" className={btn.primary} onClick={() => onManual(null, null)}>
            <CalendarPlus size={16} aria-hidden /> Absen manual
          </button>
        </div>
      </div>
      {view === "today" ? (
        <TodayBoard ctx={ctx} onManual={onManual} />
      ) : (
        <History ctx={ctx} month={month} employeeFilter={employeeFilter} onMonth={onMonth} onEmployee={onEmployee} onManual={onManual} />
      )}
      <p className="mt-3 flex items-start gap-1.5 text-[12.5px] text-text-muted">
        <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
        Jam kerja {rules.work_start}–{rules.work_end}, toleransi {rules.late_tolerance_min} menit
        {rules.off_days.length ? `, libur ${rules.off_days.map((d) => WEEKDAYS[d - 1]).join(", ")}` : ""}. Karyawan absen masuk & pulang dengan PIN
        di aplikasi kasir; koreksi dari sini tercatat sebagai input manual pemilik.
      </p>
    </>
  );
}

// ——— Hari ini ———

function TodayBoard({ ctx, onManual }: { ctx: TeamCtx; onManual: (employeeId: string | null, date: string | null) => void }) {
  const today = zonedToday();
  const rules = ctx.data.rules;
  const off = rules.off_days.includes(isoWeekday(today));
  const byEmp = useMemo(() => {
    const m = new Map<string, Attendance>();
    for (const a of ctx.data.attendances) if (a.date === today) m.set(a.employee_id, a);
    return m;
  }, [ctx.data.attendances, today]);
  const list = ctx.data.employees.filter((e) => e.is_active).sort((a, b) => a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" }));
  const rows = list.map((e) => byEmp.get(e.id));
  const present = rows.filter((r) => r && (r.status === "ontime" || r.status === "late")).length;
  const late = rows.filter((r) => r?.status === "late").length;
  const away = rows.filter((r) => r && r.status !== "ontime" && r.status !== "late").length;

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Hadir" value={present} hint={`dari ${list.length} karyawan aktif`} />
        <StatCard label="Terlambat" value={late} tone={late ? "warning" : "neutral"} />
        <StatCard label="Izin / alpa" value={away} />
      </div>
      <Section
        className="mt-4"
        title="Kehadiran hari ini"
        description={`${formatDayLong(today)} · ${off ? "Hari libur" : `Jam kerja ${rules.work_start}–${rules.work_end}`}`}
        bodyClass=""
      >
        {list.length === 0 ? (
          <EmptyState icon={<CalendarCheck size={22} aria-hidden />} title="Belum ada karyawan aktif." />
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map((e) => {
              const r = byEmp.get(e.id);
              return (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={e.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text-heading">{e.name}</p>
                    <p className="truncate text-[12.5px] text-text-muted">
                      {[
                        ROLE_LABEL[e.role],
                        r?.clock_in_at ? `Masuk ${clockLabel(r.clock_in_at)}` : null,
                        r?.clock_out_at ? `Pulang ${clockLabel(r.clock_out_at)}` : null,
                        r?.status === "late" ? `Telat ${r.late_minutes} mnt` : null,
                        r?.source === "manual" ? "Manual" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <TodayBadge row={r} />
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() => onManual(e.id, today)}
                    aria-label={r ? `Koreksi kehadiran ${e.name}` : `Absen manual ${e.name}`}
                    title={r ? "Koreksi kehadiran" : "Absen manual"}
                  >
                    {r ? <Pencil size={16} aria-hidden /> : <CalendarPlus size={16} aria-hidden />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </>
  );
}

function TodayBadge({ row }: { row: Attendance | undefined }) {
  if (!row) return <Badge>Belum masuk</Badge>;
  if (row.status === "permit" || row.status === "sick" || row.status === "leave") return <Badge tone="brand">{STATUS_LABEL[row.status]}</Badge>;
  if (row.status === "absent") return <Badge tone="danger">Alpa</Badge>;
  if (row.clock_out_at) return <Badge>Selesai</Badge>;
  if (row.clock_in_at) return <Badge tone="success">Bekerja</Badge>;
  return <Badge>Belum masuk</Badge>;
}

// ——— Riwayat ———

function History({
  ctx,
  month,
  employeeFilter,
  onMonth,
  onEmployee,
  onManual,
}: {
  ctx: TeamCtx;
  month: string;
  employeeFilter: string;
  onMonth: (m: string) => void;
  onEmployee: (id: string) => void;
  onManual: (employeeId: string | null, date: string | null) => void;
}) {
  const today = zonedToday();
  const m = monthOf(month);
  const withRows = new Set(ctx.data.attendances.filter((a) => a.date >= m.start && a.date <= m.end).map((a) => a.employee_id));
  const people = ctx.data.employees
    .filter((e) => e.is_active || withRows.has(e.id))
    .sort((a, b) => a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" }));
  const shown = employeeFilter ? people.filter((e) => e.id === employeeFilter) : people;
  const recaps = shown.map((e) => ({ e, r: recapFor(e, month, ctx.data.attendances, ctx.data.rules, today) }));
  const days = recaps[0]?.r.days.map((d) => d.day) ?? [];

  const minDay = manualMinDay(today);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MonthSelect value={month} onChange={onMonth} />
        <Select
          aria-label="Tampilkan karyawan"
          className="w-full sm:w-[220px]"
          value={employeeFilter}
          onChange={onEmployee}
          options={[{ value: "", label: "Semua karyawan" }, ...people.map((e) => ({ value: e.id, label: e.name }))]}
        />
      </div>
      {recaps.length === 0 ? (
        <Section bodyClass="">
          <EmptyState icon={<CalendarCheck size={22} aria-hidden />} title="Belum ada karyawan aktif." />
        </Section>
      ) : (
        <>
          <Section bodyClass="">
            <div className="overflow-x-auto">
              <table className="border-separate border-spacing-0 text-[12.5px]">
                <thead>
                  <tr>
                    <th scope="col" className={`${thClass} sticky left-0 z-[1] min-w-[140px] bg-white`}>
                      Nama
                    </th>
                    {days.map((d) => (
                      <th key={d} scope="col" className="px-0.5 py-2 text-center font-semibold text-text-muted">
                        <span className="block text-[10px] font-normal">{WEEKDAYS_SHORT[isoWeekday(d) - 1]}</span>
                        {Number(d.slice(8))}
                      </th>
                    ))}
                    <th scope="col" className={`${thClass} text-right`}>
                      Hadir
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recaps.map(({ e, r }) => (
                    <tr key={e.id}>
                      <th scope="row" className={`${tdClass} sticky left-0 z-[1] border-b border-border-subtle bg-white text-left font-semibold text-text-heading`}>
                        <span className="block max-w-[160px] truncate">{e.name}</span>
                      </th>
                      {r.days.map((d) => {
                        const locked = d.day > today || d.day < minDay;
                        const label = `${e.name}, ${formatDayLong(d.day)}: ${d.kind === "upcoming" ? "belum ada catatan" : STATUS_LABEL[d.kind]}`;
                        return (
                          <td key={d.day} className="border-b border-border-subtle px-0.5 py-1.5 text-center">
                            <button
                              type="button"
                              disabled={locked}
                              onClick={() => onManual(e.id, d.day)}
                              title={label}
                              aria-label={label}
                              className={`inline-flex h-7 w-6 items-center justify-center rounded-[6px] text-[11.5px] font-bold disabled:cursor-default disabled:opacity-40 ${
                                d.kind === "upcoming" ? "border border-dashed border-border-subtle text-text-muted" : CELL_TONE[dayTone(d.kind)]
                              } ${d.row?.source === "manual" ? "ring-1 ring-brand-primary/50" : ""} ${focusRing}`}
                            >
                              {DAY_LETTER[d.kind]}
                            </button>
                          </td>
                        );
                      })}
                      <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums`}>{recapPresent(r)} hari</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-border-subtle px-4 py-2.5 text-[12px] text-text-muted sm:px-5">
              H hadir · T terlambat · I izin · S sakit · C cuti · A alpa · L libur · bingkai = input manual. Klik kotak untuk koreksi.
            </p>
          </Section>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recaps.map(({ e, r }) => (
              <div key={e.id} className="rounded-[14px] border border-border-subtle bg-white px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={e.name} size={32} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-heading">{e.name}</p>
                    <p className="text-[12.5px] text-text-muted">
                      {ROLE_LABEL[e.role]}
                      {r.overtime_minutes > 0 ? ` · lembur ${durationLabel(r.overtime_minutes)}` : ""}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recapFacts(r).map(([label, value]) => (
                    <Badge key={label}>
                      {label} {value}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {employeeFilter && recaps[0] && <DayList ctx={ctx} e={recaps[0].e} days={recaps[0].r.days} onManual={onManual} />}
        </>
      )}
    </>
  );
}

/** Rincian per hari satu karyawan (riwayat terpilih). */
function DayList({
  ctx,
  e,
  days,
  onManual,
}: {
  ctx: TeamCtx;
  e: Employee;
  days: { day: string; kind: DayKind; row: Attendance | null }[];
  onManual: (employeeId: string | null, date: string | null) => void;
}) {
  const rows = days.filter((d) => d.row).reverse();
  const names = new Map(ctx.data.employees.map((x) => [x.id, x.name]));
  return (
    <Section className="mt-4" title={`Catatan ${e.name}`} bodyClass="">
      {rows.length === 0 ? (
        <EmptyState icon={<CalendarCheck size={22} aria-hidden />} title="Belum ada catatan kehadiran bulan ini." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[14px]">
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  Tanggal
                </th>
                <th scope="col" className={thClass}>
                  Status
                </th>
                <th scope="col" className={thClass}>
                  Masuk – pulang
                </th>
                <th scope="col" className={thClass}>
                  Catatan
                </th>
                <th scope="col" className={thClass}>
                  <span className="sr-only">Koreksi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ day, kind, row }) => (
                <tr key={day}>
                  <td className={`${tdClass} border-b border-border-subtle whitespace-nowrap`}>{formatDayLong(day)}</td>
                  <td className={`${tdClass} border-b border-border-subtle`}>
                    <DayBadge kind={kind} />
                    {row?.status === "late" && <span className="ml-1.5 text-[12.5px] text-warning">{row.late_minutes} mnt</span>}
                  </td>
                  <td className={`${tdClass} border-b border-border-subtle tabular-nums`}>
                    {row?.clock_in_at ? `${clockLabel(row.clock_in_at)} – ${clockLabel(row.clock_out_at)}` : "—"}
                  </td>
                  <td className={`${tdClass} border-b border-border-subtle text-[13px] text-text-body`}>
                    {row?.note && <span className="block">{row.note}</span>}
                    {row?.source === "manual" && (
                      <span className="block text-text-muted">
                        Manual: {row.edit_reason}
                        {row.edited_by ? ` (${names.get(row.edited_by) ?? "pemilik"})` : ""}
                      </span>
                    )}
                    {!row?.note && row?.source !== "manual" && <span className="text-text-muted">—</span>}
                  </td>
                  <td className={`${tdClass} border-b border-border-subtle text-right`}>
                    <button
                      type="button"
                      className={iconBtn}
                      disabled={day < manualMinDay()}
                      onClick={() => onManual(e.id, day)}
                      aria-label={`Koreksi ${formatDayLong(day)}`}
                      title="Koreksi kehadiran"
                    >
                      <Pencil size={16} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}
