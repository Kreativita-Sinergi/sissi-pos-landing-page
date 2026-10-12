"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, MapPin, ShoppingBag } from "lucide-react";
import { displayPrice, isProductSoldOut } from "@/lib/selfOrder/cart";
import { formatRupiah } from "@/lib/selfOrder/pricing";
import type { Menu, MenuProduct } from "@/lib/selfOrder/types";
import { focusRing } from "./ui";

const OTHER = "__lainnya";

type Section = { id: string; name: string; products: MenuProduct[] };

function sectionsOf(menu: Menu): Section[] {
  const known = new Set(menu.categories.map((c) => c.id));
  const sections: Section[] = [...menu.categories]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({ id: c.id, name: c.name, products: menu.products.filter((p) => p.category_id === c.id) }));
  const rest = menu.products.filter((p) => !p.category_id || !known.has(p.category_id));
  if (rest.length) sections.push({ id: OTHER, name: "Lainnya", products: rest });
  return sections.filter((s) => s.products.length > 0);
}

export function tableLabel(menu: Menu): string {
  if (menu.table) return [menu.table.name, menu.table.area_name].filter(Boolean).join(" · ");
  if (menu.mode.table_select === "choose") return "Pilih meja saat memesan";
  return "Ambil pesanan di konter";
}

export function MenuView({
  menu,
  quantities,
  onOpen,
  banner,
  cartBar,
}: {
  menu: Menu;
  quantities: Record<string, number>;
  onOpen: (product: MenuProduct) => void;
  banner?: React.ReactNode;
  cartBar?: React.ReactNode;
}) {
  const sections = useMemo(() => sectionsOf(menu), [menu]);
  const [active, setActive] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const activeId = active ?? sections[0]?.id ?? null;

  // Sorot kategori yang sedang terlihat.
  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(`kat-${s.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) setActive(visible[0].target.id.replace(/^kat-/, ""));
      },
      { rootMargin: "-72px 0px -65% 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [sections]);

  // Chip aktif tetap terlihat di bilah kategori.
  useEffect(() => {
    if (!activeId) return;
    const chip = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeId]);

  const jump = (id: string) => {
    setActive(id);
    document.getElementById(`kat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-dvh bg-bg-muted pb-32">
      <header className="bg-white px-4 pt-6 pb-4">
        <div className="mx-auto max-w-[640px]">
          <p className="text-[13px] font-medium uppercase tracking-wide text-text-muted">Menu</p>
          <h1 className="mt-1 text-[26px] font-bold leading-tight text-text-heading">{menu.outlet.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[15px]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1.5 font-semibold text-text-heading">
              <MapPin size={16} aria-hidden className="text-brand-primary" />
              {tableLabel(menu)}
            </span>
            <span className="rounded-full bg-bg-muted px-3 py-1.5 text-text-body">
              {menu.mode.payment === "online" ? "Bayar QRIS di sini" : "Bayar di kasir"}
            </span>
          </div>
        </div>
      </header>

      {banner && <div className="mx-auto max-w-[640px] px-4 pt-3">{banner}</div>}

      <nav
        aria-label="Kategori menu"
        className="sticky top-0 z-10 border-b border-border-subtle bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
      >
        <div
          ref={navRef}
          className="mx-auto flex max-w-[640px] gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none]"
        >
          {sections.map((s) => {
            const on = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                data-cat={s.id}
                onClick={() => jump(s.id)}
                aria-current={on ? "true" : undefined}
                className={`min-h-[44px] shrink-0 rounded-full border px-4 text-[15px] font-semibold transition-colors ${focusRing} ${
                  on
                    ? "border-brand-dark bg-brand-dark text-white"
                    : "border-border-subtle bg-white text-text-heading hover:border-border-active"
                }`}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-[640px] px-4">
        {sections.length === 0 && (
          <p className="py-16 text-center text-[16px] text-text-body">Menu belum tersedia. Silakan tanya kasir.</p>
        )}
        {sections.map((s) => (
          <section key={s.id} id={`kat-${s.id}`} aria-labelledby={`judul-${s.id}`} className="scroll-mt-[64px] pt-5">
            <h2 id={`judul-${s.id}`} className="mb-3 text-[19px] font-bold text-text-heading">
              {s.name}
            </h2>
            <ul className="flex flex-col gap-2.5">
              {s.products.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} quantity={quantities[p.id] ?? 0} onOpen={() => onOpen(p)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="py-8 text-center text-[13px] text-text-muted">
          Pemesanan oleh <span className="font-semibold">Sissi POS</span>
        </p>
      </main>

      {cartBar}
    </div>
  );
}

function ProductCard({ product, quantity, onOpen }: { product: MenuProduct; quantity: number; onOpen: () => void }) {
  const soldOut = isProductSoldOut(product);
  const { price, from } = displayPrice(product);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={soldOut}
      className={`flex w-full items-stretch gap-3 rounded-[16px] border bg-white p-4 text-left transition-colors ${focusRing} ${
        quantity > 0 ? "border-brand-primary" : "border-border-subtle hover:border-border-active"
      } disabled:cursor-not-allowed`}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={`text-[17px] font-semibold leading-snug ${soldOut ? "text-text-muted" : "text-text-heading"}`}>
          {product.name}
        </span>
        {product.description && (
          <span className="mt-1 line-clamp-2 text-[14px] leading-snug text-text-body">{product.description}</span>
        )}
        <span className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <span className={`text-[16px] font-semibold tabular-nums ${soldOut ? "text-text-muted" : "text-text-heading"}`}>
            {from && <span className="text-[13px] font-normal text-text-body">mulai </span>}
            {formatRupiah(price)}
          </span>
          {soldOut && (
            <span className="rounded-full bg-bg-muted px-2.5 py-0.5 text-[13px] font-semibold text-text-body">Habis</span>
          )}
          {quantity > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-tint px-2.5 py-0.5 text-[13px] font-semibold text-text-heading">
              <ShoppingBag size={13} aria-hidden /> {quantity} di keranjang
            </span>
          )}
        </span>
      </div>
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- gambar dari API (domain bebas), tanpa optimasi.
        <img
          src={product.image_url}
          alt=""
          loading="lazy"
          className={`h-[84px] w-[84px] shrink-0 rounded-[12px] bg-bg-muted object-cover ${soldOut ? "opacity-50 grayscale" : ""}`}
        />
      ) : (
        !soldOut && <ChevronRight size={20} aria-hidden className="shrink-0 self-center text-text-muted" />
      )}
    </button>
  );
}
