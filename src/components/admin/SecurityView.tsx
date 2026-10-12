"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, SearchX, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { Paged, SecurityFlag, SecurityIP, SecurityReport, SecurityTarget } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { SearchBox, useQueryState } from "./filters";
import { ClearFiltersButton, compactRange, DateFilter, FilterBar, FilterSelect } from "./FilterMenu";
import {
  Badge,
  btn,
  cardClass,
  CopyButton,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatDateTime,
  LoadingBar,
  Notice,
  PageHeader,
  Pagination,
  Section,
  Skeleton,
  SkeletonList,
  StatCard,
  tdClass,
  thClass,
  useLoad,
} from "./ui";

// Laporan keamanan (secwatch): jendela 15 menit yang melewati ambang — sama dengan peringatan "Indikasi serangan"
// di grup. Hanya baca. Kontrak: sissi-service/docs/api.md "Admin platform — laporan keamanan".

const PER_PAGE = 25;

const FLAG_LABEL: Record<SecurityFlag | "distributed", string> = {
  auth_fail: "Gagal login/OTP",
  rate_limited: "Diblokir batas laju",
  bad_token: "Token tidak valid",
  not_found: "Pindai halaman",
  distributed: "Brute-force tersebar",
};

const FLAG_TONE: Record<SecurityFlag, "danger" | "warning" | "neutral"> = {
  auth_fail: "danger",
  rate_limited: "warning",
  bad_token: "warning",
  not_found: "neutral",
};

const timeFmt = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

function windowText(r: SecurityReport): string {
  return `${formatDateTime(r.window_start)} – ${timeFmt.format(new Date(r.window_end))}`;
}

/** Kategori unik seluruh laporan (urut paling berbahaya), plus "tersebar". */
function reportFlags(r: SecurityReport): (SecurityFlag | "distributed")[] {
  const order: SecurityFlag[] = ["auth_fail", "rate_limited", "bad_token", "not_found"];
  const seen = new Set(r.ips.flatMap((i) => i.flags));
  const out: (SecurityFlag | "distributed")[] = order.filter((f) => seen.has(f));
  if (r.distributed) out.unshift("distributed");
  return out;
}

function FlagBadge({ flag }: { flag: SecurityFlag | "distributed" }) {
  return <Badge tone={flag === "distributed" ? "danger" : FLAG_TONE[flag]}>{FLAG_LABEL[flag]}</Badge>;
}

function ipSummary(i: SecurityIP): string {
  const parts: string[] = [];
  if (i.auth_fail) parts.push(`${i.auth_fail} gagal login`);
  if (i.rate_limited) parts.push(`${i.rate_limited} diblokir`);
  if (i.bad_token) parts.push(`${i.bad_token} token`);
  if (i.not_found) parts.push(`${i.not_found} 404`);
  return parts.join(" · ");
}

