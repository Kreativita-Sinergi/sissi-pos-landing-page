"use client";

import React from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Info, Minus } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { Kpi, Metrics, MetricsInterval } from "@/lib/admin/types";
import { Legend, StackBar, TimeChart, type ChartRow, type ChartSeries } from "./charts";
import { jakartaDate, useQueryState } from "./filters";
import { DateFilter, FilterBar, FilterSelect } from "./FilterMenu";
import { BUSINESS_TYPES, labelOf } from "./labels";
import { PLAN_COLORS } from "./subscriptionUi";
import {
  cardClass,
  ErrorBlock,
  focusRing,
  formatDateTime,
  formatRupiah,
  formatRupiahShort,
  LoadingBar,
  PageHeader,
  Section,
  Skeleton,
  tdClass,
  thClass,
  useLoad,
} from "./ui";

// Metrik pengguna & langganan (tahap 3). Rentang & interval tersimpan di URL (?from=&to=&interval=).

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const MAIN = "#f1702c";

const INTERVALS: { value: MetricsInterval; label: string; maxDays: number }[] = [
  { value: "day", label: "Harian", maxDays: 92 },
  { value: "week", label: "Mingguan", maxDays: 53 * 7 },
  { value: "month", label: "Bulanan", maxDays: 36 * 30 },
];

const PRESETS = [
  { label: "7 hari", days: 7 },
  { label: "30 hari", days: 30 },
  { label: "90 hari", days: 90 },
  { label: "6 bulan", days: 182 },
  { label: "12 bulan", days: 365 },
];

function dayParts(d: string) {
  const [y, m, dd] = d.split("-").map(Number);
  return { y, m, d: dd };
}
const spanDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
const shortDay = (d: string) => `${dayParts(d).d} ${MONTHS[dayParts(d).m - 1]}`;
const longDay = (d: string) => `${dayParts(d).d} ${MONTHS[dayParts(d).m - 1]} ${dayParts(d).y}`;
function addDays(d: string, n: number) {
  return new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Interval terkecil yang sah untuk panjang rentang (kontrak: day ≤ 92 hari, week ≤ 53 minggu). */
function fitInterval(want: MetricsInterval, days: number): MetricsInterval {
  const order: MetricsInterval[] = ["day", "week", "month"];
  for (const iv of order.slice(order.indexOf(want))) if (days <= INTERVALS.find((x) => x.value === iv)!.maxDays) return iv;
  return "month";
}

const pctFmt = (v: number) => `${Math.round(v * 100)}%`;
const num = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 1 });

export function MetricsView() {
  const qs = useQueryState();
  const today = jakartaDate(0);
  const urlFrom = qs.get("from");
  const urlTo = qs.get("to");
  const to = urlTo || today;
  const from = urlFrom || addDays(to, -29);
  const wanted = (INTERVALS.some((i) => i.value === qs.get("interval")) ? qs.get("interval") : "day") as MetricsInterval;
  const interval = fitInterval(wanted, spanDays(from, to));

  const { state, reload } = useLoad<Metrics>(
    async (signal) => (await adminApi()).metrics({ from, to, interval }, signal),
    [from, to, interval]
  );
  const m = state.data;

  return (
    <>
      <PageHeader title="Metrik" description="Pertumbuhan, keaktifan, dan pendapatan Sissi. Dibandingkan dengan periode sepanjang tepat sebelumnya." />

      <FilterBar
        trailing={
          m && (
            <p className="text-[12.5px] text-text-muted" title={m.cached ? "Angka disimpan sementara hingga 10 menit" : undefined}>
              Diperbarui {formatDateTime(m.generated_at)}
              {m.cached ? " · cache" : ""}
            </p>
          )
        }
      >
        <DateFilter
          label="Rentang"
          from={urlFrom || from}
          to={urlTo}
          presets={PRESETS}
          onChange={(f, t) => {
            const days = f ? spanDays(f, t || today) : 30;
            const iv = fitInterval(wanted, days);
            qs.update({ from: f, to: t, interval: iv === "day" ? null : iv });
          }}
        />
        <FilterSelect
          label="Interval"
          required
          highlight={false}
          options={INTERVALS.map((i) => ({ value: i.value, label: i.label }))}
          selected={[interval]}
          onChange={(n) => qs.update({ interval: n[0] === "day" ? null : n[0] })}
        />
      </FilterBar>
      {interval !== wanted && (
        <p className="-mt-1 mb-3 flex items-center gap-1.5 text-[12.5px] text-text-muted">
          <Info size={14} aria-hidden /> Rentang terlalu panjang untuk {INTERVALS.find((i) => i.value === wanted)?.label.toLowerCase()} — ditampilkan{" "}
          {INTERVALS.find((i) => i.value === interval)?.label.toLowerCase()}.
        </p>
      )}

      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !m && <MetricsSkeleton />}
      {m && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div className={`flex flex-col gap-5 transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`} aria-busy={state.status === "loading"}>
            <MetricsBody m={m} days={spanDays(from, to)} />
          </div>
        </>
      )}
    </>
  );
}

