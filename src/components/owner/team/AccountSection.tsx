"use client";

import React, { useState } from "react";
import { Link2Off, Lock, MessageCircle, Send, Smartphone } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { Badge, btn, cardClass, CopyButton, errorMessage, formatDateTime, Notice, Spinner, Switch } from "@/components/admin/ui";
import { ChipGroup, Segmented } from "@/components/owner/editing";
import { ownerApi } from "@/lib/owner/api";
import {
  ACCESS_HINT,
  ACCESS_LABEL,
  ACCOUNT_LABEL,
  accountState,
  PERSONAL_ACCESS,
  ROLE_LABEL,
  unbindDevice,
  type AccountState,
  type Employee,
  type PersonalAccess,
  type Role,
} from "@/lib/owner/team";
import type { EmployeeInvite } from "@/lib/owner/types";
import { ApiError } from "@/lib/sissiApi";
import type { TeamCtx } from "./shared";

// Akun di HP pribadi (api.md "Akun karyawan & Ruang Karyawan"): akses (tidak bisa login · Ruang Karyawan · sesuai
// tugas) dan outlet ikut tombol Simpan form; undang/kirim tautan reset & lepas ikatan HP = aksi langsung.
// Undangan = fitur Pro (`staff`) dan butuh internet; server menolak dengan PRO_REQUIRED bila paket Gratis.

const ACCOUNT_TONE: Record<AccountState, "neutral" | "success" | "brand" | "warning"> = {
  owner: "neutral",
  disabled: "neutral",
  bound: "success",
  active: "success",
  invited: "brand",
  none: "warning",
};

export function AccountBadge({ employee }: { employee: Employee }) {
  const st = accountState(employee);
  if (st === "owner") return null;
  return <Badge tone={ACCOUNT_TONE[st]}>{ACCOUNT_LABEL[st]}</Badge>;
}

