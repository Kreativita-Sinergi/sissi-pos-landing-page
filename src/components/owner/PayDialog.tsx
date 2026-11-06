"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ExternalLink, Landmark, QrCode as QrIcon, Store, Wallet } from "lucide-react";
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
  ewallet: "E-wallet",
  retail: "Gerai ritel",
};
const KIND_ORDER: PayKind[] = ["va", "ewallet", "retail"];
const RADIO_NAME = "pay-method";
const KIND_ICON: Record<PayKind, typeof QrIcon> = { qris: QrIcon, va: Landmark, ewallet: Wallet, retail: Store };

const STEPS: Record<PayKind, string[]> = {
  qris: ["Buka aplikasi bank atau e-wallet", "Pindai kode di atas", "Periksa nominal, lalu bayar"],
  va: ["Buka aplikasi bank atau e-wallet Anda", "Pilih transfer ke virtual account, lalu masukkan nomor di atas", "Periksa nominal, lalu konfirmasi"],
  retail: ["Datang ke kasir gerai", "Sebutkan kode pembayaran di atas", "Bayar sesuai nominal"],
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
    const mine = session.current;
    setLastCode(code);
    setCreating(code);
    setFail(null);
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

  function backToPick() {
    if (checkout) setPickCycle(checkout.cycle);
    setCheckout(null);
    setFail(null);
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

  if (checkout && status === "paid") {
    title = "Pembayaran diterima";
    body = (
      <div className="flex flex-col items-center gap-2 py-2 text-center" role="status">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-success-tint text-success">
          <CheckCircle2 size={30} aria-hidden />
        </span>
        <p className="text-[14px] text-text-body">
          Pro aktif{checkout.period_end ? <> sampai <strong className="text-text-heading">{formatDate(checkout.period_end)}</strong></> : ""}. Terima kasih sudah berlangganan.
        </p>
      </div>
    );
    footer = (
      <button type="button" className={btn.primary} onClick={onClose}>
        Selesai
      </button>
    );
  } else if (checkout && (status === "failed" || status === "amount_mismatch")) {
    title = "Pembayaran tidak berhasil";
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
    title = qr ? "QR kedaluwarsa" : "Kode kedaluwarsa";
    body = (
      <div className="flex flex-col gap-3">
        <Notice tone="info" role="status">
          {qr ? "QR ini sudah kedaluwarsa." : "Kode pembayaran ini sudah kedaluwarsa."} Pemeriksaan otomatis sudah berhenti. Bila Anda sudah membayar, muat ulang halaman
          Langganan untuk melihat statusnya, atau hubungi tim Sissi.
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
    const steps = STEPS[checkout.kind];
    title = checkout.kind === "qris" ? "Pindai QRIS" : checkout.kind === "va" ? "Bayar lewat Virtual Account" : checkout.kind === "retail" ? "Bayar di gerai ritel" : "Lanjut ke e-wallet";
    body = (
      <div className="flex flex-col gap-3 text-center">
        <Summary plan={planName} right={<>Total <strong className="tabular-nums text-text-heading">{formatRupiah(checkout.total)}</strong></>} />
        {fee > 0 && (
          <p className="-mt-1.5 text-left text-[12.5px] text-text-muted">
            Harga <span className="tabular-nums">{formatRupiah(checkout.price)}</span> + biaya layanan <span className="tabular-nums">{formatRupiah(fee)}</span>
          </p>
        )}
        <div>
          <span className="inline-block rounded-full bg-brand-tint px-3 py-[3px] text-[13px] font-bold tabular-nums text-brand-ink">Sisa {clock(remaining)}</span>
        </div>
        {checkout.kind === "qris" && checkout.qr_string && (
          <div className="flex flex-col items-center gap-2">
            <QrCode value={checkout.qr_string} label={`QR pembayaran ${formatRupiah(checkout.total)}`} size={200} />
            <p className="text-[12.5px] text-text-muted">Bisa dari aplikasi bank atau e-wallet apa saja</p>
          </div>
        )}
        {(checkout.kind === "va" || checkout.kind === "retail") && checkout.pay_code && (
          <div className="rounded-[12px] border border-border-subtle p-3 text-left">
            <p className="text-[12.5px] text-text-muted">{checkout.kind === "va" ? "Nomor virtual account" : "Kode pembayaran"}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="min-w-0 flex-1 break-all text-[20px] font-bold tabular-nums tracking-wide text-text-heading">{checkout.pay_code}</span>
              <CopyButton value={checkout.pay_code} label={checkout.kind === "va" ? "Salin nomor virtual account" : "Salin kode pembayaran"} />
            </div>
          </div>
        )}
        {checkout.kind === "ewallet" && checkout.payment_url && (
          <a href={checkout.payment_url} className={`${btn.primary} self-center`}>
            <ExternalLink size={16} aria-hidden /> Lanjut ke pembayaran
          </a>
        )}
        {steps.length > 0 && (
          <ol className="list-decimal space-y-0.5 pl-5 text-left text-[12.5px] text-text-body">
            {steps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        )}
        <p role="status" className="flex items-center justify-center gap-2 text-[12.5px] text-text-body">
          <span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-brand-primary motion-reduce:animate-none" /> Menunggu pembayaran…
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
    <Modal open={open} title={title} onClose={onClose} dismissible={dismissible} footer={footer} wide={wide}>
      {body}
    </Modal>
  );
}

function Summary({ plan, right }: { plan: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[12px] bg-bg-muted px-3 py-2 text-[13px] text-text-body">
      <span>{plan}</span>
      <span>{right}</span>
    </div>
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
