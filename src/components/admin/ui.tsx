"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Copy, Loader2 } from "lucide-react";
import { ApiError } from "@/lib/sissiApi";

// Gaya bersama halaman admin: padat (teks 14px, kontrol 40px), warna dari token globals.css.
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";

const btnBase = `inline-flex min-h-10 items-center justify-center gap-2 rounded-[10px] px-4 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const btn = {
  primary: `${btnBase} bg-brand-deep text-white hover:bg-brand-deeper`,
  secondary: `${btnBase} border border-border-subtle bg-white text-text-heading hover:border-border-active`,
  danger: `${btnBase} bg-danger text-white hover:bg-[#912018]`,
  ghost: `${btnBase} text-text-body hover:bg-bg-muted hover:text-text-heading`,
};

export const iconBtn = `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-text-body transition-colors hover:bg-bg-muted hover:text-text-heading disabled:opacity-40 ${focusRing}`;

export const inputClass = `min-h-10 w-full rounded-[10px] border border-border-subtle bg-white px-3 text-[14px] text-text-heading placeholder:text-text-muted focus:border-brand-primary focus:outline-none aria-[invalid=true]:border-danger ${focusRing}`;

export const cardClass = "rounded-[14px] border border-border-subtle bg-white";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        {back}
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-text-heading sm:text-[24px]">{title}</h1>
        {description && <p className="mt-1 max-w-[640px] text-[14px] leading-relaxed text-text-body">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Section({
  title,
  description,
  actions,
  children,
  className = "",
  bodyClass = "p-4 sm:p-5",
}: {
  title?: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`${cardClass} ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-text-heading">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-bg-muted text-text-body",
  brand: "bg-brand-tint text-brand-ink",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
  danger: "bg-danger-tint text-danger",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold ${badgeTones[tone]}`}>
      {children}
    </span>
  );
}

export function Notice({
  tone,
  title,
  children,
  icon,
  role,
}: {
  tone: "danger" | "warning" | "success" | "info";
  title?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  role?: "alert" | "status";
}) {
  const tones = {
    danger: "border-danger/25 bg-danger-tint text-danger",
    warning: "border-warning/25 bg-warning-tint text-warning",
    success: "border-success/25 bg-success-tint text-success",
    info: "border-border-subtle bg-bg-muted text-text-body",
  };
  return (
    <div role={role} className={`flex items-start gap-3 rounded-[12px] border px-3.5 py-3 text-[14px] leading-relaxed ${tones[tone]}`}>
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  children,
  className = "",
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-text-heading">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={id} className="text-[14px] font-semibold text-text-heading">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="mt-0.5 text-[13px] leading-relaxed text-text-muted">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
          checked ? "bg-success" : "bg-border-active"
        } ${focusRing}`}
      >
        <span
          aria-hidden
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[22px]" : "translate-x-0.5"}`}
        />
      </button>
    </div>
  );
}

export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return <Loader2 size={size} aria-hidden className={`animate-spin ${className}`} />;
}

export function LoadingBlock({ label = "Memuat…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-[14px] text-text-muted">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Notice tone="danger" role="alert" icon={<AlertTriangle size={18} aria-hidden />} title="Gagal memuat data">
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`mt-2 font-semibold underline underline-offset-2 ${focusRing}`}>
          Coba lagi
        </button>
      )}
    </Notice>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      className={iconBtn}
      aria-label={done ? "Tersalin" : label}
      title={done ? "Tersalin" : label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
        } catch {
          // Clipboard ditolak (mis. bukan HTTPS) — biarkan pengguna menyalin manual.
        }
      }}
    >
      {done ? <Check size={16} aria-hidden className="text-success" /> : <Copy size={16} aria-hidden />}
    </button>
  );
}

