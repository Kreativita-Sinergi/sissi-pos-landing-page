"use client";

import React, { useId, useState } from "react";
import { ChevronRight, KeyRound, Lock, Wallet } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, cardClass, errorMessage, Field, inputClass, Notice, Spinner, Switch } from "@/components/admin/ui";
import { Sheet } from "@/components/owner/catalog/bits";
import { Segmented, useUnsavedWarning } from "@/components/owner/editing";
import { newId } from "@/lib/owner/api";
import {
  isEmail,
  isPaid,
  normalizePhone,
  payrollSummary,
  ROLE_HINT,
  ROLE_LABEL,
  saveEmployee,
  savePin,
  type Employee,
  type PersonalAccess,
  type Role,
} from "@/lib/owner/team";
import type { BusinessType } from "@/lib/owner/types";
import { AccountSection } from "./AccountSection";
import { PayrollDialog } from "./PayrollDialog";
import { PinDialog } from "./PinDialog";
import type { TeamCtx } from "./shared";

// Tambah/ubah karyawan — cermin `employee_form_screen.dart`: nama, HP, email, peran, aktif, PIN (atur/ganti/cabut),
// dan kartu gaji. Karyawan baru: PIN dipilih dulu lalu ikut terkirim sekali bersama data karyawan.

export type EmployeeTarget = { id: string | null; key: number } | null;

export function EmployeeSheet({
  target,
  ctx,
  selfId,
  businessType,
  businessName,
  onClose,
}: {
  target: EmployeeTarget;
  ctx: TeamCtx;
  selfId: string;
  businessType: BusinessType;
  businessName: string;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const current = target?.id ? (ctx.data.employees.find((e) => e.id === target.id) ?? null) : null;
  useUnsavedWarning(dirty);

  const close = () => {
    if (busy) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  };

  return (
    <>
      <Sheet
        open={!!target}
        title={target?.id ? "Ubah karyawan" : "Tambah karyawan"}
        subtitle={current ? ROLE_LABEL[current.role] : "Karyawan membuka kasir dan absen dengan PIN masing-masing."}
        onClose={close}
        busy={busy}
        footer={
          <>
            <button type="button" className={btn.secondary} onClick={close} disabled={busy}>
              Batal
            </button>
            <button type="submit" form="employee-form" className={btn.primary} disabled={busy}>
              {busy && <Spinner />}
              Simpan
            </button>
          </>
        }
      >
        {target && (
          <EmployeeForm
            key={target.key}
            current={current}
            isNew={!target.id}
            ctx={ctx}
            selfId={selfId}
            businessType={businessType}
            businessName={businessName}
            setBusy={setBusy}
            setDirty={setDirty}
            onSaved={() => {
              setDirty(false);
              onClose();
            }}
          />
        )}
      </Sheet>
      <ConfirmDialog
        open={confirmClose}
        title="Buang perubahan?"
        confirmLabel="Buang"
        tone="danger"
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          setDirty(false);
          onClose();
        }}
      >
        Perubahan pada data karyawan ini belum disimpan.
      </ConfirmDialog>
    </>
  );
}

