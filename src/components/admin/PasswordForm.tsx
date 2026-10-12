"use client";

import React, { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { LoginResult } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { btn, errorMessage, Field, fieldErrors, focusRing, inputClass, Notice, Spinner } from "./ui";

// Formulir ganti password sendiri (POST /admin/me/password). Dipakai di "Akun saya" dan di halaman
// paksa ganti setelah login dengan password sementara. Sukses → server mencabut sesi lain & merotasi sesi ini.

const MIN = 12;

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  describedBy,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  invalid?: boolean;
  describedBy?: string;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        className={`${inputClass} pr-11`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        autoFocus={autoFocus}
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
        aria-pressed={show}
        className={`absolute top-1/2 right-1 inline-flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-text-muted hover:text-text-heading ${focusRing}`}
      >
        {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
      </button>
    </div>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-success" : "text-text-muted"}`}>
      <span
        aria-hidden
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full ${ok ? "bg-success text-white" : "border border-border-active"}`}
      >
        {ok && <Check size={11} strokeWidth={3} />}
      </span>
      {children}
    </li>
  );
}

export function PasswordForm({
  forced,
  username,
  onDone,
  submitLabel = "Simpan password baru",
}: {
  forced: boolean;
  username: string;
  onDone: (r: LoginResult) => void;
  submitLabel?: string;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const longEnough = next.length >= MIN;
  const differs = next.length > 0 && next !== current;
  const matches = confirm.length > 0 && confirm === next;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const local: Record<string, string> = {};
    if (!current) local.current_password = forced ? "Isi password sementara." : "Isi password saat ini.";
    if (!longEnough) local.new_password = `Minimal ${MIN} karakter.`;
    else if (!differs) local.new_password = "Harus berbeda dari password lama.";
    if (!matches) local.confirm = "Ulangi password baru yang sama.";
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const r = await (await adminApi()).changeMyPassword({ current_password: current, new_password: next });
      onDone(r);
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") {
        setErrors(fieldErrors(err));
        if (fieldErrors(err).current_password) setCurrent("");
      } else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {/* Isian nama pengguna tersembunyi membantu password manager menyimpan kredensial yang benar. */}
      <input type="email" autoComplete="username" value={username} className="hidden" aria-hidden tabIndex={-1} readOnly />
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
      <Field id="pw-current" label={forced ? "Password sementara" : "Password saat ini"} error={errors.current_password}>
        <PasswordInput
          id="pw-current"
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          invalid={!!errors.current_password}
          describedBy={errors.current_password ? "pw-current-error" : undefined}
          autoFocus={forced}
        />
      </Field>
      <Field id="pw-new" label="Password baru" error={errors.new_password}>
        <PasswordInput
          id="pw-new"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          invalid={!!errors.new_password}
          describedBy={errors.new_password ? "pw-new-error" : "pw-rules"}
        />
      </Field>
      <ul id="pw-rules" className="-mt-2 flex flex-col gap-1 text-[13px]">
        <Rule ok={longEnough}>Minimal {MIN} karakter</Rule>
        <Rule ok={differs}>Berbeda dari password lama</Rule>
      </ul>
      <Field id="pw-confirm" label="Ulangi password baru" error={errors.confirm}>
        <PasswordInput
          id="pw-confirm"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={!!errors.confirm}
          describedBy={errors.confirm ? "pw-confirm-error" : undefined}
        />
      </Field>
      <p className="text-[13px] text-text-muted">Setelah disimpan, semua sesi lain akun ini dikeluarkan.</p>
      <button type="submit" className={`${btn.primary} w-full sm:w-auto sm:self-start`} disabled={busy}>
        {busy && <Spinner />}
        {submitLabel}
      </button>
    </form>
  );
}
