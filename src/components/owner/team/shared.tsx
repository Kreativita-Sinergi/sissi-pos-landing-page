"use client";

import React from "react";
import { Badge } from "@/components/admin/ui";
import { Select } from "@/components/owner/Select";
import {
  monthLabel,
  recentMonths,
  SLIP_STATUS_LABEL,
  STATUS_LABEL,
  type DayKind,
  type SlipStatus,
  type TeamData,
  type TeamOutcome,
} from "@/lib/owner/team";

// Potongan UI bersama halaman Tim.

export type TeamCtx = {
  data: TeamData;
  /** Gabungkan record hasil simpan (applied/conflict) ke data lokal. */
  merge: (entity: "employees" | "attendances" | "payslips", out: TeamOutcome) => void;
  reload: () => void;
  staff: boolean;
};

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

/** Warna status hari (`dayKindTone` app). */
export function dayTone(k: DayKind): Tone {
  if (k === "ontime") return "success";
  if (k === "late") return "warning";
  if (k === "absent") return "danger";
  if (k === "permit" || k === "sick" || k === "leave") return "brand";
  return "neutral";
}

export function DayBadge({ kind }: { kind: DayKind }) {
  if (kind === "upcoming") return null;
  return <Badge tone={dayTone(kind)}>{STATUS_LABEL[kind]}</Badge>;
}

export function slipTone(s: SlipStatus | null | undefined): Tone {
  return s === "paid" ? "success" : s === "issued" ? "brand" : "neutral";
}

export function SlipBadge({ status }: { status: SlipStatus | null | undefined }) {
  return <Badge tone={slipTone(status)}>{SLIP_STATUS_LABEL[status ?? "draft"]}</Badge>;
}

/** Lingkaran inisial nama (`EmployeeAvatar`). */
export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-tint font-bold text-brand-ink"
    >
      {initials}
    </span>
  );
}

/** Pilih bulan (12 bulan terakhir — `pickMonth` app). */
export function MonthSelect({ value, onChange, id }: { value: string; onChange: (m: string) => void; id?: string }) {
  const months = recentMonths();
  const options = (months.includes(value) ? months : [value, ...months]).map((m) => ({ value: m, label: monthLabel(m) }));
  return <Select id={id} aria-label="Pilih bulan" value={value} onChange={onChange} options={options} className="w-full sm:w-[200px]" />;
}
