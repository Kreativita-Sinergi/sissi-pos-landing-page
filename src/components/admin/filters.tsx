"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { focusRing, iconBtn, inputClass } from "./ui";

// Filter halaman daftar admin. Satu sumber kebenaran = query URL (bisa dibagikan antar admin):
// perubahan filter eksplisit memakai router.push (tombol Kembali bekerja), ketikan cari memakai router.replace.

type Patch = Record<string, string | string[] | null | undefined>;

export function useQueryState() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const get = useCallback((k: string) => params.get(k) ?? "", [params]);
  const list = useCallback((k: string) => (params.get(k) ?? "").split(",").filter(Boolean), [params]);

  const update = useCallback(
    (patch: Patch, mode: "push" | "replace" = "push") => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        const value = Array.isArray(v) ? v.join(",") : v;
        if (value === null || value === undefined || value === "") sp.delete(k);
        else sp.set(k, value);
      }
      // Filter berubah → kembali ke halaman 1 / awal kursor.
      if (!("page" in patch)) sp.delete("page");
      if (!("cursor" in patch)) sp.delete("cursor");
      const s = sp.toString();
      const url = s ? `${pathname}?${s}` : pathname;
      if (mode === "replace") router.replace(url, { scroll: false });
      else router.push(url, { scroll: false });
    },
    [params, pathname, router]
  );

  const clear = useCallback(
    (keep: string[] = []) => {
      const sp = new URLSearchParams();
      for (const k of keep) {
        const v = params.get(k);
        if (v) sp.set(k, v);
      }
      const s = sp.toString();
      router.push(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [params, pathname, router]
  );

  return { params, get, list, update, clear };
}

function isEditable(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

/**
 * Kotak cari dengan debounce 300 ms, pintasan `/` untuk fokus (diabaikan bila sedang mengetik di input lain),
 * dan `Esc` untuk mengosongkan lalu melepas fokus.
 */
export function SearchBox({
  id,
  label,
  value,
  onSearch,
  placeholder,
  className = "",
}: {
  id: string;
  label: string;
  value: string;
  onSearch: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  const [input, setInput] = useState(value);
  const [synced, setSynced] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const onSearchRef = useRef(onSearch);
  const valueRef = useRef(value);
  useEffect(() => {
    onSearchRef.current = onSearch;
    valueRef.current = value;
  });

  // URL berubah dari luar (mis. "Hapus semua filter") → isi kotak ikut berubah.
  if (value !== synced) {
    setSynced(value);
    setInput(value);
  }

  useEffect(() => {
    const v = input.trim();
    if (v === valueRef.current) return;
    const t = setTimeout(() => onSearchRef.current(v), 300);
    return () => clearTimeout(t);
  }, [input]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || isEditable(e.target)) return;
      if (document.querySelector("dialog[open]")) return;
      e.preventDefault();
      ref.current?.focus();
      ref.current?.select();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`relative ${className}`} role="search">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search size={17} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
      <input
        ref={ref}
        id={id}
        type="search"
        className={`${inputClass} peer pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden`}
        placeholder={placeholder}
        value={input}
        maxLength={100}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSearch(input.trim());
          } else if (e.key === "Escape") {
            if (input) {
              setInput("");
              onSearch("");
            } else ref.current?.blur();
          }
        }}
      />
      {input ? (
        <button
          type="button"
          className={`${iconBtn} absolute top-1/2 right-0.5 h-8 w-8 -translate-y-1/2`}
          onClick={() => {
            setInput("");
            onSearch("");
            ref.current?.focus();
          }}
          aria-label="Hapus pencarian"
        >
          <X size={16} aria-hidden />
        </button>
      ) : (
        <kbd
          aria-hidden
          title="Tekan / untuk mencari"
          className="pointer-events-none absolute top-1/2 right-2.5 hidden h-6 min-w-6 -translate-y-1/2 items-center justify-center rounded-[6px] border border-border-subtle bg-bg-muted px-1.5 font-sans text-[12px] font-semibold text-text-muted peer-focus:hidden sm:inline-flex"
        >
          /
        </kbd>
      )}
    </div>
  );
}

