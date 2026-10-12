import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { ArrowLeft, ArrowRight, ChevronRight, Smartphone, Tablet } from "lucide-react";
import { GUIDES, getGuide, getCategory, orderedGuides } from "@/constants/guides";
import { GuideScreenshot } from "@/components/guides/GuideScreenshot";
import { GuideCallout } from "@/components/guides/GuideCallout";

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) {
    return { title: "Panduan tidak ditemukan · Sissi POS" };
  }
  return {
    title: `${guide.title} · Panduan Sissi POS`,
    description: guide.description,
    alternates: { canonical: `/panduan/${guide.slug}` },
  };
}

export default async function GuideDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const category = getCategory(guide.category);

  // Urutan baca mengikuti urutan kategori lalu urutan di daftar.
  const ordered = orderedGuides();
  const index = ordered.findIndex((g) => g.slug === guide.slug);
  const prev = index > 0 ? ordered[index - 1] : undefined;
  const next = index < ordered.length - 1 ? ordered[index + 1] : undefined;

  const related = guide.relatedSlugs
    .map((relatedSlug) => getGuide(relatedSlug))
    .filter((g): g is NonNullable<typeof g> => Boolean(g));

  const tocItems = [
    ...guide.steps.map((step, i) => ({ id: step.id, label: `${i + 1}. ${step.title}` })),
    ...(guide.faqs && guide.faqs.length > 0 ? [{ id: "tanya-jawab", label: "Tanya jawab" }] : []),
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f3f6f5]">
      <Navbar isLight />

      <main className="flex-1 pt-24 sm:pt-28 pb-20">
        {/* Remah roti */}
        <Container>
          <nav
            aria-label="Remah roti"
            className="flex items-center gap-1.5 overflow-x-auto py-3 text-[13px] text-[#7d8986] whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <Link href="/panduan" className="hover:text-[#292e31]">
              Panduan
            </Link>
            <ChevronRight size={13} className="shrink-0 text-[#b0b8b5]" />
            <Link href={`/panduan#topik-${category.id}`} className="hover:text-[#292e31]">
              {category.label}
            </Link>
          </nav>
        </Container>

        {/* Kepala */}
        <header className="border-y border-[#e4e9e7] bg-white">
          <Container>
            <div className="max-w-3xl py-8 sm:py-10">
              <p className="text-[12px] font-mono uppercase tracking-wider text-[#c2561d]">
                {category.label}
              </p>
              <h1 className="mt-2 text-[28px] sm:text-[40px] font-semibold leading-[1.15] tracking-tight text-[#292e31]">
                {guide.title}
              </h1>
              <p className="mt-3 text-[16px] sm:text-[18px] leading-relaxed text-[#525866]">
                {guide.overview}
              </p>
              <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-[#7d8986]">
                <span>Untuk: {guide.audience.join(", ")}</span>
                <span>± {guide.readMinutes} menit baca</span>
                <span>Diperbarui {guide.lastUpdated}</span>
              </p>

              {guide.prerequisites && guide.prerequisites.length > 0 && (
                <div className="mt-6 rounded-[12px] border border-[#e4e9e7] bg-[#f8faf9] p-4 sm:p-5">
                  <p className="text-[14px] font-semibold text-[#292e31]">Sebelum mulai</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-[#525866] marker:text-[#b0b8b5]">
                    {guide.prerequisites.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </Container>
        </header>

        <Container>
          <div className="grid grid-cols-1 gap-8 py-8 sm:py-10 lg:grid-cols-12 lg:gap-12">
            {/* Daftar isi */}
            <aside className="lg:col-span-4 lg:order-2">
              {/* HP: bisa dilipat */}
              <details className="group rounded-[12px] border border-[#e4e9e7] bg-white lg:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-[14px] font-semibold text-[#292e31] [&::-webkit-details-marker]:hidden">
                  Isi halaman ({tocItems.length})
                  <ChevronRight size={16} className="text-[#7d8986] transition-transform group-open:rotate-90" />
                </summary>
                <TocList items={tocItems} className="border-t border-[#e4e9e7] px-2 py-2" />
              </details>

              {/* Layar lebar: menempel */}
              <div className="sticky top-28 hidden lg:block">
                <p className="px-3 text-[12px] font-mono uppercase tracking-wider text-[#7d8986]">
                  Isi halaman
                </p>
                <TocList items={tocItems} className="mt-2" />
                <div className="mt-6 border-t border-[#e4e9e7] px-3 pt-4 text-[13px] leading-relaxed text-[#525866]">
                  Masih bingung? Lihat{" "}
                  <Link
                    href="/panduan/tanya-jawab-masalah-umum"
                    className="font-semibold text-[#c2561d] hover:underline underline-offset-2"
                  >
                    Tanya jawab masalah umum
                  </Link>
                  .
                </div>
              </div>
            </aside>

            {/* Isi */}
            <div className="min-w-0 space-y-6 lg:col-span-8 lg:order-1">
              {guide.steps.map((step, i) => (
                <section
                  key={step.id}
                  id={step.id}
                  className="scroll-mt-28 rounded-[16px] border border-[#e4e9e7] bg-white p-5 sm:p-8"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f1702c] font-mono text-[14px] font-semibold text-white">
                      {i + 1}
                    </span>
                    <h2 className="pt-0.5 text-[20px] sm:text-[24px] font-semibold leading-snug text-[#292e31]">
                      {step.title}
                    </h2>
                  </div>

                  <div className="mt-3 sm:pl-11">
                    {step.description && (
                      <p className="text-[15px] sm:text-[16px] leading-relaxed text-[#525866]">
                        {step.description}
                      </p>
                    )}

                    {step.steps && step.steps.length > 0 && (
                      <ol className="mt-4 space-y-2.5">
                        {step.steps.map((item, n) => (
                          <li key={n} className="flex gap-3 text-[15px] leading-relaxed text-[#292e31]">
                            <span className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-[#fef1eb] font-mono text-[12px] font-semibold text-[#c2561d]">
                              {n + 1}
                            </span>
                            <span className="min-w-0">{item}</span>
                          </li>
                        ))}
                      </ol>
                    )}

                    {step.points && step.points.length > 0 && (
                      <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[15px] leading-relaxed text-[#525866] marker:text-[#f1702c]">
                        {step.points.map((point, n) => (
                          <li key={n}>{point}</li>
                        ))}
                      </ul>
                    )}

                    {step.devices && (
                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {step.devices.hp && (
                          <DeviceNote icon={<Smartphone size={15} />} label="Di HP" text={step.devices.hp} />
                        )}
                        {step.devices.tablet && (
                          <DeviceNote icon={<Tablet size={15} />} label="Di tablet" text={step.devices.tablet} />
                        )}
                      </div>
                    )}

                    {step.image && <GuideScreenshot image={step.image} priority={i === 0} />}

                    {step.callout && <GuideCallout callout={step.callout} />}
                  </div>
                </section>
              ))}

              {guide.faqs && guide.faqs.length > 0 && (
                <section
                  id="tanya-jawab"
                  className="scroll-mt-28 rounded-[16px] border border-[#e4e9e7] bg-white p-5 sm:p-8"
                >
                  <h2 className="text-[20px] sm:text-[24px] font-semibold text-[#292e31]">Tanya jawab</h2>
                  <div className="mt-4 divide-y divide-[#e4e9e7]">
                    {guide.faqs.map((faq) => (
                      <div key={faq.question} className="py-4 first:pt-0 last:pb-0">
                        <h3 className="text-[15px] font-semibold text-[#292e31]">{faq.question}</h3>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-[#525866]">{faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Sebelumnya / berikutnya */}
              <nav aria-label="Panduan lain" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {prev ? (
                  <Link
                    href={`/panduan/${prev.slug}`}
                    className="group rounded-[12px] border border-[#e4e9e7] bg-white p-4 hover:border-[#f1702c]/60"
                  >
                    <span className="flex items-center gap-1 text-[12px] text-[#7d8986]">
                      <ArrowLeft size={13} /> Sebelumnya
                    </span>
                    <span className="mt-1 block text-[15px] font-semibold text-[#292e31] group-hover:text-[#c2561d]">
                      {prev.title}
                    </span>
                  </Link>
                ) : (
                  <span className="hidden sm:block" />
                )}
                {next && (
                  <Link
                    href={`/panduan/${next.slug}`}
                    className="group rounded-[12px] border border-[#e4e9e7] bg-white p-4 text-right hover:border-[#f1702c]/60"
                  >
                    <span className="flex items-center justify-end gap-1 text-[12px] text-[#7d8986]">
                      Berikutnya <ArrowRight size={13} />
                    </span>
                    <span className="mt-1 block text-[15px] font-semibold text-[#292e31] group-hover:text-[#c2561d]">
                      {next.title}
                    </span>
                  </Link>
                )}
              </nav>

              {related.length > 0 && (
                <section>
                  <h2 className="text-[16px] font-semibold text-[#292e31]">Baca juga</h2>
                  <ul className="mt-3 overflow-hidden rounded-[12px] border border-[#e4e9e7] bg-white divide-y divide-[#e4e9e7]">
                    {related.map((rel) => (
                      <li key={rel.slug}>
                        <Link
                          href={`/panduan/${rel.slug}`}
                          className="group flex items-center justify-between gap-3 px-4 py-3 text-[15px] text-[#292e31] hover:bg-[#fffaf7]"
                        >
                          <span className="min-w-0 group-hover:text-[#c2561d]">{rel.title}</span>
                          <ArrowRight size={15} className="shrink-0 text-[#b0b8b5] group-hover:text-[#f1702c]" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <Link
                href="/panduan"
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#525866] hover:text-[#292e31]"
              >
                <ArrowLeft size={16} />
                Semua panduan
              </Link>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

function TocList({ items, className = "" }: { items: { id: string; label: string }[]; className?: string }) {
  return (
    <ul className={`space-y-0.5 ${className}`}>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="block rounded-[8px] px-3 py-2 text-[14px] leading-snug text-[#525866] hover:bg-[#fffaf7] hover:text-[#c2561d]"
          >
            {item.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function DeviceNote({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="rounded-[10px] border border-[#e4e9e7] bg-[#f8faf9] p-3.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-[#292e31]">
        <span className="text-[#c2561d]">{icon}</span>
        {label}
      </p>
      <p className="mt-1 text-[14px] leading-relaxed text-[#525866]">{text}</p>
    </div>
  );
}
