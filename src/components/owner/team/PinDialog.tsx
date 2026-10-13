"use client";

import React, { useId, useState } from "react";
import { KeyRound } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { btn, Field, inputClass, Spinner } from "@/components/admin/ui";
import { isPinFormat, isTrivialPin } from "@/lib/owner/team";

// Buat/ganti PIN 6 digit (masukkan → ulangi), cermin `pin_setup_dialog.dart`. PIN hanya hidup di state formulir ini
// (dibuang saat dialog ditutup) dan dikirim sekali lewat `onSubmit`; tidak pernah disimpan di browser.

export function PinDialog({
  open,
  name,
  onClose,
  onSubmit,
}: {
  open: boolean;
  name: string;
  onClose: () => void;
  /** Kembalikan pesan galat untuk ditampilkan, atau null bila berhasil (dialog ditutup pemanggil). */
  onSubmit: (pin: string) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open={open}
      title="Buat PIN baru"
      description={`PIN 6 digit untuk ${name} membuka kasir dan absen.`}
      icon={<KeyRound size={20} aria-hidden className="text-brand-ink" />}
      onClose={onClose}
      dismissible={!busy}
    >
      <PinForm onCancel={onClose} onSubmit={onSubmit} busy={busy} setBusy={setBusy} />
    </Modal>
  );
}

function PinForm({
  onCancel,
  onSubmit,
  busy,
  setBusy,
}: {
  onCancel: () => void;
  onSubmit: (pin: string) => Promise<string | null>;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const id = useId();
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState<{ field: "pin" | "again" | "form"; text: string } | null>(null);

  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!isPinFormat(pin)) return setError({ field: "pin", text: "PIN harus 6 digit angka." });
    if (isTrivialPin(pin)) return setError({ field: "pin", text: "PIN terlalu mudah ditebak. Hindari angka sama atau berurutan." });
    if (again !== pin) {
      setAgain("");
      return setError({ field: "again", text: "PIN tidak sama. Ulangi PIN yang sama." });
    }
    setBusy(true);
    setError(null);
    const msg = await onSubmit(pin).finally(() => setBusy(false));
    if (msg) setError({ field: "form", text: msg });
  };

  const input = (fid: string, value: string, set: (v: string) => void, invalid: boolean) => (
    <input
      id={fid}
      type="password"
      inputMode="numeric"
      autoComplete="new-password"
      maxLength={6}
      pattern="\d{6}"
      className={`${inputClass} max-w-[200px] text-center text-[18px] tracking-[0.5em]`}
      value={value}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? `${fid}-error` : undefined}
      onChange={(e) => {
        set(digits(e.target.value));
        setError(null);
      }}
      disabled={busy}
    />
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field id={`${id}-pin`} label="PIN baru" error={error?.field === "pin" ? error.text : undefined} hint="6 angka, hindari angka sama atau berurutan.">
        {input(`${id}-pin`, pin, setPin, error?.field === "pin")}
      </Field>
      <Field id={`${id}-again`} label="Ulangi PIN" error={error?.field === "again" ? error.text : undefined}>
        {input(`${id}-again`, again, setAgain, error?.field === "again")}
      </Field>
      {error?.field === "form" && (
        <p role="alert" className="text-[13px] text-danger">
          {error.text}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onCancel} disabled={busy}>
          Batal
        </button>
        <button type="submit" className={btn.primary} disabled={busy || pin.length !== 6 || again.length !== 6}>
          {busy && <Spinner />}
          Simpan PIN
        </button>
      </div>
    </form>
  );
}
