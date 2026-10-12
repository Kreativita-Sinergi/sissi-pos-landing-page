"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, Package, ScrollText, Smartphone, Store } from "lucide-react";
import { ADMIN_MOCK, adminApi, setUnauthorizedHandler } from "@/lib/admin/api";
import type { MeResult } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { ErrorBlock, focusRing, iconBtn, Spinner } from "./ui";

// Kerangka panel admin: memeriksa sesi (GET /admin/auth/me) sebelum menampilkan halaman,
// mengarahkan ke /admin/login?next=… saat 401, navigasi samping (desktop) / tab atas (HP), dan tombol keluar.

const NAV = [
  { href: "/admin", label: "Ringkasan", short: "Ringkasan", icon: LayoutDashboard },
  { href: "/admin/versi", label: "Versi aplikasi", short: "Versi", icon: Smartphone },
  { href: "/admin/apk", label: "APK", short: "APK", icon: Package },
  { href: "/admin/bisnis", label: "Bisnis", short: "Bisnis", icon: Store },
  { href: "/admin/audit", label: "Audit", short: "Audit", icon: ScrollText },
];

/** `next` hanya boleh path relatif di bawah /admin (mencegah open redirect). */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/admin") || next.startsWith("//") || next.includes("\\")) return "/admin";
  if (next === "/admin/login" || next.startsWith("/admin/login?") || next.startsWith("/admin/login/")) return "/admin";
  return next;
}

export function loginUrl(next?: string): string {
  const n = safeNext(next);
  return n === "/admin" ? "/admin/login" : `/admin/login?next=${encodeURIComponent(n)}`;
}

const SessionContext = createContext<MeResult | null>(null);

export function useAdminSession(): MeResult {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useAdminSession di luar AdminShell");
  return s;
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function MockBanner() {
  if (!ADMIN_MOCK) return null;
  return (
    <div className="bg-warning-tint px-4 py-1.5 text-center text-[12px] font-semibold text-warning">
      Mode tiruan (NEXT_PUBLIC_ADMIN_MOCK=1) — data contoh, tidak terhubung ke server.
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<MeResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const toLogin = useCallback(() => {
    router.replace(loginUrl(currentPath()));
  }, [router]);

  useEffect(() => {
    setUnauthorizedHandler(toLogin);
    return () => setUnauthorizedHandler(null);
  }, [toLogin]);

  useEffect(() => {
    const ctrl = new AbortController();
    adminApi()
      .then((api) => api.me(ctrl.signal))
      .then((me) => {
        setSession(me);
        setError(null);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) toLogin();
        else setError(err);
      });
    return () => ctrl.abort();
  }, [attempt, toLogin]);

  async function logout() {
    setLoggingOut(true);
    try {
      await (await adminApi()).logout();
    } catch {
      // Tetap keluar dari tampilan; sesi server habis sendiri.
    }
    router.replace("/admin/login");
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg-muted">
        <MockBanner />
        <div className="flex flex-1 items-center justify-center p-4">
          {error ? (
            <div className="w-full max-w-[420px]">
              <ErrorBlock
                error={error}
                onRetry={() => {
                  setError(null);
                  setAttempt((a) => a + 1);
                }}
              />
            </div>
          ) : (
            <p role="status" className="flex items-center gap-2 text-[14px] text-text-muted">
              <Spinner /> Memeriksa sesi…
            </p>
          )}
        </div>
      </div>
    );
  }

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const { admin } = session;

  return (
    <SessionContext.Provider value={session}>
      <div className="flex min-h-dvh flex-col bg-bg-muted text-text-heading">
        <div className="flex flex-1">
          {/* Navigasi samping — desktop */}
          <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-border-subtle bg-white lg:flex">
            <div className="flex h-16 items-center gap-2.5 px-5">
              <Image src="/logos/sissi-icon.svg" alt="" width={28} height={28} />
              <div className="leading-tight">
                <p className="text-[15px] font-bold">Sissi</p>
                <p className="text-[12px] text-text-muted">Admin platform</p>
              </div>
            </div>
            <nav aria-label="Menu admin" className="flex flex-1 flex-col gap-0.5 px-3 pt-2">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors ${
                      active ? "bg-brand-tint text-brand-ink" : "text-text-body hover:bg-bg-muted hover:text-text-heading"
                    } ${focusRing}`}
                  >
                    <Icon size={18} aria-hidden />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <div className="border-t border-border-subtle p-3">
              <div className="flex items-center gap-2 rounded-[10px] px-2 py-1.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">{admin.name}</p>
                  <p className="truncate text-[12px] text-text-muted">{admin.email}</p>
                </div>
                <button type="button" className={iconBtn} onClick={logout} disabled={loggingOut} aria-label="Keluar" title="Keluar">
                  {loggingOut ? <Spinner /> : <LogOut size={17} aria-hidden />}
                </button>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <MockBanner />
            {/* Kepala + tab — HP & tablet */}
            <header className="sticky top-0 z-20 border-b border-border-subtle bg-white lg:hidden">
              <div className="flex h-14 items-center gap-2.5 px-4">
                <Image src="/logos/sissi-icon.svg" alt="" width={26} height={26} />
                <p className="min-w-0 flex-1 truncate text-[15px] font-bold">
                  Sissi <span className="font-medium text-text-muted">Admin</span>
                </p>
                <button type="button" className={iconBtn} onClick={logout} disabled={loggingOut} aria-label={`Keluar (${admin.email})`}>
                  {loggingOut ? <Spinner /> : <LogOut size={18} aria-hidden />}
                </button>
              </div>
              <nav aria-label="Menu admin" className="-mb-px flex gap-1 overflow-x-auto px-2 [scrollbar-width:none]">
                {NAV.map(({ href, short }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-[14px] font-medium ${
                        active ? "border-brand-deep text-brand-ink" : "border-transparent text-text-body"
                      } ${focusRing}`}
                    >
                      {short}
                    </Link>
                  );
                })}
              </nav>
            </header>

            <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
          </div>
        </div>
      </div>
    </SessionContext.Provider>
  );
}
