"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { iconBtn, inputClass } from "./ui";

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
        className={`${inputClass} peer pr-10 pl-9 text-ellipsis [&::-webkit-search-cancel-button]:hidden`}
        placeholder={placeholder}
        title={label}
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
