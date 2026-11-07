"use client";

import Link from "next/link";
import { Activity, MonitorSmartphone, ReceiptText, UsersRound, Wallet } from "lucide-react";
import { useState } from "react";
import { adminApi } from "@/lib/admin/api";
import { peakLabel, type MerchantInsights, type MerchantRange } from "@/lib/admin/merchant";
import { TimeChart, type ChartRow } from "./charts";
import { BUSINESS_TYPES, labelOf } from "./labels";
import { bucketLabels, ChangeChip } from "./MetricsView";
import { AtRiskSummary } from "./GrowthView";
import { SegmentedControl } from "./merchantUi";
import {
  ErrorBlock,
  focusRing,
  formatRupiah,
  formatRupiahShort,
  Section,
  Skeleton,
  StatCard,
  tdClass,
  thClass,
  useLoad,
} from "./ui";

const RANGES: { value: MerchantRange; label: string }[] = [
  { value: "30d", label: "30 hari" },
  { value: "12w", label: "12 minggu" },
  { value: "12m", label: "12 bulan" },
];

const RANGE_NOTE: Record<MerchantRange, string> = {
  "30d": "30 hari terakhir, per hari",
  "12w": "12 minggu terakhir, per minggu",
  "12m": "12 bulan terakhir, per bulan",
};

export function MerchantOverview() {
  const [range, setRange] = useState<MerchantRange>("30d");
  const { state, reload } = useLoad<MerchantInsights>(
    async (signal) => (await adminApi()).merchantInsights(range, signal),
    [range]
  );

  // Berdiri sendiri: gagal memuat di sini tidak boleh menjatuhkan ringkasan rilis di bawahnya.
  if (state.status === "error" && !state.data) return <ErrorBlock error={state.error} onRetry={reload} />;
  if (!state.data) return <MerchantSkeleton />;
  const { today, trend, top_growing } = state.data;
  const multiYear = trend.points[0]?.bucket.slice(0, 4) !== trend.points[trend.points.length - 1]?.bucket.slice(0, 4);
  const rows: ChartRow[] = trend.points.map((p) => ({
    ...bucketLabels(p.bucket, trend.interval, multiYear),
    key: p.bucket,
    partial: p.partial,
    values: [p.value],
    notes: [`${p.count.toLocaleString("id-ID")} transaksi`],
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <StatCard
          label="Bisnis aktif hari ini"
          value={today.businesses_active}
          hint={`dari ${today.businesses_total.toLocaleString("id-ID")} bisnis`}
          icon={<Activity size={14} aria-hidden />}
          href="/admin/bisnis"
        />
        <StatCard
          label="Pengguna aktif hari ini"
          value={today.users_active}
          hint="pemilik dan karyawan"
          icon={<UsersRound size={14} aria-hidden />}
        />
        <StatCard
          label="Sedang aktif"
          value={`${today.businesses_online.toLocaleString("id-ID")} bisnis`}
          hint={`${today.devices_online.toLocaleString("id-ID")} perangkat · ${today.online_window_minutes} menit terakhir`}
          icon={<MonitorSmartphone size={14} aria-hidden />}
        />
        <StatCard
          label="Nilai transaksi hari ini"
          value={formatRupiahShort(today.sales_value)}
          hint={
            today.value_change_pct === null ? (
              "kemarin jam ini Rp0"
            ) : (
              <ChangeChip diff={today.value_change_pct} unit="%" vs="vs kemarin jam ini" invert={false} />
            )
          }
          icon={<Wallet size={14} aria-hidden />}
        />
        <StatCard
          label="Transaksi hari ini"
          value={today.sales_count}
          hint={`rata-rata ${formatRupiah(today.average_sale)}`}
          icon={<ReceiptText size={14} aria-hidden />}
        />
      </div>

      <Section
        title="Nilai transaksi semua merchant"
        description={
          <>
            Total {formatRupiahShort(trend.total.value)} · {RANGE_NOTE[trend.range]}
            {trend.total.change_pct !== null && (
              <>
                {" · "}
                <ChangeChip diff={trend.total.change_pct} unit="%" vs="vs periode sebelumnya" invert={false} />
              </>
            )}
          </>
        }
        actions={<SegmentedControl label="Rentang grafik" options={RANGES} value={range} onChange={setRange} />}
      >
        <TimeChart
          rows={rows}
          series={[{ id: "value", label: "Nilai transaksi", color: "#f1702c" }]}
          kind="line"
          format={formatRupiah}
          axisFormat={formatRupiahShort}
          height={200}
          label={`Grafik nilai transaksi semua merchant ${RANGE_NOTE[trend.range]}`}
        />
      </Section>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Section title="Merchant bertumbuh tercepat" description="Nilai 30 hari terakhir dibanding 30 hari sebelumnya." bodyClass="p-0">
          {top_growing.length === 0 ? (
            <p className="px-5 py-6 text-center text-[14px] text-text-muted">
              Belum ada merchant dengan nilai sebelumnya minimal Rp100.000 yang bertumbuh.
            </p>
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Bisnis</th>
                    <th scope="col" className={`${thClass} text-right`}>Nilai</th>
                    <th scope="col" className={`${thClass} text-right`}>Pertumbuhan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {top_growing.map((b) => (
                    <tr key={b.id}>
                      <td className={`${tdClass} min-w-0`}>
                        <Link
                          href={`/admin/bisnis/${b.id}?tab=performa`}
                          className={`font-semibold text-text-heading hover:underline ${focusRing}`}
                        >
                          {b.name}
                        </Link>
                        <p className="text-[12px] text-text-muted">
                          {labelOf(BUSINESS_TYPES, b.type)} · jam ramai {peakLabel(b.peak)}
                        </p>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>{formatRupiahShort(b.value)}</td>
                      <td className={`${tdClass} whitespace-nowrap text-right`}>
                        {b.change_pct === null ? "—" : <ChangeChip diff={b.change_pct} unit="%" vs="" invert={false} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
        <AtRiskSummary />
      </div>
    </div>
  );
}

function MerchantSkeleton() {
  return (
    <div role="status" aria-label="Memuat informasi merchant" className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="rounded-[14px] border border-border-subtle bg-white px-4 py-3.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-2.5 h-6 w-16" />
          <Skeleton className="mt-2 h-3 w-24" />
        </div>
      ))}
    </div>
  );
}
