import React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SectionWrapper } from "@/components/shared/SectionWrapper";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { BUSINESS_TYPES } from "@/constants/businessTypes";

export function UntukUsahaSection() {
  return (
    <SectionWrapper id="untuk-usaha" bg="muted">
      <SectionHeader
        tag="UNTUK USAHA"
        title="Satu aplikasi, empat cara berjualan."
        subtitle="Pilih jenis usaha saat daftar. Menu dan istilah di aplikasi menyesuaikan: kuliner punya Meja dan Dapur, jasa punya Antrean servis, penyewaan punya Jadwal dan Sesi."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {BUSINESS_TYPES.map((biz) => (
          <Link
            key={biz.id}
            href={`/untuk-usaha/${biz.id}`}
            className="group flex flex-col justify-between p-6 rounded-[16px] bg-white border border-[#e4e9e7] hover:border-[#f1702c] transition-colors"
          >
            <div>
              <h3 className="text-[22px] font-semibold text-[#292e31]">
                {biz.name}
              </h3>
              <p className="mt-1.5 text-[15px] text-[#525866] leading-relaxed">
                {biz.description}
              </p>

              <p className="mt-5 px-3.5 py-3 rounded-[10px] bg-[#f3f6f5] text-[14px] font-mono text-[#292e31] leading-relaxed">
                {biz.example}
              </p>

              <div className="mt-5">
                <span className="block text-[11px] font-medium font-mono tracking-wider uppercase text-[#7d8986] mb-1.5">
                  Cocok untuk
                </span>
                <p className="text-[14px] text-[#292e31] leading-relaxed">
                  {biz.suitableFor}
                </p>
              </div>
            </div>

            <span className="mt-6 flex items-center justify-between text-[14px] font-semibold text-[#be5823]">
              <span>Sissi untuk {biz.name.toLowerCase()}</span>
              <ArrowRight
                size={16}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </span>
          </Link>
        ))}
      </div>
    </SectionWrapper>
  );
}
