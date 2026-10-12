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
    <section className="bg-[#f1702c] text-white relative overflow-hidden pt-[82px]">
      <div className="max-w-[1440px] mx-auto px-6 sm:px-12 lg:px-[120px] pt-10 sm:pt-16 pb-16 sm:pb-20 lg:pb-24">
        {/* Teks di kiri, layar asli di kanan (HP: bertumpuk, teks dulu) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 xl:gap-16 items-center">
          <div className="lg:col-span-6 xl:col-span-5 flex flex-col gap-6">
            <p className="text-[13px] font-mono font-medium tracking-wider uppercase text-[#fef1eb]">
              Aplikasi kasir untuk HP &amp; tablet Android
            </p>
            <h1 className="text-[38px] leading-[1.08] sm:text-[48px] xl:text-[54px] font-semibold tracking-tight text-white">
              Internet mati,{" "}
              <br className="hidden sm:block" />
              kasir tetap jalan.
            </h1>
            <p className="text-[17px] sm:text-lg text-[#fef1eb] leading-relaxed max-w-[560px]">
              Catat penjualan, potong stok, hitung HPP per varian, terima QRIS,
              dan kirim pesanan ke dapur dari satu aplikasi. Begitu sinyal
              kembali, semua perangkat di outlet ikut terbarui.
            </p>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
              <a
                href={PLAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="h-[52px] px-6 whitespace-nowrap bg-white hover:bg-[#fef1eb] text-[#292e31] font-semibold text-[16px] rounded-[10px] inline-flex items-center justify-center gap-2.5 transition-colors"
              >
                <GooglePlayIcon />
                <span>Unduh di Google Play</span>
              </a>
              <Link
                href="/panduan"
                className="h-[52px] px-6 whitespace-nowrap text-white font-medium text-[16px] rounded-[10px] inline-flex items-center justify-center border border-white/60 hover:bg-white/10 transition-colors"
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

          {/* Komposisi layar asli: tablet Kasir + HP Layar dapur */}
          <div className="lg:col-span-6 xl:col-span-7">
            <figure className="relative mx-auto max-w-[760px] pr-[13%] pb-[7%]">
              <div className="rounded-[16px] sm:rounded-[22px] bg-[#1b2022] p-[5px] sm:p-[9px] shadow-[0_28px_60px_-24px_rgba(41,46,49,0.6)]">
                <div className="overflow-hidden rounded-[11px] sm:rounded-[14px] bg-white">
                  <Image
                    src="/images/app/kasir-tablet.webp"
                    alt="Layar Kasir Sissi di tablet: Es Kopi Susu Gula Aren 2x (less ice, extra shot), Americano, dan Caffe Latte, total Rp117.810 termasuk biaya layanan dan PB1 10%."
                    width={1280}
                    height={800}
                    preload
                    sizes="(max-width: 1024px) 88vw, 660px"
                    className="block w-full h-auto"
                  />
                </div>
              </div>

              {/* HP menumpang di sudut kanan bawah tablet */}
              <div className="absolute right-0 bottom-0 w-[27%] max-w-[200px]">
                <div className="rounded-[16px] sm:rounded-[26px] bg-[#1b2022] p-[4px] sm:p-[6px] shadow-[0_24px_50px_-16px_rgba(41,46,49,0.65)]">
                  <div className="overflow-hidden rounded-[12px] sm:rounded-[20px] bg-white">
                    <Image
                      src="/images/app/dapur-hp.webp"
                      alt="Layar dapur Sissi di HP: tiket Meja 02 dan tambahan Meja 05, status masak per item."
                      width={390}
                      height={844}
                      preload
                      sizes="(max-width: 1024px) 26vw, 200px"
                      className="block w-full h-auto"
                    />
                  </div>
                </div>
              </div>
              <figcaption className="sr-only">
                Layar asli aplikasi: Kasir di tablet dan Layar dapur di HP.
              </figcaption>
            </figure>
            <p className="mt-6 text-[13px] text-[#fef1eb]/80 font-mono text-center lg:text-left">
              Layar asli aplikasi · Tablet: Kasir · HP: Layar dapur
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
