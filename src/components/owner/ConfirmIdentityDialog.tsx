"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { btn, errorMessage, Field, inputClass, Notice, Spinner } from "@/components/admin/ui";
import { OWNER_MOCK, ownerApi } from "@/lib/owner/api";
import { confirmReason, isConfirmRequired } from "@/lib/owner/confirm";
import { ApiError } from "@/lib/sissiApi";
import { GOOGLE_CLIENT_ID, GoogleButton } from "./GoogleButton";

// Konfirmasi ulang identitas sebelum aksi sensitif (mis. mengubah QRIS/rekening outlet). Server meminta ini lewat
// 422 `CONFIRM_REQUIRED:` (api.md "Nomor 14"); setelah POST /owner/auth/confirm berhasil, aksi dikirim ulang otomatis.
// Akun Google: tombol Google (ID token akun yang sama) tersedia bila NEXT_PUBLIC_GOOGLE_CLIENT_ID diisi — server tidak
// memberi tahu jenis akun, jadi password & Google sama-sama ditawarkan.

/** Pemilik menutup dialog konfirmasi tanpa melanjutkan. */
export class ConfirmCancelled extends Error {
  constructor() {
    super("Konfirmasi dibatalkan.");
    this.name = "ConfirmCancelled";
  }
}

type Pending = { reason: string; resolve: (ok: boolean) => void };

/**
 * `run(fn)`: jalankan aksi; bila server meminta konfirmasi ulang, tampilkan dialog lalu ulangi aksi sekali.
 * Menutup dialog → `ConfirmCancelled` dilempar (pemanggil cukup diam). Pasang `dialog` di JSX pemanggil.
 */
export function useSensitiveAction(note?: React.ReactNode) {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      if (!isConfirmRequired(err)) throw err;
      const ok = await new Promise<boolean>((resolve) => {
        const p = { reason: confirmReason(err), resolve };
        pendingRef.current = p;
        setPending(p);
      });
      if (!ok) throw new ConfirmCancelled();
      return await fn();
    }
  }, []);

  const finish = (ok: boolean) => {
    pendingRef.current?.resolve(ok);
    pendingRef.current = null;
    setPending(null);
  };

  const dialog = <ConfirmIdentityDialog open={pending !== null} reason={pending?.reason} note={note} onConfirmed={() => finish(true)} onCancel={() => finish(false)} />;
  return { run, dialog };
}

function describe(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "INVALID_CREDENTIALS":
        return "Password salah. Periksa lagi lalu coba ulang.";
      case "GOOGLE_ACCOUNT_MISMATCH":
        return "Akun Google ini bukan akun pemilik yang sedang masuk. Pakai akun Google yang sama, atau isi password.";
      case "GOOGLE_TOKEN_INVALID":
        return "Konfirmasi dengan Google gagal. Coba lagi atau isi password.";
      case "GOOGLE_NOT_CONFIGURED":
        return "Konfirmasi dengan Google belum tersedia. Isi password akun.";
      case "VALIDATION_ERROR":
        return err.details[0]?.message || "Isi password akun.";
    }
  }
  return errorMessage(err);
}

export function ConfirmIdentityDialog({
  open,
  reason,
  note,
  onConfirmed,
  onCancel,
}: {
  open: boolean;
  reason?: string;
  /** Peringatan tambahan dari pemanggil (mis. "mengubah tujuan uang pelanggan"). */
  note?: React.ReactNode;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState<null | "password" | "google">(null);
  return (
    <Modal
      open={open}
      title="Konfirmasi password"
      description={reason || "Demi keamanan, masukkan lagi password akunmu untuk melanjutkan."}
      onClose={onCancel}
      dismissible={!busy}
      icon={<ShieldCheck size={20} aria-hidden className="text-brand-ink" />}
    >
      {open && <ConfirmBody busy={busy} setBusy={setBusy} note={note} onConfirmed={onConfirmed} onCancel={onCancel} />}
    </Modal>
  );
}

function ConfirmBody({
  busy,
  setBusy,
  note,
  onConfirmed,
  onCancel,
}: {
  busy: null | "password" | "google";
  setBusy: (v: null | "password" | "google") => void;
  note?: React.ReactNode;
  onConfirmed: () => void;
  onCancel: () => void;
}) {
  const uid = useId();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // <dialog>.showModal() memindahkan fokus ke tombol pertama (Tutup) setelah render; arahkan ke isian password.
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const confirm = async (body: { password: string } | { id_token: string }, via: "password" | "google") => {
    setBusy(via);
    setError(null);
    try {
      await (await ownerApi()).confirm(body);
      setBusy(null);
      onConfirmed();
    } catch (err) {
      setBusy(null);
      setError(describe(err));
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!password) {
          setError("Isi password akun.");
          return;
        }
        void confirm({ password }, "password");
      }}
    >
      {note}
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
      <Field id={`${uid}-pw`} label="Password" hint="Password yang sama dengan untuk masuk ke aplikasi & dasbor.">
        <div className="relative">
          <input
            ref={inputRef}
            id={`${uid}-pw`}
            type={show ? "text" : "password"}
            autoComplete="current-password"
            className={`${inputClass} pr-11`}
            value={password}
            maxLength={128}
            disabled={!!busy}
            aria-invalid={!!error || undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-text-muted hover:text-text-heading"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
          >
            {show ? <EyeOff size={17} aria-hidden /> : <Eye size={17} aria-hidden />}
          </button>
        </div>
      </Field>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onCancel} disabled={!!busy}>
          Batal
        </button>
        <button type="submit" className={btn.primary} disabled={!!busy}>
          {busy === "password" && <Spinner />}
          Konfirmasi
        </button>
      </div>
      {(GOOGLE_CLIENT_ID || OWNER_MOCK) && (
        <div className="border-t border-border-subtle pt-4">
          <p className="mb-2 text-center text-[12.5px] text-text-muted">Masuk dengan Google? Konfirmasi lewat akun Google yang sama:</p>
          <GoogleButton
            text="continue_with"
            mockLabel="Konfirmasi dengan Google (tiruan)"
            disabled={!!busy}
            busy={busy === "google"}
            onCredential={(idToken) => void confirm({ id_token: idToken }, "google")}
            onError={(t) => setError(t)}
          />
        </div>
      )}
    </form>
  );
}