/** Nomor halaman yang ditampilkan: ujung (3 pertama/terakhir bila dekat ujung) + halaman aktif ±1; celah ≥ 2 jadi elipsis. */
export function pageItems(page: number, pages: number): (number | "gap")[] {
  const set = new Set([1, pages, page - 1, page, page + 1]);
  if (page <= 3 || page >= pages - 2) [1, 2, 3, pages - 2, pages - 1, pages].forEach((n) => set.add(n));
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    const prev = nums[i - 1];
    if (prev !== undefined && n - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && n - prev > 2) out.push("gap");
    out.push(n);
  });
  return out;
}

const pageBtn = `inline-flex h-9 min-w-9 items-center justify-center rounded-[8px] px-2 text-[13.5px] font-semibold tabular-nums transition-colors disabled:cursor-default disabled:opacity-35 ${focusRing}`;

/** Paginasi bernomor `‹ 1 2 3 … 8 9 10 ›`; di HP ringkas `‹ 3 / 10 ›`. */
export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(total, page * perPage);
  const prev = (
    <button type="button" className={`${pageBtn} text-text-body hover:bg-bg-muted`} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya">
      <ChevronLeft size={18} aria-hidden />
    </button>
  );
  const next = (
    <button type="button" className={`${pageBtn} text-text-body hover:bg-bg-muted`} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya">
      <ChevronRight size={18} aria-hidden />
    </button>
  );
  return (
    <nav aria-label="Halaman" className="flex items-center justify-between gap-3 text-[13px] text-text-body">
      <p className="tabular-nums">
        {from}–{to} dari {total.toLocaleString("id-ID")}
      </p>
      {/* HP */}
      <div className="flex items-center gap-1 sm:hidden">
        {prev}
        <span className="min-w-14 text-center font-semibold tabular-nums text-text-heading">
          {page} <span className="font-normal text-text-muted">/ {pages}</span>
        </span>
        {next}
      </div>
      {/* Layar lebar */}
      <div className="hidden items-center gap-0.5 sm:flex">
        {prev}
        {pageItems(page, pages).map((n, i) =>
          n === "gap" ? (
            <span key={`gap-${i}`} aria-hidden className="inline-flex h-9 min-w-7 items-center justify-center text-text-muted">
              …
            </span>
          ) : (
            <button
              key={n}
              type="button"
              aria-label={`Halaman ${n}`}
              aria-current={n === page ? "page" : undefined}
              onClick={() => n !== page && onPage(n)}
              className={`${pageBtn} ${
                n === page ? "bg-brand-tint text-brand-ink shadow-[inset_0_0_0_1px_var(--color-brand-primary)]" : "text-text-body hover:bg-bg-muted hover:text-text-heading"
              }`}
            >
              {n}
            </button>
          )
        )}
        {next}
      </div>
    </nav>
  );
}

// ——— Format ———

const TZ = "Asia/Jakarta";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: TZ }).format(d);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: TZ }).format(d);
}

