"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ChevronDown, ScrollText, SearchX } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AdminListItem, AuditEntry, AuditPage } from "@/lib/admin/types";
import { useQueryState } from "./filters";
import { ClearFiltersButton, DateFilter, FilterBar, FilterSelect } from "./FilterMenu";
import { AUDIT_ACTION_GROUPS, AUDIT_ACTIONS, labelOf, LOGIN_FAIL_REASONS, TARGET_TYPES } from "./labels";
import {
  Badge,
  btn,
  EmptyState,
  ErrorBlock,
  errorMessage,
  focusRing,
  formatDateTime,
  inputClass,
  LoadingBar,
  PageHeader,
  SkeletonList,
  Spinner,
  useLoad,
} from "./ui";

const LIMIT = 50;

function actionTone(action: string): "neutral" | "brand" | "success" | "warning" | "danger" {
  if (action === "auth.login_failed" || action === "release.delete" || action === "admin.disable") return "danger";
  if (action.startsWith("auth.")) return "neutral";
  if (action === "release.upload" || action === "admin.enable" || action === "subscription.payment") return "success";
  if (action === "subscription.payment_void") return "danger";
  if (action.startsWith("admin.")) return "warning";
  return "brand";
}

type More = { key: string; items: AuditEntry[]; cursor: string | null };

