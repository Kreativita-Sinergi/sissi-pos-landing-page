"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { focusRing } from "./ui";

// Lembar bawah (HP) / dialog tengah (layar lebar) di atas <dialog> modal:
// fokus terkunci di dalam, Esc menutup, latar diklik menutup, gulir halaman dikunci.
// `media` = gambar besar di atas (ikut bergulir, tombol tutup mengambang); `leading` = elemen kecil di kiri judul.
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  media,
  leading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  media?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
    }
    if (!open) document.documentElement.style.overflow = "";
  }, [open]);

  useEffect(
    () => () => {
      document.documentElement.style.overflow = "";
    },
    []
  );

  const closeButton = (floating: boolean) => (
    <button
      type="button"
      onClick={onClose}
      aria-label="Tutup"
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
        floating
          ? "absolute top-3 right-3 z-10 bg-white/95 text-text-heading shadow-so-card"
          : "-mt-1 -mr-2 text-text-body hover:bg-so-canvas"
      } ${focusRing}`}
    >
      <X size={22} aria-hidden />
    </button>
  );

  const heading = (
    <div className="flex items-start gap-3">
      {leading}
      <div className="min-w-0 flex-1">
        <h2 id={titleId} className="text-[21px] font-bold leading-snug tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-[15px] leading-relaxed text-text-body">{subtitle}</p>}
      </div>
      {!media && closeButton(false)}
    </div>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="mx-auto mt-auto mb-0 w-full max-w-[520px] max-h-[92dvh] overflow-hidden rounded-t-[24px] bg-white p-0 text-text-heading shadow-xl backdrop:bg-[rgb(28_22_18/0.55)] sm:mb-auto sm:rounded-[24px]"
    >
      {open && (
        <div className="relative flex max-h-[92dvh] flex-col motion-safe:animate-so-sheet">
          {media ? (
            <>
              {closeButton(true)}
              <div data-sheet-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {media}
                <div className="px-5 pt-4 pb-2">{heading}</div>
                <div className="px-5 pt-2 pb-4">{children}</div>
              </div>
            </>
          ) : (
            <>
              <div aria-hidden className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-so-line sm:hidden" />
              <div className="border-b border-so-line px-5 pt-3 pb-3.5">{heading}</div>
              {/* Padding di elemen dalam (bukan di wadah gulir) agar footer `sticky bottom-0` menempel tepat di dasar. */}
              <div data-sheet-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="px-5 py-4">{children}</div>
              </div>
            </>
          )}
          {footer && (
            <div className="border-t border-so-line bg-white px-5 pt-3 pb-[max(14px,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
