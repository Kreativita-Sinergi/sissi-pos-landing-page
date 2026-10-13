"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Info, Plus, Settings, Store, Trash2 } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { Badge, btn, errorMessage, Field, focusRing, iconBtn, inputClass, Notice, Section, Spinner, useLoad } from "@/components/admin/ui";
import { newId, ownerApi, pullAll } from "@/lib/owner/api";
import { deleteRecord, saveErrorText, saveRecord } from "@/lib/owner/records";
import type { OwnerOutlet, SubscriptionDetail, SyncRecord } from "@/lib/owner/types";
import { useOwner } from "./OwnerShell";

// Kelola outlet dari web (api.md "Dasbor pemilik › Nomor 14"): tambah dalam kuota paket (`limits.outlets`; server
// menolak 422 bila penuh), hapus dengan konfirmasi tegas (minimal satu outlet = `LAST_OUTLET`). Setelah berubah,
// sesi dimuat ulang agar pemilih outlet ikut.

const DELETE_WORD = "HAPUS";

export function OutletManage({ onChanged }: { onChanged: () => void }) {
  const { session, refreshSession } = useOwner();
  const toast = useToast();
  const sub = useLoad<SubscriptionDetail>(async (signal) => (await ownerApi()).subscription(signal), []);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<OwnerOutlet | null>(null);

  const outlets = session.outlets;
  const quota = sub.state.data?.limits.outlets ?? null;
  const used = sub.state.data ? Math.max(sub.state.data.usage.outlets, outlets.length) : outlets.length;
  const full = quota !== null && used >= quota;

  const changed = async () => {
    await refreshSession().catch(() => {});
    sub.reload();
    onChanged();
  };

  return (
    <Section
      title="Kelola outlet"
      description={quota === null ? `${outlets.length} outlet aktif` : `${used} dari ${quota} outlet terpakai (kuota paket)`}
      actions={
        <button type="button" className={btn.primary} disabled={full || sub.state.status === "loading"} onClick={() => setAdding(true)}>
          <Plus size={16} aria-hidden /> Tambah outlet
        </button>
      }
    >
      {full && (
        <div className="mb-4">
          <Notice tone="info" icon={<Info size={17} aria-hidden />} title="Kuota outlet penuh">
            <p className="text-[13.5px]">
              Paket ini memuat {quota} outlet dan semuanya sudah dipakai. Tambah kuota outlet atau ganti paket lewat{" "}
              <Link href="/dasbor/langganan" className={`rounded font-semibold underline ${focusRing}`}>
                Langganan
              </Link>
              , atau hapus outlet yang tidak dipakai.
            </p>
          </Notice>
        </div>
      )}
      {sub.state.status === "error" && (
        <p className="mb-3 text-[13px] text-text-muted">Kuota outlet tidak bisa dimuat ({errorMessage(sub.state.error)}). Server tetap memeriksa kuota saat menambah.</p>
      )}
      <ul className="divide-y divide-border-subtle">
        {outlets.map((o) => (
          <li key={o.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <Store size={18} aria-hidden className="shrink-0 text-text-muted" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[14px] font-semibold text-text-heading">{o.name}</span>
                {o.status === "closed" && <Badge>Tutup</Badge>}
              </span>
              {o.address && <span className="block truncate text-[12.5px] text-text-muted">{o.address}</span>}
            </span>
            <Link href={`/dasbor/pengaturan?outlet=${encodeURIComponent(o.id)}`} className={iconBtn} aria-label={`Pengaturan ${o.name}`} title="Pengaturan outlet">
              <Settings size={16} aria-hidden />
            </Link>
            <button
              type="button"
              className={`${iconBtn} hover:text-danger`}
              onClick={() => setRemoving(o)}
              disabled={outlets.length <= 1}
              aria-label={`Hapus outlet ${o.name}`}
              title={outlets.length <= 1 ? "Minimal harus ada satu outlet" : "Hapus outlet"}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </li>
        ))}
      </ul>

      <AddOutletDialog
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={async (name) => {
          setAdding(false);
          toast.success(`Outlet "${name}" ditambahkan. Atur pajak, struk, dan metode pembayarannya di Pengaturan.`);
          await changed();
        }}
      />
      <DeleteOutletDialog
        outlet={removing}
        onClose={() => setRemoving(null)}
        onDeleted={async (name) => {
          setRemoving(null);
          toast.success(`Outlet "${name}" dihapus.`);
          await changed();
        }}
      />
    </Section>
  );
}

function AddOutletDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (name: string) => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} title="Tambah outlet" description="Outlet baru langsung muncul di aplikasi kasir saat sinkron." onClose={onClose} dismissible={!busy}>
      {open && <AddOutletForm busy={busy} setBusy={setBusy} onClose={onClose} onAdded={onAdded} />}
    </Modal>
  );
}

