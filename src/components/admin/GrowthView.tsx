"use client";

import Link from "next/link";
import { useState } from "react";
import { adminApi } from "@/lib/admin/api";
import { peakLabel, type AtRiskMerchant, type MerchantGrowth } from "@/lib/admin/merchant";
import { TimeChart, type ChartRow } from "./charts";
import { BUSINESS_TYPES, labelOf } from "./labels";
import { bucketLabels, ChangeChip } from "./MetricsView";
import { GroupHeading, PaymentMethodList } from "./merchantUi";
import {
  Badge,
  ErrorBlock,
  focusRing,
  formatRupiah,
  formatRupiahShort,
  PageHeader,
  Section,
  Skeleton,
  StatCard,
  tdClass,
  thClass,
  TimeAgo,
  useLoad,
} from "./ui";

const loadGrowth = async (signal: AbortSignal) => (await adminApi()).merchantGrowth(signal);

export function GrowthView() {
  const { state, reload } = useLoad<MerchantGrowth>(loadGrowth, []);
  return (
    <>
      <PageHeader
        title="Pertumbuhan merchant"
        description="Merchant yang sungguh memakai kasir dan yang berisiko berhenti. Akun uji tidak dihitung."
      />
      {state.status === "error" && !state.data && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <Skeleton className="h-64 w-full" />}
      {state.data && <GrowthBody g={state.data} />}
    </>
  );
}

