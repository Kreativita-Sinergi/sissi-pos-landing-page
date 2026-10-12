"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Bug, ExternalLink, Smartphone, Store, UserRoundX, Activity, MonitorSmartphone } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AuditEntry, Summary } from "@/lib/admin/types";
import { StackBar } from "./charts";
import { AUDIT_ACTIONS, labelOf, TARGET_TYPES } from "./labels";
import { PLAN_COLORS } from "./subscriptionUi";
import {
  Badge,
  ErrorBlock,
  focusRing,
  formatBytes,
  formatDateTime,
  formatRelative,
  formatRupiah,
  formatRupiahShort,
  PageHeader,
  Section,
  Skeleton,
  StatCard,
  useLoad,
} from "./ui";

type Data = { summary: Summary; audit: AuditEntry[] };

export function SummaryView() {
  const { state, reload } = useLoad<Data>(async (signal) => {
    const api = await adminApi();
    const [summary, audit] = await Promise.all([api.summary(signal), api.auditPage({ limit: 8 }, signal)]);
    return { summary, audit: audit.items };
  }, []);

  return (
    <>
      <PageHeader title="Ringkasan" description="Keadaan rilis aplikasi dan pengguna Sissi saat ini." />
      {state.status === "error" && !state.data && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <SummarySkeleton />}
      {state.data && <SummaryBody data={state.data} />}
    </>
  );
}

