"use client";

import React, { useState } from "react";
import Link from "next/link";
import { KeyRound, ShieldAlert, UserPlus, UsersRound } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AdminListItem, TempPassword } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { Avatar } from "./AdminShell";
import { ConfirmDialog, Modal } from "./ConfirmDialog";
import { useToast } from "./toast";
import {
  Badge,
  btn,
  CopyButton,
  EmptyState,
  ErrorBlock,
  errorMessage,
  Field,
  fieldErrors,
  focusRing,
  formatDateTime,
  inputClass,
  Notice,
  PageHeader,
  SkeletonList,
  Spinner,
  tdClass,
  thClass,
  TimeAgo,
  useLoad,
} from "./ui";

// Kelola admin (tahap 2): daftar, tambah (password sementara tampil SEKALI), nonaktif/aktifkan, reset password.

type Pending =
  | { kind: "disable" | "enable" | "reset"; admin: AdminListItem }
  | null;

type Reveal = { title: string; who: AdminListItem; temp: TempPassword } | null;

const smallBtn = "min-h-8 px-3 text-[13px]";

export function TeamView() {
  const toast = useToast();
  const { state, reload, setData } = useLoad<AdminListItem[]>(async (signal) => (await adminApi()).admins(signal), []);
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<Reveal>(null);

  const replace = (a: AdminListItem) =>
    state.data && setData(state.data.map((x) => (x.id === a.id ? { ...a, is_me: x.is_me } : x)));

  async function runPending() {
    if (!pending) return;
    setBusy(true);
    const { kind, admin } = pending;
    try {
      const api = await adminApi();
      if (kind === "reset") {
        const temp = await api.resetAdminPassword(admin.id);
        setPending(null);
        setReveal({ title: `Password sementara baru untuk ${admin.name}`, who: admin, temp });
        reload();
      } else {
        const updated = await api.setAdminActive(admin.id, kind === "enable");
        replace(updated);
        setPending(null);
        toast.success(kind === "enable" ? `${admin.name} diaktifkan lagi.` : `${admin.name} dinonaktifkan. Semua sesinya berakhir.`);
      }
    } catch (err) {
      setPending(null);
      toast.error(adminError(err));
    } finally {
      setBusy(false);
    }
  }

  const list = state.data ?? [];
  const activeCount = list.filter((a) => a.active).length;

  return (
    <>
      <PageHeader
        title="Tim admin"
        description="Orang yang bisa masuk ke panel ini. Admin baru menerima password sementara (berlaku 72 jam) yang wajib diganti saat masuk pertama."
        actions={
          <button type="button" className={btn.primary} onClick={() => setAdding(true)}>
            <UserPlus size={17} aria-hidden /> Tambah admin
          </button>
        }
      />

      {state.status === "error" && !state.data && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <SkeletonList rows={4} label="Memuat admin" />}
      {state.data && (
        <div className="rounded-[14px] border border-border-subtle bg-white">
          {list.length === 0 ? (
            <EmptyState icon={<UsersRound size={22} aria-hidden />} title="Belum ada admin" />
          ) : (
            <>
              <table className="hidden w-full text-[14px] md:table">
                <thead>
                  <tr>
                    <th scope="col" className={thClass}>Admin</th>
                    <th scope="col" className={thClass}>Status</th>
                    <th scope="col" className={thClass}>Login terakhir</th>
                    <th scope="col" className={`${thClass} text-right`}>Sesi</th>
                    <th scope="col" className={`${thClass} hidden lg:table-cell`}>Dibuat</th>
                    <th scope="col" className={thClass}>
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {list.map((a) => (
                    <tr key={a.id} className={a.active ? "" : "bg-bg-muted/40"}>
                      <td className={`${tdClass} py-2.5`}>
                        <AdminIdentity a={a} />
                      </td>
                      <td className={tdClass}>
                        <StatusBadge a={a} />
                      </td>
                      <td className={`${tdClass} whitespace-nowrap text-text-body`}>
                        <TimeAgo value={a.last_login_at} />
                      </td>
                      <td className={`${tdClass} text-right tabular-nums`}>{a.active_sessions}</td>
                      <td className={`${tdClass} hidden text-[13px] text-text-body lg:table-cell`}>
                        <span title={formatDateTime(a.created_at)}>
                          <TimeAgo value={a.created_at} />
                        </span>
                        <span className="block text-text-muted">{a.created_by ? `oleh ${a.created_by.name}` : "lewat CLI"}</span>
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <RowActions a={a} onAction={setPending} activeCount={activeCount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ul className="divide-y divide-border-subtle md:hidden">
                {list.map((a) => (
                  <li key={a.id} className="flex flex-col gap-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <AdminIdentity a={a} />
                      <StatusBadge a={a} />
                    </div>
                    <p className="text-[13px] text-text-muted">
                      Login <TimeAgo value={a.last_login_at} /> · {a.active_sessions} sesi aktif
                    </p>
                    <div className="flex justify-end">
                      <RowActions a={a} onAction={setPending} activeCount={activeCount} />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      <p className="mt-3 text-[13px] text-text-muted">
        Semua admin setara. Pemulihan darurat (mis. semua admin terkunci) tetap lewat CLI server.
      </p>

      <AddAdminDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(admin, temp) => {
          setAdding(false);
          if (state.data) setData([...state.data, admin]);
          setReveal({ title: `${admin.name} ditambahkan`, who: admin, temp });
        }}
      />

      <ConfirmDialog
        open={pending !== null}
        busy={busy}
        onClose={() => setPending(null)}
        onConfirm={runPending}
        tone={pending?.kind === "enable" ? "primary" : "danger"}
        title={
          pending?.kind === "disable"
            ? `Nonaktifkan ${pending.admin.name}?`
            : pending?.kind === "enable"
              ? `Aktifkan ${pending?.admin.name}?`
              : `Reset password ${pending?.admin.name}?`
        }
        confirmLabel={pending?.kind === "disable" ? "Nonaktifkan" : pending?.kind === "enable" ? "Aktifkan" : "Reset password"}
      >
        {pending?.kind === "disable" && (
          <p>
            Semua sesinya langsung berakhir dan <strong>{pending.admin.email}</strong> tidak bisa masuk sampai diaktifkan lagi.
          </p>
        )}
        {pending?.kind === "enable" && <p>{pending.admin.email} bisa masuk lagi dengan password terakhirnya.</p>}
        {pending?.kind === "reset" && (
          <p>
            Password lama berhenti berlaku dan semua sesinya berakhir. Anda akan menerima password sementara baru (72 jam) untuk
            disampaikan ke <strong>{pending.admin.email}</strong>.
          </p>
        )}
      </ConfirmDialog>

      <TempPasswordDialog reveal={reveal} onClose={() => setReveal(null)} />
    </>
  );
}

function adminError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === "CANNOT_TARGET_SELF") return "Tidak bisa untuk akun sendiri. Ganti password lewat Akun saya.";
    if (err.code === "LAST_ACTIVE_ADMIN") return "Harus tersisa minimal satu admin aktif.";
    if (err.code === "ADMIN_INACTIVE") return "Admin ini nonaktif. Aktifkan dulu sebelum reset password.";
    if (err.code === "ADMIN_EXISTS") return "Email ini sudah terdaftar sebagai admin.";
  }
  return errorMessage(err);
}

function AdminIdentity({ a }: { a: AdminListItem }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar name={a.name} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={`truncate font-semibold ${a.active ? "text-text-heading" : "text-text-muted"}`}>{a.name}</span>
          {a.is_me && <Badge tone="brand">Anda</Badge>}
        </span>
        <span className="block truncate text-[13px] text-text-muted">{a.email}</span>
      </span>
    </span>
  );
}

function StatusBadge({ a }: { a: AdminListItem }) {
  if (!a.active) return <Badge>Nonaktif</Badge>;
  if (a.must_change_password) {
    return (
      <span title="Belum mengganti password sementara">
        <Badge tone="warning">
          <KeyRound size={12} aria-hidden /> Menunggu ganti password
        </Badge>
      </span>
    );
  }
  return <Badge tone="success">Aktif</Badge>;
}

function RowActions({
  a,
  onAction,
  activeCount,
}: {
  a: AdminListItem;
  onAction: (p: Pending) => void;
  activeCount: number;
}) {
  if (a.is_me) {
    return (
      <Link href="/admin/akun" className={`${btn.ghost} ${smallBtn}`}>
        Akun saya
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-wrap justify-end gap-1">
      {a.active && (
        <button type="button" className={`${btn.ghost} ${smallBtn}`} onClick={() => onAction({ kind: "reset", admin: a })}>
          Reset password
        </button>
      )}
      {a.active ? (
        <button
          type="button"
          className={`inline-flex min-h-8 items-center rounded-[10px] px-3 text-[13px] font-semibold text-danger transition-colors hover:bg-danger-tint disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          onClick={() => onAction({ kind: "disable", admin: a })}
          disabled={activeCount <= 1}
          title={activeCount <= 1 ? "Harus tersisa minimal satu admin aktif" : undefined}
        >
          Nonaktifkan
        </button>
      ) : (
        <button type="button" className={`${btn.secondary} ${smallBtn}`} onClick={() => onAction({ kind: "enable", admin: a })}>
          Aktifkan
        </button>
      )}
    </span>
  );
}

function AddAdminDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (a: AdminListItem, temp: TempPassword) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    if (busy) return;
    setEmail("");
    setName("");
    setErrors({});
    setError(null);
    onClose();
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) local.email = "Isi email yang valid.";
    if (name.trim().length < 2 || name.trim().length > 80) local.name = "Nama 2–80 karakter.";
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const r = await (await adminApi()).createAdmin({ email: email.trim(), name: name.trim() });
      setEmail("");
      setName("");
      onCreated(r.admin, { temporary_password: r.temporary_password, expires_at: r.expires_at });
    } catch (err) {
      if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setErrors(fieldErrors(err));
      else if (err instanceof ApiError && err.code === "ADMIN_EXISTS") setErrors({ email: "Email ini sudah terdaftar sebagai admin." });
      else setError(adminError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      dismissible={!busy}
      title="Tambah admin"
      description="Server membuat password sementara yang hanya ditampilkan sekali setelah ini."
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <Field id="new-admin-name" label="Nama" error={errors.name}>
          <input
            id="new-admin-name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            maxLength={80}
            aria-invalid={!!errors.name}
            autoFocus
          />
        </Field>
        <Field id="new-admin-email" label="Email" error={errors.email} hint="Disarankan email @sissi.id.">
          <input
            id="new-admin-email"
            type="email"
            inputMode="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            aria-invalid={!!errors.email}
          />
        </Field>
        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className={btn.secondary} onClick={close} disabled={busy}>
            Batal
          </button>
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy && <Spinner />}
            Buat admin
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Password sementara: tampil sekali, tidak bisa ditutup dengan Esc/latar — hanya "Sudah disalin". */
function TempPasswordDialog({ reveal, onClose }: { reveal: Reveal; onClose: () => void }) {
  return (
    <Modal
      open={reveal !== null}
      onClose={onClose}
      dismissible={false}
      title={reveal?.title ?? ""}
      icon={<ShieldAlert size={22} aria-hidden className="text-warning" />}
      description={reveal ? <>Sampaikan password sementara ini ke {reveal.who.email}.</> : undefined}
      footer={
        <button type="button" className={btn.primary} onClick={onClose}>
          Sudah disalin
        </button>
      }
    >
      {reveal && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 rounded-[12px] border border-border-subtle bg-bg-muted py-2 pr-2 pl-4">
            <code className="min-w-0 flex-1 break-all font-mono text-[18px] font-semibold tracking-wide text-text-heading select-all">
              {reveal.temp.temporary_password}
            </code>
            <CopyButton value={reveal.temp.temporary_password} label="Salin password sementara" />
          </div>
          <Notice tone="warning">
            <p className="font-semibold">Hanya ditampilkan sekali.</p>
            <p>
              Kirim lewat kanal aman (mis. berbagi item password manager), bukan chat biasa. Berlaku sampai{" "}
              <strong>{formatDateTime(reveal.temp.expires_at)}</strong>; setelah itu buat ulang lewat Reset password.
            </p>
          </Notice>
        </div>
      )}
    </Modal>
  );
}
