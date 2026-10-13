"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronRight, Wallet } from "lucide-react";
import { ApiError } from "@/lib/sissiApi";
import { FilterBar, FilterSelect } from "@/components/admin/FilterMenu";
import {
  Badge,
  cardClass,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatDateTime,
  formatRupiah,
  LoadingBar,
  Notice,
  PageHeader,
  Pagination,
  Section,
  SkeletonList,
  StatCard,
  tdClass,
  thClass,
  useLoad,
} from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import type { ShiftDetail, ShiftListItem, ShiftsPage } from "@/lib/owner/types";
import { labelOf, METHODS } from "./labels";
import { useOwner } from "./OwnerShell";
import { formatStamp } from "./parts";
import { BackLink } from "./SaleDetailView";
import { formatTime, PeriodFilter, SyncNote, usePeriod } from "./ui";

// Shift & kas (GET /owner/shifts, /owner/shifts/{id}). Selisih kas: merah bila kurang, kuning bila lebih.

const PER_PAGE = 25;

export function DifferenceValue({ value }: { value: number | null }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  if (value === 0) return <span className="font-semibold text-success">Pas</span>;
  const short = value < 0;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums whitespace-nowrap ${short ? "bg-danger-tint text-danger" : "bg-warning-tint text-warning"}`}>
      {short ? "Kurang " : "Lebih "}
      {formatRupiah(Math.abs(value))}
    </span>
  );
}

function ShiftStatus({ s }: { s: Pick<ShiftListItem, "status"> }) {
  return s.status === "open" ? <Badge tone="brand">Buka</Badge> : <Badge>Tutup</Badge>;
}

export function ShiftsView() {
  const { outletId, session, withOutlet } = useOwner();
  const period = usePeriod("7d");
  const { from, to, preset, qs } = period;
  const status = (["open", "closed"].includes(qs.get("status")) ? qs.get("status") : "") as "" | "open" | "closed";
  const page = Math.max(1, Number(qs.get("page")) || 1);
  const { state, reload } = useLoad<ShiftsPage>(
    async (signal) => (await ownerApi()).shifts({ from, to, outlet_id: outletId, status, page, per_page: PER_PAGE }, signal),
    [from, to, outletId, status, page]
  );
  const data = state.data;
  const showOutlet = !outletId && session.outlets.length > 1;

  return (
    <>
      <PageHeader title="Shift & kas" description="Buka-tutup kasir, kas di laci, dan selisihnya. Periode menurut waktu shift dibuka." />
      <FilterBar>
        <PeriodFilter from={from} to={to} preset={preset} onChange={period.setPeriod} />
        <FilterSelect
          label="Status"
          options={[
            { value: "open", label: "Buka" },
            { value: "closed", label: "Tutup" },
          ]}
          selected={status ? [status] : []}
          onChange={(n) => qs.update({ status: n[0] ?? null })}
        />
      </FilterBar>

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!data && state.status === "loading" && <SkeletonList rows={8} label="Memuat shift" />}
      {data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <section className={`${cardClass} overflow-hidden`} aria-busy={state.status === "loading"}>
            {data.items.length === 0 ? (
              <EmptyState icon={<Wallet size={22} aria-hidden />} title="Belum ada shift">
                {status ? "Tidak ada shift dengan status ini pada periode terpilih." : "Shift muncul setelah kasir membuka shift di aplikasi dan perangkat sinkron."}
              </EmptyState>
            ) : (
              <div className={`overflow-x-auto transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`}>
                <table className="w-full min-w-[340px] border-separate border-spacing-0 text-[14px]">
                  <thead>
                    <tr>
                      <th scope="col" className={thClass}>Shift</th>
                      <th scope="col" className={`${thClass} hidden md:table-cell`}>Status</th>
                      <th scope="col" className={`${thClass} hidden text-right lg:table-cell`}>Kas awal</th>
                      <th scope="col" className={`${thClass} hidden text-right sm:table-cell`}>Seharusnya</th>
                      <th scope="col" className={`${thClass} hidden text-right sm:table-cell`}>Aktual</th>
                      <th scope="col" className={`${thClass} text-right`}>Selisih</th>
                      <th scope="col" className={`${thClass} w-8`}>
                        <span className="sr-only">Detail</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((s) => (
                      <tr key={s.id} className="group relative hover:bg-bg-muted/60">
                        <td className={`${tdClass} border-b border-border-subtle`}>
                          <Link href={withOutlet(`/dasbor/shift/${s.id}`)} className={`block rounded after:absolute after:inset-0 ${focusRing}`}>
                            <span className="block font-semibold">{s.cashier_name}</span>
                            <span className="block text-[12.5px] tabular-nums text-text-muted">
                              {formatStamp(s.opened_at)} – {s.closed_at ? formatTime(s.closed_at) : "sekarang"}
                            </span>
                            <span className="block text-[12px] text-text-muted">
                              {[showOutlet ? s.outlet_name : null, s.device_name, `${s.sales_count.toLocaleString("id-ID")} trx · ${formatRupiah(s.sales_total)}`].filter(Boolean).join(" · ")}
                            </span>
                            <span className="mt-1 block md:hidden">
                              <ShiftStatus s={s} />
                            </span>
                          </Link>
                        </td>
                        <td className={`${tdClass} hidden border-b border-border-subtle md:table-cell`}>
                          <ShiftStatus s={s} />
                        </td>
                        <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums whitespace-nowrap lg:table-cell`}>{formatRupiah(s.opening_cash)}</td>
                        <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums whitespace-nowrap sm:table-cell`}>{formatRupiah(s.expected_cash)}</td>
                        <td className={`${tdClass} hidden border-b border-border-subtle text-right tabular-nums whitespace-nowrap sm:table-cell`}>
                          {s.closing_cash === null ? <span className="text-text-muted">—</span> : formatRupiah(s.closing_cash)}
                        </td>
                        <td className={`${tdClass} border-b border-border-subtle text-right`}>
                          <DifferenceValue value={s.difference} />
                        </td>
                        <td className={`${tdClass} border-b border-border-subtle text-text-muted`}>
                          <ChevronRight size={16} aria-hidden className="group-hover:text-text-heading" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

export function ShiftDetailView() {
  const { id } = useParams<{ id: string }>();
  const { withOutlet } = useOwner();
  const { state, reload } = useLoad<ShiftDetail>(async (signal) => (await ownerApi()).shift(id, signal), [id]);
  const s = state.data;
  const back = <BackLink href={withOutlet("/dasbor/shift")} label="Shift & kas" />;

  if (state.status === "error" && state.error instanceof ApiError && state.error.code === "NOT_FOUND") {
    return (
      <>
        <PageHeader title="Shift tidak ditemukan" back={back} />
        <section className={cardClass}>
          <EmptyState icon={<Wallet size={22} aria-hidden />} title="Shift tidak ada">
            Mungkin tautannya salah, atau shift milik usaha lain.
          </EmptyState>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={s ? `Shift ${s.cashier_name}` : "Detail shift"}
        back={back}
        description={s ? `${s.outlet_name}${s.device_name ? ` · ${s.device_name}` : ""} · ${formatDateTime(s.opened_at)} – ${s.closed_at ? formatDateTime(s.closed_at) : "masih buka"}` : undefined}
        actions={s && <ShiftStatus s={s} />}
      />
      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {!s && state.status === "loading" && <SkeletonList rows={6} label="Memuat shift" />}
      {s && <ShiftBody s={s} />}
    </>
  );
}

function ShiftBody({ s }: { s: ShiftDetail }) {
  const diffTone = s.difference === null || s.difference === 0 ? "neutral" : s.difference < 0 ? "danger" : "warning";
  return (
    <div className="flex flex-col gap-5">
      {s.status === "open" && (
        <Notice tone="info" title="Shift masih buka">
          Kas seharusnya dihitung dari kas awal + pembayaran tunai + kas masuk − kas keluar sejauh yang sudah sinkron.
        </Notice>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Kas awal" value={formatRupiah(s.opening_cash)} />
        <StatCard label="Kas seharusnya" value={formatRupiah(s.expected_cash)} />
        <StatCard label="Kas aktual (dihitung)" value={s.closing_cash === null ? "—" : formatRupiah(s.closing_cash)} hint={s.closed_at ? `Ditutup ${formatTime(s.closed_at)}` : "Belum ditutup"} />
        <StatCard
          label="Selisih"
          tone={diffTone}
          value={s.difference === null ? "—" : s.difference === 0 ? "Pas" : `${s.difference < 0 ? "-" : "+"}${formatRupiah(Math.abs(s.difference))}`}
          hint={s.difference === null ? "Muncul setelah shift ditutup" : s.difference < 0 ? "Uang di laci kurang" : s.difference > 0 ? "Uang di laci lebih" : "Sesuai"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Penjualan shift">
          <dl className="divide-y divide-border-subtle text-[14px]">
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-text-body">Transaksi</dt>
              <dd className="font-semibold tabular-nums">{s.sales_count.toLocaleString("id-ID")}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-text-body">Omzet</dt>
              <dd className="font-semibold tabular-nums">{formatRupiah(s.sales_total)}</dd>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <dt className="text-text-body">Dibatalkan</dt>
              <dd className={`tabular-nums ${s.cancelled.count ? "text-danger" : "text-text-muted"}`}>
                {s.cancelled.count.toLocaleString("id-ID")} · {formatRupiah(s.cancelled.amount)}
              </dd>
            </div>
          </dl>
          <h3 className="mt-4 mb-1 text-[13px] font-semibold uppercase tracking-wide text-text-muted">Per metode bayar</h3>
          {s.per_method.length === 0 ? (
            <p className="text-[14px] text-text-muted">Belum ada pembayaran.</p>
          ) : (
            <dl className="divide-y divide-border-subtle text-[14px]">
              {s.per_method.map((m) => (
                <div key={m.method} className="flex justify-between gap-4 py-2">
                  <dt className="text-text-body">{labelOf(METHODS, m.method)}</dt>
                  <dd className={`font-semibold tabular-nums ${m.amount < 0 ? "text-danger" : ""}`}>{formatRupiah(m.amount)}</dd>
                </div>
              ))}
            </dl>
          )}
        </Section>

        <Section title="Kas masuk & keluar" description={`Masuk ${formatRupiah(s.cash_in)} · keluar ${formatRupiah(s.cash_out)}`} bodyClass="p-0">
          {s.cash_movements.length === 0 ? (
            <p className="px-4 py-5 text-[14px] text-text-muted sm:px-5">Tidak ada kas masuk/keluar selama shift ini.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {s.cash_movements.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{m.reason || (m.type === "in" ? "Kas masuk" : "Kas keluar")}</span>
                    <span className="block text-[12.5px] text-text-muted">
                      {formatTime(m.created_at)}
                      {m.cashier_name ? ` · ${m.cashier_name}` : ""}
                    </span>
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${m.type === "in" ? "text-success" : "text-danger"}`}>
                    {m.type === "in" ? "+" : "-"}
                    {formatRupiah(m.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {s.notes && (
        <Section title="Catatan penutupan">
          <p className="text-[14px] text-text-body">{s.notes}</p>
        </Section>
      )}
    </div>
  );
}