function EmployeeForm({
  current,
  isNew,
  ctx,
  selfId,
  businessType,
  businessName,
  setBusy,
  setDirty,
  onSaved,
}: {
  current: Employee | null;
  isNew: boolean;
  ctx: TeamCtx;
  selfId: string;
  businessType: BusinessType;
  businessName: string;
  setBusy: (v: boolean) => void;
  setDirty: (v: boolean) => void;
  onSaved: () => void;
}) {
  const id = useId();
  const toast = useToast();
  const [initial] = useState(() => ({
    name: current?.name ?? "",
    phone: (current?.phone ?? "").replace(/^\+62/, "0"),
    email: current?.email ?? "",
    role: (current?.role ?? "cashier") as Role,
    active: current?.is_active ?? true,
    access: (current?.personal_access ?? "staff_space") as PersonalAccess,
    outletIds: current?.outlet_ids ?? (null as string[] | null),
  }));
  const [f, setF] = useState(initial);
  const [pendingPin, setPendingPin] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revokeBusy, setRevokeBusy] = useState(false);
  const [payrollFor, setPayrollFor] = useState<Employee | null>(null);
  const [newIdValue] = useState(() => newId());

  const isSelf = !!current && current.id === selfId;
  const others = ctx.data.employees.filter((e) => e.id !== current?.id);
  const outlets = ctx.data.outlets;
  // Peran Dapur hanya untuk usaha kuliner / fitur dapur outlet aktif (cermin `kitchenRole` app).
  const kitchenRole = businessType === "culinary" ? outlets.length === 0 || outlets.some((o) => o.kitchen !== false) : outlets.some((o) => o.kitchen === true);

  const update = (patch: Partial<typeof f>) => {
    const next = { ...f, ...patch };
    setF(next);
    setErrors({});
    setFormError(null);
    setDirty(JSON.stringify(next) !== JSON.stringify(initial) || pendingPin !== null);
  };

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    const name = f.name.trim();
    if (!name) e.name = "Wajib diisi";
    else if (name.length < 2) e.name = "Minimal 2 karakter";
    else if (name.length > 80) e.name = "Maksimal 80 karakter";
    const phoneText = f.phone.trim();
    if (phoneText) {
      const p = normalizePhone(phoneText);
      if (!p) e.phone = "Nomor HP tidak valid";
      else if (others.some((o) => o.phone === p)) e.phone = "Nomor HP ini sudah dipakai karyawan lain.";
    }
    const email = f.email.trim().toLowerCase();
    if (email) {
      if (!isEmail(email)) e.email = "Format email tidak valid";
      else if (others.some((o) => o.email === email)) e.email = "Email ini sudah dipakai karyawan lain.";
    }
    if (f.role !== "owner" && f.access !== "none" && f.outletIds !== null && f.outletIds.length === 0) {
      e.outlet_ids = "Pilih minimal satu outlet, atau aktifkan Semua outlet.";
    }
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    setFormError(null);
    try {
      const out = await saveEmployee(
        current?.id ?? newIdValue,
        {
          name: f.name.trim(),
          role: f.role,
          email: f.email.trim() ? f.email.trim().toLowerCase() : null,
          phone: f.phone.trim() ? normalizePhone(f.phone) : null,
          is_active: f.active,
          // Akses & outlet hanya dikirim bila berubah (pemilik selalu "full" di server).
          ...(f.role !== "owner" && f.access !== initial.access ? { personal_access: f.access } : {}),
          ...(f.role !== "owner" && JSON.stringify(f.outletIds) !== JSON.stringify(initial.outletIds) ? { outlet_ids: f.outletIds } : {}),
        },
        current,
        pendingPin ?? undefined
      );
      ctx.merge("employees", out);
      if (out.status === "applied") {
        setPendingPin(null);
        toast.success(isNew ? `${f.name.trim()} ditambahkan${pendingPin ? " dengan PIN" : ""}.` : "Data karyawan tersimpan.");
        onSaved();
      } else {
        if (out.status === "rejected") setErrors(out.fields);
        setFormError(out.message);
      }
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const savePinNow = async (pin: string): Promise<string | null> => {
    if (!current) {
      setPendingPin(pin);
      setDirty(true);
      setPinOpen(false);
      return null;
    }
    try {
      const out = await savePin(current, pin);
      ctx.merge("employees", out);
      if (out.status !== "applied") return out.message;
      setPinOpen(false);
      toast.success(`PIN ${current.name} tersimpan.`);
      return null;
    } catch (err) {
      return errorMessage(err);
    }
  };

  const revoke = async () => {
    if (!current) return;
    setRevokeBusy(true);
    try {
      const out = await savePin(current, null);
      ctx.merge("employees", out);
      if (out.status === "applied") {
        toast.success(`PIN ${current.name} dicabut.`);
        setRevoking(false);
      } else toast.error(out.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setRevokeBusy(false);
    }
  };

  const roles: { value: Role; label: string }[] = [
    { value: "cashier", label: ROLE_LABEL.cashier },
    ...(kitchenRole || f.role === "kitchen" ? [{ value: "kitchen" as Role, label: ROLE_LABEL.kitchen }] : []),
    { value: "owner", label: ROLE_LABEL.owner },
  ];
  const hasPin = current ? current.has_pin : pendingPin !== null;
  const payrollEmployee = current;

  return (
    <>
    <form id="employee-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
      <Field id={`${id}-name`} label="Nama karyawan" error={errors.name}>
        <input
          id={`${id}-name`}
          className={inputClass}
          placeholder="Mis. Rani Amalia"
          autoComplete="off"
          maxLength={80}
          value={f.name}
          aria-invalid={!!errors.name || undefined}
          onChange={(e) => update({ name: e.target.value })}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`${id}-phone`} label="No. HP (opsional)" error={errors.phone}>
          <input
            id={`${id}-phone`}
            className={inputClass}
            inputMode="tel"
            autoComplete="off"
            placeholder="0812…"
            value={f.phone}
            aria-invalid={!!errors.phone || undefined}
            onChange={(e) => update({ phone: e.target.value })}
          />
        </Field>
        <Field id={`${id}-email`} label="Email (opsional)" error={errors.email}>
          <input
            id={`${id}-email`}
            className={inputClass}
            type="email"
            autoComplete="off"
            placeholder="nama@email.com"
            value={f.email}
            aria-invalid={!!errors.email || undefined}
            onChange={(e) => update({ email: e.target.value })}
          />
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Peran</p>
        {isSelf ? (
          <p className="text-[14px] font-semibold text-text-heading">{ROLE_LABEL[f.role]}</p>
        ) : (
          <Segmented label="Peran" options={roles} value={f.role} onChange={(r) => update({ role: r })} />
        )}
        <p className="mt-1.5 text-[13px] text-text-muted">{isSelf ? "Kamu tidak dapat mengubah peranmu sendiri." : ROLE_HINT[f.role]}</p>
        {errors.role && <p className="mt-1 text-[13px] text-danger">{errors.role}</p>}
        {!kitchenRole && !isSelf && (
          <p className="mt-1 text-[12.5px] text-text-muted">Peran Dapur tersedia untuk usaha kuliner atau bila fitur dapur outlet diaktifkan.</p>
        )}
      </div>
      <div className={`${cardClass} px-4 py-3`}>
        <Switch
          id={`${id}-active`}
          label="Aktif"
          checked={f.active}
          disabled={isSelf}
          description={isSelf ? "Akunmu sendiri selalu aktif." : "Karyawan nonaktif tidak bisa membuka kasir atau absen."}
          onChange={(v) => update({ active: v })}
        />
        {errors.is_active && <p className="mt-1 text-[13px] text-danger">{errors.is_active}</p>}
      </div>

      {!isSelf && (
        <AccountSection
          id={id}
          current={current}
          role={f.role}
          active={f.active}
          phone={f.phone}
          access={f.access}
          outletIds={f.outletIds}
          errors={errors}
          dirty={JSON.stringify(f) !== JSON.stringify(initial) || pendingPin !== null}
          ctx={ctx}
          businessName={businessName}
          onAccess={(access) => update({ access })}
          onOutlets={(outletIds) => update({ outletIds })}
        />
      )}

      {/* PIN kasir */}
      <section className={cardClass} aria-labelledby={`${id}-pin-title`}>
        <div className="border-b border-border-subtle px-4 py-3">
          <h3 id={`${id}-pin-title`} className="text-[14px] font-semibold text-text-heading">
            PIN kasir
          </h3>
          <p className="mt-0.5 text-[13px] text-text-muted">6 digit untuk membuka kasir terkunci, absen, dan menyetujui pembatalan (pemilik).</p>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[14px] text-text-heading">
            <KeyRound size={16} aria-hidden className={hasPin ? "text-success" : "text-text-muted"} />
            {current ? (current.has_pin ? "PIN aktif" : "Belum ada PIN") : pendingPin ? "PIN siap disimpan" : "Belum ada PIN"}
          </span>
          <button type="button" className={btn.secondary} onClick={() => setPinOpen(true)}>
            {hasPin ? "Ganti PIN" : "Atur PIN"}
          </button>
        </div>
        {current?.has_pin && (
          <button
            type="button"
            className="flex w-full items-center justify-between border-t border-border-subtle px-4 py-3 text-left text-[14px] text-text-body hover:bg-bg-muted"
            onClick={() => setRevoking(true)}
          >
            Cabut PIN
            <ChevronRight size={16} aria-hidden className="text-text-muted" />
          </button>
        )}
        {!current && pendingPin && (
          <button
            type="button"
            className="w-full border-t border-border-subtle px-4 py-2.5 text-left text-[13px] text-text-muted hover:bg-bg-muted"
            onClick={() => {
              setPendingPin(null);
              setDirty(JSON.stringify(f) !== JSON.stringify(initial));
            }}
          >
            Batalkan PIN
          </button>
        )}
      </section>

      {/* Gaji */}
      <section className={cardClass} aria-labelledby={`${id}-pay-title`}>
        <div className="border-b border-border-subtle px-4 py-3">
          <h3 id={`${id}-pay-title`} className="text-[14px] font-semibold text-text-heading">
            Gaji
          </h3>
          <p className="mt-0.5 text-[13px] text-text-muted">Dasar perhitungan slip gaji dari kehadiran.</p>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          {!ctx.staff ? (
            <span className="inline-flex items-center gap-2 text-[13.5px] text-text-muted">
              <Lock size={15} aria-hidden /> Gaji & slip gaji termasuk paket Pro.
            </span>
          ) : !payrollEmployee ? (
            <span className="text-[13.5px] text-text-muted">Simpan karyawan dulu, lalu atur gajinya.</span>
          ) : (
            <>
              <span className="text-[14px] text-text-heading">{isPaid(payrollEmployee.payroll) ? payrollSummary(payrollEmployee.payroll) : "Gaji belum diatur"}</span>
              <button type="button" className={btn.secondary} onClick={() => setPayrollFor(payrollEmployee)}>
                <Wallet size={16} aria-hidden /> Atur gaji
              </button>
            </>
          )}
        </div>
      </section>

      {formError && (
        <Notice tone="danger" role="alert">
          {formError}
        </Notice>
      )}
    </form>
      <PinDialog open={pinOpen} name={f.name.trim() || current?.name || "Karyawan baru"} onClose={() => setPinOpen(false)} onSubmit={savePinNow} />
      <ConfirmDialog
        open={revoking}
        title="Cabut PIN?"
        confirmLabel="Cabut PIN"
        tone="danger"
        busy={revokeBusy}
        onClose={() => setRevoking(false)}
        onConfirm={revoke}
      >
        {current?.name} tidak akan bisa membuka kasir atau absen dengan PIN sampai PIN baru diatur.
      </ConfirmDialog>
      <PayrollDialog
        employee={payrollFor ? (ctx.data.employees.find((e) => e.id === payrollFor.id) ?? null) : null}
        ctx={ctx}
        onClose={() => setPayrollFor(null)}
      />
    </>
  );
}
