"use client";

import React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Ban, ChevronRight, History, Info, MonitorSmartphone, Percent, Undo2, Wallet } from "lucide-react";
import { ClearFiltersButton, FilterBar } from "@/components/admin/FilterMenu";
import {
  cardClass,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatRupiah,
  LoadingBar,
  PageHeader,
  Pagination,
  SkeletonList,
  StatCard,
  useLoad,
} from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import type { ActivityItem, ActivityKind, ActivityPage, ActivityQuery } from "@/lib/owner/types";
import { ACTIVITY_KIND, ACTIVITY_KINDS } from "./labels";
import { zonedDay, zoneLabel } from "@/lib/owner/tz";
import { useOwner } from "./OwnerShell";
import { formatDayLong, formatTime, PeriodFilter, SyncNote, usePeriod } from "./ui";

// Aktivitas (GET /owner/activity): log turunan pembatalan, pengembalian dana, diskon manual, tutup kasir,
// kas masuk/keluar, dan login dari perangkat baru. Filter di URL: from, to, kind (daftar koma), page.

const PER_PAGE = 50;

type Tone = "danger" | "warning" | "success" | "brand" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  danger: "bg-danger-tint text-danger",
  warning: "bg-warning-tint text-warning",
  success: "bg-success-tint text-success",
  brand: "bg-brand-tint text-brand-ink",
  neutral: "bg-bg-muted text-text-body",
};

const KIND_ICON: Record<ActivityKind, React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  void: Ban,
  refund: Undo2,
  manual_discount: Percent,
  shift_closed: Wallet,
  cash_in: ArrowDownLeft,
  cash_out: ArrowUpRight,
  new_device: MonitorSmartphone,
};

function toneOf(a: ActivityItem): Tone {
  switch (a.kind) {
    case "void":
    case "refund":
      return "danger";
    case "manual_discount":
      return "warning";
    case "shift_closed":
      if (a.difference === null || a.difference === 0) return "success";
      return a.difference < 0 ? "danger" : "warning";
    case "cash_in":
      return "success";
    case "cash_out":
      return "neutral";
    case "new_device":
      return "brand";
  }
}


const isKind = (v: string): v is ActivityKind => (ACTIVITY_KINDS as readonly string[]).includes(v);
const who = (name: string | null | undefined) => name?.trim() || "Seseorang";
const text = (v: string | null | undefined) => v?.trim() || "";

/** Kalimat utama + detail tambahan (dipisah " · "). */
function describe(a: ActivityItem): { main: React.ReactNode; extra: string[] } {
  const amount = a.amount !== null ? formatRupiah(a.amount) : null;
  const receipt = a.receipt_no ? <span className="font-semibold tabular-nums">{a.receipt_no}</span> : "tanpa nomor";
  const note = text(a.note);
  switch (a.kind) {
    case "void":
    case "refund":
      return {
        main: (
          <>
            <strong className="font-semibold">{who(a.actor)}</strong> {a.kind === "void" ? "membatalkan transaksi" : "mengembalikan dana transaksi"} {receipt}
          </>
        ),
        extra: [amount, note ? `alasan: ${note}` : null, a.approver ? `disetujui ${a.approver}` : null].filter((x): x is string => !!x),
      };
    case "manual_discount":
      return {
        main: (
          <>
            Diskon manual <strong className="font-semibold tabular-nums">{amount ?? "—"}</strong>
            {note ? ` (${note})` : ""} di {receipt}
          </>
        ),
        extra: a.actor ? [`oleh ${a.actor}`] : [],
      };
    case "shift_closed": {
      const d = a.difference;
      const place = a.outlet_name ? ` ${a.outlet_name}` : "";
      const calc =
        a.expected !== null && a.counted !== null ? ` (seharusnya ${formatRupiah(a.expected)}, dihitung ${formatRupiah(a.counted)})` : "";
      return {
        main: (
          <>
            Tutup kasir{place} oleh <strong className="font-semibold">{who(a.actor)}</strong>
            {d !== null && (
              <>
                :{" "}
                <span className={`font-semibold ${d < 0 ? "text-danger" : d > 0 ? "text-warning" : "text-success"}`}>
                  {d === 0 ? "pas" : `${d < 0 ? "kurang" : "lebih"} ${formatRupiah(Math.abs(d))}`}
                </span>
                {calc}
              </>
            )}
          </>
        ),
        extra: note ? [`catatan: ${note}`] : [],
      };
    }
    case "cash_in":
    case "cash_out":
      return {
        main: (
          <>
            {a.kind === "cash_in" ? "Kas masuk" : "Kas keluar"} <strong className="font-semibold tabular-nums">{amount ?? "—"}</strong>
            {note ? ` — ${note}` : ""}
            {a.actor ? ` (${a.actor})` : ""}
          </>
        ),
        extra: [],
      };
    case "new_device":
      return {
        main: (
          <>
            <strong className="font-semibold">{who(a.actor)}</strong> masuk dari perangkat/browser baru
          </>
        ),
        extra: note ? [note] : [],
      };
  }
}

