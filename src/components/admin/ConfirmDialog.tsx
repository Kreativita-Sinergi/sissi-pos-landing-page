"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { btn, iconBtn, Spinner } from "./ui";

// Dialog konfirmasi buatan sendiri di atas <dialog> modal (bukan window.confirm):
// fokus terkunci, Esc/latar menutup (kecuali sedang memproses).
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Batal",
  tone = "primary",
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

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
      aria-describedby={bodyId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[460px] rounded-[16px] bg-white p-0 text-text-heading shadow-xl backdrop:bg-[rgb(28_22_18/0.5)]"
    >
      {open && (
        <div className="p-5">
          <div className="flex items-start gap-3">
            <h2 id={titleId} className="min-w-0 flex-1 text-[17px] font-bold leading-snug">
              {title}
            </h2>
            <button type="button" className={`${iconBtn} -mt-1 -mr-1`} onClick={onClose} disabled={busy} aria-label="Tutup">
              <X size={18} aria-hidden />
            </button>
          </div>
          <div id={bodyId} className="mt-2 text-[14px] leading-relaxed text-text-body">
            {children}
          </div>
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className={btn.secondary} onClick={onClose} disabled={busy} autoFocus>
              {cancelLabel}
            </button>
            <button type="button" className={tone === "danger" ? btn.danger : btn.primary} onClick={onConfirm} disabled={busy}>
              {busy && <Spinner />}
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
