"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { SectionWrapper } from "@/components/shared/SectionWrapper";
import { PRICING_FEATURES } from "@/constants/pricing";
import { PLAY_STORE_URL } from "@/constants/site";

export function HargaSection() {
  const [billingCycle, setBillingCycle] = useState<"yearly" | "monthly">("yearly");

  const isYearly = billingCycle === "yearly";

  return (
    <SectionWrapper id="harga" bg="white">
      {/* Header & Switcher Row */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-12 lg:mb-14">
        {/* Left Heading */}
        <div className="max-w-2xl">
          <span className="text-[13px] font-medium font-mono tracking-wider uppercase text-[#f1702c] mb-2 block">
            HARGA
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[48px] font-semibold text-[#292e31] tracking-tight leading-[1.12]">
            Mulai gratis. Upgrade saat usahamu siap.
          </h2>
          <p className="mt-4 text-[17px] text-[#525866] leading-relaxed">
            Paket Gratis bisa dipakai selamanya. Semua fitur Pro bisa dicoba
            gratis 30 hari sejak daftar.
          </p>
        </div>

        {/* Right Billing Switcher */}
        <div className="inline-flex items-center bg-[#f3f6f5] p-1.5 rounded-[12px] border border-[#e4e9e7] self-start lg:self-end shrink-0">
          <button
            type="button"
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-2 rounded-[8px] text-[14px] font-medium transition-all cursor-pointer ${
              !isYearly
                ? "bg-white text-[#292e31] shadow-2xs font-semibold"
                : "text-[#525866] hover:text-[#292e31]"
            }`}
          >
            Bulanan
          </button>
          <button
            type="button"
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-2 rounded-[8px] text-[14px] font-medium flex items-center gap-2 transition-all cursor-pointer ${
              isYearly
                ? "bg-white text-[#292e31] shadow-2xs font-semibold"
                : "text-[#525866] hover:text-[#292e31]"
            }`}
          >
            <span>Tahunan</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#f1702c] text-white font-bold font-mono tracking-wider uppercase">
              HEMAT 2 BULAN
            </span>
          </button>
        </div>
      </div>

      {/* Tabel Harga - No outer border, exactly matching Figma */}
      <div className="w-full overflow-x-auto">
        <div className="min-w-[700px] md:min-w-0">
          {/* Table Header / Plan Column Cards */}
          <div className="grid grid-cols-1 md:grid-cols-[5fr_3.5fr_3.5fr] border-b border-[#e4e9e7] bg-white p-0 gap-0 items-stretch">
            {/* Label Col */}
            <div className="hidden md:flex flex-col justify-end p-7 pb-6">
              <span className="text-[12px] font-medium font-mono tracking-wider uppercase text-[#7d8986]">
                BANDINGKAN PAKET
              </span>
            </div>

            {/* Gratis Col */}
            <div className="flex flex-col justify-between p-6 sm:p-7 bg-white">
              <div>
                <span className="text-[18px] font-semibold text-[#292e31]">
                  Gratis
                </span>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-[44px] font-semibold text-[#292e31] leading-none tracking-tight">
                    Rp0
                  </span>
                </div>
                <p className="mt-2 text-[14px] text-[#525866]">
                  Untuk usaha yang baru mulai
                </p>
              </div>
              <Link
                href={PLAY_STORE_URL}
                className="mt-6 w-full h-[38px] px-4 rounded-[8px] border border-[#c9d2cf] hover:border-[#b0b8b5] bg-white text-[#292e31] text-[14px] font-medium flex items-center justify-center transition-colors cursor-pointer"
              >
                Mulai gratis
              </Link>
            </div>

            {/* Pro Col - Figma #e8f4f0 full height column */}
            <div className="flex flex-col justify-between p-6 sm:p-7 bg-[#e8f4f0] relative">
              <span className="absolute top-4 right-6 text-[10px] font-bold font-mono tracking-wider uppercase bg-[#f1702c] text-white px-2 py-0.5 rounded-[4px]">
                SEMUA FITUR
              </span>

              <div>
                <span className="text-[18px] font-semibold text-[#292e31]">
                  Pro
                </span>

                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-[44px] font-semibold text-[#292e31] leading-none tracking-tight">
                    {isYearly ? "Rp590rb" : "Rp59rb"}
                  </span>
                  <span className="text-[14px] text-[#7d8986]">
                    {isYearly ? "/tahun" : "/bulan"}
                  </span>
                </div>

                <div className="mt-2 flex flex-col text-[13px] leading-snug">
                  {isYearly ? (
                    <>
                      <span className="text-[#525866]">atau Rp59rb/bulan</span>
                      <span className="text-[#f1702c] font-medium">
                        setara Rp49rb per bulan
                      </span>
                    </>
                  ) : (
                    <span className="text-[#525866]">
                      atau hemat 2 bulan bayar tahunan
                    </span>
                  )}
                </div>
              </div>

              <Link
                href={PLAY_STORE_URL}
                className="mt-6 w-full h-[38px] px-4 rounded-[8px] bg-[#f1702c] hover:bg-[#ff7a45] text-white text-[14px] font-medium flex items-center justify-center transition-colors shadow-2xs cursor-pointer"
              >
                Coba gratis 30 hari
              </Link>
            </div>
          </div>

          {/* Feature Comparison Rows */}
          <div className="divide-y divide-[#e4e9e7]">
            {PRICING_FEATURES.map((feature) => (
              <div
                key={feature.name}
                className="grid grid-cols-1 md:grid-cols-[5fr_3.5fr_3.5fr] gap-2 md:gap-0 items-center hover:bg-[#f3f6f5]/40 transition-colors"
              >
                {/* Feature Name */}
                <div className="px-6 md:px-0 md:pr-6 py-3.5 md:py-0 md:h-[56px] flex items-center text-[15px] font-normal text-[#292e31]">
                  {feature.name}
                </div>

                {/* Gratis Value */}
                <div className="px-6 md:px-0 py-2 md:py-0 md:h-[56px] flex items-center justify-between md:justify-center text-[15px] border-b md:border-b-0 border-[#e4e9e7]/40">
                  <span className="text-[12px] font-medium font-mono uppercase text-[#7d8986] md:hidden">
                    Gratis:
                  </span>
                  {typeof feature.freeValue === "boolean" ? (
                    feature.freeValue ? (
                      <Check size={18} className="text-[#292e31] stroke-[2]" />
                    ) : (
                      <Minus size={18} className="text-[#b0b8b5]" />
                    )
                  ) : (
                    <span className="font-medium text-[#292e31]">
                      {feature.freeValue}
                    </span>
                  )}
                </div>

                {/* Pro Value - Highlighted #e8f4f0 cell */}
                <div className="px-6 md:px-0 py-2 md:py-0 md:h-[56px] flex items-center justify-between md:justify-center text-[15px] bg-[#e8f4f0]">
                  <span className="text-[12px] font-medium font-mono uppercase text-[#f1702c] md:hidden">
                    Pro:
                  </span>
                  {typeof feature.proValue === "boolean" ? (
                    feature.proValue ? (
                      <Check size={18} className="text-[#292e31] stroke-[2]" />
                    ) : (
                      <Minus size={18} className="text-[#b0b8b5]" />
                    )
                  ) : (
                    <span className="font-semibold text-[#292e31]">
                      {feature.proValue}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Footer Note - Left-aligned, no border, no background, pt-5 */}
          <div className="pt-5 text-left text-[14px] text-[#7d8986]">
            Harga sudah termasuk PPN. Outlet tambahan dikenakan biaya terpisah.
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
}