function hrefOf(a: ActivityItem): string | null {
  if (!a.ref_id) return null;
  if (a.kind === "void" || a.kind === "refund" || a.kind === "manual_discount") return `/dasbor/transaksi/${a.ref_id}`;
  if (a.kind === "shift_closed" || a.kind === "cash_in" || a.kind === "cash_out") return `/dasbor/shift/${a.ref_id}`;
  return null;
}

// ——— Ringkasan periode ———

type Summary = {
  counts: Record<ActivityKind, number>;
  /** Tutup kasir dengan selisih kurang (dari hingga 500 tutup kasir pertama). */
  short: { count: number; amount: number; closes: number };
};

async function loadSummary(base: ActivityQuery, signal: AbortSignal): Promise<Summary> {
  const api = await ownerApi();
  // Jumlah per jenis dari meta.total (per_page=1); tutup kasir diambil penuh untuk menghitung selisih kurang.
  const others = ACTIVITY_KINDS.filter((k) => k !== "shift_closed");
  const totals = Promise.all(others.map((k) => api.activity({ ...base, kind: [k], page: 1, per_page: 1 }, signal).then((r) => [k, r.meta.total] as const)));
  const closes = (async () => {
    const rows: ActivityItem[] = [];
    let total = 0;
    for (let p = 1; p <= 5; p++) {
      const r = await api.activity({ ...base, kind: ["shift_closed"], page: p, per_page: 100 }, signal);
      rows.push(...r.items);
      total = r.meta.total;
      if (r.items.length === 0 || rows.length >= total) break;
    }
    return { rows, total };
  })();
  const [pairs, c] = await Promise.all([totals, closes]);
  const counts = Object.fromEntries([...pairs, ["shift_closed", c.total]]) as Record<ActivityKind, number>;
  const shortRows = c.rows.filter((r) => r.difference !== null && r.difference < 0);
  return {
    counts,
    short: { count: shortRows.length, amount: shortRows.reduce((s, r) => s + Math.abs(r.difference ?? 0), 0), closes: c.total },
  };
}

function SummaryCards({ s, allOutlets }: { s: Summary; allOutlets: boolean }) {
  const c = s.counts;
  const cancelled = c.void + c.refund;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Pembatalan & pengembalian"
        icon={<Ban size={14} aria-hidden />}
        value={cancelled}
        tone={cancelled > 0 ? "danger" : "neutral"}
        hint={`${c.void.toLocaleString("id-ID")} batal · ${c.refund.toLocaleString("id-ID")} dikembalikan`}
      />
      <StatCard
        label="Selisih kas kurang"
        icon={<Wallet size={14} aria-hidden />}
        value={s.short.count > 0 ? `-${formatRupiah(s.short.amount)}` : "Tidak ada"}
        tone={s.short.count > 0 ? "danger" : "success"}
        hint={`${s.short.count.toLocaleString("id-ID")} dari ${s.short.closes.toLocaleString("id-ID")} tutup kasir`}
      />
      <StatCard label="Diskon manual" icon={<Percent size={14} aria-hidden />} value={c.manual_discount} hint="transaksi dengan diskon non-otomatis" />
      <StatCard
        label="Kas masuk / keluar"
        icon={<ArrowUpRight size={14} aria-hidden />}
        value={`${c.cash_in.toLocaleString("id-ID")} / ${c.cash_out.toLocaleString("id-ID")}`}
        hint={allOutlets ? `${c.new_device.toLocaleString("id-ID")} login dari perangkat baru` : "catatan kas laci"}
      />
    </div>
  );
}

// ——— Halaman ———

