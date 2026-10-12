"use client";

import React, { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AuditEntry, Paged } from "@/lib/admin/types";
import { AUDIT_ACTIONS, labelOf, LOGIN_FAIL_REASONS, TARGET_TYPES } from "./labels";
import {
  Badge,
  btn,
  ErrorBlock,
  focusRing,
  formatDateTime,
  inputClass,
  LoadingBlock,
  PageHeader,
  Pagination,
  useLoad,
} from "./ui";

const PER_PAGE = 50;

const selectClass = `${inputClass} appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9 bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237d8986' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")]`;

function actionTone(action: string): "neutral" | "brand" | "success" | "warning" | "danger" {
  if (action === "auth.login_failed" || action === "release.delete" || action === "admin.disable") return "danger";
  if (action.startsWith("auth.")) return "neutral";
  if (action === "release.upload") return "success";
  if (action.startsWith("admin.")) return "warning";
  return "brand";
}

export function AuditView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const action = params.get("action") ?? "";
  const targetType = params.get("target_type") ?? "";
  const targetId = params.get("target_id") ?? "";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [idInput, setIdInput] = useState(targetId);

  const navigate = (patch: Record<string, string>) => {
    const sp = new URLSearchParams({ action, target_type: targetType, target_id: targetId, page: "1", ...patch });
    for (const [k, v] of [...sp.entries()]) if (!v || (k === "page" && v === "1")) sp.delete(k);
    const s = sp.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };

  const { state, reload } = useLoad<Paged<AuditEntry>>(
    async (signal) =>
      (await adminApi()).audit(
        { page, per_page: PER_PAGE, action: action || undefined, target_type: targetType || undefined, target_id: targetId || undefined },
        signal
      ),
    [action, targetType, targetId, page]
  );

  const filtered = action || targetType || targetId;

  return (
    <>
      <PageHeader title="Audit" description="Catatan semua tindakan admin dan CLI. Tidak bisa diubah atau dihapus." />

      <form
        className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[200px_180px_minmax(0,1fr)_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          navigate({ target_id: idInput.trim() });
        }}
      >
        <div>
          <label htmlFor="f-action" className="mb-1.5 block text-[13px] font-semibold">
            Aksi
          </label>
          <select id="f-action" className={selectClass} value={action} onChange={(e) => navigate({ action: e.target.value })}>
            <option value="">Semua aksi</option>
            {Object.entries(AUDIT_ACTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-type" className="mb-1.5 block text-[13px] font-semibold">
            Jenis target
          </label>
          <select id="f-type" className={selectClass} value={targetType} onChange={(e) => navigate({ target_type: e.target.value })}>
            <option value="">Semua</option>
            {Object.entries(TARGET_TYPES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="f-target" className="mb-1.5 block text-[13px] font-semibold">
            ID target
          </label>
          <input
            id="f-target"
            className={inputClass}
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            placeholder="ID bisnis, nama berkas APK, …"
            spellCheck={false}
          />
        </div>
        <div className="flex gap-2">
          <button type="submit" className={btn.secondary}>
            Terapkan
          </button>
          {filtered && (
            <button
              type="button"
              className={btn.ghost}
              onClick={() => {
                setIdInput("");
                router.replace(pathname, { scroll: false });
              }}
            >
              Reset
            </button>
          )}
        </div>
      </form>

      {state.status === "error" && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <LoadingBlock />}
      {state.data && (
        <div className={`rounded-[14px] border border-border-subtle bg-white ${state.status === "loading" ? "opacity-60" : ""}`} aria-busy={state.status === "loading"}>
          {state.data.items.length === 0 ? (
            <p className="px-5 py-10 text-center text-[14px] text-text-muted">Tidak ada catatan{filtered ? " yang cocok dengan filter" : ""}.</p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {state.data.items.map((e) => (
                <AuditRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
          <div className="border-t border-border-subtle px-4 py-2 sm:px-5">
            <Pagination
              page={state.data.meta.page}
              perPage={state.data.meta.per_page}
              total={state.data.meta.total}
              onPage={(p) => navigate({ page: String(p) })}
            />
          </div>
        </div>
      )}
    </>
  );
}

function AuditRow({ entry: e }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const detail = e.detail && Object.keys(e.detail).length > 0 ? e.detail : null;
  const reason = e.action === "auth.login_failed" && typeof e.detail?.reason === "string" ? labelOf(LOGIN_FAIL_REASONS, e.detail.reason) : null;
  const via = e.detail?.via === "cli";

  return (
    <li className="px-4 py-2.5 sm:px-5">
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-[14px] md:grid-cols-[150px_170px_minmax(0,1fr)_auto] md:items-center">
        <time dateTime={e.created_at} className="text-[13px] tabular-nums text-text-muted">
          {formatDateTime(e.created_at)}
        </time>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={actionTone(e.action)}>{labelOf(AUDIT_ACTIONS, e.action)}</Badge>
          {reason && <span className="text-[12px] text-text-muted">{reason}</span>}
        </span>
        <span className="min-w-0">
          <span className="text-text-muted">{labelOf(TARGET_TYPES, e.target_type)} </span>
          <span className="break-all font-mono text-[12.5px] text-text-body">{e.target_id || "—"}</span>
          <span className="block text-[13px] text-text-muted">
            oleh {e.admin ? `${e.admin.name} (${e.admin.email})` : "sistem"}
            {via ? " · lewat CLI" : ""}
          </span>
        </span>
        {detail ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className={`inline-flex items-center gap-1 justify-self-start rounded-[8px] px-2 py-1 text-[13px] font-semibold text-text-body hover:bg-bg-muted md:justify-self-end ${focusRing}`}
          >
            Detail <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        ) : (
          <span />
        )}
      </div>
      {open && detail && (
        <pre className="mt-2 overflow-x-auto rounded-[10px] bg-bg-muted p-3 font-mono text-[12px] leading-relaxed text-text-body">
          {JSON.stringify(detail, null, 2)}
        </pre>
      )}
    </li>
  );
}
