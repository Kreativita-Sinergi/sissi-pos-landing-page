"use client";

import React from "react";
import Link from "next/link";
import { ChevronRight, SearchX, Store } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { BusinessFacets, BusinessSummary, Paged } from "@/lib/admin/types";
import {
  ActiveFilters,
  Chip,
  DateRangeFilter,
  FilterGroup,
  FilterPanel,
  rangeLabel,
  SearchBox,
  useQueryState,
  type ActiveFilter,
} from "./filters";
import { BUSINESS_TYPES, labelOf, PROVIDERS } from "./labels";
import {
  Badge,
  btn,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatDate,
  LoadingBar,
  PageHeader,
  Pagination,
  SkeletonList,
  SortTh,
  tdClass,
  thClass,
  TimeAgo,
  useLoad,
} from "./ui";

const PER_PAGE = 20;

const ACTIVE_OPTIONS: { value: "7d" | "30d" | "inactive"; label: string }[] = [
  { value: "7d", label: "Aktif 7 hari" },
  { value: "30d", label: "Aktif 30 hari" },
  { value: "inactive", label: "Tidak aktif" },
];
const FEATURE_OPTIONS: { value: "self_order" | "online_payment"; label: string }[] = [
  { value: "self_order", label: "Pesan QR" },
  { value: "online_payment", label: "Bayar online" },
];
const SORTS: { value: string; label: string }[] = [
  { value: "created", label: "Terbaru daftar" },
  { value: "last_active", label: "Aktif terakhir" },
  { value: "devices", label: "Perangkat" },
  { value: "name", label: "Nama" },
];

const defaultOrder = (sort: string) => (sort === "name" ? "asc" : "desc");

