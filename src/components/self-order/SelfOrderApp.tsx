"use client";

import React, { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Clock, PlusCircle, QrCode as QrIcon, RefreshCw, Store, WifiOff } from "lucide-react";
import { ApiError } from "@/lib/sissiApi";
import { newUuid, selfOrderApi, type SelfOrderApi } from "@/lib/selfOrder/api";
import {
  addLine,
  countItems,
  resolveLine,
  setQuantity,
  toOrderItems,
  type CartLine,
} from "@/lib/selfOrder/cart";
import { computeBreakdown, formatRate, formatRupiah } from "@/lib/selfOrder/pricing";
import {
  loadCart,
  loadOrders,
  loadSessionView,
  nowMs,
  saveCart,
  saveOrders,
  saveSessionView,
  type StoredOrder,
} from "@/lib/selfOrder/storage";
import type { CreateOrderBody, Menu, OrderStatusResponse, OrderType } from "@/lib/selfOrder/types";
import { CartBar, CartSheet, type CartFieldErrors } from "./CartSheet";
import { ItemSheet } from "./ItemSheet";
import { MenuView } from "./MenuView";
import { OrderView, type AddMoreTarget } from "./OrderView";
import { Sheet } from "./Sheet";
import { EmptyState, Frame, focusRing, primaryButton, secondaryButton, useNow } from "./ui";

const CODE_RE = /^[A-Za-z0-9_-]{1,64}$/;
// Pesanan tersimpan yang lebih baru dari ini langsung dibuka saat halaman dimuat ulang.
const REOPEN_ORDER_MS = 2 * 60 * 60 * 1000;

type MenuState = { status: "loading" } | { status: "error"; error: unknown } | { status: "ready"; menu: Menu };
type View = { name: "menu" } | { name: "order"; id: string };

