"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, HandCoins, ReceiptText } from "lucide-react";
import { ApiError } from "@/lib/sissiApi";
import { btn, cardClass, EmptyState, ErrorBlock, focusRing, formatRupiah, Notice, PageHeader, Skeleton, useLoad } from "@/components/admin/ui";
import { formatDateTime, zoneLabel } from "@/lib/owner/tz";
import { ownerApi } from "@/lib/owner/api";
import { isCreditOpen, OUTSIDE_DRAWER_NOTE } from "@/lib/owner/credit";
import type { SaleDetail } from "@/lib/owner/types";
import { labelOf, METHODS, orderTypeLabel } from "./labels";
import { useOwner } from "./OwnerShell";
import { SettleCreditDialog } from "./credit/SettleCreditDialog";
import { SaleStatusBadge } from "./parts";

// Detail transaksi (GET /owner/sales/{id}) dalam bentuk struk. Kasbon (`unpaid|partial`) bisa dilunasi/dicicil dari
// sini (POST /owner/changes `sale_payments`, di luar laci kasir) — tersedia juga untuk paket Gratis (pelunasan kasbon
// tetap boleh, api.md "Batas transaksi Gratis").

export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        // Kembali ke daftar dengan filter terakhir bila datang dari dasbor.
        if (window.history.length > 1 && document.referrer.startsWith(window.location.origin)) {
          e.preventDefault();
          router.back();
        }
      }}
      className={`mb-2 inline-flex items-center gap-1 rounded text-[13.5px] font-semibold text-text-body hover:text-text-heading ${focusRing}`}
    >
      <ArrowLeft size={15} aria-hidden /> {label}
    </Link>
  );
}

export function SaleDetailView() {
  const { id } = useParams<{ id: string }>();
  const { withOutlet } = useOwner();
  const { state, reload } = useLoad<SaleDetail>(async (signal) => (await ownerApi()).sale(id, signal), [id]);
  const s = state.data;
  const [settling, setSettling] = useState(false);
  const back = <BackLink href={withOutlet("/dasbor/transaksi")} label="Transaksi" />;

  if (state.status === "error" && state.error instanceof ApiError && state.error.code === "NOT_FOUND") {
    return (
      <>
        <PageHeader title="Transaksi tidak ditemukan" back={back} />
        <section className={cardClass}>
          <EmptyState icon={<ReceiptText size={22} aria-hidden />} title="Transaksi tidak ada">
            Mungkin tautannya salah, atau transaksi milik usaha lain.
          </EmptyState>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={s ? `Struk ${s.receipt_no}` : "Detail transaksi"}
        back={back}
        description={s ? `${formatDateTime(s.paid_at)} ${zoneLabel()} · ${s.outlet_name}` : undefined}
        actions={s && <SaleStatusBadge status={s.status} long />}
      />
      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {!s && state.status === "loading" && (
        <div role="status" aria-label="Memuat transaksi" className={`${cardClass} mx-auto max-w-[560px] space-y-3 p-5`}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={`h-4 ${i % 3 === 0 ? "w-1/2" : "w-full"}`} />
          ))}
        </div>
      )}
      {s && <Receipt s={s} onSettle={state.status === "loading" ? undefined : () => setSettling(true)} />}
      <SettleCreditDialog sale={settling && s && isCreditOpen(s.status) ? s : null} onClose={() => setSettling(false)} onSettled={() => reload()} />
    </>
  );
}

