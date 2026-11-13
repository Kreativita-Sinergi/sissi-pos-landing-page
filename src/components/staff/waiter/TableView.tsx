"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Plus, ReceiptText } from "lucide-react";
import { focusRing, Spinner } from "@/components/admin/ui";
import { useStaff } from "@/components/staff/StaffShell";
import { formatRupiah } from "@/lib/selfOrder/pricing";
import { newKey, staffApi } from "@/lib/staff/api";
import type { WaiterOrder, WaiterTable } from "@/lib/staff/types";
import { pickOutlet, useRefresh, waiterEnabled, waiterErrorText } from "./shared";

// Rincian meja pelayan (/karyawan/meja/[id]): pesanan berjalan di meja itu, per ronde seperti rincian open bill di
// aplikasi, dengan tombol Tambah pesanan (atau Mulai pesanan bila kosong) dan Minta tagihan.

const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" });

export function TableView({ tableId }: { tableId: string }) {
  const { session } = useStaff();
  const params = useSearchParams();
  const [outlet] = useState<string | null>(() => pickOutlet(session, params.get("o")));
  const [table, setTable] = useState<WaiterTable | null>(null);
  const [order, setOrder] = useState<WaiterOrder | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);
  const [billing, setBilling] = useState(false);
  const [billMsg, setBillMsg] = useState<string | null>(null);
  const [billErr, setBillErr] = useState<string | null>(null);

  const load = useCallback(
    async (quiet = false) => {
      if (!outlet) return;
      try {
        const api = await staffApi();
        const floor = await api.waiterFloor(outlet);
        const t = floor.tables.find((x) => x.id === tableId) ?? null;
        setTable(t);
        const pick = t?.orders.find((o) => o.id === selected) ?? t?.orders[0] ?? null;
        setOrder(pick ? await api.waiterOrder(pick.id) : null);
        setError(null);
      } catch (err) {
        if (!quiet) setError(err);
      } finally {
        setLoaded(true);
      }
    },
    [outlet, tableId, selected]
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

  async function requestBill() {
    if (!order) return;
    setBilling(true);
    setBillErr(null);
    setBillMsg(null);
    try {
      setOrder(await (await staffApi()).waiterBillRequest(order.id, newKey()));
      setBillMsg("Tagihan dikirim ke printer kasir");
    } catch (err) {
      setBillErr(waiterErrorText(err));
      void load(true);
    } finally {
      setBilling(false);
    }
  }

  if (!waiterEnabled(session)) return <p className="text-[15px] text-text-body">Menu Meja hanya untuk Pelayan.</p>;

  const back = (
    <Link
      href="/karyawan/meja"
      className={`inline-flex min-h-10 items-center gap-1.5 self-start rounded-[10px] text-[14px] font-semibold text-text-body hover:text-text-heading ${focusRing}`}
    >
      <ArrowLeft size={17} aria-hidden /> Semua meja
    </Link>
  );

  if (!loaded) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <p role="status" className="flex items-center gap-2 py-10 text-[14px] text-text-muted">
          <Spinner /> Memuat meja…
        </p>
      </div>
    );
  }
  if (error || !table) {
    return (
      <div className="flex flex-col gap-4">
        {back}
        <div role="alert" className="rounded-[14px] border border-danger/25 bg-danger-tint px-4 py-3 text-[15px] text-danger">
          {error ? waiterErrorText(error) : "Meja tidak ditemukan atau sudah dinonaktifkan."}{" "}
          {error ? (
            <button type="button" onClick={() => void load()} className={`font-semibold underline ${focusRing}`}>
              Coba lagi
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const addHref = `/karyawan/meja/${table.id}/tambah?o=${outlet}${order ? `&s=${order.id}` : ""}`;
  const open = order?.status === "open";

  return (
    <div className="flex flex-col gap-4 pb-28">
      {back}
      <div>
        <h1 className="text-[24px] font-bold tracking-tight break-words text-text-heading">{table.name}</h1>
        {order && <p className="text-[14px] text-text-muted tabular-nums">{order.receipt_no}</p>}
      </div>

      {table.orders.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Pesanan di meja ini">
          {table.orders.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={o.id === order?.id}
              onClick={() => setSelected(o.id)}
              className={`min-h-10 rounded-full border px-3.5 text-[14px] font-semibold ${focusRing} ${
                o.id === order?.id ? "border-text-heading bg-text-heading text-white" : "border-border-subtle bg-white text-text-body"
              }`}
            >
              {o.customer_name || o.receipt_no}
            </button>
          ))}
        </div>
      )}

      {!order ? (
        <div className="rounded-[18px] border border-border-subtle bg-white px-5 py-8 text-center">
          <p className="text-[15px] text-text-body">Meja ini kosong. Ketuk Mulai pesanan untuk mencatat pesanan tamu.</p>
        </div>
      ) : (
        <>
          {!open && (
            <p className="rounded-[14px] border border-border-subtle bg-white px-4 py-3 text-[15px] text-text-body">
              Pesanan ini sudah ditagih kasir. Tambah pesanan lewat kasir.
            </p>
          )}
          {order.bill_requested && open && (
            <p className="flex items-center gap-2 rounded-[14px] bg-brand-tint px-4 py-3 text-[15px] font-medium text-brand-ink">
              <ReceiptText size={18} aria-hidden className="shrink-0" /> Tagihan sudah diminta
            </p>
          )}

          <section aria-label="Pesanan" className="rounded-[18px] border border-border-subtle bg-white">
            {order.rounds.length > 0 ? (
              <ol className="divide-y divide-border-subtle">
                {order.rounds.map((r) => (
                  <li key={r.id} className="px-4 py-3.5">
                    <p className="mb-2 text-[13px] font-semibold text-text-muted">
                      {r.round === 1 ? "Pesanan" : "Tambahan"} · {time.format(new Date(r.ordered_at))}
                      {r.created_by_name ? ` · ${r.created_by_name}` : ""}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {r.items.map((it, i) => (
                        <li key={i} className="flex gap-3 text-[15px]">
                          <span className="w-8 shrink-0 font-bold tabular-nums text-text-heading">{it.quantity}×</span>
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold text-text-heading">
                              {it.name}
                              {it.variant_name ? ` (${it.variant_name})` : ""}
                            </span>
                            {it.modifiers.length > 0 && (
                              <span className="block text-[13.5px] text-text-body">{it.modifiers.join(", ")}</span>
                            )}
                            {it.note && <span className="block text-[13.5px] text-text-body italic">“{it.note}”</span>}
                          </span>
                          {(it.status === "ready" || it.status === "served") && (
                            <span className="shrink-0 text-success" title={it.status === "served" ? "Diantar" : "Siap"}>
                              <Check size={18} aria-label={it.status === "served" ? "Diantar" : "Siap"} />
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            ) : null}
            <ItemsWithoutRound order={order} />
            <dl className="flex flex-col gap-1.5 border-t border-border-subtle px-4 py-3.5 text-[14.5px]">
              <Row label="Subtotal" value={order.subtotal} />
              {order.discount_total > 0 && <Row label="Diskon" value={-order.discount_total} />}
              {order.service_fee > 0 && <Row label="Biaya layanan" value={order.service_fee} />}
              {order.tax_total > 0 && <Row label="Pajak" value={order.tax_total} />}
              {order.rounding !== 0 && <Row label="Pembulatan" value={order.rounding} />}
              <div className="mt-1 flex items-baseline justify-between gap-3 text-[17px] font-bold text-text-heading">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatRupiah(order.total)}</dd>
              </div>
            </dl>
          </section>
        </>
      )}

      {(billMsg || billErr) && (
        <p
          role={billErr ? "alert" : "status"}
          className={`rounded-[14px] px-4 py-3 text-[15px] ${billErr ? "border border-danger/25 bg-danger-tint text-danger" : "bg-success-tint text-success"}`}
        >
          {billErr ?? billMsg}
        </p>
      )}

      {(!order || open) && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border-subtle bg-white/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-[640px] gap-2">
            {order && (
              <button
                type="button"
                onClick={requestBill}
                disabled={billing}
                className={`inline-flex min-h-[52px] flex-1 items-center justify-center gap-1.5 rounded-[14px] border border-border-subtle bg-white px-3 text-[15px] font-semibold whitespace-nowrap text-text-heading disabled:opacity-50 ${focusRing}`}
              >
                {billing ? <Spinner size={16} /> : <ReceiptText size={18} aria-hidden />} Minta tagihan
              </button>
            )}
            <Link
              href={addHref}
              className={`inline-flex min-h-[52px] flex-[1.3] items-center justify-center gap-1.5 rounded-[14px] bg-brand-deep px-3 text-[15px] font-bold whitespace-nowrap text-white hover:bg-brand-deeper ${focusRing}`}
            >
              <Plus size={18} aria-hidden /> {order ? "Tambah pesanan" : "Mulai pesanan"}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

/** Item yang tidak pernah masuk tiket dapur (tidak dimasak / dapur mati) tetap ditampilkan. */
function ItemsWithoutRound({ order }: { order: WaiterOrder }) {
  const inRounds = new Map<string, number>();
  for (const r of order.rounds)
    for (const it of r.items) {
      const k = `${it.name}|${it.variant_name ?? ""}`;
      inRounds.set(k, (inRounds.get(k) ?? 0) + it.quantity);
    }
  const rest: { name: string; quantity: number }[] = [];
  for (const it of order.items) {
    const k = `${it.name}|${it.variant_name ?? ""}`;
    const used = Math.min(inRounds.get(k) ?? 0, it.quantity);
    inRounds.set(k, (inRounds.get(k) ?? 0) - used);
    if (it.quantity - used > 0)
      rest.push({ name: `${it.name}${it.variant_name ? ` (${it.variant_name})` : ""}`, quantity: it.quantity - used });
  }
  if (rest.length === 0) return null;
  return (
    <div className={`px-4 py-3.5 ${order.rounds.length ? "border-t border-border-subtle" : ""}`}>
      {order.rounds.length > 0 && <p className="mb-2 text-[13px] font-semibold text-text-muted">Tidak ke dapur</p>}
      <ul className="flex flex-col gap-2">
        {rest.map((it, i) => (
          <li key={i} className="flex gap-3 text-[15px]">
            <span className="w-8 shrink-0 font-bold tabular-nums text-text-heading">{it.quantity}×</span>
            <span className="font-semibold text-text-heading">{it.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-text-body">
      <dt>{label}</dt>
      <dd className="tabular-nums">{value < 0 ? `−${formatRupiah(-value)}` : formatRupiah(value)}</dd>
    </div>
  );
}
