"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { btn, Field, focusRing, inputClass, Notice, Spinner } from "@/components/admin/ui";
import { staffApi, staffDeviceId } from "@/lib/staff/api";
import { safeStaffNext, staffHome } from "@/lib/staff/clock";
import { loginErrorMessage, type StaffMessage } from "@/lib/staff/errors";
import { ApiError } from "@/lib/sissiApi";
import { StaffMockBanner } from "./StaffShell";

// Masuk web karyawan (/karyawan/masuk): no. HP/email + kata sandi akun pribadi (dibuat lewat undangan pemilik).
// Akun pemilik → STAFF_ONLY → dialihkan ke /masuk (dasbor) dengan pesan.

export function StaffLoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeStaffNext(params.get("next"));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<StaffMessage | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  // Sudah masuk → langsung ke halaman absen.
  useEffect(() => {
    const ctrl = new AbortController();
    staffApi()
      .then((api) => api.me(ctrl.signal))
      .then((s) => {
        if (!ctrl.signal.aborted) router.replace(staffHome(s.user.role, next));
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [next, router]);

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setTimeout(() => setLockedUntil(null), Math.max(0, lockedUntil - Date.now()));
    return () => clearTimeout(t);
  }, [lockedUntil]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || lockedUntil) return;
    setError(null);
    const id = identifier.trim();
    const missing: Record<string, string> = {};
    if (!id) missing.identifier = "Isi no. HP atau email.";
    if (!password) missing.password = "Isi kata sandi.";
    setFields(missing);
    if (Object.keys(missing).length) return;
    setBusy(true);
    try {
      const s = await (await staffApi()).login({ identifier: id, password, remember_me: remember, device_id: staffDeviceId() });
      router.replace(staffHome(s.user.role, next));
    } catch (err) {
      setBusy(false);
      setPassword("");
      if (err instanceof ApiError && err.code === "STAFF_ONLY") {
        router.replace("/masuk?dari=karyawan");
        return;
      }
      if (err instanceof ApiError && err.code === "RATE_LIMITED") setLockedUntil(Date.now() + (err.retryAfter ?? 60) * 1000);
      setError(loginErrorMessage(err));
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg-muted">
      <StaffMockBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[420px]">
          <div className="mb-6 flex items-center justify-center gap-3">
            <Link href="/" className={`rounded ${focusRing}`} aria-label="Beranda Sissi">
              <Image src="/logos/sissi-logo-horizontal.svg" alt="Sissi" width={99} height={32} priority />
            </Link>
            <span className="h-6 w-px bg-border-subtle" aria-hidden />
            <p className="text-[14px] font-medium text-text-muted">Absen karyawan</p>
          </div>

          <div className="rounded-[16px] border border-border-subtle bg-white p-5 sm:p-6">
            <h1 className="text-[20px] font-bold tracking-tight text-text-heading">Masuk karyawan</h1>
            <p className="mt-1 text-[14px] leading-relaxed text-text-body">
              Absen masuk & pulang dari browser HP atau komputer. Pakai no. HP dan kata sandi akun pribadimu di Sissi.
            </p>

            <div className="mt-5 flex flex-col gap-4">
              {error && (
                <Notice tone={error.tone === "info" ? "warning" : error.tone} role="alert" title={error.title}>
                  <p>{error.text}</p>
                </Notice>
              )}
              <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
                <Field id="identifier" label="No. HP atau email" error={fields.identifier}>
                  <input
                    id="identifier"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    className={inputClass}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    aria-invalid={!!fields.identifier}
                    aria-describedby={fields.identifier ? "identifier-error" : undefined}
                    placeholder="0812… atau nama@email.com"
                  />
                </Field>
                <Field id="password" label="Kata sandi" error={fields.password}>
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
                    />
                    <button
                      type="button"
                      onClick={() => setShow((s) => !s)}
                      aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                      aria-pressed={show}
                      className={`absolute top-1/2 right-1 inline-flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-text-muted hover:text-text-heading ${focusRing}`}
                    >
                      {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
                    </button>
                  </div>
                </Field>
                <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 self-start text-[14px] text-text-heading">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-brand-deep" />
                  Ingat saya di perangkat ini
                </label>
                <button type="submit" className={`${btn.primary} min-h-11 w-full`} disabled={busy || !!lockedUntil}>
                  {busy && <Spinner />}
                  {busy ? "Memeriksa…" : "Masuk"}
                </button>
              </form>
              <details className="text-[13px] text-text-body">
                <summary className={`min-h-9 cursor-pointer rounded font-semibold text-brand-ink ${focusRing}`}>Belum punya kata sandi / lupa?</summary>
                <p className="mt-1 leading-relaxed">
                  Minta pemilik usaha mengirim tautan undangan atau reset kata sandi dari menu Tim. Buka tautannya, lalu pilih{" "}
                  <strong className="font-semibold">Aktifkan lewat website</strong>.
                </p>
              </details>
            </div>
          </div>

          <p className="mt-5 text-center text-[13.5px] text-text-body">
            Pemilik usaha?{" "}
            <Link href="/masuk" className={`font-semibold text-brand-ink underline underline-offset-2 ${focusRing}`}>
              Masuk ke dasbor pemilik
            </Link>
          </p>
          <p className="mt-2 text-center text-[12px] text-text-muted">
            {remember ? "Tetap masuk hingga 30 hari di browser ini." : "Sesi berakhir setelah 2 jam tanpa aktivitas."}
          </p>
        </div>
      </main>
    </div>
  );
}