export function SelfOrderApp({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = use(params);
  if (!CODE_RE.test(kode)) return <ErrorScreen error={new ApiError("", 404, "NOT_FOUND")} />;
  return <SelfOrder key={kode} code={kode} />;
}

function SelfOrder({ code }: { code: string }) {
  const [api, setApi] = useState<SelfOrderApi | null>(null);
  const [menuState, setMenuState] = useState<MenuState>({ status: "loading" });
  const [cart, setCart] = useState<CartLine[]>([]);
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [view, setView] = useState<View>({ name: "menu" });
  const [productId, setProductId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [orderType, setOrderType] = useState<OrderType | null>(null);
  const [tableId, setTableId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [addTo, setAddTo] = useState<AddMoreTarget | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<React.ReactNode | null>(null);
  const [fieldErrors, setFieldErrors] = useState<CartFieldErrors>({});
  const [flagged, setFlagged] = useState<Set<string>>(() => new Set());
  const [retryUntil, setRetryUntil] = useState(0);
  const [priceConfirm, setPriceConfirm] = useState<{ previous: number } | null>(null);
  const [initialStatus, setInitialStatus] = useState<Record<string, OrderStatusResponse>>({});
  const idem = useRef<{ body: string; key: string } | null>(null);
  const now = useNow(1000, retryUntil > 0);
  const retryIn = retryUntil > 0 && now > 0 ? Math.max(0, Math.ceil((retryUntil - now) / 1000)) : 0;

  const fetchMenu = useCallback(
    async (a: SelfOrderApi, fresh: boolean): Promise<Menu | null> => {
      try {
        const menu = await a.getMenu(code, { fresh });
        setMenuState({ status: "ready", menu });
        return menu;
      } catch (err) {
        // Muat ulang setelah galat kirim: menu lama tetap dipakai bila gagal.
        if (!fresh) setMenuState({ status: "error", error: err });
        return null;
      }
    },
    [code]
  );

  // Awal: klien API, keranjang & pesanan dari localStorage, lalu menu.
  useEffect(() => {
    let alive = true;
    selfOrderApi().then((a) => {
      if (!alive) return;
      const storedOrders = loadOrders(code);
      setApi(a);
      setCart(loadCart(code));
      setOrders(storedOrders);
      setHydrated(true);
      const saved = loadSessionView(code);
      const latest = storedOrders[storedOrders.length - 1];
      if (saved && (saved.view.name === "menu" || storedOrders.some((o) => o.id === (saved.view as { id: string }).id))) {
        // Muat ulang di tab yang sama: kembali ke layar terakhir (termasuk mode "Pesan lagi").
        setView(saved.view);
        if (saved.addTo && storedOrders.some((o) => o.group_key === saved.addTo!.group_key)) {
          setAddTo(saved.addTo as AddMoreTarget);
        }
      } else if (latest && Date.now() - latest.saved_at < REOPEN_ORDER_MS) {
        setView({ name: "order", id: latest.id });
      }
      void fetchMenu(a, false);
    });
    return () => {
      alive = false;
    };
  }, [code, fetchMenu]);

  useEffect(() => {
    if (hydrated) saveCart(code, cart);
  }, [code, cart, hydrated]);

  useEffect(() => {
    if (hydrated) saveSessionView(code, { view, addTo });
  }, [code, view, addTo, hydrated]);

  const menu = menuState.status === "ready" ? menuState.menu : null;

  useEffect(() => {
    if (menu) document.title = `Pesan · ${menu.outlet.name}`;
  }, [menu]);

  const updateOrders = (fn: (prev: StoredOrder[]) => StoredOrder[]) => {
    setOrders((prev) => {
      const next = fn(prev);
      saveOrders(code, next);
      return next;
    });
  };

  const resolved = useMemo(() => (menu ? cart.map((l) => resolveLine(l, menu)) : []), [cart, menu]);
  const effectiveType: OrderType =
    addTo?.order_type ??
    (menu && orderType && menu.mode.order_types.includes(orderType)
      ? orderType
      : (menu?.mode.order_types[0] ?? "dine_in"));
  const breakdown = useMemo(
    () =>
      computeBreakdown(
        resolved.filter((l) => !l.issue),
        menu?.pricing ?? { taxes: [], service_fee: { enabled: false, type: "percent", rate_bp: 0, amount: 0, order_types: [], taxable: false } },
        effectiveType
      ),
    [resolved, menu, effectiveType]
  );
  const quantities = useMemo(() => {
    const q: Record<string, number> = {};
    for (const l of cart) q[l.productId] = (q[l.productId] ?? 0) + l.quantity;
    return q;
  }, [cart]);

  const changeQuantity = (key: string, qty: number) => {
    setCart((c) => setQuantity(c, key, qty));
    if (qty <= 0 && flagged.has(key)) {
      const next = new Set(flagged);
      next.delete(key);
      setFlagged(next);
    }
    setSubmitError(null);
  };

  const submit = async () => {
    if (!api || !menu || submitting || retryIn > 0) return;
    if (resolved.some((l) => l.issue || flagged.has(l.key))) {
      setSubmitError("Hapus item yang habis atau tidak tersedia dulu.");
      return;
    }
    const errs: CartFieldErrors = {};
    const needTable = !addTo && menu.mode.table_select === "choose" && effectiveType === "dine_in" && !!menu.tables;
    if (needTable && !menu.tables?.some((t) => t.id === tableId)) errs.table = "Pilih meja tempat kamu duduk.";
    if (!addTo && menu.mode.require_customer_name && !customerName.trim()) errs.name = "Isi nama pemesan.";
    setFieldErrors(errs);
    if (errs.table || errs.name) {
      setSubmitError("Lengkapi data yang ditandai dulu.");
      return;
    }

    const sentKeys = cart.map((l) => l.key);
    const body: CreateOrderBody = {
      table_id: addTo
        ? null
        : menu.mode.table_select === "per_table"
          ? (menu.table?.id ?? null)
          : needTable
            ? tableId
            : null,
      order_type: effectiveType,
      customer_name: addTo ? "" : customerName.trim(),
      note: note.trim(),
      group_key: addTo?.group_key ?? null,
      expected_total: breakdown.total,
      items: toOrderItems(cart),
    };
    // Isi sama → Idempotency-Key sama (aman diulang setelah koneksi putus); isi berubah → kunci baru.
    const bodyJson = JSON.stringify(body);
    if (idem.current?.body !== bodyJson) idem.current = { body: bodyJson, key: newUuid() };

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await api.createOrder(code, body, idem.current.key);
      idem.current = null;
      const entry: StoredOrder = {
        id: res.order.id,
        access_key: res.access_key,
        group_key: res.group_key,
        order_no: res.order.order_no,
        saved_at: nowMs(),
      };
      updateOrders((prev) => [...prev.filter((o) => o.id !== entry.id), entry]);
      setInitialStatus((m) => ({
        ...m,
        [entry.id]: {
          order: res.order,
          payment: res.payment,
          group: { id: res.order.group_id, can_add: false, rounds: [] },
          poll_after_s: 10,
        },
      }));
      setCart([]);
      setNote("");
      setAddTo(null);
      setFlagged(new Set());
      setFieldErrors({});
      setPriceConfirm(null);
      setCartOpen(false);
      setView({ name: "order", id: entry.id });
      window.scrollTo(0, 0);
    } catch (err) {
      await handleSubmitError(err, body, sentKeys);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitError = async (err: unknown, body: CreateOrderBody, sentKeys: string[]) => {
    setPriceConfirm(null);
    setCartOpen(true);
    if (!(err instanceof ApiError)) {
      setSubmitError("Terjadi kesalahan. Coba kirim lagi.");
      return;
    }
    if (err.isNetwork) {
      // Kunci idempotensi dipertahankan: kirim ulang tidak membuat pesanan ganda.
      setSubmitError("Koneksi terputus, pesanan mungkin belum terkirim. Tekan kirim lagi — pesanan tidak akan tercatat dua kali.");
      return;
    }
    idem.current = null;
    switch (err.code) {
      case "PRICE_CHANGED": {
        const fresh = await fetchMenu(api!, true);
        if (fresh) {
          setCartOpen(false);
          setPriceConfirm({ previous: body.expected_total });
        } else {
          setSubmitError("Harga menu berubah. Muat ulang halaman untuk melihat harga terbaru.");
        }
        return;
      }
      case "OUT_OF_STOCK": {
        const keys = err.details
          .map((d) => /^items\[(\d+)\]/.exec(d.field)?.[1])
          .filter((i): i is string => i !== undefined)
          .map((i) => sentKeys[Number(i)])
          .filter(Boolean);
        setFlagged(new Set(keys));
        await fetchMenu(api!, true);
        const names = err.details.map((d) => d.message).filter(Boolean);
        setSubmitError(
          `${names.length ? names.join(", ") + "." : "Ada item yang habis."} Hapus item yang ditandai untuk melanjutkan.`
        );
        return;
      }
      case "SELF_ORDER_CLOSED":
      case "NOT_FOUND":
        setCartOpen(false);
        setMenuState({ status: "error", error: err });
        return;
      case "TOO_MANY_PENDING":
        setSubmitError(
          "Masih ada pesanan yang belum dibayar di kasir. Bayar dulu di kasir, lalu kirim lagi."
        );
        return;
      case "RATE_LIMITED":
        setRetryUntil(nowMs() + (err.retryAfter ?? 30) * 1000);
        setSubmitError("Terlalu banyak percobaan. Tunggu sebentar lalu kirim lagi.");
        return;
      case "SERVICE_UNAVAILABLE":
        setSubmitError("Layanan sedang sibuk. Coba kirim lagi sebentar lagi.");
        return;
      case "VALIDATION_ERROR": {
        const errs: CartFieldErrors = {};
        const other: string[] = [];
        let groupClosed = false;
        for (const d of err.details) {
          if (d.field === "customer_name") errs.name = d.message;
          else if (d.field === "table_id") errs.table = d.message;
          else if (d.field === "group_key") groupClosed = true;
          else other.push(d.message);
        }
        setFieldErrors(errs);
        if (groupClosed) {
          setAddTo(null);
          setSubmitError(
            "Pesanan sebelumnya sudah selesai, jadi ini akan dikirim sebagai pesanan baru. Periksa lalu kirim lagi."
          );
        } else {
          setSubmitError(other[0] ?? (errs.name || errs.table ? "Lengkapi data yang ditandai dulu." : err.message));
        }
        return;
      }
      default:
        setSubmitError(err.message || "Terjadi kesalahan. Coba kirim lagi.");
    }
  };

  const retryMenu = () => {
    if (!api) return;
    setMenuState({ status: "loading" });
    void fetchMenu(api, false);
  };

  const latestOrder = orders[orders.length - 1] ?? null;
  const currentEntry = view.name === "order" ? orders.find((o) => o.id === view.id) : undefined;

  // ---------- Status pesanan ----------
  if (api && currentEntry) {
    return (
      <OrderView
        key={currentEntry.id}
        api={api}
        entry={currentEntry}
        initial={initialStatus[currentEntry.id] ?? null}
        allowAdditional={menu?.mode.allow_additional_orders ?? true}
        storedIds={orders.map((o) => o.id)}
        onSelectRound={(id) => setView({ name: "order", id })}
        onBackToMenu={() => setView({ name: "menu" })}
        onAddMore={(target) => {
          setAddTo(target);
          setSubmitError(null);
          setView({ name: "menu" });
          window.scrollTo(0, 0);
        }}
        onForget={(id) => {
          updateOrders((prev) => prev.filter((o) => o.id !== id));
          setView({ name: "menu" });
        }}
      />
    );
  }

  // ---------- Menu ----------
  if (menuState.status === "error") {
    return (
      <ErrorScreen
        error={menuState.error}
        onRetry={retryMenu}
        order={latestOrder}
        onOpenOrder={latestOrder ? () => setView({ name: "order", id: latestOrder.id }) : undefined}
      />
    );
  }
  if (!menu) return <LoadingScreen />;

  const product = productId ? (menu.products.find((p) => p.id === productId) ?? null) : null;
  const count = countItems(cart);

  const banner = addTo ? (
    <div className="flex items-center gap-3 rounded-[18px] border-2 border-brand-primary bg-white py-2.5 pr-2 pl-3 shadow-so-card">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-brand-tint text-brand-deep">
        <PlusCircle size={20} aria-hidden />
      </span>
      <p className="flex-1 text-[15px] leading-snug text-text-body">
        <span className="block font-bold text-text-heading">Menambah pesanan {addTo.order_no}.</span> Pilih menu, lalu kirim dari keranjang.
      </p>
      <button
        type="button"
        onClick={() => setAddTo(null)}
        className={`min-h-[44px] shrink-0 rounded-[12px] px-3 text-[15px] font-bold text-text-heading hover:bg-so-canvas ${focusRing}`}
      >
        Batal
      </button>
    </div>
  ) : latestOrder ? (
    <button
      type="button"
      onClick={() => setView({ name: "order", id: latestOrder.id })}
      className={`flex min-h-[60px] w-full items-center gap-3 rounded-[18px] bg-white py-2.5 pr-3 pl-3 text-left shadow-so-card ${focusRing}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-success-tint text-success">
        <Clock size={20} aria-hidden />
      </span>
      <span className="flex-1 text-[15px] leading-snug text-text-body">
        <span className="block font-bold text-text-heading">Pesanan {latestOrder.order_no}</span>
        Ketuk untuk melihat status
      </span>
      <ChevronRight size={20} aria-hidden className="text-text-muted" />
    </button>
  ) : null;

  return (
    <>
      <MenuView
        menu={menu}
        quantities={quantities}
        onOpen={(p) => setProductId(p.id)}
        banner={banner}
        cartBar={
          !cartOpen && !product ? (
            <CartBar
              count={count}
              total={breakdown.total}
              onOpen={() => {
                setSubmitError(null);
                setCartOpen(true);
              }}
            />
          ) : null
        }
      />

      <ItemSheet
        product={product}
        inCart={product ? (quantities[product.id] ?? 0) : 0}
        onClose={() => setProductId(null)}
        onAdd={(line) => {
          setCart((c) => addLine(c, line));
          setProductId(null);
        }}
      />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        menu={menu}
        lines={resolved}
        flagged={flagged}
        breakdown={breakdown}
        orderType={effectiveType}
        onOrderType={setOrderType}
        tableId={tableId}
        onTable={(id) => {
          setTableId(id);
          setFieldErrors((f) => ({ ...f, table: undefined }));
        }}
        customerName={customerName}
        onCustomerName={(v) => {
          setCustomerName(v);
          if (fieldErrors.name) setFieldErrors((f) => ({ ...f, name: undefined }));
        }}
        note={note}
        onNote={setNote}
        addTo={addTo}
        onQuantity={changeQuantity}
        onSubmit={submit}
        submitting={submitting}
        error={submitError}
        fieldErrors={fieldErrors}
        retryIn={retryIn}
      />

      <Sheet
        open={!!priceConfirm}
        onClose={() => setPriceConfirm(null)}
        title="Harga sudah berubah"
        subtitle="Beberapa harga atau pajak diperbarui outlet sejak menu dibuka."
        footer={
          <div className="flex flex-col gap-2">
            <button type="button" className={primaryButton} onClick={submit} disabled={submitting || count === 0}>
              {submitting ? "Mengirim pesanan…" : `Kirim dengan total ${formatRupiah(breakdown.total)}`}
            </button>
            <button
              type="button"
              className={secondaryButton}
              onClick={() => {
                setPriceConfirm(null);
                setCartOpen(true);
              }}
            >
              Periksa keranjang
            </button>
          </div>
        }
      >
        {priceConfirm && (
          <dl className="flex flex-col gap-2 rounded-[18px] border border-so-line bg-so-canvas px-4 py-3.5 text-[15px]">
            <div className="flex justify-between gap-3 text-text-muted">
              <dt>Total sebelumnya</dt>
              <dd className="tabular-nums line-through">{formatRupiah(priceConfirm.previous)}</dd>
            </div>
            <div className="mt-2 flex justify-between gap-3">
              <dt className="text-text-body">Subtotal</dt>
              <dd className="tabular-nums">{formatRupiah(breakdown.subtotal)}</dd>
            </div>
            {breakdown.serviceFee > 0 && (
              <div className="flex justify-between gap-3">
                <dt className="text-text-body">Biaya layanan</dt>
                <dd className="tabular-nums">{formatRupiah(breakdown.serviceFee)}</dd>
              </div>
            )}
            {breakdown.taxes.map((t) => (
              <div key={t.id} className="flex justify-between gap-3">
                <dt className="text-text-body">
                  {t.name} ({formatRate(t.rateBp)})
                </dt>
                <dd className="tabular-nums">{formatRupiah(t.amount)}</dd>
              </div>
            ))}
            <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-border-active pt-3">
              <dt className="text-[17px] font-bold">Total terbaru</dt>
              <dd className="text-[22px] font-extrabold tabular-nums tracking-tight">{formatRupiah(breakdown.total)}</dd>
            </div>
          </dl>
        )}
      </Sheet>
    </>
  );
}

function LoadingScreen() {
  const bone = "animate-pulse bg-so-line";
  return (
    <Frame>
      <div aria-busy="true">
        <div className="bg-white px-4 pt-5 pb-4">
          <div className="flex items-center gap-3.5">
            <div className={`h-14 w-14 rounded-full ${bone}`} />
            <div className="flex flex-1 flex-col gap-2">
              <div className={`h-6 w-40 rounded-[8px] ${bone}`} />
              <div className={`h-4 w-52 rounded-[6px] ${bone}`} />
              <div className={`h-3.5 w-32 rounded-[6px] ${bone}`} />
            </div>
          </div>
          <div className={`mt-3.5 h-11 rounded-[14px] ${bone}`} />
        </div>
        <div className="flex h-14 items-center gap-5 border-b border-so-line px-5">
          {[64, 80, 72].map((w) => (
            <div key={w} className={`h-5 rounded-[6px] ${bone}`} style={{ width: w }} />
          ))}
        </div>
        <div className="flex flex-col gap-3 px-4 pt-6">
          <div className={`mb-1 h-6 w-28 rounded-[6px] ${bone}`} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3.5 rounded-[20px] bg-white p-3 pl-4 shadow-so-card">
              <div className="flex flex-1 flex-col gap-2 py-1">
                <div className={`h-5 w-3/4 rounded-[6px] ${bone}`} />
                <div className={`h-4 w-full rounded-[6px] ${bone}`} />
                <div className={`mt-auto h-5 w-24 rounded-[6px] ${bone}`} />
              </div>
              <div className={`h-[104px] w-[104px] rounded-[16px] ${bone}`} />
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">
        Memuat menu…
      </p>
    </Frame>
  );
}

export function SelfOrderLoading() {
  return <LoadingScreen />;
}

function ErrorScreen({
  error,
  onRetry,
  order,
  onOpenOrder,
}: {
  error: unknown;
  onRetry?: () => void;
  order?: StoredOrder | null;
  onOpenOrder?: () => void;
}) {
  const code = error instanceof ApiError ? error.code : "BAD_RESPONSE";
  const status = error instanceof ApiError ? error.status : 0;
  let icon = <WifiOff size={36} aria-hidden />;
  let title = "Menu belum bisa dimuat";
  let body = "Periksa koneksi internet, lalu coba lagi.";
  let retry = true;

  if (code === "NOT_FOUND") {
    icon = <QrIcon size={36} aria-hidden />;
    title = "Kode QR tidak berlaku";
    body = "QR ini sudah tidak aktif atau sudah diganti. Minta QR terbaru ke staf, lalu pindai lagi.";
    retry = false;
  } else if (code === "SELF_ORDER_CLOSED" || status === 403) {
    icon = <Store size={36} aria-hidden />;
    title = "Pemesanan lewat QR sedang tutup";
    body = "Outlet belum menerima pesanan dari QR saat ini. Silakan pesan langsung ke kasir.";
  } else if (code === "RATE_LIMITED") {
    title = "Terlalu banyak permintaan";
    body = (error as ApiError).retryAfter
      ? `Tunggu ${(error as ApiError).retryAfter} detik, lalu coba lagi.`
      : "Tunggu sebentar, lalu coba lagi.";
  } else if (code === "SERVICE_UNAVAILABLE" || status >= 500) {
    title = "Layanan sedang sibuk";
    body = "Coba lagi sebentar lagi.";
  }

  return (
    <Frame>
      <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[400px]">
          <EmptyState icon={icon} title={title} body={body} headingLevel={1} tone={code === "NOT_FOUND" ? "muted" : "brand"}>
            {retry && onRetry && (
              <button type="button" className={primaryButton} onClick={onRetry}>
                <RefreshCw size={18} aria-hidden /> Coba lagi
              </button>
            )}
            {order && onOpenOrder && (
              <button type="button" className={secondaryButton} onClick={onOpenOrder}>
                Lihat pesanan {order.order_no}
              </button>
            )}
          </EmptyState>
        </div>
        <p className="mt-12 text-[13px] text-text-muted">
          Pemesanan oleh <span className="font-semibold text-text-body">Sissi POS</span>
        </p>
      </main>
    </Frame>
  );
}
