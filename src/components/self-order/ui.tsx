"use client";

import React, { useEffect, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";

// Gaya bersama halaman pesan: target sentuh ≥ 44px, fokus jelas, warna dari token tema (globals.css).
// Sudut: kartu 20px, kontrol 14px, chip/pil penuh. Tombol utama oranye gelap (teks putih lulus AA).
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary";

export const primaryButton = `inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-brand-deep px-5 text-[17px] font-bold text-white shadow-[0_4px_14px_rgb(160_74_29/0.25)] transition-colors hover:bg-brand-deeper active:bg-brand-deeper disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${focusRing}`;

export const secondaryButton = `inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-so-line bg-white px-5 text-[16px] font-semibold text-text-heading transition-colors hover:border-border-active disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const dangerButton = `inline-flex min-h-[54px] w-full items-center justify-center gap-2 rounded-[14px] bg-danger px-5 text-[17px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`;

export const inputClass = `w-full rounded-[14px] border border-so-line bg-white px-4 text-[16px] text-text-heading placeholder:text-text-muted focus:border-brand-primary focus:outline-none ${focusRing}`;

export const cardClass = "rounded-[20px] bg-white shadow-so-card";

/** Bingkai halaman: penuh di HP; di layar lebar kolom ≤ 520px di tengah dengan latar lembut di luar. */
export function Frame({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh bg-so-outer">
      <div
        className={`relative mx-auto min-h-dvh w-full max-w-[520px] bg-so-canvas sm:shadow-[0_0_0_1px_var(--color-so-line),0_20px_60px_rgb(41_46_49/0.08)] ${className}`}
      >
        {children}
      </div>
    </div>
  );
}

/** Inisial dari nama, sama dengan aplikasi kasir: "Teh Leci Dingin" → "TL", "Latte" → "LA". */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const TONES = [
  "bg-brand-tint text-brand-ink",
  "bg-so-mint text-so-mint-ink",
  "bg-so-sand text-so-sand-ink",
  "bg-so-rose text-so-rose-ink",
];

function toneOf(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TONES[h % TONES.length];
}

/** Foto produk, atau kotak inisial berwarna lembut bila belum ada foto (seperti aplikasi kasir Sissi). */
export function Thumb({
  name,
  src,
  className = "",
  textClass = "text-[22px]",
  dim = false,
}: {
  name: string;
  src: string | null | undefined;
  className?: string;
  textClass?: string;
  dim?: boolean;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  const url = src?.trim() || null;
  if (url && broken !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- gambar dari API (domain bebas), tanpa optimasi.
      <img
        src={url}
        alt=""
        loading="lazy"
        onError={() => setBroken(url)}
        className={`bg-so-canvas object-cover ${dim ? "opacity-45 grayscale" : ""} ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={`flex select-none items-center justify-center font-extrabold tracking-tight ${
        dim ? "bg-bg-muted text-text-muted" : toneOf(name)
      } ${textClass} ${className}`}
    >
      {initialsOf(name)}
    </span>
  );
}

/** Keadaan kosong/galat: ikon besar dalam lingkaran + judul + teks + aksi. */
export function EmptyState({
  icon,
  title,
  body,
  tone = "brand",
  children,
  headingLevel = 2,
}: {
  icon: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  tone?: "brand" | "danger" | "muted";
  children?: React.ReactNode;
  headingLevel?: 1 | 2;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const ring = {
    brand: "bg-brand-tint text-brand-deep ring-brand-tint/50",
    danger: "bg-danger-tint text-danger ring-danger-tint/50",
    muted: "bg-white text-text-body ring-white/60 shadow-so-card",
  }[tone];
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className={`mb-2 flex h-20 w-20 items-center justify-center rounded-full ring-[10px] ${ring}`}>{icon}</span>
      <Heading className="text-[22px] font-bold leading-tight tracking-tight text-text-heading">{title}</Heading>
      {body && <p className="max-w-[340px] text-[16px] leading-relaxed text-text-body">{body}</p>}
      {children && <div className="mt-3 flex w-full flex-col gap-2.5">{children}</div>}
    </div>
  );
}

export function Notice({
  tone,
  children,
  role,
  icon,
}: {
  tone: "danger" | "warning" | "success" | "info";
  children: React.ReactNode;
  role?: "alert" | "status";
  icon?: React.ReactNode;
}) {
  const tones = {
    danger: "border-danger/20 bg-danger-tint text-danger",
    warning: "border-warning/20 bg-warning-tint text-warning",
    success: "border-success/20 bg-success-tint text-success",
    info: "border-so-line bg-white text-text-body",
  };
  return (
    <div
      role={role}
      className={`flex items-start gap-3 rounded-[16px] border px-4 py-3.5 text-[15px] leading-relaxed ${tones[tone]}`}
    >
      {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
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
  const lg = size === "lg";
  const btn = `${lg ? "h-12 w-12" : "h-11 w-11"} inline-flex items-center justify-center rounded-full text-text-heading transition-colors hover:bg-so-canvas disabled:opacity-35 ${focusRing}`;
  const showTrash = removable && value <= 1;
  return (
    <div
      className="inline-flex shrink-0 items-center rounded-full border border-so-line bg-white"
      role="group"
      aria-label={`Jumlah ${label}`}
    >
      <button
        type="button"
        className={`${btn} ${showTrash ? "text-danger" : ""}`}
        onClick={() => onChange(value - 1)}
        disabled={!removable && value <= min}
        aria-label={showTrash ? `Hapus ${label}` : `Kurangi ${label}`}
      >
        {showTrash ? <Trash2 size={lg ? 20 : 18} aria-hidden /> : <Minus size={lg ? 20 : 18} aria-hidden />}
      </button>
      <span
        className={`${lg ? "min-w-8 text-[19px]" : "min-w-6 text-[16px]"} text-center font-bold tabular-nums text-text-heading`}
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
        <Plus size={lg ? 20 : 18} aria-hidden />
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
