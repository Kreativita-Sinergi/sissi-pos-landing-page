"use client";

import React from "react";
import { ShoppingBag } from "lucide-react";
import { MAX_QTY, NAME_MAX, NOTE_MAX, type ResolvedLine } from "@/lib/selfOrder/cart";
import { formatRate, formatRupiah, type Breakdown } from "@/lib/selfOrder/pricing";
import type { Menu, OrderType, PublicTable } from "@/lib/selfOrder/types";
import { Sheet } from "./Sheet";
import { tableLabel } from "./MenuView";
import { Stepper, focusRing, inputClass, primaryButton } from "./ui";

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: "Makan di sini",
  takeaway: "Bawa pulang",
};

export type CartFieldErrors = { table?: string; name?: string };

export function CartBar({ count, total, onOpen }: { count: number; total: number; onOpen: () => void }) {
  if (count === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 px-4 pt-2 pb-[max(12px,env(safe-area-inset-bottom))]">
      <button
        type="button"
        onClick={onOpen}
        className={`mx-auto flex min-h-[60px] w-full max-w-[608px] items-center gap-3 rounded-[16px] bg-brand-dark px-4 text-white shadow-lg ${focusRing}`}
      >
        <span className="relative inline-flex">
          <ShoppingBag size={24} aria-hidden />
          <span className="absolute -top-2 -right-2.5 min-w-6 rounded-full bg-brand-primary px-1.5 text-center text-[13px] leading-6 font-bold text-brand-dark">
            {count}
          </span>
        </span>
        <span className="ml-2 flex-1 text-left text-[17px] font-semibold">
          Lihat keranjang<span className="sr-only">, {count} item</span>
        </span>
        <span className="text-[17px] font-bold tabular-nums">{formatRupiah(total)}</span>
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

  const footer = (
    <div className="flex flex-col gap-2">
      {error && (
        <div role="alert" className="rounded-[12px] border border-danger/25 bg-danger-tint px-4 py-3 text-[15px] leading-relaxed text-danger">
          {error}
        </div>
      )}
      <button
        type="button"
        className={primaryButton}
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
            <span>{addTo ? "Kirim tambahan" : "Kirim pesanan"}</span>
            <span aria-hidden>·</span>
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
        <div className="py-10 text-center">
          <p className="text-[16px] text-text-body">Keranjang masih kosong.</p>
          <button type="button" onClick={onClose} className={`mt-4 text-[16px] font-semibold text-text-heading underline ${focusRing}`}>
            Lihat menu
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col divide-y divide-border-subtle">
            {lines.map((l) => {
              const issue = flagged.has(l.key) ? "sold_out" : l.issue;
              const details = [l.variantName, ...l.modifierNames].filter(Boolean).join(", ");
              return (
                <li key={l.key} className="py-3 first:pt-0">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className={`text-[16px] font-semibold leading-snug ${issue ? "text-text-muted line-through" : ""}`}>
                        {l.name}
                      </p>
                      {details && <p className="mt-0.5 text-[14px] text-text-body">{details}</p>}
                      {l.note && <p className="mt-0.5 text-[14px] italic text-text-body">“{l.note}”</p>}
                      {issue ? (
                        <p className="mt-1 text-[14px] font-semibold text-danger">
                          {issue === "sold_out" ? "Habis — hapus dari keranjang" : "Tidak tersedia lagi — hapus dari keranjang"}
                        </p>
                      ) : (
                        <p className="mt-1 text-[15px] font-semibold tabular-nums">
                          {formatRupiah((l.unitPrice + l.modifiersTotal) * l.quantity)}
                        </p>
                      )}
                    </div>
                    <Stepper
                      value={l.quantity}
                      max={MAX_QTY}
                      removable
                      onChange={(q) => onQuantity(l.key, issue ? 0 : q)}
                      label={l.name}
                    />
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
            className={`-mt-3 self-start text-[15px] font-semibold text-text-heading underline underline-offset-4 ${focusRing}`}
          >
            + Tambah menu lain
          </button>

          {!addTo && mode.order_types.length > 1 && (
            <fieldset>
              <legend className="mb-2.5 text-[17px] font-semibold">Jenis pesanan</legend>
              <div className="grid grid-cols-2 gap-2">
                {mode.order_types.map((t) => (
                  <label
                    key={t}
                    className={`flex min-h-[52px] cursor-pointer items-center justify-center rounded-[12px] border-2 px-3 text-center text-[16px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
                      orderType === t ? "border-brand-primary bg-brand-tint" : "border-border-subtle bg-white"
                    }`}
                  >
                    <input
                      type="radio"
                      name="jenis-pesanan"
                      className="sr-only"
                      checked={orderType === t}
                      onChange={() => onOrderType(t)}
                    />
                    {ORDER_TYPE_LABEL[t]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          {chooseTable ? (
            <fieldset aria-describedby={fieldErrors.table ? "err-meja" : undefined}>
              <legend className="mb-2.5 text-[17px] font-semibold">Meja kamu</legend>
              <div className="flex flex-col gap-3">
                {groupTables(menu.tables ?? []).map(([area, tables]) => (
                  <div key={area || "-"}>
                    {area && <p className="mb-1.5 text-[14px] font-medium text-text-body">{area}</p>}
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {tables.map((t) => (
                        <label
                          key={t.id}
                          className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-[12px] border-2 px-2 text-center text-[15px] font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
                            tableId === t.id ? "border-brand-primary bg-brand-tint" : "border-border-subtle bg-white"
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
                <p id="err-meja" className="mt-2 text-[14px] font-medium text-danger">
                  {fieldErrors.table}
                </p>
              )}
            </fieldset>
          ) : (
            !addTo && (
              <p className="rounded-[12px] bg-bg-muted px-4 py-3 text-[15px] text-text-body">
                {orderType === "takeaway" && mode.table_select !== "per_table"
                  ? "Ambil pesanan di konter dengan nomor pesanan."
                  : tableLabel(menu)}
              </p>
            )
          )}

          {!addTo && (
            <div>
              <label htmlFor="nama-pemesan" className="mb-2 block text-[17px] font-semibold">
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
                <p id="err-nama" className="mt-2 text-[14px] font-medium text-danger">
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
            <label htmlFor="catatan-pesanan" className="mb-2 block text-[17px] font-semibold">
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

          <div className="rounded-[14px] bg-bg-muted px-4 py-3">
            <dl className="flex flex-col gap-1.5 text-[15px]">
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
              <div className="mt-1.5 flex items-baseline justify-between border-t border-border-subtle pt-2.5">
                <dt className="text-[17px] font-bold">Total</dt>
                <dd className="text-[19px] font-bold tabular-nums">{formatRupiah(breakdown.total)}</dd>
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
