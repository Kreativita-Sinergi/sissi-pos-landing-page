"use client";

import React, { useState } from "react";
import { formatDay } from "./filters";

// Grafik kecil buatan sendiri (SVG/CSS) — tanpa pustaka grafik. Satu seri, warna dari token,
// teks memakai warna teks (bukan warna seri), batang dengan ujung membulat & celah 2px.

/** Batang mini 14 hari (indeks 0 = 13 hari lalu, terakhir = hari ini). */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const bw = 4;
  const gap = 2;
  const h = 22;
  const w = values.length * (bw + gap) - gap;
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${label}: ${total} kejadian 14 hari`} className="shrink-0 overflow-visible">
      {values.map((v, i) => {
        const bh = v === 0 ? 1.5 : Math.max(3, (v / max) * h);
        const last = i === values.length - 1;
        return (
          <rect
            key={i}
            x={i * (bw + gap)}
            y={h - bh}
            width={bw}
            height={bh}
            rx={1.5}
            className={v === 0 ? "fill-border-subtle" : last ? "fill-brand-primary" : "fill-text-muted/60"}
          >
            <title>{`${values.length - 1 - i === 0 ? "Hari ini" : `${values.length - 1 - i} hari lalu`}: ${v}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

/** Kolom harian (mis. 30 hari) dengan tooltip saat diarahkan & sumbu tanggal awal/akhir. */
export function DailyBars({ data, unit = "kejadian" }: { data: { day: string; count: number }[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.count));
  const h = 120;
  const total = data.reduce((a, b) => a + b.count, 0);
  const shown = hover !== null ? data[hover] : null;
  return (
    <figure className="m-0">
      <div className="mb-3 flex items-baseline justify-between gap-3 text-[13px]">
        <span className="text-text-muted">
          {shown ? formatDay(shown.day) : `${data.length} hari terakhir`}
        </span>
        <span className="font-semibold tabular-nums text-text-heading">
          {(shown ? shown.count : total).toLocaleString("id-ID")} {unit}
        </span>
      </div>
      <div
        className="relative flex items-end gap-[2px]"
        style={{ height: h }}
        role="img"
        aria-label={`Grafik ${data.length} hari: total ${total} ${unit}, tertinggi ${max} per hari`}
        onMouseLeave={() => setHover(null)}
      >
        <span aria-hidden className="absolute inset-x-0 top-0 border-t border-dashed border-border-subtle" />
        <span aria-hidden className="absolute top-0 left-0 -translate-y-1/2 bg-white pr-1 text-[11px] tabular-nums text-text-muted">
          {max}
        </span>
        {data.map((d, i) => (
          <div key={d.day} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className={`w-full rounded-t-[3px] transition-colors ${
                d.count === 0 ? "bg-border-subtle" : hover === i ? "bg-brand-deep" : i === data.length - 1 ? "bg-brand-primary" : "bg-text-muted/55"
              }`}
              style={{ height: d.count === 0 ? 2 : Math.max(4, (d.count / max) * h) }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-1.5 flex justify-between text-[11px] text-text-muted">
        <span>{data[0] ? formatDay(data[0].day) : ""}</span>
        <span>Hari ini</span>
      </figcaption>
    </figure>
  );
}

/** Batang horizontal sederhana (lebar relatif terhadap `max`). */
export function Meter({ value, max, tone = "neutral" }: { value: number; max: number; tone?: "neutral" | "brand" | "warning" | "danger" }) {
  const pct = max > 0 ? Math.max(value > 0 ? 2 : 0, (value / max) * 100) : 0;
  const color = { neutral: "bg-text-muted/55", brand: "bg-brand-primary", warning: "bg-[#e0a43a]", danger: "bg-danger" }[tone];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-bg-muted" aria-hidden>
      <div className={`h-full rounded-full transition-[width] duration-300 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