export function BusinessListView() {
  const qs = useQueryState();
  const q = qs.get("q");
  const types = qs.list("type");
  const active = qs.get("active");
  const features = qs.list("feature");
  const createdFrom = qs.get("created_from");
  const createdTo = qs.get("created_to");
  const deletion = qs.get("deletion");
  const sort = qs.get("sort") || "created";
  const order = (qs.get("order") || defaultOrder(sort)) as "asc" | "desc";
  const page = Math.max(1, Number(qs.get("page")) || 1);

  const { state, reload } = useLoad<Paged<BusinessSummary, BusinessFacets>>(
    async (signal) =>
      (await adminApi()).businesses(
        {
          q: q || undefined,
          type: types,
          active: active || undefined,
          feature: features,
          created_from: createdFrom || undefined,
          created_to: createdTo || undefined,
          deletion: deletion || undefined,
          sort: sort === "created" ? undefined : sort,
          order: qs.get("order") || undefined,
          page,
          per_page: PER_PAGE,
        },
        signal
      ),
    [q, types.join(","), active, features.join(","), createdFrom, createdTo, deletion, sort, order, page]
  );
  const facets = state.data?.facets ?? null;

  const toggle = (key: string, list: string[], value: string) =>
    qs.update({ [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] });

  const onSort = (field: string) => {
    const nextOrder = field === sort ? (order === "asc" ? "desc" : "asc") : defaultOrder(field);
    qs.update({
      sort: field === "created" ? null : field,
      order: nextOrder === defaultOrder(field) ? null : nextOrder,
    });
  };

  const activeFilters: ActiveFilter[] = [
    ...types.map((t) => ({ key: `type-${t}`, label: labelOf(BUSINESS_TYPES, t), onRemove: () => toggle("type", types, t) })),
    ...(active
      ? [
          {
            key: "active",
            label: ACTIVE_OPTIONS.find((o) => o.value === active)?.label ?? active,
            onRemove: () => qs.update({ active: null }),
          },
        ]
      : []),
    ...features.map((f) => ({
      key: `feature-${f}`,
      label: FEATURE_OPTIONS.find((o) => o.value === f)?.label ?? f,
      onRemove: () => toggle("feature", features, f),
    })),
    ...(createdFrom || createdTo
      ? [
          {
            key: "created",
            label: `Daftar ${rangeLabel(createdFrom, createdTo)}`,
            onRemove: () => qs.update({ created_from: null, created_to: null }),
          },
        ]
      : []),
    ...(deletion ? [{ key: "deletion", label: "Hapus akun terjadwal", onRemove: () => qs.update({ deletion: null }) }] : []),
  ];
  const filtered = activeFilters.length > 0 || !!q;
  const clearAll = () => qs.clear(["sort", "order"]);

  return (
    <>
      <PageHeader
        title="Bisnis"
        description="Semua bisnis pengguna Sissi. Saring, urutkan, lalu buka untuk melihat perangkat, karyawan, dan fitur."
      />

      <SearchBox
        id="biz-q"
        label="Cari bisnis"
        className="mb-3 sm:max-w-[440px]"
        value={q}
        onSearch={(v) => qs.update({ q: v }, "replace")}
        placeholder="Nama bisnis, pemilik, email, HP, atau ID"
      />

      <div className="mb-3">
        <FilterPanel activeCount={activeFilters.length}>
          <FilterGroup label="Jenis">
            {Object.entries(BUSINESS_TYPES).map(([value, label]) => (
              <Chip key={value} active={types.includes(value)} count={facets?.type?.[value]} onClick={() => toggle("type", types, value)}>
                {label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Aktivitas">
            {ACTIVE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={active === o.value}
                count={facets?.active?.[o.value]}
                onClick={() => qs.update({ active: active === o.value ? null : o.value })}
              >
                {o.label}
              </Chip>
            ))}
          </FilterGroup>
          <FilterGroup label="Fitur">
            {FEATURE_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                active={features.includes(o.value)}
                count={facets?.feature?.[o.value]}
                onClick={() => toggle("feature", features, o.value)}
              >
                {o.label}
              </Chip>
            ))}
            <Chip
              tone="danger"
              active={deletion === "scheduled"}
              count={facets?.deletion?.scheduled}
              onClick={() => qs.update({ deletion: deletion ? null : "scheduled" })}
            >
              Hapus akun terjadwal
            </Chip>
          </FilterGroup>
          <FilterGroup label="Terdaftar">
            <DateRangeFilter
              idPrefix="biz-created"
              from={createdFrom}
              to={createdTo}
              presets={[
                { label: "7 hari", days: 7 },
                { label: "30 hari", days: 30 },
                { label: "90 hari", days: 90 },
              ]}
              onChange={(from, to) => qs.update({ created_from: from, created_to: to })}
            />
          </FilterGroup>
        </FilterPanel>
      </div>

      <div className="mb-2 flex min-h-8 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <ActiveFilters items={activeFilters} onClearAll={clearAll} />
        {state.data && (
          <p className="ml-auto text-[13px] text-text-muted" aria-live="polite">
            <strong className="font-semibold tabular-nums text-text-heading">{state.data.meta.total.toLocaleString("id-ID")}</strong> bisnis
          </p>
        )}
      </div>

      {/* Urutan — HP (di layar lebar lewat header tabel) */}
      <div className="mb-3 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] md:hidden" role="group" aria-label="Urutkan">
        <span className="shrink-0 text-[12px] font-semibold uppercase tracking-wide text-text-muted">Urut</span>
        {SORTS.map((s) => (
          <Chip key={s.value} active={sort === s.value} onClick={() => onSort(s.value)}>
            {s.label}
            {sort === s.value && <span aria-hidden>{order === "asc" ? "↑" : "↓"}</span>}
          </Chip>
        ))}
      </div>

      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <SkeletonList rows={10} label="Memuat bisnis" />}
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
                  title="Tidak ada bisnis yang cocok"
                  action={
                    <button type="button" className={btn.secondary} onClick={clearAll}>
                      Hapus semua filter
                    </button>
                  }
                >
                  {q ? `Tidak ada hasil untuk “${q}” dengan filter ini.` : "Coba longgarkan filter atau ganti rentang tanggal."}
                </EmptyState>
              ) : (
                <EmptyState icon={<Store size={22} aria-hidden />} title="Belum ada bisnis">
                  Bisnis muncul di sini setelah pemilik mendaftar lewat aplikasi Sissi.
                </EmptyState>
              )
            ) : (
              <BusinessTable items={state.data.items} sort={sort} order={order} onSort={onSort} />
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

export function FeatureBadges({ b }: { b: Pick<BusinessSummary, "features"> }) {
  const f = b.features;
  const provider = PROVIDERS.find((p) => p.value === f.provider)?.label ?? f.provider;
  return (
    <span className="flex flex-wrap gap-1">
      {f.self_order ? <Badge tone="brand">Pesan QR</Badge> : null}
      {f.online_payment ? <Badge tone="success">Bayar online{provider ? ` · ${provider}` : ""}</Badge> : null}
      {!f.self_order && !f.online_payment && <span className="text-[13px] text-text-muted">—</span>}
    </span>
  );
}

function BusinessTable({
  items,
  sort,
  order,
  onSort,
}: {
  items: BusinessSummary[];
  sort: string;
  order: "asc" | "desc";
  onSort: (f: string) => void;
}) {
  const sortProps = { sort, order, onSort };
  return (
    <>
      {/* Tabel — layar lebar */}
      <div className="hidden md:block">
        <table className="w-full text-[14px]">
          <thead>
            <tr>
              <SortTh label="Bisnis" field="name" {...sortProps} />
              <th scope="col" className={`${thClass} hidden lg:table-cell`}>
                Pemilik
              </th>
              <SortTh label="Perangkat" field="devices" align="right" {...sortProps} />
              <SortTh label="Aktif terakhir" field="last_active" {...sortProps} />
              <SortTh label="Terdaftar" field="created" {...sortProps} className="hidden xl:table-cell" />
              <th scope="col" className={thClass}>
                Fitur
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {items.map((b) => (
              <tr key={b.id} className="group relative hover:bg-bg-muted/60">
                <td className={`${tdClass} max-w-[300px]`}>
                  <Link
                    href={`/admin/bisnis/${encodeURIComponent(b.id)}`}
                    className={`block truncate font-semibold text-text-heading after:absolute after:inset-0 group-hover:text-brand-ink ${focusRing}`}
                  >
                    {b.name}
                  </Link>
                  <p className="truncate text-[13px] text-text-muted">
                    {labelOf(BUSINESS_TYPES, b.type)}
                    {b.category ? ` · ${b.category}` : ""}
                  </p>
                  {b.deletion && (
                    <span className="mt-1 inline-block">
                      <Badge tone="danger">Dihapus {formatDate(b.deletion.purge_after)}</Badge>
                    </span>
                  )}
                </td>
                <td className={`${tdClass} hidden max-w-[240px] lg:table-cell`}>
                  {b.owner ? (
                    <>
                      <p className="truncate text-text-heading">{b.owner.name}</p>
                      <p className="truncate text-[13px] text-text-muted">{b.owner.email}</p>
                    </>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className={`${tdClass} text-right tabular-nums`}>
                  {b.devices_count}
                  <span className="block text-[12px] text-text-muted">{b.outlets_count} outlet</span>
                </td>
                <td className={`${tdClass} whitespace-nowrap text-text-body`}>
                  <ActivityDot at={b.last_active_at} />
                </td>
                <td className={`${tdClass} hidden whitespace-nowrap text-text-body xl:table-cell`}>{formatDate(b.created_at)}</td>
                <td className={tdClass}>
                  <FeatureBadges b={b} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Daftar — HP */}
      <ul className="divide-y divide-border-subtle md:hidden">
        {items.map((b) => (
          <li key={b.id}>
            <Link href={`/admin/bisnis/${encodeURIComponent(b.id)}`} className={`flex items-center gap-3 px-4 py-3 active:bg-bg-muted ${focusRing}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-text-heading">{b.name}</p>
                <p className="flex items-center gap-1 truncate text-[13px] text-text-muted">
                  {labelOf(BUSINESS_TYPES, b.type)} · {b.devices_count} perangkat · <ActivityDot at={b.last_active_at} />
                </p>
                {(b.features.self_order || b.features.online_payment || b.deletion) && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    <FeatureBadges b={b} />
                    {b.deletion && <Badge tone="danger">Dihapus {formatDate(b.deletion.purge_after)}</Badge>}
                  </div>
                )}
              </div>
              <ChevronRight size={18} aria-hidden className="shrink-0 text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Titik status aktivitas: hijau ≤ 7 hari, kuning ≤ 30 hari, abu-abu lainnya. */
export function ActivityDot({ at }: { at: string | null }) {
  const [now] = React.useState(() => Date.now());
  const age = at ? now - Date.parse(at) : Infinity;
  const color = age <= 7 * 86_400_000 ? "bg-success" : age <= 30 * 86_400_000 ? "bg-[#e0a43a]" : "bg-border-active";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${color}`} />
      <TimeAgo value={at} />
    </span>
  );
}