/** Chip filter yang bisa ditekan; angka facet opsional (disembunyikan bila server mengirim facets null). */
export function Chip({
  active,
  onClick,
  children,
  count,
  tone = "brand",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number | null;
  tone?: "brand" | "danger";
}) {
  const on = tone === "danger" ? "border-danger/40 bg-danger-tint text-danger" : "border-brand-primary/50 bg-brand-tint text-brand-ink";
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-semibold transition-colors ${
        active ? on : "border-border-subtle bg-white text-text-body hover:border-border-active hover:text-text-heading"
      } ${focusRing}`}
    >
      {children}
      {count !== undefined && count !== null && (
        <span className={`tabular-nums font-medium ${active ? "opacity-80" : "text-text-muted"}`}>{count.toLocaleString("id-ID")}</span>
      )}
    </button>
  );
}

export function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <p className="w-[92px] shrink-0 text-[12px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

export type ActiveFilter = { key: string; label: string; onRemove: () => void };

/** Baris chip filter aktif (bisa dihapus satu per satu) + "Hapus semua filter". */
export function ActiveFilters({ items, onClearAll }: { items: ActiveFilter[]; onClearAll: () => void }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filter aktif">
      {items.map((f) => (
        <span
          key={f.key}
          className="inline-flex min-h-7 items-center gap-0.5 rounded-full bg-brand-dark py-0.5 pr-0.5 pl-2.5 text-[12.5px] font-semibold text-white"
        >
          {f.label}
          <button
            type="button"
            onClick={f.onRemove}
            aria-label={`Hapus filter ${f.label}`}
            className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-white/70 hover:bg-white/15 hover:text-white ${focusRing}`}
          >
            <X size={13} aria-hidden />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className={`ml-1 rounded-[6px] px-1.5 py-1 text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}
      >
        Hapus semua filter
      </button>
    </div>
  );
}

/** Panel filter: selalu terbuka di layar lebar, dilipat di HP di balik tombol "Filter". */
export function FilterPanel({ activeCount, children }: { activeCount: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-border-subtle bg-white px-3.5 text-[14px] font-semibold text-text-heading md:hidden ${focusRing}`}
      >
        <SlidersHorizontal size={16} aria-hidden />
        Filter
        {activeCount > 0 && (
          <span className="rounded-full bg-brand-deep px-1.5 text-[12px] tabular-nums text-white">{activeCount}</span>
        )}
      </button>
      <div className={`${open ? "mt-3 flex" : "hidden"} flex-col gap-2.5 rounded-[14px] border border-border-subtle bg-white p-3.5 md:mt-0 md:flex md:p-4`}>
        {children}
      </div>
    </div>
  );
}

// ——— Tanggal (zona Asia/Jakarta) ———

/** `YYYY-MM-DD` di WIB untuk hari ini dikurangi `daysBack`. */
export function jakartaDate(daysBack = 0): string {
  const d = new Date(Date.now() - daysBack * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
}

export function formatDay(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(`${value}T00:00:00+07:00`);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(d);
}

export function rangeLabel(from: string, to: string): string {
  if (from && to) return from === to ? formatDay(from) : `${formatDay(from)} – ${formatDay(to)}`;
  if (from) return `Sejak ${formatDay(from)}`;
  return `Sampai ${formatDay(to)}`;
}

/** Pilihan rentang cepat + isian tanggal bebas. */
export function DateRangeFilter({
  from,
  to,
  presets,
  onChange,
  idPrefix,
}: {
  from: string;
  to: string;
  presets: { label: string; days: number }[];
  onChange: (from: string, to: string) => void;
  idPrefix: string;
}) {
  const today = jakartaDate(0);
  const activePreset = presets.find((p) => to === "" && from === jakartaDate(p.days - 1));
  const dateInput = `${inputClass} min-h-8 w-[150px] rounded-full px-3 py-0 text-[13px]`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {presets.map((p) => (
        <Chip
          key={p.days}
          active={activePreset === p}
          onClick={() => (activePreset === p ? onChange("", "") : onChange(jakartaDate(p.days - 1), ""))}
        >
          {p.label}
        </Chip>
      ))}
      <span className="flex items-center gap-1.5">
        <label htmlFor={`${idPrefix}-from`} className="sr-only">
          Dari tanggal
        </label>
        <input id={`${idPrefix}-from`} type="date" className={dateInput} value={from} max={to || today} onChange={(e) => onChange(e.target.value, to)} />
        <span aria-hidden className="text-text-muted">
          –
        </span>
        <label htmlFor={`${idPrefix}-to`} className="sr-only">
          Sampai tanggal
        </label>
        <input id={`${idPrefix}-to`} type="date" className={dateInput} value={to} min={from || undefined} max={today} onChange={(e) => onChange(from, e.target.value)} />
      </span>
    </div>
  );
}
