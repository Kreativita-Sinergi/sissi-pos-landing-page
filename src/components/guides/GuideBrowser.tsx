"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";

export interface GuideCategorySummary {
  id: string;
  label: string;
  description: string;
}

export interface GuideSummary {
  slug: string;
  category: string;
  title: string;
  description: string;
  audience: string[];
  searchText: string;
}

interface GuideBrowserProps {
  categories: GuideCategorySummary[];
  guides: GuideSummary[];
}

const ALL = "semua";

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function GuideBrowser({ categories, guides }: GuideBrowserProps) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<string>(ALL);

  const trimmed = query.trim();

  const filtered = useMemo(() => {
    const words = normalize(trimmed).split(/\s+/).filter(Boolean);
    return guides.filter((guide) => {
      if (active !== ALL && guide.category !== active) return false;
      if (words.length === 0) return true;
      const haystack = normalize(guide.searchText);
      return words.every((word) => haystack.includes(word));
    });
  }, [guides, trimmed, active]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const guide of guides) map[guide.category] = (map[guide.category] ?? 0) + 1;
    return map;
  }, [guides]);

  const groups = categories
    .map((category) => ({
      category,
      items: filtered.filter((guide) => guide.category === category.id),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div>
      {/* Pencarian */}
      <div className="relative">
        <label htmlFor="cari-panduan" className="sr-only">
          Cari panduan
        </label>
        <Search
          size={18}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7d8986]"
        />
        <input
          id="cari-panduan"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cari, mis. QRIS, varian, tutup kasir, offline"
          autoComplete="off"
          className="h-12 w-full rounded-[12px] border border-[#d5dcda] bg-white pl-11 pr-11 text-[15px] text-[#292e31] placeholder:text-[#9aa5a2] outline-none transition-colors focus:border-[#f1702c] focus:ring-2 focus:ring-[#f1702c]/15 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Hapus pencarian"
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#7d8986] hover:bg-[#f3f6f5] hover:text-[#292e31] cursor-pointer"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Saringan kategori */}
      <div
        className="mt-4 -mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:flex-wrap sm:px-0"
        role="group"
        aria-label="Saring menurut topik"
      >
        <CategoryChip
          label="Semua"
          count={guides.length}
          selected={active === ALL}
          onClick={() => setActive(ALL)}
        />
        {categories.map((category) => (
          <CategoryChip
            key={category.id}
            label={category.label}
            count={counts[category.id] ?? 0}
            selected={active === category.id}
            onClick={() => setActive(category.id)}
          />
        ))}
      </div>

      {/* Hasil */}
      <div className="mt-8 space-y-10">
        {groups.length === 0 && (
          <div className="rounded-[14px] border border-dashed border-[#d5dcda] bg-white p-8 text-center">
            <p className="text-[15px] font-semibold text-[#292e31]">
              Tidak ada panduan untuk &ldquo;{trimmed}&rdquo;.
            </p>
            <p className="mt-1 text-[14px] text-[#525866]">
              Coba kata lain, atau buka{" "}
              <Link
                href="/panduan/tanya-jawab-masalah-umum"
                className="font-semibold text-[#c2561d] underline-offset-2 hover:underline"
              >
                Tanya jawab masalah umum
              </Link>
              .
            </p>
          </div>
        )}

        {groups.map(({ category, items }) => (
          <section key={category.id} id={`topik-${category.id}`} className="scroll-mt-28">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2 className="text-[18px] sm:text-[20px] font-semibold text-[#292e31]">
                {category.label}
              </h2>
              <span className="shrink-0 text-[12px] font-mono text-[#7d8986]">
                {items.length} panduan
              </span>
            </div>
            {!trimmed && (
              <p className="-mt-1 mb-4 text-[14px] text-[#525866]">{category.description}</p>
            )}
            <ul className="overflow-hidden rounded-[14px] border border-[#e4e9e7] bg-white divide-y divide-[#e4e9e7]">
              {items.map((guide) => (
                <li key={guide.slug}>
                  <Link
                    href={`/panduan/${guide.slug}`}
                    className="group flex items-start gap-4 px-4 py-4 sm:px-5 transition-colors hover:bg-[#fffaf7] cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[15px] sm:text-[16px] font-semibold leading-snug text-[#292e31] group-hover:text-[#c2561d]">
                        {guide.title}
                      </h3>
                      <p className="mt-1 text-[14px] leading-relaxed text-[#525866]">
                        {guide.description}
                      </p>
                      {guide.audience.length > 0 && (
                        <p className="mt-2 text-[12px] text-[#7d8986]">
                          Untuk: {guide.audience.join(", ")}
                        </p>
                      )}
                    </div>
                    <ArrowRight
                      size={16}
                      className="mt-1 shrink-0 text-[#b0b8b5] transition-transform group-hover:translate-x-0.5 group-hover:text-[#f1702c]"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function CategoryChip({
  label,
  count,
  selected,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`h-9 shrink-0 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors cursor-pointer ${
        selected
          ? "border-[#f1702c] bg-[#fef1eb] text-[#c2561d]"
          : "border-[#e4e9e7] bg-white text-[#525866] hover:border-[#b0b8b5] hover:text-[#292e31]"
      }`}
    >
      {label}
      <span className={`ml-1.5 text-[12px] ${selected ? "text-[#c2561d]" : "text-[#9aa5a2]"}`}>
        {count}
      </span>
    </button>
  );
}
