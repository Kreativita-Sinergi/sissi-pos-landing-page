"use client";

import React, { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

// Gaya bersama halaman pesan: target sentuh ≥ 48px, fokus jelas, warna dari token tema.
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";

export const primaryButton = `inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-dark px-5 text-[17px] font-semibold text-white transition-colors hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const secondaryButton = `inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[14px] border border-border-subtle bg-white px-5 text-[16px] font-semibold text-text-heading transition-colors hover:border-border-active disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const dangerButton = `inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[14px] bg-danger px-5 text-[17px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const inputClass = `w-full rounded-[12px] border border-border-subtle bg-white px-4 text-[16px] text-text-heading placeholder:text-text-muted focus:border-brand-primary focus:outline-none ${focusRing}`;

export function Notice({
  tone,
  children,
  role,
}: {
  tone: "danger" | "warning" | "success" | "info";
  children: React.ReactNode;
  role?: "alert" | "status";
}) {
  const tones = {
    danger: "border-danger/25 bg-danger-tint text-danger",
    warning: "border-warning/25 bg-warning-tint text-warning",
    success: "border-success/25 bg-success-tint text-success",
    info: "border-border-subtle bg-bg-muted text-text-body",
  };
  return (
    <div role={role} className={`rounded-[12px] border px-4 py-3 text-[15px] leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Stepper({
  value,
  min = 1,
  max,
  onChange,
  label,
  removable = false,
  size = "md",
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (v: number) => void;
  label: string;
  removable?: boolean;
  size?: "md" | "lg";
}) {
  const btn = `${size === "lg" ? "h-12 w-12" : "h-11 w-11"} inline-flex items-center justify-center rounded-full border border-border-subtle bg-white text-text-heading disabled:opacity-40 ${focusRing}`;
  const showTrash = removable && value <= 1;
  return (
    <div className="inline-flex items-center gap-1" role="group" aria-label={`Jumlah ${label}`}>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value - 1)}
        disabled={!removable && value <= min}
        aria-label={showTrash ? `Hapus ${label}` : `Kurangi ${label}`}
      >
        {showTrash ? <Trash2 size={18} aria-hidden /> : <Minus size={18} aria-hidden />}
      </button>
      <span
        className={`${size === "lg" ? "min-w-10 text-[20px]" : "min-w-8 text-[17px]"} text-center font-semibold tabular-nums text-text-heading`}
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        className={btn}
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Tambah ${label}`}
      >
        <Plus size={18} aria-hidden />
      </button>
    </div>
  );
}

/** Waktu sekarang yang diperbarui berkala; 0 sampai tick pertama (agar render server = klien). */
export function useNow(intervalMs: number, active = true): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [intervalMs, active]);
  return now;
}
