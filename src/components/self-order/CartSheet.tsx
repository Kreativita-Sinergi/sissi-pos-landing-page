"use client";

import React from "react";
import { Armchair, ChevronRight, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { MAX_QTY, NAME_MAX, NOTE_MAX, type ResolvedLine } from "@/lib/selfOrder/cart";
import { formatRate, formatRupiah, type Breakdown } from "@/lib/selfOrder/pricing";
import type { Menu, OrderType, PublicTable } from "@/lib/selfOrder/types";
import { Sheet } from "./Sheet";
import { tableLabel } from "./MenuView";
import { EmptyState, Stepper, Thumb, focusRing, inputClass, primaryButton, secondaryButton } from "./ui";

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: "Makan di sini",
  takeaway: "Bawa pulang",
};

const sectionTitle = "mb-3 text-[18px] font-bold tracking-tight text-text-heading";

export type CartFieldErrors = { table?: string; name?: string };

export function CartBar({ count, total, onOpen }: { count: number; total: number; onOpen: () => void }) {
  if (count === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 mx-auto max-w-[520px] px-4 pt-6 pb-[max(14px,env(safe-area-inset-bottom))] motion-safe:animate-so-rise">
      <button
        type="button"
        onClick={onOpen}
        className={`pointer-events-auto flex min-h-[64px] w-full items-center gap-3 rounded-[18px] bg-brand-deep py-2.5 pr-3 pl-3 text-left text-white shadow-so-float transition-colors hover:bg-brand-deeper ${focusRing}`}
      >
        <span
          key={count}
          className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-white/15 motion-safe:animate-so-bump"
        >
          <ShoppingBag size={22} aria-hidden />
          <span className="absolute -top-1.5 -right-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-white px-1.5 text-[13px] font-extrabold tabular-nums text-brand-ink">
            {count}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-white/85">{count} item</span>
          <span key={total} className="block text-[18px] font-extrabold tabular-nums leading-tight">
            {formatRupiah(total)}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-[12px] bg-white px-3 py-2.5 text-[15px] font-bold text-brand-ink">
          Lihat keranjang <ChevronRight size={18} aria-hidden />
        </span>
      </button>
    </div>
  );
}

function groupTables(tables: PublicTable[]): [string, PublicTable[]][] {
  const map = new Map<string, PublicTable[]>();
  for (const t of tables) {
    const key = t.area_name || "";
    map.set(key, [...(map.get(key) ?? []), t]);
  }
  return [...map.entries()];
}

