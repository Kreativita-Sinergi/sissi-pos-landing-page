"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Globe } from "lucide-react";
import { Notice, Spinner } from "@/components/admin/ui";
import { staffApi, staffDeviceId } from "@/lib/staff/api";
import { acceptErrorMessage, type StaffMessage } from "@/lib/staff/errors";

// "Aktifkan lewat website": buat kata sandi dari tautan undangan/reset lalu langsung masuk /karyawan
// (POST /staff/auth/accept/{code}; HP tidak diikat — beda dengan aktivasi di aplikasi).

const inputCls =
  "min-h-12 w-full rounded-xl border border-[#e4e9e7] bg-white px-3.5 text-base text-[#292e31] placeholder:text-[#7d8986] focus:border-[#f1702c] focus:ring-2 focus:ring-[#f1702c]/30 focus:outline-none aria-[invalid=true]:border-[#b42318]";

export function ActivateOnWeb({ code, reset }: { code: string; reset: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<StaffMessage | null>(null);
  const [fields, setFields] = useState<{ password?: string; confirm?: string }>({});

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    const f: typeof fields = {};
    if (password.length < 8) f.password = "Minimal 8 karakter.";
    if (confirm !== password) f.confirm = "Kata sandi tidak sama.";
    setFields(f);
    if (f.password || f.confirm) return;
    setBusy(true);
    try {
      await (await staffApi()).accept(code, { password, remember_me: remember, device_id: staffDeviceId() });
      router.replace("/karyawan");
    } catch (err) {
      setBusy(false);
      const m = acceptErrorMessage(err);
      if (err && typeof err === "object" && "code" in err && err.code === "VALIDATION_ERROR") setFields({ password: m.text });
      else setError(m);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#e4e9e7] bg-white px-5 text-base font-semibold text-[#292e31] transition-colors hover:bg-[#f3f6f5] focus:ring-2 focus:ring-[#f1702c] focus:ring-offset-2 focus:outline-none"
      >
        <Globe size={18} aria-hidden /> Aktifkan lewat website
      </button>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4 rounded-[14px] border border-[#e4e9e7] bg-[#f8faf9] p-4 sm:p-5" aria-labelledby="web-activate-title">
      <div>
        <h3 id="web-activate-title" className="text-[16px] font-semibold text-[#292e31]">
          {reset ? "Buat kata sandi baru" : "Buat kata sandi"}
        </h3>
        <p className="mt-1 text-[14px] leading-relaxed text-[#525866]">
          Setelah disimpan kamu langsung masuk ke halaman absen website. Nanti masuk lagi dengan no. HP & kata sandi ini, di website maupun
          aplikasi.
        </p>
      </div>
      {error && (
        <Notice tone={error.tone === "info" ? "warning" : error.tone} role="alert" title={error.title}>
          <p>{error.text}</p>
        </Notice>
      )}
      <div>
        <label htmlFor="web-password" className="mb-1.5 block text-[14px] font-semibold text-[#292e31]">
          Kata sandi
        </label>
        <div className="relative">
          <input
            id="web-password"
            type={show ? "text" : "password"}
            autoComplete="new-password"
            className={`${inputCls} pr-12`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fields.password}
            aria-describedby={fields.password ? "web-password-error" : "web-password-hint"}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            aria-pressed={show}
            className="absolute top-1/2 right-1.5 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#7d8986] hover:text-[#292e31] focus:ring-2 focus:ring-[#f1702c] focus:outline-none"
          >
            {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {fields.password ? (
          <p id="web-password-error" className="mt-1.5 text-[13.5px] text-[#b42318]">
            {fields.password}
          </p>
        ) : (
          <p id="web-password-hint" className="mt-1.5 text-[13.5px] text-[#525866]">
            Minimal 8 karakter. Hindari kata sandi yang mudah ditebak.
          </p>
        )}
      </div>
      <div>
        <label htmlFor="web-confirm" className="mb-1.5 block text-[14px] font-semibold text-[#292e31]">
          Ulangi kata sandi
        </label>
        <input
          id="web-confirm"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          className={inputCls}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-invalid={!!fields.confirm}
          aria-describedby={fields.confirm ? "web-confirm-error" : undefined}
        />
        {fields.confirm && (
          <p id="web-confirm-error" className="mt-1.5 text-[13.5px] text-[#b42318]">
            {fields.confirm}
          </p>
        )}
      </div>
      <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 self-start text-[14px] text-[#292e31]">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-[#be5823]" />
        Ingat saya di perangkat ini
      </label>
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#be5823] px-5 text-base font-semibold text-white transition-colors hover:bg-[#a04a1d] focus:ring-2 focus:ring-[#f1702c] focus:ring-offset-2 focus:outline-none disabled:cursor-wait disabled:opacity-70"
      >
        {busy && <Spinner size={18} />}
        {busy ? "Menyimpan…" : "Simpan & masuk"}
      </button>
    </form>
  );
}