export function ActivityView() {
  const { outletId, session, withOutlet } = useOwner();
  const period = usePeriod("7d");
  const { from, to, preset, qs } = period;
  const kind = qs.list("kind").filter(isKind);
  const page = Math.max(1, Number(qs.get("page")) || 1);
  const allOutlets = !outletId;
  const showOutlet = allOutlets && session.outlets.length > 1;
  // Perangkat baru hanya ada saat semua outlet.
  const kindOptions = ACTIVITY_KINDS.filter((k) => allOutlets || k !== "new_device");

  const { state, reload } = useLoad<ActivityPage>(
    async (signal) => (await ownerApi()).activity({ from, to, outlet_id: outletId, kind, page, per_page: PER_PAGE }, signal),
    [from, to, outletId, kind.join(","), page]
  );
  const summary = useLoad<Summary>((signal) => loadSummary({ from, to, outlet_id: outletId }, signal), [from, to, outletId]);
  const counts = summary.state.data?.counts;

  const data = state.data;
  const filtered = kind.length > 0;
  const toggle = (k: ActivityKind) => qs.update({ kind: kind.includes(k) ? kind.filter((x) => x !== k) : [...kind, k] });

  // Kelompokkan per tanggal (zona usaha) (data sudah urut terbaru).
  const groups: { day: string; items: ActivityItem[] }[] = [];
  for (const a of data?.items ?? []) {
    const day = zonedDay(a.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, items: [a] });
  }

  return (
    <>
      <PageHeader
        title="Aktivitas"
        description="Kejadian penting di kasir: pembatalan, pengembalian dana, diskon manual, tutup kasir, kas masuk/keluar, dan login dari perangkat baru."
      />
      <FilterBar>
        <PeriodFilter from={from} to={to} preset={preset} onChange={period.setPeriod} />
        {filtered && <ClearFiltersButton onClick={() => qs.update({ kind: null })} />}
      </FilterBar>

      {summary.state.status === "error" ? null : summary.state.data ? (
        <SummaryCards s={summary.state.data} allOutlets={allOutlets} />
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" role="status" aria-label="Memuat ringkasan">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-[14px] border border-border-subtle bg-white motion-reduce:animate-none" />
          ))}
        </div>
      )}

      <div role="group" aria-label="Jenis aktivitas" className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip on={!filtered} onClick={() => qs.update({ kind: null })}>
          Semua
        </Chip>
        {kindOptions.map((k) => (
          <Chip key={k} on={kind.includes(k)} onClick={() => toggle(k)}>
            {ACTIVITY_KIND[k]}
            {counts && <span className={`ml-1.5 tabular-nums ${counts[k] ? "" : "opacity-60"}`}>{counts[k].toLocaleString("id-ID")}</span>}
          </Chip>
        ))}
      </div>

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!data && state.status === "loading" && <SkeletonList rows={8} label="Memuat aktivitas" />}
      {data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          {data.items.length === 0 ? (
            <section className={cardClass}>
              <EmptyState
                icon={<History size={22} aria-hidden />}
                title={filtered ? "Tidak ada aktivitas yang cocok" : "Belum ada aktivitas"}
                action={filtered ? <ClearFiltersButton onClick={() => qs.update({ kind: null })} /> : undefined}
              >
                {filtered ? "Pilih jenis lain atau perluas periode." : "Tidak ada pembatalan, diskon manual, tutup kasir, atau kas masuk/keluar pada periode ini."}
              </EmptyState>
            </section>
          ) : (
            <div className={`flex flex-col gap-4 transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`} aria-busy={state.status === "loading"}>
              {groups.map((g) => (
                <section key={g.day} className={`${cardClass} overflow-hidden`} aria-labelledby={`hari-${g.day}`}>
                  <h2 id={`hari-${g.day}`} className="border-b border-border-subtle bg-bg-muted/50 px-4 py-2 text-[13px] font-semibold text-text-heading sm:px-5">
                    {formatDayLong(g.day)}
                  </h2>
                  <ul className="divide-y divide-border-subtle">
                    {g.items.map((a, i) => (
                      <ActivityRow key={`${a.kind}:${a.ref_id ?? ""}:${a.at}:${i}`} a={a} showOutlet={showOutlet} href={hrefOf(a)} withOutlet={withOutlet} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {data.meta.total > data.meta.per_page && (
            <div className="mt-3">
              <Pagination page={data.meta.page} perPage={data.meta.per_page} total={data.meta.total} onPage={(p) => qs.update({ page: String(p) })} />
            </div>
          )}
          <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-text-muted">
            <Info size={14} aria-hidden className="shrink-0" />
            Riwayat perubahan harga/produk belum tersedia.
          </p>
          <SyncNote className="mt-1.5" />
        </>
      )}
    </>
  );
}

function ActivityRow({
  a,
  showOutlet,
  href,
  withOutlet,
}: {
  a: ActivityItem;
  showOutlet: boolean;
  href: string | null;
  withOutlet: (h: string) => string;
}) {
  const Icon = KIND_ICON[a.kind];
  const { main, extra } = describe(a);
  // Nama outlet sudah ada di kalimat tutup kasir.
  const outlet = showOutlet && a.kind !== "shift_closed" ? a.outlet_name : null;
  const meta = [`${formatTime(a.at)} ${zoneLabel()}`, ACTIVITY_KIND[a.kind], outlet, ...extra].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[toneOf(a)]}`}>
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-snug text-text-heading">{main}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-text-muted">{meta}</span>
      </span>
      {href && <ChevronRight size={16} aria-hidden className="mt-2 shrink-0 text-text-muted group-hover:text-text-heading" />}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={withOutlet(href)} className={`group flex items-start gap-3 px-4 py-3 hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}>
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 sm:px-5">{body}</div>
      )}
    </li>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
        on ? "border-brand-primary/50 bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-body hover:border-border-active"
      } ${focusRing}`}
    >
      {children}
    </button>
  );
}
