"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { btn, Spinner } from "@/components/admin/ui";

// Tombol Google Identity Services bersama: halaman /masuk dan dialog konfirmasi ulang (aksi sensitif dasbor).
// GIS hanya boleh di-`initialize` sekali per halaman, jadi callback kredensial diarahkan ke tombol yang terakhir
// dipasang (`activeCallback`) — bukan ke tombol pertama yang mungkin sudah dilepas.

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type GsiCredential = { credential?: string };
type GsiApi = {
  accounts: {
    id: {
      initialize(opts: {
        client_id: string;
        callback: (r: GsiCredential) => void;
        ux_mode?: "popup" | "redirect";
        auto_select?: boolean;
        cancel_on_tap_outside?: boolean;
        context?: "signin" | "signup" | "use";
      }): void;
      renderButton(el: HTMLElement, opts: Record<string, string | number>): void;
      disableAutoSelect(): void;
    };
  };
};

declare global {
  interface Window {
    google?: GsiApi;
  }
}

let activeCallback: ((idToken: string) => void) | null = null;
let gsiInitialized = false;

/** Tombol resmi Google Identity Services; di mode tiruan tanpa client ID → tombol tiruan. */
export function GoogleButton({
  disabled,
  busy,
  onCredential,
  onError,
  text = "signin_with",
  mockLabel = "Masuk dengan Google (tiruan)",
}: {
  disabled: boolean;
  busy: boolean;
  onCredential: (idToken: string) => void;
  onError: (text: string) => void;
  /** Teks tombol resmi GIS. */
  text?: "signin_with" | "continue_with";
  /** Label tombol tiruan (tanpa client ID). */
  mockLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onCredential);
  useEffect(() => {
    cbRef.current = onCredential;
  });
  // Tombol yang sedang terpasang menerima kredensial (lihat komentar di atas).
  useEffect(() => {
    const cb = (t: string) => cbRef.current(t);
    activeCallback = cb;
    return () => {
      if (activeCallback === cb) activeCallback = null;
    };
  }, []);
  const [failed, setFailed] = useState(false);

  const render = useCallback(() => {
    const g = window.google;
    const el = ref.current;
    if (!g || !el) return;
    if (!gsiInitialized) {
      g.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (r) => {
          if (r.credential) activeCallback?.(r.credential);
        },
        ux_mode: "popup",
        auto_select: false,
        cancel_on_tap_outside: true,
        context: "signin",
      });
      gsiInitialized = true;
    }
    el.innerHTML = "";
    g.accounts.id.renderButton(el, {
      type: "standard",
      theme: "outline",
      size: "large",
      text,
      shape: "rectangular",
      logo_alignment: "center",
      locale: "id",
      width: Math.max(200, Math.min(400, Math.floor(el.clientWidth || 320))),
    });
  }, [text]);

  if (!GOOGLE_CLIENT_ID) {
    // Mode tiruan: tanpa client ID, tiru alur Google dengan token palsu.
    return (
      <button type="button" className={`${btn.secondary} w-full`} disabled={disabled} onClick={() => onCredential("mock-google-id-token")}>
        {busy ? <Spinner /> : <GoogleMark />}
        {mockLabel}
      </button>
    );
  }

  return (
    <div className="relative">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={render}
        onError={() => {
          setFailed(true);
          onError("Tombol Google gagal dimuat. Periksa koneksi atau gunakan email & kata sandi.");
        }}
      />
      {/* Kotak tetap setinggi tombol Google agar tata letak tidak melompat saat skrip dimuat. */}
      <div ref={ref} className={`flex min-h-[44px] w-full justify-center ${disabled ? "pointer-events-none opacity-50" : ""}`} aria-busy={busy} />
      {busy && (
        <p role="status" className="mt-1.5 flex items-center justify-center gap-2 text-[13px] text-text-muted">
          <Spinner size={14} /> Memeriksa akun Google…
        </p>
      )}
      {failed && <p className="sr-only">Tombol Google tidak tersedia.</p>}
    </div>
  );
}

export function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
