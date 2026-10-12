"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AjakanSection } from "@/components/sections/AjakanSection";
import { Check, Plus, Minus } from "lucide-react";
import { PRICING_COMPARISON, PRICING_FAQS } from "@/constants/pricingComparison";

export default function HargaPage() {
  const [isAnnual, setIsAnnual] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Navbar />

      {/* Header Banner */}
      <section className="bg-[#f1702c] pt-[110px] pb-16 sm:pb-20 text-white">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-[13px] font-mono font-medium text-[#fef1eb] tracking-wider uppercase mb-4">
            BERANDA / HARGA
          </p>
          <h1 className="text-[40px] sm:text-[56px] lg:text-[64px] font-semibold leading-[1.08] tracking-tight mb-5 max-w-[850px] mx-auto">
            Harga yang jelas, tanpa biaya tersembunyi
          </h1>
          <p className="text-[18px] sm:text-[19px] text-[#fef1eb] leading-relaxed max-w-[620px] mx-auto mb-10">
            Mulai gratis. Semua fitur Pro bisa dicoba 30 hari, dihitung sejak
            transaksi pertama.
          </p>

          {/* Billing Switcher */}
          <div className="inline-flex items-center gap-1.5 p-1 bg-white/15 backdrop-blur-sm rounded-full border border-white/20">
            <button
              type="button"
              onClick={() => setIsAnnual(false)}
              className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all cursor-pointer ${
                !isAnnual
                  ? "bg-white text-[#292e31] shadow-sm"
                  : "text-white hover:text-white/80"
              }`}
            >
              Bulanan
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsAnnual(true)}
                className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all cursor-pointer ${
                  isAnnual
                    ? "bg-white text-[#292e31] shadow-sm"
                    : "text-white hover:text-white/80"
                }`}
              >
                Tahunan
              </button>
              <span className="mr-2 px-2.5 py-0.5 rounded-full bg-[#e8f4f0] text-[11px] font-mono font-bold text-[#196b52] tracking-wider">
                HEMAT 2 BULAN
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards Section */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch mb-8">
            {/* Paket Gratis */}
            <div className="rounded-[24px] border border-[#e4e9e7] p-8 sm:p-10 flex flex-col bg-white hover:border-[#b0b8b5] transition-all">
              <div className="mb-6">
                <h2 className="text-[24px] font-semibold text-[#292e31] mb-3">
                  Gratis
                </h2>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[44px] font-bold text-[#292e31] tracking-tight font-mono">
                    Rp0
                  </span>
                  <span className="text-[15px] text-[#7d8986]">selamanya</span>
                </div>
                <p className="text-[15px] text-[#525866]">
                  Untuk usaha yang baru mulai atau masih sepi.
                </p>
              </div>

              <Link
                href="/download"
                className="w-full text-center py-3.5 px-6 rounded-[12px] border border-[#e4e9e7] hover:bg-[#f3f6f5] text-[#292e31] font-semibold text-[15px] transition-colors mb-8 cursor-pointer"
              >
                Mulai gratis
              </Link>

              <div className="flex flex-col gap-3.5 pt-6 border-t border-[#e4e9e7] mt-auto">
                {[
                  "50 transaksi per bulan",
                  "1 outlet",
                  "Kasir, struk & printer",
                  "Semua metode bayar",
                  "Mode offline",
                  "Laporan dasar",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#7d8986] shrink-0 stroke-[2.5]" />
                    <span className="text-[15px] text-[#525866]">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Paket Pro */}
            <div className="rounded-[24px] bg-[#e8f4f0] border-2 border-[#196b52]/20 p-8 sm:p-10 flex flex-col relative shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[24px] font-semibold text-[#292e31]">
                  Pro
                </h2>
                <span className="px-3 py-1 rounded-full bg-[#196b52] text-white text-[11px] font-mono font-medium tracking-wider">
                  SEMUA FITUR
                </span>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-[44px] font-bold text-[#292e31] tracking-tight font-mono">
                    {isAnnual ? "Rp590rb" : "Rp59rb"}
                  </span>
                  <span className="text-[15px] text-[#525866]">
                    {isAnnual ? "/tahun" : "/bulan"}
                  </span>
                </div>
                <p className="text-[14px] text-[#525866]">
                  {isAnnual
                    ? "Setara Rp49rb per bulan kalau bayar tahunan."
                    : "Atau Rp590rb per tahun (hemat 2 bulan)."}
                </p>
              </div>

              <Link
                href="/download"
                className="w-full text-center py-3.5 px-6 rounded-[12px] bg-[#f1702c] hover:bg-[#ff7a45] text-white font-semibold text-[15px] shadow-sm transition-all mb-8 cursor-pointer"
              >
                Coba gratis 30 hari
              </Link>

              <div className="flex flex-col gap-3.5 pt-6 border-t border-[#196b52]/15 mt-auto">
                {[
                  "Transaksi tanpa batas",
                  "Semua fitur Gratis",
                  "Meja, pesanan berjalan & layar dapur",
                  "Antrean servis, jadwal & sesi sewa",
                  "Kasbon, diskon, refund & void",
                  "Kehadiran, jadwal & gaji",
                  "Jam ramai & bantuan prioritas",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-[#196b52] shrink-0 stroke-[2.5]" />
                    <span className="text-[15px] font-medium text-[#292e31]">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Pricing Note */}
          <p className="text-[14px] text-[#7d8986] text-left">
            Harga sudah termasuk PPN. Outlet tambahan dikenakan biaya terpisah.
          </p>
        </div>
      </section>

      {/* Uji Coba Section */}
      <section className="py-20 sm:py-24 bg-[#f3f6f5] border-t border-b border-[#e4e9e7]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-16">
            <span className="inline-block text-[13px] font-mono font-medium text-[#f1702c] tracking-wider uppercase mb-3">
              UJI COBA
            </span>
            <h2 className="text-[32px] sm:text-[40px] font-semibold text-[#292e31] tracking-tight">
              Begini cara kerja 30 hari gratisnya
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Daftar dan siapkan toko",
                desc: "Masukkan menu dan sambungkan printer. Hitungan belum dimulai.",
              },
              {
                step: "2",
                title: "30 hari semua fitur Pro",
                desc: "Dimulai sejak transaksi pertama. Tidak perlu kartu kredit.",
              },
              {
                step: "3",
                title: "Pilih paketmu",
                desc: "Lanjut Pro, atau tetap Gratis. Data tetap aman di dua pilihan.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-white rounded-[20px] p-8 border border-[#e4e9e7] flex flex-col"
              >
                <div className="w-12 h-12 rounded-full bg-[#e8f4f0] text-[#196b52] font-mono font-bold text-[20px] flex items-center justify-center mb-6">
                  {item.step}
                </div>
                <h3 className="text-[20px] font-semibold text-[#292e31] mb-3">
                  {item.title}
                </h3>
                <p className="text-[15px] text-[#525866] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Perbandingan Section */}
      <section className="py-20 sm:py-28 bg-white border-b border-[#e4e9e7]">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="mb-12">
            <span className="inline-block text-[13px] font-mono font-medium text-[#f1702c] tracking-wider uppercase mb-3">
              PERBANDINGAN
            </span>
            <h2 className="text-[32px] sm:text-[40px] font-semibold text-[#292e31] tracking-tight">
              Bandingkan semua fitur
            </h2>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="border-b-2 border-[#292e31]">
                  <th className="py-4 text-[13px] font-mono font-semibold text-[#7d8986] tracking-wider uppercase w-1/2">
                    FITUR
                  </th>
                  <th className="py-4 text-[13px] font-mono font-semibold text-[#7d8986] tracking-wider uppercase text-center w-1/4">
                    GRATIS
                  </th>
                  <th className="py-4 text-[13px] font-mono font-semibold text-[#196b52] tracking-wider uppercase text-center w-1/4">
                    PRO
                  </th>
                </tr>
              </thead>
              <tbody>
                {PRICING_COMPARISON.map((category) => (
                  <React.Fragment key={category.category}>
                    <tr className="bg-[#f3f6f5]">
                      <td
                        colSpan={3}
                        className="py-3 px-3 text-[14px] font-semibold text-[#292e31]"
                      >
                        {category.category}
                      </td>
                    </tr>
                    {category.items.map((item) => (
                      <tr
                        key={item.name}
                        className="border-b border-[#e4e9e7] hover:bg-[#fafafa] transition-colors"
                      >
                        <td className="py-4 px-3 text-[15px] text-[#292e31]">
                          {item.name}
                        </td>
                        <td className="py-4 px-3 text-center">
                          {typeof item.gratis === "boolean" ? (
                            item.gratis ? (
                              <Check className="w-4 h-4 text-[#7d8986] mx-auto stroke-[2.5]" />
                            ) : (
                              <span className="text-[#b0b8b5] font-mono">—</span>
                            )
                          ) : (
                            <span className="text-[14px] font-mono text-[#525866]">
                              {item.gratis}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-3 text-center">
                          {typeof item.pro === "boolean" ? (
                            item.pro ? (
                              <Check className="w-4 h-4 text-[#f1702c] mx-auto stroke-[2.5]" />
                            ) : (
                              <span className="text-[#b0b8b5] font-mono">—</span>
                            )
                          ) : (
                            <span className="text-[14px] font-mono font-medium text-[#292e31]">
                              {item.pro}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ Harga Section */}
      <section className="py-20 sm:py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="mb-12">
            <span className="inline-block text-[13px] font-mono font-medium text-[#f1702c] tracking-wider uppercase mb-3">
              FAQ
            </span>
            <h2 className="text-[32px] sm:text-[40px] font-semibold text-[#292e31] tracking-tight">
              Pertanyaan soal harga
            </h2>
          </div>

          <div className="flex flex-col divide-y divide-[#e4e9e7]">
            {PRICING_FAQS.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div key={faq.question} className="py-6">
                  <button
                    type="button"
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-start justify-between gap-4 text-left group cursor-pointer"
                  >
                    <span className="text-[18px] sm:text-[20px] font-semibold text-[#292e31] group-hover:text-[#f1702c] transition-colors">
                      {faq.question}
                    </span>
                    <div className="mt-1 w-6 h-6 rounded-full border border-[#e4e9e7] flex items-center justify-center shrink-0 text-[#7d8986]">
                      {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                    </div>
                  </button>

                  <div
                    className={`grid transition-all duration-200 ease-in-out ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100 mt-4"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="text-[15px] sm:text-[16px] text-[#525866] leading-relaxed max-w-[800px]">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Ajakan Banner */}
      <AjakanSection />

      {/* Footer */}
      <Footer />
    </div>
  );
}
