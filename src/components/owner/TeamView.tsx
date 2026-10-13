"use client";

import React, { useMemo } from "react";
import { CalendarCheck, IdCard, Info } from "lucide-react";
import { FilterBar } from "@/components/admin/FilterMenu";
import { ROLES } from "@/components/admin/labels";
import {
  Badge,
  EmptyState,
  ErrorBlock,
  LoadingBar,
  PageHeader,
  Section,
  SkeletonList,
  tdClass,
  thClass,
  useLoad,
} from "@/components/admin/ui";
import { pullAll } from "@/lib/owner/api";
import { hasFeature } from "@/lib/owner/records";
import { readAttendance, type AttendanceRules } from "@/lib/owner/settings";
import type { SyncRecord } from "@/lib/owner/types";
import { zoneOffsetMs } from "@/lib/owner/tz";
import { labelOf, WEEKDAYS } from "./labels";
import { useOwner } from "./OwnerShell";
import { LockedCard, PeriodFilter, periodTitle, SyncNote, usePeriod } from "./ui";

// Tim (hanya baca): daftar karyawan (GET /owner/data/employees — PIN & gaji tidak ditampilkan) dan rekap absensi
// periode (GET /owner/data/attendances, kunci `staff`). Tambah karyawan, PIN, dan gaji lewat aplikasi.

type Employee = SyncRecord & { name: string; email: string | null; phone: string | null; role: string; is_active: boolean };

type Attendance = SyncRecord & {
  outlet_id: string;
  employee_id: string;
  date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  status: "ontime" | "late" | "permit" | "sick" | "leave" | "absent";
  late_minutes: number;
};

type Recap = {
  employee_id: string;
  present: number;
  late: number;
  late_minutes: number;
  permit: number;
  sick: number;
  leave: number;
  absent: number;
  overtime_minutes: number;
};

const ROLE_ORDER: Record<string, number> = { owner: 0, cashier: 1, kitchen: 2 };

/** Menit lembur = menit setelah jam pulang (`work_end`, zona usaha) pada tanggal absen. */
function overtimeMinutes(a: Attendance, rules: AttendanceRules): number {
  if (!a.clock_out_at) return 0;
  const out = Date.parse(a.clock_out_at);
  const end = Date.parse(`${a.date}T${rules.work_end}:00Z`) - zoneOffsetMs();
  if (Number.isNaN(out) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((out - end) / 60_000));
}

function formatMinutes(m: number): string {
  if (m <= 0) return "—";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (!h) return `${r} mnt`;
  return r ? `${h} j ${r} mnt` : `${h} j`;
}

