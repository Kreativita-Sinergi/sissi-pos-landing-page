"use client";

import React from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
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
      <div className="flex flex-col gap-3">
        <Notice tone="warning" role="status">
          {payment === null
            ? "QR pembayaran belum tersedia."
            : failed
              ? "Pembayaran gagal diproses."
              : "QR pembayaran sudah kedaluwarsa."}{" "}
          Buat QR baru untuk membayar {formatRupiah(order.total)}.
        </Notice>
        {error && <Notice tone="danger" role="alert">{error}</Notice>}
        <button type="button" className={primaryButton} onClick={onRegenerate} disabled={busy}>
          <RefreshCw size={18} aria-hidden className={busy ? "animate-spin" : ""} />
          {busy ? "Membuat QR…" : "Buat QR baru"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <div>
        <p className="text-[15px] text-text-body">Total yang dibayar</p>
        <p className="text-[30px] font-bold tabular-nums text-text-heading">{formatRupiah(payment.amount)}</p>
      </div>

      {payment.qr_string && (
        <>
          <QrCode value={payment.qr_string} label={`QRIS pembayaran ${formatRupiah(payment.amount)}`} />
          <p className="max-w-[320px] text-[15px] leading-relaxed text-text-body">
            Pindai dengan aplikasi bank atau dompet digital yang mendukung QRIS. Memesan dari HP ini? Simpan
            tangkapan layar, lalu unggah dari aplikasi pembayaranmu.
          </p>
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

      {remaining !== null && (
        <p className="text-[15px] text-text-body" aria-live="off">
          Berlaku{" "}
          <span className={`font-semibold tabular-nums ${remaining < 60_000 ? "text-danger" : "text-text-heading"}`}>
            {countdown(remaining)}
          </span>
        </p>
      )}
      <p className="text-[14px] text-text-muted">Status diperbarui otomatis setelah pembayaran berhasil.</p>
      {error && <Notice tone="danger" role="alert">{error}</Notice>}
    </div>
  );
}
