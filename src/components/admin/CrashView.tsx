"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Bug, ChevronDown, CircleCheck, EyeOff, PartyPopper, RotateCcw, SearchX, Store } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { CrashDetail, CrashEvent, CrashFacets, CrashGroup, CrashStatus, Paged } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { DailyBars, Meter, Sparkline } from "./charts";
import { ConfirmDialog, Modal } from "./ConfirmDialog";
import { SearchBox, useQueryState } from "./filters";
import { compactRange, ClearFiltersButton, DateFilter, FilterBar, FilterInput, FilterSelect } from "./FilterMenu";
import { CRASH_STATUS, labelOf, ROLES } from "./labels";
import { useToast } from "./toast";
import {
  Badge,
  btn,
  cardClass,
  CopyButton,
  EmptyState,
  ErrorBlock,
  errorMessage,
  Field,
  focusRing,
  formatDateTime,
  inputClass,
  LoadingBar,
  PageHeader,
  Pagination,
  Section,
  Skeleton,
  SkeletonList,
  SortTh,
  Spinner,
  StatCard,
  Tabs,
  tdClass,
  thClass,
  TimeAgo,
  useLoad,
} from "./ui";

const PER_PAGE = 25;
const DAY = 86_400_000;

type StatusTab = CrashStatus | "all";

const statusTone = (s: CrashStatus) => (s === "open" ? "danger" : s === "resolved" ? "success" : "neutral");

function GroupBadges({ g, now }: { g: CrashGroup; now: number }) {
  const isNew = now - Date.parse(g.first_seen_at) < DAY;
  const relapse = g.status === "open" && /^kambuh/i.test(g.status_note);
  return (
    <>
      {isNew && <Badge tone="brand">Baru</Badge>}
      {relapse && (
        <span title={g.status_note}>
          <Badge tone="warning">
            <RotateCcw size={11} aria-hidden /> Kambuh
          </Badge>
        </span>
      )}
    </>
  );
}

function buildRange(g: CrashGroup): string {
  const { first, last } = g.builds;
  if (first === null && last === null) return "—";
  if (first === last || first === null) return String(last);
  return `${first}–${last}`;
}

// ——— Daftar ———

