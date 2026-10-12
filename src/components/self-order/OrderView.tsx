"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, CircleCheck, Clock, WifiOff } from "lucide-react";
import { ApiError } from "@/lib/sissiApi";
import { newUuid, type SelfOrderApi } from "@/lib/selfOrder/api";
import { formatRate, formatRupiah } from "@/lib/selfOrder/pricing";
import type { StoredOrder } from "@/lib/selfOrder/storage";
import { FINAL_STATUSES, type OrderStatus, type OrderStatusResponse, type OrderType, type PublicOrder } from "@/lib/selfOrder/types";
import { ORDER_TYPE_LABEL } from "./CartSheet";
import { PaymentView } from "./PaymentView";
import { Sheet } from "./Sheet";
import { Notice, dangerButton, focusRing, primaryButton, secondaryButton, useNow } from "./ui";

const DEFAULT_POLL_S = 10;
const NO_RESPONSE_MS = 3 * 60 * 1000;

const STEP_INDEX: Partial<Record<OrderStatus, number>> = {
  awaiting_payment: 0,
  pending: 0,
  accepted: 1,
  preparing: 2,
  ready: 3,
  completed: 4,
};

function steps(order: PublicOrder): { title: string; at: string | null }[] {
  const ready = order.table ? "Siap diantar" : "Siap diambil";
  return [
    order.pay_mode === "online"
      ? { title: "Pesanan dikirim, menunggu pembayaran", at: order.created_at }
      : { title: "Pesanan dikirim", at: order.created_at },
    {
      title: order.pay_mode === "online" ? "Lunas, pesanan diterima" : "Dikonfirmasi kasir",
      at: order.accepted_at,
    },
    { title: "Sedang disiapkan", at: null },
    { title: ready, at: order.ready_at },
    { title: "Selesai", at: order.completed_at },
  ];
}

