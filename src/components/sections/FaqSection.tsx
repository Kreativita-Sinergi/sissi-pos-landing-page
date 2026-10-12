"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Plus, Minus } from "lucide-react";
import { SectionWrapper } from "@/components/shared/SectionWrapper";
import { FAQ_ITEMS } from "@/constants/faq";
import { SUPPORT_WHATSAPP_URL } from "@/constants/site";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(1); // 2nd open in Figma

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <SectionWrapper id="faq" bg="muted">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
        {/* Left Column: Heading + WhatsApp Button (380px in Figma, rata atas) */}
        <div className="lg:col-span-5 flex flex-col items-start max-w-[380px]">
          <span className="text-[13px] font-medium font-mono tracking-wider uppercase text-[#f1702c] mb-2">
            FAQ
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[44px] font-semibold text-[#292e31] tracking-tight leading-[1.12]">
            Pertanyaan yang sering masuk.
          </h2>

          <Link
            href={SUPPORT_WHATSAPP_URL}
            className="mt-8 h-[38px] px-4 rounded-[8px] bg-white border border-[#e4e9e7] hover:border-[#b0b8b5] text-[#292e31] text-[14px] font-medium inline-flex items-center gap-2 transition-colors shadow-2xs cursor-pointer"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="shrink-0 text-[#292e31]"
            >
              <path
                d="M9.02961 1.50004C4.93461 1.50004 1.59711 4.83754 1.59711 8.93254C1.59711 10.245 1.94211 11.52 2.58711 12.645L1.53711 16.5L5.47461 15.465C6.56211 16.0575 7.78461 16.3725 9.02961 16.3725C13.1246 16.3725 16.4621 13.035 16.4621 8.94004C16.4621 6.95254 15.6896 5.08504 14.2871 3.68254C13.5994 2.98812 12.7804 2.43752 11.8777 2.06281C10.9751 1.68811 10.0069 1.4968 9.02961 1.50004ZM9.03711 2.75254C10.6871 2.75254 12.2321 3.39754 13.4021 4.56754C13.9761 5.14168 14.4313 5.82342 14.7414 6.57373C15.0516 7.32403 15.2107 8.12816 15.2096 8.94004C15.2096 12.345 12.4346 15.1125 9.02961 15.1125C7.91961 15.1125 6.83211 14.82 5.88711 14.25L5.66211 14.1225L3.32211 14.7375L3.94461 12.4575L3.79461 12.2175C3.17552 11.2338 2.84786 10.0948 2.84961 8.93254C2.85711 5.52754 5.62461 2.75254 9.03711 2.75254ZM6.39711 5.49754C6.27711 5.49754 6.07461 5.54254 5.90211 5.73004C5.73711 5.91754 5.24961 6.37504 5.24961 7.28254C5.24961 8.19754 5.91711 9.07504 5.99961 9.20254C6.10461 9.33004 7.31961 11.205 9.18711 12C9.62961 12.2025 9.97461 12.315 10.2446 12.3975C10.6871 12.54 11.0921 12.5175 11.4146 12.4725C11.7746 12.42 12.5096 12.0225 12.6671 11.5875C12.8246 11.1525 12.8246 10.785 12.7796 10.7025C12.7271 10.6275 12.6071 10.5825 12.4196 10.5C12.2321 10.395 11.3171 9.94504 11.1521 9.88504C10.9796 9.82504 10.8746 9.79504 10.7321 9.97504C10.6121 10.1625 10.2521 10.5825 10.1471 10.7025C10.0346 10.83 9.92961 10.845 9.74961 10.755C9.55461 10.6575 8.95461 10.4625 8.24961 9.83254C7.69461 9.33754 7.32711 8.73004 7.21461 8.54254C7.12461 8.36254 7.20711 8.25004 7.29711 8.16754C7.37961 8.08504 7.49961 7.95004 7.57461 7.83754C7.67211 7.73254 7.70211 7.65004 7.76211 7.53004C7.82211 7.40254 7.79211 7.29754 7.74711 7.20754C7.70211 7.12504 7.32711 6.19504 7.16961 5.82754C7.01961 5.46754 6.86961 5.51254 6.74961 5.50504C6.64461 5.50504 6.52461 5.49754 6.39711 5.49754Z"
                fill="currentColor"
              />
            </svg>
            <span>Tanya lewat WhatsApp</span>
          </Link>
        </div>

        {/* Right Column: Accordion List (720px in Figma) */}
        <div className="lg:col-span-7 flex flex-col gap-3 w-full max-w-[720px]">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={item.question}
                className="bg-white rounded-[12px] px-6 py-5 shadow-2xs transition-all"
              >
                {/* Question row: items-start (rata atas) */}
                <button
                  type="button"
                  onClick={() => toggleAccordion(idx)}
                  className="w-full text-left flex items-start justify-between gap-4 text-[17px] font-medium text-[#292e31] hover:text-[#f1702c] transition-colors cursor-pointer select-none"
                  aria-expanded={isOpen}
                >
                  <span className="leading-snug">{item.question}</span>
                  <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5 text-[#7d8986]">
                    {isOpen ? <Minus size={20} /> : <Plus size={20} />}
                  </div>
                </button>

                {/* Smooth animated accordion drawer */}
                <div
                  className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                    isOpen
                      ? "grid-rows-[1fr] opacity-100"
                      : "grid-rows-[0fr] opacity-0"
                  }`}
                >
                  <div className="overflow-hidden">
                    <p className="pt-2.5 text-[15px] font-normal text-[#525866] leading-relaxed max-w-[640px]">
                      {item.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
}
