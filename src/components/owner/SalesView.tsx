"use client";

import React from "react";
import { ReceiptText } from "lucide-react";
import { ClearFiltersButton, FilterBar, FilterSelect } from "@/components/admin/FilterMenu";
import { SearchBox } from "@/components/admin/filters";
import { cardClass, EmptyState, ErrorBlock, focusRing, formatRupiah, LoadingBar, PageHeader, Pagination, SkeletonList, useLoad } from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { slug } from "@/lib/owner/csv";
import { dayLabel } from "@/lib/owner/salesPdf";
import type { SalesPage, SalesSort, StaffMember } from "@/lib/owner/types";
import { labelOf, METHODS, SALE_STATUS, SALE_STATUS_SHORT } from "./labels";
import { useOwner } from "./OwnerShell";
import { SalesTable } from "./parts";
import { PeriodFilter, periodTitle, SyncNote, usePeriod } from "./ui";
import { SalesExport } from "./SalesExport";

// Riwayat transaksi (GET /owner/sales). Semua filter di URL: from, to, status, method, cashier, q, sort, page.

const PER_PAGE = 25;
const STATUSES = ["paid", "unpaid", "partial", "open", "void", "refunded"];
const METHOD_KEYS = ["cash", "qris", "card", "transfer", "split", "credit"];
const SORTS: { value: SalesSort; label: string }[] = [
  { value: "newest", label: "Terbaru" },
  { value: "oldest", label: "Terlama" },
  { value: "total_desc", label: "Total terbesar" },
];

const STAFF_RANK = (m: StaffMember) => (m.deleted ? 2 : m.is_active ? 0 : 1);

/** Pemilik & kasir untuk filter: aktif dulu, lalu nonaktif, lalu terhapus; pemilik sebelum kasir; urut nama. */
function cashierOptionsOf(list: StaffMember[]): { value: string; label: string }[] {
  return list
    .filter((m) => m.role === "owner" || m.role === "cashier")
    .sort(
      (a, b) =>
        STAFF_RANK(a) - STAFF_RANK(b) ||
        (a.role === b.role ? 0 : a.role === "owner" ? -1 : 1) ||
        a.name.localeCompare(b.name, "id-ID", { sensitivity: "base" })
    )
    .map((m) => {
      const tags = [m.role === "owner" ? "pemilik" : null, m.deleted ? "dihapus" : !m.is_active ? "nonaktif" : null].filter(Boolean);
      return { value: m.id, label: tags.length ? `${m.name} (${tags.join(", ")})` : m.name };
    });
}