export function CartSheet({
  open,
  onClose,
  menu,
  lines,
  flagged,
  breakdown,
  orderType,
  onOrderType,
  tableId,
  onTable,
  customerName,
  onCustomerName,
  note,
  onNote,
  addTo,
  onQuantity,
  onSubmit,
  submitting,
  error,
  fieldErrors,
  retryIn,
}: {
  open: boolean;
  onClose: () => void;
  menu: Menu;
  lines: ResolvedLine[];
  flagged: Set<string>;
  breakdown: Breakdown;
  orderType: OrderType;
  onOrderType: (t: OrderType) => void;
  tableId: string | null;
  onTable: (id: string) => void;
  customerName: string;
  onCustomerName: (v: string) => void;
  note: string;
  onNote: (v: string) => void;
  addTo: { order_no: string } | null;
  onQuantity: (key: string, quantity: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  error: React.ReactNode | null;
  fieldErrors: CartFieldErrors;
  retryIn: number;
}) {
  const { mode } = menu;
  const chooseTable = !addTo && mode.table_select === "choose" && orderType === "dine_in" && !!menu.tables;
  const blocked = lines.some((l) => l.issue || flagged.has(l.key));
  const fee = menu.pricing.service_fee;
  const images = new Map(menu.products.map((p) => [p.id, p.image_url]));

  const footer = (
    <div className="flex flex-col gap-2">
      {error && (
        <div role="alert" className="rounded-[12px] border border-danger/25 bg-danger-tint px-4 py-3 text-[15px] leading-relaxed text-danger">
          {error}
        </div>
      )}
      <button
        type="button"
        className={`${primaryButton} min-h-[58px]! text-[18px]!`}
        onClick={onSubmit}
        disabled={submitting || lines.length === 0 || retryIn > 0}
        aria-describedby={blocked ? "keranjang-bermasalah" : undefined}
      >
        {submitting ? (
          "Mengirim pesanan…"
        ) : retryIn > 0 ? (
          `Coba lagi dalam ${retryIn} dtk`
        ) : (
          <>
            <span className="flex-1 text-left">{addTo ? "Kirim tambahan" : "Kirim pesanan"}</span>
            <span className="tabular-nums">{formatRupiah(breakdown.total)}</span>
          </>
        )}
      </button>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={addTo ? `Tambahan untuk ${addTo.order_no}` : "Keranjang"}
      subtitle={addTo ? "Dikirim ke meja & jenis pesanan yang sama." : undefined}
      footer={lines.length ? footer : undefined}
    >
      {lines.length === 0 ? (
        <div className="py-8">
          <EmptyState
            icon={<ShoppingBag size={34} aria-hidden />}
            title="Keranjang masih kosong"
            body="Pilih menu favoritmu, lalu kirim pesanan dari sini."
          >
            <button type="button" onClick={onClose} className={secondaryButton}>
              Lihat menu
            </button>
          </EmptyState>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col divide-y divide-so-line">
            {lines.map((l) => {
              const issue = flagged.has(l.key) ? "sold_out" : l.issue;
              const details = [l.variantName, ...l.modifierNames].filter(Boolean).join(", ");
              return (
                <li key={l.key} className="py-3.5 first:pt-0">
                  <div className="flex items-start gap-3">
                    <Thumb
                      name={l.name}
                      src={images.get(l.productId)}
                      dim={!!issue}
                      className="h-14 w-14 shrink-0 rounded-[14px]"
                      textClass="text-[18px]"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[16px] font-bold leading-snug ${issue ? "text-text-muted line-through" : ""}`}>
                        {l.name}
                      </p>
                      {details && <p className="mt-0.5 text-[14px] leading-snug text-text-body">{details}</p>}
                      {l.note && <p className="mt-0.5 text-[14px] italic leading-snug text-text-body">“{l.note}”</p>}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                        {issue ? (
                          <p className="text-[14px] font-semibold text-danger">
                            {issue === "sold_out" ? "Habis — hapus dari keranjang" : "Tidak tersedia lagi — hapus dari keranjang"}
                          </p>
                        ) : (
                          <p className="text-[16px] font-extrabold tabular-nums">
                            {formatRupiah((l.unitPrice + l.modifiersTotal) * l.quantity)}
                          </p>
                        )}
                        <Stepper
                          value={l.quantity}
                          max={MAX_QTY}
                          removable
                          onChange={(q) => onQuantity(l.key, issue ? 0 : q)}
                          label={l.name}
                        />
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          {blocked && (
            <p id="keranjang-bermasalah" className="-mt-3 text-[14px] text-danger">
              Hapus item yang ditandai sebelum mengirim.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`-mt-3 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-so-line text-[15px] font-bold text-brand-ink hover:border-brand-primary ${focusRing}`}
          >
            <Plus size={18} aria-hidden /> Tambah menu lain
          </button>

          {!addTo && mode.order_types.length > 1 && (
            <fieldset>
              <legend className={sectionTitle}>Jenis pesanan</legend>
              <div className="grid grid-cols-2 gap-1 rounded-[16px] bg-so-canvas p-1">
                {mode.order_types.map((t) => (
                  <label
                    key={t}
                    className={`flex min-h-[50px] cursor-pointer items-center justify-center gap-2 rounded-[12px] px-2 text-center text-[16px] font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
                      orderType === t ? "bg-white text-text-heading shadow-so-card" : "text-text-body"
                    }`}
                  >
                    <input
                      type="radio"
                      name="jenis-pesanan"
                      className="sr-only"
                      checked={orderType === t}
                      onChange={() => onOrderType(t)}
                    />
                    {t === "dine_in" ? (
                      <UtensilsCrossed size={18} aria-hidden className={orderType === t ? "text-brand-deep" : ""} />
                    ) : (
                      <ShoppingBag size={18} aria-hidden className={orderType === t ? "text-brand-deep" : ""} />
                    )}
                    {ORDER_TYPE_LABEL[t]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {chooseTable ? (
            <fieldset aria-describedby={fieldErrors.table ? "err-meja" : undefined}>
              <legend className={sectionTitle}>Meja kamu</legend>
              <div className="flex flex-col gap-3">
                {groupTables(menu.tables ?? []).map(([area, tables]) => (
                  <div key={area || "-"}>
                    {area && <p className="mb-2 text-[13px] font-bold uppercase tracking-[0.06em] text-text-muted">{area}</p>}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {tables.map((t) => (
                        <label
                          key={t.id}
                          className={`flex min-h-[50px] cursor-pointer items-center justify-center rounded-[14px] border-2 px-2 text-center text-[15px] font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
                            tableId === t.id
                              ? "border-brand-primary bg-brand-tint text-text-heading"
                              : fieldErrors.table
                                ? "border-danger/40 bg-white"
                                : "border-so-line bg-white hover:border-border-active"
                          }`}
                        >
                          <input
                            type="radio"
                            name="meja"
                            className="sr-only"
                            checked={tableId === t.id}
                            onChange={() => onTable(t.id)}
                          />
                          {t.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {fieldErrors.table && (
                <p id="err-meja" className="mt-2 text-[14px] font-semibold text-danger">
                  {fieldErrors.table}
                </p>
              )}
            </fieldset>
          ) : (
            !addTo && (
              <p className="flex items-center gap-3 rounded-[16px] bg-brand-tint px-4 py-3 text-[15px] font-semibold text-text-heading">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white text-brand-deep">
                  {orderType === "takeaway" || !menu.table ? (
                    <ShoppingBag size={18} aria-hidden />
                  ) : (
                    <Armchair size={18} aria-hidden />
                  )}
                </span>
                {orderType === "takeaway" && mode.table_select !== "per_table"
                  ? "Ambil pesanan di konter dengan nomor pesanan."
                  : tableLabel(menu)}
              </p>
            )
          )}

          {!addTo && (
            <div>
              <label htmlFor="nama-pemesan" className={`block ${sectionTitle}`}>
                Nama pemesan{" "}
                {!mode.require_customer_name && <span className="font-normal text-text-muted">(opsional)</span>}
              </label>
              <input
                id="nama-pemesan"
                value={customerName}
                onChange={(e) => onCustomerName(e.target.value.slice(0, NAME_MAX))}
                maxLength={NAME_MAX}
                autoComplete="given-name"
                required={mode.require_customer_name}
                aria-invalid={!!fieldErrors.name || undefined}
                aria-describedby={fieldErrors.name ? "err-nama" : "bantu-nama"}
                placeholder="Agar mudah dipanggil"
                className={`${inputClass} h-[52px] ${fieldErrors.name ? "border-danger" : ""}`}
              />
              {fieldErrors.name ? (
                <p id="err-nama" className="mt-2 text-[14px] font-semibold text-danger">
                  {fieldErrors.name}
                </p>
              ) : (
                <p id="bantu-nama" className="sr-only">
                  Maksimal {NAME_MAX} huruf.
                </p>
              )}
            </div>
          )}

          <div>
            <label htmlFor="catatan-pesanan" className={`block ${sectionTitle}`}>
              Catatan pesanan <span className="font-normal text-text-muted">(opsional)</span>
            </label>
            <textarea
              id="catatan-pesanan"
              value={note}
              onChange={(e) => onNote(e.target.value.slice(0, NOTE_MAX))}
              maxLength={NOTE_MAX}
              rows={2}
              placeholder="Contoh: tolong sendok tambahan"
              className={`${inputClass} resize-none py-3`}
            />
          </div>

          <div className="rounded-[18px] border border-so-line bg-so-canvas px-4 py-3.5">
            <dl className="flex flex-col gap-2 text-[15px]">
              <Row label="Subtotal" value={breakdown.subtotal} />
              {breakdown.serviceFee > 0 && (
                <Row
                  label={`Biaya layanan${fee.type === "percent" ? ` (${formatRate(fee.rate_bp)})` : ""}`}
                  value={breakdown.serviceFee}
                />
              )}
              {breakdown.taxes.map((t) => (
                <Row key={t.id} label={`${t.name} (${formatRate(t.rateBp)})`} value={t.amount} />
              ))}
              <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-border-active pt-3">
                <dt className="text-[17px] font-bold">Total</dt>
                <dd className="text-[22px] font-extrabold tabular-nums tracking-tight">{formatRupiah(breakdown.total)}</dd>
              </div>
            </dl>
          </div>

          <p className="-mt-2 text-[14px] leading-relaxed text-text-body">
            {mode.payment === "online"
              ? "Setelah dikirim, bayar dengan QRIS di halaman ini. Pesanan langsung diproses setelah lunas."
              : "Setelah dikirim, tunjukkan nomor pesanan ke kasir. Pembayaran dilakukan di kasir."}
          </p>
        </div>
      )}
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-body">{label}</dt>
      <dd className="tabular-nums text-text-heading">{formatRupiah(value)}</dd>
    </div>
  );
}
