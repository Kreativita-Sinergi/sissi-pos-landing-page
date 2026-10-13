"use client";

import React, { useId, useState } from "react";
import { HandCoins, Info, Wallet } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, errorMessage, Field, focusRing, formatRupiah, Notice, Spinner } from "@/components/admin/ui";
import { NumberInput, Segmented } from "@/components/owner/editing";
import { useOwner } from "@/components/owner/OwnerShell";
import {
  OUTSIDE_DRAWER_NOTE,
  remainingOf,
  requestErrorMessage,
  SETTLE_METHODS,
  settleCredit,
  settleProblem,
  type SettleTarget,
} from "@/lib/owner/credit";
import { formatDateTime } from "@/lib/owner/tz";
import type { PaymentMethod } from "@/lib/owner/types";

// Panel "Lunasi kasbon" (alur & label mengikuti app: settle_credit_sheet.dart): sisa kasbon, Lunas/Sebagian, cara
// bayar, uang diterima & kembalian (tunai), lalu konfirmasi. Bedanya dengan app: pembayaran dari web tidak masuk
// shift/laci kasir mana pun (`shift_id` null).

export type SettleSale = SettleTarget & {
  receipt_no: string;
  customer_name: string | null;
  paid_at: string;
  due_at?: string | null;
};

export function SettleCreditDialog({
  sale,
  onClose,
  onSettled,
}: {
  /** Transaksi yang dilunasi; `null` = tertutup. */
  sale: SettleSale | null;
  onClose: () => void;
  /** Dipanggil setelah server menerima pembayaran (`paidOff` = transaksi kini lunas). */
  onSettled: (info: { amount: number; paidOff: boolean }) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={sale !== null} title="Lunasi kasbon" onClose={onClose} dismissible={!busy} icon={<HandCoins size={20} aria-hidden className="text-brand-ink" />}>
      {sale && <SettleBody key={`${sale.id}:${sale.paid_total}`} sale={sale} busy={busy} setBusy={setBusy} onClose={onClose} onSettled={onSettled} />}
    </Modal>
  );
}

/** Saran uang tunai di atas nominal (pecahan umum), seperti app. */
function cashSuggestions(amount: number): number[] {
  const out = new Set<number>();
  for (const step of [5_000, 10_000, 20_000, 50_000, 100_000]) {
    const v = Math.ceil(amount / step) * step;
    if (v > amount) out.add(v);
    if (out.size >= 3) break;
  }
  return [...out];
}

