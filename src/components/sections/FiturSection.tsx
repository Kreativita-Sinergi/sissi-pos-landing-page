"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { SectionWrapper } from "@/components/shared/SectionWrapper";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { FEATURE_TABS, type FeatureTab } from "@/constants/features";

function Screen({ tab, sizes }: { tab: FeatureTab; sizes: string }) {
  return (
    <div className="overflow-hidden rounded-[12px] border border-[#e4e9e7] bg-white shadow-[0_12px_40px_-18px_rgba(41,46,49,0.35)]">
      <Image
        key={tab.id}
        src={tab.imageSrc}
        alt={tab.imageAlt}
        width={1280}
        height={800}
        className="block w-full h-auto"
        sizes={sizes}
      />
    </div>
  );
}

export function FiturSection() {
  const [activeTabId, setActiveTabId] = useState(FEATURE_TABS[0].id);
  const activeTab =
    FEATURE_TABS.find((tab) => tab.id === activeTabId) || FEATURE_TABS[0];

  return (
    <SectionWrapper id="fitur" bg="white">
      <SectionHeader
        tag="FITUR"
        title="Yang dibuka kasir dan pemilik setiap hari."
        subtitle="Semua gambar di bagian ini adalah layar asli aplikasi, bukan ilustrasi."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Daftar tab */}
        <div className="lg:col-span-4 flex flex-col gap-1 w-full">
          {FEATURE_TABS.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div key={tab.id}>
                <button
                  type="button"
                  onClick={() => setActiveTabId(tab.id)}
                  aria-expanded={isActive}
                  className={`w-full text-left transition-colors rounded-[10px] cursor-pointer ${
                    isActive
                      ? "bg-[#fef1eb] p-5"
                      : "px-5 py-3.5 hover:bg-[#f3f6f5]"
                  }`}
                >
                  <h3
                    className={`text-[17px] ${
                      isActive
                        ? "font-semibold text-[#292e31]"
                        : "font-medium text-[#525866]"
                    }`}
                  >
                    {tab.name}
                  </h3>
                  {isActive && (
                    <p className="mt-2 text-[15px] text-[#525866] leading-relaxed">
                      {tab.summary}
                    </p>
                  )}
                </button>
                {/* Di HP gambar tampil langsung di bawah tab yang aktif */}
                {isActive && (
                  <div className="lg:hidden mt-3 mb-4">
                    <Screen tab={tab} sizes="100vw" />
                  </div>
                )}
              </div>
            );
          })}
          <Link
            href="/fitur"
            className="mt-4 px-5 text-[15px] font-semibold text-[#be5823] hover:text-[#f1702c]"
          >
            Lihat semua fitur →
          </Link>
        </div>

        {/* Pratinjau desktop */}
        <div className="hidden lg:block lg:col-span-8 rounded-[20px] bg-[#f3f6f5] p-8">
          <Screen tab={activeTab} sizes="760px" />
        </div>
      </div>
    </SectionWrapper>
  );
}