export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "belum pernah";
  const t = Date.parse(value);
  if (Number.isNaN(t)) return "—";
  const s = Math.round((now - t) / 1000);
  if (s < 60) return "baru saja";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} menit lalu`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} hari lalu`;
  return formatDate(value);
}

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} KB`;
  return `${(n / 1024 / 1024).toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

export function shortHash(h: string): string {
  return h.length > 16 ? `${h.slice(0, 8)}…${h.slice(-8)}` : h;
}

/** Pesan galat ramah untuk ditampilkan. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "NETWORK_ERROR") return "Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.";
    if (err.code === "TIMEOUT") return "Server tidak merespons. Coba lagi sebentar lagi.";
    if (err.code === "CSRF_REJECTED") return "Permintaan ditolak server (origin tidak diizinkan). Hubungi pengelola server.";
    if (err.code === "RATE_LIMITED") {
      return err.retryAfter
        ? `Terlalu banyak permintaan. Coba lagi dalam ${formatWait(err.retryAfter)}.`
        : "Terlalu banyak permintaan. Coba lagi sebentar lagi.";
    }
    return err.message;
  }
  return "Terjadi kesalahan. Coba lagi sebentar lagi.";
}

export function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} detik`;
  return `${Math.ceil(seconds / 60)} menit`;
}

/** Galat per kolom dari 422 VALIDATION_ERROR → peta field → pesan. */
export function fieldErrors(err: unknown): Record<string, string> {
  if (!(err instanceof ApiError)) return {};
  const out: Record<string, string> = {};
  for (const d of err.details) if (d.field && !out[d.field]) out[d.field] = d.message;
  return out;
}

// ——— Pemuatan data ———

export type LoadState<T> =
  | { status: "loading"; data?: T }
  | { status: "ready"; data: T }
  | { status: "error"; error: unknown; data?: T };

type Loaded<T> = { key: string; data?: T; error?: unknown; failed: boolean };

/**
 * Memuat data dengan AbortSignal saat `deps` berubah; `reload()` memuat ulang dengan data lama tetap tampil.
 * `deps` harus nilai sederhana (string/angka) — dipakai sebagai kunci permintaan.
 */
export function useLoad<T>(load: (signal: AbortSignal) => Promise<T>, deps: (string | number | undefined)[]) {
  const [tick, setTick] = useState(0);
  const key = JSON.stringify([...deps, tick]);
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const loadRef = useRef(load);
  const keyRef = useRef(key);
  useEffect(() => {
    loadRef.current = load;
    keyRef.current = key;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    loadRef
      .current(ctrl.signal)
      .then((data) => {
        if (!ctrl.signal.aborted) setLoaded({ key, data, failed: false });
      })
      .catch((error) => {
        if (ctrl.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) return; // AdminShell mengarahkan ke login.
        setLoaded((prev) => ({ key, data: prev?.data, error, failed: true }));
      });
    return () => ctrl.abort();
  }, [key]);

  let state: LoadState<T>;
  if (!loaded || loaded.key !== key) state = { status: "loading", data: loaded?.data };
  else if (loaded.failed) state = { status: "error", error: loaded.error, data: loaded.data };
  else state = { status: "ready", data: loaded.data as T };

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data: T) => setLoaded({ key: keyRef.current, data, failed: false }), []);
  return { state, reload, setData };
}

// ——— Tahap 2: komponen bersama ———

/** Kotak abu-abu berdenyut sebagai pengganti konten saat memuat. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse rounded-[6px] bg-border-subtle/70 motion-reduce:animate-none ${className}`} />;
}

/** Kerangka daftar/tabel: `rows` baris dengan lebar kolom bervariasi (tanpa lompatan layout). */
export function SkeletonList({ rows = 8, label = "Memuat…" }: { rows?: number; label?: string }) {
  const widths = ["w-2/5", "w-1/3", "w-1/2", "w-1/4"];
  return (
    <div role="status" aria-label={label} className={`${cardClass} divide-y divide-border-subtle`}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex h-[52px] items-center gap-4 px-4 sm:px-5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className={`h-3.5 ${widths[i % widths.length]}`} />
            <Skeleton className="h-3 w-1/5" />
          </div>
          <Skeleton className="hidden h-3.5 w-16 sm:block" />
          <Skeleton className="hidden h-3.5 w-20 md:block" />
        </div>
      ))}
    </div>
  );
}

/** Garis tipis berjalan di atas tabel saat memuat ulang (data lama tetap tampil redup). */
export function LoadingBar({ active }: { active: boolean }) {
  return (
    <div aria-hidden className="relative h-0.5 overflow-hidden rounded-full">
      {active && <div className="absolute inset-y-0 w-1/3 animate-[admin-bar_1s_ease-in-out_infinite] bg-brand-primary motion-reduce:animate-none" />}
      <style>{"@keyframes admin-bar{0%{left:-33%}100%{left:100%}}"}</style>
    </div>
  );
}

/** Keadaan kosong yang ramah: ikon, kalimat manusiawi, dan aksi. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">{icon}</span>
      <p className="text-[15px] font-semibold text-text-heading">{title}</p>
      {children && <p className="mt-1 max-w-[380px] text-[14px] leading-relaxed text-text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Waktu relatif dengan waktu absolut di `title`. */
