"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Armchair, Plus, ReceiptText, RefreshCw, UserRound } from "lucide-react";
import { focusRing, Spinner } from "@/components/admin/ui";
import { useStaff } from "@/components/staff/StaffShell";
import { formatRupiah } from "@/lib/selfOrder/pricing";
import { staffApi } from "@/lib/staff/api";
import type { WaiterFloor, WaiterOrderBrief, WaiterTable } from "@/lib/staff/types";
import { pickOutlet, rememberOutlet, useRefresh, waiterEnabled, waiterErrorText } from "./shared";

// Menu Meja pelayan (/karyawan/meja): denah meja outlet dengan status kosong/terisi seperti tab Meja di aplikasi.
// Data dari server (GET /staff/waiter/floor), dimuat ulang tiap 10 detik selama tab terlihat.

type Filter = "all" | "empty" | "occupied";

export function TablesView() {
  const { session } = useStaff();
  // Shell hanya merender anak setelah sesi diperiksa di browser → aman membaca localStorage saat inisialisasi.
  const [outlet, setOutlet] = useState<string | null>(() => pickOutlet(session));
  const [floor, setFloor] = useState<WaiterFloor | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [area, setArea] = useState<string>("all");

  const load = useCallback(
    async (quiet = false) => {
      if (!outlet) return;
      const api = await staffApi();
      if (!quiet) setLoading(true);
      try {
        const f = await api.waiterFloor(outlet);
        setFloor(f);
        setError(null);
      } catch (err) {
        if (!quiet || !floor) setError(err);
      } finally {
        setLoading(false);
      }
    },
    // floor sengaja tidak ikut: hanya untuk memutuskan apakah galat senyap ditampilkan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outlet]
  );

  // Muat di luar badan efek (aturan react-hooks/set-state-in-effect); dibatalkan bila efek dibersihkan.
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (live) void load();
    });
    return () => {
      live = false;
    };
  }, [load]);
  useRefresh(() => void load(true), 10_000, !!outlet);

  const counts = useMemo(() => {
    const tables = floor?.tables ?? [];
    const occupied = tables.filter((t) => t.orders.length > 0).length;
    return { total: tables.length, occupied, empty: tables.length - occupied };
  }, [floor]);

  const shown = useMemo(() => {
    return (floor?.tables ?? []).filter((t) => {
      if (area !== "all" && (t.area_id ?? "none") !== area) return false;
      if (filter === "empty") return t.orders.length === 0;
      if (filter === "occupied") return t.orders.length > 0;
      return true;
    });
  }, [floor, filter, area]);

  if (!waiterEnabled(session)) {
    return <p className="text-[15px] text-text-body">Menu Meja hanya untuk Pelayan.</p>;
  }

  const areas = floor?.areas ?? [];
  const hasNoArea = (floor?.tables ?? []).some((t) => !t.area_id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-bold tracking-tight text-text-heading">Meja</h1>
          {floor && (
            <p className="text-[14px] text-text-muted">
              {counts.occupied} terisi dari {counts.total} meja
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || !outlet}
          aria-label="Muat ulang meja"
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-border-subtle bg-white text-text-body hover:text-text-heading disabled:opacity-50 ${focusRing}`}
        >
          {loading ? <Spinner size={16} /> : <RefreshCw size={18} aria-hidden />}
        </button>
      </div>

      {session.outlets.length > 1 && (
        <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-text-heading">
          Outlet
          <select
            value={outlet ?? ""}
            onChange={(e) => {
              setOutlet(e.target.value);
              rememberOutlet(e.target.value);
              setFloor(null);
            }}
            className={`min-h-11 rounded-[12px] border border-border-subtle bg-white px-3 text-[15px] font-normal ${focusRing}`}
          >
            {session.outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error ? (
        <div role="alert" className="rounded-[14px] border border-danger/25 bg-danger-tint px-4 py-3 text-[15px] text-danger">
          {waiterErrorText(error)}{" "}
          <button type="button" onClick={() => void load()} className={`font-semibold underline ${focusRing}`}>
            Coba lagi
          </button>
        </div>
      ) : null}

      {!floor && !error && (
        <p role="status" className="flex items-center gap-2 py-10 text-[14px] text-text-muted">
          <Spinner /> Memuat meja…
        </p>
      )}

      {floor && (
        <>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Saring status meja">
            <Chip on={filter === "all"} onClick={() => setFilter("all")}>
              Semua
            </Chip>
            <Chip on={filter === "empty"} onClick={() => setFilter("empty")}>
              Kosong {counts.empty}
            </Chip>
            <Chip on={filter === "occupied"} onClick={() => setFilter("occupied")}>
              Terisi {counts.occupied}
            </Chip>
          </div>
          {areas.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]" role="group" aria-label="Area">
              <Chip on={area === "all"} onClick={() => setArea("all")} subtle>
                Semua area
              </Chip>
              {areas.map((a) => (
                <Chip key={a.id} on={area === a.id} onClick={() => setArea(a.id)} subtle>
                  {a.name}
                </Chip>
              ))}
              {hasNoArea && (
                <Chip on={area === "none"} onClick={() => setArea("none")} subtle>
                  Tanpa area
                </Chip>
              )}
            </div>
          )}

          {filter !== "empty" && area === "all" && (
            <NoTableSection orders={floor.untabled ?? []} outlet={outlet!} />
          )}

          {floor.tables.length === 0 ? (
            <div className="rounded-[18px] border border-border-subtle bg-white px-5 py-10 text-center">
              <Armchair size={30} aria-hidden className="mx-auto mb-3 text-text-muted" />
              <p className="text-[16px] font-semibold text-text-heading">Belum ada meja</p>
              <p className="mt-1 text-[14px] text-text-body">Pemilik belum menambahkan meja untuk outlet ini.</p>
            </div>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-text-muted">Tidak ada meja di saringan ini</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3">
              {shown.map((t) => (
                <li key={t.id}>
                  <TableCard table={t} outlet={outlet!} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
  subtle = false,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-10 shrink-0 rounded-full border px-3.5 text-[14px] font-semibold transition-colors ${focusRing} ${
        on
          ? subtle
            ? "border-brand-primary bg-brand-tint text-brand-ink"
            : "border-text-heading bg-text-heading text-white"
          : "border-border-subtle bg-white text-text-body hover:text-text-heading"
      }`}
    >
      {children}
    </button>
  );
}

