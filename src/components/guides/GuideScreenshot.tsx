import React from "react";
import Image from "next/image";
import type { GuideImage } from "@/constants/guides";

const DEVICE_LABEL: Record<GuideImage["device"], string> = {
  hp: "Tampilan HP",
  tablet: "Tampilan tablet",
};

/**
 * Tangkapan layar asli aplikasi. HP ditampilkan sempit (potret), tablet selebar kolom (lanskap).
 * Tanpa bingkai perangkat palsu: cukup tepi tipis agar gambar terbaca sebagai layar.
 */
export function GuideScreenshot({ image, priority = false }: { image: GuideImage; priority?: boolean }) {
  const isPhone = image.device === "hp";
  return (
    <figure className={`my-6 ${isPhone ? "mx-auto max-w-[260px] sm:mx-0" : ""}`}>
      <div
        className={`overflow-hidden border border-[#d5dcda] bg-[#f3f6f5] ${
          isPhone ? "rounded-[22px]" : "rounded-[12px]"
        }`}
      >
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={isPhone ? "260px" : "(max-width: 1024px) 100vw, 720px"}
          className="block h-auto w-full"
          priority={priority}
        />
      </div>
      <figcaption className="mt-2.5 text-[13px] leading-snug text-[#525866]">
        <span className="font-mono text-[11px] uppercase tracking-wider text-[#7d8986]">
          {DEVICE_LABEL[image.device]}
        </span>
        <span className="mx-1.5 text-[#c6cfcd]">·</span>
        {image.caption}
      </figcaption>
    </figure>
  );
}
