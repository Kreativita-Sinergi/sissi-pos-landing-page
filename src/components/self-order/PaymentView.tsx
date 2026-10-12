"use client";

import React from "react";
import { Clock, ExternalLink, RefreshCw, TimerOff } from "lucide-react";
import { formatRupiah } from "@/lib/selfOrder/pricing";
import type { Payment, PublicOrder } from "@/lib/selfOrder/types";
import { QrCode } from "./QrCode";
import { Notice, primaryButton, secondaryButton } from "./ui";

function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function PaymentView({
  order,
  payment,
  now,
  busy,
  error,
  onRegenerate,
}: {
  order: PublicOrder;
  payment: Payment | null;
  now: number;
  busy: boolean;
  error: string | null;
  onRegenerate: () => void;
}) {
  const expiresMs = payment ? Date.parse(payment.expires_at) : NaN;
  const remaining = Number.isFinite(expiresMs) && now > 0 ? expiresMs - now : null;
  const active = !!payment && payment.status === "pending" && (remaining === null || remaining > 0);

  if (!active) {
    const failed = payment?.status === "failed";
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-2 py-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-warning-tint text-warning ring-8 ring-warning-tint/50">
            <TimerOff size={30} aria-hidden />
          </span>
          <p role="status" className="mt-2 text-[16px] leading-relaxed text-text-heading">
            <span className="block text-[18px] font-bold">
              {payment === null
                ? "QR pembayaran belum tersedia."
                : failed
                  ? "Pembayaran gagal diproses."
                  : "QR pembayaran sudah kedaluwarsa."}
            </span>
            Buat QR baru untuk membayar {formatRupiah(order.total)}.
          </p>
        </div>
        {error && <Notice tone="danger" role="alert">{error}</Notice>}
        <button type="button" className={primaryButton} onClick={onRegenerate} disabled={busy}>
          <RefreshCw size={18} aria-hidden className={busy ? "motion-safe:animate-spin" : ""} />
          {busy ? "Membuat QR…" : "Buat QR baru"}
        </button>
      </div>
    );
  }

  const urgent = remaining !== null && remaining < 60_000;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-[8px] border-2 border-text-heading px-2 py-0.5 text-[15px] font-black tracking-[0.12em] text-text-heading">
            QRIS
          </span>
          <span className="text-[15px] font-semibold text-text-body">Bayar di sini</span>
        </div>
        {remaining !== null && (
          <span
            aria-live="off"
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-bold tabular-nums ${
              urgent ? "bg-danger-tint text-danger" : "bg-so-canvas text-text-heading"
            }`}
          >
            <Clock size={15} aria-hidden />
            <span className="sr-only">Berlaku </span>
            {countdown(remaining)}
          </span>
        )}
      </div>

      <div className="text-center">
        <p className="text-[14px] font-medium text-text-body">Total yang dibayar</p>
        <p className="text-[34px] font-extrabold leading-tight tracking-tight tabular-nums text-text-heading">
          {formatRupiah(payment.amount)}
        </p>
      </div>

      {payment.qr_string && (
        <>
          <div className="mx-auto rounded-[22px] bg-so-canvas p-3">
            <QrCode value={payment.qr_string} label={`QRIS pembayaran ${formatRupiah(payment.amount)}`} />
          </div>
          <ol className="flex flex-col gap-2.5 text-[15px] leading-snug text-text-body">
            {[
              "Buka aplikasi bank atau dompet digital yang mendukung QRIS.",
              "Pindai QR ini, periksa totalnya, lalu bayar.",
              "Memesan dari HP ini? Simpan tangkapan layar, lalu unggah dari aplikasi pembayaranmu.",
            ].map((t, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-bold text-brand-ink">
                  {i + 1}
                </span>
                <span className="pt-0.5">{t}</span>
              </li>
            ))}
          </ol>
        </>
      )}

      {payment.checkout_url && (
        <a
          href={payment.checkout_url}
          rel="noopener noreferrer"
          className={payment.qr_string ? secondaryButton : primaryButton}
        >
          Bayar sekarang <ExternalLink size={18} aria-hidden />
        </a>
      )}

      <p className="flex items-center justify-center gap-2 rounded-[12px] bg-so-canvas px-3 py-2.5 text-center text-[14px] text-text-body">
        <RefreshCw size={14} aria-hidden className="shrink-0 motion-safe:animate-spin [animation-duration:2.5s]" />
        Status diperbarui otomatis setelah pembayaran berhasil.
      </p>
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
    </div>
  );
}