export function CrashListView() {
  const qs = useQueryState();
  const status = (qs.get("status") || "open") as StatusTab;
  const platform = qs.get("platform");
  const build = qs.get("build");
  const q = qs.get("q");
  const from = qs.get("from");
  const to = qs.get("to");
  const sort = qs.get("sort") || "last_seen";
  const order = (qs.get("order") || "desc") as "asc" | "desc";
  const page = Math.max(1, Number(qs.get("page")) || 1);
  const [now] = useState(() => Date.now());

  const { state, reload } = useLoad<Paged<CrashGroup, CrashFacets>>(
    async (signal) =>
      (await adminApi()).crashes(
        {
          status: status === "open" ? undefined : status,
          platform: platform || undefined,
          build: build || undefined,
          q: q || undefined,
          from: from || undefined,
          to: to || undefined,
          sort: sort === "last_seen" ? undefined : sort,
          order: order === "desc" ? undefined : order,
          page,
          per_page: PER_PAGE,
        },
        signal
      ),
    [status, platform, build, q, from, to, sort, order, page]
  );
  const facets = state.data?.facets?.status;

  const onSort = (field: string) => {
    const next = field === sort ? (order === "asc" ? "desc" : "asc") : "desc";
    qs.update({ sort: field === "last_seen" ? null : field, order: next === "desc" ? null : next });
  };

  const hasFilters = !!(platform || build || from || to);
  const filtered = hasFilters || !!q;
  const clearAll = () => qs.clear(["status", "sort", "order"]);
  const rangeText = from || to ? compactRange(from, to) : "14 hari";

  return (
    <>
      <PageHeader
        title="Crash"
        description="Galat aplikasi dikelompokkan per sidik jari. Tandai selesai setelah diperbaiki — grup kembali terbuka otomatis bila kambuh di build lebih baru."
      />

      <Tabs<StatusTab>
        label="Status crash"
        active={status}
        onChange={(s) => qs.update({ status: s === "open" ? null : s })}
        tabs={[
          { id: "open", label: "Terbuka", count: facets?.open },
          { id: "resolved", label: "Selesai", count: facets?.resolved },
          { id: "ignored", label: "Diabaikan", count: facets?.ignored },
          { id: "all", label: "Semua" },
        ]}
      />

      <FilterBar
        search={
          <SearchBox
            id="crash-q"
            label="Cari crash menurut pesan, nama file, atau sidik jari"
            className="w-full sm:w-[300px] 2xl:w-[360px]"
            value={q}
            onSearch={(v) => qs.update({ q: v }, "replace")}
            placeholder="Cari pesan atau file…"
          />
        }
        trailing={
          state.data && (
            <p className="text-[13px] text-text-muted" aria-live="polite">
              <strong className="font-semibold tabular-nums text-text-heading">{state.data.meta.total.toLocaleString("id-ID")}</strong> grup ·
              hitungan {rangeText}
            </p>
          )
        }
      >
        <FilterSelect
          label="Platform"
          options={[
            { value: "android", label: "Android" },
            { value: "ios", label: "iOS" },
          ]}
          selected={platform ? [platform] : []}
          onChange={(n) => qs.update({ platform: n[0] ?? null })}
        />
        <FilterInput
          label="Build"
          numeric
          value={build}
          placeholder="mis. 42"
          hint="Grup yang punya kejadian di build ini."
          onApply={(v) => qs.update({ build: v })}
        />
        <DateFilter
          label="Rentang"
          from={from}
          to={to}
          presets={[
            { label: "24 jam", days: 1 },
            { label: "7 hari", days: 7 },
            { label: "30 hari", days: 30 },
            { label: "90 hari", days: 90 },
          ]}
          onChange={(f, t) => qs.update({ from: f, to: t })}
        />
        {hasFilters && <ClearFiltersButton onClick={clearAll} />}
      </FilterBar>

      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <SkeletonList rows={8} label="Memuat crash" />}
      {state.data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div
            className={`rounded-[14px] border border-border-subtle bg-white transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`}
            aria-busy={state.status === "loading"}
          >
            {state.data.items.length === 0 ? (
              filtered ? (
                <EmptyState
                  icon={<SearchX size={22} aria-hidden />}
                  title="Tidak ada crash yang cocok"
                  action={
                    <button type="button" className={btn.secondary} onClick={clearAll}>
                      Hapus semua filter
                    </button>
                  }
                >
                  Coba perluas rentang atau hapus filter build.
                </EmptyState>
              ) : status === "open" ? (
                <EmptyState
                  icon={<PartyPopper size={22} aria-hidden />}
                  title="Tidak ada crash terbuka — aplikasi sedang sehat"
                  action={
                    <button type="button" className={btn.secondary} onClick={() => qs.update({ status: "resolved" })}>
                      Lihat yang selesai
                    </button>
                  }
                >
                  Crash baru dari aplikasi akan muncul di sini.
                </EmptyState>
              ) : (
                <EmptyState icon={<Bug size={22} aria-hidden />} title={`Tidak ada crash ${labelOf(CRASH_STATUS, status).toLowerCase()}`} />
              )
            ) : (
              <CrashTable items={state.data.items} sort={sort} order={order} onSort={onSort} now={now} showStatus={status === "all"} />
            )}
            <div className="border-t border-border-subtle px-4 py-2 sm:px-5">
              <Pagination
                page={state.data.meta.page}
                perPage={state.data.meta.per_page}
                total={state.data.meta.total}
                onPage={(p) => qs.update({ page: p > 1 ? String(p) : null })}
              />
            </div>
          </div>
        </>
      )}
    </>
  );
}

