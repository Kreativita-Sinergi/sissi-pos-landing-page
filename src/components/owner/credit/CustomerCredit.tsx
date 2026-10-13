"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CircleCheck, HandCoins, TriangleAlert } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, errorMessage, focusRing, formatRupiah, Notice, Spinner } from "@/components/admin/ui";
import { Segmented } from "@/components/owner/editing";
import { useOwner } from "@/components/owner/OwnerShell";
import { formatStamp } from "@/components/owner/parts";
import { OUTSIDE_DRAWER_NOTE, remainingOf, requestErrorMessage, SETTLE_METHODS, settleAll, type SettleAllSummary } from "@/lib/owner/credit";
import type { PaymentMethod, SaleListItem } from "@/lib/owner/types";
import { SettleCreditDialog } from "./SettleCreditDialog";

// Daftar kasbon satu pelanggan (detail pelanggan) dengan tombol Lunasi per transaksi + "Lunasi semua" (app:
// customer_detail_view.dart `_CreditCard` & settleAllCreditFlow).

export function CustomerCreditList({
  sales,
  onChanged,
  allowSettleAll = true,
}: {
  sales: SaleListItem[];
  /** Muat ulang data kasbon setelah ada pembayaran. */
  onChanged: () => void;
  allowSettleAll?: boolean;
}) {
  const { withOutlet } = useOwner();
  const [settling, setSettling] = useState<SaleListItem | null>(null);
  const [settleAllOpen, setSettleAllOpen] = useState(false);
  const open = sales.filter((s) => remainingOf(s) > 0);

  return (
    <>
      <ul className="mt-2 max-h-[280px] divide-y divide-border-subtle overflow-y-auto">
        {open.map((s) => (
          <li key={s.id} className="flex items-center gap-2 py-1.5 text-[13px]">
            <Link href={withOutlet(`/dasbor/transaksi/${s.id}`)} className={`flex min-w-0 flex-1 items-center gap-2 rounded hover:underline ${focusRing}`}>
              <span className="min-w-0">
                <span className="block tabular-nums">{s.receipt_no}</span>
                <span className="block text-[12px] tabular-nums text-text-muted">{formatStamp(s.paid_at)}</span>
              </span>
              <span className="ml-auto font-semibold tabular-nums text-danger">{formatRupiah(remainingOf(s))}</span>
            </Link>
            <button type="button" className={`${btn.secondary} min-h-8 px-2.5 text-[12.5px]`} onClick={() => setSettling(s)} aria-label={`Lunasi ${s.receipt_no}`}>
              Lunasi
            </button>
          </li>
        ))}
      </ul>
      {allowSettleAll && open.length > 1 && (
        <button type="button" className={`${btn.primary} mt-2 w-full`} onClick={() => setSettleAllOpen(true)}>
          <HandCoins size={16} aria-hidden /> Lunasi semua
        </button>
      )}
      <SettleCreditDialog sale={settling} onClose={() => setSettling(null)} onSettled={onChanged} />
      <SettleAllDialog open={settleAllOpen} sales={open} onClose={() => setSettleAllOpen(false)} onChanged={onChanged} />
    </>
  );
}

function SettleAllDialog({
  open,
  sales,
  onClose,
  onChanged,
}: {
  open: boolean;
  sales: SaleListItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // Isi dialog dibekukan saat dibuka agar daftar tidak berubah ketika data dimuat ulang di belakang.
  const [frozen, setFrozen] = useState<SaleListItem[]>([]);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFrozen(sales);
  }
  // Data dimuat ulang saat dialog ditutup — bila langsung, daftar kosong melepas dialog ini sebelum ringkasan terbaca.
  const [paid, setPaid] = useState(false);
  const close = () => {
    onClose();
    if (paid) {
      setPaid(false);
      onChanged();
    }
  };
  const total = frozen.reduce((a, s) => a + remainingOf(s), 0);
  return (
    <Modal open={open} title={`Lunasi semua · ${formatRupiah(total)}`} onClose={close} dismissible={!busy} icon={<HandCoins size={20} aria-hidden className="text-brand-ink" />}>
      {open && <SettleAllBody sales={frozen} total={total} busy={busy} setBusy={setBusy} onClose={close} onChanged={() => setPaid(true)} />}
    </Modal>
  );
}

function SettleAllBody({
  sales,
  total,
  busy,
  setBusy,
  onClose,
  onChanged,
}: {
  sales: SaleListItem[];
  total: number;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const { session } = useOwner();
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SettleAllSummary | null>(null);
  const methodLabel = SETTLE_METHODS.find((m) => m.value === method)?.label ?? method;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await settleAll(sales, method, session.user.id);
      setResult(r);
      if (r.paidCount > 0) {
        onChanged();
        toast.success(`Kasbon ${formatRupiah(r.paidAmount)} dilunasi.`);
      }
      if (r.failedCount > 0) toast.error(`${r.failedCount} transaksi gagal dilunasi.`);
    } catch (err) {
      setError(requestErrorMessage(err, errorMessage));
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const failed = result.items.filter((i) => !i.ok);
    return (
      <div className="flex flex-col gap-3">
        {result.paidCount > 0 && (
          <Notice tone="success" icon={<CircleCheck size={17} aria-hidden />} title={`${result.paidCount} transaksi lunas`}>
            Total {formatRupiah(result.paidAmount)} dicatat dengan {methodLabel}.
          </Notice>
        )}
        {failed.length > 0 && (
          <Notice tone="danger" icon={<TriangleAlert size={17} aria-hidden />} title={`${failed.length} transaksi gagal`}>
            <ul className="mt-1 flex flex-col gap-1 text-[13px]">
              {failed.map((i) => (
                <li key={i.sale.id}>
                  <span className="font-semibold tabular-nums">{i.sale.receipt_no}</span> — {i.message}
                </li>
              ))}
            </ul>
          </Notice>
        )}
        <div className="flex justify-end">
          <button type="button" className={btn.primary} onClick={onClose} autoFocus>
            Selesai
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
      <p>
        {sales.length.toLocaleString("id-ID")} transaksi senilai <strong className="font-semibold tabular-nums text-text-heading">{formatRupiah(total)}</strong> dicatat
        lunas dengan {methodLabel}. Tiap transaksi dilunasi sebesar sisanya, berurutan dari yang terlama.
      </p>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Cara bayar</p>
        <Segmented<PaymentMethod> label="Cara bayar" value={method} onChange={setMethod} options={SETTLE_METHODS} />
      </div>
      <Notice tone={method === "cash" ? "warning" : "info"}>
        {method === "cash" && <p className="font-semibold">Uang tunai ini tidak masuk laci kasir</p>}
        <p className="text-[13.5px]">{OUTSIDE_DRAWER_NOTE}</p>
      </Notice>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button type="button" className={btn.primary} onClick={() => void run()} disabled={busy || sales.length === 0}>
          {busy && <Spinner />}
          Lunasi semua
        </button>
      </div>
    </div>
  );
}