export function SalesView() {
  const { outletId, outlet, session, withOutlet } = useOwner();
  const period = usePeriod("7d");
  const { from, to, preset, qs } = period;
  const status = qs.list("status").filter((s) => STATUSES.includes(s));
  const method = qs.list("method").filter((m) => METHOD_KEYS.includes(m));
  const cashier = qs.get("cashier");
  const q = qs.get("q").slice(0, 60);
  const sort = (SORTS.some((s) => s.value === qs.get("sort")) ? qs.get("sort") : "newest") as SalesSort;
  const page = Math.max(1, Number(qs.get("page")) || 1);
  const query = { from, to, outlet_id: outletId, status, method, cashier_id: cashier || undefined, q: q || undefined, sort };

  const { state, reload } = useLoad<SalesPage>(
    async (signal) => (await ownerApi()).sales({ ...query, page, per_page: PER_PAGE }, signal),
    [from, to, outletId, status.join(","), method.join(","), cashier, q, sort, page]
  );
  // Daftar kasir untuk filter: semua pemilik & kasir usaha (GET /owner/staff), termasuk yang nonaktif/terhapus agar
  // riwayat lama tetap bisa difilter. Dapur tidak ikut (tidak mencatat transaksi).
  const staff = useLoad<StaffMember[]>(async (signal) => (await ownerApi()).staff(signal), []);
  const cashierOptions = cashierOptionsOf(staff.state.data ?? []);
  if (cashier && !cashierOptions.some((c) => c.value === cashier)) cashierOptions.push({ value: cashier, label: "Kasir terpilih" });

  const data = state.data;
  const filtered = status.length > 0 || method.length > 0 || !!cashier || !!q;

  // Filter selain periode & outlet, untuk dialog & kepala PDF.
  const extraFilters = [
    method.length ? `Metode: ${method.map((m) => labelOf(METHODS, m)).join(", ")}` : null,
    status.length ? `Status: ${status.map((x) => labelOf(SALE_STATUS, x)).join(", ")}` : null,
    cashier ? `Kasir: ${cashierOptions.find((c) => c.value === cashier)?.label ?? "terpilih"}` : null,
    q ? `Cari: "${q}"` : null,
  ].filter((x): x is string => !!x);

  const toggleStatus = (s: string) => qs.update({ status: status.includes(s) ? status.filter((x) => x !== s) : [...status, s] });

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Riwayat transaksi dari semua perangkat kasir. Klik baris untuk melihat struk."
        actions={
          <SalesExport
            total={data?.meta.total ?? 0}
            query={query}
            extraFilters={extraFilters}
            businessName={session.business.name}
            outletLabel={outlet?.name ?? (session.outlets.length > 1 ? "Semua outlet" : (session.outlets[0]?.name ?? "-"))}
            periodLabel={from === to ? dayLabel(from) : `${periodTitle(from, to, preset)} (${dayLabel(from)} - ${dayLabel(to)})`}
            filenameBase={`${slug(session.business.name)}-${slug(outlet?.name ?? "semua-outlet")}-transaksi-${from}_${to}`}
          />
        }
      />

      <FilterBar
        search={
          <SearchBox
            id="sales-search"
            label="Cari nomor struk atau nama pelanggan"
            placeholder="Cari struk / pelanggan"
            value={q}
            onSearch={(v) => qs.update({ q: v.slice(0, 60) || null }, "replace")}
            className="sm:w-[260px]"
          />
        }
      >
        <PeriodFilter from={from} to={to} preset={preset} onChange={period.setPeriod} />
        <FilterSelect
          label="Metode"
          multiple
          options={METHOD_KEYS.map((m) => ({ value: m, label: labelOf(METHODS, m) }))}
          selected={method}
          onChange={(n) => qs.update({ method: n })}
        />
        <FilterSelect
          label="Kasir"
          options={cashierOptions}
          selected={cashier ? [cashier] : []}
          onChange={(n) => qs.update({ cashier: n[0] ?? null })}
        />
        <FilterSelect
          label="Urutan"
          required
          highlight={false}
          options={SORTS}
          selected={[sort]}
          onChange={(n) => qs.update({ sort: n[0] === "newest" ? null : n[0] })}
        />
        {filtered && <ClearFiltersButton onClick={() => qs.clear(["from", "to", "outlet", "sort"])} />}
      </FilterBar>

      <div role="group" aria-label="Status transaksi" className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip on={status.length === 0} onClick={() => qs.update({ status: null })}>
          Semua status
        </Chip>
        {STATUSES.map((s) => (
          <Chip key={s} on={status.includes(s)} onClick={() => toggleStatus(s)} title={SALE_STATUS[s]}>
            {SALE_STATUS_SHORT[s]}
          </Chip>
        ))}
      </div>

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!data && state.status === "loading" && <SkeletonList rows={10} label="Memuat transaksi" />}
      {data && (
        <>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 text-[13.5px]">
            <p className="text-text-body" aria-live="polite">
              <strong className="font-semibold text-text-heading tabular-nums">{data.summary.count.toLocaleString("id-ID")}</strong> transaksi · total{" "}
              <strong className="font-semibold text-text-heading tabular-nums">{formatRupiah(data.summary.total)}</strong>
              {status.length === 0 && <span className="text-text-muted"> (termasuk berjalan & dibatalkan)</span>}
            </p>
          </div>
          <LoadingBar active={state.status === "loading"} />
          <section className={`${cardClass} overflow-hidden`} aria-busy={state.status === "loading"}>
            {data.items.length === 0 ? (
              <EmptyState
                icon={<ReceiptText size={22} aria-hidden />}
                title={filtered ? "Tidak ada transaksi yang cocok" : "Belum ada transaksi"}
                action={filtered ? <ClearFiltersButton onClick={() => qs.clear(["from", "to", "outlet"])} /> : undefined}
              >
                {filtered ? "Ubah atau hapus filter untuk melihat transaksi lain." : "Pilih periode lain, atau tunggu perangkat kasir sinkron."}
              </EmptyState>
            ) : (
              <SalesTable rows={data.items} hrefOf={(id) => withOutlet(`/dasbor/transaksi/${id}`)} showOutlet={!outletId && session.outlets.length > 1} dim={state.status === "loading"} />
            )}
          </section>
          {data.meta.total > PER_PAGE && (
            <div className="mt-3">
              <Pagination page={data.meta.page} perPage={data.meta.per_page} total={data.meta.total} onPage={(p) => qs.update({ page: String(p) })} />
            </div>
          )}
          <SyncNote className="mt-4" />
        </>
      )}
    </>
  );
}

function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      title={title}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
        on ? "border-brand-primary/50 bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-body hover:border-border-active"
      } ${focusRing}`}
    >
      {children}
    </button>
  );
}

