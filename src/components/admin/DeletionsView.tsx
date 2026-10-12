"use client";

import React from "react";
import Link from "next/link";
import { Info, SearchX, ShieldCheck } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AccountDeletion, DeletionFacets, DeletionStatus, Paged } from "@/lib/admin/types";
import { SearchBox, useQueryState } from "./filters";
import { DELETION_STATUS, labelOf } from "./labels";
import {
  Badge,
  btn,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatDate,
  formatDateTime,
  LoadingBar,
  Notice,
  PageHeader,
  Pagination,
  SkeletonList,
  SortTh,
  Tabs,
  tdClass,
  thClass,
  useLoad,
} from "./ui";

// Antrean hapus akun (tahap 2) — HANYA BACA. Pembatalan sah hanya oleh pemilik terautentikasi (OTP email).

const PER_PAGE = 25;
type StatusTab = DeletionStatus | "all";

function Countdown({ d }: { d: AccountDeletion }) {
  if (d.status !== "scheduled" || d.days_left === null) {
    return <span className="text-text-muted">{formatDate(d.purged_at ?? d.purge_after)}</span>;
  }
  const urgent = d.days_left <= 7;
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span
        className={`inline-flex items-baseline gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${
          urgent ? "bg-danger-tint text-danger" : "bg-warning-tint text-warning"
        }`}
      >
        <span className="text-[15px] font-bold tabular-nums">{d.days_left}</span> {d.days_left === 0 ? "hari ini" : "hari lagi"}
      </span>
      <span className="text-[12px] text-text-muted" title={formatDateTime(d.purge_after)}>
        {formatDate(d.purge_after)}
      </span>
    </span>
  );
}

function statusTone(s: DeletionStatus) {
  return s === "scheduled" ? "warning" : s === "purged" ? "neutral" : "success";
}

