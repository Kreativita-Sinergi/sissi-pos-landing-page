"use client";

import React, { useMemo, useState } from "react";
import { ImageOff, Package, Plus, RefreshCw, Upload } from "lucide-react";
import { ClearFiltersButton, FilterBar, FilterSelect } from "@/components/admin/FilterMenu";
import { SearchBox, useQueryState } from "@/components/admin/filters";
import {
  Badge,
  btn,
  cardClass,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatRupiah,
  LoadingBar,
  PageHeader,
  Pagination,
  SkeletonList,
  SortTh,
  Tabs,
  tdClass,
  thClass,
  useLoad,
} from "@/components/admin/ui";
import { pullAll } from "@/lib/owner/api";
import { marginPercent, norm, priceSummary, type Product, type Variant } from "@/lib/owner/catalog";
import { downloadCsv, slug } from "@/lib/owner/csv";
import { exportRows } from "@/lib/owner/productImport";
import type { BusinessType, SyncRecord } from "@/lib/owner/types";
import { useOwner } from "../OwnerShell";
import { ExportMenu } from "../ui";
import { Check } from "./bits";
import { BulkEdit } from "./BulkEdit";
import { CategoriesPanel } from "./CategoriesPanel";
import { CsvImport, downloadTemplate, downloadXlsxTemplate } from "./CsvImport";
import { DiscountsPanel } from "./DiscountsPanel";
import { ModifiersPanel } from "./ModifiersPanel";
import { ProductEditor } from "./ProductEditor";
import { useCatalog, type CatalogData } from "./useCatalog";
import { useInventory } from "./useInventory";
import { pushNewMaterial } from "./formParts";

// Produk & katalog (Gratis & Pro). Data ditarik penuh lewat GET /owner/data/{entity} lalu disaring/diurutkan
// di klien (bisa ribuan baris → paginasi klien). Tulis lewat POST /owner/changes (lihat useCatalog).
// Filter di URL: tab, q, cat, status, sort, order, page.

const PER_PAGE = 50;
type TabId = "produk" | "kategori" | "modifier" | "diskon";
const TABS: TabId[] = ["produk", "kategori", "modifier", "diskon"];
type SortKey = "name" | "category" | "price" | "margin" | "updated";
const SORT_KEYS: SortKey[] = ["name", "category", "price", "margin", "updated"];

