"use client";

import React, { useState } from "react";
import { MapPinOff, RotateCw } from "lucide-react";
import { focusRing, Spinner } from "@/components/admin/ui";
import { geoPermission, geoPlatform, locate, type GeoPlatform } from "@/lib/staff/geo";

// Panduan saat izin lokasi browser diblokir. Situs tidak bisa membuka pengaturan atau meminta izin lagi setelah
// ditolak, jadi karyawan diberi langkah sesuai perangkatnya lalu "Coba lagi" memeriksa ulang izin.

const STEPS: Record<GeoPlatform, { title: string; steps: React.ReactNode[]; extra?: React.ReactNode }> = {
  ios: {
    title: "Di iPhone (Safari)",
    steps: [
      <>Ketuk <b>aA</b> di bilah alamat.</>,
      <>Pilih <b>Pengaturan Situs Web</b> › <b>Lokasi</b> › <b>Izinkan</b>.</>,
      <>Kembali ke sini lalu ketuk <b>Coba lagi</b>.</>,
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
      <>Kembali ke sini lalu ketuk <b>Coba lagi</b>.</>,
    ],
    extra: <>Pastikan juga <b>Lokasi</b> HP menyala (tarik panel atas layar).</>,
  },
  desktop: {
    title: "Di komputer",
    steps: [
      <>Klik ikon gembok/setelan di kiri alamat situs.</>,
      <>Ubah <b>Lokasi</b> menjadi <b>Izinkan</b>, lalu muat ulang halaman bila diminta.</>,
      <>Klik <b>Coba lagi</b>.</>,
    ],
  },
};

export function LocationHelp({ required, onGranted }: { required: boolean; onGranted: () => void }) {
  const [platform] = useState<GeoPlatform>(() => geoPlatform());
  const [checking, setChecking] = useState(false);
  const [still, setStill] = useState<string | null>(null);
  const s = STEPS[platform];

  async function retry() {
    setChecking(true);
    setStill(null);
    const p = await geoPermission();
    if (p === "granted") {
      setChecking(false);
      return onGranted();
    }
    if (p === "denied") {
      setChecking(false);
      return setStill("Izin lokasi masih diblokir. Periksa lagi langkah di atas.");
    }
    // Browser tanpa Permissions API / status "minta": coba ambil lokasi (memunculkan dialog izin bila masih bisa).
    const r = await locate();
    setChecking(false);
    if (!r.failure) onGranted();
    else if (r.failure === "denied") setStill("Izin lokasi masih diblokir. Periksa lagi langkah di atas.");
    else setStill("Lokasi belum ditemukan. Pastikan lokasi HP menyala, lalu coba lagi.");
  }

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
      {still && (
        <p className="mt-2 text-[13.5px] font-medium text-danger">
          {still}
        </p>
      )}
      <button
        type="button"
        onClick={retry}
        disabled={checking}
        className={`mt-3 inline-flex min-h-11 items-center gap-2 rounded-[12px] border border-border-subtle bg-white px-4 text-[14.5px] font-semibold text-text-heading hover:border-border-active disabled:opacity-60 ${focusRing}`}
      >
        {checking ? <Spinner size={16} /> : <RotateCw size={16} aria-hidden />} Coba lagi
      </button>
    </section>
  );
}
