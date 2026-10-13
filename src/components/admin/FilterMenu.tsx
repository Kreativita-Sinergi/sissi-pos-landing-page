"use client";

import React, { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { jakartaDate } from "./filters";
import { btn, focusRing, inputClass } from "./ui";

// Filter ringkas halaman daftar admin: satu baris tombol "Label: nilai ▾" yang membuka popover.
// Bukan <select> bawaan — butuh angka facet, pilihan ganda bercentang, dan isian tambahan (tanggal, build).

const PANEL_W = 280;

/**
 * Baris filter: kotak cari di kiri lalu tombol dropdown berjajar (turun baris bila sempit).
 * Di HP: cari selebar kolom, dropdown satu baris bergulir horizontal agar daftar tetap lega.
 */
export function FilterBar({
  search,
  trailing,
  children,
}: {
  search?: React.ReactNode;
  trailing?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {search}
      {children && (
        <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:contents [&::-webkit-scrollbar]:hidden">
          {children}
        </div>
      )}
      {trailing && <div className="self-end sm:ml-auto sm:self-center">{trailing}</div>}
    </div>
  );
}

export function ClearFiltersButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1 whitespace-nowrap rounded-[10px] px-2.5 text-[13.5px] font-semibold text-brand-ink hover:bg-brand-tint ${focusRing}`}
    >
      <X size={15} aria-hidden />
      Hapus semua filter
    </button>
  );
}

type Close = (refocus?: boolean) => void;
const CloseContext = createContext<Close>(() => {});
/** Menutup popover terdekat (dipakai isi panel; juga dipakai panel khusus di dasbor pemilik). */
const useClose = () => useContext(CloseContext);
export const useFilterClose = useClose;

/** Tombol + popover dasar: Esc / klik di luar / Tab keluar menutup; fokus kembali ke tombol. */
export function FilterPopover({
  label,
  value,
  active,
  popup,
  width = PANEL_W,
  children,
}: {
  label: string;
  value: string;
  active: boolean;
  popup: "listbox" | "dialog";
  width?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) btnRef.current?.focus();
  }, []);

  // Posisi `fixed` dari tombol: tidak terpotong baris filter yang bergulir horizontal di HP,
  // dan dijaga tetap di dalam layar (gutter 8px).
  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const w = Math.min(width, window.innerWidth - 16);
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 8 - w)) });
  }, [width]);

  const openPanel = () => {
    place();
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const p = panelRef.current;
    const target = p?.querySelector<HTMLElement>("[data-autofocus]") ?? p?.querySelector<HTMLElement>("input, button");
    target?.focus();
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="shrink-0"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          close(true);
        }
      }}
      onBlur={(e) => {
        if (open && !wrapRef.current?.contains(e.relatedTarget as Node | null) && e.relatedTarget) setOpen(false);
      }}
    >
      <button
        ref={btnRef}
        type="button"
        aria-haspopup={popup}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(e) => {
          if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !open) {
            e.preventDefault();
            openPanel();
          }
        }}
        className={`inline-flex min-h-10 max-w-full items-center gap-1.5 whitespace-nowrap rounded-[10px] border px-2.5 text-[13.5px] transition-colors ${
          active
            ? "border-brand-primary/50 bg-brand-tint text-brand-ink"
            : "border-border-subtle bg-white text-text-heading hover:border-border-active"
        } ${focusRing}`}
      >
        <span className={active ? "text-brand-ink/80" : "text-text-muted"}>{label}:</span>
        <span className="max-w-[170px] truncate font-semibold">{value}</span>
        <ChevronDown size={15} aria-hidden className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          ref={panelRef}
          id={popup === "dialog" ? panelId : undefined}
          role={popup === "dialog" ? "dialog" : undefined}
          aria-label={popup === "dialog" ? label : undefined}
          style={{
            top: pos.top,
            left: pos.left,
            width: `min(${width}px, calc(100vw - 16px))`,
          }}
          className="fixed z-40 overflow-hidden rounded-[12px] border border-border-subtle bg-white shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)]"
        >
          <CloseContext.Provider value={close}>{children}</CloseContext.Provider>
        </div>
      )}
    </div>
  );
}

export type FilterOption = {
  value: string;
  label: string;
  count?: number | null;
  tone?: "danger";
};

/** Daftar pilihan (role=listbox) dengan navigasi panah, Home/End, Enter/Spasi. */
export function OptionList({
  id,
  label,
  options,
  selected,
  multiple,
  onPick,
}: {
  id: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  multiple: boolean;
  onPick: (value: string) => void;
}) {
  const first = Math.max(
    0,
    options.findIndex((o) => selected.includes(o.value)),
  );
  const [cursor, setCursor] = useState(first);
  const listRef = useRef<HTMLUListElement>(null);
  const optId = (i: number) => `${id}-opt-${i}`;

  useEffect(() => {
    listRef.current?.querySelector(`#${CSS.escape(optId(cursor))}`)?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={label}
      aria-multiselectable={multiple || undefined}
      aria-activedescendant={options.length ? optId(cursor) : undefined}
      tabIndex={0}
      data-autofocus
      className="max-h-[300px] overflow-y-auto p-1.5 outline-none"
      onKeyDown={(e) => {
        const last = options.length - 1;
        if (e.key === "ArrowDown") setCursor((c) => Math.min(last, c + 1));
        else if (e.key === "ArrowUp") setCursor((c) => Math.max(0, c - 1));
        else if (e.key === "Home") setCursor(0);
        else if (e.key === "End") setCursor(last);
        else if (e.key === "Enter" || e.key === " ") {
          if (options[cursor]) onPick(options[cursor].value);
        } else return;
        e.preventDefault();
      }}
    >
      {options.map((o, i) => {
        const on = selected.includes(o.value);
        const danger = o.tone === "danger";
        return (
          <li
            key={o.value}
            id={optId(i)}
            role="option"
            aria-selected={on}
            onPointerEnter={() => setCursor(i)}
            onClick={() => {
              setCursor(i);
              onPick(o.value);
            }}
            className={`flex min-h-9 cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 text-[14px] ${
              i === cursor ? "bg-bg-muted" : ""
            } ${on ? (danger ? "font-semibold text-danger" : "font-semibold text-brand-ink") : "text-text-heading"}`}
          >
            {multiple ? (
              <span
                aria-hidden
                className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border ${
                  on
                    ? danger
                      ? "border-danger bg-danger text-white"
                      : "border-brand-deep bg-brand-deep text-white"
                    : "border-border-active bg-white"
                }`}
              >
                {on && <Check size={12} strokeWidth={3} />}
              </span>
            ) : null}
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.count !== undefined && o.count !== null && (
              <span className="text-[12.5px] font-medium tabular-nums text-text-muted">{o.count.toLocaleString("id-ID")}</span>
            )}
            {/* Pilihan tunggal: centang di kanan (tanpa ruang kosong di kiri), sama dengan dropdown form. */}
            {!multiple && <Check size={15} strokeWidth={2.5} aria-hidden className={`shrink-0 ${on ? "" : "invisible"}`} />}
          </li>
        );
      })}
    </ul>
  );
}

export function PanelFooter({ onReset, resetDisabled, children }: { onReset?: () => void; resetDisabled?: boolean; children?: React.ReactNode }) {
  if (!onReset && !children) return null;
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-2 py-1.5">
      {onReset ? (
        <button
          type="button"
          onClick={onReset}
          disabled={resetDisabled}
          className={`rounded-[8px] px-2 py-1.5 text-[13px] font-semibold text-text-body hover:bg-bg-muted hover:text-text-heading disabled:opacity-40 disabled:hover:bg-transparent ${focusRing}`}
        >
          Reset
        </button>
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}

/**
 * Dropdown filter pilihan tunggal atau ganda. `selected` kosong = "Semua".
 * Pilihan tunggal: memilih ulang nilai aktif = melepasnya (kecuali `required`), lalu popover menutup.
 * Pilihan ganda: popover tetap terbuka, tiap pilihan bercentang.
 */
export function FilterSelect({
  label,
  options,
  selected,
  onChange,
  multiple = false,
  required = false,
  allLabel = "Semua",
  summary,
  highlight,
  onReset,
  children,
}: {
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
  /** Selalu ada satu nilai (mis. urutan): tanpa Reset, memilih ulang tidak melepas. */
  required?: boolean;
  allLabel?: string;
  summary?: string;
  highlight?: boolean;
  onReset?: () => void;
  /** Isian tambahan di bawah daftar (mis. ID target). */
  children?: React.ReactNode;
}) {
  const listId = useId();
  const nameOf = (v: string) => options.find((o) => o.value === v)?.label ?? v;
  const value =
    summary ??
    (selected.length === 0 ? allLabel : selected.length === 1 ? nameOf(selected[0]) : `${nameOf(selected[0])} +${selected.length - 1}`);
  return (
    <FilterPopover label={label} value={value} active={highlight ?? selected.length > 0} popup="listbox">
      <SelectPanel
        {...{
          listId,
          label,
          options,
          selected,
          onChange,
          multiple,
          required,
          onReset,
        }}
      >
        {children}
      </SelectPanel>
    </FilterPopover>
  );
}

function SelectPanel({
  listId,
  label,
  options,
  selected,
  onChange,
  multiple,
  required,
  onReset,
  children,
}: {
  listId: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple: boolean;
  required: boolean;
  onReset?: () => void;
  children?: React.ReactNode;
}) {
  const close = useClose();
  return (
    <>
      <OptionList
        id={listId}
        label={label}
        options={options}
        selected={selected}
        multiple={multiple}
        onPick={(v) => {
          if (multiple) {
            onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
            return;
          }
          onChange(required || !selected.includes(v) ? [v] : []);
          close(true);
        }}
      />
      {children}
      {!required && (
        <PanelFooter
          resetDisabled={selected.length === 0}
          onReset={() => {
            if (onReset) onReset();
            else onChange([]);
            close(true);
          }}
        >
          {multiple && (
            <button type="button" onClick={() => close(true)} className={`${btn.primary} min-h-8 rounded-[8px] px-3 text-[13px]`}>
              Selesai
            </button>
          )}
        </PanelFooter>
      )}
    </>
  );
}

/** Dropdown berisi satu isian teks (mis. nomor build). Enter / "Terapkan" menyimpan. */
export function FilterInput({
  label,
  value,
  onApply,
  placeholder,
  hint,
  numeric = false,
}: {
  label: string;
  value: string;
  onApply: (v: string) => void;
  placeholder?: string;
  hint?: string;
  numeric?: boolean;
}) {
  const inputId = useId();
  return (
    <FilterPopover label={label} value={value || "Semua"} active={!!value} popup="dialog">
      <InputPanel {...{ inputId, label, value, onApply, placeholder, hint, numeric }} />
    </FilterPopover>
  );
}

function InputPanel({
  inputId,
  label,
  value,
  onApply,
  placeholder,
  hint,
  numeric,
}: {
  inputId: string;
  label: string;
  value: string;
  onApply: (v: string) => void;
  placeholder?: string;
  hint?: string;
  numeric: boolean;
}) {
  const close = useClose();
  const [draft, setDraft] = useState(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft.trim());
        close(true);
      }}
    >
      <div className="p-3">
        <label htmlFor={inputId} className="mb-1.5 block text-[13px] font-semibold text-text-heading">
          {label}
        </label>
        <input
          id={inputId}
          className={`${inputClass} tabular-nums`}
          inputMode={numeric ? "numeric" : undefined}
          placeholder={placeholder}
          value={draft}
          autoComplete="off"
          onChange={(e) => setDraft(numeric ? e.target.value.replace(/\D/g, "") : e.target.value)}
        />
        {hint && <p className="mt-1.5 text-[12.5px] text-text-muted">{hint}</p>}
      </div>
      <PanelFooter
        resetDisabled={!value && !draft}
        onReset={() => {
          onApply("");
          close(true);
        }}
      >
        <button type="submit" className={`${btn.primary} min-h-8 rounded-[8px] px-3 text-[13px]`}>
          Terapkan
        </button>
      </PanelFooter>
    </form>
  );
}

// ——— Tanggal ———

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function parts(v: string) {
  const [y, m, d] = v.split("-").map(Number);
  return { y, m, d };
}

/** Label ringkas rentang: "12–18 Okt", "28 Sep – 3 Okt", "Sejak 12 Okt", "s.d. 18 Okt" (tahun hanya bila bukan tahun ini). */
export function compactRange(from: string, to: string): string {
  const year = Number(jakartaDate(0).slice(0, 4));
  const fmt = (v: string, withYear: boolean) => {
    const p = parts(v);
    return `${p.d} ${MONTHS[p.m - 1]}${withYear ? ` ${p.y}` : ""}`;
  };
  if (from && to) {
    const a = parts(from);
    const b = parts(to);
    if (from === to) return fmt(from, a.y !== year);
    if (a.y === b.y && a.m === b.m) return `${a.d}–${fmt(to, b.y !== year)}`;
    const years = a.y !== b.y || b.y !== year;
    return `${fmt(from, years)} – ${fmt(to, years)}`;
  }
  if (from) return `Sejak ${fmt(from, parts(from).y !== year)}`;
  if (to) return `s.d. ${fmt(to, parts(to).y !== year)}`;
  return "";
}

export type DatePreset = { label: string; days: number };

/** Dropdown tanggal: pilihan cepat + "Rentang khusus…" (dua isian tanggal di dalam popover). */
export function DateFilter({
  label,
  from,
  to,
  presets,
  onChange,
}: {
  label: string;
  from: string;
  to: string;
  presets: DatePreset[];
  onChange: (from: string, to: string) => void;
}) {
  const preset = presets.find((p) => to === "" && from === jakartaDate(p.days - 1));
  const value = preset ? preset.label : from || to ? compactRange(from, to) : "Semua";
  return (
    <FilterPopover label={label} value={value} active={!!(from || to)} popup="dialog" width={320}>
      <DatePanel {...{ label, from, to, presets, preset, onChange }} />
    </FilterPopover>
  );
}

function DatePanel({
  label,
  from,
  to,
  presets,
  preset,
  onChange,
}: {
  label: string;
  from: string;
  to: string;
  presets: DatePreset[];
  preset: DatePreset | undefined;
  onChange: (from: string, to: string) => void;
}) {
  const close = useClose();
  const listId = useId();
  const [custom, setCustom] = useState(!preset && !!(from || to));
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const fromRef = useRef<HTMLInputElement>(null);
  const today = jakartaDate(0);
  const options: FilterOption[] = [
    ...presets.map((p) => ({ value: String(p.days), label: p.label })),
    { value: "custom", label: "Rentang khusus…" },
  ];
  const selected = preset ? [String(preset.days)] : custom ? ["custom"] : [];
  const dateInput = `${inputClass} min-h-9 px-2 text-[13.5px] tabular-nums`;

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
          const p = presets.find((x) => String(x.days) === v);
          if (p) onChange(preset === p ? "" : jakartaDate(p.days - 1), "");
          close(true);
        }}
      />
      {custom && (
        <form
          className="grid grid-cols-2 gap-2 border-t border-border-subtle px-3 pt-2.5 pb-3"
          onSubmit={(e) => {
            e.preventDefault();
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
          <button
            type="submit"
            className={`${btn.primary} col-span-2 min-h-9 rounded-[8px] text-[13.5px]`}
            disabled={!draftFrom && !draftTo}
          >
            Terapkan
          </button>
        </form>
      )}
      <PanelFooter
        resetDisabled={!from && !to}
        onReset={() => {
          onChange("", "");
          close(true);
        }}
      />
    </>
  );
}
