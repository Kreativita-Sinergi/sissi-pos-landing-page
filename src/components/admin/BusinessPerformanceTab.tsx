"use client";

import { useState } from "react";
import { adminApi } from "@/lib/admin/api";
import { peakLabel, type BusinessPerformance, type PerformanceDays } from "@/lib/admin/merchant";
import type { BusinessDetail } from "@/lib/admin/types";
import { TimeChart, type ChartRow } from "./charts";
import { FilterBar, FilterSelect } from "./FilterMenu";
import { useQueryState } from "./filters";
import { bucketLabels, Change, ChangeChip } from "./MetricsView";
import { OnlinePill, PaymentMethodList, SalesHeatmap, SegmentedControl, TopProductsList, type HeatMetric } from "./merchantUi";
import {
  ErrorBlock,
  formatRupiah,
  formatRupiahShort,
  Section,
  Skeleton,
  StatCard,
  tdClass,
  thClass,
  TimeAgo,
  useLoad,
} from "./ui";

const PERIODS: { value: string; label: string }[] = [
  { value: "1", label: "Hari ini" },
  { value: "7", label: "7 hari terakhir" },
  { value: "30", label: "30 hari terakhir" },
  { value: "90", label: "90 hari terakhir" },
];

export function BusinessPerformanceTab({ b }: { b: BusinessDetail }) {
  const qs = useQueryState();
  const days = (["1", "7", "90"].includes(qs.get("periode")) ? Number(qs.get("periode")) : 30) as PerformanceDays;
  const outletParam = qs.get("outlet");
  const outletId = b.outlets.some((o) => o.id === outletParam) ? outletParam : "";
  const { state, reload } = useLoad<BusinessPerformance>(
    async (signal) => (await adminApi()).businessPerformance(b.id, { days, outlet_id: outletId || undefined }, signal),
    [b.id, days, outletId]
  );

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        trailing={
          state.data && state.data.activity.devices_online > 0 ? (
            <OnlinePill>Sedang aktif · {state.data.activity.devices_online} perangkat</OnlinePill>
          ) : undefined
        }
      >
        <FilterSelect
          label="Periode"
          required
          highlight={false}
          options={PERIODS}
          selected={[String(days)]}
          onChange={(n) => qs.update({ periode: n[0] === "30" ? null : n[0] })}
        />
        {b.outlets.length > 1 && (
          <FilterSelect
            label="Outlet"
            options={b.outlets.map((o) => ({ value: o.id, label: o.name }))}
            selected={outletId ? [outletId] : []}
            onChange={(n) => qs.update({ outlet: n[0] ?? null })}
          />
        )}
      </FilterBar>
      {state.status === "error" && !state.data && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <PerformanceSkeleton />}
      {state.data && <PerformanceBody p={state.data} />}
    </div>
  );
}

function PerformanceBody({ p }: { p: BusinessPerformance }) {
  const [metric, setMetric] = useState<HeatMetric>("count");
  const { kpis, activity } = p;
  const days = p.range.days;
  const multiYear = p.weekly[0]?.week.slice(0, 4) !== p.weekly[p.weekly.length - 1]?.week.slice(0, 4);
  const rows: ChartRow[] = p.weekly.map((w) => ({
    ...bucketLabels(w.week, "week", multiYear),
    key: w.week,
    partial: w.partial,
    values: [w.value],
    notes: [`${w.count.toLocaleString("id-ID")} transaksi`],
  }));
  const multiOutlet = p.outlets.length > 1;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <StatCard label="Nilai transaksi" value={formatRupiahShort(kpis.value.value)} hint={<Change k={kpis.value} days={days} short />} />
        <StatCard label="Jumlah transaksi" value={kpis.count.value} hint={<Change k={kpis.count} days={days} short />} />
        <StatCard label="Rata-rata per transaksi" value={formatRupiah(kpis.average.value)} hint={<Change k={kpis.average} days={days} short />} />
        <StatCard
          label="Pengguna aktif hari ini"
          value={`${activity.users_active_today} dari ${activity.users_total}`}
          hint="pemilik dan karyawan"
        />
        <StatCard
          label="Hari aktif"
          value={`${activity.active_days} dari ${days}`}
          hint={
            <>
              sinkron <TimeAgo value={activity.last_synced_at} />
            </>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section
            title="Jam ramai"
            description="Per hari dan jam pada periode ini, zona Asia/Jakarta."
            actions={
              p.heatmap.length > 0 ? (
                <SegmentedControl
                  label="Ukuran jam ramai"
                  value={metric}
                  onChange={setMetric}
                  options={[
                    { value: "count", label: "Jumlah" },
                    { value: "value", label: "Nilai" },
                  ]}
                />
              ) : undefined
            }
          >
            <SalesHeatmap cells={p.heatmap} peak={p.peak} metric={metric} emptyNote="Belum ada transaksi pada periode ini." />
          </Section>

          <Section title="Pertumbuhan nilai transaksi" description="Per minggu, 12 minggu terakhir." className={multiOutlet ? "" : "flex-1"}>
            <TimeChart
              rows={rows}
              series={[{ id: "value", label: "Nilai transaksi", color: "#f1702c" }]}
              kind="line"
              format={formatRupiah}
              axisFormat={formatRupiahShort}
              height={multiOutlet ? 150 : 300}
              label="Grafik nilai transaksi per minggu, 12 minggu terakhir"
            />
          </Section>

          {multiOutlet && (
            <Section title="Per outlet" description={days === 1 ? "Dibanding kemarin di jam yang sama." : "Dibanding periode sebelumnya."} bodyClass="p-0" className="flex-1">
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[460px] text-[14px]">
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>Outlet</th>
                      <th scope="col" className={`${thClass} text-right`}>Nilai</th>
                      <th scope="col" className={`${thClass} text-right`}>Pertumbuhan</th>
                      <th scope="col" className={thClass}>Jam ramai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {p.outlets.map((o) => (
                      <tr key={o.id}>
                        <td className={`${tdClass} font-semibold text-text-heading`}>{o.name}</td>
                        <td className={`${tdClass} text-right tabular-nums`}>{formatRupiahShort(o.value)}</td>
                        <td className={`${tdClass} text-right`}>
                          {o.change_pct === null ? "—" : <ChangeChip diff={o.change_pct} unit="%" vs="" invert={false} />}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap`}>{peakLabel(o.peak)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Metode bayar" description="Uang bersih pada periode ini.">
            <PaymentMethodList items={p.payment_methods} />
          </Section>
          <Section
            title="Produk terlaris"
            description="Jumlah terjual dan nilai, sebelum diskon transaksi, pajak, dan refund sebagian."
            bodyClass="px-4 py-1.5 sm:px-5"
            className="flex-1"
          >
            <TopProductsList items={p.top_products} />
          </Section>
        </div>
      </div>
    </div>
  );
}

function PerformanceSkeleton() {
  return (
    <div role="status" aria-label="Memuat performa" className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="rounded-[14px] border border-border-subtle bg-white px-4 py-3.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2.5 h-6 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
