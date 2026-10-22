"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { adminApi, setUnauthorizedHandler } from "@/lib/admin/api";
import type { Admin } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { Avatar, loginUrl, MockBanner, safeNext, useAdminSession } from "./AdminShell";
import { PasswordForm } from "./PasswordForm";
import { useToast } from "./toast";
import { btn, ErrorBlock, formatDateTime, Notice, PageHeader, Section, Spinner, TimeAgo } from "./ui";

/** /admin/akun — profil singkat + ganti password sendiri. */
export function AccountView() {
  const { admin, session } = useAdminSession();
  const toast = useToast();
  const [formKey, setFormKey] = useState(0);
  return (
    <>
      <PageHeader title="Akun saya" description="Ganti kata sandi Anda. Admin lain tidak bisa melihat kata sandi ini." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Section title="Ganti kata sandi" className="order-last lg:order-none">
          <div className="max-w-[440px]">
            <PasswordForm
              key={formKey}
              forced={false}
              username={admin.email}
              onDone={() => {
                setFormKey((k) => k + 1);
                toast.success("Kata sandi diganti. Sesi di perangkat lain sudah dikeluarkan.");
              }}
            />
          </div>
        </Section>
        <Section>
          <div className="flex items-center gap-3">
            <Avatar name={admin.name} size={44} />
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-text-heading">{admin.name}</p>
              <p className="truncate text-[13px] text-text-muted">{admin.email}</p>
            </div>
          </div>
          <dl className="mt-4 flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Login sebelumnya</dt>
              <dd>
                <TimeAgo value={admin.last_login_at} />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Sesi berakhir</dt>
              <dd className="text-right">{formatDateTime(session.expires_at)}</dd>
            </div>
          </dl>
          <Link href="/admin/tim" className={`${btn.secondary} mt-4 w-full`}>
            Lihat tim admin
          </Link>
        </Section>
      </div>
    </>
  );
}

/**
 * /admin/ganti-password — wajib setelah login dengan password sementara (`must_change_password`).
 * Di luar AdminShell karena server menolak semua rute lain (403 PASSWORD_CHANGE_REQUIRED) sampai diganti.
 */
export function ForcePasswordView() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const toast = useToast();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => router.replace(loginUrl(next)));
    return () => setUnauthorizedHandler(null);
  }, [router, next]);

  useEffect(() => {
    const ctrl = new AbortController();
    adminApi()
      .then((api) => api.me(ctrl.signal))
      .then((me) => {
        if (!me.admin.must_change_password) router.replace(next === "/admin" ? "/admin/akun" : next);
        else setAdmin(me.admin);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) router.replace(loginUrl(next));
        else setError(err);
      });
    return () => ctrl.abort();
  }, [attempt, router, next]);

  async function logout() {
    setLeaving(true);
    try {
      await (await adminApi()).logout();
    } catch {
      // Tetap keluar.
    }
    router.replace("/admin/login");
  }

  return (
    <div className="flex min-h-dvh flex-col bg-bg-muted">
      <MockBanner />
      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[440px]">
          <div className="mb-6 flex items-center gap-3">
            <Image src="/logos/sissi-logo-horizontal.svg" alt="Sissi" width={99} height={32} priority />
            <span className="h-6 w-px bg-border-subtle" aria-hidden />
            <p className="text-[14px] font-medium text-text-muted">Admin platform</p>
          </div>
          {error ? (
            <ErrorBlock
              error={error}
              onRetry={() => {
                setError(null);
                setAttempt((a) => a + 1);
              }}
            />
          ) : !admin ? (
            <p role="status" className="flex items-center justify-center gap-2 py-10 text-[14px] text-text-muted">
              <Spinner /> Memeriksa sesi…
            </p>
          ) : (
            <div className="rounded-[16px] border border-border-subtle bg-white p-5 sm:p-6">
              <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
                <KeyRound size={20} aria-hidden />
              </span>
              <h1 className="text-[20px] font-bold tracking-tight text-text-heading">Buat kata sandi baru</h1>
              <p className="mt-1 text-[14px] leading-relaxed text-text-body">
                Halo {admin.name}, Anda masuk dengan kata sandi sementara. Buat kata sandi pribadi dulu sebelum melanjutkan.
              </p>
              <div className="mt-4">
                <Notice tone="info">
                  Masuk sebagai <strong>{admin.email}</strong>
                </Notice>
              </div>
              <div className="mt-5">
                <PasswordForm
                  forced
                  username={admin.email}
                  submitLabel="Simpan & lanjutkan"
                  onDone={() => {
                    toast.success("Kata sandi baru disimpan. Selamat datang!");
                    router.replace(next);
                  }}
                />
              </div>
            </div>
          )}
          <div className="mt-4 flex justify-center">
            <button type="button" className={`${btn.ghost} text-[13px]`} onClick={logout} disabled={leaving}>
              {leaving ? <Spinner /> : <LogOut size={15} aria-hidden />} Keluar
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
