"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Landmark, QrCode as QrIcon, RefreshCw, Store, Wallet } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { BILLING_CYCLES } from "@/components/admin/labels";
import { btn, formatDate, formatDateTime, formatRupiah, Notice, Spinner, errorMessage } from "@/components/admin/ui";
import { QrCode } from "@/components/self-order/QrCode";
import { ownerApi } from "@/lib/owner/api";
import type { Checkout, PayCycle, PayKind, PayMethod, PayMethods } from "@/lib/owner/types";
import { ApiError } from "@/lib/sissiApi";
import { labelOf } from "./labels";

// Dialog bayar Pro lewat Duitku. Web hanya bicara dengan API kita; harga, biaya, dan total selalu dari API.
// Langkah: pilih metode → bayar (QR / nomor VA / kode / e-wallet) → hasil. Polling status hanya selama dialog terbuka
// dan checkout `pending`; `paid` hanya bisa datang dari server (bukti dari Duitku), bukan dari halaman kembali.

const POLL_MS = 4000;
const SKEW_CAP_MS = 31_000; // jeda server 30 dtk: jam klien yang meleset tidak boleh mengunci tombol lebih lama
const UNAVAILABLE = "Pembayaran online belum tersedia, hubungi tim Sissi";

const KIND_TITLE: Record<PayKind, string> = {
  qris: "QRIS",
  va: "Virtual Account",
  ewallet: "E-wallet",
  retail: "Gerai ritel",
};
const KIND_ORDER: PayKind[] = ["va", "ewallet", "retail"];
const RADIO_NAME = "pay-method";
const KIND_ICON: Record<PayKind, typeof QrIcon> = { qris: QrIcon, va: Landmark, ewallet: Wallet, retail: Store };

const STEPS: Record<PayKind, string[]> = {
  qris: ["Buka aplikasi bank atau e-wallet", "Pindai kode di atas", "Periksa nominal, lalu bayar"],
  va: ["Buka aplikasi bank atau e-wallet Anda", "Pilih transfer ke virtual account, lalu masukkan nomor di atas", "Transfer sesuai total, lalu konfirmasi"],
  retail: ["Datang ke kasir gerai", "Sebutkan kode pembayaran di atas", "Bayar sesuai total"],
  ewallet: [],
};

type Fail = { code: string; text: string };

function toFail(err: unknown): Fail {
  if (err instanceof ApiError && err.code === "PAYMENT_UNAVAILABLE") return { code: err.code, text: UNAVAILABLE };
  if (err instanceof ApiError && err.code === "PAYMENT_GATEWAY_ERROR") {
    return { code: err.code, text: "Penyedia pembayaran sedang bermasalah. Coba lagi sebentar lagi." };
  }
  return { code: err instanceof ApiError ? err.code : "", text: errorMessage(err) };
}

