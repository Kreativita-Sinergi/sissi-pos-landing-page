"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, CloudOff, Download, Lock } from "lucide-react";
import { compactRange, FilterPopover, OptionList, PanelFooter, useFilterClose } from "@/components/admin/FilterMenu";
import { useQueryState } from "@/components/admin/filters";
import { btn, cardClass, focusRing, inputClass } from "@/components/admin/ui";
import {
  addDays,
  MAX_DAYS,
  PERIOD_LABELS,
  PERIOD_ORDER,
  presetRange,
  resolvePeriod,
  spanDays,
  type PeriodId,
} from "@/lib/owner/period";
import { zonedToday, zoneLabel } from "@/lib/owner/tz";

// Komponen bersama dasbor pemilik (di atas komponen admin generik).

// Format tanggal/jam mengikuti zona usaha aktif (lihat `@/lib/owner/tz`).
export { formatDayLong, formatTime } from "@/lib/owner/tz";

/** Label periode untuk judul: "Hari ini", "7 hari terakhir", atau "1–7 Okt". */
export function periodTitle(from: string, to: string, preset: PeriodId | null): string {
  return preset ? PERIOD_LABELS[preset] : compactRange(from, to);
}

export function growthPercent(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** Panah ▲▼ + persen dibanding pembanding. `null` (pembanding 0) → "—". */
export function Delta({ pct, label, invert = false }: { pct: number | null; label: string; invert?: boolean }) {
  if (pct === null) {
    return (
      <span className="text-text-muted">
        — <span className="sr-only">tidak ada pembanding</span> {label}
      </span>
    );
  }
  const up = pct > 0;
  const flat = pct === 0;
  const good = invert ? !up : up;
  const tone = flat ? "text-text-muted" : good ? "text-success" : "text-danger";
  return (
    <span>
      <span className={`font-semibold tabular-nums ${tone}`}>
        <span aria-hidden>{flat ? "■" : up ? "▲" : "▼"}</span>
        <span className="sr-only">{flat ? "sama" : up ? "naik" : "turun"}</span> {Math.abs(pct).toLocaleString("id-ID")}%
      </span>{" "}
      <span className="text-text-muted">{label}</span>
    </span>
  );
}

/** Kartu fitur Pro yang terkunci untuk paket Gratis. */
export function LockedCard({ title, children, compact = false }: { title: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <section className={`${cardClass} relative overflow-hidden`} aria-label={`${title} (fitur Pro)`}>
      <div className={`flex flex-col items-center text-center ${compact ? "px-5 py-7" : "px-6 py-10"}`}>
        <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
          <Lock size={20} aria-hidden />
        </span>
        <p className="text-[15px] font-semibold text-text-heading">
          {title} <span className="ml-1 rounded-full bg-brand-tint px-2 py-0.5 align-middle text-[11px] font-bold text-brand-ink">PRO</span>
        </p>
        <p className="mt-1.5 max-w-[420px] text-[13.5px] leading-relaxed text-text-body">{children}</p>
        <p className="mt-3 max-w-[420px] text-[13px] text-text-muted">
          Upgrade ke Pro di aplikasi Sissi (menu <strong className="font-semibold text-text-heading">Langganan</strong>).
        </p>
        <Link href="/harga" className={`${btn.secondary} mt-4`}>
          Lihat harga Pro
        </Link>
      </div>
    </section>
  );
}

/** Catatan kecil bahwa data web bergantung pada sinkronisasi perangkat (aplikasi offline-first). */
export function SyncNote({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center gap-1.5 text-[12.5px] text-text-muted ${className}`}>
      <CloudOff size={14} aria-hidden className="shrink-0" />
      Data dari perangkat yang sudah sinkron. Transaksi yang dibuat saat offline muncul setelah perangkat tersambung internet.
    </p>
  );
}

// ——— Periode ———

/** Periode dari query `from`/`to` (bawaan `fallback`) + pengubahnya. */
export function usePeriod(fallback: PeriodId = "7d") {
  const qs = useQueryState();
  const p = resolvePeriod(qs.get("from"), qs.get("to"), fallback);
  const setPeriod = (from: string, to: string) => {
    const def = presetRange(fallback);
    // Periode bawaan tidak ditulis ke URL agar tautan tetap ringkas.
    if (from === def.from && to === def.to) qs.update({ from: null, to: null });
    else qs.update({ from, to });
  };
  return { ...p, setPeriod, qs };
}

/** Pemilih periode: Hari ini, Kemarin, 7/30 hari, Bulan ini, Bulan lalu, Kustom (≤ 92 hari). */
export function PeriodFilter({
  from,
  to,
  preset,
  onChange,
  label = "Periode",
}: {
  from: string;
  to: string;
  preset: PeriodId | null;
  onChange: (from: string, to: string) => void;
  label?: string;
}) {
  return (
    <FilterPopover label={label} value={periodTitle(from, to, preset)} active popup="dialog" width={320}>
      <PeriodPanel from={from} to={to} preset={preset} onChange={onChange} label={label} />
    </FilterPopover>
  );
}

function PeriodPanel({
  from,
  to,
  preset,
  onChange,
  label,
}: {
  from: string;
  to: string;
  preset: PeriodId | null;
  onChange: (from: string, to: string) => void;
  label: string;
}) {
  const close = useFilterClose();
  const listId = useId();
  const [custom, setCustom] = useState(preset === null);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const fromRef = useRef<HTMLInputElement>(null);
  const today = zonedToday();
  const options = [...PERIOD_ORDER.map((id) => ({ value: id, label: PERIOD_LABELS[id] })), { value: "custom", label: "Kustom…" }];
  const selected = preset ? [preset] : ["custom"];
  const dateInput = `${inputClass} min-h-9 px-2 text-[13.5px] tabular-nums`;
  const tooLong = draftFrom && draftTo && spanDays(draftFrom, draftTo) > MAX_DAYS;
  const reversed = draftFrom && draftTo && draftFrom > draftTo;
  const invalid = !draftFrom || !draftTo || tooLong || reversed;

  return (
    <>
      <OptionList
        id={listId}
        label={label}
        options={options}
        selected={selected}
        multiple={false}
        onPick={(v) => {
          if (v === "custom") {
            setCustom(true);
            requestAnimationFrame(() => fromRef.current?.focus());
            return;
          }
          const r = presetRange(v as PeriodId, today);
          onChange(r.from, r.to);
          close(true);
        }}
      />
      {custom && (
        <form
          className="grid grid-cols-2 gap-2 border-t border-border-subtle px-3 pt-2.5 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            onChange(draftFrom, draftTo);
            close(true);
          }}
        >
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-text-body">
            Dari
            <input
              ref={fromRef}
              type="date"
              className={dateInput}
              value={draftFrom}
              min={draftTo ? addDays(draftTo, -(MAX_DAYS - 1)) : undefined}
              max={draftTo || today}
              onChange={(e) => setDraftFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-text-body">
            Sampai
            <input
              type="date"
              className={dateInput}
              value={draftTo}
              min={draftFrom || undefined}
              max={today}
              onChange={(e) => setDraftTo(e.target.value)}
            />
          </label>
          <p className={`col-span-2 text-[12px] ${tooLong || reversed ? "text-danger" : "text-text-muted"}`} role={tooLong || reversed ? "alert" : undefined}>
            {reversed ? "Tanggal awal harus sebelum tanggal akhir." : `Maksimal ${MAX_DAYS} hari.`}
          </p>
          <button type="submit" className={`${btn.primary} col-span-2 min-h-9 rounded-[8px] text-[13.5px]`} disabled={!!invalid}>
            Terapkan
          </button>
        </form>
      )}
      <PanelFooter>
        <span className="px-2 py-1.5 text-[12px] text-text-muted">Zona waktu {zoneLabel()}</span>
      </PanelFooter>
    </>
  );
}

/** Kartu kerangka angka (skeleton) untuk deretan KPI. */
export function KpiSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Memuat ringkasan" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-[14px] border border-border-subtle bg-white px-4 py-3.5">
          <span className="block h-3 w-1/2 animate-pulse rounded bg-border-subtle/70 motion-reduce:animate-none" />
          <span className="mt-2 block h-6 w-3/4 animate-pulse rounded bg-border-subtle/70 motion-reduce:animate-none" />
          <span className="mt-2 block h-3 w-2/3 animate-pulse rounded bg-border-subtle/70 motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}

export type ExportItem = { label: string; hint?: string; onSelect: () => void; disabled?: boolean };

/** Tombol "Ekspor CSV" dengan menu pilihan berkas. */
export function ExportMenu({ items, label = "Ekspor CSV" }: { items: ExportItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        className={btn.secondary}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <Download size={16} aria-hidden />
        {label}
        <ChevronDown size={15} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-30 mt-1.5 w-[260px] overflow-hidden rounded-[12px] border border-border-subtle bg-white p-1.5 shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)]"
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              disabled={it.disabled}
              onClick={() => {
                it.onSelect();
                setOpen(false);
              }}
              className={`flex w-full flex-col items-start rounded-[8px] px-2.5 py-2 text-left hover:bg-bg-muted disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent ${focusRing}`}
            >
              <span className="text-[14px] font-semibold text-text-heading">{it.label}</span>
              {it.hint && <span className="text-[12.5px] text-text-muted">{it.hint}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
