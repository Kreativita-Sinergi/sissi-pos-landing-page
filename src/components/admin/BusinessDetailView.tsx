"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CreditCard,
  Mail,
  MonitorSmartphone,
  Phone,
  QrCode,
  ScrollText,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AppVersionConfig, BusinessDetail, Features, FeaturesInput, PaymentProvider } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { ActivityDot } from "./BusinessListView";
import { ConfirmDialog } from "./ConfirmDialog";
import { useQueryState } from "./filters";
import { AUDIT_ACTIONS, BUSINESS_TYPES, DEVICE_MODES, labelOf, OUTLET_STATUS, PROVIDERS, ROLES } from "./labels";
import { useToast } from "./toast";
import {
  Badge,
  btn,
  cardClass,
  CopyButton,
  EmptyState,
  ErrorBlock,
  errorMessage,
  focusRing,
  formatDate,
  formatDateTime,
  Notice,
  PageHeader,
  Section,
  Skeleton,
  Spinner,
  StatCard,
  Switch,
  Tabs,
  tdClass,
  thClass,
  TimeAgo,
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

type TabId = "ringkasan" | "perangkat" | "karyawan" | "fitur" | "hapus-akun" | "aktivitas";
const TAB_IDS: TabId[] = ["ringkasan", "perangkat", "karyawan", "fitur", "hapus-akun", "aktivitas"];

type Data = { business: BusinessDetail; version: AppVersionConfig | null };

const DAY = 86_400_000;

export function daysUntil(iso: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY));
}

