"use client";

import React, { useMemo } from "react";
import { CalendarClock, ChevronRight } from "lucide-react";
import { Badge, EmptyState, focusRing, Section, TimeAgo } from "@/components/admin/ui";
import { Segmented } from "@/components/owner/editing";
import { byNewest, leaveDays, leaveRangeLabel, type LeaveKind, type LeaveRequest, type LeaveStatus } from "@/lib/owner/leavePlan";
import { Avatar, type TeamCtx } from "./shared";

// Pengajuan izin/sakit/cuti dari HP karyawan (cermin layar Tim › Pengajuan di app): saring Menunggu/Semua, kartu per
// pengajuan → dialog detail (setujui/tolak).

export const LEAVE_KIND_LABEL: Record<LeaveKind, string> = { permit: "Izin", sick: "Sakit", leave: "Cuti" };
export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  cancelled: "Dibatalkan",
};
const STATUS_TONE: Record<LeaveStatus, "warning" | "success" | "danger" | "neutral"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

export function LeaveStatusBadge({ status }: { status: LeaveStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{LEAVE_STATUS_LABEL[status]}</Badge>;
}

/** "20–21 Okt 2026 · 2 hari" (`leaveRangeDays`). */
export function leaveRangeText(r: LeaveRequest): string {
  return `${leaveRangeLabel(r.date_from, r.date_to)} · ${leaveDays(r.date_from, r.date_to).length} hari`;
}

export type LeaveFilter = "pending" | "all";

export function LeaveTab({
  ctx,
  filter,
  onFilter,
  onOpen,
}: {
  ctx: TeamCtx;
  filter: LeaveFilter;
  onFilter: (f: LeaveFilter) => void;
  onOpen: (id: string) => void;
}) {
  const names = useMemo(() => new Map(ctx.data.employees.map((e) => [e.id, e.name])), [ctx.data.employees]);
  const all = useMemo(() => [...ctx.data.leaves].sort(byNewest), [ctx.data.leaves]);
  const pending = all.filter((r) => r.status === "pending").length;
  const list = filter === "pending" ? all.filter((r) => r.status === "pending") : all;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented<LeaveFilter>
          label="Saring pengajuan"
          options={[
            { value: "pending", label: pending ? `Menunggu (${pending})` : "Menunggu" },
            { value: "all", label: "Semua" },
          ]}
          value={filter}
          onChange={onFilter}
        />
        <p className="text-[13px] text-text-muted">Disetujui = tanggalnya otomatis tercatat di Kehadiran.</p>
      </div>
      <Section bodyClass="">
        {list.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={22} aria-hidden />}
            title={filter === "pending" && all.length > 0 ? "Tidak ada pengajuan yang menunggu" : "Belum ada pengajuan"}
          >
            Pengajuan izin, sakit, atau cuti dari HP karyawan muncul di sini.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onOpen(r.id)}
                  className={`flex w-full min-w-0 items-start gap-3 px-4 py-3 text-left hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}
                >
                  <Avatar name={names.get(r.employee_id) ?? "?"} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate font-semibold text-text-heading">{names.get(r.employee_id) ?? "Karyawan terhapus"}</span>
                      <Badge tone="brand">{LEAVE_KIND_LABEL[r.kind]}</Badge>
                      <LeaveStatusBadge status={r.status} />
                    </span>
                    <span className="mt-0.5 block text-[13px] text-text-body tabular-nums">{leaveRangeText(r)}</span>
                    {r.reason.trim() && <span className="mt-0.5 line-clamp-2 text-[13.5px] break-words text-text-muted">{r.reason.trim()}</span>}
                    <span className="mt-1 block text-[12.5px] text-text-muted">
                      Diajukan <TimeAgo value={r.created_at} />
                    </span>
                  </span>
                  <ChevronRight size={16} aria-hidden className="mt-2.5 shrink-0 text-text-muted" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