export function AuditView() {
  const qs = useQueryState();
  const adminId = qs.get("admin_id");
  const actions = qs.list("action");
  const targetType = qs.get("target_type");
  const targetId = qs.get("target_id");
  const from = qs.get("from");
  const to = qs.get("to");
  const filterKey = JSON.stringify([adminId, actions, targetType, targetId, from, to]);

  const query = {
    admin_id: adminId || undefined,
    action: actions,
    target_type: targetType || undefined,
    target_id: targetType ? targetId || undefined : undefined,
    from: from || undefined,
    to: to || undefined,
    limit: LIMIT,
  };
  const { state, reload } = useLoad<AuditPage>(async (signal) => (await adminApi()).auditPage(query, signal), [filterKey]);
  const admins = useLoad<AdminListItem[] | null>(async (signal) => (await adminApi()).admins(signal).catch(() => null), []);

  // Halaman berikutnya (kursor) ditumpuk di bawah; diabaikan begitu filter berubah.
  const [more, setMore] = useState<More | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const extra = more && more.key === filterKey ? more : null;
  const items = [...(state.data?.items ?? []), ...(extra?.items ?? [])];
  const nextCursor = extra ? extra.cursor : (state.data?.next_cursor ?? null);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await (await adminApi()).auditPage({ ...query, cursor: nextCursor });
      setMore({ key: filterKey, items: [...(extra?.items ?? []), ...page.items], cursor: page.next_cursor });
    } catch (err) {
      setMoreError(errorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  // Aksi dipilih per kelompok; aksi lepas (dari tautan) tampil sebagai pilihan tersendiri agar bisa dilepas.
  const fullGroups = AUDIT_ACTION_GROUPS.filter((g) => g.actions.every((a) => actions.includes(a)));
  const loose = actions.filter((a) => !fullGroups.some((g) => g.actions.includes(a)));
  const actionOptions = [
    ...AUDIT_ACTION_GROUPS.map((g) => ({ value: `g:${g.id}`, label: g.label })),
    ...loose.map((a) => ({ value: `a:${a}`, label: labelOf(AUDIT_ACTIONS, a) })),
  ];
  const actionSelected = [...fullGroups.map((g) => `g:${g.id}`), ...loose.map((a) => `a:${a}`)];
  const onActions = (next: string[]) => {
    const list = next.flatMap((v) =>
      v.startsWith("g:") ? (AUDIT_ACTION_GROUPS.find((g) => `g:${g.id}` === v)?.actions ?? []) : [v.slice(2)]
    );
    qs.update({ action: [...new Set(list)] });
  };

  const adminList = admins.state.data ?? null;
  const hasFilters = !!(adminId || actions.length || targetType || from || to);

  return (
    <>
      <PageHeader title="Audit" description="Catatan semua tindakan admin dan CLI. Tidak bisa diubah atau dihapus." />

      <FilterBar>
        {adminList && adminList.length > 0 && (
          <FilterSelect
            label="Admin"
            options={[...adminList.map((a) => ({ value: a.id, label: a.name })), { value: "none", label: "Tanpa admin" }]}
            selected={adminId ? [adminId] : []}
            summary={adminId && !adminList.some((a) => a.id === adminId) && adminId !== "none" ? "Admin lain" : undefined}
            onChange={(n) => qs.update({ admin_id: n[0] ?? null })}
          />
        )}
        <FilterSelect label="Aksi" multiple options={actionOptions} selected={actionSelected} onChange={onActions} />
        <FilterSelect
          label="Target"
          options={Object.entries(TARGET_TYPES).map(([value, label]) => ({ value, label }))}
          selected={targetType ? [targetType] : []}
          summary={
            targetType
              ? `${labelOf(TARGET_TYPES, targetType)}${targetId ? ` · ${targetId.length > 14 ? `${targetId.slice(0, 8)}…` : targetId}` : ""}`
              : undefined
          }
          onChange={(n) => qs.update({ target_type: n[0] ?? null, target_id: null })}
        >
          {targetType && <TargetIdInput key={targetType} value={targetId} onApply={(v) => qs.update({ target_id: v }, "replace")} />}
        </FilterSelect>
        <DateFilter
          label="Tanggal"
          from={from}
          to={to}
          presets={[
            { label: "Hari ini", days: 1 },
            { label: "7 hari", days: 7 },
            { label: "30 hari", days: 30 },
          ]}
          onChange={(f, t) => qs.update({ from: f, to: t })}
        />
        {hasFilters && <ClearFiltersButton onClick={() => qs.clear()} />}
      </FilterBar>

      {state.status === "error" && !state.data && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <SkeletonList rows={10} label="Memuat audit" />}
      {state.data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div
            className={`rounded-[14px] border border-border-subtle bg-white transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`}
            aria-busy={state.status === "loading"}
          >
            {items.length === 0 ? (
              hasFilters ? (
                <EmptyState
                  icon={<SearchX size={22} aria-hidden />}
                  title="Tidak ada catatan yang cocok"
                  action={
                    <button type="button" className={btn.secondary} onClick={() => qs.clear()}>
                      Hapus semua filter
                    </button>
                  }
                >
                  Coba perluas rentang tanggal atau kurangi filter.
                </EmptyState>
              ) : (
                <EmptyState icon={<ScrollText size={22} aria-hidden />} title="Belum ada catatan audit" />
              )
            ) : (
              <AuditList items={items} />
            )}
            {items.length > 0 && (
              <div className="flex flex-col items-center gap-2 border-t border-border-subtle px-4 py-3">
                {moreError && <p className="text-[13px] text-danger">{moreError}</p>}
                {nextCursor ? (
                  <button type="button" className={btn.secondary} onClick={loadMore} disabled={loadingMore}>
                    {loadingMore && <Spinner />}
                    Muat lebih banyak
                  </button>
                ) : (
                  <p className="text-[13px] text-text-muted">
                    {items.length.toLocaleString("id-ID")} catatan · sudah sampai akhir
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

const dayFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function AuditList({ items }: { items: AuditEntry[] }) {
  const [now] = useState(() => Date.now());
  const today = keyFmt.format(now);
  const yesterday = keyFmt.format(now - 86_400_000);
  const groups: { day: string; label: string; items: AuditEntry[] }[] = [];
  for (const e of items) {
    const day = keyFmt.format(new Date(e.created_at));
    let g = groups[groups.length - 1];
    if (!g || g.day !== day) {
      g = { day, label: day === today ? "Hari ini" : day === yesterday ? "Kemarin" : dayFmt.format(new Date(e.created_at)), items: [] };
      groups.push(g);
    }
    g.items.push(e);
  }
  return (
    <div>
      {groups.map((g) => (
        <section key={g.day} aria-label={g.label}>
          <h3 className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-muted/95 px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wide text-text-muted backdrop-blur sm:px-5 lg:top-0">
            {g.label}
          </h3>
          <ul className="divide-y divide-border-subtle">
            {g.items.map((e) => (
              <AuditRow key={e.id} entry={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function targetHref(e: AuditEntry): string | null {
  if (e.target_type === "business" && e.target_id) {
    const tab = e.action.startsWith("subscription.") ? "?tab=langganan" : "";
    return `/admin/bisnis/${encodeURIComponent(e.target_id)}${tab}`;
  }
  if (e.target_type === "billing_config") return "/admin/langganan/pengaturan";
  if (e.target_type === "crash" && e.target_id) return `/admin/crash/${encodeURIComponent(e.target_id)}`;
  return null;
}

function AuditRow({ entry: e }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const detail = e.detail && Object.keys(e.detail).length > 0 ? e.detail : null;
  const reason = e.action === "auth.login_failed" && typeof e.detail?.reason === "string" ? labelOf(LOGIN_FAIL_REASONS, e.detail.reason) : null;
  const via = e.detail?.via === "cli" ? "lewat CLI" : null;
  const href = targetHref(e);
  // Target admin = pelaku sendiri → tampilkan nama, bukan UUID.
  const id = e.target_type === "admin" && e.admin && e.admin.id === e.target_id ? e.admin.name : e.target_id || "—";

  return (
    <li className="px-4 py-2 sm:px-5">
      <div className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 text-[14px] md:grid-cols-[52px_190px_minmax(0,1fr)_auto]">
        <time dateTime={e.created_at} title={formatDateTime(e.created_at)} className="text-[13px] tabular-nums text-text-muted">
          {timeFmt.format(new Date(e.created_at))}
        </time>
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Badge tone={actionTone(e.action)}>{labelOf(AUDIT_ACTIONS, e.action)}</Badge>
          {reason && <span className="text-[12px] text-text-muted">{reason}</span>}
        </span>
        <span className="col-span-2 col-start-2 row-start-2 min-w-0 text-[13px] md:col-span-1 md:col-start-3 md:row-start-1 md:text-[14px]">
          <span className="text-text-muted">{labelOf(TARGET_TYPES, e.target_type)} </span>
          {href ? (
            <Link href={href} className={`break-all font-mono text-[12.5px] text-brand-ink hover:underline ${focusRing}`}>
              {id}
            </Link>
          ) : (
            <span className="break-all font-mono text-[12.5px] text-text-body">{id}</span>
          )}
          <span className="block text-[12.5px] text-text-muted">
            oleh {e.admin ? e.admin.name : "sistem"}
            {via ? ` · ${via}` : ""}
          </span>
        </span>
        {detail ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`inline-flex items-center gap-1 justify-self-end rounded-[8px] px-2 py-1 text-[13px] font-semibold text-text-body hover:bg-bg-muted ${focusRing}`}
          >
            Detail <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <span />
        )}
      </div>
      {open && detail && (
        <pre className="mt-2 overflow-x-auto rounded-[10px] bg-bg-muted p-3 font-mono text-[12px] leading-relaxed text-text-body">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </li>
  );
}

/** ID target persis — Enter / keluar dari isian menerapkan. */
function TargetIdInput({ value, onApply }: { value: string; onApply: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  const apply = () => draft.trim() !== value && onApply(draft.trim());
  return (
    <div className="border-t border-border-subtle px-3 pt-2.5 pb-3">
      <label htmlFor="audit-target-id" className="mb-1 block text-[12.5px] font-semibold text-text-body">
        ID target (opsional)
      </label>
      <input
        id="audit-target-id"
        className={`${inputClass} min-h-9 font-mono text-[13px]`}
        placeholder="ID persis (bisnis, berkas APK, …)"
        value={draft}
        maxLength={100}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={apply}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            apply();
          }
        }}
      />
    </div>
  );
}