export function BusinessDetailView() {
  const { id } = useParams<{ id: string }>();
  const qs = useQueryState();
  const tabParam = qs.get("tab") as TabId;
  const tab: TabId = TAB_IDS.includes(tabParam) ? tabParam : "ringkasan";
  const [now] = useState(() => Date.now());

  const { state, reload, setData } = useLoad<Data>(async (signal) => {
    const api = await adminApi();
    const [business, version] = await Promise.all([
      api.business(id, signal),
      api.appVersion(signal).catch(() => null), // Penanda "versi lama" opsional; jangan gagalkan halaman.
    ]);
    return { business, version };
  }, [id]);

  if (!state.data) {
    return (
      <>
        <PageHeader title="Detail bisnis" back={backLink} />
        {state.status === "error" ? (
          state.error instanceof ApiError && state.error.status === 404 ? (
            <EmptyState
              icon={<TriangleAlert size={22} aria-hidden />}
              title="Bisnis tidak ditemukan"
              action={
                <Link href="/admin/bisnis" className={btn.secondary}>
                  Kembali ke daftar
                </Link>
              }
            >
              Mungkin sudah dihapus permanen atau tautannya salah.
            </EmptyState>
          ) : (
            <ErrorBlock error={state.error} onRetry={reload} />
          )
        ) : (
          <DetailSkeleton />
        )}
      </>
    );
  }

  const { business: b, version } = state.data;
  const setTab = (t: TabId) => qs.update({ tab: t === "ringkasan" ? null : t }, "replace");
  const outdated = b.devices.filter((d) => d.app && version && d.app.build < version.min_build).length;

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
            <ScrollText size={16} aria-hidden /> Riwayat audit
          </Link>
        }
      />
      {b.deletion && (
        <div className="mb-5">
          <Notice tone="danger" icon={<CalendarClock size={18} aria-hidden />} title={`Dihapus permanen dalam ${daysUntil(b.deletion.purge_after, now)} hari`}>
            Data bisnis ini dihapus setelah {formatDateTime(b.deletion.purge_after)} kecuali pemilik membatalkan.{" "}
            <button type="button" className={`font-semibold underline underline-offset-2 ${focusRing}`} onClick={() => setTab("hapus-akun")}>
              Lihat detail
            </button>
          </Notice>
        </div>
      )}

      <Tabs<TabId>
        label="Bagian detail bisnis"
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "ringkasan", label: "Ringkasan" },
          { id: "perangkat", label: "Outlet & perangkat", count: b.devices.length },
          { id: "karyawan", label: "Karyawan", count: b.employees_count ?? b.users.filter((u) => u.role !== "owner").length },
          { id: "fitur", label: "Fitur" },
          { id: "hapus-akun", label: b.deletion ? "Hapus akun ●" : "Hapus akun" },
          { id: "aktivitas", label: "Aktivitas", count: b.audit?.length },
        ]}
      />

      <div role="tabpanel" aria-label={tab}>
        {tab === "ringkasan" && <OverviewTab b={b} outdated={outdated} onTab={setTab} />}
        {tab === "perangkat" && <DevicesTab b={b} version={version} />}
        {tab === "karyawan" && <EmployeesTab b={b} />}
        {tab === "fitur" && (
          <div className="max-w-[560px]">
            <FeaturesCard business={b} onSaved={(features) => setData({ ...state.data!, business: { ...b, features } })} />
          </div>
        )}
        {tab === "hapus-akun" && <DeletionTab b={b} now={now} />}
        {tab === "aktivitas" && <ActivityTab b={b} />}
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Memuat bisnis" className="flex flex-col gap-5">
      <div className="flex gap-4 border-b border-border-subtle pb-3">
        {["w-20", "w-32", "w-20", "w-12", "w-20"].map((w, i) => (
          <Skeleton key={i} className={`h-4 ${w}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-[14px] border border-border-subtle bg-white p-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2.5 h-6 w-10" />
          </div>
        ))}
      </div>
      <div className={`${cardClass} p-5`}>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-4 h-3.5 w-2/3" />
        <Skeleton className="mt-3 h-3.5 w-1/2" />
      </div>
    </div>
  );
}

// ——— Ringkasan ———

function OverviewTab({ b, outdated, onTab }: { b: BusinessDetail; outdated: number; onTab: (t: TabId) => void }) {
  const o = b.owner;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
        <StatCard label="Outlet" value={b.outlets_count} />
        <StatCard
          label="Perangkat"
          value={b.devices_count}
          tone={outdated > 0 ? "warning" : "neutral"}
          hint={outdated > 0 ? `${outdated} versi lama` : undefined}
        />
        <StatCard label="Karyawan" value={b.employees_count ?? Math.max(0, b.users_count - 1)} />
        {b.stats && <StatCard label="Transaksi 30 hari" value={b.stats.sales_30d} hint="jumlah, bukan nilai" />}
        {b.stats && <StatCard label="Crash 30 hari" value={b.stats.crashes_30d} tone={b.stats.crashes_30d > 0 ? "warning" : "neutral"} />}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Pemilik">
          {o ? (
            <dl className="flex flex-col gap-3 text-[14px]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[14px] font-bold text-brand-ink">
                  {o.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <dt className="sr-only">Nama</dt>
                  <dd className="truncate font-semibold text-text-heading">{o.name}</dd>
                  <dd className="text-[13px] text-text-muted">
                    Login terakhir <TimeAgo value={o.last_login_at ?? null} />
                  </dd>
                </div>
              </div>
              <ContactRow icon={<Mail size={16} aria-hidden />} label="Email" value={o.email} copyLabel="Salin email">
                {o.email_verified === false && <Badge tone="warning">belum verifikasi</Badge>}
                {o.email_verified && <Badge tone="success">terverifikasi</Badge>}
              </ContactRow>
              {o.phone && (
                <ContactRow icon={<Phone size={16} aria-hidden />} label="HP" value={o.phone} copyLabel="Salin nomor HP" />
              )}
            </dl>
          ) : (
            <p className="text-[14px] text-text-muted">Tidak ada data pemilik.</p>
          )}
        </Section>

        <Section title="Informasi">
          <dl className="flex flex-col divide-y divide-border-subtle text-[14px]">
            <InfoRow label="Aktif terakhir">
              <ActivityDot at={b.last_active_at} />
            </InfoRow>
            <InfoRow label="Terdaftar">{formatDateTime(b.created_at)}</InfoRow>
            <InfoRow label="Fitur">
              <button type="button" onClick={() => onTab("fitur")} className={`text-right font-medium text-brand-ink hover:underline ${focusRing}`}>
                {describe(b.features)}
              </button>
            </InfoRow>
            <InfoRow label="ID bisnis">
              <span className="flex min-w-0 items-center gap-1">
                <code className="min-w-0 truncate font-mono text-[12.5px]">{b.id}</code>
                <CopyButton value={b.id} label="Salin ID bisnis" />
              </span>
            </InfoRow>
          </dl>
        </Section>
      </div>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  copyLabel,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-bg-muted py-1 pr-1 pl-3">
      <span className="text-text-muted">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="min-w-0 break-all font-medium text-text-heading">{value}</span>
        {children}
      </dd>
      <CopyButton value={value} label={copyLabel} />
    </div>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="flex min-w-0 justify-end text-right font-medium text-text-heading">{children}</dd>
    </div>
  );
}

// ——— Outlet & perangkat ———

function BuildBadge({ app, version }: { app: BusinessDetail["devices"][number]["app"]; version: AppVersionConfig | null }) {
  if (!app) return <Badge>build ?</Badge>;
  const label = `${app.build}${app.version ? ` · v${app.version}` : ""}`;
  if (version && app.build < version.min_build) {
    return (
      <span title={`Di bawah build minimum ${version.min_build} — tidak bisa sinkron`}>
        <Badge tone="danger">
          <TriangleAlert size={12} aria-hidden /> {label} · versi lama
        </Badge>
      </span>
    );
  }
  if (version && app.build < version.latest_build) {
    return (
      <span title={`Belum versi terbaru (${version.latest_build})`}>
        <Badge tone="warning">{label} · perlu update</Badge>
      </span>
    );
  }
  return <Badge tone="success">{label}</Badge>;
}

function DevicesTab({ b, version }: { b: BusinessDetail; version: AppVersionConfig | null }) {
  const groups = [
    ...b.outlets.map((o) => ({ outlet: o, devices: b.devices.filter((d) => d.outlet_id === o.id) })),
    ...(b.devices.some((d) => !d.outlet_id || !b.outlets.some((o) => o.id === d.outlet_id))
      ? [{ outlet: null, devices: b.devices.filter((d) => !d.outlet_id || !b.outlets.some((o) => o.id === d.outlet_id)) }]
      : []),
  ];
  if (b.outlets.length === 0 && b.devices.length === 0) {
    return (
      <div className={cardClass}>
        <EmptyState icon={<MonitorSmartphone size={22} aria-hidden />} title="Belum ada outlet atau perangkat">
          Pemilik belum menyelesaikan penyiapan di aplikasi.
        </EmptyState>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {version && (
        <p className="text-[13px] text-text-muted">
          Build minimum <strong className="text-text-heading">{version.min_build}</strong> · terbaru{" "}
          <strong className="text-text-heading">{version.latest_build}</strong>. “Terakhir sinkron” = push terakhir; build dari
          laporan aplikasi.
        </p>
      )}
      {groups.map(({ outlet, devices }) => (
        <Section
          key={outlet?.id ?? "none"}
          title={outlet ? outlet.name : "Tanpa outlet"}
          description={outlet ? `${labelOf(OUTLET_STATUS, outlet.status)} · dibuat ${formatDate(outlet.created_at)}` : undefined}
          actions={<span className="text-[13px] text-text-muted">{devices.length} perangkat</span>}
          bodyClass=""
        >
          {devices.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-text-muted">Belum ada perangkat di outlet ini.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {devices.map((d) => (
                <li key={d.id} className="grid grid-cols-1 gap-x-4 gap-y-1 px-4 py-2.5 text-[14px] sm:grid-cols-[minmax(0,1fr)_auto_150px] sm:items-center sm:px-5">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-heading">{d.name}</p>
                    <p className="text-[13px] text-text-muted">{labelOf(DEVICE_MODES, d.mode)}</p>
                  </div>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <BuildBadge app={d.app ?? null} version={version} />
                    {d.app && (
                      <span className="text-[12px] text-text-muted">
                        dilaporkan <TimeAgo value={d.app.seen_at} />
                      </span>
                    )}
                  </span>
                  <span className="text-[13px] text-text-body sm:text-right">
                    <span className="text-text-muted sm:hidden">Terakhir sinkron </span>
                    <TimeAgo value={d.last_seen_at} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      ))}
    </div>
  );
}

// ——— Karyawan ———

function EmployeesTab({ b }: { b: BusinessDetail }) {
  const users = [...b.users].sort((a, c) => Number(c.role === "owner") - Number(a.role === "owner"));
  if (users.length === 0) {
    return (
      <div className={cardClass}>
        <EmptyState icon={<Users size={22} aria-hidden />} title="Belum ada pengguna" />
      </div>
    );
  }
  return (
    <div className={cardClass}>
      <table className="w-full text-[14px]">
        <thead>
          <tr>
            <th scope="col" className={thClass}>Nama</th>
            <th scope="col" className={thClass}>Peran</th>
            <th scope="col" className={`${thClass} hidden sm:table-cell`}>Kontak</th>
            <th scope="col" className={`${thClass} hidden md:table-cell`}>Ditambahkan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {users.map((u) => (
            <tr key={u.id} className={u.is_active === false ? "text-text-muted" : ""}>
              <td className={`${tdClass} py-2.5`}>
                <p className={`font-semibold ${u.is_active === false ? "" : "text-text-heading"}`}>{u.name}</p>
                <p className="text-[12.5px] text-text-muted sm:hidden">{u.email ?? u.phone ?? "Login PIN"}</p>
              </td>
              <td className={tdClass}>
                <span className="flex flex-wrap gap-1">
                  <Badge tone={u.role === "owner" ? "brand" : "neutral"}>{labelOf(ROLES, u.role)}</Badge>
                  {u.is_active === false && <Badge tone="warning">nonaktif</Badge>}
                </span>
              </td>
              <td className={`${tdClass} hidden text-[13px] sm:table-cell`}>
                {u.email || u.phone ? (
                  <>
                    {u.email && <span className="block break-all">{u.email}</span>}
                    {u.phone && <span className="block text-text-muted">{u.phone}</span>}
                  </>
                ) : (
                  <span className="text-text-muted">Login PIN</span>
                )}
              </td>
              <td className={`${tdClass} hidden whitespace-nowrap text-[13px] text-text-body md:table-cell`}>{formatDate(u.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ——— Hapus akun ———

function DeletionTab({ b, now }: { b: BusinessDetail; now: number }) {
  const d = b.deletion;
  if (!d) {
    return (
      <div className={cardClass}>
        <EmptyState icon={<ShieldCheck size={22} aria-hidden />} title="Tidak ada jadwal hapus akun">
          Pemilik bisa meminta penghapusan dari aplikasi atau web. Jadwalnya akan tampil di sini dan di antrean hapus akun.
        </EmptyState>
      </div>
    );
  }
  const left = daysUntil(d.purge_after, now);
  return (
    <div className="grid max-w-[760px] grid-cols-1 gap-5 sm:grid-cols-[200px_minmax(0,1fr)]">
      <div className="flex flex-col items-center justify-center rounded-[14px] border border-danger/25 bg-danger-tint px-4 py-6 text-center text-danger">
        <p className="text-[48px] font-bold leading-none tabular-nums">{left}</p>
        <p className="mt-1 text-[14px] font-semibold">hari lagi</p>
        <p className="mt-2 text-[12px]">{formatDate(d.purge_after)}</p>
      </div>
      <Section title="Penghapusan akun terjadwal">
        <dl className="flex flex-col divide-y divide-border-subtle text-[14px]">
          {d.requested_at && <InfoRow label="Diminta">{formatDateTime(d.requested_at)}</InfoRow>}
          <InfoRow label="Dihapus permanen">{formatDateTime(d.purge_after)}</InfoRow>
          {d.source && <InfoRow label="Lewat">{d.source === "web" ? "Web" : "Aplikasi"}</InfoRow>}
          <InfoRow label="Alasan">
            <span className={d.reason ? "" : "text-text-muted"}>{d.reason || "Tidak diisi"}</span>
          </InfoRow>
        </dl>
        <p className="mt-4 rounded-[10px] bg-bg-muted px-3 py-2.5 text-[13px] leading-relaxed text-text-body">
          Admin tidak bisa membatalkan atau mempercepat. Bila pemilik ingin batal, arahkan ke tombol{" "}
          <strong>Batalkan penghapusan</strong> di aplikasi atau web (butuh verifikasi email pemilik).
        </p>
      </Section>
    </div>
  );
}

// ——— Aktivitas ———

function ActivityTab({ b }: { b: BusinessDetail }) {
  const entries = b.audit ?? [];
  const all = `/admin/audit?target_type=business&target_id=${encodeURIComponent(b.id)}`;
  return (
    <Section
      title="Aktivitas admin"
      description="20 tindakan admin terbaru untuk bisnis ini."
      bodyClass=""
      actions={
        <Link href={all} className={`inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`}>
          Lihat semua <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      {entries.length === 0 ? (
        <EmptyState icon={<ScrollText size={22} aria-hidden />} title="Belum ada tindakan admin">
          Perubahan fitur dari panel ini akan tercatat di sini.
        </EmptyState>
      ) : (
        <ol className="divide-y divide-border-subtle">
          {entries.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[14px] sm:px-5">
              <span className="font-semibold text-text-heading">{labelOf(AUDIT_ACTIONS, e.action)}</span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-body">{auditDetail(e.detail)}</span>
              <span className="text-[13px] text-text-muted">
                {e.admin?.name ?? "sistem"} · <TimeAgo value={e.created_at} />
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function auditDetail(detail: Record<string, unknown> | null): string {
  const after = detail?.after as Partial<FeaturesInput> | undefined;
  if (after && "self_order" in after) return describe(after as FeaturesInput);
  return "";
}

// ——— Fitur ———

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
  const toast = useToast();

  const dirty =
    form.self_order !== initial.self_order || form.online_payment !== initial.online_payment || form.provider !== initial.provider;
  const invalid = form.online_payment && (!form.self_order || !form.provider);

  const update = (patch: Partial<FeaturesInput>) => {
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
      const features = await (await adminApi()).saveFeatures(business.id, form);
      setConfirm(false);
      toast.success(`Fitur ${business.name} disimpan. Aplikasi menerima perubahan ≤ 1 jam.`);
      onSaved(features);
    } catch (err) {
      setConfirm(false);
      setError(errorMessage(err));
      toast.error(`Gagal menyimpan fitur: ${errorMessage(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Fitur" description={business.features.updated_at ? `Diubah ${formatDateTime(business.features.updated_at)}` : "Belum pernah diubah"}>
      <div className="flex flex-col gap-4">
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
        title={`Ubah fitur ${business.name}?`}
        confirmLabel="Simpan fitur"
        busy={busy}
        onConfirm={save}
        onClose={() => setConfirm(false)}
      >
        <p>
          <span className="text-text-muted line-through decoration-text-muted/60">{describe(initial)}</span>
          <br />→ <span className="font-semibold text-text-heading">{describe(form)}</span>
        </p>
        <p className="mt-2 text-[13px] text-text-muted">Aplikasi menerima perubahan paling lama ±1 jam. Dicatat di audit.</p>
      </ConfirmDialog>
    </Section>
  );
}