function AddOutletForm({ busy, setBusy, onClose, onAdded }: { busy: boolean; setBusy: (v: boolean) => void; onClose: () => void; onAdded: (name: string) => void }) {
  const uid = useId();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameErr = !name.trim() ? "Nama outlet wajib diisi." : name.trim().length > 80 ? "Maksimal 80 huruf." : undefined;
  const addrErr = address.trim().length > 200 ? "Maksimal 200 huruf." : undefined;

  const submit = async () => {
    setTouched(true);
    if (nameErr || addrErr) return;
    setBusy(true);
    setError(null);
    try {
      const r = await saveRecord("outlets", newId(), null, { name: name.trim(), address: address.trim(), status: "open", settings: {} });
      if (r.status === "applied") onAdded(name.trim());
      else setError(r.status === "rejected" ? [r.message, ...r.details.map((d) => d.message)].filter(Boolean).join(" ") : r.message);
    } catch (err) {
      setError(saveErrorText(err, errorMessage));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
      <Field id={`${uid}-name`} label="Nama outlet" error={touched ? nameErr : undefined}>
        <input id={`${uid}-name`} className={inputClass} value={name} maxLength={80} autoFocus onChange={(e) => setName(e.target.value)} aria-invalid={(touched && !!nameErr) || undefined} />
      </Field>
      <Field id={`${uid}-address`} label="Alamat" hint="Opsional · tampil di struk." error={addrErr}>
        <textarea id={`${uid}-address`} className={`${inputClass} min-h-[72px] py-2`} value={address} maxLength={200} onChange={(e) => setAddress(e.target.value)} />
      </Field>
      <p className="text-[12.5px] text-text-muted">Pengaturan (pajak, struk, metode pembayaran) dimulai kosong; atur setelah outlet dibuat.</p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
          Batal
        </button>
        <button type="submit" className={btn.primary} disabled={busy}>
          {busy && <Spinner />}
          Tambah outlet
        </button>
      </div>
    </form>
  );
}

function DeleteOutletDialog({ outlet, onClose, onDeleted }: { outlet: OwnerOutlet | null; onClose: () => void; onDeleted: (name: string) => void }) {
  const uid = useId();
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setTyped("");
    setError(null);
    onClose();
  };

  const remove = async () => {
    if (!outlet) return;
    setBusy(true);
    setError(null);
    try {
      const rec = (await pullAll<SyncRecord>("outlets")).find((r) => r.id === outlet.id);
      if (!rec) {
        onDeleted(outlet.name);
        return;
      }
      const r = await deleteRecord("outlets", rec);
      if (r.status === "applied") {
        setTyped("");
        onDeleted(outlet.name);
      } else if (r.status === "rejected" && r.details.length === 0 && /satu outlet/i.test(r.message)) {
        setError("Minimal harus ada satu outlet. Tambah outlet lain dulu sebelum menghapus yang ini.");
      } else setError(r.status === "rejected" ? [r.message, ...r.details.map((d) => d.message)].filter(Boolean).join(" ") : r.message);
    } catch (err) {
      setError(saveErrorText(err, errorMessage));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConfirmDialog
      open={outlet !== null}
      title={outlet ? `Hapus outlet ${outlet.name}?` : "Hapus outlet"}
      confirmLabel="Hapus outlet"
      tone="danger"
      busy={busy}
      confirmDisabled={typed.trim().toUpperCase() !== DELETE_WORD}
      onConfirm={() => void remove()}
      onClose={close}
    >
      <div className="flex flex-col gap-3">
        <Notice tone="danger" icon={<AlertTriangle size={17} aria-hidden />}>
          <ul className="list-disc pl-4 text-[13.5px]">
            <li>Outlet hilang dari pemilih outlet, laporan, dan semua perangkat kasir saat sinkron.</li>
            <li>
              Perangkat kasir/dapur yang terpasang di outlet ini <strong>perlu dipindah ke outlet lain lewat aplikasi</strong>.
            </li>
            <li>Riwayat transaksi lama tetap tersimpan. Minimal harus ada satu outlet.</li>
          </ul>
        </Notice>
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <Field id={`${uid}-type`} label={`Ketik ${DELETE_WORD} untuk melanjutkan`}>
          <input id={`${uid}-type`} className={inputClass} value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} disabled={busy} />
        </Field>
      </div>
    </ConfirmDialog>
  );
}