export function DeletionsView() {
  const qs = useQueryState();
  const status = (qs.get("status") || "scheduled") as StatusTab;
  const q = qs.get("q");
  const defaultSort = status === "scheduled" ? "purge_after" : "requested_at";
  const sort = qs.get("sort") || defaultSort;
  const defaultOrder = sort === "purge_after" ? "asc" : "desc";
  const order = (qs.get("order") || defaultOrder) as "asc" | "desc";
  const page = Math.max(1, Number(qs.get("page")) || 1);

  const { state, reload } = useLoad<Paged<AccountDeletion, DeletionFacets>>(
    async (signal) =>
      (await adminApi()).accountDeletions(
        {
          status: status === "scheduled" ? undefined : status,
          q: q || undefined,
          sort: qs.get("sort") || undefined,
          order: qs.get("order") || undefined,
          page,
          per_page: PER_PAGE,
        },
        signal
      ),
    [status, q, sort, order, page]
  );
  const facets = state.data?.facets?.status;

  const onSort = (field: string) => {
    const fieldDefault = field === "purge_after" ? "asc" : "desc";
    const next = field === sort ? (order === "asc" ? "desc" : "asc") : fieldDefault;
    qs.update({ sort: field === defaultSort ? null : field, order: next === fieldDefault ? null : next });
  };

  return (
    <>
      <PageHeader
        title="Antrean hapus akun"
        description="Permintaan hapus akun dari pemilik bisnis. Data dihapus permanen otomatis saat tanggalnya tiba."
      />

      <div className="mb-4">
        <Notice tone="info" icon={<Info size={16} aria-hidden />}>
          Halaman ini hanya baca. Bila pemilik ingin membatalkan, arahkan ke tombol <strong>Batalkan penghapusan</strong> di
          aplikasi atau web — pembatalan butuh verifikasi email pemilik, bukan permintaan lewat chat/telepon.
        </Notice>
      </div>

      <Tabs<StatusTab>
        label="Status"
        active={status}
        onChange={(s) => qs.update({ status: s === "scheduled" ? null : s, sort: null, order: null })}
        tabs={[
          { id: "scheduled", label: "Terjadwal", count: facets?.scheduled },
          { id: "canceled", label: "Dibatalkan", count: facets?.canceled },
          { id: "purged", label: "Sudah dihapus", count: facets?.purged },
          { id: "all", label: "Semua" },
        ]}
      />

      <SearchBox
        id="del-q"
        label="Cari antrean hapus akun"
        className="mb-3 sm:max-w-[440px]"
        value={q}
        onSearch={(v) => qs.update({ q: v }, "replace")}
        placeholder="Nama bisnis, email pemilik, atau ID bisnis"
      />

      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <SkeletonList rows={5} label="Memuat antrean" />}
      {state.data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div
            className={`rounded-[14px] border border-border-subtle bg-white transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`}
            aria-busy={state.status === "loading"}
          >
            {state.data.items.length === 0 ? (
              q ? (
                <EmptyState
                  icon={<SearchX size={22} aria-hidden />}
                  title={`Tidak ada hasil untuk “${q}”`}
                  action={
                    <button type="button" className={btn.secondary} onClick={() => qs.update({ q: null })}>
                      Hapus pencarian
                    </button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<ShieldCheck size={22} aria-hidden />}
                  title={status === "scheduled" ? "Tidak ada penghapusan terjadwal" : `Tidak ada data ${labelOf(DELETION_STATUS, status).toLowerCase()}`}
                  action={
                    status === "scheduled" ? (
                      <button type="button" className={btn.secondary} onClick={() => qs.update({ status: "all" })}>
                        Lihat riwayat
                      </button>
                    ) : undefined
                  }
                >
                  {status === "scheduled" ? "Semua pemilik masih bersama Sissi." : undefined}
                </EmptyState>
              )
            ) : (
              <DeletionTable items={state.data.items} sort={sort} order={order} onSort={onSort} showStatus={status === "all"} />
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

function BusinessCell({ d }: { d: AccountDeletion }) {
  if (!d.business) return <span className="italic text-text-muted">Data sudah dihapus permanen</span>;
  return (
    <Link href={`/admin/bisnis/${encodeURIComponent(d.business.id)}?tab=hapus-akun`} className={`font-semibold text-text-heading hover:text-brand-ink ${focusRing}`}>
      {d.business.name}
    </Link>
  );
}

function DeletionTable({
  items,
  sort,
  order,
  onSort,
  showStatus,
}: {
  items: AccountDeletion[];
  sort: string;
  order: "asc" | "desc";
  onSort: (f: string) => void;
  showStatus: boolean;
}) {
  const sp = { sort, order, onSort };
  return (
    <>
      <table className="hidden w-full text-[14px] md:table">
        <thead>
          <tr>
            <th scope="col" className={thClass}>Bisnis</th>
            <th scope="col" className={thClass}>Pemilik</th>
            <SortTh label="Diminta" field="requested_at" {...sp} />
            <SortTh label="Hapus permanen" field="purge_after" {...sp} />
            <th scope="col" className={`${thClass} hidden lg:table-cell`}>Alasan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((d) => (
            <tr key={d.id}>
              <td className={`${tdClass} py-2.5`}>
                <BusinessCell d={d} />
                {showStatus && (
                  <span className="mt-0.5 block">
                    <Badge tone={statusTone(d.status)}>{labelOf(DELETION_STATUS, d.status)}</Badge>
                  </span>
                )}
              </td>
              <td className={`${tdClass} max-w-[240px]`}>
                {d.owner ? (
                  <>
                    <p className="truncate text-text-heading">{d.owner.name}</p>
                    <p className="truncate text-[13px] text-text-muted">{d.owner.email}</p>
                  </>
                ) : (
                  <span className="text-text-muted">—</span>
                )}
              </td>
              <td className={`${tdClass} whitespace-nowrap text-text-body`}>
                {formatDate(d.requested_at)}
                <span className="block text-[12px] text-text-muted">
                  lewat {d.source === "web" ? "web" : "aplikasi"}
                  {d.canceled_at ? ` · batal ${formatDate(d.canceled_at)}` : ""}
                </span>
              </td>
              <td className={tdClass}>
                <Countdown d={d} />
              </td>
              <td className={`${tdClass} hidden max-w-[260px] text-[13px] lg:table-cell`}>
                <span className={d.reason ? "line-clamp-2 text-text-body" : "text-text-muted"}>{d.reason || "—"}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-border-subtle md:hidden">
        {items.map((d) => (
          <li key={d.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <BusinessCell d={d} />
              <p className="truncate text-[13px] text-text-muted">{d.owner?.email ?? "—"}</p>
              <p className="text-[12px] text-text-muted">
                Diminta {formatDate(d.requested_at)} · {d.source === "web" ? "web" : "aplikasi"}
              </p>
              {showStatus && (
                <span className="mt-1 block">
                  <Badge tone={statusTone(d.status)}>{labelOf(DELETION_STATUS, d.status)}</Badge>
                </span>
              )}
            </div>
            <Countdown d={d} />
          </li>
        ))}
      </ul>
    </>
  );
}
