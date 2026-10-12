"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, SearchX, Wallet } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AdminSubscription, Paged, SubscriptionFacets, SubscriptionStatus } from "@/lib/admin/types";
import { SearchBox, useQueryState } from "./filters";
import { ClearFiltersButton, FilterBar, FilterSelect } from "./FilterMenu";
import { BILLING_CYCLES, labelOf, SUB_STATUS, SUB_STATUS_HINT } from "./labels";
import { DaysLeft, PLAN_COLORS, StatusBadge, UsageMeter } from "./subscriptionUi";
import {
  btn,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatDate,
  formatRupiah,
  LoadingBar,
  PageHeader,
  Pagination,
  SkeletonList,
  SortTh,
  tdClass,
  thClass,
  useLoad,
} from "./ui";

// Daftar langganan semua bisnis (tahap 3). Filter di URL; aksi ada di tab Langganan detail bisnis.

const PER_PAGE = 25;
const STATUSES: SubscriptionStatus[] = ["active", "trial", "grace", "free"];
const SORTS = [
  { value: "ends_at", label: "Berakhir" },
  { value: "last_payment", label: "Bayar terakhir" },
  { value: "created", label: "Terbaru daftar" },
  { value: "name", label: "Nama" },
];
const defaultOrder = (sort: string) => (sort === "ends_at" || sort === "name" ? "asc" : "desc");

export const subscriptionHref = (businessId: string) => `/admin/bisnis/${encodeURIComponent(businessId)}?tab=langganan`;

