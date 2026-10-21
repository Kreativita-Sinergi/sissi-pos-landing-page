"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, CalendarClock, HandCoins, ReceiptText, ShieldAlert, Undo2 } from "lucide-react";
import { ApiError } from "@/lib/sissiApi";
import { btn, cardClass, EmptyState, ErrorBlock, focusRing, formatRupiah, Notice, PageHeader, Skeleton, useLoad } from "@/components/admin/ui";
import { formatDateTime, zoneLabel } from "@/lib/owner/tz";
import { ownerApi } from "@/lib/owner/api";
import { isCreditOpen, OUTSIDE_DRAWER_NOTE } from "@/lib/owner/credit";
import type { SaleDetail } from "@/lib/owner/types";
import { labelOf, METHODS, orderTypeLabel, PAYMENT_PURPOSE } from "./labels";
import { useOwner } from "./OwnerShell";
import { SettleCreditDialog } from "./credit/SettleCreditDialog";
import { CancelSaleDialog } from "./CancelSaleDialog";
import {
  canDeletePreorderFromWeb,
  canRefund,
  canVoid,
  isDepositRefund,
  isPreorderDeposit,
  isPreorderWithoutDeposit,
  type CancelKind,
} from "@/lib/owner/cancelSale";
import { hasPartialRefund, netTotalOf, outstandingOf, receiptTotals, refundedQtyByIndex, refundedTotalOf, refundEntries } from "@/lib/owner/saleRefunds";
import { discountApprover, isDiscountUnapproved, lineDiscountReason } from "@/lib/owner/saleDiscount";
import { isHeldDeposit, SaleRowBadge } from "./parts";

// Detail transaksi (GET /owner/sales/{id}) dalam bentuk struk. Kasbon (`unpaid|partial`) bisa dilunasi/dicicil dari
// sini (POST /owner/changes `sale_payments`, di luar laci kasir) — tersedia juga untuk paket Gratis (pelunasan kasbon
// tetap boleh, api.md "Batas transaksi Gratis"). Transaksi juga bisa dibatalkan (void) / direfund dari sini (api.md
// "Nomor 14": `sales` upsert status void/refunded + pengembalian negatif di luar laci kasir). Transaksi DP reservasi
// (`deposit`, api.md "DP reservasi" › Dasbor pemilik) diberi label & penjelasan; DP yang masih dipegang bisa
// dikembalikan ("Kembalikan DP" = pembatalan ber-`deposit_refund`), DP hangus tetap lewat aplikasi. DP yang sudah
// ber-item = pesanan awal reservasi (B3; item & total = perkiraan). Refund sebagian per item (dicatat dari aplikasi)
// ditampilkan per baris (qty kembali), riwayatnya, dan total sesudah refund (api.md "Refund sebagian per item").

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
  const [cancelling, setCancelling] = useState<CancelKind | null>(null);
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
        actions={s && <SaleRowBadge s={s} long />}
      />
      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {!s && state.status === "loading" && (
        <div role="status" aria-label="Memuat transaksi" className={`${cardClass} mx-auto max-w-[560px] space-y-3 p-5`}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={`h-4 ${i % 3 === 0 ? "w-1/2" : "w-full"}`} />
          ))}
        </div>
      )}
      {s && (
        <Receipt
          s={s}
          onSettle={state.status === "loading" ? undefined : () => setSettling(true)}
          onCancel={state.status === "loading" ? undefined : (k) => setCancelling(k)}
        />
      )}
      <CancelSaleDialog sale={cancelling && s ? s : null} kind={cancelling ?? "void"} onClose={() => setCancelling(null)} onDone={(again) => again && reload()} />
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

