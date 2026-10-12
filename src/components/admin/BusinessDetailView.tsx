"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CircleCheck, CreditCard, QrCode, TriangleAlert } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { BusinessDetail, Features, FeaturesInput, PaymentProvider } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { ConfirmDialog } from "./ConfirmDialog";
import { BUSINESS_TYPES, DEVICE_MODES, labelOf, PROVIDERS, ROLES } from "./labels";
import {
  Badge,
  btn,
  CopyButton,
  ErrorBlock,
  errorMessage,
  focusRing,
  formatDate,
  formatDateTime,
  formatRelative,
  LoadingBlock,
  Notice,
  PageHeader,
  Section,
  Spinner,
  Switch,
  useLoad,
} from "./ui";

const backLink = (
  <Link
    href="/admin/bisnis"
    className={`mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-body hover:text-text-heading ${focusRing}`}
  >
    <ArrowLeft size={15} aria-hidden /> Semua bisnis
  </Link>
);

export function BusinessDetailView() {
  const { id } = useParams<{ id: string }>();
  const { state, reload, setData } = useLoad<BusinessDetail>(async (signal) => (await adminApi()).business(id, signal), [id]);

  if (!state.data) {
    return (
      <>
        <PageHeader title="Detail bisnis" back={backLink} />
        {state.status === "error" ? (
          state.error instanceof ApiError && state.error.status === 404 ? (
            <Notice tone="info">Bisnis tidak ditemukan. Mungkin sudah dihapus.</Notice>
          ) : (
            <ErrorBlock error={state.error} onRetry={reload} />
          )
        ) : (
          <LoadingBlock />
        )}
      </>
    );
  }

  const b = state.data;
  return (
    <>
      <PageHeader
        title={b.name}
        back={backLink}
        description={
          <>
            {labelOf(BUSINESS_TYPES, b.type)}
            {b.category ? ` · ${b.category}` : ""} · terdaftar {formatDate(b.created_at)}
          </>
        }
        actions={
          <Link href={`/admin/audit?target_type=business&target_id=${encodeURIComponent(b.id)}`} className={btn.secondary}>
            Riwayat audit
          </Link>
        }
      />
      {b.deletion && (
        <div className="mb-5">
          <Notice tone="danger" icon={<TriangleAlert size={18} aria-hidden />} title="Penghapusan akun terjadwal">
            Data bisnis ini dihapus permanen setelah {formatDateTime(b.deletion.purge_after)} kecuali pemilik membatalkan.
          </Notice>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-5">
          <Section title="Informasi">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-[14px] sm:grid-cols-2">
              <Info label="Pemilik">
                {b.owner ? (
                  <>
                    <span className="block">{b.owner.name}</span>
                    <span className="block break-all text-[13px] text-text-muted">{b.owner.email}</span>
                    {b.owner.phone && <span className="block text-[13px] text-text-muted">{b.owner.phone}</span>}
                  </>
                ) : (
                  "—"
                )}
              </Info>
              <Info label="Aktif terakhir">
                <span title={formatDateTime(b.last_active_at)}>{formatRelative(b.last_active_at)}</span>
              </Info>
              <Info label="Jumlah">
                {b.outlets_count} outlet · {b.devices_count} perangkat · {b.users_count} pengguna
              </Info>
              <Info label="ID bisnis">
                <span className="flex items-center gap-1">
                  <code className="min-w-0 truncate font-mono text-[12.5px]">{b.id}</code>
                  <CopyButton value={b.id} label="Salin ID bisnis" />
                </span>
              </Info>
            </dl>
          </Section>

          <ListSection title={`Outlet (${b.outlets.length})`} empty="Belum ada outlet.">
            {b.outlets.map((o) => (
              <Item key={o.id} title={o.name} meta={`Dibuat ${formatDate(o.created_at)}`} badge={o.status !== "active" ? <Badge>{o.status}</Badge> : null} />
            ))}
          </ListSection>

          <ListSection title={`Perangkat (${b.devices.length})`} empty="Belum ada perangkat.">
            {b.devices.map((d) => (
              <Item
                key={d.id}
                title={d.name}
                meta={`${labelOf(DEVICE_MODES, d.mode)}${d.outlet_id ? ` · ${b.outlets.find((o) => o.id === d.outlet_id)?.name ?? "outlet lain"}` : ""}`}
                right={<span title={formatDateTime(d.last_seen_at)}>{formatRelative(d.last_seen_at)}</span>}
              />
            ))}
          </ListSection>

          <ListSection title={`Pengguna (${b.users.length})`} empty="Belum ada pengguna.">
            {b.users.map((u) => (
              <Item key={u.id} title={u.name} meta={u.email} badge={<Badge tone={u.role === "owner" ? "brand" : "neutral"}>{labelOf(ROLES, u.role)}</Badge>} />
            ))}
          </ListSection>
        </div>

        <div className="order-first lg:sticky lg:top-6 lg:order-none lg:self-start">
          <FeaturesCard
            business={b}
            onSaved={(features) => setData({ ...b, features })}
          />
        </div>
      </div>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-text-heading">{children}</dd>
    </div>
  );
}

function ListSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <Section title={title} bodyClass="">
      {children.length === 0 ? (
        <p className="px-5 py-5 text-[14px] text-text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border-subtle">{children}</ul>
      )}
    </Section>
  );
}

