"use client";

import React, { useId, useState } from "react";
import { Wallet } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { btn, errorMessage, Field, formatRupiah, Spinner } from "@/components/admin/ui";
import { MoneyInput } from "@/components/owner/catalog/bits";
import { Segmented } from "@/components/owner/editing";
import {
  computePayslip,
  monthLabel,
  PAY_AMOUNT_LABEL,
  PAY_TYPE_HINT,
  PAY_TYPE_LABEL,
  recapFor,
  ROLE_LABEL,
  savePayroll,
  type Employee,
  type PayrollConfig,
  type PayType,
} from "@/lib/owner/team";
import { zonedToday } from "@/lib/owner/tz";
import type { TeamCtx } from "./shared";

// Atur tipe & nominal gaji karyawan — cermin `payroll_config_sheet.dart` (perkiraan bulan ini ikut dihitung).

export function PayrollDialog({ employee, ctx, onClose }: { employee: Employee | null; ctx: TeamCtx; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={!!employee}
      title={employee ? `Atur gaji · ${employee.name}` : "Atur gaji"}
      description={employee ? ROLE_LABEL[employee.role] : undefined}
      icon={<Wallet size={20} aria-hidden className="text-brand-ink" />}
      onClose={onClose}
      dismissible={!busy}
    >
      {employee && <PayrollForm key={employee.id} employee={employee} ctx={ctx} onDone={onClose} busy={busy} setBusy={setBusy} />}
    </Modal>
  );
}

const TYPES: PayType[] = ["monthly", "daily", "hourly", "none"];

function PayrollForm({
  employee,
  ctx,
  onDone,
  busy,
  setBusy,
}: {
  employee: Employee;
  ctx: TeamCtx;
  onDone: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const id = useId();
  const [c, setC] = useState<PayrollConfig>(
    () => employee.payroll ?? { type: "monthly", amount: 0, late_per_minute: 0, absent_per_day: 0, allowance_per_day: 0, overtime_per_hour: 0 }
  );
  const [error, setError] = useState<string | null>(null);
  const month = zonedToday().slice(0, 7);
  const recap = recapFor(employee, month, ctx.data.attendances, ctx.data.rules);
  const estimate = computePayslip(c, recap).net;
  const paid = c.type !== "none";
  const set = (k: keyof PayrollConfig) => (v: number | null) => setC((p) => ({ ...p, [k]: v ?? 0 }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const out = await savePayroll(employee, c);
      ctx.merge("employees", out);
      if (out.status === "applied") onDone();
      else setError(out.message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const money = (k: keyof PayrollConfig, label: string) => (
    <Field id={`${id}-${k}`} label={label}>
      <MoneyInput id={`${id}-${k}`} value={c[k] as number} onChange={set(k)} placeholder="0" />
    </Field>
  );

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Tipe gaji</p>
        <Segmented label="Tipe gaji" options={TYPES.map((t) => ({ value: t, label: PAY_TYPE_LABEL[t] }))} value={c.type} onChange={(t) => setC((p) => ({ ...p, type: t }))} />
        <p className="mt-1.5 text-[13px] text-text-muted">{PAY_TYPE_HINT[c.type]}</p>
      </div>
      {paid && (
        <>
          {money("amount", PAY_AMOUNT_LABEL[c.type as Exclude<PayType, "none">])}
          <div className="grid gap-4 sm:grid-cols-2">
            {money("overtime_per_hour", "Lembur per jam")}
            {money("allowance_per_day", "Tunjangan hadir per hari")}
            {money("late_per_minute", "Potongan telat per menit")}
            {money("absent_per_day", "Potongan alpa per hari")}
          </div>
          <div className="rounded-[12px] bg-brand-tint px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[14px] text-text-heading">Perkiraan {monthLabel(month)}</span>
              <span className="text-[18px] font-bold tabular-nums text-text-heading">{formatRupiah(estimate)}</span>
            </div>
            <p className="mt-1 text-[12.5px] text-text-body">
              Dihitung dari kehadiran bulan ini sampai hari ini. Lembur = jam pulang setelah jam selesai kerja.
            </p>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onDone} disabled={busy}>
          Batal
        </button>
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy && <Spinner />}
          Simpan
        </button>
      </div>
    </form>
  );
}
