"use client";

import React, { useRef, useState } from "react";
import { Camera, ImageUp, Trash2 } from "lucide-react";
import { btn, errorMessage, focusRing, Spinner } from "@/components/admin/ui";
import { PHOTO_ACCEPT, uploadProductPhoto } from "@/lib/owner/upload";

// Foto produk/varian — perilaku sama dengan `product_photo_field.dart`: pilih/ganti/hapus, diperkecil & dikompres
// sebelum diunggah, URL baru tersimpan ke produk saat form disimpan. Teks = teks aplikasi.

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? "?").slice(0, 2)).toUpperCase();
}

export function PhotoField({
  name,
  url,
  onChange,
  onUploading,
  label = "Foto produk",
  emptyHint = "Tambah foto agar tampil di kasir dan daftar produk.",
  compact = false,
}: {
  name: string;
  url: string | null;
  onChange: (url: string | null) => void;
  onUploading?: (busy: boolean) => void;
  label?: string;
  emptyHint?: string;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = !!url;
  const side = compact ? "h-14 w-14" : "h-24 w-24";

  async function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    onUploading?.(true);
    try {
      onChange(await uploadProductPhoto(file));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      onUploading?.(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3.5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={has ? `Ganti ${label.toLowerCase()}` : `Tambah ${label.toLowerCase()}`}
        className={`relative ${side} shrink-0 overflow-hidden rounded-[14px] border border-border-active bg-bg-muted ${focusRing}`}
      >
        {has ? (
          // eslint-disable-next-line @next/next/no-img-element -- foto dari API (domain bebas), tanpa optimasi.
          <img src={url} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={`flex h-full w-full items-center justify-center font-bold text-text-muted ${compact ? "text-[15px]" : "text-[24px]"}`}>{initials(name)}</span>
        )}
        {busy ? (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70">
            <Spinner size={22} />
          </span>
        ) : (
          <span className={`absolute right-1.5 bottom-1.5 flex items-center justify-center rounded-full bg-brand-deep text-white ${compact ? "h-5 w-5" : "h-7 w-7"}`}>
            <Camera size={compact ? 11 : 14} aria-hidden />
          </span>
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-text-heading">{label}</p>
        <p className="mt-0.5 text-[12.5px] text-text-muted">
          {busy ? "Mengunggah foto…" : has ? "Pilih Ganti foto atau Hapus foto. Tersimpan saat produk disimpan." : emptyHint}
        </p>
        {error && (
          <p role="alert" className="mt-1 text-[12.5px] text-danger">
            {error}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <button type="button" className={`${btn.ghost} -ml-2 min-h-8 px-2 text-[13px]`} onClick={() => input.current?.click()} disabled={busy}>
            <ImageUp size={15} aria-hidden /> {has ? "Ganti foto" : "Pilih foto"}
          </button>
          {has && (
            <button type="button" className={`${btn.ghost} min-h-8 px-2 text-[13px] text-danger hover:text-danger`} onClick={() => onChange(null)} disabled={busy}>
              <Trash2 size={15} aria-hidden /> Hapus foto
            </button>
          )}
        </div>
      </div>
      <input ref={input} type="file" accept={PHOTO_ACCEPT} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}
