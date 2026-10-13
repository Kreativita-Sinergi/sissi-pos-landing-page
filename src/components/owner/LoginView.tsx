"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download, Eye, EyeOff, Lock } from "lucide-react";
import { btn, errorMessage, Field, fieldErrors, focusRing, formatWait, inputClass, Notice, Spinner } from "@/components/admin/ui";
import { deviceId, OWNER_MOCK, ownerApi } from "@/lib/owner/api";
import { ApiError } from "@/lib/sissiApi";
import { GOOGLE_CLIENT_ID, GoogleButton } from "./GoogleButton";
import { OwnerMockBanner, safeNext } from "./OwnerShell";

// Masuk dasbor pemilik: email/nomor HP + password, atau Google Identity Services (bila
// NEXT_PUBLIC_GOOGLE_CLIENT_ID diisi). Daftar & reset password hanya lewat aplikasi.

type LoginError = { title?: string; text: string; tone?: "danger" | "warning"; download?: boolean };

function describe(err: unknown, via: "password" | "google"): LoginError | "locked" {
  if (!(err instanceof ApiError)) return { text: errorMessage(err) };
  switch (err.code) {
    case "INVALID_CREDENTIALS":
      return { text: "Email/nomor HP atau password salah." };
    case "OWNER_ONLY":
      return { title: "Khusus pemilik usaha", text: "Dasbor web khusus pemilik usaha. Karyawan memakai aplikasi.", tone: "warning" };
    case "EMAIL_NOT_VERIFIED":
      return {
        title: "Email belum terverifikasi",
        text: "Buka aplikasi Sissi dan selesaikan verifikasi email (kode OTP), lalu coba masuk lagi.",
        tone: "warning",
      };
    case "RATE_LIMITED":
      return "locked";
    case "GOOGLE_NOT_REGISTERED":
      return {
        title: "Email Google ini belum punya akun Sissi",
        text: "Unduh aplikasi Sissi lalu daftarkan usahamu di sana (bisa memakai Google yang sama). Setelah itu, masuk ke dasbor web.",
        tone: "warning",
        download: true,
      };
    case "GOOGLE_EMPLOYEE_NOT_ALLOWED":
      return {
        title: "Akun karyawan",
        text: "Email ini terdaftar sebagai karyawan. Dasbor web khusus pemilik usaha; karyawan masuk lewat aplikasi dengan PIN.",
        tone: "warning",
      };
    case "GOOGLE_ACCOUNT_MISMATCH":
      return {
        title: "Akun Google berbeda",
        text: "Email ini sudah tertaut ke akun Google lain. Pakai akun Google yang sama dengan di aplikasi, atau masuk dengan email & password.",
      };
    case "GOOGLE_NOT_CONFIGURED":
      return { text: "Masuk dengan Google belum tersedia saat ini. Gunakan email/nomor HP dan password." };
    case "GOOGLE_TOKEN_INVALID":
      return { text: "Masuk dengan Google gagal. Coba lagi." };
    case "VALIDATION_ERROR":
      return via === "password" ? { text: "Periksa email/nomor HP dan password." } : { text: errorMessage(err) };
    default:
      return { text: errorMessage(err) };
  }
}

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<null | "password" | "google">(null);
  const [error, setError] = useState<LoginError | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [checking, setChecking] = useState(true);
  const rememberRef = useRef(remember);
  useEffect(() => {
    rememberRef.current = remember;
  });

  // Sudah masuk → langsung ke dasbor.
  useEffect(() => {
    const ctrl = new AbortController();
    ownerApi()
      .then((api) => api.me(ctrl.signal))
      .then(() => router.replace(next))
      .catch(() => {
        if (!ctrl.signal.aborted) setChecking(false);
      });
    return () => ctrl.abort();
  }, [next, router]);

  // Hitung mundur saat dibatasi.
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= lockedUntil) setLockedUntil(null);
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [lockedUntil]);
  const lockLeft = lockedUntil && now ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : null;
  const locked = (lockLeft ?? 0) > 0;

  const fail = useCallback((err: unknown, via: "password" | "google") => {
    setBusy(null);
    const d = describe(err, via);
    if (d === "locked") {
      const wait = err instanceof ApiError && err.retryAfter ? err.retryAfter : 60;
      setLockedUntil(Date.now() + wait * 1000);
      setError(null);
      return;
    }
    setFields(via === "password" ? fieldErrors(err) : {});
    setError(d);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || locked) return;
    setError(null);
    setFields({});
    const id = identifier.trim();
    const missing: Record<string, string> = {};
    if (!id) missing.identifier = "Isi email atau nomor HP.";
    if (!password) missing.password = "Isi password.";
    if (Object.keys(missing).length) {
      setFields(missing);
      return;
    }
    setBusy("password");
    try {
      await (await ownerApi()).login({ identifier: id, password, remember_me: remember, device_id: deviceId() });
      router.replace(next);
    } catch (err) {
      setPassword("");
      fail(err, "password");
    }
  }

  const google = useCallback(
    async (idToken: string) => {
      setError(null);
      setFields({});
      setBusy("google");
      try {
        await (await ownerApi()).google({ id_token: idToken, remember_me: rememberRef.current, device_id: deviceId() });
        router.replace(next);
      } catch (err) {
        fail(err, "google");
      }
    },
    [fail, next, router]
  );

  const showGoogle = !!GOOGLE_CLIENT_ID || OWNER_MOCK;

  return (
    <div className="flex min-h-dvh flex-col bg-bg-muted">
      <OwnerMockBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Link href="/" className={`rounded ${focusRing}`} aria-label="Beranda Sissi">
              <Image src="/logos/sissi-logo-horizontal.svg" alt="Sissi" width={99} height={32} priority />
            </Link>
            <span className="h-6 w-px bg-border-subtle" aria-hidden />
            <p className="text-[14px] font-medium text-text-muted">Dasbor pemilik</p>
          </div>

          <div className="rounded-[16px] border border-border-subtle bg-white p-5 sm:p-6">
            <h1 className="text-[20px] font-bold tracking-tight text-text-heading">Masuk</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-text-body">
              Pantau penjualan, outlet, dan kas usahamu dari browser. Pakai akun pemilik yang sama dengan di aplikasi Sissi.
            </p>

            <div className="mt-5 flex flex-col gap-4">
              {locked && (
                <Notice tone="warning" role="alert" icon={<Lock size={16} aria-hidden />} title="Terlalu banyak percobaan">
                  Coba lagi dalam <span className="font-semibold tabular-nums">{formatWait(lockLeft!)}</span>.
                </Notice>
              )}
              {error && (
                <Notice tone={error.tone ?? "danger"} role="alert" title={error.title}>
                  <p>{error.text}</p>
                  {error.download && (
                    <Link href="/download" className={`mt-2 inline-flex items-center gap-1.5 font-semibold underline underline-offset-2 ${focusRing}`}>
                      <Download size={15} aria-hidden /> Unduh aplikasi Sissi
                    </Link>
                  )}
                </Notice>
              )}

              <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
                <Field id="identifier" label="Email atau nomor HP" error={fields.identifier}>
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={inputClass}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    aria-invalid={!!fields.identifier}
                    aria-describedby={fields.identifier ? "identifier-error" : undefined}
                    placeholder="nama@email.com atau 0812…"
                    required
                  />
                </Field>
                <Field id="password" label="Password" error={fields.password}>
                  <div className="relative">
                    <input
                      id="password"
                      type={show ? "text" : "password"}
                      autoComplete="current-password"
                      className={`${inputClass} pr-11`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={!!fields.password}
                      aria-describedby={fields.password ? "password-error" : undefined}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                      aria-pressed={show}
                      className={`absolute top-1/2 right-1 inline-flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-text-muted hover:text-text-heading ${focusRing}`}
                    >
                      {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                    </button>
                  </div>
                </Field>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-[14px] text-text-heading">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="h-4 w-4 accent-brand-deep"
                      aria-describedby="remember-hint"
                    />
                    Ingat saya
                    <span id="remember-hint" className="sr-only">
                      Tetap masuk hingga 30 hari di browser ini
                    </span>
                  </label>
                  <ForgotPassword />
                </div>
                <button type="submit" className={`${btn.primary} w-full`} disabled={!!busy || locked}>
                  {busy === "password" && <Spinner />}
                  {busy === "password" ? "Memeriksa…" : "Masuk"}
                </button>
              </form>

              {showGoogle && (
                <>
                  <div className="flex items-center gap-3 text-[12.5px] text-text-muted" aria-hidden>
                    <span className="h-px flex-1 bg-border-subtle" />
                    atau
                    <span className="h-px flex-1 bg-border-subtle" />
                  </div>
                  <GoogleButton disabled={!!busy || locked || checking} busy={busy === "google"} onCredential={google} onError={(t) => setError({ text: t })} />
                </>
              )}
            </div>
          </div>

          <p className="mt-5 text-center text-[13.5px] text-text-body">
            Belum punya akun?{" "}
            <Link href="/download" className={`font-semibold text-brand-ink underline underline-offset-2 ${focusRing}`}>
              Unduh aplikasi Sissi
            </Link>{" "}
            dan daftar di sana.
          </p>
          <p className="mt-2 text-center text-[12px] text-text-muted">
            {remember ? "Tetap masuk hingga 30 hari di browser ini." : "Sesi berakhir setelah 2 jam tanpa aktivitas."}
          </p>
        </div>
      </main>
    </div>
  );
}

function ForgotPassword() {
  const [open, setOpen] = useState(false);
  return (
    <div className="text-right">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="forgot-help"
        onClick={() => setOpen((o) => !o)}
        className={`min-h-9 text-[13.5px] font-semibold text-brand-ink underline-offset-2 hover:underline ${focusRing}`}
      >
        Lupa password?
      </button>
      {open && (
        <p id="forgot-help" className="mt-1 max-w-[260px] text-left text-[12.5px] leading-relaxed text-text-body">
          Reset password lewat aplikasi Sissi: di layar Masuk, ketuk <strong className="font-semibold">Lupa password?</strong>, lalu ikuti kode yang dikirim ke email.
        </p>
      )}
    </div>
  );
}
