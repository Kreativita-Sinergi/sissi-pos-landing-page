"use client";

import React, { useMemo } from "react";
import { Boxes, Info } from "lucide-react";
import { ClearFiltersButton, FilterBar, FilterSelect } from "@/components/admin/FilterMenu";
import { SearchBox, useQueryState } from "@/components/admin/filters";
import {
  Badge,
  btn,
  cardClass,
  EmptyState,
  ErrorBlock,
  focusRing,
  LoadingBar,
  Notice,
  PageHeader,
  Pagination,
  SkeletonList,
  StatCard,
  tdClass,
  thClass,
  useLoad,
} from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { formatQty, fromMilli, norm } from "@/lib/owner/catalog";
import { downloadCsv, slug } from "@/lib/owner/csv";
import type { StockRow } from "@/lib/owner/types";
import { useOwner } from "../OwnerShell";
import { SyncNote } from "../ui";

// Stok (hanya baca, Gratis & Pro): GET /owner/stock?outlet_id= — produk ber-"Lacak stok" (per varian) dan bahan baku.
// qty & min_stock dalam mili-satuan → ditampilkan /1000 (maks. 3 desimal). Penyesuaian/opname/PO di aplikasi.
// Filter di URL: q, kind, low=1, page.

const PER_PAGE = 50;

type Level = "out" | "low" | "ok";

function levelOf(r: StockRow): Level {
  if (r.qty <= 0) return "out";
  if (r.low) return "low";
  return "ok";
}

const LEVEL_LABEL: Record<Level, string> = { out: "Habis", low: "Menipis", ok: "Aman" };
const LEVEL_TONE: Record<Level, "danger" | "warning" | "success"> = { out: "danger", low: "warning", ok: "success" };
const LEVEL_RANK: Record<Level, number> = { out: 0, low: 1, ok: 2 };