function clock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function PayDialog({
  cycle,
  open,
  onClose,
  onPaid,
  initialCheckoutId,
}: {
  cycle: PayCycle;
  open: boolean;
  onClose: () => void;
  /** Dipanggil sekali per checkout saat status `paid` (muat ulang langganan). */
  onPaid: () => void;
  initialCheckoutId?: string;
}) {
  const [loaded, setLoaded] = useState<{ key: string; data: PayMethods | null } | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [fail, setFail] = useState<Fail | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  const [initLoading, setInitLoading] = useState(open && !!initialCheckoutId);
  const [initFail, setInitFail] = useState<Fail | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  const [pickCycle, setPickCycle] = useState<PayCycle | null>(null);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [coolUntil, setCoolUntil] = useState<number | null>(null);
  const [note, setNote] = useState<{ tone: "info" | "warning"; text: string } | null>(null);
  const currentId = useRef<string | null>(null);
  const coolSeen = useRef<{ next: string; until: number } | null>(null);
  const paidFor = useRef<string | null>(null);
  const onPaidRef = useRef(onPaid);
  const onCloseRef = useRef(onClose);
  // Nomor sesi dialog: naik tiap dibuka/ditutup/dilepas, agar POST yang selesai sesudah dialog ditutup tidak berefek.
  const session = useRef(0);
  useEffect(() => {
    onPaidRef.current = onPaid;
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    coolSeen.current = null;
  }, [open]);
  useEffect(() => {
    currentId.current = checkout?.id ?? null;
  }, [checkout?.id]);
  useEffect(() => {
    session.current++;
    const ref = session;
    return () => {
      ref.current++;
    };
  }, [open]);

  // Dialog dibuka/ditutup → mulai dari nol (membuka ulang memakai ulang checkout lewat POST yang idempoten).
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    if (open) {
      setCheckout(null);
      setFail(null);
      setCreating(null);
      setInitFail(null);
      setPickCycle(null);
      setPicked(null);
      setInitLoading(!!initialCheckoutId);
      setCoolUntil(null);
      setNote(null);
      setRefreshing(false);
    }
  }

  const apply = useCallback((ck: Checkout) => {
    const t = Date.now();
    setNow(t);
    setCheckout(ck);
    // Jeda cek manual dari server. Tiap nilai next_refresh_at baru dihitung sekali (dibatasi SKEW_CAP_MS dari saat diterima),
    // supaya polling tidak memperpanjangnya dan jam klien yang meleset tidak mengunci tombol.
    if (ck.next_refresh_at) {
      if (coolSeen.current?.next !== ck.next_refresh_at) {
        const until = Math.min(Date.parse(ck.next_refresh_at), t + SKEW_CAP_MS);
        coolSeen.current = { next: ck.next_refresh_at, until };
        setCoolUntil(until);
      }
    }
    if (ck.status === "paid" && paidFor.current !== ck.id) {
      paidFor.current = ck.id;
      onPaidRef.current();
    }
  }, []);

  // Kembali dari e-wallet: tampilkan status checkout itu. 404 (id tak dikenal) → tutup tanpa suara; galat lain → tampilkan galatnya.
  useEffect(() => {
    if (!open || !initialCheckoutId) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const ck = await (await ownerApi()).getCheckout(initialCheckoutId, ctrl.signal);
        if (!ctrl.signal.aborted) {
          apply(ck);
          setInitLoading(false);
        }
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setInitLoading(false);
        if (err instanceof ApiError && err.status === 404) onCloseRef.current();
        else setInitFail(toFail(err));
      }
    })();
    return () => ctrl.abort();
  }, [open, initialCheckoutId, apply, initAttempt]);

  // Daftar metode (hanya saat memilih).
  const picking = open && !checkout && !initLoading && !initFail;
  const activeCycle = pickCycle ?? cycle;
  const methodsKey = `${activeCycle}:${attempt}`;
  const methods = loaded?.key === methodsKey ? loaded.data : null;
  useEffect(() => {
    if (!picking) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const m = await (await ownerApi()).paymentMethods(activeCycle, ctrl.signal);
        if (ctrl.signal.aborted) return;
        setLoaded({ key: methodsKey, data: m });
        setFail(null);
      } catch (err) {
        if (!ctrl.signal.aborted) {
          setLoaded({ key: methodsKey, data: null });
          setFail(toFail(err));
        }
      }
    })();
    return () => ctrl.abort();
  }, [picking, activeCycle, methodsKey]);

  const expiresMs = checkout ? Date.parse(checkout.expires_at) : 0;
  const pending = checkout?.status === "pending";
  const expiredLocal = pending && now >= expiresMs;
  const live = open && pending && !expiredLocal;
  const cooling = coolUntil !== null && now < coolUntil;

  // Hitung mundur lokal dari expires_at dan jeda cek manual.
  const ticking = live || (open && cooling);
  useEffect(() => {
    if (!ticking) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ticking, checkout?.id]);

  // Polling status: galat tidak fatal (tetap coba lagi dengan jeda sama), berhenti saat bukan live.
  const checkoutId = checkout?.id;
  useEffect(() => {
    if (!live || !checkoutId) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const ck = await (await ownerApi()).getCheckout(checkoutId, ctrl.signal);
        if (ctrl.signal.aborted) return;
        apply(ck);
        if (ck.status !== "pending") return;
      } catch {
        if (ctrl.signal.aborted) return;
      }
      timer = setTimeout(tick, POLL_MS);
    };
    timer = setTimeout(tick, POLL_MS);
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [live, checkoutId, apply]);

  // Satu pembacaan terakhir saat hitung mundur habis: `paid` yang terlambat tetap tampil.
  useEffect(() => {
    if (!open || !expiredLocal || !checkoutId) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const ck = await (await ownerApi()).getCheckout(checkoutId, ctrl.signal);
        if (!ctrl.signal.aborted) apply(ck);
      } catch {
        // Tidak fatal.
      }
    })();
    return () => ctrl.abort();
  }, [open, expiredLocal, checkoutId, apply]);

  async function choose(code: string) {
    if (creating) return;
    const mine = session.current;
    setLastCode(code);
    setCreating(code);
    setFail(null);
    // Checkout baru tidak mewarisi catatan/hitung mundur yang lama.
    setNote(null);
    setCoolUntil(null);
    coolSeen.current = null;
    setRefreshing(false);
    try {
      const ck = await (await ownerApi()).createCheckout({ cycle: checkout?.cycle ?? activeCycle, method: code });
      if (session.current !== mine) return; // dialog sudah ditutup: jangan ubah state dan jangan alihkan halaman
      apply(ck);
      if (ck.kind === "ewallet" && ck.status === "pending" && ck.payment_url) window.location.assign(ck.payment_url);
    } catch (err) {
      if (session.current === mine) setFail(toFail(err));
    } finally {
      if (session.current === mine) setCreating(null);
    }
  }

  async function checkNow() {
    if (!checkout || refreshing || cooling) return;
    const mine = session.current;
    setRefreshing(true);
    setNote(null);
    try {
      const ck = await (await ownerApi()).refreshCheckout(checkout.id);
      if (session.current !== mine) return;
      if (currentId.current !== ck.id) {
        // Pemilik sudah pindah ke checkout lain: jangan timpa tampilannya, tetapi lunas tetap harus memuat ulang langganan.
        if (ck.status === "paid" && paidFor.current !== ck.id) {
          paidFor.current = ck.id;
          onPaidRef.current();
        }
        return;
      }
      apply(ck);
      // Catatan hanya bila server benar-benar bertanya ke penyedia; dalam jeda cukup hitung mundur.
      if (ck.checked && ck.status !== "paid") setNote({ tone: "info", text: "Belum ada konfirmasi pembayaran dari penyedia." });
    } catch (err) {
      if (session.current !== mine) return;
      if (err instanceof ApiError && err.status === 429) {
        const t = Date.now();
        setNow(t);
        setCoolUntil(t + 30_000);
        setNote({ tone: "warning", text: "Terlalu sering memeriksa. Tunggu sebentar, lalu coba lagi." });
      } else if (err instanceof ApiError && err.code === "PAYMENT_GATEWAY_ERROR") {
        // Server sudah memakai jatah jeda 30 dtk untuk percobaan ini.
        const t = Date.now();
        setNow(t);
        setCoolUntil(t + 30_000);
        setNote({ tone: "warning", text: "Belum bisa mengecek. Coba lagi sebentar lagi." });
      } else if (err instanceof ApiError && err.code === "PAYMENT_UNAVAILABLE") {
        setNote({ tone: "warning", text: UNAVAILABLE });
      } else {
        setNote({ tone: "warning", text: "Belum bisa memeriksa saat ini. Periksa koneksi Anda, lalu coba lagi." });
      }
    } finally {
      if (session.current === mine) setRefreshing(false);
    }
  }

  function backToPick() {
    if (checkout) setPickCycle(checkout.cycle);
    setRefreshing(false);
    setCheckout(null);
    setFail(null);
    setNote(null);
    setCoolUntil(null);
    coolSeen.current = null;
    setAttempt((n) => n + 1);
  }

  const shownCycle = checkout?.cycle ?? activeCycle;
  const planName = `Pro ${labelOf(BILLING_CYCLES, shownCycle)}`;
  const status = checkout?.status;
  const closeBtn = (label = "Tutup") => (
    <button type="button" className={btn.secondary} onClick={onClose}>
      {label}
    </button>
  );

  let title = "Pilih cara bayar";
  let body: React.ReactNode;
  let footer: React.ReactNode = closeBtn();
  let wide = false;

  const meta = loaded?.data?.methods.find((m) => m.code === checkout?.method);
  const methodName = checkout ? (meta ? displayName(meta) : KIND_TITLE[checkout.kind]) : "";
  const checkLabel = refreshing ? "Memeriksa…" : cooling && coolUntil !== null ? `Cek lagi dalam ${Math.ceil((coolUntil - now) / 1000)} dtk` : "Cek status pembayaran";
  const checkBtn = (cls: string) => (
    <button type="button" className={cls} disabled={refreshing || cooling} onClick={checkNow}>
      {refreshing ? <Spinner /> : <RefreshCw size={16} aria-hidden />} {checkLabel}
    </button>
  );
  const noteLive = (
    <p aria-live="polite" className={`min-h-[1.25rem] text-[12.5px] leading-snug ${note?.tone === "warning" ? "text-warning" : "text-text-body"}`}>
      {note?.text}
    </p>
  );

  if (checkout && status === "paid") {
    title = "Status pembayaran";
    body = (
      <div className="flex flex-col items-center gap-1.5 pt-1 text-center" role="status">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-tint text-success motion-safe:animate-pay-pop">
          <Check size={34} strokeWidth={3} aria-hidden />
        </span>
        <p className="mt-2 text-[18px] font-bold text-text-heading">Pembayaran diterima</p>
        <p className="text-[14px] text-text-body">
          {checkout.period_end ? <>Pro aktif sampai <strong className="text-text-heading">{formatDate(checkout.period_end)}</strong></> : "Pro Anda sudah aktif"}
        </p>
        <dl className="mt-3 w-full max-w-[360px] space-y-2 rounded-[12px] border border-border-subtle bg-bg-muted p-4 text-left text-[13px] text-text-body">
          <div className="flex justify-between gap-3">
            <dt>Paket</dt>
            <dd className="font-semibold text-text-heading">{planName}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Total dibayar</dt>
            <dd className="font-semibold tabular-nums text-text-heading">{formatRupiah(checkout.total)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Metode</dt>
            <dd className="text-right font-semibold text-text-heading">{methodName}</dd>
          </div>
          {checkout.period_end && (
            <div className="flex justify-between gap-3">
              <dt>Aktif sampai</dt>
              <dd className="font-semibold text-text-heading">{formatDate(checkout.period_end)}</dd>
            </div>
          )}
        </dl>
      </div>
    );
    footer = (
      <button type="button" className={`${btn.primary} sm:min-w-[120px]`} onClick={onClose}>
        Selesai
      </button>
    );
  } else if (checkout && (status === "failed" || status === "amount_mismatch")) {
    title = "Pembayaran tidak berhasil";
    body = (
      <Notice tone="warning" role="status">
        {status === "amount_mismatch"
          ? "Nominal pembayaran tidak sesuai dengan tagihan. Jangan bayar lagi dulu, hubungi tim Sissi agar kami bantu memeriksanya."
          : "Pembayaran ini tidak berhasil. Bila saldo Anda sudah terpotong, tekan Cek status pembayaran atau hubungi tim Sissi."}
      </Notice>
    );
    body = (
      <div className="flex flex-col gap-3">
        {body}
        {status === "failed" && noteLive}
      </div>
    );
    footer = (
      <>
        {closeBtn()}
        {status === "failed" && checkBtn(btn.secondary)}
        {status === "failed" && (
          <button type="button" className={btn.primary} onClick={backToPick}>
            Pilih metode lain
          </button>
        )}
      </>
    );
  } else if (checkout && (status === "expired" || expiredLocal)) {
    const qr = checkout.kind === "qris";
    const label = qr ? "Buat QR baru" : "Buat kode baru";
    title = qr ? "QR kedaluwarsa" : "Kode kedaluwarsa";
    body = (
      <div className="flex flex-col gap-3">
        <Notice tone="info" role="status">
          {qr ? "QR ini sudah kedaluwarsa." : "Kode pembayaran ini sudah kedaluwarsa."} Pemeriksaan otomatis sudah berhenti. Bila Anda sudah membayar, tekan Cek status
          pembayaran, atau hubungi tim Sissi.
        </Notice>
        {fail && <Notice tone="danger" role="alert">{fail.text}</Notice>}
        {noteLive}
      </div>
    );
    footer = (
      <>
        {closeBtn()}
        {checkBtn(btn.secondary)}
        <button type="button" className={btn.primary} disabled={!!creating} onClick={() => choose(checkout.method)}>
          {creating && <Spinner />} {label}
        </button>
      </>
    );
  } else if (checkout) {
    // pending
    const remaining = expiresMs - now;
    const fee = checkout.service_fee;
    const steps = STEPS[checkout.kind];
    const isCode = checkout.kind === "va" || checkout.kind === "retail";
    const logo = checkout.kind === "qris" ? QRIS_LOGO : meta ? methodLogoSrc(meta) : (LOCAL_LOGOS[checkout.method] ?? "");
    title = checkout.kind === "qris" ? "Pindai QRIS" : checkout.kind === "va" ? "Bayar lewat Virtual Account" : checkout.kind === "retail" ? "Bayar di gerai ritel" : "Lanjut ke e-wallet";
    body = (
      <div className="-m-1 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
          <section aria-label="Cara bayar" className="flex min-w-0 flex-col items-center gap-3 text-center">
            {checkout.kind === "qris" && checkout.qr_string && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- logo lokal statis */}
                <img src={QRIS_LOGO} alt="QRIS" className="h-6 w-auto" />
                <div className="rounded-[16px] border border-border-subtle bg-white p-3 shadow-so-card">
                  <QrCode value={checkout.qr_string} label={`QR pembayaran ${formatRupiah(checkout.total)}`} size={196} />
                </div>
                <p className="text-[12.5px] text-text-muted">Bisa dari aplikasi bank atau e-wallet apa saja</p>
              </>
            )}
            {isCode && checkout.pay_code && (
              <div className="flex w-full flex-col items-center gap-2 rounded-[14px] border border-border-subtle p-4">
                <div className="flex items-center gap-2">
                  {logo && (
                    // eslint-disable-next-line @next/next/no-img-element -- logo lokal atau images.duitku.com (host disaring server)
                    <img src={logo} alt="" referrerPolicy="no-referrer" className="h-7 w-auto max-w-[72px] object-contain" />
                  )}
                  <span className="text-[13px] font-semibold text-text-heading">{methodName}</span>
                </div>
                <p className="text-[12.5px] text-text-muted">{checkout.kind === "va" ? "Nomor virtual account" : "Kode pembayaran"}</p>
                <p data-testid="pay-code" className="break-all font-mono text-[24px] font-bold leading-tight tracking-wider text-text-heading sm:text-[28px]">{checkout.pay_code}</p>
                <CopyText value={checkout.pay_code} label={checkout.kind === "va" ? "Salin nomor virtual account" : "Salin kode pembayaran"} />
              </div>
            )}
            {checkout.kind === "ewallet" && checkout.payment_url && (
              <a href={checkout.payment_url} className={`${btn.primary} self-center`}>
                <ExternalLink size={16} aria-hidden /> Lanjut ke pembayaran
              </a>
            )}
            {steps.length > 0 && (
              <ol className="w-full list-decimal space-y-0.5 pl-5 text-left text-[12.5px] text-text-body">
                {steps.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ol>
            )}
          </section>
          <aside aria-label="Status pembayaran" className="flex min-w-0 flex-col gap-3 border-t border-border-subtle pt-4 lg:self-start lg:rounded-[12px] lg:border lg:bg-bg-muted lg:p-4">
            <div className="flex items-center gap-2.5" role="status">
              <span aria-hidden className="relative flex h-2.5 w-2.5 shrink-0">
                <span className="absolute inset-0 rounded-full bg-brand-primary motion-safe:animate-so-ping" />
                <span className="relative h-2.5 w-2.5 rounded-full bg-brand-primary" />
              </span>
              <span className="text-[15px] font-bold text-text-heading">Menunggu pembayaran</span>
            </div>
            <p className="text-[12.5px] leading-snug text-text-body">Status diperbarui otomatis, biasanya dalam beberapa menit. Sudah bayar? Cek sekarang.</p>
            <div>
              {isCode ? (
                <span className="inline-block rounded-full bg-brand-tint px-3 py-[3px] text-[12.5px] font-semibold text-brand-ink">Berlaku sampai {formatDateTime(checkout.expires_at)}</span>
              ) : (
                <span className="inline-block rounded-full bg-brand-tint px-3 py-[3px] text-[13px] font-bold tabular-nums text-brand-ink">Sisa {clock(remaining)}</span>
              )}
            </div>
            <dl className="space-y-1.5 border-t border-border-subtle pt-3 text-[13px] text-text-body">
              <div className="flex justify-between gap-3">
                <dt>Paket</dt>
                <dd className="font-semibold text-text-heading">{planName}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Harga</dt>
                <dd className="tabular-nums">{formatRupiah(checkout.price)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Biaya layanan</dt>
                <dd className={`tabular-nums ${fee === 0 ? "font-semibold text-success" : ""}`}>{fee > 0 ? formatRupiah(fee) : "Gratis"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-2 text-text-heading">
                <dt className="text-[14px] font-bold">Total</dt>
                <dd className="flex items-center gap-1.5">
                  <span className="text-[20px] font-bold tabular-nums">{formatRupiah(checkout.total)}</span>
                  {checkout.kind === "va" && <CopyText value={String(checkout.total)} label="Salin nominal total" />}
                </dd>
              </div>
            </dl>
            {checkBtn(`${btn.primary} w-full`)}
            {noteLive}
            <div className="flex items-center justify-center gap-1">
              <button type="button" className={btn.ghost} onClick={backToPick}>
                Ganti metode
              </button>
              <button type="button" className={btn.ghost} onClick={onClose}>
                Tutup
              </button>
            </div>
          </aside>
        </div>
      </div>
    );
    footer = null;
    wide = true;
  } else if (initLoading) {
    title = "Status pembayaran";
    body = (
      <div role="status" className="flex items-center justify-center gap-2 py-10 text-[14px] text-text-muted">
        <Spinner /> Memeriksa status pembayaran…
      </div>
    );
  } else if (initFail) {
    title = "Status pembayaran";
    body = <Notice tone="danger" role="alert">{initFail.text}</Notice>;
    footer = (
      <>
        {closeBtn()}
        <button
          type="button"
          className={btn.primary}
          onClick={() => {
            setInitFail(null);
            setInitLoading(true);
            setInitAttempt((n) => n + 1);
          }}
        >
          Coba lagi
        </button>
      </>
    );
  } else if (fail && (!methods || fail.code === "PAYMENT_UNAVAILABLE")) {
    body =
      fail.code === "PAYMENT_UNAVAILABLE" ? (
        <Notice tone="warning" role="alert">{fail.text}</Notice>
      ) : (
        <Notice tone="danger" role="alert">{fail.text}</Notice>
      );
    footer = (
      <>
        {closeBtn()}
        {fail.code !== "PAYMENT_UNAVAILABLE" && (
          <button type="button" className={btn.primary} onClick={backToPick}>
            Coba lagi
          </button>
        )}
      </>
    );
  } else if (!methods) {
    body = (
      <div role="status" className="flex items-center justify-center gap-2 py-10 text-[14px] text-text-muted">
        <Spinner /> Memuat metode pembayaran…
      </div>
    );
  } else {
    const qris = methods.methods.find((m) => m.kind === "qris");
    // Pilihan yang hilang dari daftar (mis. setelah muat ulang) jatuh ke QRIS, atau metode pertama.
    const sel = methods.methods.find((m) => m.code === picked) ?? qris ?? methods.methods[0];
    const busy = !!creating;
    const row = (m: PayMethod) => (
      <MethodRow key={m.code} m={m} fav={m.kind === "qris"} checked={m.code === sel?.code} disabled={busy} onPick={() => setPicked(m.code)} />
    );
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:gap-6">
        <div role="radiogroup" aria-label="Metode pembayaran" className="-m-1 min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
          {qris && <div className="mb-1">{row(qris)}</div>}
          {KIND_ORDER.map((kind) => {
            const list = methods.methods.filter((m) => m.kind === kind);
            if (list.length === 0) return null;
            return (
              <section key={kind} aria-label={KIND_TITLE[kind]} className="mt-2.5 first:mt-0">
                <h3 className="mb-1 px-2.5 text-[12px] font-semibold text-text-muted">{KIND_TITLE[kind]}</h3>
                <div className="grid grid-cols-1 gap-x-2 gap-y-0.5 lg:grid-cols-2">{list.map(row)}</div>
              </section>
            );
          })}
        </div>
        <aside aria-label="Ringkasan" className="shrink-0 border-t border-border-subtle pt-3 lg:self-start lg:rounded-[12px] lg:border lg:bg-bg-muted lg:p-4">
          <h3 className="hidden text-[14px] font-bold text-text-heading lg:block">Ringkasan</h3>
          <dl className="space-y-1 text-[13px] text-text-body lg:mt-3 lg:space-y-1.5">
            <div className="flex justify-between gap-3 lg:hidden">
              <dt className="sr-only">Ringkasan</dt>
              <dd className="font-semibold text-text-heading">{planName}</dd>
            </div>
            <div className="hidden justify-between gap-3 lg:flex">
              <dt>Paket</dt>
              <dd className="font-semibold text-text-heading">{planName}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Harga</dt>
              <dd className="tabular-nums">{formatRupiah(methods.price)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Biaya layanan</dt>
              <dd className={`tabular-nums ${sel && sel.fee === 0 ? "font-semibold text-success" : ""}`}>{sel ? (sel.fee > 0 ? formatRupiah(sel.fee) : "Gratis") : "-"}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-border-subtle pt-1.5 text-[14px] font-bold text-text-heading">
              <dt>Total</dt>
              <dd className="tabular-nums">{sel ? formatRupiah(sel.total) : "-"}</dd>
            </div>
          </dl>
          {fail && (
            <div className="mt-2">
              <Notice tone="danger" role="alert">
                <span className="flex flex-wrap items-center gap-3">
                  {fail.text}
                  {lastCode && (
                    <button type="button" className={btn.secondary} disabled={busy} onClick={() => choose(lastCode)}>
                      Coba lagi
                    </button>
                  )}
                </span>
              </Notice>
            </div>
          )}
          <div className="mt-3 flex gap-2 lg:flex-col">
            <button type="button" className={`${btn.secondary} lg:order-2`} onClick={onClose}>
              Batal
            </button>
            <button type="button" className={`${btn.primary} min-w-0 flex-1 lg:order-1 lg:flex-none`} disabled={busy || !sel} onClick={() => sel && choose(sel.code)}>
              {busy && <Spinner />} Bayar {sel ? formatRupiah(sel.total) : ""}
            </button>
          </div>
        </aside>
      </div>
    );
    footer = null;
    wide = true;
  }

  // Selama menunggu, latar/Esc tidak menutup: salah ketuk tidak membuang QR. Tutup lewat tombol "Tutup".
  const dismissible = !pending || expiredLocal;

  return (
    <Modal open={open} title={title} onClose={onClose} dismissible={dismissible} showClose={!dismissible && !!checkout} footer={footer} wide={wide}>
      {body}
    </Modal>
  );
}

/** Tombol "Salin" berlabel; berubah jadi "Tersalin" sebentar sebagai konfirmasi (diumumkan lewat aria-live). */
function CopyText({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      aria-label={label}
      className={`${btn.secondary} min-h-8 gap-1.5 px-3 text-[13px]`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
        } catch {
          // Clipboard ditolak (mis. bukan HTTPS): pengguna menyalin manual.
        }
      }}
    >
      {done ? <Check size={14} aria-hidden className="text-success" /> : <Copy size={14} aria-hidden />}
      <span aria-live="polite">{done ? "Tersalin" : "Salin"}</span>
    </button>
  );
}

