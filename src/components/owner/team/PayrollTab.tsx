"use client";

import React from "react";
import { ChevronRight, Wallet } from "lucide-react";
import { Badge, EmptyState, focusRing, formatRupiah, Section, StatCard, tdClass, thClass } from "@/components/admin/ui";
import { amountOf, PAY_TYPE_LABEL, recapPresent, type PayrollRow } from "@/lib/owner/team";
import { Avatar, MonthSelect, SlipBadge } from "./shared";

// Tab Gaji — cermin `payroll_tab.dart`: ringkasan bulan & tabel per karyawan. Angka = slip yang sudah terbit (beku)
// atau hitungan dari kehadiran bila belum terbit.

export function PayrollTab({
  rows,
  month,
  onMonth,
  onOpen,
}: {
  rows: PayrollRow[];
  month: string;
  onMonth: (m: string) => void;
  onOpen: (row: PayrollRow) => void;
}) {
  const paidRows = rows.filter((r) => r.configured || r.slip);
  const total = paidRows.reduce((a, r) => a + r.net, 0);
  const overtime = paidRows.reduce((a, r) => a + amountOf(r.draft, "overtime"), 0);
  const paid = paidRows.filter((r) => r.slip?.status === "paid").length;

  return (
    <>
      <div className="mb-4">
        <MonthSelect value={month} onChange={onMonth} />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Total gaji bulan ini" value={formatRupiah(total)} />
        <StatCard label="Lembur" value={formatRupiah(overtime)} />
        <StatCard label="Sudah dibayar" value={`${paid} dari ${paidRows.length}`} />
      </div>
      <Section className="mt-4" bodyClass="">
        {rows.length === 0 ? (
          <EmptyState icon={<Wallet size={22} aria-hidden />} title="Belum ada karyawan aktif." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[340px] border-separate border-spacing-0 text-[14px]">
              <thead>
                <tr>
                  <th scope="col" className={thClass}>
                    Karyawan
                  </th>
                  <th scope="col" className={`${thClass} hidden text-right md:table-cell`}>
                    Hadir
                  </th>
                  <th scope="col" className={`${thClass} hidden text-right lg:table-cell`}>
                    Gaji pokok
                  </th>
                  <th scope="col" className={`${thClass} hidden text-right lg:table-cell`}>
                    Lembur
                  </th>
                  <th scope="col" className={`${thClass} hidden text-right md:table-cell`}>
                    Potongan
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    Diterima
                  </th>
                  <th scope="col" className={`${thClass} hidden sm:table-cell`}>
                    Status
                  </th>
                  <th scope="col" className={thClass}>
                    <span className="sr-only">Buka</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const frozen = !!r.slip && r.slip.status !== "draft";
                  const deductions = frozen ? r.slip!.deductions : r.draft.deductions;
                  const shown = r.configured || frozen;
                  const status = r.slip ? <SlipBadge status={r.slip.status} /> : !r.configured ? <Badge tone="warning">Belum diatur</Badge> : <SlipBadge status="draft" />;
                  return (
                    <tr key={r.employee.id} className="cursor-pointer hover:bg-bg-muted/60" onClick={() => onOpen(r)}>
                      <td className={`${tdClass} border-b border-border-subtle`}>
                        <button type="button" className={`flex min-w-0 items-center gap-2.5 text-left ${focusRing}`} onClick={() => onOpen(r)}>
                          <Avatar name={r.employee.name} size={32} />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-text-heading">{r.employee.name}</span>
                            <span className="block truncate text-[12.5px] text-text-muted">
                              {r.config ? PAY_TYPE_LABEL[r.config.type] : "Gaji belum diatur"}
                              <span className="md:hidden"> · {recapPresent(r.recap)} hari hadir</span>
                            </span>
                          </span>
                        </button>
                      </td>
                      <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums md:table-cell`}>{recapPresent(r.recap)} hari</td>
                      <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums lg:table-cell`}>
                        {frozen || !r.configured ? "—" : formatRupiah(amountOf(r.draft, "base"))}
                      </td>
                      <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums lg:table-cell`}>
                        {frozen || !r.configured ? "—" : formatRupiah(amountOf(r.draft, "overtime"))}
                      </td>
                      <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums md:table-cell ${deductions ? "text-danger" : ""}`}>
                        {deductions ? `-${formatRupiah(deductions)}` : formatRupiah(0)}
                      </td>
                      <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums text-text-heading`}>
                        {shown ? formatRupiah(r.net) : "—"}
                        <span className="mt-1 block font-normal sm:hidden">{status}</span>
                      </td>
                      <td className={`${tdClass} hidden border-b border-border-subtle sm:table-cell`}>{status}</td>
                      <td className={`${tdClass} w-8 border-b border-border-subtle text-right`}>
                        <ChevronRight size={16} aria-hidden className="inline text-text-muted" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      <p className="mt-3 text-[12.5px] text-text-muted">
        Klik baris untuk melihat slip. Karyawan yang gajinya belum diatur membuka pengaturan gaji. Slip yang sudah terbit dibekukan.
      </p>
    </>
  );
}
