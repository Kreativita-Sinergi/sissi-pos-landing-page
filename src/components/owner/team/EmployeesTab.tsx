"use client";

import React, { useMemo, useState } from "react";
import { ChevronRight, IdCard, KeyRound, UserPlus } from "lucide-react";
import { Badge, btn, EmptyState, focusRing, Section, StatCard, tdClass, thClass } from "@/components/admin/ui";
import { SearchBox } from "@/components/admin/filters";
import { isPaid, payrollSummary, ROLE_LABEL, type Attendance, type Employee } from "@/lib/owner/team";
import { zonedToday } from "@/lib/owner/tz";
import { Avatar, type TeamCtx } from "./shared";

// Tab Karyawan — cermin `employees_tab.dart`: ringkasan, cari, daftar (nama, peran, hari ini, PIN, gaji).

const ROLE_ORDER: Record<string, number> = { owner: 0, cashier: 1, kitchen: 2 };

/** Keadaan hari ini (`todayStateOf`). */
function todayState(row: Attendance | undefined): { label: string; tone: "neutral" | "success" | "brand" | "danger" | "warning" } {
  if (!row) return { label: "Belum masuk", tone: "neutral" };
  if (row.status === "permit" || row.status === "sick" || row.status === "leave") return { label: "Izin/sakit/cuti", tone: "brand" };
  if (row.status === "absent") return { label: "Alpa", tone: "danger" };
  if (row.clock_out_at) return { label: "Selesai", tone: "neutral" };
  if (row.clock_in_at) return { label: "Bekerja", tone: "success" };
  return { label: "Belum masuk", tone: "neutral" };
}

export function EmployeesTab({ ctx, selfId, onOpen }: { ctx: TeamCtx; selfId: string; onOpen: (id: string | null) => void }) {
  const [q, setQ] = useState("");
  const today = zonedToday();
  const todayRows = useMemo(() => {
    const m = new Map<string, Attendance>();
    for (const a of ctx.data.attendances) if (a.date === today) m.set(a.employee_id, a);
    return m;
  }, [ctx.data.attendances, today]);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return [...ctx.data.employees]
      .filter((e) => !term || [e.name, e.email ?? "", e.phone ?? ""].some((v) => v.toLowerCase().includes(term)))
      .sort(
        (a, b) =>
          Number(b.is_active) - Number(a.is_active) ||
          (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9) ||
          a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" })
      );
  }, [ctx.data.employees, q]);

  const active = ctx.data.employees.filter((e) => e.is_active);
  const working = active.filter((e) => todayState(todayRows.get(e.id)).label === "Bekerja").length;
  const noPin = active.filter((e) => !e.has_pin).length;

  if (ctx.data.employees.length <= 1 && !q) {
    // Hanya pemilik: ajak menambah karyawan (`teamEmpty*`).
    return (
      <>
        <Kpis active={active.length} working={working} noPin={noPin} staff={ctx.staff} />
        <Section className="mt-4" bodyClass="">
          <EmptyState icon={<IdCard size={22} aria-hidden />} title="Belum ada karyawan">
            Tambahkan karyawan dan atur PIN-nya. Mereka membuka kasir dan absen dengan PIN masing-masing di aplikasi kasir.
            <div className="mt-4">
              <button type="button" className={btn.primary} onClick={() => onOpen(null)}>
                <UserPlus size={16} aria-hidden /> Tambah karyawan
              </button>
            </div>
          </EmptyState>
          <EmployeeTable list={ctx.data.employees} selfId={selfId} todayRows={todayRows} staff={ctx.staff} onOpen={onOpen} />
        </Section>
      </>
    );
  }

  return (
    <>
      <Kpis active={active.length} working={working} noPin={noPin} staff={ctx.staff} />
      <div className="my-4 max-w-[420px]">
        <SearchBox id="team-search" label="Cari karyawan" value={q} onSearch={setQ} placeholder="Cari nama, email, atau HP…" />
      </div>
      <Section bodyClass="">
        {list.length === 0 ? (
          <EmptyState icon={<IdCard size={22} aria-hidden />} title="Tidak ada karyawan yang cocok.">
            Coba kata kunci lain.
          </EmptyState>
        ) : (
          <EmployeeTable list={list} selfId={selfId} todayRows={todayRows} staff={ctx.staff} onOpen={onOpen} />
        )}
      </Section>
    </>
  );
}