function MetricsSkeleton() {
  return (
    <div role="status" aria-label="Memuat metrik" className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className={`${cardClass} px-4 py-3.5`}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2.5 h-6 w-16" />
            <Skeleton className="mt-2 h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={`${cardClass} p-5`}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-[180px] w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ——— Kartu angka ———

function Change({ k, days, invert = false, percentPoints = false }: { k: Kpi; days: number; invert?: boolean; percentPoints?: boolean }) {
  const vs = `vs ${days} hari sebelumnya`;
  if (k.value !== null && k.previous !== null && percentPoints) {
    const diff = Math.round((k.value - k.previous) * 1000) / 10;
    return <ChangeChip diff={diff} unit=" poin" vs={vs} invert={invert} />;
  }
  if (k.change_pct === null) {
    return (
      <span className="text-[12px] text-text-muted" title={vs}>
        {k.previous === 0 && k.value ? "baru — sebelumnya 0" : "tidak ada pembanding"}
      </span>
    );
  }
  return <ChangeChip diff={k.change_pct} unit="%" vs={vs} invert={invert} />;
}

function ChangeChip({ diff, unit, vs, invert }: { diff: number; unit: string; vs: string; invert: boolean }) {
  const up = diff > 0;
  const flat = diff === 0;
  const good = invert ? !up : up;
  const tone = flat ? "bg-bg-muted text-text-body" : good ? "bg-success-tint text-success" : "bg-danger-tint text-danger";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const text = `${up ? "+" : ""}${diff.toLocaleString("id-ID", { maximumFractionDigits: 1 })}${unit}`;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5 text-[12px] text-text-muted">
      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-semibold tabular-nums ${tone}`}>
        <Icon size={13} aria-hidden />
        <span className="sr-only">{flat ? "tetap" : up ? "naik" : "turun"} </span>
        {text}
      </span>
      <span className="hidden sm:inline">{vs}</span>
    </span>
  );
}

function KpiCard({
  label,
  value,
  footer,
  hint,
  href,
  tone = "neutral",
}: {
  label: string;
  value: string;
  footer?: React.ReactNode;
  hint?: React.ReactNode;
  href?: string;
  tone?: "neutral" | "warning";
}) {
  const body = (
    <>
      <p className="text-[12.5px] leading-snug text-text-muted sm:text-[13px]">{label}</p>
      <p className={`mt-1 text-[22px] font-bold leading-none tracking-tight tabular-nums sm:text-[26px] ${tone === "warning" ? "text-warning" : "text-text-heading"}`}>
        {value}
      </p>
      {footer && <div className="mt-2">{footer}</div>}
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-text-muted">{hint}</p>}
    </>
  );
  const cls = `${cardClass} min-w-0 px-3 py-3 sm:px-4 sm:py-3.5`;
  if (!href) return <div className={cls}>{body}</div>;
  return (
    <Link href={href} className={`${cls} block transition-colors hover:border-border-active ${focusRing}`}>
      {body}
    </Link>
  );
}

// ——— Isi ———

function bucketLabels(bucket: string, interval: MetricsInterval, multiYear: boolean) {
  const p = dayParts(bucket);
  if (interval === "month") {
    return { label: `${MONTHS[p.m - 1]}${multiYear ? ` ${String(p.y).slice(2)}` : ""}`, title: `${MONTHS_LONG[p.m - 1]} ${p.y}` };
  }
  if (interval === "week") {
    const end = addDays(bucket, 6);
    return { label: shortDay(bucket), title: `Minggu ${shortDay(bucket)} – ${longDay(end)}` };
  }
  return { label: shortDay(bucket), title: new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${bucket}T00:00:00Z`)) };
}

