"use client";

import React, { useCallback, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { useQueryState } from "@/components/admin/filters";
import { useToast } from "@/components/admin/toast";
import { btn, ErrorBlock, LoadingBar, PageHeader, SkeletonList, Tabs, useLoad } from "@/components/admin/ui";
import { hasFeature } from "@/lib/owner/records";
import { loadTeam, mergeRecord, payrollRows, recentMonths, type TeamData, type TeamOutcome } from "@/lib/owner/team";
import { zonedToday } from "@/lib/owner/tz";
import type { SyncRecord } from "@/lib/owner/types";
import { useOwner } from "./OwnerShell";
import { AttendanceTab } from "./team/AttendanceTab";
import { EmployeeSheet, type EmployeeTarget } from "./team/EmployeeSheet";
import { EmployeesTab } from "./team/EmployeesTab";
import { ManualAttendanceDialog, type ManualTarget } from "./team/ManualAttendanceDialog";
import { PayrollDialog } from "./team/PayrollDialog";
import { PayrollTab } from "./team/PayrollTab";
import { PayslipSheet } from "./team/PayslipSheet";
import type { TeamCtx } from "./team/shared";
import { LockedCard, SyncNote } from "./ui";

// Tim (kelola, setara menu Tim di aplikasi): Karyawan (tambah/ubah, peran, aktif, PIN), Kehadiran (papan hari ini,
// riwayat sebulan, absen manual/koreksi), Gaji (pengaturan gaji, slip: terbitkan → tandai dibayar).
// Kehadiran & Gaji = kunci Pro `staff`; daftar karyawan + PIN tetap Gratis (api.md "Kunci fitur Pro").
// URL: ?tab=karyawan|kehadiran|gaji, ?bulan=YYYY-MM, ?lihat=riwayat, ?karyawan=<id> (filter riwayat).

type TabId = "karyawan" | "kehadiran" | "gaji";
const TABS: TabId[] = ["karyawan", "kehadiran", "gaji"];

export function TeamView() {
  const { session, outletId } = useOwner();
  const toast = useToast();
  const qs = useQueryState();
  const staff = hasFeature(session.subscription, "staff");
  const tab = (TABS.includes(qs.get("tab") as TabId) ? qs.get("tab") : "karyawan") as TabId;
  const thisMonth = zonedToday().slice(0, 7);
  const month = recentMonths().includes(qs.get("bulan")) ? qs.get("bulan") : thisMonth;
  const view = qs.get("lihat") === "riwayat" ? "history" : "today";

  const { state, reload } = useLoad<TeamData>((signal) => loadTeam(staff, signal), [staff ? 1 : 0]);
  const loaded = state.data;
  // Hasil simpan digabung di atas data tarikan (tanpa tarik ulang semuanya); dibuang saat data dimuat ulang.
  const [patches, setPatches] = useState<{ base: TeamData; entity: "employees" | "attendances" | "payslips"; record: SyncRecord }[]>([]);
  const data = useMemo(
    () => (loaded ? patches.filter((p) => p.base === loaded).reduce((d, p) => mergeRecord(d, p.entity, p.record), loaded) : undefined),
    [loaded, patches]
  );

  const merge = useCallback(
    (entity: "employees" | "attendances" | "payslips", out: TeamOutcome) => {
      const record = out.record;
      if (loaded && record) setPatches((list) => [...list.filter((p) => p.base === loaded), { base: loaded, entity, record }]);
      if (out.status === "conflict") toast.error(out.message);
    },
    [loaded, toast]
  );

  const [employee, setEmployee] = useState<EmployeeTarget>(null);
  const [manual, setManual] = useState<ManualTarget>(null);
  const [slipFor, setSlipFor] = useState<string | null>(null);
  const [payrollFor, setPayrollFor] = useState<string | null>(null);

  const ctx: TeamCtx | null = data ? { data, merge, reload, staff } : null;
  const rows = useMemo(() => (data && staff ? payrollRows(data, month) : []), [data, staff, month]);
  const slipRow = slipFor ? (rows.find((r) => r.employee.id === slipFor) ?? null) : null;
  const defaultOutlet = outletId ?? session.outlets.find((o) => o.status === "open")?.id ?? session.outlets[0]?.id ?? "";

  return (
    <>
      <PageHeader
        title="Tim"
        description="Kelola karyawan, PIN kasir, kehadiran, dan gaji. Perubahan diterima perangkat kasir saat sinkron berikutnya."
        actions={
          tab === "karyawan" && data ? (
            <button type="button" className={btn.primary} onClick={() => setEmployee({ id: null, key: Date.now() })}>
              <UserPlus size={16} aria-hidden /> Tambah karyawan
            </button>
          ) : undefined
        }
      />

      <Tabs<TabId>
        label="Bagian tim"
        active={tab}
        onChange={(t) => qs.update({ tab: t === "karyawan" ? null : t, karyawan: null })}
        tabs={[
          { id: "karyawan", label: "Karyawan", count: data?.employees.length },
          { id: "kehadiran", label: "Kehadiran" },
          { id: "gaji", label: "Gaji" },
        ]}
      />

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!data && state.status === "loading" && <SkeletonList rows={5} label="Memuat data tim" />}

      {ctx && (
        <>
          <LoadingBar active={state.status === "loading"} />
          {tab === "karyawan" && <EmployeesTab ctx={ctx} selfId={session.user.id} onOpen={(id) => setEmployee({ id, key: Date.now() })} />}
          {tab !== "karyawan" && !staff && (
            <LockedCard title={tab === "kehadiran" ? "Kehadiran karyawan" : "Gaji karyawan"}>
              Catat absen masuk/pulang dengan PIN, pantau keterlambatan dan lembur, lalu hitung dan terbitkan slip gaji dengan paket Pro.
            </LockedCard>
          )}
          {tab === "kehadiran" && staff && (
            <AttendanceTab
              ctx={ctx}
              view={view}
              month={month}
              employeeFilter={ctx.data.employees.some((e) => e.id === qs.get("karyawan")) ? qs.get("karyawan") : ""}
              onView={(v) => qs.update({ lihat: v === "history" ? "riwayat" : null }, "replace")}
              onMonth={(m) => qs.update({ bulan: m === thisMonth ? null : m }, "replace")}
              onEmployee={(id) => qs.update({ karyawan: id || null }, "replace")}
              onManual={(employeeId, date) => setManual({ employeeId, date, key: Date.now() })}
            />
          )}
          {tab === "gaji" && staff && (
            <PayrollTab
              rows={rows}
              month={month}
              onMonth={(m) => qs.update({ bulan: m === thisMonth ? null : m }, "replace")}
              onOpen={(r) => (!r.configured && !r.slip ? setPayrollFor(r.employee.id) : setSlipFor(r.employee.id))}
            />
          )}

          <EmployeeSheet
            target={employee}
            ctx={ctx}
            selfId={session.user.id}
            businessType={session.business.type}
            onClose={() => setEmployee(null)}
          />
          {staff && (
            <>
              <ManualAttendanceDialog
                target={manual}
                ctx={ctx}
                owner={{ id: session.user.id, name: session.user.name }}
                businessId={session.business.id}
                outletId={defaultOutlet}
                onClose={() => setManual(null)}
              />
              <PayslipSheet
                row={slipRow}
                month={month}
                ctx={ctx}
                businessId={session.business.id}
                businessName={session.business.name}
                onClose={() => setSlipFor(null)}
                onEditPayroll={() => slipRow && setPayrollFor(slipRow.employee.id)}
              />
              <PayrollDialog
                employee={payrollFor ? (ctx.data.employees.find((e) => e.id === payrollFor) ?? null) : null}
                ctx={ctx}
                onClose={() => setPayrollFor(null)}
              />
            </>
          )}
        </>
      )}
      <SyncNote className="mt-4" />
    </>
  );
}
