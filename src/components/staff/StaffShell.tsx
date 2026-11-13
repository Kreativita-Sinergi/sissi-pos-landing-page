"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Armchair, CalendarDays, Clock3, LogOut } from "lucide-react";
import { ErrorBlock, focusRing, Spinner } from "@/components/admin/ui";
import { setStaffUnauthorizedHandler, STAFF_MOCK, staffApi } from "@/lib/staff/api";
import { ROLE_LABEL } from "@/lib/staff/clock";
import type { StaffSession } from "@/lib/staff/types";
import { ApiError } from "@/lib/sissiApi";

// Kerangka web karyawan (/karyawan): memeriksa sesi karyawan (GET /staff/auth/me) sebelum menampilkan halaman,
// mengarahkan ke /karyawan/masuk saat 401. Semua peran: Absen & Riwayat; Pelayan juga Meja (api.md "Pelayan lewat web").
// Sesi pemilik (/dasbor) tidak disentuh — cookie, header, dan penangan 401 terpisah.

type StaffContext = { session: StaffSession };
const Ctx = createContext<StaffContext | null>(null);

export function useStaff(): StaffContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useStaff di luar StaffShell");
  return c;
}

export function StaffMockBanner() {
  if (!STAFF_MOCK) return null;
  return (
    <div className="bg-warning-tint px-4 py-1.5 text-center text-[12px] font-semibold text-warning">
      Mode tiruan (NEXT_PUBLIC_STAFF_MOCK=1) — data contoh, tidak terhubung ke server.
    </div>
  );
}

export function staffLoginUrl(next?: string): string {
  return next && next !== "/karyawan" ? `/karyawan/masuk?next=${encodeURIComponent(next)}` : "/karyawan/masuk";
}

const NAV = [
  { href: "/karyawan", label: "Absen", icon: Clock3 },
  { href: "/karyawan/riwayat", label: "Riwayat", icon: CalendarDays },
];
const WAITER_NAV = [{ href: "/karyawan/meja", label: "Meja", icon: Armchair }, ...NAV];

/** Layar catat pesanan memakai bingkai penuh halaman pesan (tanpa kepala & menu karyawan). */
const BARE = /^\/karyawan\/meja\/[^/]+\/tambah\/?$/;

export function StaffShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<StaffSession | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  const [leaving, setLeaving] = useState(false);

  // Navigasi penuh (bukan router.replace): Next menyimpan pohon rute yang ditinggalkan beserta state-nya, sehingga
  // setelah masuk lagi (mungkin akun lain) shell lama — sesi & tombol Keluar yang masih "memproses" — akan muncul
  // kembali. Muat ulang dokumen membuang semua state klien sesi sebelumnya.
  const toLogin = useCallback(() => {
    window.location.replace(staffLoginUrl(`${window.location.pathname}${window.location.search}`));
  }, []);

  useEffect(() => {
    setStaffUnauthorizedHandler(toLogin);
    return () => setStaffUnauthorizedHandler(null);
  }, [toLogin]);

  useEffect(() => {
    const ctrl = new AbortController();
    staffApi()
      .then((api) => api.me(ctrl.signal))
      .then((s) => {
        if (!ctrl.signal.aborted) setSession(s);
      })
      .catch((err) => {
        if (ctrl.signal.aborted) return;
        if (err instanceof ApiError && err.status === 401) toLogin();
        else setError(err);
      });
    return () => ctrl.abort();
  }, [attempt, toLogin]);

  async function logout() {
    setLeaving(true);
    try {
      await (await staffApi()).logout();
    } catch {
      // Tetap keluar dari tampilan; cookie kedaluwarsa sendiri.
    }
    window.location.replace("/karyawan/masuk");
  }

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg-muted">
        <StaffMockBanner />
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

  const role = ROLE_LABEL[session.user.role] ?? "Karyawan";
  const nav = session.user.role === "waiter" ? WAITER_NAV : NAV;
  if (BARE.test(pathname)) {
    return (
      <Ctx.Provider value={{ session }}>
        <StaffMockBanner />
        {children}
      </Ctx.Provider>
    );
  }
  return (
    <Ctx.Provider value={{ session }}>
      <div className="flex min-h-dvh flex-col bg-bg-muted">
        <StaffMockBanner />
        <header className="border-b border-border-subtle bg-white">
          <div className="mx-auto flex max-w-[640px] items-center gap-3 px-4 pt-3 pb-2">
            <Link href="/" className={`shrink-0 rounded ${focusRing}`} aria-label="Beranda situs Sissi">
              <Image src="/logos/sissi-logo-horizontal.svg" alt="Sissi" width={68} height={22} />
            </Link>
            <span className="h-4 w-px shrink-0 bg-border-subtle" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold text-text-heading">{session.business.name}</p>
              <p className="truncate text-[12px] text-text-muted">
                {session.user.name} · {session.user.job_title || role}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              disabled={leaving}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5 text-[13.5px] font-semibold text-text-body hover:bg-bg-muted hover:text-text-heading disabled:opacity-50 ${focusRing}`}
            >
              {leaving ? <Spinner size={15} /> : <LogOut size={16} aria-hidden />}
              Keluar
            </button>
          </div>
          <nav aria-label="Menu karyawan" className="mx-auto flex max-w-[640px] gap-1 px-2">
            {nav.map(({ href, label, icon: Icon }) => {
              const active = href === "/karyawan" ? pathname === "/karyawan" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`relative inline-flex min-h-11 items-center gap-1.5 rounded-t-[8px] px-3 text-[14px] font-semibold ${
                    active ? "text-brand-ink" : "text-text-body hover:text-text-heading"
                  } ${focusRing}`}
                >
                  <Icon size={16} aria-hidden />
                  {label}
                  {active && <span aria-hidden className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-brand-primary" />}
                </Link>
              );
            })}
          </nav>
        </header>
        <main id="konten" className="mx-auto w-full max-w-[640px] flex-1 px-4 pt-5 pb-12">
          {children}
        </main>
      </div>
    </Ctx.Provider>
  );
}
