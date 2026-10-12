import React from "react";
import Image from "next/image";
import { SectionWrapper } from "@/components/shared/SectionWrapper";
import { SectionHeader } from "@/components/shared/SectionHeader";

const WORKFLOW_STEPS = [
  { name: "Pesanan", detail: "Meja 05 · disimpan" },
  { name: "Dapur", detail: "Tiket masuk · Masak" },
  { name: "Pembayaran", detail: "QRIS · Rp89.100" },
  { name: "Tutup kasir", detail: "Hitung laci · selisih" },
  { name: "Laporan", detail: "Omzet & laba hari ini" },
];

const SCREEN_CARDS = [
  {
    title: "Layar dapur",
    description:
      "Tiket per meja dengan kolom Masuk, Dimasak, dan Siap. Umur tiket berubah warna kalau terlalu lama.",
    image: "/images/app/dapur-tablet.webp",
    alt: "Layar dapur Sissi di tablet dengan tiga kolom: Masuk, Dimasak, Siap.",
  },
  {
    title: "Layar pembayaran",
    description:
      "Tunai dengan tombol uang pas dan nominal cepat, QRIS, kartu, transfer, atau kasbon. Bisa dibagi beberapa cara.",
    image: "/images/app/bayar-tablet.webp",
    alt: "Layar Pembayaran Sissi: total Rp117.810, pilihan Tunai, QRIS, Kartu, Transfer, Kasbon.",
  },
  {
    title: "Tutup kasir",
    description:
      "Hitung uang di laci per pecahan. Sissi membandingkannya dengan catatan shift dan menampilkan selisihnya.",
    image: "/images/app/tutup-kasir-tablet.webp",
    alt: "Layar Tutup Kasir Sissi: hitung uang fisik per pecahan dan ringkasan shift.",
  },
];

export function CaraKerjaSection() {
  return (
    <SectionWrapper id="cara-kerja" bg="muted">
      <SectionHeader
        tag="CARA KERJA"
        title="Ikuti satu pesanan, dari meja sampai laporan."
        subtitle="Contoh di Kopi Senja: pesanan disimpan per meja, dimasak, dibayar, lalu masuk ke tutup kasir dan laporan tanpa ditulis ulang."
      />

      {/* Alur 5 langkah — bernomor, bukan ikon */}
      <ol className="grid grid-cols-1 sm:grid-cols-5 gap-px bg-[#e4e9e7] rounded-[14px] overflow-hidden border border-[#e4e9e7] mb-12 lg:mb-16">
        {WORKFLOW_STEPS.map((step, idx) => (
          <li
            key={step.name}
            className="bg-white px-5 py-4 sm:py-5 flex sm:flex-col items-baseline sm:items-start gap-3 sm:gap-1"
          >
            <span className="text-[13px] font-mono font-medium text-[#f1702c] shrink-0">
              {String(idx + 1).padStart(2, "0")}
            </span>
            <div className="flex flex-col">
              <span className="text-[17px] font-semibold text-[#292e31]">
                {step.name}
              </span>
              <span className="text-[13px] font-mono text-[#7d8986] mt-0.5">
                {step.detail}
              </span>
            </div>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {SCREEN_CARDS.map((card) => (
          <div
            key={card.title}
            className="p-4 sm:p-5 rounded-[16px] bg-white border border-[#e4e9e7] flex flex-col"
          >
            <div className="overflow-hidden rounded-[10px] border border-[#e4e9e7] mb-5">
              <Image
                src={card.image}
                alt={card.alt}
                width={1280}
                height={800}
                className="block w-full h-auto"
                sizes="(max-width: 768px) 100vw, 400px"
              />
            </div>
            <h3 className="text-[17px] font-semibold text-[#292e31]">
              {card.title}
            </h3>
            <p className="mt-2 text-[15px] text-[#525866] leading-relaxed">
              {card.description}
            </p>
          </div>
        ))}
      </div>
    </SectionWrapper>
  );
}
