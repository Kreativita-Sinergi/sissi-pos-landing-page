import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/shared/Container";
import { FOOTER_SECTIONS } from "@/constants/navigation";
import { SUPPORT_WHATSAPP_URL } from "@/constants/site";

export function Footer() {
  return (
    <footer className="bg-white border-t border-[#e4e9e7] pt-16 pb-10">
      <Container>
        {/* Top Part: Logo/Tagline on Left (300px), 4 Columns on Right (gap: 64px) */}
        <div className="flex flex-col lg:flex-row lg:justify-between gap-12 pb-14 border-b border-[#e4e9e7]">
          {/* Brand info */}
          <div className="flex flex-col items-start gap-4 max-w-[340px]">
            <Link href="/" className="inline-block relative h-[30px] w-[91px]">
              <Image
                src="/logos/sissi-navbar-logo-dark.svg"
                alt="Sissi"
                fill
                className="object-contain object-left"
              />
            </Link>
            <p className="text-[15px] text-[#525866] leading-relaxed">
              Aplikasi kasir Android untuk kuliner, ritel, jasa, dan penyewaan. Tetap jalan saat internet putus.
            </p>
          </div>

          {/* Links columns - 4 columns with gap 64px in Figma */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 lg:gap-16">
            {FOOTER_SECTIONS.map((section) => (
              <div key={section.title} className="flex flex-col gap-3">
                <h3 className="text-[14px] font-semibold text-[#292e31]">
                  {section.title}
                </h3>
                <ul className="flex flex-col gap-3">
                  {section.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-[15px] font-normal text-[#525866] hover:text-[#292e31] transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom copyright and social icons */}
        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] font-medium font-mono text-[#7d8986]">
            © 2026 Sissi
          </p>

          <div className="flex items-center gap-4 text-[#525866]">
            {/* Instagram */}
            <Link
              href="https://www.instagram.com/sissi.indonesia/"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Instagram"
            >
              <div className="relative w-5 h-5">
                <Image
                  src="/logos/instagram.svg"
                  alt="Instagram"
                  fill
                  className="object-contain"
                />
              </div>
            </Link>
            {/* TikTok: disembunyikan dulu (keputusan pemilik 2026-10-12) */}
            {/* YouTube */}
            <Link
              href="https://www.youtube.com/@SissiKreatifTeknologi"
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-70 hover:opacity-100 transition-opacity"
              aria-label="YouTube"
            >
              <div className="relative w-5 h-5">
                <Image
                  src="/logos/youtube.svg"
                  alt="YouTube"
                  fill
                  className="object-contain"
                />
              </div>
            </Link>
            {/* WhatsApp */}
            <Link
              href={SUPPORT_WHATSAPP_URL}
              className="opacity-70 hover:opacity-100 transition-opacity"
              aria-label="WhatsApp"
            >
              <div className="relative w-5 h-5">
                <Image
                  src="/logos/whatsapp.svg"
                  alt="WhatsApp"
                  fill
                  className="object-contain"
                />
              </div>
            </Link>
          </div>
        </div>
      </Container>
    </footer>
  );
}