function CrashTable({
  items,
  sort,
  order,
  onSort,
  now,
  showStatus,
}: {
  items: CrashGroup[];
  sort: string;
  order: "asc" | "desc";
  onSort: (f: string) => void;
  now: number;
  showStatus: boolean;
}) {
  const sp = { sort, order, onSort };
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full table-fixed text-[14px]">
          <colgroup>
            <col />
            <col className="w-[104px]" />
            <col className="w-[96px]" />
            <col className="hidden w-[76px] lg:table-column" />
            <col className="w-[84px]" />
            <col className="w-[128px]" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col" className={thClass}>
                Crash
              </th>
              <th scope="col" className={thClass}>
                14 hari
              </th>
              <SortTh label="Kejadian" field="count" align="right" {...sp} />
              <SortTh label="Bisnis" field="businesses" align="right" {...sp} className="hidden lg:table-cell" />
              <th scope="col" className={thClass}>
                Build
              </th>
              <SortTh label="Terakhir" field="last_seen" {...sp} />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {items.map((g) => (
              <tr key={g.fingerprint} className="group relative hover:bg-bg-muted/60">
                <td className={`${tdClass} py-2.5`}>
                  <Link
                    href={`/admin/crash/${g.fingerprint}`}
                    className={`block truncate font-mono text-[13px] font-semibold text-text-heading after:absolute after:inset-0 group-hover:text-brand-ink ${focusRing}`}
                    title={g.title}
                  >
                    {g.title}
                  </Link>
                  <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-text-muted">
                    {showStatus && <Badge tone={statusTone(g.status)}>{labelOf(CRASH_STATUS, g.status)}</Badge>}
                    <GroupBadges g={g} now={now} />
                    {g.platform === "ios" && <Badge>iOS</Badge>}
                    <span className="truncate font-mono">{g.top_frame || (g.kind === "platform" ? "native" : "—")}</span>
                  </p>
                </td>
                <td className={tdClass}>
                  <Sparkline values={g.sparkline} label={g.title} />
                </td>
                <td className={`${tdClass} text-right font-semibold tabular-nums text-text-heading`}>
                  {g.events_in_range.toLocaleString("id-ID")}
                  <span className="block text-[12px] font-normal text-text-muted">dari {g.events_count.toLocaleString("id-ID")}</span>
                </td>
                <td className={`${tdClass} hidden text-right tabular-nums lg:table-cell`}>{g.businesses_count}</td>
                <td className={`${tdClass} tabular-nums text-text-body`}>{buildRange(g)}</td>
                <td className={`${tdClass} whitespace-nowrap text-text-body`}>
                  <TimeAgo value={g.last_seen_at} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-border-subtle md:hidden">
        {items.map((g) => (
          <li key={g.fingerprint}>
            <Link href={`/admin/crash/${g.fingerprint}`} className={`flex flex-col gap-1.5 px-4 py-3 active:bg-bg-muted ${focusRing}`}>
              <p className="line-clamp-2 font-mono text-[13px] font-semibold text-text-heading">{g.title}</p>
              <div className="flex items-center gap-3">
                <Sparkline values={g.sparkline} label={g.title} />
                <span className="text-[13px] tabular-nums text-text-body">
                  <strong className="text-text-heading">{g.events_in_range}</strong> kejadian · build {buildRange(g)}
                </span>
              </div>
              <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-muted">
                {showStatus && <Badge tone={statusTone(g.status)}>{labelOf(CRASH_STATUS, g.status)}</Badge>}
                <GroupBadges g={g} now={now} />
                <TimeAgo value={g.last_seen_at} />
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

// ——— Detail ———

const backLink = (
  <Link
    href="/admin/crash"
    className={`mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-body hover:text-text-heading ${focusRing}`}
  >
    <ArrowLeft size={15} aria-hidden /> Semua crash
  </Link>
);

type Data = { detail: CrashDetail; latestBuild: number | null };

export function CrashDetailView() {
  const { fp } = useParams<{ fp: string }>();
  const [now] = useState(() => Date.now());
  const { state, reload, setData } = useLoad<Data>(async (signal) => {
    const api = await adminApi();
    const [detail, version] = await Promise.all([api.crash(fp, signal), api.appVersion(signal).catch(() => null)]);
    return { detail, latestBuild: version?.latest_build ?? null };
  }, [fp]);

  if (!state.data) {
    return (
      <>
        <PageHeader title="Detail crash" back={backLink} />
        {state.status === "error" ? (
          state.error instanceof ApiError && state.error.status === 404 ? (
            <EmptyState
              icon={<Bug size={22} aria-hidden />}
              title="Crash tidak ditemukan"
              action={
                <Link href="/admin/crash" className={btn.secondary}>
                  Kembali ke daftar
                </Link>
              }
            >
              Grup ini mungkin sudah dihapus oleh retensi 90 hari.
            </EmptyState>
          ) : (
            <ErrorBlock error={state.error} onRetry={reload} />
          )
        ) : (
          <div role="status" aria-label="Memuat crash" className="flex flex-col gap-5">
            <Skeleton className="h-6 w-3/4" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`${cardClass} p-4`}>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2.5 h-6 w-10" />
                </div>
              ))}
            </div>
            <div className={`${cardClass} p-5`}>
              <Skeleton className="h-[120px]" />
            </div>
          </div>
        )}
      </>
    );
  }

  const { detail, latestBuild } = state.data;
  const g = detail.group;
  const last14 = g.sparkline.reduce((a, b) => a + b, 0);
  const maxBuild = Math.max(1, ...detail.builds.map((b) => b.count));

  return (
    <>
      <div className="mb-6">
        {backLink}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={statusTone(g.status)}>{labelOf(CRASH_STATUS, g.status)}</Badge>
          <GroupBadges g={g} now={now} />
          <Badge>{g.platform === "ios" ? "iOS" : "Android"}</Badge>
          <Badge>{g.kind === "flutter" ? "Flutter" : "Native"}</Badge>
        </div>
        <h1 className="mt-2 break-words font-mono text-[17px] font-bold leading-snug text-text-heading sm:text-[19px]">{g.title}</h1>
        {g.top_frame && <p className="mt-1 break-all font-mono text-[13px] text-text-muted">{g.top_frame}</p>}
        <div className="mt-4">
          <StatusControl group={g} latestBuild={latestBuild} onChange={(group) => setData({ ...state.data!, detail: { ...detail, group } })} />
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          <StatCard label="Total kejadian" value={g.events_count} />
          <StatCard label="14 hari terakhir" value={last14} tone={last14 > 0 && g.status === "open" ? "danger" : "neutral"} />
          <StatCard label="Bisnis terdampak" value={g.businesses_count} hint="dari kejadian tersimpan" />
          <StatCard label="Pertama terlihat" value={formatShort(g.first_seen_at)} hint={g.builds.first ? `build ${g.builds.first}` : undefined} />
          <StatCard
            label="Terakhir terlihat"
            value={formatShort(g.last_seen_at)}
            hint={g.builds.last ? `build ${g.builds.last}${g.last_version ? ` · v${g.last_version}` : ""}` : undefined}
          />
        </div>

        <Section title="Kejadian per hari" description="30 hari terakhir (WIB).">
          <DailyBars data={detail.daily} />
        </Section>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Section title="Per build" description="90 hari terakhir." bodyClass="">
            {detail.builds.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-text-muted">Build tidak diketahui.</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {detail.builds.map((b) => (
                  <li key={b.build} className="grid grid-cols-[110px_minmax(0,1fr)_64px] items-center gap-3 px-4 py-2.5 text-[14px] sm:px-5">
                    <span>
                      <span className="font-semibold tabular-nums text-text-heading">{b.build < 0 ? "?" : b.build}</span>
                      <span className="ml-1.5 text-[13px] text-text-muted">{b.version ? `v${b.version}` : ""}</span>
                    </span>
                    <Meter value={b.count} max={maxBuild} tone={g.resolved_in_build !== null && b.build > g.resolved_in_build ? "danger" : "neutral"} />
                    <span className="text-right tabular-nums">{b.count.toLocaleString("id-ID")}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Bisnis terdampak" description="10 teratas dari kejadian tersimpan." bodyClass="">
            {detail.businesses.length === 0 ? (
              <p className="px-5 py-4 text-[14px] text-text-muted">Tidak ada bisnis (mis. crash sebelum login).</p>
            ) : (
              <ul className="divide-y divide-border-subtle">
                {detail.businesses.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[14px] sm:px-5">
                    {b.name ? (
                      <Link href={`/admin/bisnis/${encodeURIComponent(b.id)}`} className={`flex min-w-0 items-center gap-2 font-medium text-text-heading hover:text-brand-ink ${focusRing}`}>
                        <Store size={15} aria-hidden className="shrink-0 text-text-muted" />
                        <span className="truncate">{b.name}</span>
                      </Link>
                    ) : (
                      <span className="text-text-muted">Bisnis sudah dihapus</span>
                    )}
                    <span className="shrink-0 tabular-nums text-text-body">{b.count.toLocaleString("id-ID")}×</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title="Kejadian terbaru" description="20 terbaru. Data pribadi (email, nomor, token) sudah disamarkan server." bodyClass="">
          {detail.events.length === 0 ? (
            <p className="px-5 py-4 text-[14px] text-text-muted">Kejadian sudah dipangkas oleh retensi 30 hari.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {detail.events.map((e, i) => (
                <EventRow key={e.id} e={e} defaultOpen={i === 0} />
              ))}
            </ul>
          )}
        </Section>

        <p className="break-all text-[12px] text-text-muted">
          Sidik jari <code className="font-mono">{g.fingerprint}</code>
        </p>
      </div>
    </>
  );
}

function formatShort(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" }).format(new Date(iso));
}

function EventRow({ e, defaultOpen }: { e: CrashEvent; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = `ev-${e.id}`;
  return (
    <li className="px-4 py-3 sm:px-5">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-start gap-3 text-left ${focusRing}`}
      >
        <ChevronDown size={16} aria-hidden className={`mt-0.5 shrink-0 text-text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-body">
            <TimeAgo value={e.received_at} className="font-semibold text-text-heading" />
            <span className="tabular-nums">build {e.build ?? "?"}{e.version ? ` · v${e.version}` : ""}</span>
            <span className="text-text-muted">{e.os_version}</span>
            {e.role && <Badge>{labelOf(ROLES, e.role)}</Badge>}
            {e.business && <span className="truncate text-text-muted">{e.business.name ?? "bisnis dihapus"}</span>}
          </span>
          <span className="mt-1 block truncate font-mono text-[12.5px] text-text-body">{e.message}</span>
        </span>
      </button>
      {open && (
        <div id={id} className="mt-2.5 pl-7">
          <div className="relative rounded-[10px] bg-brand-dark">
            <div className="absolute top-1.5 right-1.5 rounded-[8px] bg-white/90">
              <CopyButton value={`${e.message}\n\n${e.stack}`} label="Salin pesan & stack" />
            </div>
            <pre className="max-h-[360px] overflow-auto p-3.5 pr-12 font-mono text-[12px] leading-relaxed whitespace-pre text-[#e8ece9]">
              {e.message}
              {"\n\n"}
              {e.stack || "(tanpa stack)"}
            </pre>
          </div>
          <p className="mt-1.5 text-[12px] text-text-muted">
            Diterima {formatDateTime(e.received_at)}
            {e.occurred_at ? ` · terjadi ${formatDateTime(e.occurred_at)}` : ""} · {e.flavor || "—"}
          </p>
        </div>
      )}
    </li>
  );
}

function StatusControl({
  group: g,
  latestBuild,
  onChange,
}: {
  group: CrashGroup;
  latestBuild: number | null;
  onChange: (g: CrashGroup) => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState<CrashStatus | null>(null);
  const [buildText, setBuildText] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = (s: CrashStatus) => {
    if (s === g.status) return;
    setTarget(s);
    setBuildText(String(latestBuild ?? g.builds.last ?? ""));
    setNote("");
    setError(null);
  };

  async function save() {
    if (!target) return;
    const build = target === "resolved" ? (buildText.trim() ? Number(buildText.trim()) : null) : null;
    if (target === "resolved" && buildText.trim() && !Number.isSafeInteger(build)) {
      setError("Build harus bilangan bulat.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await (await adminApi()).setCrashStatus(g.fingerprint, { status: target, resolved_in_build: build, note: note.trim() });
      onChange(updated);
      setTarget(null);
      toast.success(
        target === "resolved"
          ? `Ditandai selesai di build ${updated.resolved_in_build ?? "terbaru"}. Akan terbuka lagi bila kambuh.`
          : target === "ignored"
            ? "Crash diabaikan. Hitungan tetap tercatat."
            : "Crash dibuka lagi."
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const options: { s: CrashStatus; label: string; icon: React.ReactNode }[] = [
    { s: "open", label: "Terbuka", icon: <Bug size={15} aria-hidden /> },
    { s: "resolved", label: "Selesai", icon: <CircleCheck size={15} aria-hidden /> },
    { s: "ignored", label: "Abaikan", icon: <EyeOff size={15} aria-hidden /> },
  ];

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div role="radiogroup" aria-label="Status crash" className="inline-flex self-start rounded-[12px] border border-border-subtle bg-white p-1">
        {options.map((o) => {
          const on = g.status === o.s;
          const tone = o.s === "resolved" ? "bg-success text-white" : o.s === "open" ? "bg-danger text-white" : "bg-brand-dark text-white";
          return (
            <button
              key={o.s}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => open(o.s)}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-[9px] px-3.5 text-[14px] font-semibold transition-colors ${
                on ? tone : "text-text-body hover:bg-bg-muted hover:text-text-heading"
              } ${focusRing}`}
            >
              {o.icon}
              {o.label}
            </button>
          );
        })}
      </div>
      {g.status !== "open" || g.status_note ? (
        <p className="text-[13px] text-text-muted">
          {g.status === "resolved" && g.resolved_in_build !== null && <>Diperbaiki di build {g.resolved_in_build}. </>}
          {g.status_by && (
            <>
              oleh {g.status_by.name} · <TimeAgo value={g.status_at} />
            </>
          )}
          {g.status_note && <span className="block text-text-body">“{g.status_note}”</span>}
        </p>
      ) : null}

      <Modal
        open={target === "resolved"}
        onClose={() => !busy && setTarget(null)}
        dismissible={!busy}
        title="Tandai selesai?"
        description="Bila crash yang sama muncul di build lebih baru, grup ini otomatis terbuka lagi (kambuh)."
        footer={
          <>
            <button type="button" className={btn.secondary} onClick={() => setTarget(null)} disabled={busy}>
              Batal
            </button>
            <button type="button" className={btn.primary} onClick={save} disabled={busy}>
              {busy && <Spinner />}
              Tandai selesai
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {error && <p className="text-[13px] text-danger">{error}</p>}
          <Field id="resolved-build" label="Diperbaiki di build" hint={latestBuild !== null ? `Build terbaru saat ini: ${latestBuild}.` : undefined}>
            <input
              id="resolved-build"
              inputMode="numeric"
              className={`${inputClass} tabular-nums`}
              value={buildText}
              onChange={(e) => setBuildText(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <NoteField note={note} setNote={setNote} />
        </div>
      </Modal>

      <ConfirmDialog
        open={target === "ignored" || target === "open"}
        title={target === "ignored" ? "Abaikan crash ini?" : "Buka lagi crash ini?"}
        confirmLabel={target === "ignored" ? "Abaikan" : "Buka lagi"}
        tone="primary"
        busy={busy}
        onConfirm={save}
        onClose={() => setTarget(null)}
      >
        <p>
          {target === "ignored"
            ? "Grup disembunyikan dari daftar terbuka dan tidak akan kambuh otomatis. Hitungan kejadian tetap berjalan."
            : "Grup kembali ke daftar terbuka."}
        </p>
        {target === "ignored" && (
          <div className="mt-4">
            <NoteField note={note} setNote={setNote} />
          </div>
        )}
        {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      </ConfirmDialog>
    </div>
  );
}

function NoteField({ note, setNote }: { note: string; setNote: (v: string) => void }) {
  return (
    <Field id="crash-note" label="Catatan (opsional)" hint={`${note.length}/300`}>
      <textarea
        id="crash-note"
        rows={2}
        maxLength={300}
        className={`${inputClass} py-2.5 leading-relaxed`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="mis. Diperbaiki di PR #123"
      />
    </Field>
  );
}