function MetricsBody({ m, days }: { m: Metrics; days: number }) {
  const k = m.kpis;
  const iv = m.range.interval;
  const per = iv === "day" ? "per hari" : iv === "week" ? "per minggu" : "per bulan";
  const multiYear = m.series.length > 0 && m.series[0].bucket.slice(0, 4) !== m.series[m.series.length - 1].bucket.slice(0, 4);
  const base = m.series.map((s) => ({ ...bucketLabels(s.bucket, iv, multiYear), key: s.bucket, partial: s.partial }));
  const totalNow = m.plans.trial + m.plans.active + m.plans.grace + m.plans.free;
  const conv = m.conversion;

  const activeRows: ChartRow[] = m.series.map((s, i) => ({ ...base[i], values: [s.active] }));
  const signupRows: ChartRow[] = m.series.map((s, i) => ({ ...base[i], values: [s.signups] }));
  const planSeries: ChartSeries[] = [
    { id: "pro", label: "Pro", color: PLAN_COLORS.active },
    { id: "trial", label: "Uji coba", color: PLAN_COLORS.trial },
    { id: "grace", label: "Tenggang", color: PLAN_COLORS.grace },
    { id: "free", label: "Gratis", color: PLAN_COLORS.free },
  ];
  const planRows: ChartRow[] = m.series.map((s, i) => ({ ...base[i], values: [s.pro, s.trial, s.grace, s.free] }));
  const planGap = m.series.some((s) => s.pro === null) && m.series.some((s) => s.pro !== null);
  const revRows: ChartRow[] = m.revenue_monthly.map((r) => {
    const [y, mo] = r.month.split("-").map(Number);
    return {
      key: r.month,
      label: MONTHS[mo - 1],
      title: `${MONTHS_LONG[mo - 1]} ${y}`,
      values: [r.amount],
      notes: r.payments ? [`${r.payments} pembayaran · ${r.new} baru · ${r.renewals} perpanjangan`] : ["Belum ada pembayaran"],
    };
  });
  const revTotal = m.revenue_monthly.reduce((a, r) => a + r.amount, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <KpiCard
          label="Pendaftaran baru"
          value={num(k.signups.value ?? 0)}
          footer={<Change k={k.signups} days={days} />}
          hint={`Total terdaftar ${totalNow.toLocaleString("id-ID")} bisnis`}
          href="/admin/bisnis"
        />
        <KpiCard
          label="Bisnis aktif"
          value={num(k.active_businesses.value ?? 0)}
          footer={<Change k={k.active_businesses} days={days} />}
          hint={`Rata-rata ${num(k.dau_avg.value ?? 0)} per hari`}
        />
        <KpiCard
          label="Pro berbayar"
          value={num(k.pro_paying.value ?? 0)}
          footer={<Change k={k.pro_paying} days={days} />}
          hint="Status aktif di akhir rentang"
          href="/admin/langganan?status=active"
        />
        <KpiCard
          label="Pendapatan"
          value={formatRupiahShort(k.revenue.value ?? 0)}
          footer={<Change k={k.revenue} days={days} />}
          hint={<span title={formatRupiah(k.revenue.value)}>{formatRupiah(k.revenue.value)} dalam rentang</span>}
        />
        <KpiCard
          label="MRR (perkiraan)"
          value={formatRupiahShort(k.mrr_estimate.value ?? 0)}
          footer={<Change k={k.mrr_estimate} days={days} />}
          hint="Tahunan dihitung ÷ 12"
        />
        <KpiCard
          label="Konversi uji coba → Pro"
          value={k.trial_conversion.value === null ? "—" : pctFmt(k.trial_conversion.value)}
          footer={<Change k={k.trial_conversion} days={days} percentPoints />}
          hint={conv.trials_ended ? `${conv.converted} dari ${conv.trials_ended} uji coba berakhir (≤ ${conv.window_days} hari)` : "Belum ada uji coba yang berakhir"}
        />
        <KpiCard
          label="Uji coba berjalan"
          value={num(m.plans.trial)}
          hint={`${m.plans.grace} dalam masa tenggang`}
          href="/admin/langganan?status=trial"
        />
        <KpiCard
          label="Berakhir ≤ 7 hari"
          value={num(m.plans.expiring_7d)}
          tone={m.plans.expiring_7d > 0 ? "warning" : "neutral"}
          hint="Uji coba & Pro — hubungi sebelum habis"
          href="/admin/langganan?expiring=7d"
        />
      </div>

      <Section title="Keaktifan" description={`Per ${longDay(m.activity.as_of)}. Aktif = membuka aplikasi & sinkron, login, atau bertransaksi.`}>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {[
            { t: "Harian (DAU)", v: num(m.activity.dau) },
            { t: "7 hari (WAU)", v: num(m.activity.wau) },
            { t: "30 hari (MAU)", v: num(m.activity.mau) },
            { t: "Kelekatan DAU/MAU", v: pctFmt(m.activity.stickiness) },
          ].map((x) => (
            <div key={x.t} className="min-w-0">
              <dt className="text-[12.5px] text-text-muted">{x.t}</dt>
              <dd className="text-[20px] font-bold tabular-nums text-text-heading">{x.v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Bisnis aktif" description={`Bisnis berbeda yang aktif ${per}.`}>
          <TimeChart rows={activeRows} series={[{ id: "active", label: "Bisnis aktif", color: MAIN }]} kind="line" format={num} integer label={`Grafik bisnis aktif ${per}`} />
        </Section>
        <Section title="Pendaftaran" description={`Bisnis baru ${per}.`}>
          <TimeChart rows={signupRows} series={[{ id: "signups", label: "Pendaftaran", color: MAIN }]} kind="bar" format={num} integer label={`Grafik pendaftaran ${per}`} />
        </Section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section title="Sebaran paket" description={`Jumlah bisnis per status di akhir tiap ${iv === "day" ? "hari" : iv === "week" ? "minggu" : "bulan"}.`}>
          <div className="mb-3">
            <Legend items={planSeries.map((s) => ({ label: s.label, color: s.color }))} />
          </div>
          <TimeChart
            rows={planRows}
            series={planSeries}
            kind="bar"
            format={num}
            integer
            label="Grafik sebaran paket"
            emptyNote="Belum ada snapshot harian untuk rentang ini (dicatat sejak fitur langganan aktif)."
          />
          {planGap && <p className="mt-2 text-[12px] text-text-muted">Bagian kosong = sebelum snapshot harian tersedia.</p>}
        </Section>
        <Section title="Paket saat ini" description={`${totalNow.toLocaleString("id-ID")} bisnis`}>
          <StackBar
            label="Paket saat ini"
            parts={[
              { label: "Pro", value: m.plans.active, color: PLAN_COLORS.active },
              { label: "Uji coba", value: m.plans.trial, color: PLAN_COLORS.trial },
              { label: "Tenggang", value: m.plans.grace, color: PLAN_COLORS.grace },
              { label: "Gratis", value: m.plans.free, color: PLAN_COLORS.free },
            ]}
          />
          <ul className="mt-4 divide-y divide-border-subtle text-[14px]">
            {(
              [
                ["active", "Pro berbayar", m.plans.active],
                ["trial", "Uji coba", m.plans.trial],
                ["grace", "Masa tenggang", m.plans.grace],
                ["free", "Gratis", m.plans.free],
              ] as const
            ).map(([id, t, v]) => (
              <li key={id}>
                <Link href={`/admin/langganan?status=${id}`} className={`flex items-center gap-2.5 py-2 hover:text-brand-ink ${focusRing}`}>
                  <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: PLAN_COLORS[id] }} />
                  <span className="min-w-0 flex-1">{t}</span>
                  <span className="font-semibold tabular-nums text-text-heading">{v.toLocaleString("id-ID")}</span>
                  <span className="w-11 text-right text-[12.5px] tabular-nums text-text-muted">{totalNow ? pctFmt(v / totalNow) : "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
          {m.plans.over_limit > 0 && (
            <p className="mt-3 rounded-[10px] bg-warning-tint px-3 py-2 text-[13px] text-warning">
              {m.plans.over_limit} bisnis Gratis melewati batas transaksi bulan ini —{" "}
              <Link href="/admin/langganan?over_limit=true" className={`font-semibold underline underline-offset-2 ${focusRing}`}>
                lihat
              </Link>
            </p>
          )}
        </Section>
      </div>

      <Section
        title="Pendapatan per bulan"
        description={`12 bulan terakhir · total ${formatRupiah(revTotal)}`}
        actions={
          <Link href="/admin/langganan?sort=last_payment" className={`inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}>
            Pembayaran <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        <TimeChart rows={revRows} series={[{ id: "rev", label: "Pendapatan", color: PLAN_COLORS.active }]} kind="bar" format={formatRupiah} axisFormat={formatRupiahShort} label="Grafik pendapatan per bulan" />
      </Section>

      <CohortTable cohorts={m.cohorts} />

      <BusinessTypes rows={m.business_types} />
    </>
  );
}

// ——— Kohort ———

function cellStyle(v: number): React.CSSProperties {
  // Satu warna (oranye merek), terang → pekat; teks putih di sel pekat.
  return { background: `rgba(241, 112, 44, ${0.07 + v * 0.83})`, color: v >= 0.55 ? "white" : "var(--color-text-heading)" };
}

function CohortTable({ cohorts }: { cohorts: Metrics["cohorts"] }) {
  return (
    <Section
      title="Retensi kohort"
      description="Bagian bisnis tiap minggu daftar yang masih aktif di minggu ke-0 sampai ke-8."
      bodyClass=""
    >
      {cohorts.length === 0 ? (
        <p className="px-5 py-8 text-center text-[14px] text-text-muted">Belum ada pendaftaran di rentang ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] border-separate border-spacing-[3px] px-2 py-2 text-[13px] sm:px-3">
            <caption className="sr-only">Retensi kohort mingguan dalam persen</caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-[1] bg-white px-2 py-1 text-left text-[12px] font-semibold text-text-muted">
                  Minggu daftar
                </th>
                <th scope="col" className="px-2 py-1 text-right text-[12px] font-semibold text-text-muted">
                  Bisnis
                </th>
                {Array.from({ length: 9 }, (_, i) => (
                  <th key={i} scope="col" className="w-[9%] px-1 py-1 text-center text-[12px] font-semibold text-text-muted">
                    <abbr title={`Minggu ke-${i} sejak daftar`} className="no-underline">
                      M{i}
                    </abbr>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cohorts.map((c) => (
                <tr key={c.week}>
                  <th scope="row" className="sticky left-0 z-[1] whitespace-nowrap bg-white px-2 py-1 text-left font-medium text-text-heading">
                    {shortDay(c.week)}
                  </th>
                  <td className="px-2 py-1 text-right tabular-nums text-text-body">{c.size}</td>
                  {c.retention.map((v, i) =>
                    v === null ? (
                      <td key={i} className="rounded-[6px] bg-bg-muted/60" aria-label="belum lewat" />
                    ) : (
                      <td
                        key={i}
                        className="h-9 rounded-[6px] text-center font-semibold tabular-nums"
                        style={cellStyle(v)}
                        title={`Kohort ${longDay(c.week)} · minggu ke-${i}: ${pctFmt(v)} (${Math.round(v * c.size)} dari ${c.size} bisnis)`}
                      >
                        {pctFmt(v)}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="border-t border-border-subtle px-4 py-2.5 text-[12px] text-text-muted sm:px-5">
        M0 = minggu daftar. Sel abu-abu = minggu itu belum lewat. Kohort kecil (≤ 3 bisnis) mudah berayun — baca bersama jumlahnya.
      </p>
    </Section>
  );
}

// ——— Jenis usaha ———

function BusinessTypes({ rows }: { rows: Metrics["business_types"] }) {
  const max = Math.max(1, ...rows.map((r) => r.total));
  return (
    <Section title="Jenis usaha" description="Semua bisnis yang belum dihapus; aktif = 30 hari terakhir." bodyClass="">
      <table className="w-full text-[14px]">
        <thead>
          <tr>
            <th scope="col" className={thClass}>Jenis</th>
            <th scope="col" className={`${thClass} text-right`}>Total</th>
            <th scope="col" className={`${thClass} hidden w-[40%] sm:table-cell`}>
              <span className="sr-only">Proporsi</span>
            </th>
            <th scope="col" className={`${thClass} text-right`}>Aktif</th>
            <th scope="col" className={`${thClass} text-right`}>Pro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {[...rows]
            .sort((a, b) => b.total - a.total)
            .map((r) => (
              <tr key={r.type}>
                <td className={`${tdClass} py-2.5 font-medium text-text-heading`}>
                  <Link href={`/admin/bisnis?type=${r.type}`} className={`hover:text-brand-ink ${focusRing}`}>
                    {labelOf(BUSINESS_TYPES, r.type)}
                  </Link>
                </td>
                <td className={`${tdClass} text-right font-semibold tabular-nums`}>{r.total}</td>
                <td className={`${tdClass} hidden sm:table-cell`}>
                  <div className="relative h-3 w-full overflow-hidden rounded-full bg-bg-muted" aria-hidden title={`Aktif ${r.active} · Pro ${r.pro} dari ${r.total}`}>
                    <div className="absolute inset-y-0 left-0 rounded-full bg-[#f9c4a6]" style={{ width: `${(r.total / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full bg-brand-primary" style={{ width: `${(r.active / max) * 100}%` }} />
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.pro / max) * 100}%`, background: PLAN_COLORS.active }} />
                  </div>
                </td>
                <td className={`${tdClass} text-right tabular-nums text-text-body`}>
                  {r.active}
                  <span className="ml-1 text-[12px] text-text-muted">{r.total ? pctFmt(r.active / r.total) : ""}</span>
                </td>
                <td className={`${tdClass} text-right tabular-nums text-text-body`}>
                  {r.pro}
                  <span className="ml-1 text-[12px] text-text-muted">{r.total ? pctFmt(r.pro / r.total) : ""}</span>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
      <div className="hidden border-t border-border-subtle px-5 py-2.5 sm:block">
        <Legend
          items={[
            { label: "Total", color: "#f9c4a6" },
            { label: "Aktif 30 hari", color: MAIN },
            { label: "Pro", color: PLAN_COLORS.active },
          ]}
        />
      </div>
    </Section>
  );
}
