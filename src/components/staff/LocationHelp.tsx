"use client";

import React, { useState } from "react";
import { MapPinOff, RotateCw } from "lucide-react";
import { focusRing } from "@/components/admin/ui";
import { geoPlatform, type GeoPlatform } from "@/lib/staff/geo";

// Panduan saat izin lokasi browser diblokir. Situs tidak bisa membuka pengaturan atau meminta izin lagi setelah
// ditolak, jadi karyawan diberi langkah sesuai perangkatnya lalu memuat ulang halaman.

const STEPS: Record<GeoPlatform, { title: string; steps: React.ReactNode[]; extra?: React.ReactNode }> = {
  ios: {
    title: "Di iPhone (Safari)",
    steps: [
      <>
        Ketuk ikon menu halaman di bilah alamat: <Key>aA</Key>, atau ikon <b>tiga garis</b> <Key><MenuGlyph /></Key> di
        iPhone versi terbaru.
      </>,
      <>
        Pilih <b>Pengaturan Situs Web</b> (atau <b>Pengaturan Situs</b>) › <b>Lokasi</b> › <b>Izinkan</b>.
      </>,
      <>Kembali ke sini lalu ketuk <b>Muat ulang halaman</b>.</>,
    ],
    extra: (
      <>
        Masih gagal? Buka <b>Pengaturan</b> iPhone › <b>Privasi & Keamanan</b> › <b>Layanan Lokasi</b> (nyalakan) ›{" "}
        <b>Situs Web Safari</b> › <b>Saat Menggunakan App</b>.
      </>
    ),
  },
  android: {
    title: "Di HP Android (Chrome)",
    steps: [
      <>Ketuk ikon di kiri alamat situs (gembok/setelan).</>,
      <>Pilih <b>Izin</b> › <b>Lokasi</b> › <b>Izinkan</b>.</>,
      <>Kembali ke sini lalu ketuk <b>Muat ulang halaman</b>.</>,
    ],
    extra: <>Pastikan juga <b>Lokasi</b> HP menyala (tarik panel atas layar).</>,
  },
  desktop: {
    title: "Di komputer",
    steps: [
      <>Klik ikon gembok/setelan di kiri alamat situs.</>,
      <>Ubah <b>Lokasi</b> menjadi <b>Izinkan</b>.</>,
      <>Klik <b>Muat ulang halaman</b>.</>,
    ],
  },
};

/** Ikon yang harus diketuk, ditulis langsung di kalimat (tebal, tanpa bingkai). */
function Key({ children }: { children: React.ReactNode }) {
  return <b className="inline-flex items-center align-middle text-text-heading">{children}</b>;
}

/** Ikon menu halaman Safari iPhone terbaru: tiga garis, yang bawah lebih pendek. */
function MenuGlyph() {
  return (
    <svg width="16" height="13" viewBox="0 0 14 12" role="img" aria-label="ikon tiga garis">
      <rect x="0" y="0" width="14" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="5" width="14" height="2" rx="1" fill="currentColor" />
      <rect x="0" y="10" width="8" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

export function LocationHelp({ required }: { required: boolean }) {
  const [platform] = useState<GeoPlatform>(() => geoPlatform());
  const s = STEPS[platform];

  // Izin baru baru terbaca setelah halaman dimuat ulang (Safari iPhone; "Coba lagi" di halaman yang sama tetap ditolak —
  // temuan pemilik 2026-11-13), jadi satu-satunya tombol = muat ulang.
  return (
    <section
      role="alert"
      aria-labelledby="izin-lokasi-judul"
      className={`rounded-[18px] border px-5 py-4 ${required ? "border-warning/30 bg-warning-tint" : "border-border-subtle bg-white"}`}
    >
      <p id="izin-lokasi-judul" className="flex items-center gap-2 text-[15px] font-semibold text-text-heading">
        <MapPinOff size={18} aria-hidden className={`shrink-0 ${required ? "text-warning" : "text-text-muted"}`} />
        Izin lokasi diblokir
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-text-body">
        {required
          ? "Outlet ini hanya menerima absen di lokasi. Izinkan lokasi untuk situs ini dulu:"
          : "Absen tetap bisa, tetapi tercatat tanpa lokasi. Untuk menyertakan lokasi, izinkan dulu:"}
      </p>
      <p className="mt-3 text-[13.5px] font-semibold text-text-heading">{s.title}</p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[14px] leading-relaxed text-text-body">
        {s.steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
      {s.extra && <p className="mt-2 text-[13px] leading-relaxed text-text-muted">{s.extra}</p>}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-border-subtle bg-white px-4 text-[14.5px] font-semibold text-text-heading hover:border-border-active ${focusRing}`}
      >
        <RotateCw size={16} aria-hidden /> Muat ulang halaman
      </button>
    </section>
  );
}