export function AccountSection({
  id,
  current,
  role,
  active,
  phone,
  access,
  outletIds,
  errors,
  dirty,
  ctx,
  businessName,
  onAccess,
  onOutlets,
}: {
  id: string;
  current: Employee | null;
  role: Role;
  active: boolean;
  phone: string;
  access: PersonalAccess;
  outletIds: string[] | null;
  errors: Record<string, string>;
  /** Form punya perubahan belum disimpan → undangan memakai data tersimpan, jadi minta simpan dulu. */
  dirty: boolean;
  ctx: TeamCtx;
  businessName: string;
  onAccess: (v: PersonalAccess) => void;
  onOutlets: (v: string[] | null) => void;
}) {
  const toast = useToast();
  const [invite, setInvite] = useState<EmployeeInvite | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [unbinding, setUnbinding] = useState(false);
  const [unbindBusy, setUnbindBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const outlets = ctx.data.outlets;

  if (role === "owner") return null;

  const state = current ? accountState(current) : null;
  const reset = !!current?.has_password;
  const inviteBlock = !current
    ? "Simpan karyawan dulu, lalu kirim undangan."
    : dirty
      ? "Simpan perubahan dulu sebelum mengirim undangan."
      : !current.is_active || !active
        ? "Karyawan nonaktif tidak bisa diundang."
        : !current.phone || !phone.trim()
          ? "Isi no. HP karyawan dulu — no. HP dipakai untuk masuk."
          : null;

  const sendInvite = async () => {
    if (!current) return;
    setInviteBusy(true);
    setInviteError(null);
    try {
      const api = await ownerApi();
      const out = await api.inviteEmployee(current.id);
      setInvite(out);
      toast.success(out.purpose === "reset_password" ? "Tautan reset password dibuat." : "Undangan dibuat.");
      // `invite_expires_at` & `updated_at` berubah di server → tarik ulang agar simpan berikutnya tidak konflik.
      ctx.reload();
    } catch (err) {
      if (err instanceof ApiError && err.code === "PRO_REQUIRED") {
        setInviteError("Login karyawan di HP pribadi butuh Sissi Pro. Upgrade lewat menu Langganan.");
      } else if (err instanceof ApiError && err.details[0]?.message) {
        setInviteError(err.details[0].message);
      } else setInviteError(errorMessage(err));
    } finally {
      setInviteBusy(false);
    }
  };

  const unbind = async () => {
    if (!current) return;
    setUnbindBusy(true);
    try {
      const out = await unbindDevice(current);
      ctx.merge("employees", out);
      if (out.status === "applied") {
        toast.success(`Ikatan HP ${current.name} dilepas.`);
        setUnbinding(false);
      } else toast.error(out.message);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUnbindBusy(false);
    }
  };

  const waText = invite && current ? whatsappText(invite, current.name, businessName) : "";
  const waNumber = current?.phone?.replace(/^\+/, "") ?? "";

  return (
    <section className={cardClass} aria-labelledby={`${id}-acc-title`}>
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={`${id}-acc-title`} className="text-[14px] font-semibold text-text-heading">
            Akun di HP pribadi
          </h3>
          {current && <AccountBadge employee={current} />}
        </div>
        <p className="mt-0.5 text-[13px] text-text-muted">Karyawan masuk di HP-nya sendiri dengan no. HP dan password yang ia buat dari tautan undangan.</p>
      </div>

      <div className="flex flex-col gap-4 px-4 py-3">
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Akses dari HP pribadi</p>
          <div className="max-w-full overflow-x-auto">
            <Segmented label="Akses dari HP pribadi" options={PERSONAL_ACCESS.map((v) => ({ value: v, label: ACCESS_LABEL[v] }))} value={access} onChange={onAccess} />
          </div>
          <p className="mt-1.5 text-[13px] text-text-muted">
            {access === "full" ? ACCESS_HINT.full.replace("kasir/dapur", ROLE_LABEL[role].toLowerCase()) : ACCESS_HINT[access]}
          </p>
          {errors.personal_access && <p className="mt-1 text-[13px] text-danger">{errors.personal_access}</p>}
        </div>

        {access !== "none" && outlets.length > 0 && (
          <div>
            <Switch
              id={`${id}-all-outlets`}
              label="Semua outlet"
              checked={outletIds === null}
              description={outletIds === null ? "Termasuk outlet yang dibuat nanti." : "Hanya outlet yang dipilih di bawah."}
              onChange={(all) => onOutlets(all ? null : outlets.map((o) => o.id))}
            />
            {outletIds !== null && (
              <div className="mt-3">
                <ChipGroup
                  label="Outlet yang boleh diakses"
                  options={outlets.map((o) => ({ value: o.id, label: o.name || "Tanpa nama" }))}
                  selected={outletIds}
                  onChange={(next) => onOutlets(next)}
                />
              </div>
            )}
            {errors.outlet_ids && <p className="mt-1.5 text-[13px] text-danger">{errors.outlet_ids}</p>}
          </div>
        )}

        {current && state !== "disabled" && (
          <dl className="grid gap-1 text-[13.5px]">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">Password</dt>
              <dd className="text-text-heading">{current.has_password ? "Sudah dibuat" : "Belum dibuat"}</dd>
            </div>
            {current.invite_expires_at && Date.parse(current.invite_expires_at) > now && (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-text-muted">Tautan berlaku sampai</dt>
                <dd className="text-text-heading">{formatDateTime(current.invite_expires_at)}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-text-muted">HP terhubung</dt>
              <dd className="text-text-heading">{current.bound_device_id ? `Sejak ${formatDateTime(current.bound_at)}` : "Belum ada"}</dd>
            </div>
          </dl>
        )}

        {current && access !== "none" && (
          <div className="flex flex-wrap gap-2">
            {!ctx.staff ? (
              <span className="inline-flex items-center gap-2 text-[13.5px] text-text-muted">
                <Lock size={15} aria-hidden /> Login karyawan di HP pribadi termasuk paket Pro.
              </span>
            ) : (
              <button type="button" className={btn.secondary} onClick={sendInvite} disabled={inviteBusy || !!inviteBlock}>
                {inviteBusy ? <Spinner /> : <Send size={16} aria-hidden />}
                {reset ? "Kirim tautan reset" : current.invite_expires_at ? "Undang ulang" : "Undang"}
              </button>
            )}
            {current.bound_device_id && (
              <button type="button" className={btn.ghost} onClick={() => setUnbinding(true)}>
                <Link2Off size={16} aria-hidden /> Lepas ikatan HP
              </button>
            )}
          </div>
        )}
        {current && access !== "none" && ctx.staff && inviteBlock && <p className="-mt-2 text-[13px] text-text-muted">{inviteBlock}</p>}
        {current && access === "none" && current.personal_access !== "none" && (
          <p className="text-[13px] text-text-muted">Setelah disimpan, sesi karyawan ini di HP pribadinya dihentikan (paling lama 15 menit).</p>
        )}

        {inviteError && (
          <Notice tone="danger" role="alert">
            {inviteError}
          </Notice>
        )}

        {invite && (
          <div className="rounded-[12px] border border-border-subtle bg-bg-muted px-3.5 py-3" role="status">
            <p className="text-[13.5px] font-semibold text-text-heading">
              {invite.purpose === "reset_password" ? "Tautan reset password" : "Undangan"} siap dikirim
            </p>
            <p className="mt-0.5 text-[13px] text-text-muted">
              Berlaku sampai {formatDateTime(invite.expires_at)}, sekali pakai. Kode tidak bisa ditampilkan lagi setelah lembar ini ditutup; tautan
              lama otomatis batal.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span className="min-w-0 font-mono text-[20px] font-bold tracking-[0.1em] break-all text-text-heading">{invite.code}</span>
              <CopyButton value={invite.code} label="Salin kode" />
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-body" title={invite.url}>
                {invite.url}
              </span>
              <CopyButton value={invite.url} label="Salin tautan" />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                className={btn.primary}
                href={`https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle size={16} aria-hidden /> Kirim lewat WhatsApp
              </a>
              <CopyMessage text={waText} />
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={unbinding}
        title="Lepas ikatan HP?"
        confirmLabel="Lepas ikatan"
        tone="danger"
        busy={unbindBusy}
        onClose={() => setUnbinding(false)}
        onConfirm={unbind}
      >
        {current?.name} keluar dari HP yang sekarang (paling lama 15 menit) dan bisa masuk lagi dari HP lain. Pakai ini bila karyawan ganti
        atau kehilangan HP.
      </ConfirmDialog>
    </section>
  );
}

function CopyMessage({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={btn.secondary}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          // Clipboard ditolak — salin kode/tautan satu per satu.
        }
      }}
    >
      <Smartphone size={16} aria-hidden /> {done ? "Pesan tersalin" : "Salin pesan"}
    </button>
  );
}

/** Teks pesan disusun klien (kontrak: server tidak menyusun teks WhatsApp). */
function whatsappText(inv: EmployeeInvite, name: string, business: string): string {
  const until = formatDateTime(inv.expires_at);
  if (inv.purpose === "reset_password") {
    return (
      `Halo ${name}, ini tautan untuk membuat password baru akun Sissi-mu di ${business}:\n${inv.url}\n\n` +
      `Atau buka aplikasi Sissi → Punya kode undangan → ketik kode ${inv.code}.\nBerlaku sampai ${until}, sekali pakai.`
    );
  }
  return (
    `Halo ${name}, kamu diundang masuk ke ${business} di aplikasi Sissi. Buka tautan ini lalu buat password:\n${inv.url}\n\n` +
    `Atau buka aplikasi Sissi → Punya kode undangan → ketik kode ${inv.code}.\nBerlaku sampai ${until}, sekali pakai. ` +
    `Setelah itu masuk dengan no. HP ini dan password yang kamu buat.`
  );
}
