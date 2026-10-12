"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { focusRing } from "./ui";

// Lembar bawah (HP) / dialog tengah (layar lebar) di atas <dialog> modal:
// fokus terkunci di dalam, Esc menutup, latar diklik menutup, gulir halaman dikunci.
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
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
      className="mx-auto mt-auto mb-0 w-full max-w-[560px] max-h-[92dvh] overflow-hidden rounded-t-[20px] bg-white p-0 text-text-heading shadow-xl backdrop:bg-black/55 sm:mb-auto sm:rounded-[20px]"
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-start gap-3 border-b border-border-subtle px-5 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-[20px] font-semibold leading-snug">
                {title}
              </h2>
              {subtitle && <p className="mt-0.5 text-[15px] text-text-body">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup"
              className={`-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-text-body hover:bg-bg-muted ${focusRing}`}
            >
              <X size={22} aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
          {footer && (
            <div className="border-t border-border-subtle bg-white px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
