"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
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
  return (
    <nav aria-label="Halaman" className="flex items-center justify-between gap-3 text-[13px] text-text-body">
      <p className="tabular-nums">
        {from}–{to} dari {total.toLocaleString("id-ID")}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" className={iconBtn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya">
          <ChevronLeft size={18} aria-hidden />
        </button>
        <span className="min-w-14 text-center tabular-nums">
          {page} / {pages}
        </span>
        <button type="button" className={iconBtn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya">
          <ChevronRight size={18} aria-hidden />
        </button>
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
