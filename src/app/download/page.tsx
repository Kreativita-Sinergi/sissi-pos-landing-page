import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { GooglePlayIcon } from "@/components/shared/GooglePlayIcon";
import { MIN_ANDROID, PLAY_STORE_URL } from "@/constants/site";

export const metadata: Metadata = {
  title: "Unduh aplikasi · Sissi POS",
  description: `Pasang Sissi dari Google Play di HP atau tablet Android (${MIN_ANDROID} atau lebih baru). Daftar dengan email atau akun Google, pilih jenis usaha, lalu mulai jualan.`,
};

const STEPS = [
  {
    title: "Pasang dari Google Play",
    description: `Di HP atau tablet Android ${MIN_ANDROID.replace("Android ", "")} ke atas.`,
  },
  {
    title: "Daftar",
    description:
      "Dengan email atau akun Google. Isi nama usaha dan pilih jenisnya: kuliner, ritel, jasa, atau penyewaan.",
  },
  {
    title: "Atur outlet & perangkat",
    description:
      "Beri nama perangkat ini, misalnya \"Kasir depan\" atau \"Layar dapur\".",
  },
  {
    title: "Masukkan menu, buka kasir",
    description:
      "Tambahkan produk pertama, isi modal awal laci, lalu mulai jualan.",
  },
];

export default function DownloadPage() {
  return (
    <div className="flex min-h-screen flex-col w-full bg-white">
      <Navbar isLight />

      <main className="flex-1 pt-28 pb-20">
        <section className="py-12 sm:py-16">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              <div className="lg:col-span-7">
                <span className="text-[13px] font-medium font-mono tracking-wider uppercase text-[#be5823] mb-3 block">
                  Unduh aplikasi
                </span>
                <h1 className="text-[36px] sm:text-5xl font-semibold text-[#292e31] tracking-tight leading-[1.1]">
                  Pasang Sissi di HP atau tablet tokomu.
                </h1>
                <p className="mt-4 text-[17px] sm:text-[18px] text-[#525866] leading-relaxed max-w-xl">
                  Tersedia di Google Play untuk {MIN_ANDROID} atau lebih baru.
                  Satu akun bisa dipakai di beberapa perangkat dalam satu
                  outlet.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-[52px] px-6 rounded-[10px] bg-[#be5823] hover:bg-[#f1702c] text-white font-semibold text-[16px] inline-flex items-center justify-center gap-2.5 transition-colors"
                  >
                    <GooglePlayIcon />
                    <span>Buka di Google Play</span>
                  </a>
                  <Link
                    href="/panduan"
                    className="h-[52px] px-6 rounded-[10px] bg-white hover:bg-[#f3f6f5] border border-[#e4e9e7] text-[#292e31] font-medium text-[16px] inline-flex items-center justify-center transition-colors"
                  >
                    Lihat panduan
                  </Link>
                </div>
                <p className="mt-4 text-[14px] text-[#7d8986]">
                  Belum tersedia untuk iPhone dan iPad.
                </p>
              </div>

              <div className="lg:col-span-5 flex justify-center">
                <div className="w-[62%] max-w-[260px] rounded-[30px] bg-[#1b2022] p-[7px] shadow-[0_24px_50px_-18px_rgba(41,46,49,0.5)]">
                  <div className="overflow-hidden rounded-[24px] bg-white">
                    <Image
                      src="/images/app/kasir-hp.webp"
                      alt="Layar Kasir Sissi di HP."
                      width={390}
                      height={844}
                      preload
                      sizes="260px"
                      className="block w-full h-auto"
                    />
                  </div>
                </div>
              </div>
            </div>
          </Container>
        </section>

        <section className="py-12 sm:py-16 border-t border-[#e4e9e7]">
          <Container>
            <h2 className="text-2xl sm:text-3xl font-semibold text-[#292e31] mb-8">
              Dari pasang sampai transaksi pertama
            </h2>

            <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8">
              {STEPS.map((step, idx) => (
                <li key={step.title} className="border-t-2 border-[#f1702c] pt-4">
                  <span className="text-[13px] font-mono font-medium text-[#be5823]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-1.5 text-[17px] font-semibold text-[#292e31]">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-[15px] text-[#525866] leading-relaxed">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}
