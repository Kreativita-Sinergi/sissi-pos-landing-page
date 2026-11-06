"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { BILLING_CYCLES } from "@/components/admin/labels";
import { btn, CopyButton, formatDate, formatRupiah, Notice, Spinner, errorMessage } from "@/components/admin/ui";
import { QrCode } from "@/components/self-order/QrCode";
import { ownerApi } from "@/lib/owner/api";
import type { Checkout, PayCycle, PayKind, PayMethod, PayMethods } from "@/lib/owner/types";
import { ApiError } from "@/lib/sissiApi";
import { labelOf } from "./labels";

// Dialog bayar Pro lewat Duitku. Web hanya bicara dengan API kita; harga, biaya, dan total selalu dari API.
// Langkah: pilih metode → bayar (QR / nomor VA / kode / e-wallet) → hasil. Polling status hanya selama dialog terbuka
// dan checkout `pending`; `paid` hanya bisa datang dari server (bukti dari Duitku), bukan dari halaman kembali.

const POLL_MS = 4000;
const UNAVAILABLE = "Pembayaran online belum tersedia, hubungi tim Sissi";

const KIND_TITLE: Record<PayKind, string> = {
  qris: "QRIS",
  va: "Virtual Account",
  ewallet: "E-wallet dan aplikasi",
  retail: "Gerai ritel",
};
const KIND_ORDER: PayKind[] = ["qris", "va", "ewallet", "retail"];

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
  const [now, setNow] = useState(() => Date.now());
  const [attempt, setAttempt] = useState(0);
  const [initLoading, setInitLoading] = useState(open && !!initialCheckoutId);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const paidFor = useRef<string | null>(null);
  const onPaidRef = useRef(onPaid);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onPaidRef.current = onPaid;
    onCloseRef.current = onClose;
  });

  // Dialog dibuka/ditutup → mulai dari nol (membuka ulang memakai ulang checkout lewat POST yang idempoten).
  const [seenOpen, setSeenOpen] = useState(open);
  if (seenOpen !== open) {
    setSeenOpen(open);
    if (open) {
      setCheckout(null);
      setFail(null);
      setCreating(null);
      setInitLoading(!!initialCheckoutId);
    }
  }

  const apply = useCallback((ck: Checkout) => {
    setNow(Date.now());
    setCheckout(ck);
    if (ck.status === "paid" && paidFor.current !== ck.id) {
      paidFor.current = ck.id;
      onPaidRef.current();
    }
  }, []);

  // Kembali dari e-wallet: tampilkan status checkout itu. Tidak ketemu → tutup tanpa suara.
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
        else setFail(toFail(err));
      }
    })();
    return () => ctrl.abort();
  }, [open, initialCheckoutId, apply]);

  // Daftar metode (hanya saat memilih).
  const picking = open && !checkout && !initLoading;
  const methodsKey = `${cycle}:${attempt}`;
  const methods = loaded?.key === methodsKey ? loaded.data : null;
  useEffect(() => {
    if (!picking) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const m = await (await ownerApi()).paymentMethods(cycle, ctrl.signal);
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
  }, [picking, cycle, methodsKey]);

  const expiresMs = checkout ? Date.parse(checkout.expires_at) : 0;
  const pending = checkout?.status === "pending";
  const expiredLocal = pending && now >= expiresMs;
  const live = open && pending && !expiredLocal;

  // Hitung mundur lokal dari expires_at.
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [live, checkout?.id]);

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
    setLastCode(code);
    setCreating(code);
    setFail(null);
    try {
      const ck = await (await ownerApi()).createCheckout({ cycle: checkout?.cycle ?? cycle, method: code });
      apply(ck);
      if (ck.kind === "ewallet" && ck.status === "pending" && ck.payment_url) window.location.assign(ck.payment_url);
    } catch (err) {
      setFail(toFail(err));
    } finally {
      setCreating(null);
    }
  }

  function backToPick() {
    setCheckout(null);
    setFail(null);
    setAttempt((n) => n + 1);
  }

  const shownCycle = checkout?.cycle ?? cycle;
  const title = `Bayar Pro ${labelOf(BILLING_CYCLES, shownCycle)}`;
  const status = checkout?.status;
  const closeBtn = (label = "Tutup") => (
    <button type="button" className={btn.secondary} onClick={onClose}>
      {label}
    </button>
  );

  let body: React.ReactNode;
  let footer: React.ReactNode = closeBtn();

  if (checkout && status === "paid") {
    body = (
      <div className="flex flex-col items-center gap-2 py-4 text-center" role="status">
        <CheckCircle2 size={44} aria-hidden className="text-success" />
        <p className="text-[17px] font-bold text-text-heading">Pembayaran diterima</p>
        <p className="text-[14px] text-text-body">
          Pro aktif{checkout.period_end ? ` sampai ${formatDate(checkout.period_end)}` : ""}. Terima kasih sudah berlangganan.
        </p>
      </div>
    );
    footer = (
      <button type="button" className={btn.primary} onClick={onClose}>
        Selesai
      </button>
    );
  } else if (checkout && (status === "failed" || status === "amount_mismatch")) {
    body = (
      <Notice tone="warning" role="status">
        {status === "amount_mismatch"
          ? "Nominal pembayaran tidak sesuai dengan tagihan. Jangan bayar lagi dulu, hubungi tim Sissi agar kami bantu memeriksanya."
          : "Pembayaran ini tidak berhasil. Bila saldo Anda sudah terpotong, hubungi tim Sissi dan kami bantu memeriksanya."}
      </Notice>
    );
    footer = (
      <>
        {closeBtn()}
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
    body = (
      <div className="flex flex-col gap-3">
        <Notice tone="info" role="status">
          {qr ? "QR ini sudah kedaluwarsa." : "Kode pembayaran ini sudah kedaluwarsa."} Bila Anda sudah membayar, status akan diperbarui otomatis.
        </Notice>
        {fail && <Notice tone="danger" role="alert">{fail.text}</Notice>}
      </div>
    );
    footer = (
      <>
        {closeBtn()}
        <button type="button" className={btn.primary} disabled={!!creating} onClick={() => choose(checkout.method)}>
          {creating && <Spinner />} {label}
        </button>
      </>
    );
  } else if (checkout) {
    // pending
    const remaining = expiresMs - now;
    const fee = checkout.service_fee;
    body = (
      <div className="flex flex-col gap-3">
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[14px]">
          <span>
            Total <strong className="text-[18px] tabular-nums text-text-heading">{formatRupiah(checkout.total)}</strong>
          </span>
          <span className="text-text-muted">
            Berlaku <strong className="tabular-nums text-text-heading">{clock(remaining)}</strong>
          </span>
        </p>
        {checkout.kind === "qris" && checkout.qr_string && (
          <div className="flex flex-col items-center gap-2">
            <QrCode value={checkout.qr_string} label={`QR pembayaran ${formatRupiah(checkout.total)}`} size={232} />
            <p className="text-center text-[13px] text-text-body">Buka aplikasi bank atau e-wallet apa pun, pilih bayar dengan QRIS, lalu pindai kode ini.</p>
          </div>
        )}
        {(checkout.kind === "va" || checkout.kind === "retail") && checkout.pay_code && (
          <div className="rounded-[12px] border border-border-subtle p-3">
            <p className="text-[12.5px] text-text-muted">{checkout.kind === "va" ? "Nomor virtual account" : "Kode pembayaran"}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 break-all text-[20px] font-bold tabular-nums tracking-wide text-text-heading">{checkout.pay_code}</span>
              <CopyButton value={checkout.pay_code} label={checkout.kind === "va" ? "Salin nomor virtual account" : "Salin kode pembayaran"} />
            </div>
          </div>
        )}
        {checkout.kind === "ewallet" && checkout.payment_url && (
          <a href={checkout.payment_url} className={`${btn.primary} self-start`}>
            <ExternalLink size={16} aria-hidden /> Lanjut ke pembayaran
          </a>
        )}
        <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-[13.5px]">
          <dt className="text-text-muted">Harga Pro {labelOf(BILLING_CYCLES, checkout.cycle)}</dt>
          <dd className="text-right tabular-nums">{formatRupiah(checkout.price)}</dd>
          {fee > 0 && (
            <>
              <dt className="text-text-muted">Biaya layanan</dt>
              <dd className="text-right tabular-nums">{formatRupiah(fee)}</dd>
            </>
          )}
          <dt className="font-semibold text-text-heading">Total bayar</dt>
          <dd className="text-right font-semibold tabular-nums text-text-heading">{formatRupiah(checkout.total)}</dd>
        </dl>
        <p className="flex items-center gap-2 text-[12.5px] text-text-muted">
          <Spinner size={13} /> Menunggu pembayaran. Halaman ini diperbarui otomatis.
        </p>
      </div>
    );
    footer = (
      <>
        {closeBtn()}
        <button type="button" className={btn.ghost} onClick={backToPick}>
          Ganti metode
        </button>
      </>
    );
  } else if (initLoading) {
    body = (
      <div role="status" className="flex items-center justify-center gap-2 py-10 text-[14px] text-text-muted">
        <Spinner /> Memeriksa status pembayaran…
      </div>
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
    body = (
      <div className="flex flex-col gap-4">
        <p className="text-[13.5px] text-text-body">
          Harga <strong className="text-text-heading">{formatRupiah(methods.price)}</strong>. Biaya layanan (bila ada) dan total ditampilkan di tiap metode.
        </p>
        {fail && (
          <Notice tone="danger" role="alert">
            <span className="flex flex-wrap items-center gap-3">
              {fail.text}
              {lastCode && (
                <button type="button" className={btn.secondary} disabled={!!creating} onClick={() => choose(lastCode)}>
                  Coba lagi
                </button>
              )}
            </span>
          </Notice>
        )}
        {KIND_ORDER.map((kind) => {
          const list = methods.methods.filter((m) => m.kind === kind);
          if (list.length === 0) return null;
          return (
            <section key={kind} aria-label={KIND_TITLE[kind]}>
              <h3 className="mb-1.5 text-[13px] font-semibold text-text-heading">{KIND_TITLE[kind]}</h3>
              <ul className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle">
                {list.map((m) => (
                  <MethodRow key={m.code} m={m} busy={creating === m.code} disabled={!!creating} onPick={() => choose(m.code)} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    );
    footer = closeBtn("Batal");
  }

  // Selama menunggu, latar/Esc tidak menutup: salah ketuk tidak membuang QR. Tutup lewat tombol "Tutup".
  const dismissible = !pending || expiredLocal;

  return (
    <Modal open={open} title={title} onClose={onClose} dismissible={dismissible} footer={footer}>
      {body}
    </Modal>
  );
}

function MethodRow({ m, busy, disabled, onPick }: { m: PayMethod; busy: boolean; disabled: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        disabled={disabled}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-bg-muted disabled:opacity-60"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-text-heading">{m.name}</span>
          <span className="block text-[12.5px] text-text-muted">{m.fee > 0 ? `Biaya layanan ${formatRupiah(m.fee)}` : "Tanpa biaya layanan"}</span>
        </span>
        <span className="text-right text-[14px] font-semibold tabular-nums text-text-heading">{busy ? <Spinner /> : formatRupiah(m.total)}</span>
      </button>
    </li>
  );
}
