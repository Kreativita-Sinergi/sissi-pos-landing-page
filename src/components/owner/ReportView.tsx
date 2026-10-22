"use client";

import React from "react";
import { Info, Package } from "lucide-react";
import { Legend, Meter, StackBar, TimeChart, type ChartRow } from "@/components/admin/charts";
import { compactRange, FilterBar } from "@/components/admin/FilterMenu";
import {
  cardClass,
  EmptyState,
  ErrorBlock,
  formatRupiah,
  formatRupiahShort,
  LoadingBar,
  PageHeader,
  Section,
  Skeleton,
  StatCard,
  tdClass,
  thClass,
  useLoad,
} from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { downloadCsv, slug } from "@/lib/owner/csv";
import type { SalesReport } from "@/lib/owner/types";
import { hourLabel, labelOf, METHOD_COLORS, METHODS, orderTypeLabel, WEEKDAYS, WEEKDAYS_SHORT } from "./labels";
import { useOwner } from "./OwnerShell";
import { Delta, ExportMenu, growthPercent, KpiSkeleton, LockedCard, PeriodFilter, periodTitle, SyncNote, usePeriod } from "./ui";

// Laporan penjualan (GET /owner/reports/sales). Periode tersimpan di URL (?from=&to=), outlet di ?outlet=.