function SummarySkeleton() {
  return (
    <div role="status" aria-label="Memuat ringkasan" className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rounded-[14px] border border-border-subtle bg-white px-4 py-3.5">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-2.5 h-6 w-12" />
            <Skeleton className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-[14px] border border-border-subtle bg-white p-5">
            <Skeleton className="h-4 w-32" />
            {[0, 1, 2, 3].map((k) => (
              <Skeleton key={k} className="mt-4 h-3.5 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-[14px]">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-text-heading">{children}</dd>
    </div>
  );
}

const linkClass = `inline-flex items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline ${focusRing}`;

function SummaryBody({ data }: { data: Data }) {
  const { summary, audit } = data;
  const v = summary.app_version;
  const r = summary.latest_release;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        <StatCard label="Total bisnis" value={summary.businesses_total} icon={<Store size={14} aria-hidden />} href="/admin/bisnis" />
        <StatCard
          label="Bisnis aktif"
          value={summary.businesses_active_7d}
          hint={summary.businesses_active_30d !== undefined ? `7 hari · ${summary.businesses_active_30d} dalam 30 hari` : "7 hari terakhir"}
          icon={<Activity size={14} aria-hidden />}
          href="/admin/bisnis?active=7d"
        />
        <StatCard
          label="Perangkat aktif"
          value={summary.devices_active_7d}
          hint="7 hari terakhir"
          icon={<MonitorSmartphone size={14} aria-hidden />}
        />
        {summary.crashes_24h && (
          <StatCard
            label="Crash 24 jam"
            value={summary.crashes_24h.events}
            tone={summary.crashes_24h.new_groups > 0 ? "danger" : "neutral"}
            icon={<Bug size={14} aria-hidden />}
            href="/admin/crash"
            hint={
              summary.crashes_24h.events === 0
                ? "Aplikasi sehat"
                : `${summary.crashes_24h.groups} grup${summary.crashes_24h.new_groups ? ` · ${summary.crashes_24h.new_groups} baru` : ""}${
                    summary.crash_groups_open !== undefined ? ` · ${summary.crash_groups_open} terbuka` : ""
                  }`
            }
          />
        )}
        {summary.deletions && (
          <StatCard
            label="Hapus akun terjadwal"
            value={summary.deletions.scheduled}
            tone={summary.deletions.due_7d > 0 ? "warning" : "neutral"}
            icon={<UserRoundX size={14} aria-hidden />}
            href="/admin/hapus-akun"
            hint={summary.deletions.due_7d > 0 ? `${summary.deletions.due_7d} dihapus ≤ 7 hari` : "Tidak ada yang mendesak"}
          />
        )}
        {summary.devices_below_min_build !== undefined && (
          <StatCard
            label="Di bawah build minimum"
            value={summary.devices_below_min_build}
            tone={summary.devices_below_min_build > 0 ? "warning" : "success"}
            icon={<Smartphone size={14} aria-hidden />}
            href="/admin/versi"
            hint="Perangkat aktif 30 hari"
          />
        )}
      </div>

      {summary.subscriptions && <SubscriptionsCard summary={summary} />}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section
          title="Versi aktif (Android)"
          actions={
            <Link href="/admin/versi" className={linkClass}>
              Ubah <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          <dl className="divide-y divide-border-subtle">
            <Row label="Versi terbaru">
              {v.latest_version} <span className="text-text-muted">(build {v.latest_build})</span>
            </Row>
            <Row label="Build minimum">{v.min_build}</Row>
            <Row label="Sumber">
              {v.source === "db" ? <Badge tone="success">Database</Badge> : <Badge tone="warning">Env server</Badge>}
            </Row>
            <Row label="Diubah">
              {v.updated_at ? `${formatDateTime(v.updated_at)}${v.updated_by ? ` · ${v.updated_by.name}` : ""}` : "—"}
            </Row>
          </dl>
        </Section>

        <Section
          title="APK terbaru"
          actions={
            <Link href="/admin/apk" className={linkClass}>
              Kelola <ArrowRight size={14} aria-hidden />
            </Link>
          }
        >
          {r ? (
            <dl className="divide-y divide-border-subtle">
              <Row label="Versi">
                {r.version} <span className="text-text-muted">(build {r.build}, {r.abi})</span>
              </Row>
              <Row label="Ukuran">{formatBytes(r.size_bytes)}</Row>
              <Row label="Dirilis">{formatDateTime(r.released_at)}</Row>
              <Row label="Berkas">
                <a href={r.url} className={`${linkClass} max-w-full`} target="_blank" rel="noopener noreferrer">
                  <span className="truncate">{r.file}</span>
                  <ExternalLink size={13} aria-hidden className="shrink-0" />
                </a>
              </Row>
            </dl>
          ) : (
            <p className="py-6 text-center text-[14px] text-text-muted">Belum ada APK yang diterbitkan.</p>
          )}
          {r && v.latest_build !== r.build && (
            <p className="mt-2 rounded-[10px] bg-warning-tint px-3 py-2 text-[13px] text-warning">
              Build terbaru di pengaturan versi ({v.latest_build}) berbeda dengan APK terbaru ({r.build}).
            </p>
          )}
        </Section>
      </div>

      <Section
        title="Aktivitas terakhir"
        bodyClass=""
        actions={
          <Link href="/admin/audit" className={linkClass}>
            Semua <ArrowRight size={14} aria-hidden />
          </Link>
        }
      >
        {audit.length === 0 ? (
          <p className="px-5 py-6 text-center text-[14px] text-text-muted">Belum ada aktivitas.</p>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {audit.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[14px] sm:px-5">
                <span className="font-medium text-text-heading">{labelOf(AUDIT_ACTIONS, e.action)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-muted">
                  {labelOf(TARGET_TYPES, e.target_type)}{" "}
                  <span className="font-mono text-text-body">{e.target_id.length > 24 ? `${e.target_id.slice(0, 8)}…` : e.target_id}</span>
                </span>
                <span className="text-[13px] text-text-muted">
                  {e.admin?.name ?? "CLI"} · <time dateTime={e.created_at} title={formatDateTime(e.created_at)}>{formatRelative(e.created_at)}</time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function SubscriptionsCard({ summary }: { summary: Summary }) {
  const p = summary.subscriptions!;
  const total = p.trial + p.active + p.grace + p.free;
  const stats: { label: string; value: string; href: string; tone?: string; hint?: string }[] = [
    { label: "Pro berbayar", value: p.active.toLocaleString("id-ID"), href: "/admin/langganan?status=active", hint: `${p.trial} uji coba · ${p.grace} tenggang` },
    {
      label: "Berakhir ≤ 7 hari",
      value: p.expiring_7d.toLocaleString("id-ID"),
      href: "/admin/langganan?expiring=7d",
      tone: p.expiring_7d > 0 ? "text-warning" : undefined,
      hint: "Uji coba & Pro",
    },
    {
      label: "Pendapatan bulan ini",
      value: summary.revenue_this_month !== undefined ? formatRupiahShort(summary.revenue_this_month) : "—",
      href: "/admin/metrik",
      hint: summary.revenue_this_month !== undefined ? formatRupiah(summary.revenue_this_month) : undefined,
    },
    {
      label: "Gratis lewat batas",
      value: p.over_limit.toLocaleString("id-ID"),
      href: "/admin/langganan?over_limit=true",
      tone: p.over_limit > 0 ? "text-warning" : undefined,
      hint: "Calon Pro bulan ini",
    },
  ];
  return (
    <Section
      title="Langganan"
      actions={
        <Link href="/admin/langganan" className={linkClass}>
          Kelola <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
        {stats.map((x) => (
          <Link key={x.label} href={x.href} className={`group min-w-0 rounded-[8px] ${focusRing}`}>
            <p className="text-[12.5px] text-text-muted group-hover:text-text-heading">{x.label}</p>
            <p className={`mt-0.5 text-[22px] font-bold leading-tight tabular-nums ${x.tone ?? "text-text-heading"}`}>{x.value}</p>
            {x.hint && <p className="text-[12px] text-text-muted">{x.hint}</p>}
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <StackBar
          label={`Paket ${total} bisnis`}
          parts={[
            { label: "Pro", value: p.active, color: PLAN_COLORS.active },
            { label: "Uji coba", value: p.trial, color: PLAN_COLORS.trial },
            { label: "Tenggang", value: p.grace, color: PLAN_COLORS.grace },
            { label: "Gratis", value: p.free, color: PLAN_COLORS.free },
          ]}
        />
        <p className="mt-1.5 text-[12px] text-text-muted">
          Pro {p.active} · Uji coba {p.trial} · Tenggang {p.grace} · Gratis {p.free}
        </p>
      </div>
    </Section>
  );
}
