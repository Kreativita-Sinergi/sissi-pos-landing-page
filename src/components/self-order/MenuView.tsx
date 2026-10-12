"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Armchair, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { displayPrice, isProductSoldOut } from "@/lib/selfOrder/cart";
import { formatRupiah } from "@/lib/selfOrder/pricing";
import type { Menu, MenuProduct } from "@/lib/selfOrder/types";
import { EmptyState, Frame, Thumb, focusRing, initialsOf } from "./ui";

const OTHER = "__lainnya";
// Tinggi bilah kategori lengket (px) — dipakai untuk offset gulir & pengamat bagian.
const NAV_H = 56;

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

  // Sorot kategori yang sedang dibaca: bagian terakhir yang judulnya sudah melewati bilah lengket
  // (di puncak halaman = bagian pertama; di dasar halaman = bagian terakhir).
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let current: string | null = null;
      for (const s of sections) {
        const el = document.getElementById(`kat-${s.id}`);
        if (el && el.getBoundingClientRect().top <= NAV_H + 24) current = s.id;
      }
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atBottom && window.scrollY > 0 && sections.length) current = sections[sections.length - 1].id;
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sections]);

  // Tab aktif tetap terlihat di bilah kategori.
  useEffect(() => {
    if (!activeId) return;
    const chip = navRef.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    chip?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [activeId]);

  const jump = (id: string) => {
    document.getElementById(`kat-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Frame className="pb-36">
      <MenuHeader menu={menu} />

      {banner && <div className="px-4 pt-4">{banner}</div>}

      <nav
        aria-label="Kategori menu"
        className="sticky top-0 z-10 border-b border-so-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85"
      >
        <div ref={navRef} className="flex gap-1 overflow-x-auto px-2 [scrollbar-width:none]" style={{ height: NAV_H }}>
          {sections.map((s) => {
            const on = s.id === activeId;
            return (
              <button
                key={s.id}
                type="button"
                data-cat={s.id}
                onClick={() => jump(s.id)}
                aria-current={on ? "true" : undefined}
                className={`relative shrink-0 rounded-[12px] px-3.5 text-[16px] transition-colors ${focusRing} ${
                  on ? "font-bold text-text-heading" : "font-medium text-text-body hover:text-text-heading"
                }`}
              >
                {s.name}
                <span
                  aria-hidden
                  className={`absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-brand-primary transition-opacity duration-200 ${
                    on ? "opacity-100" : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </nav>

      <main className="px-4">
        {sections.length === 0 && (
          <div className="py-16">
            <EmptyState
              icon={<UtensilsCrossed size={34} aria-hidden />}
              title="Menu belum tersedia"
              body="Outlet belum menampilkan menu untuk dipesan. Silakan tanya kasir."
            />
          </div>
        )}
        {sections.map((s) => (
          <section
            key={s.id}
            id={`kat-${s.id}`}
            aria-labelledby={`judul-${s.id}`}
            className="pt-6"
            style={{ scrollMarginTop: NAV_H }}
          >
            <h2 id={`judul-${s.id}`} className="mb-3 flex items-baseline gap-2 px-1">
              <span className="text-[20px] font-bold tracking-tight text-text-heading">{s.name}</span>
              <span className="text-[14px] font-medium text-text-muted">{s.products.length} menu</span>
            </h2>
            <ul className="flex flex-col gap-3">
              {s.products.map((p) => (
                <li key={p.id}>
                  <ProductCard product={p} quantity={quantities[p.id] ?? 0} onOpen={() => onOpen(p)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p className="py-10 text-center text-[13px] text-text-muted">
          Pemesanan oleh <span className="font-semibold text-text-body">Sissi POS</span>
        </p>
      </main>

      {cartBar}
    </Frame>
  );
}

function MenuHeader({ menu }: { menu: Menu }) {
  const { outlet, mode } = menu;
  const tableText = menu.table
    ? [menu.table.name, menu.table.area_name, "diantar ke mejamu"].filter(Boolean).join(" · ")
    : mode.table_select === "choose"
      ? "Pilih meja tempatmu duduk saat memesan"
      : "Ambil pesanan di konter";

  return (
    <header className="bg-white px-4 pt-5 pb-4">
      <div className="flex items-center gap-3.5">
        {outlet.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- gambar dari API (domain bebas), tanpa optimasi.
          <img
            src={outlet.image_url}
            alt=""
            className="h-14 w-14 shrink-0 rounded-full bg-so-canvas object-cover ring-1 ring-so-line"
          />
        ) : (
          <span
            aria-hidden
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[20px] font-extrabold tracking-tight text-brand-ink"
          >
            {initialsOf(outlet.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-text-heading">{outlet.name}</h1>
          {outlet.address && <p className="mt-0.5 truncate text-[14px] text-text-body">{outlet.address}</p>}
          <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-text-body">
            <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-success" />
            <span>
              <span className="font-semibold text-success">Buka</span> ·{" "}
              {mode.payment === "online" ? "Bayar QRIS di sini" : "Bayar di kasir"}
            </span>
          </p>
        </div>
      </div>

      <p className="mt-3.5 flex min-h-[44px] items-center gap-2.5 rounded-[14px] bg-brand-tint px-3.5 py-2 text-[15px] leading-snug text-text-heading">
        {menu.table ? (
          <Armchair size={18} aria-hidden className="shrink-0 text-brand-deep" />
        ) : (
          <ShoppingBag size={18} aria-hidden className="shrink-0 text-brand-deep" />
        )}
        <span className="min-w-0">
          {menu.table ? (
            <>
              <strong className="font-extrabold">{menu.table.name}</strong>
              {tableText.slice(menu.table.name.length)}
            </>
          ) : (
            <strong className="font-bold">{tableText}</strong>
          )}
        </span>
      </p>
    </header>
  );
}

function ProductCard({ product, quantity, onOpen }: { product: MenuProduct; quantity: number; onOpen: () => void }) {
  const soldOut = isProductSoldOut(product);
  const { price, from } = displayPrice(product);
  const inCart = quantity > 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={soldOut}
      className={`flex w-full items-stretch gap-3.5 rounded-[20px] bg-white p-3 text-left shadow-so-card transition-shadow ${focusRing} ${
        inCart ? "ring-2 ring-brand-primary" : "ring-1 ring-transparent hover:ring-so-line"
      } disabled:cursor-not-allowed disabled:shadow-none disabled:ring-so-line`}
    >
      {/* Foto di kiri (permintaan pemilik) */}
      <div className="relative shrink-0 self-start">
        <Thumb
          name={product.name}
          src={product.image_url}
          dim={soldOut}
          className="h-[76px] w-[76px] rounded-[14px]"
          textClass="text-[21px]"
        />
        {soldOut && (
          <span className="absolute inset-x-1.5 bottom-1.5 rounded-full bg-white/95 py-1 text-center text-[12px] font-bold text-text-heading shadow-so-card">
            Habis
          </span>
        )}
        {!soldOut && inCart && (
          <span
            key={quantity}
            aria-hidden
            className="absolute -top-2 -left-2 flex h-7 min-w-7 items-center justify-center rounded-full border-2 border-white bg-brand-deep px-1.5 text-[13px] font-bold text-white tabular-nums motion-safe:animate-so-bump"
          >
            {quantity}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <span
          className={`text-[17px] font-bold leading-snug tracking-tight ${soldOut ? "text-text-muted" : "text-text-heading"}`}
        >
          {product.name}
        </span>
        {product.description && (
          <span className={`mt-1 line-clamp-2 text-[14px] leading-snug ${soldOut ? "text-text-muted" : "text-text-body"}`}>
            {product.description}
          </span>
        )}
        {soldOut && <span className="mt-1 text-[13px] font-medium text-text-body">Sedang habis, coba menu lain dulu</span>}
        <span className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="flex flex-wrap items-baseline gap-x-1.5">
            {from && <span className="text-[13px] font-medium text-text-muted">mulai</span>}
            <span
              className={`text-[17px] font-extrabold tabular-nums ${soldOut ? "text-text-muted line-through decoration-1" : "text-text-heading"}`}
            >
              {formatRupiah(price)}
            </span>
          </span>
          {!soldOut && (
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-deep text-white shadow-[0_3px_8px_rgb(160_74_29/0.25)]"
            >
              <Plus size={18} strokeWidth={2.75} />
            </span>
          )}
        </span>
        {inCart && <span className="sr-only">, {quantity} di keranjang</span>}
      </div>
    </button>
  );
}