export function SecurityListView() {
  const qs = useQueryState();
  const q = qs.get("q");
  const flag = qs.get("flag");
  const from = qs.get("from");
  const to = qs.get("to");
  const page = Math.max(1, Number(qs.get("page")) || 1);

  const { state, reload } = useLoad<Paged<SecurityReport>>(
    async (signal) =>
      (await adminApi()).securityReports(
        { q: q || undefined, flag: flag || undefined, from: from || undefined, to: to || undefined, page, per_page: PER_PAGE },
        signal
      ),
    [q, flag, from, to, page]
  );

  const hasFilters = !!(flag || from || to);
  const filtered = hasFilters || !!q;
  const clearAll = () => qs.clear([]);

  return (
    <>
      <PageHeader
        title="Keamanan"
        description="Indikasi serangan per 15 menit: gagal login/OTP berulang, kena batas laju, token tidak valid, dan pemindaian halaman. Sama dengan peringatan yang dikirim ke grup."
      />

      <FilterBar
        search={
          <SearchBox
            id="sec-q"
            label="Cari menurut alamat IP atau email/HP akun yang dicoba"
            className="w-full sm:w-[320px]"
            value={q}
            onSearch={(v) => qs.update({ q: v }, "replace")}
            placeholder="Cari IP atau email…"
          />
        }
        trailing={
          state.data && (
            <p className="text-[13px] text-text-muted" aria-live="polite">
              <strong className="font-semibold tabular-nums text-text-heading">{state.data.meta.total.toLocaleString("id-ID")}</strong> laporan
              {from || to ? ` · ${compactRange(from, to)}` : ""}
            </p>
          )
        }
      >
        <FilterSelect
          label="Jenis"
          options={(["auth_fail", "rate_limited", "bad_token", "not_found", "distributed"] as const).map((f) => ({
            value: f,
            label: FLAG_LABEL[f],
          }))}
          selected={flag ? [flag] : []}
          onChange={(n) => qs.update({ flag: n[0] ?? null })}
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
      {state.status === "loading" && !state.data && <SkeletonList rows={6} label="Memuat laporan keamanan" />}
      {state.data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div
            className={`${cardClass} transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`}
            aria-busy={state.status === "loading"}
          >
            {state.data.items.length === 0 ? (
              filtered ? (
                <EmptyState
                  icon={<SearchX size={22} aria-hidden />}
                  title={q ? `Tidak ada hasil untuk “${q}”` : "Tidak ada laporan yang cocok"}
                  action={
                    <button type="button" className={btn.secondary} onClick={clearAll}>
                      Hapus semua filter
                    </button>
                  }
                />
              ) : (
                <EmptyState icon={<ShieldCheck size={22} aria-hidden />} title="Belum ada indikasi serangan">
                  Laporan muncul di sini setiap kali ada IP yang melewati ambang dalam 15 menit.
                </EmptyState>
              )
            ) : (
              <ReportTable items={state.data.items} />
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

/** Ringkasan akun yang dicoba di baris daftar: target laporan (tersebar) atau IP teratas tidak membawa target. */
function TargetPreview({ r }: { r: SecurityReport }) {
  if (r.targets.length === 0) return <span className="text-text-muted">—</span>;
  const t = r.targets[0];
  return (
    <span className="block min-w-0">
      <span className="block truncate text-text-heading">{t.identifier}</span>
      <span className="text-[12px] text-text-muted">
        {t.count}× {r.targets.length > 1 ? `· +${r.targets.length - 1} akun` : ""}
      </span>
    </span>
  );
}

function ReportTable({ items }: { items: SecurityReport[] }) {
  return (
    <>
      <table className="hidden w-full table-fixed text-[14px] md:table">
        <thead>
          <tr>
            <th scope="col" className={`${thClass} w-[200px]`}>Waktu</th>
            <th scope="col" className={thClass}>IP mencurigakan</th>
            <th scope="col" className={`${thClass} w-[220px]`}>Jenis</th>
            <th scope="col" className={`${thClass} hidden w-[230px] lg:table-cell`}>Akun paling diincar</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {items.map((r) => (
            <tr key={r.id} className="group relative align-top hover:bg-bg-muted/60">
              <td className={`${tdClass} py-2.5`}>
                <Link
                  href={`/admin/keamanan/${r.id}`}
                  className={`block font-semibold text-text-heading after:absolute after:inset-0 group-hover:text-brand-ink ${focusRing}`}
                >
                  {formatDateTime(r.window_start)}
                </Link>
                <span className="text-[12px] text-text-muted">s.d. {timeFmt.format(new Date(r.window_end))} WIB</span>
              </td>
              <td className={`${tdClass} py-2.5`}>
                <ul className="flex min-w-0 flex-col gap-0.5">
                  {r.ips.slice(0, 3).map((i) => (
                    <li key={i.ip} className="flex min-w-0 items-baseline gap-2">
                      <span className="shrink-0 font-mono text-[13px] text-text-heading">{i.ip}</span>
                      <span className="truncate text-[12.5px] text-text-muted">{ipSummary(i)}</span>
                    </li>
                  ))}
                </ul>
                {r.ips_count > 3 && <span className="text-[12px] text-text-muted">+{r.ips_count - 3} IP lain</span>}
                {r.ips_count === 0 && <span className="text-[13px] text-text-muted">Tersebar dari banyak IP</span>}
              </td>
              <td className={`${tdClass} py-2.5`}>
                <span className="flex flex-wrap gap-1">
                  {reportFlags(r).map((f) => (
                    <FlagBadge key={f} flag={f} />
                  ))}
                </span>
              </td>
              <td className={`${tdClass} hidden py-2.5 lg:table-cell`}>
                <TargetPreview r={r} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="divide-y divide-border-subtle md:hidden">
        {items.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/keamanan/${r.id}`} className={`flex flex-col gap-1.5 px-4 py-3 active:bg-bg-muted ${focusRing}`}>
              <span className="text-[14px] font-semibold text-text-heading">{windowText(r)}</span>
              <span className="flex flex-wrap gap-1">
                {reportFlags(r).map((f) => (
                  <FlagBadge key={f} flag={f} />
                ))}
              </span>
              {r.ips[0] && (
                <span className="flex min-w-0 items-baseline gap-2 text-[13px]">
                  <span className="shrink-0 font-mono text-text-heading">{r.ips[0].ip}</span>
                  <span className="truncate text-text-muted">
                    {ipSummary(r.ips[0])}
                    {r.ips_count > 1 ? ` · +${r.ips_count - 1} IP` : ""}
                  </span>
                </span>
              )}
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
    href="/admin/keamanan"
    className={`mb-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-body hover:text-text-heading ${focusRing}`}
  >
    <ArrowLeft size={15} aria-hidden /> Semua laporan
  </Link>
);

export function SecurityDetailView() {
  const { id } = useParams<{ id: string }>();
  const { state, reload } = useLoad<SecurityReport>(async (signal) => (await adminApi()).securityReport(id, signal), [id]);

  if (!state.data) {
    return (
      <>
        <PageHeader title="Laporan keamanan" back={backLink} />
        {state.status === "error" ? (
          state.error instanceof ApiError && state.error.status === 404 ? (
            <EmptyState
              icon={<ShieldAlert size={22} aria-hidden />}
              title="Laporan tidak ditemukan"
              action={
                <Link href="/admin/keamanan" className={btn.secondary}>
                  Kembali ke daftar
                </Link>
              }
            />
          ) : (
            <ErrorBlock error={state.error} onRetry={reload} />
          )
        ) : (
          <div role="status" aria-label="Memuat laporan" className="flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`${cardClass} p-4`}>
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="mt-2.5 h-6 w-10" />
                </div>
              ))}
            </div>
            <div className={`${cardClass} p-5`}>
              <Skeleton className="h-[160px]" />
            </div>
          </div>
        )}
      </>
    );
  }

  const r = state.data;
  return (
    <>
      <PageHeader
        title="Laporan keamanan"
        back={backLink}
        description={`${windowText(r)} WIB`}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Gagal login/OTP" value={r.totals.auth_fail} tone={r.totals.auth_fail ? "danger" : "neutral"} />
        <StatCard label="Diblokir batas laju" value={r.totals.rate_limited} tone={r.totals.rate_limited ? "warning" : "neutral"} />
        <StatCard label="Token tidak valid" value={r.totals.bad_token} />
        <StatCard label="Halaman tidak ada (404)" value={r.totals.not_found} />
      </div>

      {(r.distributed || r.overflow > 0) && (
        <div className="mb-5 flex flex-col gap-2">
          {r.distributed && (
            <Notice tone="danger" icon={<TriangleAlert size={16} aria-hidden />} title="Kemungkinan brute-force tersebar">
              Gagal login dari banyak IP sekaligus melewati ambang. Periksa akun yang paling diincar di bawah.
            </Notice>
          )}
          {r.overflow > 0 && (
            <Notice tone="warning" icon={<TriangleAlert size={16} aria-hidden />}>
              {r.overflow.toLocaleString("id-ID")} permintaan datang dari IP di luar batas pelacakan — kemungkinan serangan dari
              banyak alamat.
            </Notice>
          )}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {r.targets.length > 0 && (
          <Section title="Akun paling diincar" description="Gagal login/OTP dari semua IP dalam jendela ini." bodyClass="">
            <TargetTable targets={r.targets} />
          </Section>
        )}
        <Section
          title={`IP mencurigakan (${r.ips.length})`}
          description="IP yang melewati ambang, paling berbahaya di atas."
          bodyClass="divide-y divide-border-subtle"
        >
          {r.ips.length === 0 ? (
            <p className="px-4 py-5 text-[14px] text-text-muted sm:px-5">Tidak ada satu IP yang melewati ambang sendiri.</p>
          ) : (
            r.ips.map((i) => <IPBlock key={i.ip} ip={i} />)
          )}
        </Section>
      </div>
    </>
  );
}

function IPBlock({ ip }: { ip: SecurityIP }) {
  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex items-center gap-1">
          <span className="font-mono text-[15px] font-semibold text-text-heading">{ip.ip}</span>
          <CopyButton value={ip.ip} label={`Salin IP ${ip.ip}`} />
        </span>
        <span className="flex flex-wrap gap-1">
          {ip.flags.map((f) => (
            <FlagBadge key={f} flag={f} />
          ))}
        </span>
        <span className="text-[13px] text-text-muted">{ipSummary(ip)}</span>
      </div>
      {ip.targets.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-[10px] border border-border-subtle">
          <p className="border-b border-border-subtle bg-bg-muted px-3 py-1.5 text-[12px] font-semibold text-text-body">Akun dicoba</p>
          <TargetTable targets={ip.targets} />
        </div>
      )}
      {ip.paths.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[12px] font-semibold text-text-body">Halaman yang dipindai</p>
          <ul className="flex flex-col gap-0.5">
            {ip.paths.map((p) => (
              <li key={p.path} className="flex min-w-0 items-baseline gap-2 text-[13px]">
                <span className="w-10 shrink-0 text-right tabular-nums text-text-muted">{p.count}×</span>
                <span className="min-w-0 break-all font-mono text-text-heading">{p.path}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function UserCell({ t }: { t: SecurityTarget }) {
  if (!t.user) return <span className="text-text-muted">Tidak terdaftar</span>;
  const u = t.user;
  return (
    <span className="flex min-w-0 flex-col">
      {u.business ? (
        <Link
          href={`/admin/bisnis/${encodeURIComponent(u.business.id)}`}
          className={`truncate font-semibold text-text-heading hover:text-brand-ink ${focusRing}`}
        >
          {u.name ?? "Tanpa nama"} · {u.business.name}
        </Link>
      ) : (
        <span className="truncate text-text-heading">{u.name ?? "User sudah dihapus"}</span>
      )}
      <span className="flex min-w-0 items-center gap-0.5">
        <span className="truncate font-mono text-[12px] text-text-muted" title={u.id}>
          {u.id}
        </span>
        <CopyButton value={u.id} label="Salin ID user" />
      </span>
    </span>
  );
}

function TargetTable({ targets }: { targets: SecurityTarget[] }) {
  return (
    <>
      <table className="hidden w-full table-fixed text-[14px] sm:table">
        <thead>
          <tr>
            <th scope="col" className={thClass}>Email / HP</th>
            <th scope="col" className={`${thClass} w-[90px] text-right`}>Percobaan</th>
            <th scope="col" className={`${thClass} w-[45%]`}>User</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-subtle">
          {targets.map((t) => (
            <tr key={t.identifier}>
              <td className={`${tdClass} py-2`}>
                <span className="block truncate text-text-heading" title={t.identifier}>
                  {t.identifier}
                </span>
              </td>
              <td className={`${tdClass} py-2 text-right tabular-nums text-text-body`}>{t.count}</td>
              <td className={`${tdClass} py-2`}>
                <UserCell t={t} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-border-subtle sm:hidden">
        {targets.map((t) => (
          <li key={t.identifier} className="flex flex-col gap-1 px-3 py-2.5">
            <span className="flex min-w-0 items-baseline justify-between gap-2">
              <span className="min-w-0 break-all text-[14px] text-text-heading">{t.identifier}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-text-muted">{t.count}×</span>
            </span>
            <span className="text-[13px]">
              <UserCell t={t} />
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