export function SubscriptionListView() {
  const qs = useQueryState();
  const q = qs.get("q");
  const status = qs.list("status");
  const expiring = qs.get("expiring");
  const cycle = qs.get("cycle");
  const overLimit = qs.get("over_limit");
  const sort = qs.get("sort") || "ends_at";
  const order = (qs.get("order") || defaultOrder(sort)) as "asc" | "desc";
  const page = Math.max(1, Number(qs.get("page")) || 1);

  const { state, reload } = useLoad<Paged<AdminSubscription, SubscriptionFacets>>(
    async (signal) =>
      (await adminApi()).subscriptions(
        {
          q: q || undefined,
          status,
          expiring: expiring || undefined,
          cycle: cycle || undefined,
          over_limit: overLimit || undefined,
          sort: sort === "ends_at" ? undefined : sort,
          order: qs.get("order") || undefined,
          page,
          per_page: PER_PAGE,
        },
        signal
      ),
    [q, status.join(","), expiring, cycle, overLimit, sort, order, page]
  );
  const facets = state.data?.facets ?? null;

  const onSort = (field: string) => {
    const next = field === sort ? (order === "asc" ? "desc" : "asc") : defaultOrder(field);
    qs.update({ sort: field === "ends_at" ? null : field, order: next === defaultOrder(field) ? null : next });
  };
  const hasFilters = !!(status.length || expiring || cycle || overLimit);
  const clearAll = () => qs.clear(["sort", "order"]);
  const toggleStatus = (s: SubscriptionStatus) =>
    qs.update({ status: status.length === 1 && status[0] === s ? null : [s] });
  const sortLabel = SORTS.find((s) => s.value === sort)?.label ?? sort;

  return (
    <>
      <PageHeader
        title="Langganan"
        description="Status paket semua bisnis. Buka bisnis untuk mencatat pembayaran, menambah hari, atau mengatur batas khusus."
        actions={
          <Link href="/admin/langganan/pengaturan" className={btn.secondary}>
            <Wallet size={16} aria-hidden /> Cara bayar & harga
          </Link>
        }
      />

      {/* Ringkasan status — sekaligus pintasan filter */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        {STATUSES.map((s) => {
          const on = status.length === 1 && status[0] === s;
          const count = facets?.status?.[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              onClick={() => toggleStatus(s)}
              className={`flex min-w-0 items-start gap-2.5 rounded-[14px] border bg-white px-3 py-3 text-left transition-colors sm:px-4 ${
                on ? "border-brand-primary shadow-[inset_0_0_0_1px_var(--color-brand-primary)]" : "border-border-subtle hover:border-border-active"
              } ${focusRing}`}
            >
              <span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: PLAN_COLORS[s] }} />
              <span className="min-w-0">
                <span className="block text-[13px] text-text-muted">{labelOf(SUB_STATUS, s)}</span>
                <span className="block text-[22px] font-bold leading-tight tabular-nums text-text-heading">
                  {count === undefined ? "–" : count.toLocaleString("id-ID")}
                </span>
                <span className="block text-[12px] leading-snug text-text-muted">{SUB_STATUS_HINT[s]}</span>
              </span>
            </button>
          );
        })}
      </div>

      <FilterBar
        search={
          <SearchBox
            id="sub-q"
            label="Cari langganan menurut nama bisnis, email atau HP pemilik, atau ID bisnis"
            className="w-full sm:w-[280px]"
            value={q}
            onSearch={(v) => qs.update({ q: v }, "replace")}
            placeholder="Cari bisnis, email, HP…"
          />
        }
        trailing={
          state.data && (
            <p className="text-[13px] text-text-muted" aria-live="polite">
              <strong className="font-semibold tabular-nums text-text-heading">{state.data.meta.total.toLocaleString("id-ID")}</strong> bisnis
            </p>
          )
        }
      >
        <FilterSelect
          label="Status"
          multiple
          options={STATUSES.map((s) => ({ value: s, label: labelOf(SUB_STATUS, s), count: facets?.status?.[s] }))}
          selected={status}
          onChange={(n) => qs.update({ status: n })}
        />
        <FilterSelect
          label="Berakhir"
          options={[
            { value: "7d", label: "≤ 7 hari lagi", count: facets?.expiring_7d },
            { value: "30d", label: "≤ 30 hari lagi" },
          ]}
          selected={expiring ? [expiring] : []}
          onChange={(n) => qs.update({ expiring: n[0] ?? null })}
        />
        <FilterSelect
          label="Siklus"
          options={[
            { value: "monthly", label: "Bulanan" },
            { value: "yearly", label: "Tahunan" },
          ]}
          selected={cycle ? [cycle] : []}
          onChange={(n) => qs.update({ cycle: n[0] ?? null })}
        />
        <FilterSelect
          label="Batas"
          allLabel="Semua"
          options={[{ value: "true", label: "Gratis lewat batas", tone: "danger" }]}
          selected={overLimit ? [overLimit] : []}
          onChange={(n) => qs.update({ over_limit: n[0] ?? null })}
        />
        <div className="shrink-0 md:hidden">
          <FilterSelect
            label="Urut"
            required
            highlight={false}
            options={SORTS}
            selected={[sort]}
            summary={`${sortLabel} ${order === "asc" ? "↑" : "↓"}`}
            onChange={(n) => onSort(n[0])}
          />
        </div>
        {hasFilters && <ClearFiltersButton onClick={clearAll} />}
      </FilterBar>

      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <SkeletonList rows={10} label="Memuat langganan" />}
      {state.data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div
            className={`rounded-[14px] border border-border-subtle bg-white transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`}
            aria-busy={state.status === "loading"}
          >
            {state.data.items.length === 0 ? (
              hasFilters || q ? (
                <EmptyState
                  icon={<SearchX size={22} aria-hidden />}
                  title="Tidak ada langganan yang cocok"
                  action={
                    <button type="button" className={btn.secondary} onClick={clearAll}>
                      Hapus semua filter
                    </button>
                  }
                >
                  {q ? `Tidak ada hasil untuk “${q}” dengan filter ini.` : "Coba longgarkan filter."}
                </EmptyState>
              ) : (
                <EmptyState icon={<CreditCard size={22} aria-hidden />} title="Belum ada langganan">
                  Setiap bisnis baru otomatis mendapat uji coba Pro 30 hari.
                </EmptyState>
              )
            ) : (
              <SubscriptionTable items={state.data.items} sort={sort} order={order} onSort={onSort} />
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

function LastPayment({ s }: { s: AdminSubscription }) {
  const p = s.last_payment;
  if (!p) return <span className="text-[13px] text-text-muted">Belum pernah</span>;
  return (
    <span className="block text-[13px]">
      <span className={`font-semibold tabular-nums ${p.status === "void" ? "text-text-muted line-through" : "text-text-heading"}`}>
        {formatRupiah(p.amount)}
      </span>
      <span className="block text-[12px] text-text-muted">
        {formatDate(p.paid_at)} · {labelOf(BILLING_CYCLES, p.cycle).toLowerCase()}
      </span>
    </span>
  );
}

function SubscriptionTable({
  items,
  sort,
  order,
  onSort,
}: {
  items: AdminSubscription[];
  sort: string;
  order: "asc" | "desc";
  onSort: (f: string) => void;
}) {
  const sp = { sort, order, onSort };
  return (
    <>
      <table className="hidden w-full text-[14px] md:table">
        <thead>
          <tr>
            <SortTh label="Bisnis" field="name" {...sp} />
            <th scope="col" className={thClass}>Status</th>
            <SortTh label="Berakhir" field="ends_at" {...sp} />
            <th scope="col" className={`${thClass} hidden lg:table-cell`}>Transaksi bulan ini</th>
            <SortTh label="Bayar terakhir" field="last_payment" {...sp} />
            <th scope="col" className={`${thClass} w-8`}>
              <span className="sr-only">Buka</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((s) => (
            <tr key={s.business.id} className="group relative hover:bg-bg-muted/50">
              <td className={`${tdClass} max-w-[280px] py-2.5`}>
                <Link
                  href={subscriptionHref(s.business.id)}
                  className={`block truncate font-semibold text-text-heading after:absolute after:inset-0 group-hover:text-brand-ink ${focusRing}`}
                >
                  {s.business.name}
                </Link>
                <span className="block truncate text-[12.5px] text-text-muted">{s.business.owner?.email ?? "—"}</span>
              </td>
              <td className={tdClass}>
                <span className="flex flex-col items-start gap-0.5">
                  <StatusBadge status={s.status} />
                  {s.billing_cycle && s.status !== "free" && (
                    <span className="text-[12px] text-text-muted">{labelOf(BILLING_CYCLES, s.billing_cycle)}</span>
                  )}
                </span>
              </td>
              <td className={tdClass}>
                <DaysLeft s={s} />
              </td>
              <td className={`${tdClass} hidden lg:table-cell`}>
                <UsageMeter s={s} />
              </td>
              <td className={tdClass}>
                <LastPayment s={s} />
              </td>
              <td className={`${tdClass} text-text-muted`}>
                <ChevronRight size={16} aria-hidden />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-border-subtle md:hidden">
        {items.map((s) => (
          <li key={s.business.id}>
            <Link href={subscriptionHref(s.business.id)} className={`flex items-start gap-3 px-4 py-3 ${focusRing}`}>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="min-w-0 truncate font-semibold text-text-heading">{s.business.name}</span>
                  <StatusBadge status={s.status} />
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-text-muted">{s.business.owner?.email ?? "—"}</span>
                <span className="mt-1.5 block">
                  <UsageMeter s={s} />
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-right">
                <DaysLeft s={s} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
