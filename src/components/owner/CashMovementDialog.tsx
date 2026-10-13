"use client";

import React, { useId, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Wallet } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, errorMessage, Field, focusRing, formatRupiah, inputClass, Notice, Spinner } from "@/components/admin/ui";
import { CASH_CATEGORIES, cashProblem, type CashType, recordCash } from "@/lib/owner/cashMovement";
import type { ShiftDetail } from "@/lib/owner/types";
import { NumberInput } from "./editing";
import { useOwner } from "./OwnerShell";

// "Catat kas masuk/keluar" untuk shift yang sedang buka (alur & label app: cash_movement_sheet.dart). Uang fisiknya
// ada di laci outlet, jadi pemilik diingatkan agar kasir tahu.

export function CashMovementDialog({
  shift,
  type,
  onClose,
  onSaved,
}: {
  /** Shift buka; `null` = tertutup. */
  shift: ShiftDetail | null;
  type: CashType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={shift !== null}
      title="Catat kas masuk/keluar"
      description={shift ? `Tercatat di shift ${shift.cashier_name} · ${shift.outlet_name}` : undefined}
      onClose={onClose}
      dismissible={!busy}
      icon={<Wallet size={20} aria-hidden className="text-brand-ink" />}
    >
      {shift && <CashBody key={`${shift.id}:${type}`} shift={shift} initialType={type} busy={busy} setBusy={setBusy} onClose={onClose} onSaved={onSaved} />}
    </Modal>
  );
}

function CashBody({
  shift,
  initialType,
  busy,
  setBusy,
  onClose,
  onSaved,
}: {
  shift: ShiftDetail;
  initialType: CashType;
  busy: boolean;
  setBusy: (v: boolean) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const uid = useId();
  const toast = useToast();
  const { session } = useOwner();
  const [type, setType] = useState<CashType>(initialType);
  const [amount, setAmount] = useState(NaN);
  const [category, setCategory] = useState(CASH_CATEGORIES[initialType][0]);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const problem = cashProblem({ type, amount, category, note });

  const submit = async () => {
    setTouched(true);
    setServerError(null);
    if (problem) return;
    setBusy(true);
    try {
      const r = await recordCash(shift, { type, amount, category, note }, session.user.id);
      if (r.ok) {
        toast.success(type === "in" ? "Kas masuk dicatat." : "Kas keluar dicatat.");
        onSaved();
        onClose();
      } else setServerError(r.message);
    } catch (err) {
      setServerError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const chip = (active: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors ${
      active ? "border-brand-primary bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-body hover:border-border-active"
    } ${focusRing}`;

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {serverError && (
        <Notice tone="danger" role="alert">
          {serverError}
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Jenis kas">
        {(["in", "out"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => {
              setType(t);
              setCategory(CASH_CATEGORIES[t][0]);
            }}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-[10px] border text-[14px] font-semibold ${
              type === t ? (t === "in" ? "border-success bg-success-tint text-success" : "border-danger bg-danger-tint text-danger") : "border-border-subtle bg-white text-text-body"
            } ${focusRing}`}
          >
            {t === "in" ? <ArrowDownLeft size={16} aria-hidden /> : <ArrowUpRight size={16} aria-hidden />}
            {t === "in" ? "Kas Masuk" : "Kas Keluar"}
          </button>
        ))}
      </div>
      <Field id={`${uid}-amount`} label="Nominal" error={touched && problem?.field === "amount" ? problem.message : undefined}>
        <NumberInput id={`${uid}-amount`} prefix="Rp" value={amount} onChange={setAmount} invalid={touched && problem?.field === "amount"} placeholder="0" />
      </Field>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Kategori</p>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Kategori kas">
          {CASH_CATEGORIES[type].map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => setCategory(c)} className={chip(category === c)}>
              {c}
            </button>
          ))}
        </div>
      </div>
      <Field id={`${uid}-note`} label="Catatan" error={touched && problem?.field === "note" ? problem.message : undefined}>
        <input id={`${uid}-note`} className={inputClass} value={note} maxLength={150} placeholder="Contoh: beli es batu & gula" onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Notice tone="warning" icon={<Wallet size={17} aria-hidden />}>
        <p className="font-semibold">Uang fisik ada di laci outlet — pastikan kasir mengetahuinya.</p>
        <p className="text-[13.5px]">
          Dicatat atas nama {session.user.name} dan mengubah kas seharusnya shift ini{Number.isFinite(amount) && amount > 0 ? ` (${type === "in" ? "+" : "−"}${formatRupiah(amount)})` : ""}.
        </p>
      </Notice>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy && <Spinner />}
          {type === "in" ? "Catat kas masuk" : "Catat kas keluar"}
        </button>
      </div>
    </form>
  );
}
