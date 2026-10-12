import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import {
  SUPPORT_WHATSAPP_LABEL,
  SUPPORT_WHATSAPP_URL,
} from "@/constants/site";

export const metadata: Metadata = {
  title: "Tentang & kontak · Sissi POS",
  description:
    "Kenapa Sissi dibuat: aplikasi kasir yang mengikuti urutan kerja toko dan tetap jalan saat internet putus. Hubungi kami lewat WhatsApp atau email.",
};

const PRINCIPLES = [
  {
    title: "Cepat di jam sibuk",
    description:
      "Antrean tidak boleh menunggu aplikasi. Pesanan dibuat dengan sesedikit mungkin ketukan.",
  },
  {
    title: "Tetap jalan offline",
    description:
      "Internet putus bukan alasan berhenti jualan. Data dicatat di perangkat dulu, lalu dikirim saat online.",
  },
  {
    title: "Bantuan dekat",
    description:
      "Panduan ada di dalam aplikasi, dan pertanyaan bisa langsung dikirim ke WhatsApp kami.",
  },
];

export default function TentangPage() {
  return (
    <div className="flex min-h-screen flex-col w-full bg-white">
      <Navbar isLight />

      <main className="flex-1 pt-28 pb-20">
        <section className="py-12 sm:py-16 border-b border-[#e4e9e7]">
          <Container>
            <div className="max-w-4xl">
              <span className="text-[13px] font-medium font-mono tracking-wider uppercase text-[#be5823] mb-3 block">
                Tentang kami
              </span>
              <h1 className="text-[36px] sm:text-5xl lg:text-[60px] font-semibold text-[#292e31] tracking-tight leading-[1.1]">
                Kasir untuk usaha yang melayani orang setiap hari
              </h1>
              <p className="mt-5 text-[17px] sm:text-[19px] text-[#525866] leading-relaxed max-w-2xl">
                Sissi dibuat untuk pemilik kafe, warung, toko, bengkel, dan
                lapangan yang ingin usahanya tertib tanpa harus jadi ahli
                teknologi.
              </p>
            </div>
          </Container>
        </section>

        <section className="py-16 sm:py-24 bg-[#f3f6f5] border-b border-[#e4e9e7]">
          <Container>
            <div className="max-w-3xl mb-14">
              <h2 className="text-3xl sm:text-[42px] font-semibold text-[#292e31] tracking-tight leading-tight">
                Kenapa Sissi ada
              </h2>
              <div className="mt-6 flex flex-col gap-4 text-[16px] sm:text-[17px] text-[#525866] leading-relaxed">
                <p>
                  Banyak usaha kecil masih mencatat pesanan di kertas,
                  menghitung kas dengan kalkulator, dan mengirim foto buku ke
                  pemilik setiap malam. Bukan karena malas, tapi karena aplikasi
                  kasir terasa rumit, atau berhenti bekerja saat sinyal hilang.
                </p>
                <p>
                  Sissi mengikuti urutan kerja di toko sungguhan: buka kasir,
                  terima pesanan, bayar, tutup kasir. Semuanya dicatat di
                  perangkat lebih dulu, jadi tetap jalan saat internet putus.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
              {PRINCIPLES.map((item, idx) => (
                <div key={item.title} className="border-t-2 border-[#f1702c] pt-5">
                  <span className="text-[13px] font-mono font-medium text-[#be5823]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-[19px] font-semibold text-[#292e31]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-[15px] text-[#525866] leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        <section id="kontak" className="py-16 sm:py-24 scroll-mt-24">
          <Container>
            <h2 className="text-3xl sm:text-[42px] font-semibold text-[#292e31] tracking-tight leading-tight mb-10">
              Hubungi kami
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
              <div className="p-7 rounded-[16px] bg-[#292e31] text-white flex flex-col justify-between gap-8">
                <div>
                  <h3 className="text-[14px] font-mono tracking-wider uppercase text-[#f1702c]">
                    WhatsApp
                  </h3>
                  <p className="mt-2 text-[24px] font-semibold">
                    {SUPPORT_WHATSAPP_LABEL}
                  </p>
                  <p className="mt-2 text-[15px] text-white/75 leading-relaxed">
                    Cara paling cepat untuk bertanya soal pemasangan, printer,
                    atau akun.
                  </p>
                </div>
                <Link
                  href={SUPPORT_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[48px] px-6 self-start rounded-[10px] bg-white hover:bg-[#fef1eb] text-[#292e31] font-semibold text-[15px] inline-flex items-center gap-2 transition-colors"
                >
                  <span className="relative w-4 h-4">
                    <Image
                      src="/logos/whatsapp-dark.svg"
                      alt=""
                      fill
                      className="object-contain"
                    />
                  </span>
                  Chat WhatsApp
                </Link>
              </div>

              <div className="p-7 rounded-[16px] border border-[#e4e9e7] bg-white flex flex-col justify-between gap-8">
                <div>
                  <h3 className="text-[14px] font-mono tracking-wider uppercase text-[#be5823]">
                    Email
                  </h3>
                  <a
                    href="mailto:halo@sissikasir.com"
                    className="mt-2 block text-[20px] font-semibold text-[#292e31] hover:text-[#be5823] break-all"
                  >
                    halo@sissikasir.com
                  </a>
                  <p className="mt-2 text-[15px] text-[#525866] leading-relaxed">
                    Untuk kerja sama atau pertanyaan yang butuh lampiran.
                  </p>
                </div>
                <Link
                  href="/panduan"
                  className="text-[15px] font-semibold text-[#be5823] hover:text-[#f1702c]"
                >
                  Atau baca panduan dulu →
                </Link>
              </div>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}
