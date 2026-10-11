"use client";

import React, { useEffect, useState } from "react";
import { ApiError, postJson } from "@/lib/sissiApi";
import {
  ACCOUNT_DELETION_ENDPOINTS,
  ACCOUNT_DELETION_GRACE_DAYS,
  ACCOUNT_DELETION_REASON_MAX,
  PRIVACY_EMAIL,
} from "@/constants/accountDeletion";

type Otp = {
  identifier: string;
  masked_destination: string;
  expires_in: number;
  resend_in: number;
};

type DeletionScheduled = { purge_after?: string | null };

type Step =
  | { name: "identify" }
  | { name: "verify"; otp: Otp; resendAt: number }
  | { name: "done"; purgeAfter: string | null };

type FormError = { message: string; field?: string; unavailable?: boolean };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^(\+62|62|0)8\d{7,12}$/;

const inputClass =
  "w-full h-[46px] px-4 rounded-[8px] border border-[#e4e9e7] focus:border-[#f1702c] focus:outline-none text-[15px] text-[#292e31] placeholder-[#b0b8b5] disabled:bg-[#f3f6f5]";
const labelClass = "block text-[14px] font-medium text-[#292e31] mb-2";
const primaryButtonClass =
  "h-[48px] px-6 rounded-[8px] bg-[#f1702c] hover:bg-[#ff7a45] text-white font-medium text-[15px] flex items-center justify-center transition-colors shadow-2xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed";
const linkButtonClass =
  "text-[14px] font-medium text-[#f1702c] hover:underline cursor-pointer disabled:text-[#7d8986] disabled:no-underline disabled:cursor-not-allowed";

// Email dikirim apa adanya (server menormalisasi); nomor HP dibersihkan dari spasi/tanda hubung.
function normalizeIdentifier(raw: string): { value: string; error?: string } {
  const value = raw.trim();
  if (!value) return { value, error: "Isi email atau nomor HP akun kamu." };
  if (value.includes("@")) {
    return EMAIL_RE.test(value) ? { value } : { value, error: "Format email belum benar." };
  }
  const phone = value.replace(/[\s\-().]/g, "");
  return PHONE_RE.test(phone)
    ? { value: phone }
    : { value, error: "Masukkan email, atau nomor HP Indonesia (contoh: 0812 3456 7890)." };
}