// ToastProvider dipasang oleh OwnerShell.
export function ProductsView() {
  const { session } = useOwner();
  const qs = useQueryState();
  const catalog = useCatalog();
  const { state, reload, commit, refresh } = catalog;
  const data = state.data;
  const tab = (TABS.includes(qs.get("tab") as TabId) ? qs.get("tab") : "produk") as TabId;
  const [editor, setEditor] = useState<{ id: string | null; key: number } | null>(null);
  const [bulk, setBulk] = useState<string[] | null>(null);
  const [importing, setImporting] = useState(false);
  // Kunci tabel: dinaikkan setelah edit massal selesai agar pilihan kosong lagi.
  const [tableKey, setTableKey] = useState(0);
  const extras = useCatalogExtras(session.business.type);
  // Resep & bahan baku (form produk & HPP opsi modifier). Sumber modal kini dari `recipes` sungguhan.
  const inventory = useInventory();
  const inv = inventory.state.data ?? null;
  const invFailed = inventory.state.status === "error" && !inv;
  const btype = session.business.type;
  const recipeSupport = inv
    ? {
        materials: inv.materials,
        showRecipe: btype !== "service" && (btype !== "retail" || inv.materials.length > 0),
        createMaterial: async (d: { name: string; unit: string; min_stock: number; avg_cost: number }) => {
          const { material, results } = await pushNewMaterial(d);
          inventory.apply(results);
          return material;
        },
      }
    : null;
  const service = session.business.type === "service";

  return (
    <>
      <PageHeader
        title="Produk"
        description="Kelola produk, kategori, modifier, dan diskon. Perubahan diterima perangkat kasir saat sinkron berikutnya."
        actions={
          data && tab === "produk" ? (
            <>
              <button type="button" className={btn.secondary} onClick={() => setImporting(true)}>
                <Upload size={16} aria-hidden /> Impor Excel/CSV
              </button>
              <ExportMenu
                items={[
                  { label: "Produk (CSV)", hint: `${data.products.length.toLocaleString("id-ID")} produk, format sama dengan impor`, onSelect: () => exportProducts(data, session.business.name, service), disabled: !data.products.length },
                  { label: "Template impor (Excel)", hint: "Produk, varian, bahan baku, resep, pilihan ekstra", onSelect: () => void downloadXlsxTemplate(service) },
                  { label: "Template impor (CSV)", hint: "Template CSV aplikasi Sissi", onSelect: () => downloadTemplate(service) },
                ]}
              />
              <button type="button" className={btn.primary} onClick={() => setEditor({ id: null, key: Date.now() })}>
                <Plus size={16} aria-hidden /> Tambah produk
              </button>
            </>
          ) : undefined
        }
      />

      <Tabs<TabId>
        label="Bagian katalog"
        active={tab}
        onChange={(t) => qs.update({ tab: t === "produk" ? null : t, q: null, cat: null, status: null, sort: null, order: null })}
        tabs={[
          { id: "produk", label: "Produk", count: data?.products.length },
          { id: "kategori", label: "Kategori", count: data?.categories.length },
          { id: "modifier", label: "Modifier", count: data?.groups.length },
          { id: "diskon", label: "Diskon", count: data?.discounts.length },
        ]}
      />

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!data && state.status === "loading" && <SkeletonList rows={10} label="Memuat katalog" />}
      {data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          {tab === "produk" && (
            <ProductsTable
              key={tableKey}
              data={data}
              onOpen={(id) => setEditor({ id, key: Date.now() })}
              onBulk={(ids) => setBulk(ids)}
              onAdd={() => setEditor({ id: null, key: Date.now() })}
              onImport={() => setImporting(true)}
            />
          )}
          {tab === "kategori" && <CategoriesPanel data={data} commit={commit} refresh={refresh} />}
          {tab === "modifier" && <ModifiersPanel data={data} commit={commit} refresh={refresh} recipes={recipeSupport} />}
          {tab === "diskon" && <DiscountsPanel data={data} commit={commit} />}
          <p className="mt-4 flex flex-wrap items-center gap-1.5 text-[12.5px] text-text-muted">
            Data katalog dimuat saat halaman dibuka.
            <button type="button" onClick={reload} className={`inline-flex items-center gap-1 font-semibold text-brand-ink underline-offset-2 hover:underline ${focusRing}`}>
              <RefreshCw size={13} aria-hidden /> Muat ulang
            </button>
          </p>

          {editor && (
            <ProductEditor
              key={editor.key}
              productId={editor.id}
              data={data}
              commit={commit}
              businessType={session.business.type}
              kitchen={extras.kitchen}
              inventory={invFailed ? null : inv}
              inventoryLoading={!inv && !invFailed}
              onInventoryResults={inventory.apply}
              defaultCategory={qs.get("cat") && qs.get("cat") !== "none" ? qs.get("cat") : ""}
              onClose={() => setEditor(null)}
            />
          )}
          {bulk && <BulkEdit ids={bulk} data={data} commit={commit} onClose={() => setBulk(null)} onDone={() => setTableKey((k) => k + 1)} />}
          {importing && <CsvImport data={data} commit={commit} service={service} onClose={() => setImporting(false)} />}
        </>
      )}
    </>
  );
}

type Row = {
  p: Product;
  category: string;
  minPrice: number;
  maxPrice: number;
  margin: number | null;
  variants: Variant[];
};

