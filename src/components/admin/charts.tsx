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

// ——— Tahap 3: grafik waktu (garis / batang / batang bertumpuk) ———

export type ChartSeries = { id: string; label: string; color: string };
export type ChartRow = {
  key: string;
  /** Label sumbu (pendek). */
  label: string;
  /** Judul tooltip (lengkap). */
  title: string;
  /** Ember belum lengkap (awal/akhir rentang atau masih berjalan). */
  partial?: boolean;
  /** Satu nilai per seri; null = tidak ada data (grafik putus, bukan nol). */
  values: (number | null)[];
  /** Baris tambahan di tooltip. */
  notes?: string[];
};

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * pow >= v) return m * pow;
  return 10 * pow;
}

function useWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [w, setW] = useState(0);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * Grafik waktu SVG: `line` (satu seri, area tipis) atau `bar` (bertumpuk bila > 1 seri).
 * Tooltip saat diarahkan/disentuh; panah kiri/kanan saat grafik difokus. Satu sumbu Y saja.
 */
export function TimeChart({
  rows,
  series,
  kind,
  format,
  axisFormat,
  height = 180,
  label,
  emptyNote,
  integer = false,
}: {
  rows: ChartRow[];
  series: ChartSeries[];
  kind: "line" | "bar";
  format: (v: number) => string;
  axisFormat?: (v: number) => string;
  height?: number;
  label: string;
  emptyNote?: string;
  /** Nilai bilangan bulat (jumlah) → garis bantu hanya di angka bulat. */
  integer?: boolean;
}) {
  const [wrapRef, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const padR = 8;
  const padT = 10;
  const padB = 24;
  const innerH = height - padT - padB;
  const totals = rows.map((r) => (r.values.every((v) => v === null) ? null : r.values.reduce<number>((a, v) => a + (v ?? 0), 0)));
  const rawMax = niceMax(Math.max(0, ...totals.map((v) => v ?? 0)));
  const max = integer ? Math.max(2, Math.ceil(rawMax / 2) * 2) : rawMax;
  const fmtAxis = axisFormat ?? format;
  // Lebar kolom label sumbu Y mengikuti label terpanjang (mis. "Rp1,5 jt").
  const padL = Math.max(28, Math.ceil(Math.max(...[0, max / 2, max].map((v) => fmtAxis(v).length)) * 6.4) + 12);
  const innerW = Math.max(10, width - padL - padR);
  const n = rows.length;
  const step = n > 0 ? innerW / n : innerW;
  const xMid = (i: number) => padL + step * i + step / 2;
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const allNull = totals.every((v) => v === null);

  // Label sumbu X: sebanyak yang muat (±64px per label), selalu termasuk yang terakhir.
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 64))));
  const showX = (i: number) => (n - 1 - i) % every === 0;

  const pick = (clientX: number) => {
    const el = wrapRef.current;
    if (!el || n === 0) return;
    const x = clientX - el.getBoundingClientRect().left - padL;
    setHover(Math.max(0, Math.min(n - 1, Math.floor(x / step))));
  };

  const active = hover !== null ? rows[hover] : null;
  const tipLeft = hover !== null ? Math.max(4, Math.min(width - 196, xMid(hover) - 96)) : 0;
  const barW = Math.max(2, Math.min(28, step - (step > 8 ? 4 : 2)));

  // Garis: potong per null agar grafik putus.
  const segments: { i: number; v: number }[][] = [];
  if (kind === "line") {
    let cur: { i: number; v: number }[] = [];
    rows.forEach((r, i) => {
      const v = r.values[0];
      if (v === null) {
        if (cur.length) segments.push(cur);
        cur = [];
      } else cur.push({ i, v });
    });
    if (cur.length) segments.push(cur);
  }

  return (
    <div ref={wrapRef} className="relative select-none" onPointerLeave={() => setHover(null)}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={label}
          tabIndex={0}
          className={`block touch-pan-y outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary`}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onFocus={() => setHover((h) => h ?? n - 1)}
          onBlur={() => setHover(null)}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? n) - 1));
            else if (e.key === "ArrowRight") setHover((h) => Math.min(n - 1, (h ?? -1) + 1));
            else if (e.key === "Escape") setHover(null);
            else return;
            e.preventDefault();
          }}
        >
          {ticks.map((tv) => (
            <g key={tv}>
              <line x1={padL} x2={width - padR} y1={y(tv)} y2={y(tv)} className={tv === 0 ? "stroke-border-active" : "stroke-border-subtle"} strokeDasharray={tv === 0 ? undefined : "3 3"} />
              <text x={padL - 6} y={y(tv)} dy="0.32em" textAnchor="end" className="fill-text-muted text-[11px] tabular-nums">
                {fmtAxis(tv)}
              </text>
            </g>
          ))}
          {rows.map((r, i) =>
            showX(i) ? (
              <text key={r.key} x={xMid(i)} y={height - 6} textAnchor={i === n - 1 && n > 3 ? "end" : "middle"} dx={i === n - 1 && n > 3 ? step / 2 : 0} className="fill-text-muted text-[11px]">
                {r.label}
              </text>
            ) : null
          )}
          {hover !== null && (
            <rect x={padL + step * hover} y={padT} width={step} height={innerH} className="fill-bg-muted" />
          )}
          {kind === "bar" &&
            rows.map((r, i) => {
              let acc = 0;
              const segs = r.values.map((v, k) => {
                if (v === null || v <= 0) return null;
                const below = acc;
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                // Celah 2px antarsegmen bertumpuk; segmen atas berujung membulat.
                const h = Math.max(1, y0 - y1 - (below > 0 ? 2 : 0));
                const top = r.values.slice(k + 1).every((x) => !x);
                return (
                  <rect
                    key={k}
                    x={xMid(i) - barW / 2}
                    y={y1}
                    width={barW}
                    height={h}
                    rx={top ? Math.min(3, barW / 2) : 0}
                    fill={series[k].color}
                    opacity={r.partial ? 0.45 : hover === null || hover === i ? 1 : 0.75}
                  />
                );
              });
              return <g key={r.key}>{segs}</g>;
            })}
          {kind === "line" && (
            <>
              {segments.map((seg, si) => {
                const d = seg.map((p, k) => `${k ? "L" : "M"}${xMid(p.i)},${y(p.v)}`).join("");
                const area = `${d}L${xMid(seg[seg.length - 1].i)},${y(0)}L${xMid(seg[0].i)},${y(0)}Z`;
                return (
                  <g key={si}>
                    <path d={area} fill={series[0].color} opacity={0.08} />
                    <path d={d} fill="none" stroke={series[0].color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                    {seg.length === 1 && <circle cx={xMid(seg[0].i)} cy={y(seg[0].v)} r={3} fill={series[0].color} />}
                  </g>
                );
              })}
              {hover !== null && rows[hover].values[0] !== null && (
                <circle cx={xMid(hover)} cy={y(rows[hover].values[0]!)} r={4.5} fill={series[0].color} stroke="white" strokeWidth={2} />
              )}
            </>
          )}
        </svg>
      )}
      {width === 0 && <div style={{ height }} />}
      {allNull && emptyNote && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-center text-[13px] text-text-muted">{emptyNote}</p>
      )}
      {active && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 w-[192px] rounded-[10px] border border-border-subtle bg-white px-3 py-2 text-[12.5px] shadow-[0_8px_24px_-6px_rgba(16,24,40,0.18)]"
          style={{ left: tipLeft, transform: "translateY(-6px)" }}
        >
          <p className="font-semibold text-text-heading">
            {active.title}
            {active.partial && <span className="font-normal text-text-muted"> · sebagian</span>}
          </p>
          <ul className="mt-1 space-y-0.5">
            {series.map((s, k) => (
              <li key={s.id} className="flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate text-text-body">{s.label}</span>
                <span className="font-semibold tabular-nums text-text-heading">
                  {active.values[k] === null ? "—" : format(active.values[k]!)}
                </span>
              </li>
            ))}
          </ul>
          {active.notes?.map((t) => (
            <p key={t} className="mt-0.5 text-text-muted">
              {t}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Legenda kecil (titik warna + label + nilai opsional). */
export function Legend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-text-body">
      {items.map((i) => (
        <li key={i.label} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
          {i.value && <strong className="font-semibold tabular-nums text-text-heading">{i.value}</strong>}
        </li>
      ))}
    </ul>
  );
}

/** Satu batang horizontal bertumpuk (proporsi), dengan celah 2px antarsegmen dan tooltip per segmen. */
export function StackBar({ parts, label }: { parts: { label: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  return (
    <div role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${p.value}`).join(", ")}`} className="flex h-4 w-full gap-[2px] overflow-hidden rounded-full bg-bg-muted">
      {total > 0 &&
        parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span
              key={p.label}
              title={`${p.label}: ${p.value.toLocaleString("id-ID")} (${Math.round((p.value / total) * 100)}%)`}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(p.value / total) * 100}%`, background: p.color, minWidth: 3 }}
            />
          ))}
    </div>
  );
}