function toFormError(err: unknown): FormError {
  if (!(err instanceof ApiError)) {
    return { message: "Terjadi kesalahan. Coba lagi sebentar lagi." };
  }
  switch (err.code) {
    case "VALIDATION_ERROR": {
      const detail = err.details[0];
      return { message: detail?.message || err.message, field: detail?.field };
    }
    case "OTP_INVALID":
      return { message: "Kode salah. Periksa lagi kode di email kamu.", field: "code" };
    case "OTP_EXPIRED":
      return { message: "Kode sudah kedaluwarsa. Minta kode baru.", field: "code" };
    case "OTP_TOO_MANY_ATTEMPTS":
      return { message: "Terlalu banyak percobaan. Minta kode baru.", field: "code" };
    case "RATE_LIMITED":
      return {
        message: err.retryAfter
          ? `Terlalu banyak permintaan. Coba lagi dalam ${err.retryAfter} detik.`
          : "Terlalu banyak permintaan. Coba lagi sebentar lagi.",
      };
    case "NOT_FOUND":
    case "METHOD_NOT_ALLOWED":
    case "NETWORK_ERROR":
    case "TIMEOUT":
    case "BAD_RESPONSE":
      return {
        message: "Layanan hapus akun sedang tidak dapat dihubungi.",
        unavailable: true,
      };
    default:
      return { message: err.message };
  }
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function fallbackMailto(identifier: string, reason: string): string {
  const lines = [
    "Saya ingin menghapus akun Sissi beserta seluruh data usahanya.",
    "",
    `Email/nomor HP akun: ${identifier}`,
  ];
  if (reason) lines.push(`Alasan: ${reason}`);
  return `mailto:${PRIVACY_EMAIL}?subject=${encodeURIComponent(
    "Permintaan hapus akun Sissi"
  )}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function ErrorMessage({
  error,
  identifier,
  reason,
}: {
  error: FormError;
  identifier: string;
  reason: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-[8px] border border-[#f6c9b1] bg-[#fff5ef] px-4 py-3 text-[14px] text-[#a6461a] leading-relaxed"
    >
      {error.message}
      {error.unavailable && (
        <>
          {" "}
          Kirim permintaan lewat email ke{" "}
          <a href={fallbackMailto(identifier, reason)} className="font-semibold underline">
            {PRIVACY_EMAIL}
          </a>{" "}
          dari alamat email akun kamu. Kami proses paling lambat 7 hari kerja.
        </>
      )}
    </div>
  );
}

export function AccountDeletionForm() {
  const [step, setStep] = useState<Step>({ name: "identify" });
  const [identifier, setIdentifier] = useState("");
  const [reason, setReason] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  // Diisi dari event handler/interval saja (bukan saat render) agar halaman tetap bisa di-prerender.
  const [now, setNow] = useState(0);

  const resendAt = step.name === "verify" ? step.resendAt : 0;
  const resendIn = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    if (!resendAt) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [resendAt]);

  async function requestCode(value: string) {
    const otp = await postJson<Otp>(ACCOUNT_DELETION_ENDPOINTS.request, { identifier: value });
    const sentAt = Date.now();
    setNow(sentAt);
    setStep({ name: "verify", otp, resendAt: sentAt + (otp.resend_in ?? 60) * 1000 });
  }

  async function handleIdentify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    const { value, error: invalid } = normalizeIdentifier(identifier);
    if (invalid) {
      setError({ message: invalid, field: "identifier" });
      return;
    }
    if (!agreed) {
      setError({ message: "Centang pernyataan persetujuan untuk melanjutkan.", field: "agreed" });
      return;
    }
    setPending(true);
    setError(null);
    try {
      await requestCode(value);
      setCode("");
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setPending(false);
    }
  }

  async function handleResend() {
    if (step.name !== "verify" || pending || resendIn > 0) return;
    setPending(true);
    setError(null);
    try {
      await requestCode(step.otp.identifier);
      setCode("");
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setPending(false);
    }
  }

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step.name !== "verify" || pending) return;
    if (!/^\d{6}$/.test(code)) {
      setError({ message: "Kode terdiri dari 6 angka.", field: "code" });
      return;
    }
    setPending(true);
    setError(null);
    try {
      const trimmedReason = reason.trim();
      const result = await postJson<DeletionScheduled | null>(ACCOUNT_DELETION_ENDPOINTS.confirm, {
        identifier: step.otp.identifier,
        code,
        ...(trimmedReason ? { reason: trimmedReason } : {}),
      });
      setStep({ name: "done", purgeAfter: result?.purge_after ?? null });
    } catch (err) {
      setError(toFormError(err));
    } finally {
      setPending(false);
    }
  }

  function backToIdentify() {
    setStep({ name: "identify" });
    setCode("");
    setError(null);
  }

  if (step.name === "done") {
    const purgeDate = formatDate(step.purgeAfter);
    return (
      <div role="status" className="rounded-[12px] border border-[#cfe6dc] bg-[#f1f9f5] p-5">
        <p className="text-[16px] font-semibold text-[#1f5c43] mb-2">Permintaan hapus akun diterima</p>
        <p className="text-[15px] text-[#3c5a4d] leading-relaxed">
          Akun dan data usaha kamu dijadwalkan untuk dihapus permanen
          {purgeDate ? ` pada ${purgeDate}` : ` setelah ${ACCOUNT_DELETION_GRACE_DAYS} hari`}. Kami
          mengirim konfirmasi ke email akun. Berubah pikiran? Masuk kembali ke aplikasi Sissi sebelum
          tanggal tersebut untuk membatalkan.
        </p>
      </div>
    );
  }

  if (step.name === "verify") {
    const codeError = error?.field === "code";
    return (
      <form onSubmit={handleConfirm} noValidate className="flex flex-col gap-5">
        <p className="text-[15px] text-[#525866] leading-relaxed">
          Kami mengirim kode 6 angka ke{" "}
          <strong className="text-[#292e31] font-semibold">{step.otp.masked_destination}</strong>. Kode
          berlaku {Math.round((step.otp.expires_in ?? 300) / 60)} menit. Tidak menerima email? Periksa
          folder spam.
        </p>

        <div>
          <label htmlFor="deletion-code" className={labelClass}>
            Kode verifikasi
          </label>
          <input
            id="deletion-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            required
            placeholder="••••••"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            aria-invalid={codeError || undefined}
            aria-describedby={codeError ? "deletion-error" : undefined}
            disabled={pending}
            className={`${inputClass} font-mono tracking-[0.4em] text-[18px] max-w-[220px]`}
          />
        </div>

        {error && (
          <div id="deletion-error">
            <ErrorMessage error={error} identifier={step.otp.identifier} reason={reason.trim()} />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-1">
          <button type="submit" disabled={pending} className={primaryButtonClass}>
            {pending ? "Memproses…" : "Hapus akun permanen"}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={pending || resendIn > 0}
            className={linkButtonClass}
          >
            {resendIn > 0 ? `Kirim ulang kode (${resendIn} dtk)` : "Kirim ulang kode"}
          </button>
          <button type="button" onClick={backToIdentify} disabled={pending} className={linkButtonClass}>
            Ganti email/nomor HP
          </button>
        </div>
      </form>
    );
  }

  const identifierError = error?.field === "identifier";
  const reasonError = error?.field === "reason";
  const agreedError = error?.field === "agreed";
  return (
    <form onSubmit={handleIdentify} noValidate className="flex flex-col gap-5">
      <div>
        <label htmlFor="deletion-identifier" className={labelClass}>
          Email atau nomor HP akun
        </label>
        <input
          id="deletion-identifier"
          name="identifier"
          type="text"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
          placeholder="nama@usaha.id atau 08xx xxxx xxxx"
          value={identifier}
          onChange={(e) => {
            setIdentifier(e.target.value);
            setError(null);
          }}
          aria-invalid={identifierError || undefined}
          aria-describedby={identifierError ? "deletion-error" : "deletion-identifier-hint"}
          disabled={pending}
          className={inputClass}
        />
        <p id="deletion-identifier-hint" className="mt-2 text-[13px] text-[#7d8986]">
          Kode verifikasi selalu dikirim ke email akun pemilik.
        </p>
      </div>

      <div>
        <label htmlFor="deletion-reason" className={labelClass}>
          Alasan (opsional)
        </label>
        <textarea
          id="deletion-reason"
          name="reason"
          rows={3}
          maxLength={ACCOUNT_DELETION_REASON_MAX}
          placeholder="Ceritakan kenapa kamu berhenti"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          aria-invalid={reasonError || undefined}
          disabled={pending}
          className="w-full p-4 rounded-[8px] border border-[#e4e9e7] focus:border-[#f1702c] focus:outline-none text-[15px] text-[#292e31] placeholder-[#b0b8b5] resize-none disabled:bg-[#f3f6f5]"
        />
      </div>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          name="agreed"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          aria-invalid={agreedError || undefined}
          disabled={pending}
          className="mt-1 h-4 w-4 shrink-0 accent-[#f1702c] cursor-pointer"
        />
        <span className="text-[14px] text-[#525866] leading-relaxed">
          Saya pemilik usaha dan paham bahwa akun, semua outlet, serta seluruh data usaha akan dihapus
          permanen setelah masa tunggu {ACCOUNT_DELETION_GRACE_DAYS} hari.
        </span>
      </label>

      {error && (
        <div id="deletion-error">
          <ErrorMessage error={error} identifier={identifier.trim()} reason={reason.trim()} />
        </div>
      )}

      <button type="submit" disabled={pending} className={`${primaryButtonClass} mt-1 self-start`}>
        {pending ? "Mengirim kode…" : "Kirim kode verifikasi"}
      </button>
    </form>
  );
}
