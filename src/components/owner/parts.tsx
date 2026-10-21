"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge, focusRing, formatRupiah, tdClass, thClass } from "@/components/admin/ui";
import type { SaleListItem } from "@/lib/owner/types";
import { depositBadge, labelOf, METHODS, orderTypeLabel, SALE_STATUS, SALE_STATUS_SHORT, SALE_STATUS_TONE } from "./labels";
import { formatShortDate, formatStamp, formatTime, zonedDay } from "@/lib/owner/tz";
import { isPreorderDeposit } from "@/lib/owner/cancelSale";
import { hasPartialRefund, refundedTotalOf, shownTotalOf } from "@/lib/owner/saleRefunds";

/**
 * Status transaksi. Transaksi DP reservasi ([deposit], api.md `SaleListItem.deposit`) memakai label DP-nya
 * (tertahan/perlu diproses/hangus/dikembalikan); pesanan reservasi biasa = status + penanda "DP". DP yang sudah
 * ber-item (pesanan awal B3, [preorder]) diberi penanda "Pesanan awal"; transaksi lunas yang direfund sebagian
 * ([partialRefund]) diberi penanda "Refund sebagian".
 */
export function SaleStatusBadge({
  status,
  long = false,
  deposit,
  preorder = false,
  noMoney = false,
  partialRefund = false,
}: {
  status: string;
  long?: boolean;
  deposit?: string | null;
  preorder?: boolean;
  /** Tidak ada uang DP dipegang (`paid_total` ≤ 0): pesanan awal tanpa DP tidak dilabeli "DP". */
  noMoney?: boolean;
  partialRefund?: boolean;
}) {
  const dp = depositBadge(deposit, { preorder, noMoney, long });
  const badge = dp ? (
    <Badge tone={dp.tone}>{dp.label}</Badge>
  ) : (
    <Badge tone={SALE_STATUS_TONE[status] ?? "neutral"}>{labelOf(long ? SALE_STATUS : SALE_STATUS_SHORT, status)}</Badge>
  );
  const extra: string[] = [];
  if (dp?.extra) extra.push(dp.extra);
  if (!dp && deposit === "order") extra.push(long ? "Reservasi ber-DP" : "DP");
  if (partialRefund) extra.push("Refund sebagian");
  if (!extra.length) return badge;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {badge}
      {extra.map((t) => (
        <Badge key={t} tone={t === "Refund sebagian" ? "warning" : "neutral"}>
          {t}
        </Badge>
      ))}
    </span>
  );
}

/** Badge status satu baris daftar/detail (DP, pesanan awal, refund sebagian diturunkan dari datanya). */
export function SaleRowBadge({
  s,
  long = false,
  partialRefund = true,
}: {
  s: Pick<SaleListItem, "status" | "deposit" | "items_count" | "total" | "paid_total" | "refunded_total">;
  long?: boolean;
  /** `false` = tanpa lencana "Refund sebagian" (baris yang sudah menulisnya sebagai teks). */
  partialRefund?: boolean;
}) {
  return (
    <SaleStatusBadge
      status={s.status}
      deposit={s.deposit}
      long={long}
      preorder={isPreorderDeposit(s)}
      noMoney={s.paid_total <= 0}
      partialRefund={partialRefund && hasPartialRefund(s)}
    />
  );
}

/** Nominal daftar: tagihan setelah refund sebagian; transaksi batal/refund penuh tetap nilai asli (dicoret). */
export const shownTotal = shownTotalOf;

/**
 * Di bawah nominal daftar (yang sudah = total setelah refund): "−Rp…" refund sebagian. Total awal ditulis untuk pembaca
 * layar (dan `title` untuk tetikus) — ringkas agar kolom total tidak melebar di HP.
 */
function PartialRefundHint({ s }: { s: Pick<SaleListItem, "status" | "total" | "refunded_total"> }) {
  if (!hasPartialRefund(s)) return null;
  return (
    <span className="block text-[12px] font-normal tabular-nums text-danger" title={`Refund sebagian · total awal ${formatRupiah(s.total)}`}>
      <span className="sr-only">Total setelah refund sebagian; total awal {formatRupiah(s.total)}, refund sebagian </span>-
      {formatRupiah(refundedTotalOf(s))}
    </span>
  );
}

/** DP masih dipegang (belum jadi pesanan): `total` 0, uangnya = `paid_total`. */
export const isHeldDeposit = (s: Pick<SaleListItem, "deposit">) => s.deposit === "held" || s.deposit === "to_process";

export { formatStamp };

/**
 * Tabel transaksi: di HP hanya waktu/struk, total, status (kolom lain disembunyikan, ringkasnya
 * ditulis di bawah nomor struk). Setiap baris menaut ke detail.
 */
