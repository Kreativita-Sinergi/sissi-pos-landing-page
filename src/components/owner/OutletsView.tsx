"use client";

import React from "react";
import { Info, Store } from "lucide-react";
import { Meter } from "@/components/admin/charts";
import { FilterBar } from "@/components/admin/FilterMenu";
import { OUTLET_STATUS } from "@/components/admin/labels";
import { Badge, EmptyState, ErrorBlock, formatRupiah, LoadingBar, PageHeader, Section, SkeletonList, tdClass, thClass, useLoad } from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { downloadCsv, slug } from "@/lib/owner/csv";
import type { OutletsReport } from "@/lib/owner/types";
import { labelOf } from "./labels";
import { OutletManage } from "./OutletManage";
import { useOwner } from "./OwnerShell";
import { ExportMenu, PeriodFilter, periodTitle, SyncNote, usePeriod } from "./ui";

// Perbandingan outlet (GET /owner/reports/outlets). Selalu semua outlet aktif; pilihan outlet di atas diabaikan.
// Di bawahnya: kelola outlet (tambah dalam kuota / hapus) — OutletManage.

export function OutletsView() {
  const { outlet, session } = useOwner();
  const period = usePeriod("7d");
  const { from, to, preset } = period;
  const { state, reload } = useLoad<OutletsReport>(async (signal) => (await ownerApi()).outletsReport({ from, to }, signal), [from, to]);
  const r = state.data;

  return (
    <>
      <PageHeader
        title="Perbandingan outlet"
        description={`Penjualan, transaksi, dan laba tiap outlet · ${periodTitle(from, to, preset).toLowerCase()}.`}
        actions={
          <ExportMenu
            items={[
              {
                label: "Tabel outlet",
                hint: "Satu baris per outlet",
                disabled: !r,
                onSelect: () =>
                  r &&
                  downloadCsv(
                    `${slug(session.business.name)}-outlet-${from}_${to}.csv`,
                    ["outlet", "status", "omzet", "bagian_persen", "transaksi", "rata_rata", "laba_kotor", "dibatalkan", "piutang_kasbon"],
                    r.outlets.map((o) => [o.name, o.status, o.revenue, o.share_percent, o.transactions, o.average, o.gross_profit, o.cancelled_count, o.credit_outstanding])
                  ),
              },
            ]}
          />
        }
      />

      <FilterBar>
        <PeriodFilter from={from} to={to} preset={preset} onChange={period.setPeriod} />
      </FilterBar>

      {outlet && (
        <p className="mb-3 flex items-center gap-1.5 text-[13px] text-text-muted">
          <Info size={14} aria-hidden /> Halaman ini selalu membandingkan semua outlet; pilihan &ldquo;{outlet.name}&rdquo; berlaku di halaman lain.
        </p>
      )}

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!r && state.status === "loading" && <SkeletonList rows={3} />}
      {r && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div className={`flex flex-col gap-5 transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`} aria-busy={state.status === "loading"}>
            {r.outlets.length === 0 ? (
              <Section>
                <EmptyState icon={<Store size={22} aria-hidden />} title="Belum ada outlet aktif">
                  Tambah outlet di bagian Kelola outlet di bawah.
                </EmptyState>
              </Section>
            ) : (
              <>
                {r.outlets.length === 1 && (
                  <p className="flex items-start gap-1.5 text-[13px] text-text-body">
                    <Info size={14} aria-hidden className="mt-0.5 shrink-0" /> Usaha ini baru punya satu outlet. Perbandingan berguna setelah outlet kedua ditambahkan.
                  </p>
                )}
                <OutletsTable r={r} />
              </>
            )}
            <SyncNote />
          </div>
        </>
      )}
      <div className="mt-5">
        <OutletManage onChanged={reload} />
      </div>
    </>
  );
}

function OutletsTable({ r }: { r: OutletsReport }) {
  const t = r.total;
  return (
    <Section title="Outlet" description="Urut penjualan tertinggi · piutang kasbon dihitung semua tanggal" bodyClass="p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[340px] border-separate border-spacing-0 text-[14px]">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Outlet</th>
              <th scope="col" className={`${thClass} text-right`}>Penjualan</th>
              <th scope="col" className={`${thClass} hidden text-right sm:table-cell`}>Transaksi</th>
              <th scope="col" className={`${thClass} hidden text-right md:table-cell`}>Rata-rata</th>
              <th scope="col" className={`${thClass} hidden text-right md:table-cell`}>Laba kotor</th>
              <th scope="col" className={`${thClass} hidden text-right lg:table-cell`}>Batal</th>
              <th scope="col" className={`${thClass} hidden text-right lg:table-cell`}>Piutang kasbon</th>
            </tr>
          </thead>
          <tbody>
            {r.outlets.map((o) => (
              <tr key={o.outlet_id}>
                <td className={`${tdClass} border-b border-border-subtle`}>
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{o.name}</span>
                    {o.status === "closed" && <Badge>{labelOf(OUTLET_STATUS, o.status)}</Badge>}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="w-24 sm:w-40">
                      <Meter value={o.share_percent} max={100} tone="brand" />
                    </span>
                    <span className="text-[12.5px] tabular-nums text-text-muted">{o.share_percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}% penjualan</span>
                  </span>
                  <span className="mt-0.5 block text-[12px] text-text-muted sm:hidden">
                    {o.transactions.toLocaleString("id-ID")} transaksi · rata-rata {formatRupiah(o.average)}
                  </span>
                </td>
                <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums whitespace-nowrap`}>{formatRupiah(o.revenue)}</td>
                <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums sm:table-cell`}>{o.transactions.toLocaleString("id-ID")}</td>
                <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums whitespace-nowrap md:table-cell`}>{formatRupiah(o.average)}</td>
                <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums whitespace-nowrap md:table-cell`}>
                  {o.gross_profit === null ? <span className="text-text-muted" title="Isi harga modal produk di aplikasi">—</span> : formatRupiah(o.gross_profit)}
                </td>
                <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums lg:table-cell ${o.cancelled_count ? "text-danger" : "text-text-muted"}`}>{o.cancelled_count}</td>
                <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums whitespace-nowrap lg:table-cell ${o.credit_outstanding ? "text-warning" : "text-text-muted"}`}>
                  {formatRupiah(o.credit_outstanding)}
                </td>
              </tr>
            ))}
          </tbody>
          {r.outlets.length > 1 && (
            <tfoot>
              <tr className="bg-bg-muted/60 font-semibold">
                <th scope="row" className={`${tdClass} text-left`}>Total</th>
                <td className={`${tdClass} text-right tabular-nums whitespace-nowrap`}>{formatRupiah(t.revenue)}</td>
                <td className={`${tdClass} hidden text-right tabular-nums sm:table-cell`}>{t.transactions.toLocaleString("id-ID")}</td>
                <td className={`${tdClass} hidden text-right tabular-nums whitespace-nowrap md:table-cell`}>{formatRupiah(t.average)}</td>
                <td className={`${tdClass} hidden text-right tabular-nums whitespace-nowrap md:table-cell`}>{t.gross_profit === null ? "—" : formatRupiah(t.gross_profit)}</td>
                <td className={`${tdClass} hidden text-right tabular-nums lg:table-cell`}>{t.cancelled_count}</td>
                <td className={`${tdClass} hidden text-right tabular-nums whitespace-nowrap lg:table-cell`}>{formatRupiah(t.credit_outstanding)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </Section>
  );
}
