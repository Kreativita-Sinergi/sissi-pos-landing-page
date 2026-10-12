"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import { ApiError } from "@/lib/sissiApi";
import { MockBanner, safeNext } from "./AdminShell";
import { btn, errorMessage, Field, focusRing, formatWait, inputClass, Notice, Spinner } from "./ui";

export function LoginView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(0);

  // Hitung mundur saat terkunci.
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || lockedUntil) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Isi email dan password.");
      return;
    }
    setBusy(true);
    try {
      await (await adminApi()).login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setBusy(false);
      setPassword("");
      if (err instanceof ApiError && err.code === "INVALID_CREDENTIALS") {
        setError("Email atau password salah.");
      } else if (err instanceof ApiError && err.status === 429) {
        const wait = err.retryAfter ?? 900;
        setLockedUntil(Date.now() + wait * 1000);
        setError(null);
      } else if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        setError("Periksa format email dan password.");
      } else {
        setError(errorMessage(err));
      }
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg-muted">
      <MockBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/logos/sissi-icon.svg" alt="" width={36} height={36} priority />
            <div className="leading-tight">
              <p className="text-[17px] font-bold text-text-heading">Sissi</p>
              <p className="text-[13px] text-text-muted">Admin platform</p>
            </div>
          </div>

          <div className="rounded-[16px] border border-border-subtle bg-white p-5 sm:p-6">
            <h1 className="text-[20px] font-bold tracking-tight text-text-heading">Masuk</h1>
            <p className="mt-1 text-[14px] text-text-body">Khusus tim Sissi. Akun dibuat lewat CLI server.</p>

            <form className="mt-5 flex flex-col gap-4" onSubmit={submit} noValidate>
              {lockLeft !== null && lockLeft > 0 && (
                <Notice tone="warning" role="alert" icon={<Lock size={16} aria-hidden />} title="Terkunci sementara">
                  Terlalu banyak percobaan masuk. Coba lagi dalam{" "}
                  <span className="font-semibold tabular-nums">{formatWait(lockLeft)}</span>.
                </Notice>
              )}
              {error && (
                <Notice tone="danger" role="alert">
                  {error}
                </Notice>
              )}
              <Field id="email" label="Email">
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  inputMode="email"
                  className={inputClass}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </Field>
              <Field id="password" label="Password">
                <div className="relative">
                  <input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete="current-password"
                    className={`${inputClass} pr-11`}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
              <button type="submit" className={`${btn.primary} mt-1 w-full`} disabled={busy || (lockLeft ?? 0) > 0}>
                {busy && <Spinner />}
                {busy ? "Memeriksa…" : "Masuk"}
              </button>
            </form>
          </div>
          <p className="mt-4 text-center text-[12px] text-text-muted">Sesi berakhir setelah 2 jam tanpa aktivitas.</p>
        </div>
      </main>
    </div>
  );
}
