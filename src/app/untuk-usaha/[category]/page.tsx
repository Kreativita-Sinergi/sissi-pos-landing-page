import React from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { AjakanSection } from "@/components/sections/AjakanSection";
import { GooglePlayIcon } from "@/components/shared/GooglePlayIcon";
import { USAHA_SUBPAGES } from "@/constants/usahaSubpages";
import { PLAY_STORE_URL } from "@/constants/site";

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateStaticParams() {
  return Object.keys(USAHA_SUBPAGES).map((category) => ({
    category,
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const data = USAHA_SUBPAGES[category];
  if (!data) return { title: "Untuk usaha · Sissi POS" };

  return {
    title: `${data.title} · Sissi POS`,
    description: data.subtitle,
  };
}

export default async function UsahaCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const data = USAHA_SUBPAGES[category];

  if (!data) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col w-full bg-white">
      <Navbar isLight />

      <main className="flex-1 pt-28">
        {/* 1. Kepala + layar asli */}
        <section className="py-12 sm:py-16">
          <Container>
            <div className="max-w-4xl">
              <span className="text-[13px] font-medium font-mono tracking-wider uppercase text-[#be5823] mb-3 block">
                Untuk usaha · {data.name}
              </span>
              <h1 className="text-[36px] sm:text-5xl lg:text-[60px] font-semibold text-[#292e31] tracking-tight leading-[1.1]">
                {data.title}
              </h1>
              <p className="mt-5 text-[17px] sm:text-[19px] text-[#525866] leading-relaxed max-w-2xl">
                {data.subtitle}
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {data.suitablePills.map((pill) => (
                  <span
                    key={pill}
                    className="px-3 py-1.5 rounded-[8px] bg-[#f3f6f5] border border-[#e4e9e7] text-[13px] font-medium text-[#292e31]"
                  >
                    {pill}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <a
                  href={PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-[50px] px-6 bg-[#be5823] hover:bg-[#f1702c] text-white text-[15px] font-semibold rounded-[10px] inline-flex items-center justify-center gap-2.5 transition-colors"
                >
                  <GooglePlayIcon />
                  <span>Unduh di Google Play</span>
                </a>
                <Link
                  href="/panduan"
                  className="h-[50px] px-6 bg-white hover:bg-[#f3f6f5] border border-[#e4e9e7] text-[#292e31] text-[15px] font-medium rounded-[10px] inline-flex items-center justify-center transition-colors"
                >
                  Lihat panduan
                </Link>
              </div>
            </div>

            <div className="mt-12 sm:mt-16 overflow-hidden rounded-[16px] border border-[#e4e9e7] shadow-[0_20px_50px_-24px_rgba(41,46,49,0.4)]">
              <Image
                src={data.image}
                alt={data.imageAlt}
                width={1280}
                height={800}
                preload
                className="block w-full h-auto"
                sizes="(max-width: 1440px) 100vw, 1200px"
              />
            </div>
            <p className="mt-3 text-[13px] font-mono text-[#7d8986]">
              Layar asli aplikasi
            </p>
          </Container>
        </section>

        {/* 2. Masalah sehari-hari */}
        <section className="py-16 sm:py-24 bg-[#f3f6f5]">
          <Container>
            <h2 className="text-3xl sm:text-[42px] font-semibold text-[#292e31] tracking-tight leading-tight max-w-2xl mb-10 sm:mb-12">
              Yang sering terjadi, dan cara Sissi menanganinya
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-10">
              {data.problems.map((prob, idx) => (
                <div key={prob.title} className="border-t-2 border-[#f1702c] pt-5">
                  <span className="text-[13px] font-mono font-medium text-[#be5823]">
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <h3 className="mt-2 text-[19px] font-semibold text-[#292e31]">
                    {prob.title}
                  </h3>
                  <p className="mt-2 text-[15px] text-[#525866] leading-relaxed">
                    {prob.description}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* 3. Layar & perangkat */}
        <section className="py-16 sm:py-24">
          <Container>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-20">
              <div>
                <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#292e31] tracking-tight leading-tight mb-6">
                  Layar yang paling sering dibuka
                </h2>
                <dl className="flex flex-col divide-y divide-[#e4e9e7]">
                  {data.screens.map((screen) => (
                    <div key={screen.title} className="py-4">
                      <dt className="text-[17px] font-semibold text-[#292e31]">
                        {screen.title}
                      </dt>
                      <dd className="mt-1 text-[15px] text-[#525866] leading-relaxed">
                        {screen.description}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div>
                <h2 className="text-[26px] sm:text-[32px] font-semibold text-[#292e31] tracking-tight leading-tight mb-6">
                  Perangkat yang disarankan
                </h2>
                <dl className="flex flex-col divide-y divide-[#e4e9e7]">
                  {data.devices.map((dev) => (
                    <div key={dev.title} className="py-4">
                      <dt className="text-[17px] font-semibold text-[#292e31]">
                        {dev.title}
                      </dt>
                      <dd className="mt-1 text-[15px] text-[#525866] leading-relaxed">
                        {dev.description}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-4 text-[14px] text-[#7d8986]">
                  Tidak perlu beli semuanya di awal. Mulai dengan HP atau tablet
                  yang sudah ada.
                </p>
              </div>
            </div>
          </Container>
        </section>

        <AjakanSection />
      </main>

      <Footer />
    </div>
  );
}