function ProductsTable({
  data,
  onOpen,
  onBulk,
  onAdd,
  onImport,
}: {
  data: CatalogData;
  onOpen: (id: string) => void;
  onBulk: (ids: string[]) => void;
  onAdd: () => void;
  onImport: () => void;
}) {
  const qs = useQueryState();
  const q = qs.get("q").slice(0, 80);
  const cat = qs.get("cat");
  const status = qs.get("status");
  const sort = (SORT_KEYS.includes(qs.get("sort") as SortKey) ? qs.get("sort") : "name") as SortKey;
  const order: "asc" | "desc" = qs.get("order") === "desc" ? "desc" : "asc";
  const page = Math.max(1, Number(qs.get("page")) || 1);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const catNames = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories]);

  const rows = useMemo<Row[]>(() => {
    const byProduct = new Map<string, Variant[]>();
    for (const v of data.variants) byProduct.set(v.product_id, [...(byProduct.get(v.product_id) ?? []), v]);
    return data.products.map((p) => {
      const variants = byProduct.get(p.id) ?? [];
      // Hanya varian aktif (sama dengan `product_price_summary.dart`).
      const price = priceSummary(p, variants);
      return {
        p,
        category: p.category_id ? (catNames.get(p.category_id) ?? "") : "",
        minPrice: price.min,
        maxPrice: price.max,
        margin: variants.length ? null : marginPercent(p.price, p.cost_price),
        variants,
      };
    });
  }, [data.products, data.variants, catNames]);

  const filtered = useMemo(() => {
    const needle = norm(q);
    const out = rows.filter((r) => {
      if (cat === "none" ? !!r.p.category_id : cat && r.p.category_id !== cat) return false;
      if (status === "active" && !r.p.is_active) return false;
      if (status === "inactive" && r.p.is_active) return false;
      if (!needle) return true;
      const codes = [r.p.sku, r.p.barcode, ...(r.p.barcodes ?? []), ...r.variants.flatMap((v) => [v.sku, v.barcode, v.name])];
      return norm(r.p.name).includes(needle) || codes.some((c) => c && norm(c).includes(needle));
    });
    const dir = order === "asc" ? 1 : -1;
    const cmp: Record<SortKey, (a: Row, b: Row) => number> = {
      name: (a, b) => a.p.name.localeCompare(b.p.name, "id", { sensitivity: "base" }),
      category: (a, b) => (a.category || "￿").localeCompare(b.category || "￿", "id") || a.p.name.localeCompare(b.p.name, "id"),
      price: (a, b) => a.minPrice - b.minPrice,
      margin: (a, b) => (a.margin ?? -1e9) - (b.margin ?? -1e9),
      updated: (a, b) => a.p.updated_at.localeCompare(b.p.updated_at),
    };
    return out.sort((a, b) => cmp[sort](a, b) * dir);
  }, [rows, q, cat, status, sort, order]);

  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PER_PAGE, current * PER_PAGE);
  const filteredActive = !!q || !!cat || !!status;
  const liveSelected = [...selected].filter((id) => data.products.some((p) => p.id === id));
  const allOnPage = shown.length > 0 && shown.every((r) => selected.has(r.p.id));
  const someOnPage = shown.some((r) => selected.has(r.p.id));

  const catOptions = [
    { value: "none", label: "Tanpa kategori", count: data.products.filter((p) => !p.category_id).length },
    ...[...data.categories]
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "id"))
      .map((c) => ({ value: c.id, label: c.name, count: data.products.filter((p) => p.category_id === c.id).length })),
  ];

  const onSort = (f: string) => {
    if (f === sort) qs.update({ order: order === "asc" ? "desc" : null }, "replace");
    else qs.update({ sort: f === "name" ? null : f, order: f === "updated" || f === "margin" ? "desc" : null }, "replace");
  };

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  if (data.products.length === 0) {
    return (
      <section className={cardClass}>
        <EmptyState
          icon={<Package size={22} aria-hidden />}
          title="Belum ada produk"
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" className={btn.primary} onClick={onAdd}>
                <Plus size={16} aria-hidden /> Tambah produk
              </button>
              <button type="button" className={btn.secondary} onClick={onImport}>
                <Upload size={16} aria-hidden /> Impor Excel/CSV
              </button>
            </div>
          }
        >
          Tambahkan produk satu per satu, atau impor sekaligus dari spreadsheet.
        </EmptyState>
      </section>
    );
  }

  return (
    <>
      <FilterBar
        search={
          <SearchBox
            id="product-search"
            label="Cari nama, SKU, atau barcode"
            placeholder="Cari nama / SKU / barcode"
            value={q}
            onSearch={(v) => qs.update({ q: v.slice(0, 80) || null }, "replace")}
            className="sm:w-[280px]"
          />
        }
      >
        <FilterSelect label="Kategori" options={catOptions} selected={cat ? [cat] : []} onChange={(n) => qs.update({ cat: n[0] ?? null })} />
        <FilterSelect
          label="Status"
          options={[
            { value: "active", label: "Aktif", count: data.products.filter((p) => p.is_active).length },
            { value: "inactive", label: "Nonaktif", count: data.products.filter((p) => !p.is_active).length },
          ]}
          selected={status ? [status] : []}
          onChange={(n) => qs.update({ status: n[0] ?? null })}
        />
        {filteredActive && <ClearFiltersButton onClick={() => qs.clear(["outlet", "sort", "order"])} />}
      </FilterBar>

      <div className="mb-2 flex min-h-10 flex-wrap items-center justify-between gap-2 text-[13.5px]" aria-live="polite">
        {liveSelected.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-semibold text-text-heading tabular-nums">{liveSelected.length.toLocaleString("id-ID")} dipilih</strong>
            {liveSelected.length < filtered.length && (
              <button type="button" className={`font-semibold text-brand-ink hover:underline ${focusRing}`} onClick={() => setSelected(new Set(filtered.map((r) => r.p.id)))}>
                Pilih semua {filtered.length.toLocaleString("id-ID")} hasil
              </button>
            )}
            <button type="button" className={btn.primary} onClick={() => onBulk(liveSelected)}>
              Edit massal
            </button>
            <button type="button" className={btn.ghost} onClick={() => setSelected(new Set())}>
              Batal pilih
            </button>
          </div>
        ) : (
          <p className="text-text-body">
            <strong className="font-semibold text-text-heading tabular-nums">{filtered.length.toLocaleString("id-ID")}</strong>
            {filteredActive && ` dari ${data.products.length.toLocaleString("id-ID")}`} produk · centang untuk edit massal
          </p>
        )}
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        {filtered.length === 0 ? (
          <EmptyState icon={<Package size={22} aria-hidden />} title="Tidak ada produk yang cocok" action={<ClearFiltersButton onClick={() => qs.clear(["outlet"])} />}>
            Ubah kata kunci atau filter.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[340px] border-separate border-spacing-0 text-[14px]">
              <thead>
                <tr>
                  <th scope="col" className={`${thClass} w-10`}>
                    <Check
                      checked={allOnPage}
                      indeterminate={!allOnPage && someOnPage}
                      onChange={(on) =>
                        setSelected((s) => {
                          const n = new Set(s);
                          shown.forEach((r) => (on ? n.add(r.p.id) : n.delete(r.p.id)));
                          return n;
                        })
                      }
                      label="Pilih semua di halaman ini"
                      srOnlyLabel
                    />
                  </th>
                  <SortTh label="Produk" field="name" sort={sort} order={order} onSort={onSort} />
                  <SortTh label="Kategori" field="category" sort={sort} order={order} onSort={onSort} className="hidden md:table-cell" />
                  <SortTh label="Harga" field="price" sort={sort} order={order} onSort={onSort} align="right" />
                  <th scope="col" className={`${thClass} hidden text-right lg:table-cell`}>
                    Modal
                  </th>
                  <SortTh label="Margin" field="margin" sort={sort} order={order} onSort={onSort} align="right" className="hidden lg:table-cell" />
                  <th scope="col" className={`${thClass} hidden sm:table-cell`}>
                    Stok
                  </th>
                  <th scope="col" className={thClass}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <ProductRow key={r.p.id} row={r} checked={selected.has(r.p.id)} onCheck={(on) => toggle(r.p.id, on)} onOpen={() => onOpen(r.p.id)} />
                ))}
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
    </>
  );
}

