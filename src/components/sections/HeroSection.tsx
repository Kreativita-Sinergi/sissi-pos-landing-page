import React from "react";
import Image from "next/image";
import Link from "next/link";
import { PLAY_STORE_URL } from "@/constants/site";
import { GooglePlayIcon } from "@/components/shared/GooglePlayIcon";

const BUSINESS_LINKS = [
  { label: "Kuliner", href: "/untuk-usaha/kuliner" },
  { label: "Ritel", href: "/untuk-usaha/ritel" },
  { label: "Jasa", href: "/untuk-usaha/jasa" },
  { label: "Penyewaan", href: "/untuk-usaha/penyewaan" },
];

export function HeroSection() {
  return (
    <section className="bg-white relative overflow-hidden pt-[82px]">
      {/* Teks di atas latar oranye merek */}
      <div className="bg-[#f1702c] text-white">
        <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pt-10 sm:pt-16 pb-14 sm:pb-20 lg:pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="text-[13px] font-mono font-medium tracking-wider uppercase text-[#fef1eb] mb-4">
                Aplikasi kasir untuk HP &amp; tablet Android
              </p>
              <h1 className="text-[40px] leading-[1.05] sm:text-6xl lg:text-[72px] font-semibold tracking-tight text-white">
                Internet mati, kasir tetap jalan.
              </h1>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-6">
              <p className="text-[17px] sm:text-lg text-[#fef1eb] leading-relaxed">
                Catat penjualan, potong stok, hitung HPP per varian, terima
                QRIS, dan kirim pesanan ke dapur dari satu aplikasi. Begitu
                sinyal kembali, semua perangkat di outlet ikut terbarui.
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[52px] px-6 bg-white hover:bg-[#fef1eb] text-[#292e31] font-semibold text-[16px] rounded-[10px] inline-flex items-center justify-center gap-2.5 transition-colors"
                >
                  <GooglePlayIcon />
                  <span>Unduh di Google Play</span>
                </a>
                <Link
                  href="/panduan"
                  className="h-[52px] px-6 text-white font-medium text-[16px] rounded-[10px] inline-flex items-center justify-center border border-white/60 hover:bg-white/10 transition-colors"
                >
                  Lihat panduan
                </Link>
              </div>

              <p className="text-[14px] text-[#fef1eb] leading-relaxed">
                <span className="font-medium text-white">Untuk usaha</span>{" "}
                {BUSINESS_LINKS.map((biz, idx) => (
                  <React.Fragment key={biz.href}>
                    <Link
                      href={biz.href}
                      className="underline decoration-white/40 underline-offset-4 hover:decoration-white"
                    >
                      {biz.label}
                    </Link>
                    {idx < BUSINESS_LINKS.length - 1 ? " · " : ""}
                  </React.Fragment>
                ))}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Komposisi layar asli: tablet + HP, menjembatani oranye & putih */}
      <div className="relative">
        <div
          className="absolute inset-x-0 top-0 h-[38%] bg-[#f1702c]"
          aria-hidden="true"
        />
        <div className="relative max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pb-4 sm:pb-8">
          <figure className="relative mx-auto max-w-[1060px] pr-[12%] sm:pr-[10%]">
            {/* Tablet — layar Kasir */}
            <div className="rounded-[16px] sm:rounded-[26px] bg-[#1b2022] p-[5px] sm:p-[10px] shadow-[0_24px_60px_-20px_rgba(41,46,49,0.45)]">
              <div className="overflow-hidden rounded-[11px] sm:rounded-[17px] bg-white">
                <Image
                  src="/images/app/kasir-tablet.webp"
                  alt="Layar Kasir Sissi di tablet: Es Kopi Susu Gula Aren 2x (less ice, extra shot), Americano, dan Caffe Latte, total Rp117.810 termasuk biaya layanan dan PB1 10%."
                  width={1280}
                  height={800}
                  preload
                  sizes="(max-width: 1100px) 88vw, 950px"
                  className="block w-full h-auto"
                />
              </div>
            </div>

            {/* HP — Layar dapur, menumpang di sudut kanan bawah tablet */}
            <div className="absolute right-0 bottom-[-6%] w-[26%] sm:w-[22%] max-w-[230px]">
              <div className="rounded-[16px] sm:rounded-[30px] bg-[#1b2022] p-[4px] sm:p-[7px] shadow-[0_24px_50px_-16px_rgba(41,46,49,0.55)]">
                <div className="overflow-hidden rounded-[12px] sm:rounded-[24px] bg-white">
                  <Image
                    src="/images/app/dapur-hp.webp"
                    alt="Layar dapur Sissi di HP: tiket Meja 02 dan tambahan Meja 05, status masak per item."
                    width={390}
                    height={844}
                    preload
                    sizes="(max-width: 640px) 26vw, 230px"
                    className="block w-full h-auto"
                  />
                </div>
              </div>
            </div>
          </figure>
          <p className="mx-auto max-w-[1060px] mt-12 sm:mt-16 text-[13px] text-[#7d8986] font-mono">
            Layar asli aplikasi · Tablet: Kasir · HP: Layar dapur
          </p>
        </div>
      </div>
    </section>
  );
}
