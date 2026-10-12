import React from "react";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { GooglePlayIcon } from "@/components/shared/GooglePlayIcon";
import { PLAY_STORE_URL, SUPPORT_WHATSAPP_URL } from "@/constants/site";

const STEPS = [
  "Pasang Sissi dari Google Play.",
  "Daftar dengan email atau akun Google, lalu pilih jenis usaha.",
  "Masukkan menu atau produk, buka kasir, mulai jualan.",
];

export function AjakanSection() {
  return (
    <section className="bg-white py-16 sm:py-24 lg:py-28">
      <Container>
        <div className="w-full bg-[#f1702c] text-white rounded-[24px] overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-7 p-8 sm:p-12 lg:p-16">
            <h2 className="text-3xl sm:text-4xl lg:text-[48px] font-semibold tracking-tight leading-[1.12]">
              Coba Sissi di tokomu minggu ini.
            </h2>
            <p className="mt-4 text-[17px] text-[#fef1eb] leading-relaxed max-w-[520px]">
              Kalau ada yang membingungkan, tanya kami lewat WhatsApp.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
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
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="h-[52px] px-6 text-white font-medium text-[16px] rounded-[10px] inline-flex items-center justify-center gap-2 border border-white/60 hover:bg-white/10 transition-colors"
              >
                <span className="relative w-4 h-4">
                  <Image
                    src="/logos/whatsapp.svg"
                    alt=""
                    fill
                    className="object-contain"
                  />
                </span>
                <span>Chat WhatsApp</span>
              </Link>
            </div>
          </div>

          <ol className="lg:col-span-5 bg-[#292e31] p-8 sm:p-12 lg:p-16 flex flex-col justify-center gap-6">
            {STEPS.map((step, idx) => (
              <li key={step} className="flex gap-4">
                <span className="text-[14px] font-mono font-medium text-[#f1702c] pt-0.5 shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <span className="text-[17px] text-white leading-relaxed">
                  {step}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Container>
    </section>
  );
}
