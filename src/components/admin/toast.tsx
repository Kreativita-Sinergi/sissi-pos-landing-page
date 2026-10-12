"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CircleCheck, TriangleAlert, X } from "lucide-react";
import { focusRing } from "./ui";

// Toast admin: pojok bawah, 4 detik (galat 7 detik), bisa ditutup, aria-live="polite".
// Provider dipasang di app/admin/layout.tsx agar toast bertahan saat berpindah halaman (mis. setelah ganti password).

type Toast = { id: number; tone: "success" | "error"; text: string };
type ToastApi = { success: (text: string) => void; error: (text: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const t = useContext(ToastContext);
  if (!t) throw new Error("useToast di luar ToastProvider");
  return t;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback(
    (tone: Toast["tone"], text: string) => {
      const id = ++seq.current;
      setToasts((list) => [...list.slice(-2), { id, tone, text }]);
      setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4000);
    },
    [dismiss]
  );

  const api = useMemo<ToastApi>(() => ({ success: (t) => push("success", t), error: (t) => push("error", t) }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="animate-so-rise motion-reduce:animate-none pointer-events-auto flex w-full max-w-[400px] items-start gap-3 rounded-[12px] bg-brand-dark py-3 pr-2 pl-4 text-[14px] text-white shadow-lg"
          >
            {t.tone === "success" ? (
              <CircleCheck size={18} aria-hidden className="mt-px shrink-0 text-[#7fd6ad]" />
            ) : (
              <TriangleAlert size={18} aria-hidden className="mt-px shrink-0 text-[#ffb4a8]" />
            )}
            <p className="min-w-0 flex-1 leading-snug">{t.text}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Tutup pemberitahuan"
              className={`-my-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-white/70 hover:bg-white/10 hover:text-white ${focusRing}`}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