// Logo gabungan Duitku terlalu kecil terbaca di ubin (Indomaret + i.saku, Alfamart + Pegadaian + Pos): pakai logo lokal.
const LOCAL_LOGOS: Record<string, string> = { IR: "/logos/pembayaran/indomaret.svg", FT: "/logos/pembayaran/alfamart.svg" };
const QRIS_LOGO = "/logos/pembayaran/qris.svg";

/** Sumber logo metode. QRIS selalu logo QRIS, bukan logo penyedia, karena bisa dibayar dari aplikasi apa pun. */
function methodLogoSrc(m: PayMethod): string {
  return m.kind === "qris" ? QRIS_LOGO : (LOCAL_LOGOS[m.code] ?? m.image);
}

/** Logo berukuran tetap (±48x28), cukup besar agar terbaca. Gagal dimuat → ikon jenis metode. */
function MethodLogo({ m }: { m: PayMethod }) {
  const [broken, setBroken] = useState(false);
  const Icon = KIND_ICON[m.kind];
  const src = methodLogoSrc(m);
  return (
    <span aria-hidden className="flex h-7 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-border-subtle bg-white p-[3px] text-text-body">
      {src && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo lokal atau dari images.duitku.com (host disaring server), tanpa optimasi next/image.
        <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="max-h-full max-w-full object-contain" />
      ) : (
        <Icon size={16} aria-hidden />
      )}
    </span>
  );
}

