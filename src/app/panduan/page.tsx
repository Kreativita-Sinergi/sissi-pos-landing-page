import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { ArrowRight } from "lucide-react";
import { GUIDES, GUIDE_CATEGORIES, START_HERE_SLUGS, getGuide, guideSearchText } from "@/constants/guides";
import { GuideBrowser } from "@/components/guides/GuideBrowser";

export const metadata: Metadata = {
  title: "Panduan Pemakaian · Sissi POS",
  description:
    "Panduan langkah demi langkah memakai aplikasi kasir Sissi POS: daftar & setup perangkat, produk dan varian, pesanan & meja, pembayaran, shift kas, stok, laporan, tim, dan bekerja offline.",
  alternates: { canonical: "/panduan" },
};

export default function PanduanPage() {
  const startHere = START_HERE_SLUGS.map((slug) => getGuide(slug)).filter(
    (g): g is NonNullable<typeof g> => Boolean(g),
  );

  const summaries = GUIDES.map((guide) => ({
    slug: guide.slug,
    category: guide.category,
    title: guide.title,
    description: guide.description,
    audience: guide.audience,
    searchText: guideSearchText(guide),
  }));

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f3f6f5]">
      <Navbar isLight />

      <main className="flex-1 pt-24 sm:pt-28 pb-20">
        <section className="pt-8 pb-8 sm:pt-12 sm:pb-10">
          <Container>
            <div className="max-w-3xl">
              <p className="text-[12px] font-mono uppercase tracking-wider text-[#c2561d]">
                Pusat panduan
              </p>
              <h1 className="mt-2 text-[30px] sm:text-[44px] font-semibold leading-[1.12] tracking-tight text-[#292e31]">
                Cara pakai Sissi POS
              </h1>
              <p className="mt-3 text-[16px] sm:text-[18px] leading-relaxed text-[#525866]">
                Langkah demi langkah untuk pemilik dan kasir, dari daftar akun sampai tutup kasir. Nama tombol
                dan menu di sini sama dengan yang tertulis di aplikasi.
              </p>
            </div>
          </Container>
        </section>

        {/* Mulai dari sini */}
        <section className="pb-10">
          <Container>
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[#7d8986]">
              Baru pertama kali? Mulai dari sini
            </h2>
            <ol className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              {startHere.map((guide, i) => (
                <li key={guide.slug}>
                  <Link
                    href={`/panduan/${guide.slug}`}
                    className="group flex h-full gap-3 rounded-[14px] border border-[#e4e9e7] bg-white p-4 sm:p-5 transition-colors hover:border-[#f1702c]/60"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#fef1eb] font-mono text-[13px] font-semibold text-[#c2561d]">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold leading-snug text-[#292e31] group-hover:text-[#c2561d]">
                        {guide.title}
                      </span>
                      <span className="mt-1 block text-[14px] leading-relaxed text-[#525866]">
                        {guide.description}
                      </span>
                    </span>
                    <ArrowRight
                      size={16}
                      className="mt-1 shrink-0 text-[#b0b8b5] group-hover:text-[#f1702c]"
                    />
                  </Link>
                </li>
              ))}
            </ol>
          </Container>
        </section>

        {/* Semua panduan */}
        <section>
          <Container>
            <div className="max-w-4xl">
              <GuideBrowser
                categories={GUIDE_CATEGORIES.map(({ id, label, description }) => ({ id, label, description }))}
                guides={summaries}
              />
            </div>
          </Container>
        </section>
      </main>

      <Footer />
    </div>
  );
}