function clock(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function actionError(err: unknown, orderNo: string): string {
  if (!(err instanceof ApiError)) return "Terjadi kesalahan. Coba lagi.";
  switch (err.code) {
    case "PAYMENT_UNAVAILABLE":
      return `Pembayaran online sedang tidak tersedia. Tunjukkan nomor ${orderNo} ke kasir untuk membayar di sana.`;
    case "ORDER_NOT_PAYABLE":
      return "Pesanan ini tidak lagi menunggu pembayaran.";
    case "ORDER_NOT_CANCELABLE":
      return "Pesanan sudah diproses kasir, jadi tidak bisa dibatalkan dari sini. Silakan hubungi kasir.";
    case "RATE_LIMITED":
      return err.retryAfter
        ? `Terlalu banyak percobaan. Coba lagi dalam ${err.retryAfter} detik.`
        : "Terlalu banyak percobaan. Coba lagi sebentar lagi.";
    case "NETWORK_ERROR":
    case "TIMEOUT":
      return "Koneksi terputus. Periksa internet lalu coba lagi.";
    default:
      return err.message || "Terjadi kesalahan. Coba lagi.";
  }
}

export type AddMoreTarget = { group_key: string; order_no: string; order_type: OrderType };

export function OrderView({
  api,
  entry,
  initial,
  allowAdditional,
  storedIds,
  onSelectRound,
  onBackToMenu,
  onAddMore,
  onForget,
}: {
  api: SelfOrderApi;
  entry: StoredOrder;
  initial: OrderStatusResponse | null;
  allowAdditional: boolean;
  storedIds: string[];
  onSelectRound: (id: string) => void;
  onBackToMenu: () => void;
  onAddMore: (target: AddMoreTarget) => void;
  onForget: (id: string) => void;
}) {
  const [data, setData] = useState<OrderStatusResponse | null>(initial);
  const [gone, setGone] = useState(false);
  const [offline, setOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [nonce, setNonce] = useState(0);
  const payKey = useRef<string | null>(null);
  const cancelKey = useRef<string | null>(null);
  const now = useNow(1000);

  const order = data?.order ?? null;
  const status = order?.status;
  const isFinal = !!status && FINAL_STATUSES.includes(status);

  // Poll status: jeda dari server (poll_after_s, bawaan 10 dtk), berhenti saat tab tersembunyi
  // atau pesanan final; dilanjutkan segera saat tab terlihat lagi.
  useEffect(() => {
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let inFlight = false;

    const schedule = (seconds: number) => {
      clearTimeout(timer);
      timer = setTimeout(tick, Math.max(3, seconds) * 1000);
    };

    async function tick() {
      if (stopped || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const res = await api.getOrder(entry.id, entry.access_key, ctrl.signal);
        setData(res);
        setOffline(false);
        setLoadError(null);
        if (res.poll_after_s === null) {
          stopped = true;
          return;
        }
        schedule(res.poll_after_s ?? DEFAULT_POLL_S);
      } catch (err) {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError && err.code === "NOT_FOUND") {
          stopped = true;
          setGone(true);
          return;
        }
        if (err instanceof ApiError && err.isNetwork) {
          setOffline(true);
          schedule(15);
        } else if (err instanceof ApiError && err.code === "RATE_LIMITED") {
          schedule(err.retryAfter ?? 30);
        } else {
          setLoadError(err instanceof ApiError ? err.message : "Status pesanan gagal dimuat.");
          schedule(20);
        }
      } finally {
        inFlight = false;
      }
    }

    const onVisible = () => {
      if (!document.hidden && !stopped) {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    timer = setTimeout(tick, 0);
    return () => {
      stopped = true;
      ctrl.abort();
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [api, entry.id, entry.access_key, nonce]);

  const merge = useCallback((patch: Partial<Pick<OrderStatusResponse, "order" | "payment">>) => {
    setData((d) => (d ? { ...d, ...patch } : d));
  }, []);

  const regenerate = async () => {
    if (!order) return;
    setBusy("pay");
    setPayError(null);
    payKey.current ??= newUuid();
    try {
      const res = await api.createPayment(order.id, entry.access_key, payKey.current);
      payKey.current = null;
      merge({ order: res.order, payment: res.payment });
    } catch (err) {
      if (!(err instanceof ApiError && err.isNetwork)) payKey.current = null;
      if (err instanceof ApiError && err.code === "NOT_FOUND") setGone(true);
      if (err instanceof ApiError && err.code === "ORDER_NOT_PAYABLE") setNonce((n) => n + 1);
      setPayError(actionError(err, order.order_no));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    if (!order) return;
    setBusy("cancel");
    setCancelError(null);
    cancelKey.current ??= newUuid();
    try {
      const res = await api.cancelOrder(order.id, entry.access_key, cancelKey.current);
      cancelKey.current = null;
      merge({ order: res.order });
      setConfirmCancel(false);
      setNonce((n) => n + 1);
    } catch (err) {
      if (!(err instanceof ApiError && err.isNetwork)) cancelKey.current = null;
      if (err instanceof ApiError && err.code === "ORDER_NOT_CANCELABLE") setNonce((n) => n + 1);
      setCancelError(actionError(err, order.order_no));
    } finally {
      setBusy(null);
    }
  };

  const backBar = (
    <div className="sticky top-0 z-10 border-b border-border-subtle bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[640px] items-center px-2 py-1.5">
        <button
          type="button"
          onClick={onBackToMenu}
          className={`inline-flex min-h-[44px] items-center gap-2 rounded-[10px] px-3 text-[16px] font-semibold text-text-heading hover:bg-bg-muted ${focusRing}`}
        >
          <ArrowLeft size={20} aria-hidden /> Menu
        </button>
      </div>
    </div>
  );

  if (gone) {
    return (
      <div className="min-h-dvh bg-bg-muted">
        {backBar}
        <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 py-8">
          <h1 className="text-[22px] font-bold">Pesanan tidak dapat ditampilkan</h1>
          <p className="text-[16px] leading-relaxed text-text-body">
            Pesanan {entry.order_no} tidak ditemukan lagi — kemungkinan QR meja sudah diganti. Bila pesananmu
            sudah dikirim, sebutkan nomor <strong className="text-text-heading">{entry.order_no}</strong> ke kasir.
          </p>
          <button type="button" className={primaryButton} onClick={() => onForget(entry.id)}>
            Kembali ke menu
          </button>
        </main>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-dvh bg-bg-muted">
        {backBar}
        <main className="mx-auto max-w-[640px] px-4 py-10 text-center" aria-busy={!loadError && !offline}>
          {offline ? (
            <Notice tone="warning" role="status">
              Koneksi terputus. Status pesanan {entry.order_no} dimuat otomatis saat tersambung.
            </Notice>
          ) : loadError ? (
            <Notice tone="danger" role="alert">{loadError}</Notice>
          ) : (
            <p className="text-[16px] text-text-body">Memuat status pesanan…</p>
          )}
        </main>
      </div>
    );
  }

  const createdMs = Date.parse(order.created_at);
  const noResponse = status === "pending" && now > 0 && Number.isFinite(createdMs) && now - createdMs > NO_RESPONSE_MS;
  const stepIndex = STEP_INDEX[order.status];
  const canCancel = status === "pending" || status === "awaiting_payment";
  const group = data?.group;
  const canAdd = !!group?.can_add && allowAdditional;
  const where = order.table ? [order.table.name, order.table.area_name].filter(Boolean).join(" · ") : null;

  return (
    <div className="min-h-dvh bg-bg-muted pb-10">
      {backBar}
      <main className="mx-auto flex max-w-[640px] flex-col gap-4 px-4 pt-4">
        {offline && (
          <Notice tone="warning" role="status">
            <span className="inline-flex items-center gap-2">
              <WifiOff size={16} aria-hidden /> Koneksi terputus. Status diperbarui otomatis saat tersambung.
            </span>
          </Notice>
        )}

        <section aria-labelledby="nomor-pesanan" className="rounded-[20px] border border-border-subtle bg-white p-5 text-center">
          <p id="nomor-pesanan" className="text-[15px] font-medium text-text-body">
            Nomor pesanan{order.round > 1 ? ` · tambahan ke-${order.round - 1}` : ""}
          </p>
          <p className="mt-1 text-[56px] font-bold leading-none tracking-tight text-text-heading tabular-nums">
            {order.order_no}
          </p>
          <p className="mt-3 text-[15px] text-text-body">
            {[where, ORDER_TYPE_LABEL[order.order_type], order.customer_name].filter(Boolean).join(" · ")}
          </p>
          <p
            role="status"
            aria-live="polite"
            className={`mt-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[17px] font-semibold ${
              status === "rejected" || status === "canceled" || status === "expired"
                ? "bg-danger-tint text-danger"
                : status === "ready" || status === "completed"
                  ? "bg-success-tint text-success"
                  : "bg-brand-tint text-text-heading"
            }`}
          >
            {order.status_label}
          </p>
        </section>

        {/* Langkah berikutnya untuk pelanggan */}
        {status === "pending" && (
          <Notice tone="info">
            <span className="block text-[17px] font-semibold text-text-heading">
              Tunjukkan nomor {order.order_no} ke kasir
            </span>
            Kasir akan mengonfirmasi pesananmu. Pembayaran dilakukan di kasir.
          </Notice>
        )}
        {noResponse && (
          <Notice tone="warning" role="status">
            <span className="inline-flex items-start gap-2">
              <Clock size={18} aria-hidden className="mt-0.5 shrink-0" />
              <span>
                Kasir belum merespons. Silakan datangi kasir dan sebutkan nomor{" "}
                <strong>{order.order_no}</strong>.
              </span>
            </span>
          </Notice>
        )}
        {status === "awaiting_payment" && (
          <section aria-label="Pembayaran" className="rounded-[20px] border border-border-subtle bg-white p-5">
            <PaymentView
              order={order}
              payment={data?.payment ?? null}
              now={now}
              busy={busy === "pay"}
              error={payError}
              onRegenerate={regenerate}
            />
          </section>
        )}
        {order.pay_mode === "online" && data?.payment?.status === "paid" && !isFinal && (
          <Notice tone="success" role="status">
            <span className="inline-flex items-center gap-2">
              <CircleCheck size={18} aria-hidden /> Pembayaran {formatRupiah(data.payment.amount)} berhasil. Terima kasih!
            </span>
          </Notice>
        )}
        {order.pay_mode === "cashier" && (status === "accepted" || status === "preparing" || status === "ready") && (
          <Notice tone="info">Pembayaran di kasir — sebutkan nomor {order.order_no}.</Notice>
        )}
        {status === "ready" && (
          <Notice tone="success" role="status">
            {order.table
              ? `Pesananmu segera diantar ke ${order.table.name}.`
              : `Silakan ambil pesanan di konter dengan nomor ${order.order_no}.`}
          </Notice>
        )}
        {status === "rejected" && (
          <Notice tone="danger" role="alert">
            <span className="block font-semibold">Maaf, pesanan ditolak kasir.</span>
            {order.reject_reason ? `Alasan: ${order.reject_reason}` : "Silakan tanyakan ke kasir."}
          </Notice>
        )}
        {status === "canceled" && <Notice tone="danger">Pesanan ini sudah dibatalkan.</Notice>}
        {status === "expired" && (
          <Notice tone="danger" role="alert">
            {order.pay_mode === "online"
              ? "Waktu pembayaran habis, jadi pesanan dibatalkan otomatis. Kamu bisa memesan ulang dari menu."
              : "Pesanan tidak dikonfirmasi kasir tepat waktu. Silakan pesan ulang atau hubungi kasir."}
          </Notice>
        )}
        {loadError && <Notice tone="danger" role="alert">{loadError}</Notice>}

        {stepIndex !== undefined && (
          <section aria-labelledby="judul-progres" className="rounded-[20px] border border-border-subtle bg-white p-5">
            <h2 id="judul-progres" className="mb-4 text-[18px] font-bold">
              Perkembangan pesanan
            </h2>
            <ol className="flex flex-col">
              {steps(order).map((s, i) => {
                const done = i < stepIndex || (i === stepIndex && status === "completed");
                const current = i === stepIndex && status !== "completed";
                const last = i === 4;
                return (
                  <li key={i} aria-current={current ? "step" : undefined} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                          done
                            ? "border-success bg-success text-white"
                            : current
                              ? "border-brand-primary bg-brand-tint"
                              : "border-border-subtle bg-white"
                        }`}
                      >
                        {done ? (
                          <Check size={16} aria-hidden />
                        ) : current ? (
                          <span className="h-2.5 w-2.5 rounded-full bg-brand-primary" />
                        ) : null}
                      </span>
                      {!last && <span className={`w-0.5 flex-1 ${done ? "bg-success" : "bg-border-subtle"}`} />}
                    </div>
                    <div className={`pb-5 ${last ? "pb-0" : ""}`}>
                      <p
                        className={`text-[16px] leading-7 ${
                          current ? "font-semibold text-text-heading" : done ? "text-text-heading" : "text-text-muted"
                        }`}
                      >
                        {s.title}
                        <span className="sr-only">{done ? " (selesai)" : current ? " (sekarang)" : ""}</span>
                      </p>
                      {(done || current) && clock(s.at) && <p className="text-[14px] text-text-muted">{clock(s.at)}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section aria-labelledby="judul-rincian" className="rounded-[20px] border border-border-subtle bg-white p-5">
          <h2 id="judul-rincian" className="mb-3 text-[18px] font-bold">
            Rincian pesanan
          </h2>
          <ul className="flex flex-col gap-3">
            {order.items.map((it, i) => {
              const details = [it.variant_name, ...it.modifiers.map((m) => m.name)].filter(Boolean).join(", ");
              const lineTotal = (it.unit_price + it.modifiers.reduce((s, m) => s + m.price, 0)) * it.quantity;
              return (
                <li key={i} className="flex items-start gap-3 text-[15px]">
                  <span className="w-7 shrink-0 font-semibold tabular-nums">{it.quantity}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-text-heading">{it.name}</span>
                    {details && <span className="block text-[14px] text-text-body">{details}</span>}
                    {it.note && <span className="block text-[14px] italic text-text-body">“{it.note}”</span>}
                  </span>
                  <span className="tabular-nums">{formatRupiah(lineTotal)}</span>
                </li>
              );
            })}
          </ul>
          {order.note && <p className="mt-3 text-[14px] text-text-body">Catatan: {order.note}</p>}
          <dl className="mt-4 flex flex-col gap-1.5 border-t border-border-subtle pt-3 text-[15px]">
            <SumRow label="Subtotal" value={order.subtotal} />
            {order.service_fee > 0 && <SumRow label="Biaya layanan" value={order.service_fee} />}
            {order.taxes.map((t, i) => (
              <SumRow key={i} label={`${t.name} (${formatRate(t.rate_bp)})`} value={t.amount} />
            ))}
            <div className="mt-1 flex items-baseline justify-between">
              <dt className="text-[17px] font-bold">Total</dt>
              <dd className="text-[19px] font-bold tabular-nums">{formatRupiah(order.total)}</dd>
            </div>
          </dl>
        </section>

        {group && group.rounds.length > 1 && (
          <section aria-labelledby="judul-ronde" className="rounded-[20px] border border-border-subtle bg-white p-5">
            <h2 id="judul-ronde" className="mb-3 text-[18px] font-bold">
              Semua pesanan {order.order_no}
            </h2>
            <ul className="flex flex-col divide-y divide-border-subtle">
              {group.rounds.map((r) => {
                const mine = r.id === order.id;
                const known = storedIds.includes(r.id);
                const label = r.round === 1 ? "Pesanan pertama" : `Tambahan ke-${r.round - 1}`;
                const content = (
                  <>
                    <span className="flex-1 text-left">
                      <span className="block font-semibold text-text-heading">{label}</span>
                      <span className="block text-[14px] text-text-body">{r.status_label}</span>
                    </span>
                    <span className="tabular-nums">{formatRupiah(r.total)}</span>
                  </>
                );
                return (
                  <li key={r.id}>
                    {known && !mine ? (
                      <button
                        type="button"
                        onClick={() => onSelectRound(r.id)}
                        className={`flex min-h-[52px] w-full items-center gap-3 py-2 text-[15px] ${focusRing}`}
                      >
                        {content}
                      </button>
                    ) : (
                      <div
                        className={`flex min-h-[52px] items-center gap-3 py-2 text-[15px] ${mine ? "font-semibold" : ""}`}
                        aria-current={mine ? "true" : undefined}
                      >
                        {content}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-2.5 pt-1">
          {canAdd && (
            <button
              type="button"
              className={primaryButton}
              onClick={() => onAddMore({ group_key: entry.group_key, order_no: order.order_no, order_type: order.order_type })}
            >
              Pesan lagi
            </button>
          )}
          {isFinal && !canAdd && (
            <button type="button" className={primaryButton} onClick={onBackToMenu}>
              {status === "completed" ? "Pesan menu lain" : "Pesan ulang dari menu"}
            </button>
          )}
          {canCancel && (
            <button type="button" className={secondaryButton} onClick={() => setConfirmCancel(true)}>
              Batalkan pesanan
            </button>
          )}
        </div>
      </main>

      <Sheet
        open={confirmCancel}
        onClose={() => busy !== "cancel" && setConfirmCancel(false)}
        title={`Batalkan pesanan ${order.order_no}?`}
        footer={
          <div className="flex flex-col gap-2">
            <button type="button" className={dangerButton} onClick={cancel} disabled={busy === "cancel"}>
              {busy === "cancel" ? "Membatalkan…" : "Ya, batalkan"}
            </button>
            <button type="button" className={secondaryButton} onClick={() => setConfirmCancel(false)} disabled={busy === "cancel"}>
              Tidak jadi
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="text-[16px] leading-relaxed text-text-body">
            Pesanan yang sudah dikonfirmasi kasir tidak bisa dibatalkan dari sini.
          </p>
          {cancelError && <Notice tone="danger" role="alert">{cancelError}</Notice>}
        </div>
      </Sheet>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-body">{label}</dt>
      <dd className="tabular-nums">{formatRupiah(value)}</dd>
    </div>
  );
}