function Line({ label, value, strong, tone }: { label: React.ReactNode; value: string; strong?: boolean; tone?: "danger" | "muted" }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${strong ? "text-[16px] font-bold text-text-heading" : "text-[14px] text-text-body"}`}>
      <span className="min-w-0">{label}</span>
      <span className={`shrink-0 tabular-nums ${tone === "danger" ? "text-danger" : tone === "muted" ? "text-text-muted" : ""}`}>{value}</span>
    </div>
  );
}

function Receipt({ s, onSettle }: { s: SaleDetail; onSettle?: () => void }) {
  const cancelled = s.status === "void" || s.status === "refunded";
  const outstanding = s.total - s.paid_total;
  const lineDiscounts = s.items.reduce((a, i) => a + i.discount, 0);
  const meta: [string, React.ReactNode][] = [
    ["Kasir", s.cashier_name],
    ["Outlet", s.outlet_name],
    ["Jenis pesanan", orderTypeLabel(s.order_type)],
  ];
  if (s.table_name) meta.push(["Meja", s.table_name]);
  if (s.queue_no !== null) meta.push(["No. antrean", String(s.queue_no)]);
  if (s.customer) meta.push(["Pelanggan", s.customer.phone ? `${s.customer.name} · ${s.customer.phone}` : s.customer.name]);
  else if (s.customer_name) meta.push(["Pelanggan", s.customer_name]);
  meta.push(["Metode", labelOf(METHODS, s.payment_method)]);
  if (s.due_at) meta.push(["Jatuh tempo", formatDateTime(s.due_at)]);
  if (s.settled_at && s.settled_at !== s.paid_at) meta.push(["Lunas pada", formatDateTime(s.settled_at)]);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4">
      {cancelled && (
        <Notice tone="danger" icon={<Ban size={17} aria-hidden />} title={s.status === "void" ? "Transaksi dibatalkan" : "Uang dikembalikan"}>
          <p>Alasan: {s.void_reason || "—"}</p>
          {s.approved_by_name && <p>Disetujui oleh {s.approved_by_name}</p>}
          <p className="mt-1 text-[13px]">Tidak dihitung dalam omzet.</p>
        </Notice>
      )}
      {isCreditOpen(s.status) && (
        <Notice tone="warning" title="Kasbon belum lunas">
          Sisa tagihan <strong className="font-semibold tabular-nums">{formatRupiah(outstanding)}</strong>
          {s.due_at ? ` · jatuh tempo ${formatDateTime(s.due_at)}` : ""}.
          <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" className={`${btn.primary} self-start`} onClick={onSettle} disabled={!onSettle}>
              <HandCoins size={16} aria-hidden /> Lunasi / bayar cicilan
            </button>
          </div>
          <p className="mt-2 text-[12.5px] text-text-body">{OUTSIDE_DRAWER_NOTE}</p>
        </Notice>
      )}

      <article className={`${cardClass} overflow-hidden`} aria-label={`Struk ${s.receipt_no}`}>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-b border-dashed border-border-active px-4 py-4 text-[13.5px] sm:px-5">
          {meta.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-text-muted">{k}</dt>
              <dd className="text-right font-medium text-text-heading">{v}</dd>
            </React.Fragment>
          ))}
        </dl>

        <ul className="divide-y divide-border-subtle px-4 sm:px-5">
          {s.items.map((it, i) => (
            <li key={i} className="py-3">
              <div className="flex items-baseline justify-between gap-4 text-[14px]">
                <span className="min-w-0 font-semibold text-text-heading">
                  {it.name}
                  {it.variant_name && <span className="font-normal text-text-body"> · {it.variant_name}</span>}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{formatRupiah(it.subtotal)}</span>
              </div>
              <p className="text-[13px] tabular-nums text-text-muted">
                {it.quantity.toLocaleString("id-ID")} × {formatRupiah(it.unit_price + it.modifiers.reduce((a, m) => a + m.price, 0))}
              </p>
              {it.modifiers.length > 0 && (
                <ul className="mt-0.5 text-[13px] text-text-body">
                  {it.modifiers.map((m, k) => (
                    <li key={k}>
                      + {m.name}
                      {m.price ? <span className="tabular-nums text-text-muted"> ({formatRupiah(m.price)})</span> : null}
                    </li>
                  ))}
                </ul>
              )}
              {it.discount > 0 && <p className="text-[13px] tabular-nums text-danger">Diskon item -{formatRupiah(it.discount)}</p>}
              {it.note && <p className="mt-0.5 text-[13px] italic text-text-muted">Catatan: {it.note}</p>}
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-1.5 border-t border-dashed border-border-active px-4 py-4 sm:px-5">
          <Line label="Subtotal" value={formatRupiah(s.subtotal)} />
          {lineDiscounts > 0 && <Line label="(sudah termasuk diskon item)" value={`-${formatRupiah(lineDiscounts)}`} tone="muted" />}
          {s.discounts.length > 0
            ? s.discounts.map((d, i) => <Line key={i} label={`Diskon · ${d.name}`} value={`-${formatRupiah(d.amount)}`} tone="danger" />)
            : s.discount_total > 0 && <Line label="Diskon" value={`-${formatRupiah(s.discount_total)}`} tone="danger" />}
          {s.service_fee > 0 && <Line label="Biaya layanan" value={formatRupiah(s.service_fee)} />}
          {s.taxes.length > 0
            ? s.taxes.map((t, i) => (
                <Line key={i} label={`${t.name} ${(t.rate_bp / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`} value={formatRupiah(t.amount)} />
              ))
            : s.tax_total > 0 && <Line label="Pajak" value={formatRupiah(s.tax_total)} />}
          {s.rounding !== 0 && <Line label="Pembulatan" value={formatRupiah(s.rounding)} />}
          <div className="mt-1 border-t border-border-subtle pt-2">
            <Line label="Total" value={formatRupiah(s.total)} strong />
          </div>
        </div>

        <div className="border-t border-dashed border-border-active px-4 py-4 sm:px-5">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-muted">Pembayaran</h2>
          {s.payments.length === 0 ? (
            <p className="text-[14px] text-text-muted">{s.status === "open" ? "Pesanan masih berjalan, belum dibayar." : "Belum ada pembayaran."}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {s.payments.map((p) => (
                <li key={p.id} className="text-[14px]">
                  <Line
                    label={
                      <>
                        <span className="font-medium text-text-heading">{p.amount < 0 ? `Pengembalian · ${labelOf(METHODS, p.method)}` : labelOf(METHODS, p.method)}</span>
                        <span className="block text-[12.5px] text-text-muted">
                          {formatDateTime(p.paid_at)}
                          {p.cashier_name ? ` · ${p.cashier_name}` : ""}
                        </span>
                      </>
                    }
                    value={formatRupiah(p.amount)}
                    tone={p.amount < 0 ? "danger" : undefined}
                  />
                  {p.received !== null && p.received !== undefined && p.received !== p.amount && p.amount > 0 && (
                    <p className="text-[12.5px] tabular-nums text-text-muted">
                      Diterima {formatRupiah(p.received)} · kembalian {formatRupiah(p.change ?? 0)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-col gap-1 border-t border-border-subtle pt-2">
            <Line label="Dibayar" value={formatRupiah(s.paid_total)} />
            {outstanding > 0 && !cancelled && s.status !== "open" && <Line label="Sisa (kasbon)" value={formatRupiah(outstanding)} tone="danger" />}
          </div>
        </div>

        {s.notes && (
          <p className="border-t border-dashed border-border-active px-4 py-3 text-[13.5px] text-text-body sm:px-5">
            <span className="font-semibold text-text-heading">Catatan:</span> {s.notes}
          </p>
        )}
      </article>
    </div>
  );
}