const MAIN = "#f1702c";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const dayShort = (d: string) => `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

export function ReportView() {
  const { outletId, outlet, session } = useOwner();
  const period = usePeriod("7d");
  const { from, to, preset } = period;
  const { state, reload } = useLoad<SalesReport>(
    async (signal) => (await ownerApi()).salesReport({ from, to, outlet_id: outletId }, signal),
    [from, to, outletId]
  );
  const r = state.data;
  const scope = outlet?.name ?? (session.outlets.length > 1 ? "semua-outlet" : session.business.name);
  const fileBase = `${slug(session.business.name)}-${slug(scope)}-${from}_${to}`;
  const locked = r?.locked.includes("insights") ?? false;

  const exportItems = [
    {
      label: r?.hourly ? "Ringkasan per jam" : "Ringkasan harian",
      hint: "Penjualan & jumlah transaksi",
      disabled: !r,
      onSelect: () =>
        r &&
        downloadCsv(
          `${fileBase}-ringkasan.csv`,
          [r.hourly ? "jam" : "tanggal", "omzet", "transaksi"],
          r.buckets.map((b) => [b.start.replace("T", " "), b.revenue, b.count])
        ),
    },
    {
      label: "Produk terlaris",
      hint: locked ? "Fitur Pro" : "Hingga 100 produk teratas",
      disabled: !r?.products,
      onSelect: () =>
        r?.products &&
        downloadCsv(
          `${fileBase}-produk.csv`,
          ["peringkat", "produk", "varian", "item_cepat", "jumlah", "omzet"],
          r.products.map((p, i) => [i + 1, p.name, p.variant_name ?? "", p.is_custom ? "ya" : "tidak", p.quantity, p.revenue])
        ),
    },
    {
      label: "Per kasir",
      hint: "Transaksi, penjualan, pembatalan",
      disabled: !r,
      onSelect: () =>
        r &&
        downloadCsv(
          `${fileBase}-kasir.csv`,
          ["kasir", "transaksi", "omzet", "rata_rata", "dibatalkan"],
          r.cashiers.map((c) => [c.name, c.count, c.revenue, c.average, c.cancelled])
        ),
    },
  ];

  return (
    <>
      <PageHeader title="Laporan penjualan" description="Angka sama dengan layar Laporan di aplikasi. Dibandingkan dengan periode sepanjang tepat sebelumnya." actions={<ExportMenu items={exportItems} />} />

      <FilterBar>
        <PeriodFilter from={from} to={to} preset={preset} onChange={period.setPeriod} />
      </FilterBar>

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!r && state.status === "loading" && <ReportSkeleton />}
      {r && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div className={`flex flex-col gap-5 transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`} aria-busy={state.status === "loading"}>
            <ReportBody r={r} title={periodTitle(from, to, preset)} />
          </div>
        </>
      )}
    </>
  );
}

export function ReportSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <KpiSkeleton />
      <div className={`${cardClass} p-5`}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-[200px] w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <Skeleton className="h-64 w-full rounded-[14px]" />
        <Skeleton className="h-64 w-full rounded-[14px]" />
      </div>
    </div>
  );
}

function ReportBody({ r, title }: { r: SalesReport; title: string }) {
  const prevLabel = `vs ${compactRange(r.previous.from, r.previous.to)}`;
  const prevAvg = r.previous.transactions ? Math.round(r.previous.revenue / r.previous.transactions) : 0;
  const locked = r.locked.includes("insights");
  const empty = r.transactions === 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={`Penjualan · ${title.toLowerCase()}`}
          value={formatRupiah(r.revenue)}
          hint={
            <span className="flex flex-col gap-0.5">
              <Delta pct={r.growth_percent} label={prevLabel} />
              <span>sebelumnya {formatRupiah(r.previous.revenue)}</span>
            </span>
          }
        />
        <StatCard label="Transaksi" value={r.transactions} hint={<Delta pct={growthPercent(r.transactions, r.previous.transactions)} label={prevLabel} />} />
        <StatCard label="Rata-rata per transaksi" value={formatRupiah(r.average)} hint={<Delta pct={growthPercent(r.average, prevAvg)} label={prevLabel} />} />
        <StatCard
          label="Laba kotor"
          value={r.gross_profit === null ? "—" : formatRupiah(r.gross_profit)}
          hint={r.gross_profit === null ? "Isi harga modal produk di aplikasi agar laba terhitung." : `${r.items_sold.toLocaleString("id-ID")} item terjual`}
        />
      </div>

      <Section title={r.hourly ? "Penjualan per jam" : "Penjualan per hari"} description={empty ? undefined : `Total ${formatRupiah(r.revenue)} dari ${r.transactions.toLocaleString("id-ID")} transaksi`}>
        <BucketChart r={r} />
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Breakdown r={r} />
        <Methods r={r} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Cashiers r={r} />
        <OrderTypes r={r} />
      </div>

      {locked || !r.products ? (
        <LockedCard title="Produk terlaris">
          Lihat hingga 100 produk paling laku beserta jumlah & penjualannya, dan ekspor ke CSV.
        </LockedCard>
      ) : (
        <Products r={r} />
      )}

      {locked || !r.per_hour || !r.per_weekday ? (
        <LockedCard title="Jam & hari ramai">
          Ketahui jam dan hari paling ramai untuk mengatur jadwal karyawan dan stok.
        </LockedCard>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <PeakHours perHour={r.per_hour} peak={r.peak_hour} />
          <PeakDays perWeekday={r.per_weekday} peak={r.peak_weekday} />
        </div>
      )}

      <SyncNote />
    </>
  );
}

function BucketChart({ r }: { r: SalesReport }) {
  const rows: ChartRow[] = r.buckets.map((b) => {
    const hour = r.hourly ? Number(b.start.slice(11, 13)) : 0;
    return {
      key: b.start,
      label: r.hourly ? b.start.slice(11, 13) : dayShort(b.start),
      title: r.hourly ? `${hourLabel(hour)}–${hourLabel((hour + 1) % 24)}` : `${WEEKDAYS[(new Date(`${b.start}T00:00:00Z`).getUTCDay() + 6) % 7]}, ${dayShort(b.start)}`,
      values: [b.revenue],
      notes: [`${b.count.toLocaleString("id-ID")} transaksi`],
    };
  });
  return (
    <TimeChart
      rows={rows}
      series={[{ id: "rev", label: "Penjualan", color: MAIN }]}
      kind={!r.hourly && rows.length > 45 ? "line" : "bar"}
      format={formatRupiah}
      axisFormat={formatRupiahShort}
      height={200}
      label={`Grafik penjualan ${r.hourly ? "per jam" : "per hari"}, total ${formatRupiah(r.revenue)}`}
      emptyNote={r.transactions === 0 ? "Belum ada transaksi pada periode ini." : undefined}
    />
  );
}

function Row({ label, value, strong, note, negative }: { label: string; value: string; strong?: boolean; note?: React.ReactNode; negative?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? "font-semibold text-text-heading" : "text-text-body"}`}>
      <dt className="min-w-0">
        {label}
        {note && <span className="block text-[12.5px] font-normal text-text-muted">{note}</span>}
      </dt>
      <dd className={`shrink-0 tabular-nums ${negative ? "text-danger" : ""}`}>{value}</dd>
    </div>
  );
}

