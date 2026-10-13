"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, Ban, Clock, HandCoins, Package, ReceiptText, RefreshCw, Smartphone, TriangleAlert } from "lucide-react";
import { TimeChart, type ChartRow } from "@/components/admin/charts";
import {
  btn,
  cardClass,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatRupiah,
  formatRupiahShort,
  LoadingBar,
  PageHeader,
  Section,
  Skeleton,
  StatCard,
  TimeAgo,
  useLoad,
} from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { addDays } from "@/lib/owner/period";
import type { OwnerDevice, Summary, Totals } from "@/lib/owner/types";
import { zonedHour, zonedToday, zoneLabel } from "@/lib/owner/tz";
import { DEVICE_MODE_LABELS, hourLabel, labelOf, WEEKDAYS } from "./labels";
import { useOwner } from "./OwnerShell";
import { RecentSalesList } from "./parts";
import { Delta, formatDayLong, formatTime, growthPercent, KpiSkeleton, LockedCard, SyncNote } from "./ui";

// Beranda: ringkasan hari ini (GET /owner/summary). Dimuat ulang otomatis tiap 60 detik saat tab terlihat.

const STALE_MS = 24 * 3_600_000;
const MAIN = "#f1702c";

export function HomeView() {
  const { outletId, outlet, withOutlet, session } = useOwner();
  const { state, reload } = useLoad<Summary>(async (signal) => (await ownerApi()).summary({ outlet_id: outletId }, signal), [outletId]);
  const s = state.data;

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") reload();
    }, 60_000);
    return () => clearInterval(id);
  }, [reload]);

  const scope = outlet ? outlet.name : session.outlets.length > 1 ? "Semua outlet" : session.business.name;

  return (
    <>
      <PageHeader
        title="Beranda"
        description={
          s ? (
            <>
              {formatDayLong(s.date)} · {scope} · diperbarui {formatTime(s.generated_at)} {zoneLabel()}
            </>
          ) : (
            "Ringkasan penjualan hari ini."
          )
        }
        actions={
          <button type="button" className={btn.secondary} onClick={reload} disabled={state.status === "loading"}>
            <RefreshCw size={16} aria-hidden className={state.status === "loading" ? "animate-spin motion-reduce:animate-none" : ""} />
            Muat ulang
          </button>
        }
      />

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!s && state.status === "loading" && <HomeSkeleton />}
      {s && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div className="flex flex-col gap-5" aria-busy={state.status === "loading"}>
            <HomeBody s={s} withOutlet={withOutlet} multiOutlet={!outletId && session.outlets.length > 1} />
          </div>
        </>
      )}
    </>
  );
}

function HomeSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <KpiSkeleton />
      <div className={`${cardClass} p-5`}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-[180px] w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-56 w-full rounded-[14px]" />
        <Skeleton className="h-56 w-full rounded-[14px]" />
      </div>
    </div>
  );
}

function profitHint(t: Totals) {
  if (t.gross_profit === null) {
    return <span>Isi harga modal produk di aplikasi agar laba terhitung.</span>;
  }
  const margin = t.revenue > 0 ? Math.round((t.gross_profit / t.revenue) * 100) : null;
  return <span>{margin !== null ? `Margin ±${margin}% dari omzet` : "Belum ada penjualan"}</span>;
}