function Kpis({ active, working, noPin, staff }: { active: number; working: number; noPin: number; staff: boolean }) {
  return (
    <div className={`grid gap-3 ${staff ? "grid-cols-3" : "grid-cols-2"}`}>
      <StatCard label="Karyawan aktif" value={active} />
      {staff && <StatCard label="Sedang bekerja" value={working} tone={working ? "success" : "neutral"} />}
      <StatCard label="Belum punya PIN" value={noPin} tone={noPin ? "warning" : "neutral"} />
    </div>
  );
}

function EmployeeTable({
  list,
  selfId,
  todayRows,
  staff,
  onOpen,
}: {
  list: Employee[];
  selfId: string;
  todayRows: Map<string, Attendance>;
  staff: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[340px] border-separate border-spacing-0 text-[14px]">
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Nama
            </th>
            <th scope="col" className={`${thClass} hidden sm:table-cell`}>
              Peran
            </th>
            {staff && (
              <th scope="col" className={`${thClass} hidden md:table-cell`}>
                Hari ini
              </th>
            )}
            <th scope="col" className={thClass}>
              PIN
            </th>
            {staff && (
              <th scope="col" className={`${thClass} hidden lg:table-cell`}>
                Gaji
              </th>
            )}
            <th scope="col" className={thClass}>
              <span className="sr-only">Buka</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((e) => {
            const t = todayState(todayRows.get(e.id));
            return (
              <tr key={e.id} className={`cursor-pointer hover:bg-bg-muted/60 ${e.is_active ? "" : "text-text-muted"}`} onClick={() => onOpen(e.id)}>
                <td className={`${tdClass} border-b border-border-subtle`}>
                  <button type="button" className={`flex min-w-0 items-center gap-2.5 text-left ${focusRing}`} onClick={() => onOpen(e.id)}>
                    <Avatar name={e.name} size={32} />
                    <span className="max-w-[56vw] min-w-0 sm:max-w-none">
                      <span className={`block truncate font-semibold ${e.is_active ? "text-text-heading" : ""}`}>
                        {e.name}
                        {e.id === selfId && <span className="ml-1 font-normal text-text-muted">(kamu)</span>}
                      </span>
                      <span className="block truncate text-[12.5px] text-text-muted">
                        <span className="sm:hidden">
                          {ROLE_LABEL[e.role]}
                          {e.phone || e.email || !e.is_active ? " · " : ""}
                        </span>
                        {[e.phone, e.email, e.is_active ? null : "Nonaktif"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </button>
                </td>
                <td className={`${tdClass} hidden border-b border-border-subtle sm:table-cell`}>{ROLE_LABEL[e.role]}</td>
                {staff && (
                  <td className={`${tdClass} hidden border-b border-border-subtle md:table-cell`}>
                    {e.is_active ? <Badge tone={t.tone}>{t.label}</Badge> : <Badge>Nonaktif</Badge>}
                  </td>
                )}
                <td className={`${tdClass} border-b border-border-subtle`}>
                  {e.has_pin ? (
                    <span className="inline-flex items-center gap-1 text-[13px] whitespace-nowrap text-success">
                      <KeyRound size={14} aria-hidden /> <span className="sr-only sm:not-sr-only">PIN </span>aktif
                    </span>
                  ) : (
                    <span className="text-[13px] whitespace-nowrap text-warning">
                      Belum <span className="hidden sm:inline">ada PIN</span>
                    </span>
                  )}
                </td>
                {staff && (
                  <td className={`${tdClass} hidden border-b border-border-subtle text-[13px] lg:table-cell`}>
                    {isPaid(e.payroll) ? payrollSummary(e.payroll) : <span className="text-text-muted">Gaji belum diatur</span>}
                  </td>
                )}
                <td className={`${tdClass} w-8 border-b border-border-subtle text-right`}>
                  <ChevronRight size={16} aria-hidden className="inline text-text-muted" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