function ProductRow({ row, checked, onCheck, onOpen }: { row: Row; checked: boolean; onCheck: (on: boolean) => void; onOpen: () => void }) {
  const { p, variants } = row;
  const cost = variants.length ? null : p.cost_price;
  const price = row.minPrice === row.maxPrice ? formatRupiah(row.minPrice) : `${formatRupiah(row.minPrice)} – ${formatRupiah(row.maxPrice)}`;
  const td = `${tdClass} border-b border-border-subtle`;
  return (
    <tr className={`hover:bg-bg-muted/60 ${checked ? "bg-brand-tint/40" : ""} ${p.is_active ? "" : "text-text-muted"}`}>
      <td className={td}>
        <Check checked={checked} onChange={onCheck} label={`Pilih ${p.name}`} srOnlyLabel />
      </td>
      <td className={td}>
        <button type="button" onClick={onOpen} className={`flex w-full min-w-0 items-center gap-3 rounded text-left ${focusRing}`}>
          {p.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- foto dari API (domain bebas), tanpa optimasi.
            <img src={p.image_url} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-[8px] border border-border-subtle object-cover" />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-bg-muted text-text-muted">
              <ImageOff size={15} aria-hidden />
            </span>
          )}
          <span className="min-w-0">
            <span className={`block truncate font-semibold hover:underline ${p.is_active ? "text-text-heading" : ""}`}>{p.name}</span>
            <span className="block truncate text-[12.5px] text-text-muted">
              {[p.sku, variants.length ? `${variants.length} varian` : null, row.category ? <span key="c" className="md:hidden">{row.category}</span> : null]
                .filter(Boolean)
                .map((x, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && " · "}
                    {x}
                  </React.Fragment>
                ))}
            </span>
          </span>
        </button>
      </td>
      <td className={`${td} hidden text-text-body md:table-cell`}>{row.category || <span className="text-text-muted">—</span>}</td>
      <td className={`${td} text-right font-semibold whitespace-nowrap tabular-nums`}>{price}</td>
      <td className={`${td} hidden text-right whitespace-nowrap text-text-body tabular-nums lg:table-cell`}>
        {variants.length ? <span className="text-text-muted">per varian</span> : cost === null ? <span className="text-text-muted">—</span> : formatRupiah(cost)}
      </td>
      <td className={`${td} hidden text-right tabular-nums lg:table-cell`}>
        {row.margin === null ? <span className="text-text-muted">—</span> : <span className={row.margin < 0 ? "text-danger" : ""}>{row.margin.toLocaleString("id-ID")}%</span>}
      </td>
      <td className={`${td} hidden sm:table-cell`}>{p.track_stock ? <Badge tone="brand">Dilacak</Badge> : <span className="text-text-muted">—</span>}</td>
      <td className={td}>{p.is_active ? <Badge tone="success">Aktif</Badge> : <Badge>Nonaktif</Badge>}</td>
    </tr>
  );
}