function Receipt({ s, onSettle, onCancel }: { s: SaleDetail; onSettle?: () => void; onCancel?: (kind: CancelKind) => void }) {
  const cancelled = s.status === "void" || s.status === "refunded";
  // Bukan `total − paid_total`: paid_total sudah dikurangi uang refund sebagian (kasbon palsu pada transaksi lunas).
  const outstanding = outstandingOf(s);
  const heldDeposit = isHeldDeposit(s);
  const depositRefund = isDepositRefund(s);
  const preorder = isPreorderDeposit(s);
  const preorderOnly = isPreorderWithoutDeposit(s);
  const partial = hasPartialRefund(s);
  const refunded = refundedTotalOf(s);
  const totals = receiptTotals(s);
  const returnedQty = refundedQtyByIndex(s.refunds);
  const history = refundEntries(s);
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
  const approver = discountApprover(s);
  if (approver) meta.push(["Diskon disetujui", approver]);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4">
      {cancelled && (
        <Notice
          tone="danger"
          icon={<Ban size={17} aria-hidden />}
          title={
            s.deposit === "refunded"
              ? s.payments.length > 0
                ? "DP dikembalikan"
                : "Reservasi ditutup"
              : s.status === "void"
                ? "Transaksi dibatalkan"
                : "Uang dikembalikan"
          }
        >
          <p>Alasan: {s.void_reason || "—"}</p>
          {s.approved_by_name && <p>Disetujui oleh {s.approved_by_name}</p>}
          <p className="mt-1 text-[13px]">Tidak dihitung dalam omzet.</p>
        </Notice>
      )}
      {isDiscountUnapproved(s) && (
        <Notice tone="danger" icon={<ShieldAlert size={17} aria-hidden />} title="Diskon tanpa persetujuan pemilik">
          <p>
            {s.cashier_name} memberi diskon manual saat setelan &ldquo;Diskon oleh kasir butuh PIN pemilik&rdquo; aktif, tanpa PIN pemilik
            (misalnya dari aplikasi kasir versi lama). Transaksi tetap tercatat apa adanya.
          </p>
          {approver && (
            <p className="mt-1 text-[13px]">
              PIN {approver} yang dimasukkan kemudian hanya menyetujui diskon yang diubah saat itu, bukan diskon sebelumnya.
            </p>
          )}
          <p className="mt-1 text-[13px]">Periksa dengan kasir, dan perbarui aplikasi di semua perangkat kasir.</p>
        </Notice>
      )}
      {partial && (
        <Notice tone="warning" icon={<Undo2 size={17} aria-hidden />} title={`Refund sebagian ${formatRupiah(refunded)}`}>
          <p>
            Sebagian barang sudah dikembalikan. Total setelah refund <strong className="font-semibold tabular-nums">{formatRupiah(netTotalOf(s))}</strong>{" "}
            (dari {formatRupiah(s.total)}) — angka inilah yang dihitung omzet pada tanggal transaksi.
          </p>
        </Notice>
      )}
      {heldDeposit && (
        <Notice
          tone={s.deposit === "to_process" ? "warning" : "info"}
          icon={<CalendarClock size={17} aria-hidden />}
          title={
            preorderOnly
              ? s.deposit === "to_process"
                ? "Pesanan awal perlu dihapus"
                : "Pesanan awal · tamu belum datang"
              : s.deposit === "to_process"
                ? "DP perlu diproses"
                : "DP reservasi · tamu belum datang"
          }
        >
          {s.paid_total > 0 ? (
            <p>
              Uang muka <strong className="font-semibold tabular-nums">{formatRupiah(s.paid_total)}</strong> dipegang untuk reservasi meja dan belum
              dihitung omzet maupun pesanan berjalan. Omzet dicatat pada hari tamu datang dan ditagih.
            </p>
          ) : (
            <p>Reservasi meja tanpa DP. Belum dihitung omzet maupun pesanan berjalan; omzet dicatat pada hari tamu datang dan ditagih.</p>
          )}
          {preorder && (
            <p className="mt-1 text-[13px]">
              Ada pesanan awal (menu dipesan di muka). Harga item dikunci saat dipesan; promo, diskon, biaya layanan, dan pembulatan dihitung ulang
              saat tamu datang dan ditagih, jadi totalnya masih perkiraan.
            </p>
          )}
          {s.deposit === "to_process" && (
            <p className="mt-1 text-[13px]">
              {preorderOnly
                ? "Reservasinya dibatalkan atau tamu tidak datang. Hapus pesanan awalnya dari sini atau lewat aplikasi kasir (Meja › Reservasi); tidak ada DP yang perlu dikembalikan."
                : "Reservasinya dibatalkan atau tamu tidak datang. Kembalikan DP dari sini, atau jadikan DP hangus lewat aplikasi kasir (Meja › Reservasi)."}
            </p>
          )}
        </Notice>
      )}
      {s.deposit === "forfeited" && (
        <Notice tone="info" icon={<CalendarClock size={17} aria-hidden />} title="DP hangus">
          Tamu batal atau tidak datang dan DP tidak dikembalikan. DP hangus dihitung sebagai omzet pada hari diproses.
        </Notice>
      )}
      {s.deposit === "order" && !cancelled && (
        <p className="text-[13px] text-text-muted">Pesanan dari reservasi ber-DP — DP terpotong sebagai pembayaran.</p>
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

        {preorder && (
          <h2 className="px-4 pt-4 text-[13px] font-semibold uppercase tracking-wide text-text-muted sm:px-5">Pesanan awal · perkiraan</h2>
        )}
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
              {it.discount > 0 && (
                <p className="text-[13px] text-danger">
                  <span className="tabular-nums">Diskon item -{formatRupiah(it.discount)}</span>
                  {lineDiscountReason(it) && <span className="text-text-muted"> · Alasan: {lineDiscountReason(it)}</span>}
                </p>
              )}
              {it.note && <p className="mt-0.5 text-[13px] italic text-text-muted">Catatan: {it.note}</p>}
              {(returnedQty.get(i) ?? 0) > 0 && (
                <p className="text-[13px] font-medium tabular-nums text-danger">
                  Dikembalikan {(returnedQty.get(i) ?? 0).toLocaleString("id-ID")} dari {it.quantity.toLocaleString("id-ID")}
                </p>
              )}
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
            <Line label={preorder ? "Perkiraan total" : "Total"} value={formatRupiah(s.total)} strong={totals.totalStrong} />
            {/* Batal/refund penuh sesudah refund sebagian: hanya riwayat, tanpa "Total setelah refund". */}
            {totals.refunded !== null && <Line label="Refund sebagian" value={`-${formatRupiah(totals.refunded)}`} tone="danger" />}
            {totals.netTotal !== null && <Line label="Total setelah refund" value={formatRupiah(totals.netTotal)} strong />}
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
                        <span className="font-medium text-text-heading">
                          {p.purpose
                            ? `${labelOf(PAYMENT_PURPOSE, p.purpose)} · ${labelOf(METHODS, p.method)}`
                            : p.amount < 0
                              ? `Pengembalian · ${labelOf(METHODS, p.method)}`
                              : labelOf(METHODS, p.method)}
                        </span>
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

        {history.length > 0 && (
          <div className="border-t border-dashed border-border-active px-4 py-4 sm:px-5">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-text-muted">Riwayat refund sebagian</h2>
            <ul className="flex flex-col gap-3">
              {history.map((r) => (
                <li key={r.id} className="text-[14px]">
                  <Line
                    label={
                      <>
                        <span className="font-medium text-text-heading">
                          Refund sebagian{r.methods.length ? ` · ${r.methods.map((m) => labelOf(METHODS, m)).join(", ")}` : ""}
                        </span>
                        <span className="block text-[12.5px] text-text-muted">
                          {formatDateTime(r.at)}
                          {r.reason ? ` · ${r.reason}` : ""}
                        </span>
                      </>
                    }
                    value={`-${formatRupiah(r.amount)}`}
                    tone="danger"
                  />
                  <ul className="mt-0.5 text-[13px] text-text-body">
                    {r.lines.map((l, k) => (
                      <li key={k} className="flex justify-between gap-4">
                        <span className="min-w-0">
                          {l.quantity.toLocaleString("id-ID")} × {l.name}
                          {l.variant_name ? ` · ${l.variant_name}` : ""}
                        </span>
                        <span className="shrink-0 tabular-nums text-text-muted">{formatRupiah(l.amount)}</span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        )}

        {s.notes && (
          <p className="border-t border-dashed border-border-active px-4 py-3 text-[13.5px] text-text-body sm:px-5">
            <span className="font-semibold text-text-heading">Catatan:</span> {s.notes}
          </p>
        )}
      </article>
      {!cancelled && canVoid(s.status) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {canRefund(s.status) && (
            <button type="button" className={`${btn.secondary} text-danger`} onClick={() => onCancel?.("refunded")} disabled={!onCancel}>
              <Undo2 size={16} aria-hidden /> {partial ? "Refund sisa" : "Refund"}
            </button>
          )}
          {canDeletePreorderFromWeb(s) ? (
            <button type="button" className={`${btn.secondary} text-danger`} onClick={() => onCancel?.("void")} disabled={!onCancel}>
              {depositRefund ? <Undo2 size={16} aria-hidden /> : <Ban size={16} aria-hidden />}{" "}
              {depositRefund ? (preorderOnly ? "Hapus pesanan awal" : "Kembalikan DP") : "Batalkan transaksi"}
            </button>
          ) : (
            // Reservasi masih Direservasi: pesanan awal diubah/dihapus lewat aplikasi.
            <p className="text-[12.5px] text-text-muted sm:text-right">Reservasi masih aktif — ubah atau hapus pesanan awal lewat aplikasi kasir.</p>
          )}
        </div>
      )}
    </div>
  );
}