function Breakdown({ r }: { r: SalesReport }) {
  return (
    <Section title="Rincian">
      <dl className="divide-y divide-border-subtle text-[14px]">
        <Row label="Penjualan (total transaksi)" value={formatRupiah(r.revenue)} strong note="Termasuk pajak & biaya layanan" />
        <Row label="Diskon" value={r.discounts ? `-${formatRupiah(r.discounts)}` : formatRupiah(0)} negative={r.discounts > 0} note="Diskon nota + diskon per item" />
        <Row label="Pajak" value={formatRupiah(r.tax)} />
        <Row label="Biaya layanan" value={formatRupiah(r.service_fee)} />
        <Row label="Pembulatan" value={formatRupiah(r.rounding)} />
        <Row label="Pendapatan bersih" value={formatRupiah(r.net_items)} strong note="Penjualan item setelah diskon, tanpa pajak & biaya layanan" />
        <Row label="Modal (HPP)" value={formatRupiah(r.cost)} />
        <Row
          label="Laba kotor"
          value={r.gross_profit === null ? "—" : formatRupiah(r.gross_profit)}
          strong
          note={
            r.items_without_cost > 0
              ? r.gross_profit === null
                ? "Belum ada harga modal. Isi harga modal produk di aplikasi."
                : `${r.items_without_cost.toLocaleString("id-ID")} baris item tanpa harga modal tidak ikut dihitung.`
              : undefined
          }
        />
        <Row label="Item terjual" value={r.items_sold.toLocaleString("id-ID")} />
        <Row label="Dibatalkan" value={`${r.cancelled.count.toLocaleString("id-ID")} · ${formatRupiah(r.cancelled.amount)}`} note="Tidak termasuk penjualan" />
        <Row label="Piutang kasbon (semua tanggal)" value={formatRupiah(r.credit.outstanding)} note={`${r.credit.count.toLocaleString("id-ID")} transaksi belum lunas`} />
      </dl>
    </Section>
  );
}

