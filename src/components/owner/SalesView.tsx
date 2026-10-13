"use client";

import React, { useRef, useState } from "react";
import { ReceiptText, X } from "lucide-react";
import { ClearFiltersButton, FilterBar, FilterSelect } from "@/components/admin/FilterMenu";
import { SearchBox } from "@/components/admin/filters";
import {
  btn,
  cardClass,
  EmptyState,
  ErrorBlock,
  errorMessage,
  focusRing,
  formatRupiah,
  LoadingBar,
  Notice,
  PageHeader,
  Pagination,
  SkeletonList,
  Spinner,
  useLoad,
} from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { csvDateTime, downloadCsv, slug } from "@/lib/owner/csv";
import { zoneLabel } from "@/lib/owner/tz";
import type { SaleListItem, SalesPage, SalesSort, StaffMember } from "@/lib/owner/types";
import { labelOf, METHODS, orderTypeLabel, SALE_STATUS, SALE_STATUS_SHORT } from "./labels";
import { useOwner } from "./OwnerShell";
import { SalesTable } from "./parts";
import { PeriodFilter, SyncNote, usePeriod } from "./ui";

// Riwayat transaksi (GET /owner/sales). Semua filter di URL: from, to, status, method, cashier, q, sort, page.

const PER_PAGE = 25;
const EXPORT_LIMIT = 5000;
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

  const toggleStatus = (s: string) => qs.update({ status: status.includes(s) ? status.filter((x) => x !== s) : [...status, s] });

  return (
    <>
      <PageHeader
        title="Transaksi"
        description="Riwayat transaksi dari semua perangkat kasir. Klik baris untuk melihat struk."
        actions={
          <ExportSales
            disabled={!data || data.meta.total === 0}
            total={data?.meta.total ?? 0}
            filename={`${slug(session.business.name)}-${slug(outlet?.name ?? "semua-outlet")}-transaksi-${from}_${to}.csv`}
            fetchPage={async (p, signal) => (await ownerApi()).sales({ ...query, page: p, per_page: 100 }, signal)}
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

/** Ekspor semua halaman hasil filter (berurutan, 100 per permintaan, maksimal 5.000 baris) dengan progres. */
function ExportSales({
  disabled,
  total,
  filename,
  fetchPage,
}: {
  disabled: boolean;
  total: number;
  filename: string;
  fetchPage: (page: number, signal: AbortSignal) => Promise<SalesPage>;
}) {
  const [progress, setProgress] = useState<{ done: number; of: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);

  async function run() {
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setError(null);
    const target = Math.min(total, EXPORT_LIMIT);
    setProgress({ done: 0, of: target });
    const rows: SaleListItem[] = [];
    try {
      for (let p = 1; rows.length < target; p++) {
        const r = await fetchPage(p, ctrl.signal);
        rows.push(...r.items);
        setProgress({ done: Math.min(rows.length, target), of: Math.min(r.meta.total, EXPORT_LIMIT) });
        if (r.items.length === 0 || rows.length >= r.meta.total) break;
      }
      downloadCsv(
        filename,
        [`waktu_${zoneLabel().toLowerCase()}`, "no_struk", "outlet", "kasir", "pelanggan", "meja", "jenis_pesanan", "status", "metode", "total", "dibayar", "jumlah_item"],
        rows.slice(0, EXPORT_LIMIT).map((s) => [
          csvDateTime(s.paid_at),
          s.receipt_no,
          s.outlet_name,
          s.cashier_name,
          s.customer_name ?? "",
          s.table_name ?? "",
          s.order_type ? orderTypeLabel(s.order_type) : "",
          labelOf(SALE_STATUS, s.status),
          labelOf(METHODS, s.payment_method),
          s.total,
          s.paid_total,
          s.items_count,
        ])
      );
    } catch (err) {
      if (!ctrl.signal.aborted) setError(errorMessage(err));
    } finally {
      ctrlRef.current = null;
      setProgress(null);
    }
  }

  if (progress) {
    const pct = progress.of ? Math.round((progress.done / progress.of) * 100) : 0;
    return (
      <div className="flex items-center gap-2" role="status">
        <span className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-border-subtle bg-white px-3 text-[13.5px]">
          <Spinner />
          <span className="tabular-nums">
            Mengambil {progress.done.toLocaleString("id-ID")}/{progress.of.toLocaleString("id-ID")} ({pct}%)
          </span>
        </span>
        <button type="button" className={btn.ghost} onClick={() => ctrlRef.current?.abort()} aria-label="Batalkan ekspor">
          <X size={16} aria-hidden /> Batal
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" className={btn.secondary} disabled={disabled} onClick={run} title={total > EXPORT_LIMIT ? `Hanya ${EXPORT_LIMIT.toLocaleString("id-ID")} baris pertama` : undefined}>
        Ekspor CSV
      </button>
      {total > EXPORT_LIMIT && <p className="text-[12px] text-text-muted">Maks. {EXPORT_LIMIT.toLocaleString("id-ID")} baris — persempit periode untuk sisanya.</p>}
      {error && (
        <Notice tone="danger" role="alert">
          Ekspor gagal: {error}
        </Notice>
      )}
    </div>
  );
}
