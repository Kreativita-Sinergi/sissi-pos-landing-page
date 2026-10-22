"use client";

import React, { useId, useState } from "react";
import { AlertTriangle, Ban, Info, Wallet } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, errorMessage, Field, focusRing, formatRupiah, inputClass, Notice, Spinner } from "@/components/admin/ui";
import {
  CANCEL_REASONS,
  type CancelKind,
  cancelProblem,
  cancelSale,
  canRefund,
  canVoid,
  isDepositRefund,
  isPreorderDeposit,
  isPreorderWithoutDeposit,
  reservationStillActive,
  REFUND_METHODS,
  refundPlan,
  type RefundLine,
} from "@/lib/owner/cancelSale";
import type { PaymentMethod, SaleDetail } from "@/lib/owner/types";
import { hasPartialRefund, netTotalOf, refundedTotalOf } from "@/lib/owner/saleRefunds";
import { Segmented } from "./editing";
import { labelOf, METHODS } from "./labels";
import { useOwner } from "./OwnerShell";

// Panel "Batalkan / Refund" transaksi (alur & label mengikuti app: cancel_sale_sheet.dart): jenis pembatalan, alasan
// (pilihan cepat + keterangan), uang yang dikembalikan per metode asal (bisa dikembalikan lewat metode lain), lalu
// konfirmasi tegas. Dari web pengembalian tidak masuk laci kasir mana pun (`shift_id` null). Sesudah refund sebagian
// hanya sisa uang per metode yang dikembalikan; pesanan awal reservasi ikut dihapus saat DP dikembalikan.