export function TimeAgo({ value, empty = "belum pernah", className = "" }: { value: string | null | undefined; empty?: string; className?: string }) {
  if (!value) return <span className={`text-text-muted ${className}`}>{empty}</span>;
  return (
    <time dateTime={value} title={formatDateTime(value)} className={className}>
      {formatRelative(value)}
    </time>
  );
}

/** Angka besar untuk kartu ringkasan. */
export function StatCard({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  icon,
}: {
  label: string;
  value: number | string;
  hint?: React.ReactNode;
  tone?: "neutral" | "warning" | "danger" | "success";
  href?: string;
  icon?: React.ReactNode;
}) {
  const valueTone = { neutral: "text-text-heading", warning: "text-warning", danger: "text-danger", success: "text-success" }[tone];
  const body = (
    <>
      <p className="flex items-start gap-1.5 text-[12px] leading-snug text-text-muted sm:text-[13px]">
        {icon && <span className="mt-[2px] shrink-0">{icon}</span>}
        <span className="min-w-0">{label}</span>
      </p>
      <p className={`mt-1 text-[22px] font-bold leading-none tracking-tight tabular-nums sm:text-[26px] ${valueTone}`}>
        {typeof value === "number" ? value.toLocaleString("id-ID") : value}
      </p>
      {hint && <p className="mt-1.5 text-[12px] leading-snug text-text-muted">{hint}</p>}
    </>
  );
  const cls = "min-w-0 rounded-[14px] border border-border-subtle bg-white px-3 py-3 sm:px-4 sm:py-3.5";
  if (!href) return <div className={cls}>{body}</div>;
  return (
    <Link href={href} className={`${cls} block transition-colors hover:border-border-active ${focusRing}`}>
      {body}
    </Link>
  );
}

/** Tab dengan tautan (tab aktif tersimpan di URL oleh pemanggil). */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  label,
}: {
  tabs: { id: T; label: string; count?: number }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div role="tablist" aria-label={label} className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-border-subtle px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={`-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 py-2.5 text-[14px] sm:px-3 font-semibold transition-colors ${
              on ? "border-brand-deep text-brand-ink" : "border-transparent text-text-body hover:text-text-heading"
            } ${focusRing}`}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`rounded-full px-1.5 text-[12px] tabular-nums ${on ? "bg-brand-tint" : "bg-bg-muted text-text-muted"}`}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export const thClass =
  "sticky top-0 z-[1] whitespace-nowrap bg-white px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-text-muted first:pl-5 last:pr-5 shadow-[inset_0_-1px_0_var(--color-border-subtle)]";
export const tdClass = "px-3 py-2 align-middle first:pl-5 last:pr-5";

/** Header tabel yang bisa diklik untuk mengurutkan. */
export function SortTh({
  label,
  field,
  sort,
  order,
  onSort,
  align = "left",
  className = "",
}: {
  label: string;
  field: string;
  sort: string;
  order: "asc" | "desc";
  onSort: (field: string) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort === field;
  return (
    <th scope="col" aria-sort={active ? (order === "asc" ? "ascending" : "descending") : undefined} className={`${thClass} ${align === "right" ? "text-right" : ""} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wide hover:text-text-heading ${active ? "text-text-heading" : ""} ${align === "right" ? "flex-row-reverse" : ""} ${focusRing}`}
      >
        {label}
        <span aria-hidden className={`text-[10px] ${active ? "" : "opacity-0"}`}>
          {active && order === "asc" ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );
}

export function plural(n: number, word: string): string {
  return `${n.toLocaleString("id-ID")} ${word}`;
}

// ——— Tahap 3: uang ———

/** `Rp59.000` (tanpa spasi, rupiah bulat). */
export function formatRupiah(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `${n < 0 ? "-" : ""}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
}

/** Ringkas untuk sumbu/kartu: `Rp590 rb`, `Rp2,1 jt`. */
export function formatRupiahShort(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `Rp${(n / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (a >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (a >= 1_000) return `Rp${Math.round(n / 1_000).toLocaleString("id-ID")} rb`;
  return formatRupiah(n);
}