function GrowthBody({ g }: { g: MerchantGrowth }) {
  const multiYear = g.monthly[0]?.month.slice(0, 4) !== g.monthly[g.monthly.length - 1]?.month.slice(0, 4);
  const base = g.monthly.map((m) => ({ ...bucketLabels(m.month, "month", multiYear), key: m.month, partial: m.partial }));
  const transactingRows: ChartRow[] = g.monthly.map((m, i) => ({ ...base[i], values: [m.transacting] }));
  const newRows: ChartRow[] = g.monthly.map((m, i) => ({
    ...base[i],
    values: [m.new_transacting],
    notes: [`${m.signups.toLocaleString("id-ID")} bisnis mendaftar`],
  }));
  const latest = g.monthly[g.monthly.length - 1];
  const a = g.activation;
  const num = (v: number) => v.toLocaleString("id-ID");

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label="Merchant bertransaksi bulan ini"
          value={latest?.transacting ?? 0}
          hint={`${num(latest?.new_transacting ?? 0)} baru pertama kali`}
        />
        <StatCard
          label="Aktivasi"
          value={a.rate === null ? "—" : `${(a.rate * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`}
          hint={`${num(a.activated)} dari ${num(a.signups)} pendaftar ${a.window_days} hari terakhir`}
        />
        <StatCard
          label="Sampai transaksi pertama"
          value={a.median_days === null ? "—" : `${a.median_days.toLocaleString("id-ID")} hari`}
          hint="nilai tengah"
        />
        <StatCard
          label="Merchant berisiko"
          value={g.at_risk.total}
          tone={g.at_risk.total > 0 ? "warning" : "neutral"}
          hint="berhenti atau turun tajam"
        />
      </div>

      <div>
        <GroupHeading title="Perlu dihubungi" />
        <AtRiskSection items={g.at_risk.items} total={g.at_risk.total} />
      </div>

      <div>
        <GroupHeading title="Perkembangan" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="Merchant bertransaksi" description="Bisnis berbeda dengan transaksi per bulan.">
            <TimeChart
              rows={transactingRows}
              series={[{ id: "transacting", label: "Merchant bertransaksi", color: "#f1702c" }]}
              kind="line"
              format={num}
              integer
              label="Grafik merchant bertransaksi per bulan"
            />
          </Section>
          <Section title="Transaksi pertama" description="Bisnis yang mulai bertransaksi per bulan.">
            <TimeChart
              rows={newRows}
              series={[{ id: "new", label: "Transaksi pertama", color: "#f1702c" }]}
              kind="bar"
              format={num}
              integer
              label="Grafik bisnis yang mulai bertransaksi per bulan"
            />
          </Section>
        </div>
      </div>

      <div>
        <GroupHeading title="Perbandingan 30 hari terakhir" />
        <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Section title="Per jenis usaha" description="Jenis dengan sedikit merchant belum bisa dijadikan patokan." bodyClass="p-0">
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-[14px]">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Jenis</th>
                    <th scope="col" className={`${thClass} text-right`}>Bertransaksi</th>
                    <th scope="col" className={`${thClass} text-right`}>Nilai</th>
                    <th scope="col" className={`${thClass} text-right`}>Pertumbuhan</th>
                    <th scope="col" className={`${thClass} text-right`}>Per merchant</th>
                    <th scope="col" className={thClass}>Jam ramai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {g.by_type.map((t) => (
                    <tr key={t.type}>
                      <td className={tdClass}>
                        <p className="font-semibold text-text-heading">{labelOf(BUSINESS_TYPES, t.type)}</p>
                        <p className="whitespace-nowrap text-[12px] text-text-muted">rata-rata {formatRupiah(t.average_sale)}</p>
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>
                        {num(t.transacting)} dari {num(t.businesses)}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>{formatRupiahShort(t.value)}</td>
                      <td className={`${tdClass} whitespace-nowrap text-right`}>
                        {t.change_pct === null ? "—" : <ChangeChip diff={t.change_pct} unit="%" vs="" invert={false} />}
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-right tabular-nums`}>{formatRupiahShort(t.value_per_business)}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{peakLabel(t.peak)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="Metode bayar" description="Uang bersih, semua merchant.">
            <PaymentMethodList items={g.payment_methods} />
          </Section>
        </div>
      </div>
    </div>
  );
}

export function AtRiskSection({ items, total, compact = false }: { items: AtRiskMerchant[]; total: number; compact?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const shown = compact ? items.slice(0, 5) : expanded ? items : items.slice(0, 10);
  return (
    <Section
      title="Merchant berisiko berhenti"
      description={
        compact
          ? "Berhenti 7 hari, atau nilai 14 hari terakhir turun minimal setengahnya."
          : "Tidak bertransaksi 7 hari padahal sebelumnya aktif, atau nilai 14 hari terakhir turun minimal setengahnya."
      }
      bodyClass="p-0"
      actions={
        compact && total > 0 ? (
          <Link href="/admin/pertumbuhan" className={`whitespace-nowrap text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}>
            Semua ({total.toLocaleString("id-ID")})
          </Link>
        ) : undefined
      }
    >
      {shown.length === 0 ? (
        <p className="px-5 py-6 text-center text-[14px] text-text-muted">Tidak ada merchant yang berisiko saat ini.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className={`w-full text-[14px] ${compact ? "" : "min-w-[820px]"}`}>
            <thead>
              <tr>
                <th scope="col" className={thClass}>Bisnis</th>
                <th scope="col" className={thClass}>Kondisi</th>
                {!compact && <th scope="col" className={thClass}>Pemilik</th>}
                <th scope="col" className={thClass}>{compact ? "Terakhir" : "Transaksi terakhir"}</th>
                <th scope="col" className={`${thClass} text-right ${compact ? "hidden sm:table-cell" : ""}`}>{compact ? "Sebelumnya" : "Nilai sebelumnya"}</th>
                {!compact && <th scope="col" className={`${thClass} text-right`}>14 hari terakhir</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {shown.map((m) => (
                <tr key={m.id}>
                  <td className={tdClass}>
                    <Link href={`/admin/bisnis/${m.id}?tab=performa`} className={`font-semibold text-text-heading hover:underline ${focusRing}`}>
                      {m.name}
                    </Link>
                    <p className="text-[12px] text-text-muted">{labelOf(BUSINESS_TYPES, m.type)}</p>
                  </td>
                  <td className={tdClass}>
                    {m.reason === "stopped" ? <Badge tone="danger">Berhenti</Badge> : <Badge tone="warning">Turun tajam</Badge>}
                  </td>
                  {!compact && (
                    <td className={tdClass}>
                      <p className="text-text-heading">{m.owner_name ?? "—"}</p>
                      {m.owner_phone && (
                        <a href={`tel:${m.owner_phone}`} className={`text-[12.5px] text-brand-ink hover:underline ${focusRing}`}>
                          {m.owner_phone}
                        </a>
                      )}
                    </td>
                  )}
                  <td className={`${tdClass} whitespace-nowrap`}><TimeAgo value={m.last_sale_at} /></td>
                  <td className={`${tdClass} text-right tabular-nums ${compact ? "hidden sm:table-cell" : ""}`}>{formatRupiahShort(m.value_previous)}</td>
                  {!compact && <td className={`${tdClass} text-right tabular-nums`}>{formatRupiahShort(m.value_recent)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!compact && items.length > 10 && (
        <div className="border-t border-border-subtle px-5 py-2.5 text-center">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
            className={`text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}
          >
            {expanded ? "Tampilkan lebih sedikit" : `Tampilkan semua (${items.length.toLocaleString("id-ID")})`}
          </button>
        </div>
      )}
      {!compact && expanded && total > items.length && (
        <p className="px-5 pb-3 text-center text-[12.5px] text-text-muted">
          Menampilkan {items.length.toLocaleString("id-ID")} dari {total.toLocaleString("id-ID")}, urut nilai sebelumnya terbesar.
        </p>
      )}
    </Section>
  );
}

/** Bagian Ringkasan: gagal memuat hanya menyembunyikan bagian ini. */
export function AtRiskSummary() {
  const { state } = useLoad<MerchantGrowth>(loadGrowth, []);
  if (state.status === "error" && !state.data) return null;
  if (!state.data) return <Skeleton className="h-64 w-full" />;
  return <AtRiskSection items={state.data.at_risk.items} total={state.data.at_risk.total} compact />;
}