export function SalesTable({
  rows,
  hrefOf,
  showOutlet,
  timeOnly = false,
  dim = false,
}: {
  rows: SaleListItem[];
  hrefOf: (id: string) => string;
  showOutlet: boolean;
  timeOnly?: boolean;
  dim?: boolean;
}) {
  return (
    <div className={`overflow-x-auto transition-opacity ${dim ? "opacity-60" : ""}`}>
      <table className="w-full min-w-[320px] border-separate border-spacing-0 text-[14px]">
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Waktu · struk
            </th>
            {showOutlet && (
              <th scope="col" className={`${thClass} hidden lg:table-cell`}>
                Outlet
              </th>
            )}
            <th scope="col" className={`${thClass} hidden md:table-cell`}>
              Kasir
            </th>
            <th scope="col" className={`${thClass} hidden md:table-cell`}>
              Pelanggan · meja
            </th>
            <th scope="col" className={`${thClass} hidden sm:table-cell`}>
              Metode
            </th>
            <th scope="col" className={`${thClass} text-right`}>
              Total
            </th>
            <th scope="col" className={thClass}>
              Status
            </th>
            <th scope="col" className={`${thClass} w-8`}>
              <span className="sr-only">Detail</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const who = [s.customer_name, s.table_name].filter(Boolean).join(" · ");
            return (
              <tr key={s.id} className="group relative hover:bg-bg-muted/60">
                <td className={`${tdClass} border-b border-border-subtle`}>
                  <Link href={hrefOf(s.id)} className={`block rounded after:absolute after:inset-0 ${focusRing}`}>
                    <span className="block font-semibold tabular-nums text-text-heading">{formatStamp(s.paid_at, timeOnly)}</span>
                    <span className="block text-[12.5px] tabular-nums text-text-muted">{s.receipt_no}</span>
                    <span className="block text-[12px] text-text-muted md:hidden">
                      {[s.cashier_name, who, labelOf(METHODS, s.payment_method)].filter(Boolean).join(" · ")}
                    </span>
                  </Link>
                </td>
                {showOutlet && <td className={`${tdClass} hidden border-b border-border-subtle text-text-body lg:table-cell`}>{s.outlet_name}</td>}
                <td className={`${tdClass} hidden border-b border-border-subtle text-text-body md:table-cell`}>{s.cashier_name}</td>
                <td className={`${tdClass} hidden border-b border-border-subtle text-text-body md:table-cell`}>
                  {who || <span className="text-text-muted">{orderTypeLabel(s.order_type)}</span>}
                </td>
                <td className={`${tdClass} hidden border-b border-border-subtle text-text-body sm:table-cell`}>{labelOf(METHODS, s.payment_method)}</td>
                <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums whitespace-nowrap`}>
                  <span className={s.status === "void" || s.status === "refunded" ? "text-text-muted line-through" : ""}>{formatRupiah(shownTotal(s))}</span>
                  <PartialRefundHint s={s} />
                  {(s.status === "unpaid" || s.status === "partial") && (
                    <span className="block text-[12px] font-normal text-warning">sisa {formatRupiah(s.total - s.paid_total)}</span>
                  )}
                  {isHeldDeposit(s) && s.paid_total > 0 && <span className="block text-[12px] font-normal text-text-muted">DP {formatRupiah(s.paid_total)}</span>}
                </td>
                <td className={`${tdClass} border-b border-border-subtle`}>
                  <SaleRowBadge s={s} />
                </td>
                <td className={`${tdClass} border-b border-border-subtle text-text-muted`}>
                  <ChevronRight size={16} aria-hidden className="group-hover:text-text-heading" />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Nama cabang tanpa nama usaha di depannya ("Kopi Senja — Dago" → "Dago") agar baris ringkas. */
function shortOutlet(name: string): string {
  const i = name.lastIndexOf(" — ");
  return i > 0 ? name.slice(i + 3) : name;
}

/**
 * Daftar transaksi ringkas untuk Beranda (dua baris per transaksi, tanpa kolom): kiri jam + meja/pelanggan, kanan
 * total + status bila bukan lunas. Rincian lengkap tetap di halaman Transaksi.
 */
export function RecentSalesList({
  rows,
  hrefOf,
  showOutlet,
  today,
}: {
  rows: SaleListItem[];
  hrefOf: (id: string) => string;
  showOutlet: boolean;
  /** Tanggal `YYYY-MM-DD` hari ini (zona usaha): transaksi hari ini cukup ditulis jamnya. */
  today?: string;
}) {
  return (
    <ul className="divide-y divide-border-subtle">
      {rows.map((s) => {
        const sameDay = today !== undefined && zonedDay(s.paid_at) === today;
        const who = s.table_name || s.customer_name || orderTypeLabel(s.order_type);
        const meta = [s.receipt_no, showOutlet ? shortOutlet(s.outlet_name) : null, s.cashier_name].filter(Boolean).join(" · ");
        const cancelled = s.status === "void" || s.status === "refunded";
        return (
          <li key={s.id}>
            <Link href={hrefOf(s.id)} className={`group flex items-center gap-3 px-4 py-3 hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}>
              <span className="w-12 shrink-0 tabular-nums">
                <span className="block text-[13px] font-semibold text-text-heading">{formatTime(s.paid_at)}</span>
                {!sameDay && <span className="block text-[11.5px] text-text-muted">{formatShortDate(s.paid_at)}</span>}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-text-heading">{who || "—"}</span>
                <span className="block truncate text-[12.5px] text-text-muted">{meta}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`block text-[14px] font-semibold tabular-nums ${cancelled ? "text-text-muted line-through" : "text-text-heading"}`}>
                  {formatRupiah(shownTotal(s))}
                </span>
                <PartialRefundHint s={s} />
                <span className="block text-[12px] text-text-muted">
                  {/* Refund sebagian: nominal di atas + teks pendek (bukan lencana "Lunas" + "Refund sebagian" sebaris yang
                      melebarkan kolom kanan di HP). */}
                  {s.status === "paid" && !s.deposit
                    ? hasPartialRefund(s)
                      ? "Refund sebagian"
                      : labelOf(METHODS, s.payment_method)
                    : <SaleRowBadge s={s} partialRefund={false} />}
                </span>
              </span>
              <ChevronRight size={16} aria-hidden className="shrink-0 text-text-muted group-hover:text-text-heading" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
