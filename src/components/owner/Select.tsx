"use client";

import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { focusRing } from "@/components/admin/ui";

// Dropdown custom pengganti <select> bawaan (tampilan sama di semua sistem). Daftar pilihan dirender di top layer
// (Popover API) dengan posisi tetap, sehingga tidak terpotong area gulir panel/dialog dan selalu di atas dialog modal.
// Pola ARIA: tombol combobox-only (aria-haspopup="listbox") + listbox dengan aria-activedescendant.

export type SelectOption<V extends string = string> = {
  value: V;
  label: React.ReactNode;
  /** Teks untuk ketik-cari & pembaca layar bila `label` bukan teks biasa. */
  text?: string;
  description?: React.ReactNode;
  disabled?: boolean;
};

type Props<V extends string> = {
  id?: string;
  value: V;
  onChange: (value: V) => void;
  options: SelectOption<V>[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

const MAX_LIST_HEIGHT = 300;
const GAP = 4;

function optionText<V extends string>(o: SelectOption<V>): string {
  if (o.text) return o.text;
  return typeof o.label === "string" || typeof o.label === "number" ? String(o.label) : o.value;
}

export function Select<V extends string>({
  id,
  value,
  onChange,
  options,
  placeholder = "Pilih…",
  className = "",
  disabled = false,
  invalid = false,
  ...aria
}: Props<V>) {
  const autoId = useId();
  const buttonId = id ?? `${autoId}-btn`;
  const listId = `${autoId}-list`;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const typed = useRef({ text: "", at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const place = useCallback(() => {
    const b = buttonRef.current?.getBoundingClientRect();
    if (!b) return;
    const below = window.innerHeight - b.bottom - GAP - 8;
    const above = b.top - GAP - 8;
    const wanted = Math.min(MAX_LIST_HEIGHT, (listRef.current?.scrollHeight ?? MAX_LIST_HEIGHT) + 2);
    const up = below < Math.min(wanted, 180) && above > below;
    const maxHeight = Math.max(120, Math.min(MAX_LIST_HEIGHT, up ? above : below));
    const height = Math.min(wanted, maxHeight);
    setPos({ top: up ? b.top - GAP - height : b.bottom + GAP, left: b.left, width: b.width, maxHeight });
  }, []);

  const close = useCallback((focusButton = true) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }, []);

  const openList = useCallback(
    (at?: number) => {
      if (disabled) return;
      setActive(at ?? (selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled)));
      setOpen(true);
    },
    [disabled, options, selectedIndex]
  );

  // Tampilkan di top layer + posisikan.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (open) {
      try {
        if (!list.matches(":popover-open")) list.showPopover();
      } catch {
        // Browser tanpa Popover API: tetap tampil sebagai elemen fixed biasa.
      }
      place();
    } else {
      try {
        if (list.matches(":popover-open")) list.hidePopover();
      } catch {
        // abaikan
      }
    }
  }, [open, place]);

  // Tutup saat klik di luar; ikuti gulir/ubah ukuran.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (buttonRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close(false);
    };
    const onMove = () => place();
    document.addEventListener("pointerdown", onDown, true);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, true);
    };
  }, [open, close, place]);

  // Pilihan aktif selalu terlihat.
  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function move(from: number, step: 1 | -1): number {
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
    return from;
  }

  function choose(i: number) {
    const o = options[i];
    if (!o || o.disabled) return;
    if (o.value !== value) onChange(o.value);
    close();
  }

  function typeAhead(key: string) {
    const now = Date.now();
    const t = typed.current;
    t.text = now - t.at > 700 ? key : t.text + key;
    t.at = now;
    const q = t.text.toLowerCase();
    const start = open ? active : selectedIndex;
    const order = [...options.keys()].map((k) => (k + Math.max(start, 0) + (t.text.length === 1 ? 1 : 0)) % options.length);
    const hit = order.find((i) => !options[i].disabled && optionText(options[i]).toLowerCase().startsWith(q));
    if (hit === undefined) return;
    if (open) setActive(hit);
    else if (options[hit].value !== value) onChange(options[hit].value);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openList();
        else setActive((a) => move(a, 1));
        return;
      case "ArrowUp":
        e.preventDefault();
        if (!open) openList();
        else setActive((a) => move(a, -1));
        return;
      case "Home":
        if (open) {
          e.preventDefault();
          setActive(move(-1, 1));
        }
        return;
      case "End":
        if (open) {
          e.preventDefault();
          setActive(move(options.length, -1));
        }
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(active);
        else openList();
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          e.stopPropagation(); // jangan ikut menutup dialog/panel induk
          close();
        }
        return;
      case "Tab":
        if (open) close(false);
        return;
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) typeAhead(e.key);
  }

  return (
    <>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        aria-describedby={aria["aria-describedby"]}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className={`flex min-h-10 w-full items-center gap-2 rounded-[10px] border bg-white py-2 pr-3 pl-3 text-left text-[14px] transition-colors disabled:cursor-not-allowed disabled:bg-bg-muted disabled:text-text-muted ${
          invalid ? "border-danger" : open ? "border-brand-primary" : "border-border-subtle hover:border-border-active"
        } ${focusRing} ${className}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-text-heading" : "text-text-muted"}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        popover="manual"
        aria-labelledby={aria["aria-labelledby"] ?? buttonId}
        tabIndex={-1}
        hidden={!open}
        style={
          pos
            ? // right/bottom eksplisit (bukan `inset`) agar tidak menimpa top/left; menimpa gaya bawaan [popover].
              { position: "fixed", top: pos.top, left: pos.left, right: "auto", bottom: "auto", width: pos.width, maxHeight: pos.maxHeight, margin: 0 }
            : { position: "fixed", margin: 0 }
        }
        className="z-50 min-w-[180px] overflow-y-auto rounded-[12px] border border-border-subtle bg-white p-1 text-[14px] text-text-heading shadow-[0_12px_32px_-12px_rgba(41,46,49,0.35)]"
      >
        {options.map((o, i) => {
          const isSel = o.value === value;
          const isActive = i === active;
          return (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              data-index={i}
              role="option"
              aria-selected={isSel}
              aria-disabled={o.disabled || undefined}
              onPointerEnter={() => !o.disabled && setActive(i)}
              onPointerDown={(e) => e.preventDefault()} // fokus tetap di tombol
              onClick={() => choose(i)}
              className={`flex cursor-pointer items-start gap-2 rounded-[8px] px-2.5 py-2 ${
                o.disabled ? "cursor-not-allowed text-text-muted" : isActive ? "bg-bg-muted" : ""
              } ${isSel ? "font-semibold text-brand-ink" : ""}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block">{o.label}</span>
                {o.description && <span className="mt-0.5 block text-[12.5px] font-normal text-text-muted">{o.description}</span>}
              </span>
              <Check size={16} aria-hidden className={`mt-0.5 shrink-0 ${isSel ? "text-brand-primary" : "invisible"}`} />
            </li>
          );
        })}
      </ul>
    </>
  );
}
