import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { GooglePlayIcon } from "@/components/shared/GooglePlayIcon";
import { MIN_ANDROID, PLAY_STORE_URL } from "@/constants/site";
import {
  ChevronDown,
  Download,
  LogIn,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { ApkRelease } from "./ApkRelease";

export const metadata: Metadata = {
  title: "Unduh aplikasi · Sissi POS",
  description: `Pasang Sissi dari Google Play di HP atau tablet Android (${MIN_ANDROID} atau lebih baru), atau unduh APK langsung untuk HP tanpa Play Store. Daftar dengan email atau akun Google, pilih jenis usaha, lalu mulai jualan.`,
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

const APK_STEPS = [
  {
    icon: Download,
    title: "Unduh",
    description: "Ketuk “Unduh APK” di HP yang akan dipakai untuk kasir.",
  },
  {
    icon: ShieldCheck,
    title: "Izinkan pemasangan",
    description:
      "Buka berkasnya. Bila diminta, izinkan “Instal aplikasi tidak dikenal” untuk browser atau aplikasi Berkas.",
  },
  {
    icon: LogIn,
    title: "Pasang & masuk",
    description: "Ketuk “Pasang”, buka Sissi, lalu masuk dengan email.",
  },
];

const NO_GOOGLE_LIMITS = [
  "Notifikasi push tidak masuk (notifikasi di dalam aplikasi tetap ada).",
  "Masuk dengan Google tidak bisa dipakai. Gunakan email dan password.",
  "Tidak ada pembaruan otomatis dari Play Store.",
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
                  Belum tersedia untuk iPhone dan iPad. HP tanpa Play Store?{" "}
                  <a href="#apk" className="text-[#be5823] font-medium hover:underline">
                    Unduh APK langsung
                  </a>
                  .
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
        <section
          id="apk"
          className="py-12 sm:py-16 border-t border-border-subtle scroll-mt-24"
        >
          <Container>
            <ApkRelease>
              <span className="text-[13px] font-medium font-mono tracking-wider uppercase text-brand-deep mb-3 block">
                Tanpa Play Store
              </span>
              <h2 className="text-2xl sm:text-3xl font-semibold text-text-heading">
                Unduh APK langsung
              </h2>
              <p className="mt-3 text-[16px] text-text-body leading-relaxed max-w-xl">
                Untuk HP atau tablet tanpa Google Play, misalnya Huawei atau
                HarmonyOS yang masih bisa memasang APK.
              </p>
            </ApkRelease>

            <h3 className="mt-12 text-[17px] font-semibold text-text-heading">
              Cara pasang
            </h3>
            <ol className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              {APK_STEPS.map(({ icon: Icon, title, description }, idx) => (
                <li
                  key={title}
                  className="flex gap-4 rounded-[12px] border border-border-subtle p-4 sm:p-5"
                >
                  <span className="relative shrink-0 w-10 h-10 rounded-full bg-brand-tint text-brand-deep inline-flex items-center justify-center">
                    <Icon className="w-5 h-5" aria-hidden />
                    <span className="absolute -top-1 -right-1 w-[18px] h-[18px] rounded-full bg-brand-deep text-white text-[11px] font-semibold font-mono inline-flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <p className="text-[16px] font-semibold text-text-heading">
                      {title}
                    </p>
                    <p className="mt-1 text-[14px] text-text-body leading-relaxed">
                      {description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <h3 className="mt-12 text-[17px] font-semibold text-text-heading">
              Hal yang perlu diketahui
            </h3>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div
                role="note"
                className="flex gap-3 rounded-[12px] border border-warning/25 bg-warning-tint p-4 sm:p-5 lg:order-2"
              >
                <TriangleAlert
                  className="shrink-0 w-5 h-5 mt-0.5 text-warning"
                  aria-hidden
                />
                <div>
                  <p className="text-[16px] font-semibold text-text-heading">
                    Pindah antara Play Store dan APK
                  </p>
                  <p className="mt-1 text-[14px] text-text-body leading-relaxed">
                    Keduanya tidak bisa saling menimpa, jadi aplikasi lama harus
                    dicopot dulu. Data yang belum tersinkron ikut hilang: buka
                    Sissi saat online dan tunggu status{" "}
                    <strong className="font-semibold text-text-heading">
                      “Tersinkron”
                    </strong>{" "}
                    sebelum mencopot.
                  </p>
                </div>
              </div>

              <div className="rounded-[12px] border border-border-subtle divide-y divide-border-subtle lg:order-1">
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 sm:px-5 py-4 text-[16px] font-semibold text-text-heading rounded-[12px] focus-visible:outline-2 focus-visible:outline-brand-deep [&::-webkit-details-marker]:hidden">
                    Tanpa layanan Google
                    <ChevronDown
                      className="shrink-0 w-5 h-5 text-text-muted transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <div className="px-4 sm:px-5 pb-4 -mt-1 text-[14px] text-text-body leading-relaxed">
                    <ul className="space-y-1.5 list-disc pl-5 marker:text-border-active">
                      {NO_GOOGLE_LIMITS.map((text) => (
                        <li key={text}>{text}</li>
                      ))}
                    </ul>
                    <p className="mt-2">
                      Kasir, stok, laporan, dan mode offline tetap berjalan
                      seperti biasa.
                    </p>
                  </div>
                </details>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 sm:px-5 py-4 text-[16px] font-semibold text-text-heading rounded-[12px] focus-visible:outline-2 focus-visible:outline-brand-deep [&::-webkit-details-marker]:hidden">
                    Memperbarui
                    <ChevronDown
                      className="shrink-0 w-5 h-5 text-text-muted transition-transform group-open:rotate-180"
                      aria-hidden
                    />
                  </summary>
                  <p className="px-4 sm:px-5 pb-4 -mt-1 text-[14px] text-text-body leading-relaxed">
                    Kembali ke halaman ini, unduh APK terbaru, lalu pasang di
                    atas versi lama. Data tetap aman selama sebelumnya juga
                    dipasang dari APK halaman ini.
                  </p>
                </details>
              </div>
            </div>

            <p className="mt-8 text-[14px] text-text-muted">
              Langkah lengkap ada di panduan{" "}
              <Link
                href="/panduan/pasang-lewat-apk"
                className="text-brand-deep font-medium hover:underline"
              >
                Pasang lewat APK
              </Link>
              .
            </p>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}