export function StockView() {
  const { outletId, outlet, session } = useOwner();
  const qs = useQueryState();
  const q = qs.get("q").slice(0, 80);
  const kind = qs.get("kind");
  const onlyLow = qs.get("low") === "1";
  const page = Math.max(1, Number(qs.get("page")) || 1);
  const { state, reload } = useLoad<StockRow[]>(async (signal) => (await ownerApi()).stock({ outlet_id: outletId }, signal), [outletId]);
  const rows = state.data;

  const counts = useMemo(() => {
    const c = { out: 0, low: 0, ok: 0, product: 0, raw: 0 };
    for (const r of rows ?? []) {
      c[levelOf(r)]++;
      if (r.kind === "product") c.product++;
      else c.raw++;
    }
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = norm(q);
    return (rows ?? [])
      .filter((r) => {
        if (kind === "product" && r.kind !== "product") return false;
        if (kind === "raw" && r.kind !== "raw_material") return false;
        if (onlyLow && levelOf(r) === "ok") return false;
        if (!needle) return true;
        return [r.name, r.variant_name, r.category].some((x) => x && norm(x).includes(needle));
      })
      .sort((a, b) => LEVEL_RANK[levelOf(a)] - LEVEL_RANK[levelOf(b)] || a.name.localeCompare(b.name, "id") || (a.variant_name ?? "").localeCompare(b.variant_name ?? "", "id"));
  }, [rows, q, kind, onlyLow]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const filteredActive = !!q || !!kind || onlyLow;
  const scope = outlet ? outlet.name : session.outlets.length > 1 ? "Semua outlet" : (session.outlets[0]?.name ?? session.business.name);

  function exportCsv() {
    downloadCsv(
      `${slug(session.business.name)}-${slug(outlet?.name ?? "semua-outlet")}-stok.csv`,
      ["jenis", "nama", "varian", "kategori", "stok", "satuan", "stok_minimum", "status"],
      filtered.map((r) => [
        r.kind === "product" ? "Produk" : "Bahan baku",
        r.name,
        r.variant_name ?? "",
        r.category ?? "",
        fromMilli(r.qty),
        r.unit,
        fromMilli(r.min_stock),
        LEVEL_LABEL[levelOf(r)],
      ])
    );
  }

  return (
    <>
      <PageHeader
        title="Stok"
        description={<>Stok saat ini · {scope}. Hanya baca — penyesuaian, opname, dan pembelian (PO) dicatat lewat aplikasi Sissi.</>}
        actions={
          <button type="button" className={btn.secondary} onClick={exportCsv} disabled={!filtered.length}>
            Ekspor CSV
          </button>
        }
      />

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!rows && state.status === "loading" && <SkeletonList rows={8} label="Memuat stok" />}

      {rows && rows.length === 0 && (
        <section className={cardClass}>
          <EmptyState icon={<Boxes size={22} aria-hidden />} title="Belum ada produk yang dilacak stoknya">
            Aktifkan &quot;Lacak stok&quot; di produk (menu Produk) atau tambahkan bahan baku lewat aplikasi, lalu catat stok awal di aplikasi.
          </EmptyState>
        </section>
      )}

      {rows && rows.length > 0 && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Item dilacak" value={rows.length} hint={`${counts.product.toLocaleString("id-ID")} produk · ${counts.raw.toLocaleString("id-ID")} bahan baku`} />
            <StatCard label="Habis" value={counts.out} tone={counts.out ? "danger" : "neutral"} hint="Stok 0 atau minus" />
            <StatCard label="Menipis" value={counts.low} tone={counts.low ? "warning" : "neutral"} hint="Di bawah/sama dengan stok minimum" />
            <StatCard label="Aman" value={counts.ok} tone="success" />
          </div>

          <FilterBar
            search={
              <SearchBox
                id="stock-search"
                label="Cari nama, varian, atau kategori"
                placeholder="Cari nama / varian / kategori"
                value={q}
                onSearch={(v) => qs.update({ q: v.slice(0, 80) || null }, "replace")}
                className="sm:w-[280px]"
              />
            }
          >
            <button
              type="button"
              aria-pressed={onlyLow}
              onClick={() => qs.update({ low: onlyLow ? null : "1" })}
              className={`inline-flex min-h-10 shrink-0 items-center rounded-[10px] border px-3 text-[13.5px] font-semibold whitespace-nowrap ${
                onlyLow ? "border-brand-primary/50 bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-body hover:border-border-active"
              } ${focusRing}`}
            >
              Hanya yang menipis{counts.out + counts.low ? ` (${(counts.out + counts.low).toLocaleString("id-ID")})` : ""}
            </button>
            <FilterSelect
              label="Jenis"
              options={[
                { value: "product", label: "Produk", count: counts.product },
                { value: "raw", label: "Bahan baku", count: counts.raw },
              ]}
              selected={kind ? [kind] : []}
              onChange={(n) => qs.update({ kind: n[0] ?? null })}
            />
            {filteredActive && <ClearFiltersButton onClick={() => qs.clear(["outlet"])} />}
          </FilterBar>

          <LoadingBar active={state.status === "loading"} />
          <section className={`${cardClass} overflow-hidden`} aria-busy={state.status === "loading"}>
            {filtered.length === 0 ? (
              <EmptyState icon={<Boxes size={22} aria-hidden />} title={onlyLow && !q && !kind ? "Tidak ada stok yang menipis" : "Tidak ada yang cocok"}>
                {onlyLow && !q && !kind ? "Semua item yang dilacak masih di atas stok minimum." : "Ubah kata kunci atau filter."}
              </EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[340px] border-separate border-spacing-0 text-[14px]">
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>
                        Nama
                      </th>
                      <th scope="col" className={`${thClass} hidden md:table-cell`}>
                        Kategori
                      </th>
                      <th scope="col" className={`${thClass} text-right`}>
                        Stok
                      </th>
                      <th scope="col" className={`${thClass} hidden text-right sm:table-cell`}>
                        Minimum
                      </th>
                      <th scope="col" className={thClass}>
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((r) => {
                      const level = levelOf(r);
                      const key = `${r.kind}-${r.product_id ?? ""}-${r.variant_id ?? ""}-${r.raw_material_id ?? ""}`;
                      return (
                        <tr key={key} className="hover:bg-bg-muted/60">
                          <td className={`${tdClass} border-b border-border-subtle`}>
                            <span className="block font-semibold text-text-heading">
                              {r.name}
                              {r.variant_name && <span className="font-normal text-text-body"> — {r.variant_name}</span>}
                            </span>
                            <span className="block text-[12.5px] text-text-muted">
                              {r.kind === "raw_material" ? "Bahan baku" : "Produk"}
                              {r.category && <span className="md:hidden"> · {r.category}</span>}
                              <span className="sm:hidden"> · min. {formatQty(r.min_stock)}</span>
                            </span>
                          </td>
                          <td className={`${tdClass} hidden border-b border-border-subtle text-text-body md:table-cell`}>{r.category ?? <span className="text-text-muted">—</span>}</td>
                          <td className={`${tdClass} border-b border-border-subtle text-right font-semibold whitespace-nowrap tabular-nums ${level === "out" ? "text-danger" : level === "low" ? "text-warning" : ""}`}>
                            {formatQty(r.qty)} <span className="font-normal text-text-muted">{r.unit}</span>
                          </td>
                          <td className={`${tdClass} hidden border-b border-border-subtle text-right whitespace-nowrap text-text-body tabular-nums sm:table-cell`}>
                            {r.min_stock > 0 ? (
                              <>
                                {formatQty(r.min_stock)} <span className="text-text-muted">{r.unit}</span>
                              </>
                            ) : (
                              <span className="text-text-muted">—</span>
                            )}
                          </td>
                          <td className={`${tdClass} border-b border-border-subtle`}>
                            <Badge tone={LEVEL_TONE[level]}>{LEVEL_LABEL[level]}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          {filtered.length > PER_PAGE && (
            <div className="mt-3">
              <Pagination page={current} perPage={PER_PAGE} total={filtered.length} onPage={(p) => qs.update({ page: String(p) }, "replace")} />
            </div>
          )}
          <div className="mt-4 space-y-3">
            <Notice tone="info" icon={<Info size={16} aria-hidden />}>
              Stok dihitung dari semua pergerakan stok yang sudah sinkron{outlet ? " di outlet ini" : " di semua outlet"}. Untuk menambah stok, opname, atau membuat PO,
              gunakan menu Stok di aplikasi Sissi.
            </Notice>
            <SyncNote />
          </div>
        </>
      )}
    </>
  );
}