function SettleBody({
  sale,
  busy,
  setBusy,
  onClose,
  onSettled,
}: {
  sale: SettleSale;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  onSettled: (info: { amount: number; paidOff: boolean }) => void;
}) {
  const uid = useId();
  const toast = useToast();
  const { session } = useOwner();
  const remaining = remainingOf(sale);
  const [full, setFull] = useState(true);
  const [partial, setPartial] = useState(NaN);
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [received, setReceived] = useState(remaining);
  const [receivedTouched, setReceivedTouched] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const amount = full ? remaining : partial;
  const cash = method === "cash";
  // Uang diterima mengikuti nominal sampai diubah sendiri.
  const receivedValue = receivedTouched ? received : Number.isFinite(amount) ? amount : NaN;
  const change = cash && Number.isFinite(receivedValue) && Number.isFinite(amount) ? Math.max(0, receivedValue - amount) : 0;
  const problem = settleProblem(remaining, { method, amount, received: receivedValue });
  const after = Number.isFinite(amount) ? Math.max(0, remaining - amount) : remaining;
  const methodLabel = SETTLE_METHODS.find((m) => m.value === method)?.label ?? method;
  const name = sale.customer_name?.trim() || "";

  const next = () => {
    setTouched(true);
    setServerError(null);
    if (problem) return;
    setStep("confirm");
  };

  const submit = async () => {
    if (problem) return;
    setBusy(true);
    setServerError(null);
    try {
      const r = await settleCredit(sale, { method, amount, received: receivedValue }, session.user.id);
      if (r.ok) {
        const paidOff = amount >= remaining;
        toast.success(paidOff ? `Kasbon lunas · ${formatRupiah(amount)} diterima.` : `Pembayaran kasbon ${formatRupiah(amount)} diterima.`);
        onSettled({ amount, paidOff });
        onClose();
      } else {
        setServerError(r.message);
        setStep("form");
      }
    } catch (err) {
      setServerError(requestErrorMessage(err, errorMessage));
      setStep("form");
    } finally {
      setBusy(false);
    }
  };

  const err = (f: "amount" | "received") => (touched && problem?.field === f ? problem.message : undefined);

  const header = (
    <div className="rounded-[12px] bg-bg-muted px-3.5 py-3">
      <p className="font-semibold text-text-heading">{name ? `${name} · ${sale.receipt_no}` : sale.receipt_no}</p>
      <p className="text-[12.5px] text-text-muted">
        Kasbon sejak {formatDateTime(sale.paid_at)}
        {sale.due_at ? ` · jatuh tempo ${formatDateTime(sale.due_at)}` : ""}
      </p>
    </div>
  );

  const drawerNote = (
    <Notice tone={cash ? "warning" : "info"} icon={cash ? <Wallet size={17} aria-hidden /> : <Info size={17} aria-hidden />}>
      {cash ? (
        <>
          <p className="font-semibold">Uang tunai ini tidak masuk laci kasir</p>
          <p className="text-[13.5px]">{OUTSIDE_DRAWER_NOTE} Simpan uangnya terpisah dari kas shift.</p>
        </>
      ) : (
        <p className="text-[13.5px]">{OUTSIDE_DRAWER_NOTE}</p>
      )}
    </Notice>
  );

  if (step === "confirm") {
    const rows: [string, string][] = [
      ["Cara bayar", methodLabel],
      ["Nominal dibayar", formatRupiah(amount)],
    ];
    if (cash) {
      rows.push(["Uang diterima", formatRupiah(receivedValue)]);
      rows.push(["Kembalian", formatRupiah(change)]);
    }
    rows.push(["Sisa setelah ini", after > 0 ? formatRupiah(after) : "Lunas"]);
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className="text-[14px] text-text-body">Catat pembayaran ini? Pembayaran tidak dapat diubah atau dihapus setelah dicatat.</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-[12px] border border-border-subtle px-3.5 py-3 text-[14px]">
          {rows.map(([k, v]) => (
            <React.Fragment key={k}>
              <dt className="text-text-muted">{k}</dt>
              <dd className={`text-right font-semibold tabular-nums ${k === "Sisa setelah ini" && after === 0 ? "text-success" : "text-text-heading"}`}>{v}</dd>
            </React.Fragment>
          ))}
        </dl>
        {drawerNote}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btn.secondary} onClick={() => setStep("form")} disabled={busy}>
            Kembali
          </button>
          <button type="button" className={btn.primary} onClick={() => void submit()} disabled={busy} autoFocus>
            {busy && <Spinner />}
            Terima {formatRupiah(amount)}
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
        next();
      }}
    >
      {serverError && (
        <Notice tone="danger" role="alert">
          {serverError}
        </Notice>
      )}
      {header}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] bg-warning-tint px-3.5 py-3 text-warning">
        <span className="text-[13px] font-semibold">Sisa kasbon</span>
        <span className="text-[20px] font-bold tabular-nums">{formatRupiah(remaining)}</span>
      </div>

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Bayar</p>
        <Segmented<"full" | "partial">
          label="Bayar"
          value={full ? "full" : "partial"}
          onChange={(v) => {
            setFull(v === "full");
            setServerError(null);
          }}
          options={[
            { value: "full", label: `Lunas ${formatRupiah(remaining)}` },
            { value: "partial", label: "Sebagian" },
          ]}
        />
      </div>

      {!full && (
        <Field id={`${uid}-amount`} label="Nominal dibayar" error={err("amount")} hint={`Maksimal ${formatRupiah(remaining)} (cicilan).`}>
          <NumberInput
            id={`${uid}-amount`}
            prefix="Rp"
            value={partial}
            onChange={setPartial}
            invalid={!!err("amount")}
            describedBy={err("amount") ? `${uid}-amount-error` : `${uid}-amount-hint`}
            placeholder="0"
          />
        </Field>
      )}

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Cara bayar</p>
        <Segmented<PaymentMethod> label="Cara bayar" value={method} onChange={setMethod} options={SETTLE_METHODS} />
      </div>

      {cash && (
        <div className="flex flex-col gap-2">
          <Field id={`${uid}-received`} label="Uang diterima" error={err("received")}>
            <NumberInput
              id={`${uid}-received`}
              prefix="Rp"
              value={receivedValue}
              onChange={(v) => {
                setReceived(v);
                setReceivedTouched(true);
              }}
              invalid={!!err("received")}
              describedBy={err("received") ? `${uid}-received-error` : undefined}
            />
          </Field>
          {Number.isFinite(amount) && amount > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Pilihan cepat uang diterima">
              {[amount, ...cashSuggestions(amount)].map((v, i) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={receivedValue === v}
                  onClick={() => {
                    setReceived(v);
                    setReceivedTouched(true);
                  }}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-medium tabular-nums transition-colors ${
                    receivedValue === v ? "border-brand-primary bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-body hover:border-border-active"
                  } ${focusRing}`}
                >
                  {i === 0 ? "Uang pas" : formatRupiah(v)}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 border-t border-border-subtle pt-2">
            <span className="font-semibold text-text-heading">Kembalian</span>
            <span className="text-[18px] font-bold tabular-nums text-text-heading">{formatRupiah(change)}</span>
          </div>
        </div>
      )}

      {drawerNote}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button type="submit" className={btn.primary} disabled={busy || !(Number.isFinite(amount) && amount > 0)}>
          Terima {formatRupiah(Number.isFinite(amount) ? amount : 0)}
        </button>
      </div>
    </form>
  );
}