function Methods({ r }: { r: SalesReport }) {
  const positive = r.per_method.filter((m) => m.amount > 0);
  const total = positive.reduce((a, m) => a + m.amount, 0);
  return (
    <Section title="Per metode bayar" description="Dari pembayaran yang diterima pada periode ini (termasuk pengembalian)">
      {r.per_method.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-text-muted">Belum ada pembayaran.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <StackBar label="Bagian metode bayar" parts={positive.map((m) => ({ label: labelOf(METHODS, m.method), value: m.amount, color: METHOD_COLORS[m.method] ?? "#7d8986" }))} />
          <Legend items={positive.map((m) => ({ label: labelOf(METHODS, m.method), color: METHOD_COLORS[m.method] ?? "#7d8986" }))} />
          <ul className="divide-y divide-border-subtle text-[14px]">
            {r.per_method.map((m) => (
              <li key={m.method} className="flex items-center justify-between gap-3 py-2">
                <span className="inline-flex items-center gap-2">
                  <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: METHOD_COLORS[m.method] ?? "#7d8986" }} />
                  {labelOf(METHODS, m.method)}
                </span>
                <span className="text-right tabular-nums">
                  <span className={`font-semibold ${m.amount < 0 ? "text-danger" : ""}`}>{formatRupiah(m.amount)}</span>
                  {total > 0 && m.amount > 0 && <span className="ml-2 text-[12.5px] text-text-muted">{Math.round((m.amount / total) * 100)}%</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function Cashiers({ r }: { r: SalesReport }) {
  const max = Math.max(1, ...r.cashiers.map((c) => c.revenue));
  return (
    <Section title="Per kasir" bodyClass="p-0">
      {r.cashiers.length === 0 ? (
        <p className="px-5 py-6 text-center text-[14px] text-text-muted">Belum ada transaksi.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-[14px]">
            <thead>
              <tr>
                <th scope="col" className={thClass}>Kasir</th>
                <th scope="col" className={`${thClass} text-right`}>Transaksi</th>
                <th scope="col" className={`${thClass} text-right`}>Penjualan</th>
                <th scope="col" className={`${thClass} hidden text-right sm:table-cell`}>Rata-rata</th>
                <th scope="col" className={`${thClass} hidden text-right sm:table-cell`}>Batal</th>
              </tr>
            </thead>
            <tbody>
              {r.cashiers.map((c) => (
                <tr key={c.cashier_id}>
                  <td className={`${tdClass} border-b border-border-subtle`}>
                    <span className="block font-medium">{c.name}</span>
                    <span className="mt-1 block w-28 sm:w-40">
                      <Meter value={c.revenue} max={max} tone="brand" />
                    </span>
                  </td>
                  <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums`}>{c.count.toLocaleString("id-ID")}</td>
                  <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums whitespace-nowrap`}>{formatRupiah(c.revenue)}</td>
                  <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums whitespace-nowrap sm:table-cell`}>{formatRupiah(c.average)}</td>
                  <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums sm:table-cell ${c.cancelled ? "text-danger" : "text-text-muted"}`}>{c.cancelled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function OrderTypes({ r }: { r: SalesReport }) {
  const max = Math.max(1, ...r.order_types.map((o) => o.revenue));
  return (
    <Section title="Per jenis pesanan">
      {r.order_types.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-text-muted">Belum ada transaksi.</p>
      ) : (
        <ul className="flex flex-col gap-3 text-[14px]">
          {r.order_types.map((o) => (
            <li key={o.order_type ?? "none"}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="font-medium">{orderTypeLabel(o.order_type)}</span>
                <span className="tabular-nums">
                  <span className="font-semibold">{formatRupiah(o.revenue)}</span>
                  <span className="ml-2 text-[12.5px] text-text-muted">{o.count.toLocaleString("id-ID")} trx</span>
                </span>
              </div>
              <Meter value={o.revenue} max={max} tone="neutral" />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Products({ r }: { r: SalesReport }) {
  const products = r.products ?? [];
  return (
    <Section
      title="Produk terlaris"
      description={r.products_total !== null && r.products_total > products.length ? `${products.length} teratas dari ${r.products_total.toLocaleString("id-ID")} produk` : undefined}
      bodyClass="p-0"
    >
      {products.length === 0 ? (
        <EmptyState icon={<Package size={22} aria-hidden />} title="Belum ada produk terjual">
          Pilih periode lain atau tunggu perangkat sinkron.
        </EmptyState>
      ) : (
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full border-separate border-spacing-0 text-[14px]">
            <thead>
              <tr>
                <th scope="col" className={`${thClass} w-10`}>#</th>
                <th scope="col" className={thClass}>Produk</th>
                <th scope="col" className={`${thClass} text-right`}>Jumlah</th>
                <th scope="col" className={`${thClass} text-right`}>Penjualan</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.key}>
                  <td className={`${tdClass} border-b border-border-subtle tabular-nums text-text-muted`}>{i + 1}</td>
                  <td className={`${tdClass} border-b border-border-subtle`}>
                    <span className="font-medium">{p.name}</span>
                    {p.variant_name && <span className="text-text-muted"> · {p.variant_name}</span>}
                    {p.is_custom && <span className="ml-1.5 rounded-full bg-bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-text-muted">item cepat</span>}
                  </td>
                  <td className={`${tdClass} border-b border-border-subtle text-right tabular-nums`}>{p.quantity.toLocaleString("id-ID")}</td>
                  <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums whitespace-nowrap`}>{formatRupiah(p.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="flex items-center gap-1.5 border-t border-border-subtle px-4 py-2.5 text-[12.5px] text-text-muted sm:px-5">
        <Info size={13} aria-hidden /> Penjualan produk = subtotal baris setelah diskon item, sebelum diskon nota & pajak.
      </p>
    </Section>
  );
}

function PeakHours({ perHour, peak }: { perHour: number[]; peak: number | null }) {
  const max = Math.max(1, ...perHour);
  const total = perHour.reduce((a, b) => a + b, 0);
  return (
    <Section title="Jam ramai" description={peak !== null ? `Paling ramai pukul ${hourLabel(peak)}–${hourLabel((peak + 1) % 24)}` : "Belum ada transaksi"}>
      <div role="img" aria-label={`Jumlah transaksi per jam, total ${total}. ${peak !== null ? `Puncak pukul ${hourLabel(peak)}.` : ""}`}>
        <div className="flex h-[120px] items-end gap-[2px]" aria-hidden>
          {perHour.map((v, h) => (
            <div key={h} className="flex h-full min-w-0 flex-1 items-end" title={`${hourLabel(h)}: ${v.toLocaleString("id-ID")} transaksi`}>
              <div
                className={`w-full rounded-t-[3px] ${v === 0 ? "bg-border-subtle" : h === peak ? "bg-brand-primary" : "bg-text-muted/50"}`}
                style={{ height: v === 0 ? 2 : Math.max(4, (v / max) * 120) }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-text-muted" aria-hidden>
          {[0, 6, 12, 18, 23].map((h) => (
            <span key={h}>{String(h).padStart(2, "0")}</span>
          ))}
        </div>
      </div>
    </Section>
  );
}

function PeakDays({ perWeekday, peak }: { perWeekday: number[]; peak: number | null }) {
  const max = Math.max(1, ...perWeekday);
  return (
    <Section title="Hari ramai" description={peak !== null ? `Paling ramai hari ${WEEKDAYS[peak]}` : "Belum ada transaksi"}>
      <ul className="flex flex-col gap-2 text-[13.5px]">
        {perWeekday.map((v, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className={`w-9 shrink-0 ${i === peak ? "font-semibold text-text-heading" : "text-text-body"}`}>{WEEKDAYS_SHORT[i]}</span>
            <span className="min-w-0 flex-1">
              <Meter value={v} max={max} tone={i === peak ? "brand" : "neutral"} />
            </span>
            <span className="w-12 shrink-0 text-right tabular-nums">{v.toLocaleString("id-ID")}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-text-muted">Jumlah transaksi per hari dalam periode ini.</p>
    </Section>
  );
}
