"use client";

import React from "react";
import { StaffApiError } from "@/lib/staff/api";
import type { StaffSession } from "@/lib/staff/types";

// Bagian bersama web pelayan (menu Meja). Teks mengikuti Pelayan di aplikasi (app_id.arb `waiter*`, `tables*`).

const OUTLET_KEY = "sissi-staff:outlet";

/** Outlet aktif: tersimpan (sama dengan halaman Absen) bila masih boleh, selainnya outlet pertama. */
export function pickOutlet(session: StaffSession, wanted?: string | null): string | null {
  const ids = session.outlets.map((o) => o.id);
  if (wanted && ids.includes(wanted)) return wanted;
  try {
    const saved = localStorage.getItem(OUTLET_KEY);
    if (saved && ids.includes(saved)) return saved;
  } catch {
    // abaikan
  }
  return ids[0] ?? null;
}

export function rememberOutlet(id: string) {
  try {
    localStorage.setItem(OUTLET_KEY, id);
  } catch {
    // abaikan
  }
}

/** Peran & akses yang boleh membuka menu Meja di web. */
export function waiterEnabled(session: StaffSession): boolean {
  return session.user.role === "waiter";
}

/** Penjelasan galat yang khas web pelayan; selain itu pesan server. */
export function waiterErrorText(err: unknown): string {
  if (err instanceof StaffApiError) {
    switch (err.code) {
      case "WAITER_STAFF_SPACE":
        return "Akunmu hanya untuk absen. Minta pemilik mengubah akses ke Sesuai tugas di aplikasi.";
      case "PRO_REQUIRED":
        return "Catat pesanan lewat website butuh Sissi Pro. Hubungi pemilik usaha.";
      case "NETWORK_ERROR":
      case "TIMEOUT":
        return "Tidak ada internet — pesanan belum terkirim. Periksa koneksi lalu coba lagi.";
    }
    return err.message;
  }
  return "Terjadi kesalahan. Coba lagi sebentar lagi.";
}

/** Muat ulang berkala selama tab terlihat, dan segera saat tab kembali terlihat. */
export function useRefresh(fn: () => void, everyMs: number, active = true) {
  const ref = React.useRef(fn);
  React.useEffect(() => {
    ref.current = fn;
  });
  React.useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const id = window.setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [everyMs, active]);
}
