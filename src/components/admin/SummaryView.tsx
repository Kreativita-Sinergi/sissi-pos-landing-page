"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AuditEntry, Summary } from "@/lib/admin/types";
import { AUDIT_ACTIONS, labelOf } from "./labels";
import {
  Badge,
  ErrorBlock,
  focusRing,
  formatBytes,
  formatDateTime,
  formatRelative,
  LoadingBlock,
  PageHeader,
  Section,
  useLoad,
} from "./ui";

type Data = { summary: Summary; audit: AuditEntry[] };

export function SummaryView() {
  const { state, reload } = useLoad<Data>(async (signal) => {
    const api = await adminApi();
    const [summary, audit] = await Promise.all([api.summary(signal), api.audit({ page: 1, per_page: 8 }, signal)]);
    return { summary, audit: audit.items };
  }, []);

  return (
    <>
      <PageHeader title="Ringkasan" description="Keadaan rilis aplikasi dan pengguna Sissi saat ini." />
      {state.status === "error" && !state.data && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <LoadingBlock />}
      {state.data && <SummaryBody data={state.data} />}
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-[14px] border border-border-subtle bg-white px-3 py-3 sm:px-4 sm:py-3.5">
      <p className="text-[12px] leading-snug text-text-muted sm:text-[13px]">{label}</p>
      <p className="mt-1 text-[22px] sm:text-[26px] font-bold leading-none tracking-tight tabular-nums text-text-heading">
        {value.toLocaleString("id-ID")}
      </p>
      {hint && <p className="mt-1.5 text-[12px] text-text-muted">{hint}</p>}
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
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Total bisnis" value={summary.businesses_total} />
        <Stat label="Bisnis aktif" value={summary.businesses_active_7d} hint="7 hari" />
        <Stat label="Perangkat aktif" value={summary.devices_active_7d} hint="7 hari" />
      </div>

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
                <span className="min-w-0 flex-1 truncate text-text-body">{e.target_id}</span>
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