const ACRONYMS = new Set(["ATM", "BCA", "BNI", "BRI", "BSI", "BNC", "CIMB", "OVO", "DANA", "VA"]);
// Nama Duitku yang tidak terbaca dari aturan umum. FT menurut dokumentasi Duitku = Pegadaian/ALFA/Pos.
const NAME_BY_CODE: Record<string, string> = { FT: "Alfamart, Pegadaian, Pos" };

/** Nama dari Duitku sering HURUF BESAR dan memuat sufiks teknis ("MANDIRI VA H2H"): rapikan untuk tampilan. */
function displayName(m: PayMethod): string {
  if (NAME_BY_CODE[m.code]) return NAME_BY_CODE[m.code];
  let n = m.name.trim();
  if (m.kind === "va") n = n.replace(/\s+(virtual account|va)(\s+h2h)?$/i, "");
  if (n !== n.toUpperCase()) return n;
  return n
    .split(/\s+/)
    .map((w) => (ACRONYMS.has(w) ? w : /^shopeepay$/i.test(w) ? "ShopeePay" : /^linkaja$/i.test(w) ? "LinkAja" : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(" ");
}

/** Satu baris pilihan: radio sungguhan (satu grup, panah keyboard) yang terlihat sebagai baris datar. */
function MethodRow({ m, fav, checked, disabled, onPick }: { m: PayMethod; fav: boolean; checked: boolean; disabled: boolean; onPick: () => void }) {
  const name = m.kind === "qris" ? "QRIS" : displayName(m);
  return (
    <label
      className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-1.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-brand-primary ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${checked ? "bg-brand-tint" : disabled ? "" : "hover:bg-bg-muted"}`}
    >
      <input type="radio" name={RADIO_NAME} value={m.code} checked={checked} disabled={disabled} onChange={onPick} className="peer sr-only" />
      <MethodLogo m={m} />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold leading-tight text-text-heading">{name}</span>
        <span className={`block text-[12px] leading-tight ${fav ? "font-semibold text-success" : "text-text-muted"}`}>
          {fav ? "Disarankan · tanpa biaya" : m.fee > 0 ? `Biaya ${formatRupiah(m.fee)}` : "Tanpa biaya layanan"}
        </span>
      </span>
      <span aria-hidden className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 bg-white ${checked ? "border-brand-primary" : "border-border-active"}`}>
        {checked && <span className="h-2 w-2 rounded-full bg-brand-primary" />}
      </span>
    </label>
  );
}
