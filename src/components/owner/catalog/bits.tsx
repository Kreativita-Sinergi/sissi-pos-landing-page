"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { focusRing, iconBtn, inputClass } from "@/components/admin/ui";
import { resultMessage, type ResultSummary } from "@/lib/owner/catalog";
import type { CommitOutcome } from "./useCatalog";

// Potongan UI kecil untuk halaman katalog.

/** Panel samping (desktop) / layar penuh (HP) di atas <dialog> modal. */
export function Sheet({
  open,
  title,
  subtitle,
  children,
  footer,
  onClose,
  busy = false,
  wide = false,
}: {
  open: boolean;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // `cancel` dari <input type="file"> (pemilih file dibatalkan) ikut naik ke sini — abaikan; hanya Esc dialog.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className={`m-0 ml-auto h-dvh max-h-dvh w-full ${wide ? "max-w-[880px]" : "max-w-[640px]"} bg-white p-0 text-text-heading shadow-xl backdrop:bg-[rgb(28_22_18/0.45)] sm:rounded-l-[16px]`}
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex items-start gap-3 border-b border-border-subtle px-4 py-3.5 sm:px-6">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[17px] leading-snug font-bold">
                {title}
              </h2>
              {subtitle && <div className="mt-0.5 text-[13px] text-text-muted">{subtitle}</div>}
            </div>
            <button type="button" className={`${iconBtn} -mr-1`} onClick={onClose} disabled={busy} aria-label="Tutup">
              <X size={18} aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">{children}</div>
          {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle px-4 py-3 sm:px-6">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Kotak centang bergaya. */
export function Check({
  checked,
  onChange,
  label,
  srOnlyLabel = false,
  indeterminate = false,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  srOnlyLabel?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className={`inline-flex min-h-8 cursor-pointer items-center gap-2 text-[14px] ${disabled ? "cursor-not-allowed opacity-50" : ""}`}>
      <input
        type="checkbox"
        className={`h-4 w-4 shrink-0 accent-[var(--color-brand-deep)] ${focusRing}`}
        checked={checked}
        disabled={disabled}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate;
        }}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className={srOnlyLabel ? "sr-only" : "min-w-0"}>{label}</span>
    </label>
  );
}

/** Input rupiah: hanya angka, ditampilkan berkelompok (15.000). Kosong = null. */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder,
  invalid,
  describedBy,
  className = "",
  label,
}: {
  id?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-text-muted">
        Rp
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${inputClass} pl-9 tabular-nums`}
        placeholder={placeholder}
        value={value === null ? "" : value.toLocaleString("id-ID")}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
          onChange(digits ? Math.min(Number(digits), 1_000_000_000) : null);
        }}
      />
    </div>
  );
}

export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div role="status" className="space-y-1.5">
      <p className="text-[13.5px] text-text-body tabular-nums">
        {label} {done.toLocaleString("id-ID")}/{total.toLocaleString("id-ID")} ({pct}%)
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-bg-muted">
        <div className="h-full rounded-full bg-brand-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Ringkasan hasil kiriman massal: berhasil / konflik / ditolak. */
export function ResultCounts({ summary }: { summary: ResultSummary }) {
  const cell = (n: number, label: string, tone: string) => (
    <div className="rounded-[12px] border border-border-subtle px-3 py-2.5">
      <p className="text-[12.5px] text-text-muted">{label}</p>
      <p className={`text-[22px] leading-tight font-bold tabular-nums ${n ? tone : "text-text-muted"}`}>{n.toLocaleString("id-ID")}</p>
    </div>
  );
  return (
    <div className="grid grid-cols-3 gap-2" role="status">
      {cell(summary.applied, "Berhasil", "text-success")}
      {cell(summary.conflict, "Konflik (dimuat ulang)", "text-warning")}
      {cell(summary.rejected, "Ditolak", "text-danger")}
    </div>
  );
}

/** Toast hasil kiriman kecil (1–beberapa perubahan). true = semua tersimpan. */
export function reportOutcome(toast: { success: (t: string) => void; error: (t: string) => void }, out: CommitOutcome, ok: string): boolean {
  const bad = out.results.find((r) => r.status !== "applied");
  if (!bad) {
    toast.success(ok);
    return true;
  }
  toast.error(resultMessage(bad));
  return false;
}
