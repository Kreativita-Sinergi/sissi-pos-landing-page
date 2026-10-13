"use client";

import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Boxes, ChartColumn, ChevronDown, CreditCard, History, House, IdCard, LogOut, Package, ReceiptText, Settings, Store, UsersRound, Wallet } from "lucide-react";
import { Avatar } from "@/components/admin/AdminShell";
import { FilterSelect } from "@/components/admin/FilterMenu";
import { useQueryState } from "@/components/admin/filters";
import { ToastProvider } from "@/components/admin/toast";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Badge, ErrorBlock, focusRing, iconBtn, Spinner } from "@/components/admin/ui";
import { OWNER_MOCK, ownerApi, setUnauthorizedHandler } from "@/lib/owner/api";
import type { OwnerOutlet, OwnerSession } from "@/lib/owner/types";
import { setOwnerZone } from "@/lib/owner/tz";
import { ApiError } from "@/lib/sissiApi";
import { planLabel } from "./labels";

// Kerangka dasbor pemilik: memeriksa sesi (GET /owner/auth/me) sebelum menampilkan halaman,
// mengarahkan ke /masuk?next=… saat 401, navigasi samping (desktop) / tab atas (HP), pemilih outlet
// (tersimpan di ?outlet= agar tautan bisa dibagikan), badge paket, dan menu akun + Keluar.

const NAV_GROUPS = [
  {
    label: "Pantau",
    items: [
      { href: "/dasbor", label: "Beranda", icon: House },
      { href: "/dasbor/laporan", label: "Laporan", icon: ChartColumn },
      { href: "/dasbor/outlet", label: "Outlet", icon: Store },
      { href: "/dasbor/transaksi", label: "Transaksi", icon: ReceiptText },
      { href: "/dasbor/shift", label: "Shift & kas", icon: Wallet },
      { href: "/dasbor/aktivitas", label: "Aktivitas", icon: History },
    ],
  },
  {
    label: "Kelola",
    items: [
      { href: "/dasbor/produk", label: "Produk", icon: Package },
      { href: "/dasbor/stok", label: "Stok", icon: Boxes },
      { href: "/dasbor/pelanggan", label: "Pelanggan", icon: UsersRound },
      { href: "/dasbor/tim", label: "Tim", icon: IdCard },
    ],
  },
  {
    label: "Akun",
    items: [
      { href: "/dasbor/langganan", label: "Langganan", icon: CreditCard },
      { href: "/dasbor/pengaturan", label: "Pengaturan", icon: Settings },
    ],
  },
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);

