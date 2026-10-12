import React from "react";
import { X, Check } from "lucide-react";
import { SectionWrapper } from "@/components/shared/SectionWrapper";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { COMPARISON_DATA } from "@/constants/comparison";

export function SebelumSesudahSection() {
  return (
    <SectionWrapper id="sebelum-sesudah" bg="muted">
      <SectionHeader
        tag="SEBELUM DAN SESUDAH"
        title="Yang berubah setelah pakai Sissi."
        subtitle="Pekerjaan yang biasanya pakai buku, kalkulator, dan chat grup."
      />

      {/* Clean Comparison Card matching Figma */}
      <div className="bg-white rounded-[16px] border border-[#e4e9e7] shadow-sm overflow-hidden max-w-full">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 px-8 py-4 bg-[#f3f6f5]/50 border-b border-[#e4e9e7] text-[12px] font-medium font-mono tracking-wider uppercase text-[#7d8986]">
          <div className="col-span-4">PEKERJAAN</div>
          <div className="col-span-4">SEBELUMNYA</div>
          <div className="col-span-4 text-[#292e31]">DENGAN SISSI</div>
        </div>

        {/* Rows */}
        <div className="divide-y divide-[#e4e9e7]">
          {COMPARISON_DATA.map((row) => (
            <div
              key={row.task}
              className="px-6 md:px-8 py-4.5 md:py-4 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center hover:bg-[#f3f6f5]/30 transition-colors"
            >
              {/* Task */}
              <div className="md:col-span-4">
                <span className="text-[11px] font-medium font-mono uppercase tracking-wider text-[#7d8986] md:hidden block mb-1">
                  Pekerjaan
                </span>
                <span className="text-[16px] font-semibold text-[#292e31]">
                  {row.task}
                </span>
              </div>

              {/* Previously with X icon (#b0b8b5) */}
              <div className="md:col-span-4 flex flex-wrap md:flex-nowrap items-start gap-x-2.5">
                <span className="text-[11px] font-medium font-mono uppercase tracking-wider text-[#7d8986] md:hidden block w-full mb-1">
                  Sebelumnya
                </span>
                <X size={16} className="text-[#b0b8b5] shrink-0 stroke-[2] mt-1" />
                <span className="flex-1 min-w-0 text-[16px] font-normal text-[#7d8986]">
                  {row.before}
                </span>
              </div>

              {/* With Sissi with Check icon (#f1702c) */}
              <div className="md:col-span-4 flex flex-wrap md:flex-nowrap items-start gap-x-2.5">
                <span className="text-[11px] font-medium font-mono uppercase tracking-wider text-[#f1702c] md:hidden block w-full mb-1">
                  Dengan Sissi
                </span>
                <Check size={18} className="text-[#f1702c] shrink-0 stroke-[2.2] mt-0.5" />
                <span className="flex-1 min-w-0 text-[16px] font-medium text-[#292e31]">
                  {row.after}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