export function TeamView() {
  const { session, outletId, outlet } = useOwner();
  const staff = hasFeature(session.subscription, "staff");
  const period = usePeriod("month");
  const { from, to, preset } = period;

  const employees = useLoad<Employee[]>((signal) => pullAll<Employee>("employees", signal), []);
  const attendance = useLoad<{ rows: Attendance[]; rules: AttendanceRules } | null>(
    async (signal) => {
      if (!staff) return null;
      const [rows, settings] = await Promise.all([pullAll<Attendance>("attendances", signal), pullAll("business_settings", signal)]);
      return { rows, rules: readAttendance(settings[0]?.settings) };
    },
    [staff ? 1 : 0]
  );

  const list = useMemo(
    () =>
      [...(employees.state.data ?? [])].sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) ||
          (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
          a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" })
      ),
    [employees.state.data]
  );

  const att = attendance.state.data;
  const recap = useMemo(() => {
    if (!att) return null;
    const by = new Map<string, Recap>();
    for (const a of att.rows) {
      if (a.date < from || a.date > to) continue;
      if (outletId && a.outlet_id !== outletId) continue;
      const r =
        by.get(a.employee_id) ??
        ({ employee_id: a.employee_id, present: 0, late: 0, late_minutes: 0, permit: 0, sick: 0, leave: 0, absent: 0, overtime_minutes: 0 } as Recap);
      if (a.status === "ontime" || a.status === "late") {
        r.present += 1;
        if (a.status === "late") {
          r.late += 1;
          r.late_minutes += Math.max(0, a.late_minutes || 0);
        }
        r.overtime_minutes += overtimeMinutes(a, att.rules);
      } else if (a.status in r) {
        r[a.status] += 1;
      }
      by.set(a.employee_id, r);
    }
    return by;
  }, [att, from, to, outletId]);

  const names = new Map(list.map((e) => [e.id, e]));
  const recapRows = recap
    ? [...recap.values()].sort((a, b) => (names.get(a.employee_id)?.name ?? "").localeCompare(names.get(b.employee_id)?.name ?? "", "id-ID"))
    : [];

  return (
    <>
      <PageHeader
        title="Tim"
        description="Karyawan yang bisa masuk ke aplikasi kasir. Menambah karyawan, mengatur PIN, dan gaji dilakukan lewat aplikasi Sissi (menu Tim)."
      />

      {employees.state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={employees.state.error} onRetry={employees.reload} />
        </div>
      )}
      {!employees.state.data && employees.state.status === "loading" && <SkeletonList rows={4} label="Memuat karyawan" />}
      {employees.state.data && (
        <Section title="Karyawan" description={`${list.filter((e) => e.is_active).length} aktif dari ${list.length}`} bodyClass="">
          {list.length === 0 ? (
            <EmptyState icon={<IdCard size={22} aria-hidden />} title="Belum ada karyawan">
              Tambah kasir atau dapur lewat aplikasi Sissi.
            </EmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] border-separate border-spacing-0 text-[14px]">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>
                      Nama
                    </th>
                    <th scope="col" className={thClass}>
                      Peran
                    </th>
                    <th scope="col" className={`${thClass} hidden md:table-cell`}>
                      Kontak
                    </th>
                    <th scope="col" className={thClass}>
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} className={e.is_active ? "" : "text-text-muted"}>
                      <td className={`${tdClass} border-b border-border-subtle font-semibold ${e.is_active ? "text-text-heading" : ""}`}>
                        {e.name}
                        {e.id === session.user.id && <span className="ml-1.5 text-[12px] font-normal text-text-muted">(Anda)</span>}
                      </td>
                      <td className={`${tdClass} border-b border-border-subtle`}>{labelOf(ROLES, e.role)}</td>
                      <td className={`${tdClass} hidden border-b border-border-subtle text-text-body md:table-cell`}>
                        {[e.email, e.phone].filter(Boolean).join(" · ") || <span className="text-text-muted">—</span>}
                      </td>
                      <td className={`${tdClass} border-b border-border-subtle`}>
                        {e.is_active ? <Badge tone="success">Aktif</Badge> : <Badge>Nonaktif</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold text-text-heading">Rekap absensi</h2>
            <p className="text-[13.5px] text-text-body">
              {periodTitle(from, to, preset)}
              {outlet ? ` · ${outlet.name}` : " · semua outlet"}
            </p>
          </div>
        </div>
        {!staff ? (
          <LockedCard title="Absensi & rekap tim">
            Catat absen masuk/pulang dengan PIN, pantau keterlambatan dan lembur, lalu hitung gaji dengan paket Pro.
          </LockedCard>
        ) : (
          <>
            <FilterBar>
              <PeriodFilter from={from} to={to} preset={preset} onChange={period.setPeriod} />
            </FilterBar>
            {attendance.state.status === "error" && (
              <div className="mb-4">
                <ErrorBlock error={attendance.state.error} onRetry={attendance.reload} />
              </div>
            )}
            {!att && attendance.state.status === "loading" && <SkeletonList rows={3} label="Memuat absensi" />}
            {att && (
              <>
                <LoadingBar active={attendance.state.status === "loading"} />
                <Section bodyClass="">
                  {recapRows.length === 0 ? (
                    <EmptyState icon={<CalendarCheck size={22} aria-hidden />} title="Belum ada absensi di periode ini">
                      Karyawan absen masuk & pulang dengan PIN di aplikasi kasir.
                    </EmptyState>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[14px]">
                        <thead>
                          <tr>
                            <th scope="col" className={thClass}>
                              Karyawan
                            </th>
                            <th scope="col" className={`${thClass} text-right`}>
                              Hadir
                            </th>
                            <th scope="col" className={`${thClass} text-right`}>
                              Terlambat
                            </th>
                            <th scope="col" className={`${thClass} text-right`}>
                              Izin · sakit · cuti
                            </th>
                            <th scope="col" className={`${thClass} text-right`}>
                              Alpa
                            </th>
                            <th scope="col" className={`${thClass} text-right`}>
                              Lembur
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {recapRows.map((r) => (
                            <tr key={r.employee_id}>
                              <td className={`${tdClass} border-b border-border-subtle font-semibold text-text-heading`}>
                                {names.get(r.employee_id)?.name ?? "Karyawan terhapus"}
                              </td>
                              <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums`}>{r.present} hari</td>
                              <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums`}>
                                {r.late ? (
                                  <>
                                    <span className="font-semibold text-warning">{r.late}×</span>
                                    <span className="block text-[12px] text-text-muted">{formatMinutes(r.late_minutes)}</span>
                                  </>
                                ) : (
                                  <span className="text-text-muted">—</span>
                                )}
                              </td>
                              <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums`}>
                                {r.permit + r.sick + r.leave ? `${r.permit} · ${r.sick} · ${r.leave}` : <span className="text-text-muted">—</span>}
                              </td>
                              <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums`}>
                                {r.absent ? <span className="font-semibold text-danger">{r.absent}</span> : <span className="text-text-muted">—</span>}
                              </td>
                              <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums`}>{formatMinutes(r.overtime_minutes)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Section>
                <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-text-muted">
                  <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
                  Jam kerja {att.rules.work_start}–{att.rules.work_end}, toleransi {att.rules.late_tolerance_min} menit
                  {att.rules.off_days.length ? `, libur ${att.rules.off_days.map((d) => WEEKDAYS[d - 1]).join(", ")}` : ""}. Lembur = menit setelah jam pulang.
                  Atur di Pengaturan; koreksi absen & slip gaji lewat aplikasi.
                </p>
              </>
            )}
          </>
        )}
      </div>
      <SyncNote className="mt-4" />
    </>
  );
}
