import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";

export const metadata: Metadata = {
  title: "Masuk — segera hadir | Sissi",
  description:
    "Dasbor web Sissi sedang dikembangkan. Untuk sekarang, masuk dan kelola usaha lewat aplikasi Sissi di HP atau tablet Android.",
  robots: { index: false },
};

// Login web belum ada (keputusan pemilik 2026-10-12: tombol "Masuk" tetap ada,
// halaman ini menjelaskan bahwa dasbor web sedang dikembangkan).
export default function MasukPage() {
  return (
    <div className="flex min-h-screen flex-col w-full bg-white">
      <Navbar isLight />

      <main className="flex-1 flex flex-col justify-center items-center py-28 sm:py-36 px-6 text-center">
        <Container>
          <div className="max-w-xl mx-auto flex flex-col items-center">
            <span className="text-[13px] font-mono font-medium tracking-wider uppercase text-[#be5823] mb-4">
              Sedang dikembangkan
            </span>
            <h1 className="text-3xl sm:text-[40px] font-semibold text-[#292e31] tracking-tight leading-tight mb-3">
              Dasbor web segera hadir
            </h1>
            <p className="text-base sm:text-[18px] text-[#525866] max-w-md leading-relaxed mb-8">
              Untuk sekarang, masuk dan kelola usahamu lewat aplikasi Sissi di
              HP atau tablet Android. Laporan, produk, stok, dan karyawan semuanya
              ada di sana.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <Link
                href="/download"
                className="h-[51px] px-6 bg-[#292e31] hover:bg-[#3d4347] text-white text-[15px] font-medium rounded-[8px] flex items-center justify-center transition-colors w-full sm:w-auto"
              >
                Unduh aplikasi
              </Link>
              <Link
                href="/panduan"
                className="h-[51px] px-6 border border-[#d7dcdb] hover:bg-[#f5f6f6] text-[#292e31] text-[15px] font-medium rounded-[8px] flex items-center justify-center transition-colors w-full sm:w-auto"
              >
                Lihat panduan
              </Link>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