/** Ekspor dengan kolom template impor aplikasi (bisa diimpor ulang di aplikasi maupun web). */
function exportProducts(data: CatalogData, businessName: string, service: boolean) {
  const { header, rows } = exportRows(data, service);
  downloadCsv(`${slug(businessName)}-produk.csv`, header, rows);
}

type Extras = { kitchen: boolean };

/**
 * Data pendukung form produk: fitur dapur outlet (`outlets.settings.features.kitchen`, null = bawaan kuliner —
 * "Kirim ke dapur" tampil bila aktif di salah satu outlet). Gagal dimuat → bawaan jenis usaha.
 */
function useCatalogExtras(type: BusinessType): Extras {
  const fallback: Extras = { kitchen: type === "culinary" };
  const { state } = useLoad<Extras>(async (signal) => {
    const outlets = await pullAll<SyncRecord & { settings?: unknown }>("outlets", signal).catch(() => null);
    const kitchenOf = (o: { settings?: unknown }) => {
      const features = (o.settings as { features?: { kitchen?: unknown } } | null)?.features;
      return typeof features?.kitchen === "boolean" ? features.kitchen : type === "culinary";
    };
    return {
      kitchen: outlets?.length ? outlets.some(kitchenOf) : type === "culinary",
    };
  }, [type]);
  return state.data ?? fallback;
}
