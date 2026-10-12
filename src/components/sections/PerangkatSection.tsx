import React from "react";
import Image from "next/image";
import { SectionWrapper } from "@/components/shared/SectionWrapper";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { MIN_ANDROID } from "@/constants/site";

const DEVICES = [
  {
    name: "Tablet Android",
    description:
      "Layar kasir utama. Daftar menu dan pesanan berdampingan, cocok di meja kasir kafe atau resto.",
  },
  {
    name: "HP Android",
    description:
      "Cukup untuk warung dan gerobak. Pemilik juga bisa memantau laporan dan menerima notifikasi dari HP.",
  },
  {
    name: "Beberapa perangkat sekaligus",
    description:
      "Kasir di tablet, dapur di tablet lain, pemilik di HP. Semua tersinkron ke outlet yang sama.",
  },
  {
    name: "Printer & scanner",
    description:
      "Printer thermal jaringan (LAN/Wi-Fi) 58 atau 80 mm. Scanner barcode mode keyboard, atau kamera HP untuk memindai.",
  },
];

export function PerangkatSection() {
  return (
    <SectionWrapper id="perangkat" bg="white">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
        <div className="lg:col-span-7">
          <SectionHeader
            tag="PERANGKAT"
            title="Pakai HP atau tablet yang sudah ada."
            subtitle={`Tidak perlu mesin kasir khusus. Sissi berjalan di ${MIN_ANDROID} atau lebih baru.`}
            className="!mb-10"
          />

          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-8">
            {DEVICES.map((device) => (
              <div key={device.name} className="border-t-2 border-[#f1702c] pt-4">
                <dt className="text-[18px] font-semibold text-[#292e31]">
                  {device.name}
                </dt>
                <dd className="mt-2 text-[15px] text-[#525866] leading-relaxed">
                  {device.description}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Dua HP: kasir & laporan (layar asli) */}
        <div className="lg:col-span-5 flex justify-center gap-4 sm:gap-6">
          {[
            {
              src: "/images/app/kasir-hp.webp",
              alt: "Layar Kasir Sissi di HP dengan daftar menu dan ringkasan 5 item Rp117.810.",
            },
            {
              src: "/images/app/laporan-hp.webp",
              alt: "Layar Laporan Sissi di HP dengan wawasan periode, omzet, dan laba kotor.",
            },
          ].map((shot, idx) => (
            <div
              key={shot.src}
              className={`w-[46%] max-w-[230px] ${idx === 1 ? "mt-10 sm:mt-16" : ""}`}
            >
              <div className="rounded-[22px] sm:rounded-[30px] bg-[#1b2022] p-[5px] sm:p-[7px] shadow-[0_20px_44px_-18px_rgba(41,46,49,0.5)]">
                <div className="overflow-hidden rounded-[17px] sm:rounded-[24px] bg-white">
                  <Image
                    src={shot.src}
                    alt={shot.alt}
                    width={390}
                    height={844}
                    sizes="(max-width: 640px) 46vw, 230px"
                    className="block w-full h-auto"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SectionWrapper>
  );
}
