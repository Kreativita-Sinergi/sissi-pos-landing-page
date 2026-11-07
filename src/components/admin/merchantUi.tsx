"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import React, { useState } from "react";
import {
  DAY_SHORT,
  heatLevel,
  peakLabel,
  slotLabel,
  type HeatCell,
  type PaymentShare,
  type SalesPeak,
  hourRange,
  type TopProduct,
} from "@/lib/admin/merchant";
import { Meter } from "./charts";
import { focusRing, formatRupiah, formatRupiahShort } from "./ui";

// Satu warna, terang ke gelap (peta intensitas). Indeks 0 = tanpa transaksi.
const HEAT_RAMP = ["#f3f6f5", "#fde3d3", "#fac0a0", "#f59766", "#e36a28", "#a8450f"];
const DOWS = [1, 2, 3, 4, 5, 6, 7];

export function GroupHeading({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-text-muted">{title}</h2>
      {href && (
        <Link href={href} className={`inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}>
          {linkLabel} <ArrowRight size={14} aria-hidden />
        </Link>
      )}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-[9px] bg-bg-muted p-0.5 text-[12.5px] font-semibold">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={`rounded-[7px] px-2.5 py-1 ${o.value === value ? "bg-white text-text-heading shadow-sm" : "text-text-muted hover:text-text-heading"} ${focusRing}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function OnlinePill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-success-tint px-2 py-0.5 text-[12px] font-semibold text-success">
      <span aria-hidden className="h-[7px] w-[7px] rounded-full bg-success" />
      {children}
    </span>
  );
}

export type HeatMetric = "count" | "value";

export function SalesHeatmap({
  cells,
  peak,
  metric,
  emptyNote,
}: {
  cells: HeatCell[];
  peak: SalesPeak | null;
  metric: HeatMetric;
  emptyNote: string;
}) {
  const [active, setActive] = useState<HeatCell | null>(null);
  const byKey = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c]));
  const max = cells.reduce((m, c) => Math.max(m, c[metric]), 0);
  const hours = hourRange(cells);
  const describe = (c: HeatCell) =>
    `${slotLabel(c.dow, c.hour)} · ${c.count.toLocaleString("id-ID")} transaksi · ${formatRupiah(c.value)}`;

  if (cells.length === 0) return <p className="py-6 text-center text-[14px] text-text-muted">{emptyNote}</p>;

  return (
    <div>
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed border-separate border-spacing-[2px]" onMouseLeave={() => setActive(null)}>
          <caption className="sr-only">Transaksi per hari dan jam, zona Asia/Jakarta</caption>
          <thead>
            <tr>
              <td className="w-9" />
              {hours.map((h) => (
                <th key={h} scope="col" className="pb-1 text-left text-[11px] font-normal tabular-nums text-text-muted">
                  {String(h).padStart(2, "0")}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DOWS.map((dow) => (
              <tr key={dow}>
                <th scope="row" className="pr-1 text-left text-[12px] font-normal text-text-muted">
                  {DAY_SHORT[dow - 1]}
                </th>
                {hours.map((hour) => {
                  const c = byKey.get(`${dow}-${hour}`);
                  const level = c ? heatLevel(c[metric], c.count, max) : 0;
                  return (
                    <td
                      key={hour}
                      tabIndex={c ? 0 : undefined}
                      title={c ? describe(c) : `${slotLabel(dow, hour)} · tidak ada transaksi`}
                      onMouseEnter={() => setActive(c ?? null)}
                      onFocus={() => setActive(c ?? null)}
                      onBlur={() => setActive(null)}
                      style={{ backgroundColor: HEAT_RAMP[level] }}
                      className={`h-6 rounded-[3px] ${c ? `hover:outline-2 hover:outline-brand-dark ${focusRing}` : ""}`}
                    >
                      {c && <span className="sr-only">{describe(c)}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[12.5px] text-text-muted">
        <p aria-live="polite">
          {active ? (
            <span className="font-semibold text-text-heading">{describe(active)}</span>
          ) : (
            <>
              Paling ramai:{" "}
              <span className="font-semibold text-text-heading">
                {peakLabel(peak)}
                {peak ? ` · ${peak.count.toLocaleString("id-ID")} transaksi` : ""}
              </span>
            </>
          )}
        </p>
        <p className="flex items-center gap-1.5" aria-hidden>
          Sepi
          <span className="flex gap-0.5">
            {HEAT_RAMP.slice(1).map((c) => (
              <span key={c} className="h-2.5 w-4 rounded-[2px]" style={{ backgroundColor: c }} />
            ))}
          </span>
          Ramai
        </p>
      </div>
    </div>
  );
}

const SALE_PAYMENT_METHODS: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  card: "Kartu",
  transfer: "Transfer",
  credit: "Kasbon",
  split: "Campuran",
};

export function TopProductsList({ items }: { items: TopProduct[] }) {
  if (items.length === 0) return <p className="py-6 text-center text-[14px] text-text-muted">Belum ada produk terjual.</p>;
  return (
    <ol>
      {items.map((p, i) => (
        <li key={p.name} className="flex items-baseline gap-2 border-b border-border-subtle py-2 text-[14px] last:border-b-0">
          <span className="w-4 shrink-0 text-right text-[12px] tabular-nums text-text-muted">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-text-heading" title={p.name}>{p.name}</span>
          <span className="shrink-0 text-[12.5px] tabular-nums text-text-muted" aria-label={`${p.quantity} terjual`}>
            {p.quantity.toLocaleString("id-ID")}×
          </span>
          <span className="w-[62px] shrink-0 text-right tabular-nums text-text-body">{formatRupiahShort(p.value)}</span>
        </li>
      ))}
    </ol>
  );
}

export function PaymentMethodList({ items }: { items: PaymentShare[] }) {
  if (items.length === 0) return <p className="py-6 text-center text-[14px] text-text-muted">Belum ada pembayaran.</p>;
  return (
    <ul className="flex flex-col gap-3.5">
      {items.map((m) => (
        <li key={m.method}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[14px]">
            <span className="font-medium text-text-heading">{SALE_PAYMENT_METHODS[m.method] ?? m.method}</span>
            <span className="tabular-nums text-text-body">
              {formatRupiahShort(m.value)} · {(m.share * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
            </span>
          </div>
          <Meter value={Math.max(0, m.share)} max={1} tone="brand" />
        </li>
      ))}
    </ul>
  );
}
