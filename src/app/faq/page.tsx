"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { FAQ_ITEMS } from "@/constants/faq";
import { Plus, Minus } from "lucide-react";
import { SUPPORT_WHATSAPP_URL } from "@/constants/site";

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="flex min-h-screen flex-col w-full bg-[#f3f6f5]">
      {/* Subpage White Navbar */}
      <Navbar isLight />

      <main className="flex-1 pt-28 pb-20">
        {/* Header */}
        <section className="py-12 sm:py-16">
          <Container>
            <div className="max-w-3xl">
              <span className="text-[13px] font-medium font-mono tracking-wider uppercase text-[#f1702c] mb-3 block">
                BANTUAN / FAQ
              </span>
              <h1 className="text-3xl sm:text-5xl font-semibold text-[#292e31] tracking-tight leading-[1.12]">
                Pertanyaan yang sering ditanyakan
              </h1>
              <p className="mt-4 text-base sm:text-[18px] text-[#525866] leading-relaxed">
                Cara kerja offline, perangkat dan printer yang didukung, QRIS, akses karyawan, dan data tokomu.
              </p>
            </div>
          </Container>
        </section>

        {/* FAQ List */}
        <section className="pb-16">
          <Container>
            <div className="max-w-4xl flex flex-col gap-3.5">
              {FAQ_ITEMS.map((item, idx) => {
                const isOpen = openIndex === idx;
                return (
                  <div
                    key={item.question}
                    className="bg-white rounded-[14px] px-7 py-5.5 shadow-2xs border border-[#e4e9e7]/70 transition-all"
                  >
                    <button
                      type="button"
                      onClick={() => toggleAccordion(idx)}
                      className="w-full text-left flex items-start justify-between gap-4 text-[17px] font-medium text-[#292e31] hover:text-[#f1702c] transition-colors cursor-pointer select-none"
                    >
                      <span className="leading-snug">{item.question}</span>
                      <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-[#7d8986]">
                        {isOpen ? <Minus size={20} /> : <Plus size={20} />}
                      </div>
                    </button>

                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                        isOpen
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="pt-3 text-[15px] font-normal text-[#525866] leading-relaxed max-w-3xl">
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Container>
        </section>

        {/* Ajakan Card */}
        <section className="py-8">
          <Container>
            <div className="bg-[#f1702c] text-white rounded-[24px] p-8 sm:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-lg">
              <div>
                <h3 className="text-2xl font-semibold">
                  Masih punya pertanyaan lain?
                </h3>
                <p className="mt-2 text-white/90 text-[15px]">
                  Tanyakan langsung lewat WhatsApp.
                </p>
              </div>
              <Link
                href={SUPPORT_WHATSAPP_URL}
                className="h-[46px] px-6 bg-white hover:bg-[#fef1eb] text-[#292e31] font-semibold text-[14px] rounded-[8px] flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
              >
                Chat WhatsApp
              </Link>
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}