function Item({ title, meta, badge, right }: { title: string; meta?: string; badge?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5 text-[14px] sm:px-5">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium text-text-heading">
          <span className="min-w-0 truncate">{title}</span>
          {badge}
        </p>
        {meta && <p className="truncate text-[13px] text-text-muted">{meta}</p>}
      </div>
      {right && <span className="shrink-0 text-[13px] text-text-muted">{right}</span>}
    </li>
  );
}

function describe(f: FeaturesInput): string {
  if (!f.self_order) return "Pesan QR mati";
  if (!f.online_payment) return "Pesan QR aktif, bayar di kasir";
  const p = PROVIDERS.find((x) => x.value === f.provider)?.label ?? f.provider;
  return `Pesan QR aktif, bayar online lewat ${p}`;
}

function FeaturesCard({ business, onSaved }: { business: BusinessDetail; onSaved: (f: Features) => void }) {
  const initial: FeaturesInput = {
    self_order: business.features.self_order,
    online_payment: business.features.online_payment,
    provider: business.features.provider,
  };
  const [form, setForm] = useState<FeaturesInput>(initial);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    form.self_order !== initial.self_order || form.online_payment !== initial.online_payment || form.provider !== initial.provider;
  const invalid = form.online_payment && (!form.self_order || !form.provider);

  const update = (patch: Partial<FeaturesInput>) => {
    setSaved(false);
    setError(null);
    setForm((f) => {
      const next = { ...f, ...patch };
      if (!next.self_order) next.online_payment = false;
      return next;
    });
  };

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body: FeaturesInput = { ...form, provider: form.provider };
      const features = await (await adminApi()).saveFeatures(business.id, body);
      setConfirm(false);
      setSaved(true);
      onSaved(features);
    } catch (err) {
      setConfirm(false);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Fitur" description={business.features.updated_at ? `Diubah ${formatDateTime(business.features.updated_at)}` : "Belum pernah diubah"}>
      <div className="flex flex-col gap-4">
        {saved && (
          <Notice tone="success" role="status" icon={<CircleCheck size={16} aria-hidden />}>
            Tersimpan. Aplikasi menerima perubahan saat memeriksa fitur berikutnya (paling lama ±1 jam, atau saat dibuka ulang).
          </Notice>
        )}
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <div className="flex gap-3">
          <QrCode size={18} aria-hidden className="mt-0.5 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <Switch
              id="f-self-order"
              label="Pesan QR"
              description="Pelanggan memesan dari meja lewat kasir.sissi.id/pesan."
              checked={form.self_order}
              onChange={(v) => update({ self_order: v })}
              disabled={busy}
            />
          </div>
        </div>
        <div className="flex gap-3">
          <CreditCard size={18} aria-hidden className="mt-0.5 shrink-0 text-text-muted" />
          <div className="min-w-0 flex-1">
            <Switch
              id="f-online"
              label="Bayar online"
              description={form.self_order ? "Pelanggan membayar di halaman pesan." : "Nyalakan Pesan QR dulu."}
              checked={form.online_payment}
              onChange={(v) => update({ online_payment: v, provider: v && !form.provider ? "midtrans" : form.provider })}
              disabled={busy || !form.self_order}
            />
          </div>
        </div>

        <fieldset disabled={busy || !form.online_payment} className="rounded-[12px] border border-border-subtle p-3 disabled:opacity-55">
          <legend className="px-1 text-[13px] font-semibold text-text-heading">Provider pembayaran</legend>
          <div className="flex flex-col gap-1">
            {PROVIDERS.map((p) => (
              <label
                key={p.value}
                className="flex cursor-pointer items-start gap-2.5 rounded-[8px] px-1.5 py-1.5 hover:bg-bg-muted has-[:disabled]:cursor-not-allowed has-[:disabled]:hover:bg-transparent"
              >
                <input
                  type="radio"
                  name="provider"
                  value={p.value}
                  checked={form.provider === p.value}
                  onChange={() => update({ provider: p.value as PaymentProvider })}
                  className={`mt-1 h-4 w-4 shrink-0 accent-brand-deep ${focusRing}`}
                />
                <span className="min-w-0">
                  <span className="block text-[14px] font-medium text-text-heading">{p.label}</span>
                  <span className="block text-[12.5px] text-text-muted">{p.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {invalid && <p className="text-[13px] text-danger">Bayar online butuh Pesan QR aktif dan provider.</p>}

        <div className="flex gap-2">
          <button type="button" className={`${btn.secondary} flex-1`} disabled={!dirty || busy} onClick={() => setForm(initial)}>
            Batal
          </button>
          <button type="button" className={`${btn.primary} flex-1`} disabled={!dirty || busy || invalid} onClick={() => setConfirm(true)}>
            {busy && <Spinner />}
            Simpan
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Ubah fitur bisnis?"
        confirmLabel="Simpan"
        busy={busy}
        onConfirm={save}
        onClose={() => setConfirm(false)}
      >
        <p>
          Fitur <span className="font-semibold text-text-heading">{business.name}</span> berubah:
        </p>
        <p className="mt-2">
          <span className="text-text-muted line-through decoration-text-muted/60">{describe(initial)}</span>
          <br />→ <span className="font-semibold text-text-heading">{describe(form)}</span>
        </p>
        <p className="mt-2 text-[13px] text-text-muted">Perubahan dicatat di audit.</p>
      </ConfirmDialog>
    </Section>
  );
}