function TableCard({ table, outlet }: { table: WaiterTable; outlet: string }) {
  const order = table.orders[0];
  const busy = !!order;
  const total = table.orders.reduce((s, o) => s + o.total, 0);
  const items = table.orders.reduce((s, o) => s + o.item_count, 0);
  const billed = table.orders.some((o) => o.bill_requested);
  return (
    <Link
      href={`/karyawan/meja/${table.id}?o=${outlet}`}
      className={`flex min-h-[104px] flex-col rounded-[16px] border p-3.5 transition-colors ${focusRing} ${
        busy ? "border-brand-primary/40 bg-brand-tint" : "border-border-subtle bg-white hover:border-border-active"
      }`}
    >
      <span className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-[17px] font-bold leading-tight break-words text-text-heading">{table.name}</span>
        {billed && (
          <span title="Tagihan diminta" className="shrink-0 text-brand-deep">
            <ReceiptText size={18} aria-label="Tagihan diminta" />
          </span>
        )}
      </span>
      <span className="mt-auto pt-3">
        {busy ? (
          <>
            <span className="block text-[15px] font-bold tabular-nums text-text-heading">{formatRupiah(total)}</span>
            <span className="block text-[13px] text-text-body">
              {items} item{table.orders.length > 1 ? ` · ${table.orders.length} pesanan` : ""}
            </span>
          </>
        ) : (
          <span className="text-[14px] font-medium text-text-muted">Kosong</span>
        )}
      </span>
    </Link>
  );
}

/** Pesanan Makan di tempat tanpa meja (seperti app) + tombol membuat pesanan baru tanpa meja. */
function NoTableSection({ orders, outlet }: { orders: WaiterOrderBrief[]; outlet: string }) {
  return (
    <section aria-labelledby="tanpa-meja-judul" className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="tanpa-meja-judul" className="text-[16px] font-bold text-text-heading">
          Tanpa meja{orders.length ? ` · ${orders.length}` : ""}
        </h2>
        <Link
          href={`/karyawan/meja/tanpa-meja/tambah?o=${outlet}`}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border-subtle bg-white px-3.5 text-[14px] font-semibold text-text-heading hover:border-border-active ${focusRing}`}
        >
          <Plus size={16} aria-hidden /> Pesanan tanpa meja
        </Link>
      </div>
      {orders.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 min-[480px]:grid-cols-3">
          {orders.map((o) => (
            <li key={o.id}>
              <Link
                href={`/karyawan/meja/pesanan/${o.id}?o=${outlet}`}
                className={`flex min-h-[104px] flex-col rounded-[16px] border border-brand-primary/40 bg-brand-tint p-3.5 ${focusRing}`}
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-[16px] font-bold leading-tight text-text-heading">
                    <UserRound size={16} aria-hidden className="shrink-0" />
                    <span className="break-words">{o.customer_name || o.receipt_no}</span>
                  </span>
                  {o.bill_requested && (
                    <span title="Tagihan diminta" className="shrink-0 text-brand-deep">
                      <ReceiptText size={18} aria-label="Tagihan diminta" />
                    </span>
                  )}
                </span>
                <span className="mt-auto pt-3">
                  <span className="block text-[15px] font-bold tabular-nums text-text-heading">{formatRupiah(o.total)}</span>
                  <span className="block text-[13px] text-text-body">{o.item_count} item</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