/** `next` hanya boleh path relatif di bawah /dasbor (mencegah open redirect). */
export function safeNext(next: string | null | undefined): string {
  if (!next || next.startsWith("//") || next.includes("\\")) return "/dasbor";
  if (!/^\/dasbor(?:[/?#]|$)/.test(next)) return "/dasbor";
  return next;
}

export function loginUrl(next?: string): string {
  const n = safeNext(next);
  return n === "/dasbor" ? "/masuk" : `/masuk?next=${encodeURIComponent(n)}`;
}

type OwnerContext = {
  session: OwnerSession;
  /** Outlet terpilih (`?outlet=`), atau undefined = semua outlet. */
  outletId: string | undefined;
  outlet: OwnerOutlet | null;
  /** Tambahkan `?outlet=` aktif ke tautan dalam dasbor. */
  withOutlet: (href: string) => string;
  /** Muat ulang sesi (mis. setelah zona waktu usaha diubah); isi halaman dipasang ulang bila zona berubah. */
  refreshSession: () => Promise<void>;
};

const Ctx = createContext<OwnerContext | null>(null);

export function useOwner(): OwnerContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useOwner di luar OwnerShell");
  return c;
}

export function OwnerMockBanner() {
  if (!OWNER_MOCK) return null;
  return (
    <div className="bg-warning-tint px-4 py-1.5 text-center text-[12px] font-semibold text-warning">
      Mode tiruan (NEXT_PUBLIC_OWNER_MOCK=1) — data contoh, tidak terhubung ke server.
    </div>
  );
}

function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}

export function OwnerShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [session, setSession] = useState<OwnerSession | null>(null);
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
    ownerApi()
      .then((api) => api.me(ctrl.signal))
      .then((me) => {
        setOwnerZone(me.business.timezone);
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

  const refreshSession = useCallback(async () => {
    const me = await (await ownerApi()).me();
    setOwnerZone(me.business.timezone);
    setSession(me);
  }, []);

  // Keluar selalu lewat konfirmasi dulu (tombol sidebar & menu akun).
  const [confirmLogout, setConfirmLogout] = useState(false);
  const askLogout = useCallback(() => setConfirmLogout(true), []);
  const logout = useCallback(async () => {
    setLoggingOut(true);
    try {
      await (await ownerApi()).logout();
    } catch {
      // Tetap keluar dari tampilan; sesi server berakhir sendiri.
    }
    router.replace("/masuk");
  }, [router]);

  if (!session) {
    return (
      <div className="flex min-h-dvh flex-col bg-bg-muted">
        <OwnerMockBanner />
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

  const rawOutlet = params.get("outlet") ?? "";
  const outlet = session.outlets.find((o) => o.id === rawOutlet) ?? null;
  const outletId = outlet?.id;
  const withOutlet = (href: string) => {
    if (!outletId) return href;
    return `${href}${href.includes("?") ? "&" : "?"}outlet=${encodeURIComponent(outletId)}`;
  };
  const match = NAV.map((n) => n.href)
    .filter((h) => (h === "/dasbor" ? pathname === "/dasbor" : pathname === h || pathname.startsWith(`${h}/`)))
    .sort((a, b) => b.length - a.length)[0];
  const plan = planLabel(session.subscription);
  const { business, user } = session;

  return (
    <Ctx.Provider value={{ session, outletId, outlet, withOutlet, refreshSession }}>
      <ToastProvider>
      <div className="flex min-h-dvh flex-col bg-bg-muted text-text-heading">
        <div className="flex flex-1">
          {/* Navigasi samping — desktop */}
          <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col border-r border-border-subtle bg-white lg:flex">
            <div className="flex h-16 items-center gap-2.5 px-5">
              <Link href="/" className={`rounded ${focusRing}`} aria-label="Beranda situs Sissi">
                <Image src="/logos/sissi-logo-horizontal.svg" alt="Sissi" width={87} height={28} />
              </Link>
              <span className="h-5 w-px bg-border-subtle" aria-hidden />
              <p className="text-[13px] font-medium text-text-muted">Dasbor</p>
            </div>
            <div className="mx-3 mb-3 rounded-[12px] bg-bg-muted px-3 py-2.5">
              <p className="truncate text-[14px] font-semibold" title={business.name}>
                {business.name}
              </p>
              <div className="mt-1">
                <Badge tone={plan.tone}>{plan.text}</Badge>
              </div>
            </div>
            <nav aria-label="Menu dasbor" className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 pt-1 pb-3">
              {NAV_GROUPS.map((g) => (
                <div key={g.label}>
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-text-muted">{g.label}</p>
                  <div className="flex flex-col gap-0.5">
                    {g.items.map(({ href, label, icon: Icon }) => {
                      const active = href === match;
                      return (
                        <Link
                          key={href}
                          href={withOutlet(href)}
                          aria-current={active ? "page" : undefined}
                          className={`relative flex min-h-10 items-center gap-3 rounded-[10px] px-3 text-[14px] font-medium transition-colors ${
                            active
                              ? "bg-brand-tint font-semibold text-brand-ink before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-[3px] before:rounded-r-full before:bg-brand-primary"
                              : "text-text-body hover:bg-bg-muted hover:text-text-heading"
                          } ${focusRing}`}
                        >
                          <Icon size={18} aria-hidden strokeWidth={active ? 2.25 : 2} />
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
            <div className="border-t border-border-subtle p-3">
              <div className="flex items-center gap-1">
                <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5">
                  <Avatar name={user.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold">{user.name}</span>
                    <span className="block truncate text-[12px] text-text-muted" title={user.email}>
                      {user.email}
                    </span>
                  </span>
                </div>
                <button type="button" className={iconBtn} onClick={askLogout} disabled={loggingOut} aria-label="Keluar" title="Keluar">
                  {loggingOut ? <Spinner /> : <LogOut size={17} aria-hidden />}
                </button>
              </div>
            </div>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <OwnerMockBanner />
            {/* Kepala + tab — HP & tablet */}
            <header className="sticky top-0 z-20 border-b border-border-subtle bg-white lg:hidden">
              <div className="flex h-14 items-center gap-2.5 px-4">
                <Link href="/" className={`shrink-0 rounded ${focusRing}`} aria-label="Beranda situs Sissi">
                  <Image src="/logos/sissi-logo-horizontal.svg" alt="Sissi" width={74} height={24} />
                </Link>
                <span className="h-4 w-px shrink-0 bg-border-subtle" aria-hidden />
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text-heading">{business.name}</p>
                <AccountMenu session={session} onLogout={askLogout} loggingOut={loggingOut} planText={plan.text} />
              </div>
              <nav aria-label="Menu dasbor" className="-mb-px flex gap-1 overflow-x-auto px-2 [scrollbar-width:none]">
                {NAV.map(({ href, label, icon: Icon }, i) => {
                  const active = href === match;
                  const groupStart = i > 0 && NAV_GROUPS.some((g) => g.items[0].href === href);
                  return (
                    <React.Fragment key={href}>
                      {groupStart && <span aria-hidden className="my-2.5 w-px shrink-0 bg-border-subtle" />}
                      <Link
                        href={withOutlet(href)}
                        aria-current={active ? "page" : undefined}
                        ref={active ? (el) => el?.scrollIntoView({ block: "nearest", inline: "nearest" }) : undefined}
                        className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-[14px] font-medium ${
                          active ? "border-brand-deep text-brand-ink" : "border-transparent text-text-body"
                        } ${focusRing}`}
                      >
                        <Icon size={15} aria-hidden />
                        {label}
                      </Link>
                    </React.Fragment>
                  );
                })}
              </nav>
            </header>

            <main className="mx-auto w-full max-w-[1180px] flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <OutletPicker outlets={session.outlets} selected={outletId} />
                <span className="lg:hidden">
                  <Badge tone={plan.tone}>{plan.text}</Badge>
                </span>
              </div>
              {/* Dipasang ulang saat zona usaha berubah agar semua tanggal/periode dihitung ulang. */}
              <React.Fragment key={business.timezone}>{children}</React.Fragment>
            </main>
          </div>
        </div>
      </div>
        <ConfirmDialog
          open={confirmLogout}
          title="Keluar dari dasbor?"
          confirmLabel="Keluar"
          tone="danger"
          busy={loggingOut}
          onConfirm={() => void logout()}
          onClose={() => setConfirmLogout(false)}
        >
          Kamu perlu masuk lagi untuk membuka dasbor {session.business.name}. Aplikasi kasir di perangkat tidak terpengaruh.
        </ConfirmDialog>
      </ToastProvider>
    </Ctx.Provider>
  );
}

function OutletPicker({ outlets, selected }: { outlets: OwnerOutlet[]; selected: string | undefined }) {
  const qs = useQueryState();
  if (outlets.length <= 1) {
    return (
      <span className="inline-flex min-h-10 items-center gap-1.5 rounded-[10px] border border-border-subtle bg-white px-2.5 text-[13.5px]">
        <Store size={15} aria-hidden className="text-text-muted" />
        <span className="font-semibold">{outlets[0]?.name ?? "Belum ada outlet"}</span>
      </span>
    );
  }
  return (
    <FilterSelect
      label="Outlet"
      required
      highlight={!!selected}
      options={[
        { value: "all", label: "Semua outlet" },
        ...outlets.map((o) => ({ value: o.id, label: o.status === "closed" ? `${o.name} (tutup)` : o.name })),
      ]}
      selected={[selected ?? "all"]}
      onChange={(n) => qs.update({ outlet: n[0] === "all" ? null : n[0] })}
    />
  );
}

function AccountMenu({
  session,
  onLogout,
  loggingOut,
  planText,
}: {
  session: OwnerSession;
  onLogout: () => void;
  loggingOut: boolean;
  planText: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Akun (${session.user.email})`}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-0.5 rounded-full ${focusRing}`}
      >
        <Avatar name={session.user.name} />
        <ChevronDown size={14} aria-hidden className="text-text-muted" />
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute top-full right-0 z-30 mt-2 w-[260px] overflow-hidden rounded-[12px] border border-border-subtle bg-white shadow-[0_12px_32px_-8px_rgba(16,24,40,0.18)]"
        >
          <div className="border-b border-border-subtle px-4 py-3">
            <p className="truncate text-[14px] font-semibold">{session.user.name}</p>
            <p className="truncate text-[12.5px] text-text-muted">{session.user.email}</p>
            <p className="mt-1 text-[12.5px] text-text-body">
              {session.business.name} · {planText}
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            disabled={loggingOut}
            className={`flex min-h-11 w-full items-center gap-2.5 px-4 text-[14px] font-medium text-danger hover:bg-danger-tint ${focusRing}`}
          >
            {loggingOut ? <Spinner /> : <LogOut size={16} aria-hidden />}
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}
