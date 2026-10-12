"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, Search, X } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { BusinessSummary, Paged } from "@/lib/admin/types";
import { BUSINESS_TYPES, labelOf, PROVIDERS } from "./labels";
import {
  Badge,
  ErrorBlock,
  focusRing,
  formatDate,
  formatDateTime,
  formatRelative,
  iconBtn,
  inputClass,
  LoadingBlock,
  PageHeader,
  Pagination,
  useLoad,
} from "./ui";

const PER_PAGE = 20;

export function BusinessListView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [input, setInput] = useState(q);

  // Kata kunci & halaman disimpan di URL agar tombol kembali dari detail tetap di posisi yang sama.
  const navigate = (nextQ: string, nextPage: number) => {
    const sp = new URLSearchParams();
    if (nextQ) sp.set("q", nextQ);
    if (nextPage > 1) sp.set("page", String(nextPage));
    const s = sp.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  // Cari otomatis 350 ms setelah berhenti mengetik.
  useEffect(() => {
    const value = input.trim();
    if (value === q) return;
    const t = setTimeout(() => navigate(value, 1), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hanya bereaksi pada ketikan.
  }, [input]);

  const { state, reload } = useLoad<Paged<BusinessSummary>>(
    async (signal) => (await adminApi()).businesses({ q: q || undefined, page, per_page: PER_PAGE }, signal),
    [q, page]
  );

  return (
    <>
      <PageHeader title="Bisnis" description="Semua bisnis pengguna Sissi. Cari lewat nama bisnis, nama/email/HP pemilik, atau ID." />

      <form
        role="search"
        className="mb-4"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(input.trim(), 1);
        }}
      >
        <label htmlFor="biz-q" className="sr-only">
          Cari bisnis
        </label>
        <div className="relative max-w-[480px]">
          <Search size={17} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
          <input
            id="biz-q"
            type="search"
            className={`${inputClass} pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden`}
            placeholder="Nama bisnis, pemilik, email, HP, atau ID"
            value={input}
            maxLength={100}
            onChange={(e) => setInput(e.target.value)}
          />
          {input && (
            <button
              type="button"
              className={`${iconBtn} absolute top-1/2 right-0.5 h-8 w-8 -translate-y-1/2`}
              onClick={() => {
                setInput("");
                navigate("", 1);
              }}
              aria-label="Hapus pencarian"
            >
              <X size={16} aria-hidden />
            </button>
          )}
        </div>
      </form>

      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <LoadingBlock />}
      {state.data && (
        <div className={`rounded-[14px] border border-border-subtle bg-white ${state.status === "loading" ? "opacity-60" : ""}`} aria-busy={state.status === "loading"}>
          {state.data.items.length === 0 ? (
            <p className="px-5 py-10 text-center text-[14px] text-text-muted">
              {q ? `Tidak ada bisnis yang cocok dengan “${q}”.` : "Belum ada bisnis."}
            </p>
          ) : (
            <BusinessTable items={state.data.items} />
          )}
          <div className="border-t border-border-subtle px-4 py-2 sm:px-5">
            <Pagination
              page={state.data.meta.page}
              perPage={state.data.meta.per_page}
              total={state.data.meta.total}
              onPage={(p) => navigate(q, p)}
            />
          </div>
        </div>
      )}
    </>
  );
}

export function FeatureBadges({ b }: { b: BusinessSummary }) {
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

function BusinessTable({ items }: { items: BusinessSummary[] }) {
  const th = "px-3 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide text-text-muted first:pl-5 last:pr-5";
  const td = "px-3 py-3 align-top first:pl-5 last:pr-5";
  return (
    <>
      {/* Tabel — layar lebar */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-[14px]">
          <thead className="border-b border-border-subtle">
            <tr>
              <th scope="col" className={th}>Bisnis</th>
              <th scope="col" className={th}>Pemilik</th>
              <th scope="col" className={`${th} text-right`}>Outlet</th>
              <th scope="col" className={`${th} text-right`}>Perangkat</th>
              <th scope="col" className={th}>Aktif terakhir</th>
              <th scope="col" className={th}>Fitur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {items.map((b) => (
              <tr key={b.id} className="group relative hover:bg-bg-muted/60">
                <td className={td}>
                  <Link
                    href={`/admin/bisnis/${encodeURIComponent(b.id)}`}
                    className={`font-semibold text-text-heading after:absolute after:inset-0 group-hover:text-brand-ink ${focusRing}`}
                  >
                    {b.name}
                  </Link>
                  <p className="mt-0.5 text-[13px] text-text-muted">
                    {labelOf(BUSINESS_TYPES, b.type)}
                    {b.category ? ` · ${b.category}` : ""}
                  </p>
                  {b.deletion && (
                    <span className="mt-1 inline-block">
                      <Badge tone="danger">Dihapus {formatDate(b.deletion.purge_after)}</Badge>
                    </span>
                  )}
                </td>
                <td className={`${td} max-w-[260px]`}>
                  {b.owner ? (
                    <>
                      <p className="truncate text-text-heading">{b.owner.name}</p>
                      <p className="truncate text-[13px] text-text-muted">{b.owner.email}</p>
                    </>
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className={`${td} text-right tabular-nums`}>{b.outlets_count}</td>
                <td className={`${td} text-right tabular-nums`}>{b.devices_count}</td>
                <td className={`${td} whitespace-nowrap`}>
                  <span title={formatDateTime(b.last_active_at)} className={b.last_active_at ? "text-text-body" : "text-text-muted"}>
                    {formatRelative(b.last_active_at)}
                  </span>
                </td>
                <td className={td}>
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
            <Link
              href={`/admin/bisnis/${encodeURIComponent(b.id)}`}
              className={`flex items-center gap-3 px-4 py-3 active:bg-bg-muted ${focusRing}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-text-heading">{b.name}</p>
                <p className="truncate text-[13px] text-text-muted">
                  {b.owner?.email ?? "Tanpa pemilik"} · {formatRelative(b.last_active_at)}
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
