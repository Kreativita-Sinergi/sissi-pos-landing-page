"use client";

import React, { useRef, useState } from "react";
import { Armchair, Search, UserRound, X } from "lucide-react";
import { Spinner } from "@/components/admin/ui";
import { focusRing, inputClass } from "@/components/self-order/ui";
import { staffApi } from "@/lib/staff/api";
import type { WaiterCustomer } from "@/lib/staff/types";

// "Untuk siapa" di keranjang pesanan baru pelayan: Meja (atau Tanpa meja) + Pelanggan/nama tamu — padanan pemilih
// pelanggan & meja di keranjang app (CartSelectors). Pelayan tidak bisa membuat pelanggan baru: nama yang diketik
// tanpa memilih hasil pencarian dipakai sebagai nama tamu. Tanpa meja wajib ada nama.

const MIN_QUERY = 2;

export function OrderFor({
  tables,
  table,
  onTable,
  customer,
  onCustomer,
  guestName,
  onGuestName,
  nameError,
}: {
  tables: { id: string; name: string; busy: boolean }[];
  table: string | null;
  onTable: (id: string | null) => void;
  customer: WaiterCustomer | null;
  onCustomer: (c: WaiterCustomer | null) => void;
  guestName: string;
  onGuestName: (v: string) => void;
  nameError: string | null;
}) {
  const [results, setResults] = useState<WaiterCustomer[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<number | null>(null);
  const ctrl = useRef<AbortController | null>(null);

  function search(q: string) {
    if (timer.current) window.clearTimeout(timer.current);
    ctrl.current?.abort();
    if (q.trim().length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = window.setTimeout(async () => {
      const c = new AbortController();
      ctrl.current = c;
      try {
        const items = await (await staffApi()).waiterCustomers(q.trim(), c.signal);
        if (!c.signal.aborted) setResults(items);
      } catch {
        if (!c.signal.aborted) setResults([]);
      } finally {
        if (!c.signal.aborted) setSearching(false);
      }
    }, 300);
  }

  const needName = !table && !customer;

  return (
    <div className="mb-3 flex flex-col gap-4 border-b border-so-line pb-4">
      <label className="flex flex-col gap-1.5">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-text-heading">
          <Armchair size={16} aria-hidden /> Meja
        </span>
        <select
          value={table ?? ""}
          onChange={(e) => onTable(e.target.value || null)}
          className={`${inputClass} min-h-12`}
        >
          <option value="">Tanpa meja</option>
          {tables.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {t.busy ? " (terisi)" : ""}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-col gap-1.5">
        <span id="pelanggan-label" className="flex items-center gap-1.5 text-[14px] font-semibold text-text-heading">
          <UserRound size={16} aria-hidden /> Pelanggan
          {needName ? <span className="font-normal text-text-muted">· wajib untuk tanpa meja</span> : null}
        </span>
        {customer ? (
          <div className="flex min-h-12 items-center gap-3 rounded-[14px] border border-brand-primary bg-brand-tint px-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-semibold text-text-heading">{customer.name}</span>
              {customer.phone_masked && <span className="block text-[13px] text-text-body">{customer.phone_masked}</span>}
            </span>
            <button
              type="button"
              onClick={() => onCustomer(null)}
              aria-label={`Hapus pelanggan ${customer.name}`}
              className={`-mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full text-text-body hover:text-text-heading ${focusRing}`}
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Search size={18} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                value={guestName}
                maxLength={80}
                aria-labelledby="pelanggan-label"
                aria-invalid={!!nameError || undefined}
                aria-describedby={nameError ? "pelanggan-error" : "pelanggan-hint"}
                placeholder="Cari pelanggan atau ketik nama tamu"
                onChange={(e) => {
                  onGuestName(e.target.value);
                  search(e.target.value);
                }}
                className={`${inputClass} min-h-12 pl-11 ${nameError ? "border-danger" : ""}`}
              />
            </div>
            {nameError ? (
              <p id="pelanggan-error" className="text-[14px] font-medium text-danger">
                {nameError}
              </p>
            ) : (
              <p id="pelanggan-hint" className="text-[13px] text-text-muted">
                Pilih dari daftar, atau biarkan sebagai nama tamu.
              </p>
            )}
            {searching && (
              <p role="status" className="flex items-center gap-2 text-[13px] text-text-muted">
                <Spinner size={14} /> Mencari…
              </p>
            )}
            {!searching && results.length > 0 && (
              <ul className="flex flex-col overflow-hidden rounded-[14px] border border-so-line" aria-label="Hasil pencarian pelanggan">
                {results.slice(0, 6).map((c) => (
                  <li key={c.id} className="border-b border-so-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        onCustomer(c);
                        onGuestName("");
                        setResults([]);
                      }}
                      className={`flex min-h-12 w-full items-center justify-between gap-3 bg-white px-4 py-2 text-left hover:bg-so-canvas ${focusRing}`}
                    >
                      <span className="min-w-0 truncate text-[15px] font-semibold text-text-heading">{c.name}</span>
                      {c.phone_masked && <span className="shrink-0 text-[13px] text-text-muted tabular-nums">{c.phone_masked}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