function HomeBody({ s, withOutlet, multiOutlet }: { s: Summary; withOutlet: (h: string) => string; multiOutlet: boolean }) {
  const lastWeekDay = WEEKDAYS[(new Date(`${s.date}T00:00:00Z`).getUTCDay() + 6) % 7];
  const insightsLocked = s.locked.includes("insights");
  const today = zonedToday();
  const salesLink = (q: string) => withOutlet(`/dasbor/transaksi?${q}`);

  return (
    <>
      {/* KPI hari ini */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Omzet hari ini"
          value={formatRupiah(s.today.revenue)}
          hint={
            <span className="flex flex-col gap-0.5">
              <Delta pct={growthPercent(s.today.revenue, s.yesterday_same_time.revenue)} label="vs kemarin, jam sama" />
              <Delta pct={growthPercent(s.today.revenue, s.last_week_same_day.revenue)} label={`vs ${lastWeekDay} lalu (sehari)`} />
            </span>
          }
        />
        <StatCard
          label="Transaksi"
          value={s.today.transactions}
          hint={
            <span className="flex flex-col gap-0.5">
              <Delta pct={growthPercent(s.today.transactions, s.yesterday_same_time.transactions)} label="vs kemarin, jam sama" />
              <span>{s.today.items_sold.toLocaleString("id-ID")} item terjual</span>
            </span>
          }
        />
        <StatCard
          label="Rata-rata per transaksi"
          value={formatRupiah(s.today.average)}
          hint={<Delta pct={growthPercent(s.today.average, s.yesterday_same_time.average)} label="vs kemarin, jam sama" />}
        />
        <StatCard
          label="Laba kotor"
          value={s.today.gross_profit === null ? "—" : formatRupiah(s.today.gross_profit)}
          hint={profitHint(s.today)}
        />
      </div>

      <Section title="Omzet per jam hari ini" description={`Kemarin sampai jam yang sama: ${formatRupiah(s.yesterday_same_time.revenue)} · kemarin sehari: ${formatRupiah(s.yesterday.revenue)}`}>
        <HourlyChart s={s} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {insightsLocked || !s.top_products ? (
          <LockedCard title="Produk terlaris hari ini" compact>
            Lihat 5 produk paling laku hari ini, plus jam & hari paling ramai di Laporan.
          </LockedCard>
        ) : (
          <Section
            title="Produk terlaris hari ini"
            actions={
              <Link href={withOutlet("/dasbor/laporan?from=" + today + "&to=" + today)} className={`text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}>
                Laporan hari ini
              </Link>
            }
            bodyClass="p-0"
          >
            {s.top_products.length === 0 ? (
              <EmptyState icon={<Package size={22} aria-hidden />} title="Belum ada produk terjual">
                Produk terlaris muncul setelah ada transaksi hari ini.
              </EmptyState>
            ) : (
              <ol className="divide-y divide-border-subtle">
                {s.top_products.map((p, i) => (
                  <li key={p.key} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                    <span className="w-5 shrink-0 text-[13px] font-semibold tabular-nums text-text-muted">{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium">{p.name}</span>
                      {p.variant_name && <span className="block truncate text-[12.5px] text-text-muted">{p.variant_name}</span>}
                    </span>
                    <span className="text-right">
                      <span className="block text-[14px] font-semibold tabular-nums">{p.quantity.toLocaleString("id-ID")}×</span>
                      <span className="block text-[12.5px] tabular-nums text-text-muted">{formatRupiah(p.revenue)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          <StatCard
            label="Pesanan berjalan (belum dibayar)"
            icon={<Clock size={14} aria-hidden />}
            value={s.open_orders.count}
            hint={s.open_orders.count ? `Nilai ${formatRupiah(s.open_orders.total)}` : "Tidak ada pesanan terbuka"}
            href={salesLink(`status=open&from=${addDays(today, -29)}&to=${today}`)}
          />
          <StatCard
            label="Piutang kasbon (semua tanggal)"
            icon={<HandCoins size={14} aria-hidden />}
            value={formatRupiah(s.credit.outstanding)}
            tone={s.credit.outstanding > 0 ? "warning" : "neutral"}
            hint={s.credit.count ? `${s.credit.count.toLocaleString("id-ID")} transaksi belum lunas` : "Semua kasbon lunas"}
            href={salesLink(`status=unpaid,partial&from=${addDays(today, -91)}&to=${today}`)}
          />
          <StatCard
            label="Dibatalkan hari ini"
            icon={<Ban size={14} aria-hidden />}
            value={s.cancelled.count}
            tone={s.cancelled.count > 0 ? "danger" : "neutral"}
            hint={s.cancelled.count ? `Nilai ${formatRupiah(s.cancelled.amount)}` : "Tidak ada pembatalan"}
            href={salesLink(`status=void,refunded&from=${today}&to=${today}`)}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section
          title="Transaksi terbaru"
          bodyClass="p-0"
          actions={
            <Link href={withOutlet("/dasbor/transaksi")} className={`inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}>
              Semua transaksi <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          {s.recent_sales.length === 0 ? (
            <EmptyState icon={<ReceiptText size={22} aria-hidden />} title="Belum ada transaksi">
              Transaksi dari aplikasi kasir muncul di sini setelah perangkat sinkron.
            </EmptyState>
          ) : (
            <RecentSalesList rows={s.recent_sales} hrefOf={(id) => withOutlet(`/dasbor/transaksi/${id}`)} showOutlet={multiOutlet} today={s.date} />
          )}
        </Section>

        <div className="flex flex-col gap-5">
          <Section
            title="Shift yang sedang buka"
            bodyClass="p-0"
            actions={
              <Link href={withOutlet("/dasbor/shift")} className={`text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}>
                Semua shift
              </Link>
            }
          >
            {s.open_shifts.length === 0 ? (
              <p className="px-4 py-5 text-[14px] text-text-muted sm:px-5">Tidak ada shift yang sedang buka.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {s.open_shifts.map((sh) => (
                  <li key={sh.id}>
                    <Link href={withOutlet(`/dasbor/shift/${sh.id}`)} className={`flex items-center gap-3 px-4 py-3 hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-semibold">{sh.cashier_name}</span>
                        <span className="block truncate text-[12.5px] text-text-muted">
                          {sh.outlet_name} · buka {formatTime(sh.opened_at)}
                          {sh.device_name ? ` · ${sh.device_name}` : ""}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[12px] text-text-muted">Kas seharusnya</span>
                        <span className="block text-[14px] font-semibold tabular-nums">{formatRupiah(sh.expected_cash)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Devices devices={s.devices} now={Date.parse(s.generated_at)} />
        </div>
      </div>

      <SyncNote />
    </>
  );
}

function HourlyChart({ s }: { s: Summary }) {
  // Jam sekarang menurut server (generated_at), bukan jam peramban.
  const nowHour = zonedHour(s.generated_at);
  const active = s.hourly.filter((h) => h.count > 0).map((h) => h.hour);
  const start = Math.min(7, ...active);
  const end = Math.max(21, ...active);
  const rows: ChartRow[] = s.hourly
    .filter((h) => h.hour >= start && h.hour <= end)
    .map((h) => ({
      key: String(h.hour),
      label: hourLabel(h.hour).slice(0, 2),
      title: `${hourLabel(h.hour)}–${hourLabel((h.hour + 1) % 24)}`,
      partial: h.hour === nowHour,
      values: [h.hour > nowHour ? null : h.revenue],
      notes: h.hour > nowHour ? undefined : [`${h.count.toLocaleString("id-ID")} transaksi`],
    }));
  return (
    <TimeChart
      rows={rows}
      series={[{ id: "rev", label: "Omzet", color: MAIN }]}
      kind="bar"
      format={formatRupiah}
      axisFormat={formatRupiahShort}
      label={`Omzet per jam hari ini, total ${formatRupiah(s.today.revenue)}`}
      emptyNote="Belum ada transaksi hari ini."
    />
  );
}

function Devices({ devices, now }: { devices: OwnerDevice[]; now: number }) {
  const stale = (d: OwnerDevice) => !d.last_seen_at || now - Date.parse(d.last_seen_at) > STALE_MS;
  const staleCount = devices.filter(stale).length;
  return (
    <Section title="Status perangkat" description="Sinkron terakhir tiap perangkat kasir" bodyClass="p-0">
      {staleCount > 0 && (
        <p role="note" className="flex items-start gap-2 border-b border-border-subtle bg-warning-tint px-4 py-2.5 text-[13px] leading-snug text-warning sm:px-5">
          <TriangleAlert size={15} aria-hidden className="mt-0.5 shrink-0" />
          {staleCount === 1 ? "1 perangkat" : `${staleCount} perangkat`} belum sinkron lebih dari 24 jam. Angka di web bisa tertinggal — sambungkan perangkat ke internet.
        </p>
      )}
      {devices.length === 0 ? (
        <p className="px-4 py-5 text-[14px] text-text-muted sm:px-5">Belum ada perangkat terdaftar.</p>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {devices.map((d) => {
            const old = stale(d);
            return (
              <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${old ? "bg-warning-tint text-warning" : "bg-success-tint text-success"}`}>
                  <Smartphone size={16} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium">{d.name}</span>
                  <span className="block truncate text-[12.5px] text-text-muted">
                    {labelOf(DEVICE_MODE_LABELS, d.mode)}
                    {d.outlet_name ? ` · ${d.outlet_name}` : ""}
                    {d.app_version ? ` · v${d.app_version}` : ""}
                  </span>
                </span>
                <span className={`text-right text-[12.5px] ${old ? "font-semibold text-warning" : "text-text-body"}`}>
                  <span className="block text-[11.5px] font-normal text-text-muted">sinkron terakhir</span>
                  <TimeAgo value={d.last_seen_at} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