export function CancelSaleDialog({
  sale,
  kind,
  onClose,
  onDone,
}: {
  /** Transaksi; `null` = tertutup. */
  sale: SaleDetail | null;
  kind: CancelKind;
  onClose: () => void;
  /** `reload` = muat ulang detail (berhasil, atau data server berubah). */
  onDone: (reload: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const title =
    sale && isDepositRefund(sale)
      ? isPreorderWithoutDeposit(sale)
        ? "Hapus pesanan awal"
        : "Kembalikan DP"
      : kind === "refunded"
        ? "Refund transaksi"
        : "Batalkan transaksi";
  return (
    <Modal open={sale !== null} title={sale ? `${title} · ${sale.receipt_no}` : title} onClose={onClose} dismissible={!busy} icon={<Ban size={20} aria-hidden className="text-danger" />}>
      {sale && <CancelBody key={`${sale.id}:${kind}`} sale={sale} initialKind={kind} busy={busy} setBusy={setBusy} onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function CancelBody({
  sale,
  initialKind,
  busy,
  setBusy,
  onClose,
  onDone,
}: {
  sale: SaleDetail;
  initialKind: CancelKind;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  onDone: (reload: boolean) => void;
}) {
  const uid = useId();
  const toast = useToast();
  const { session } = useOwner();
  const plan = refundPlan(sale.payments);
  const [kind, setKind] = useState<CancelKind>(initialKind);
  const [reason, setReason] = useState("");
  const [methods, setMethods] = useState<Record<string, PaymentMethod>>(() =>
    Object.fromEntries(plan.map((p) => [p.method, (REFUND_METHODS.some((m) => m.value === p.method) ? p.method : "cash") as PaymentMethod]))
  );
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const refunds: RefundLine[] = plan.map((p) => ({ from: p.method, method: methods[p.method] ?? "cash", amount: p.amount }));
  const total = refunds.reduce((a, r) => a + r.amount, 0);
  const problem = cancelProblem({ kind, reason, refunds });
  const bothKinds = canVoid(sale.status) && canRefund(sale.status);
  const cashBack = refunds.some((r) => r.method === "cash");
  const isRefund = kind === "refunded";
  const deposit = isDepositRefund(sale);
  const preorder = deposit && isPreorderDeposit(sale);
  // Pesanan awal tanpa DP: tidak ada DP yang dikembalikan — istilah app "Hapus pesanan awal".
  const preorderOnly = deposit && isPreorderWithoutDeposit(sale);
  // Reservasi masih Direservasi: pembatalan ini hanya menutup transaksinya, bukan reservasinya.
  const stillActive = deposit && reservationStillActive(sale);
  const partial = hasPartialRefund(sale);
  const actionLabel = deposit
    ? preorderOnly || (preorder && total === 0)
      ? "Hapus pesanan awal"
      : `Kembalikan DP ${formatRupiah(total)}`
    : isRefund
      ? `Refund ${formatRupiah(total)}`
      : total > 0
        ? `Batalkan & kembalikan ${formatRupiah(total)}`
        : "Batalkan transaksi";

  const submit = async () => {
    if (problem) return;
    setBusy(true);
    setServerError(null);
    try {
      const r = await cancelSale(sale, { kind, reason, refunds }, session.user.id);
      if (r.ok) {
        toast.success(
          preorderOnly
            ? `Pesanan awal ${sale.receipt_no} dihapus`
            : deposit
              ? `DP ${sale.receipt_no} dikembalikan`
              : isRefund
                ? `Refund ${sale.receipt_no} dicatat`
                : `Transaksi ${sale.receipt_no} dibatalkan`
        );
        onDone(true);
        onClose();
      } else {
        setServerError(r.message);
        setStep("form");
        if (r.reload) onDone(true);
      }
    } catch (err) {
      setServerError(errorMessage(err));
      setStep("form");
    } finally {
      setBusy(false);
    }
  };

  const moneyNote = (
    <Notice tone={cashBack ? "warning" : "info"} icon={cashBack ? <Wallet size={17} aria-hidden /> : <Info size={17} aria-hidden />}>
      {cashBack ? (
        <>
          <p className="font-semibold">Uang tunai dikembalikan di luar laci kasir</p>
          <p className="text-[13.5px]">Pengembalian dari dasbor tidak mengurangi kas shift mana pun. Pastikan uangnya benar-benar dikembalikan ke pelanggan.</p>
        </>
      ) : (
        <p className="text-[13.5px]">Pengembalian dari dasbor dicatat di luar laci kasir; kembalikan uangnya lewat metode yang dipilih.</p>
      )}
    </Notice>
  );

  const stockNote = (
    <p className="flex items-start gap-1.5 text-[12.5px] text-text-muted">
      <Info size={14} aria-hidden className="mt-0.5 shrink-0" />
      Stok barang yang terjual dan poin pelanggan dari transaksi ini dikembalikan otomatis, sama seperti pembatalan di aplikasi.
    </p>
  );

  if (step === "confirm") {
    return (
      <div className="flex flex-col gap-4">
        <Notice tone="danger" icon={<AlertTriangle size={17} aria-hidden />} title={isRefund ? "Refund tidak bisa dibatalkan" : "Pembatalan tidak bisa diurungkan"}>
          <p className="text-[13.5px]">
            {preorderOnly
              ? `Pesanan awal ${sale.receipt_no} (${sale.items_count.toLocaleString("id-ID")} porsi) dihapus dan transaksinya ditutup. Belum dimasak dan tidak ada DP yang perlu dikembalikan. `
              : deposit
                ? `DP reservasi ${sale.receipt_no} (${formatRupiah(sale.paid_total)}) akan dikembalikan dan transaksinya ditutup${preorder ? "; pesanan awalnya ikut dihapus" : ""}. ${stillActive ? "Reservasinya tetap aktif (Direservasi); bila tamu datang, pesanannya dilayani sebagai pesanan biasa. " : ""}`
                : `Transaksi ${sale.receipt_no} (${formatRupiah(partial ? netTotalOf(sale) : sale.total)}${partial ? " setelah refund sebagian" : ""}) akan ${isRefund ? "dicatat sebagai refund" : "dibatalkan"} dan tidak dihitung dalam penjualan. `}
            Tercatat di Aktivitas atas nama {session.user.name}.
          </p>
        </Notice>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-[12px] border border-border-subtle px-3.5 py-3 text-[14px]">
          <dt className="text-text-muted">Jenis</dt>
          <dd className="text-right font-semibold">{preorderOnly ? "Hapus pesanan awal" : deposit ? "Kembalikan DP" : isRefund ? "Refund penuh" : "Void"}</dd>
          <dt className="text-text-muted">Alasan</dt>
          <dd className="text-right font-semibold break-words">{reason.trim()}</dd>
          {refunds.map((r) => (
            <React.Fragment key={r.from}>
              <dt className="text-text-muted">Kembalikan lewat {labelOf(METHODS, r.method)}</dt>
              <dd className="text-right font-semibold tabular-nums">{formatRupiah(r.amount)}</dd>
            </React.Fragment>
          ))}
          <dt className="text-text-muted">Uang dikembalikan</dt>
          <dd className="text-right font-bold tabular-nums">{formatRupiah(total)}</dd>
        </dl>
        {total > 0 && moneyNote}
        {!deposit && stockNote}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btn.secondary} onClick={() => setStep("form")} disabled={busy}>
            Kembali
          </button>
          <button type="button" className={btn.danger} onClick={() => void submit()} disabled={busy}>
            {busy && <Spinner />}
            {actionLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        setServerError(null);
        if (!problem) setStep("confirm");
      }}
    >
      {serverError && (
        <Notice tone="danger" role="alert">
          {serverError}
        </Notice>
      )}
      {partial && (
        <Notice tone="info" icon={<Info size={17} aria-hidden />}>
          <p className="text-[13.5px]">
            Transaksi ini sudah direfund sebagian {formatRupiah(refundedTotalOf(sale))}. Yang dikembalikan sekarang hanya sisa uangnya per metode.
          </p>
        </Notice>
      )}
      {preorder && (
        <Notice tone="info" icon={<Info size={17} aria-hidden />}>
          <p className="text-[13.5px]">
            {preorderOnly
              ? `Pesanan awal (${sale.items_count.toLocaleString("id-ID")} porsi) dihapus${stillActive ? "; reservasinya tetap aktif (Direservasi)" : ""}. Belum dimasak, stok belum terpotong, dan tidak ada DP yang perlu dikembalikan.`
              : "Reservasi ini punya pesanan awal. Pesanan awal ikut dihapus saat DP dikembalikan (belum dimasak, stok belum terpotong)."}
          </p>
        </Notice>
      )}
      {bothKinds && (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Jenis</p>
          <Segmented<CancelKind>
            label="Jenis pembatalan"
            value={kind}
            onChange={setKind}
            options={[
              { value: "refunded", label: "Refund penuh" },
              { value: "void", label: "Void" },
            ]}
          />
          <p className="mt-1.5 text-[12.5px] text-text-muted">
            {isRefund ? "Uang dikembalikan ke pelanggan; transaksi tercatat sebagai refund." : "Transaksi dianggap tidak terjadi (mis. salah input). Datanya tetap tersimpan."}
          </p>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Alasan</p>
        <div className="mb-2 flex flex-wrap gap-2" role="group" aria-label="Pilihan cepat alasan">
          {CANCEL_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={reason.trim() === r}
              onClick={() => setReason(r)}
              className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-medium transition-colors ${
                reason.trim() === r ? "border-brand-primary bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-body hover:border-border-active"
              } ${focusRing}`}
            >
              {r}
            </button>
          ))}
        </div>
        <Field id={`${uid}-reason`} label="Keterangan alasan" error={touched && problem ? problem : undefined}>
          <textarea
            id={`${uid}-reason`}
            className={`${inputClass} min-h-[64px] py-2`}
            value={reason}
            maxLength={200}
            placeholder="Contoh: pelanggan membatalkan pesanan"
            aria-invalid={(touched && !!problem) || undefined}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </div>

      <div className="rounded-[12px] border border-border-subtle px-3.5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-semibold text-text-heading">Uang dikembalikan</span>
          <span className="text-[18px] font-bold tabular-nums">{formatRupiah(total)}</span>
        </div>
        {plan.length === 0 ? (
          <p className="mt-1 text-[13px] text-text-muted">Belum ada uang yang diterima — tidak ada yang perlu dikembalikan.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-3">
            {refunds.map((r) => (
              <li key={r.from} className="flex flex-col gap-1.5">
                <span className="text-[13px] text-text-body">
                  {partial ? "Sisa" : "Dibayar"} {labelOf(METHODS, r.from)} <strong className="tabular-nums">{formatRupiah(r.amount)}</strong> · kembalikan lewat:
                </span>
                <Segmented<PaymentMethod>
                  label={`Kembalikan ${labelOf(METHODS, r.from)} lewat`}
                  value={r.method}
                  onChange={(m) => setMethods({ ...methods, [r.from]: m })}
                  options={REFUND_METHODS}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
      {total > 0 && moneyNote}
      {/* DP/pesanan awal tidak memotong stok (pesanan awal belum dimasak) — catatan stok hanya untuk transaksi biasa. */}
      {!deposit && stockNote}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button type="submit" className={btn.danger} disabled={busy}>
          Lanjut
        </button>
      </div>
    </form>
  );
}
