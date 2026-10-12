"use client";

import React from "react";
import type { AdminSubscription, SubscriptionStatus } from "@/lib/admin/types";
import { labelOf, SUB_STATUS } from "./labels";
import { Badge, formatDate } from "./ui";

// Potongan UI langganan yang dipakai daftar, detail bisnis, metrik, dan ringkasan.

/** Warna paket (urutan tetap; tervalidasi CVD): Pro, Uji coba, Tenggang, Gratis. */
export const PLAN_COLORS = { active: "#1f7a57", trial: "#f1702c", grace: "#a1344e", free: "#97a29e" } as const;

const STATUS_TONE: Record<SubscriptionStatus, "success" | "brand" | "danger" | "neutral"> = {
  active: "success",
  trial: "brand",
  grace: "danger",
  free: "neutral",
};

export function StatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{labelOf(SUB_STATUS, status)}</Badge>;
}

/** Sisa hari berwarna: ≤ 3 merah, ≤ 7 kuning, selebihnya netral; masa tenggang selalu merah. */
export function DaysLeft({ s, compact = false }: { s: Pick<AdminSubscription, "status" | "days_left" | "ends_at">; compact?: boolean }) {
  if (s.status === "free" || s.days_left === null || !s.ends_at) {
    return <span className="text-[13px] text-text-muted">—</span>;
  }
  const d = s.days_left;
  const tone =
    s.status === "grace" || d <= 3 ? "bg-danger-tint text-danger" : d <= 7 ? "bg-warning-tint text-warning" : "bg-bg-muted text-text-body";
  const text = d === 0 ? "hari ini" : `${d} hari`;
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className={`inline-flex items-baseline gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[12.5px] font-semibold tabular-nums ${tone}`}>
        {s.status === "grace" ? `tenggang · ${text}` : d === 0 ? "berakhir hari ini" : `${text} lagi`}
      </span>
      {!compact && <span className="text-[12px] text-text-muted">{formatDate(s.ends_at)}</span>}
    </span>
  );
}

/** Pemakaian transaksi bulan ini: batang terhadap batas (Gratis) atau angka saja (Pro tanpa batas). */
export function UsageMeter({ s, wide = false }: { s: AdminSubscription; wide?: boolean }) {
  const used = s.usage.tx_this_month;
  const limit = s.limits.tx_per_month;
  if (limit === null) {
    return (
      <span className="text-[13px] text-text-body">
        <strong className="font-semibold tabular-nums text-text-heading">{used.toLocaleString("id-ID")}</strong> transaksi
        {wide && <span className="text-text-muted"> · tanpa batas</span>}
      </span>
    );
  }
  const ratio = used / limit;
  const color = ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-[#e0a43a]" : "bg-brand-primary";
  return (
    <span className={`flex flex-col gap-1 ${wide ? "w-full" : "w-[120px]"}`}>
      <span className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className={`font-semibold tabular-nums ${ratio >= 1 ? "text-danger" : "text-text-heading"}`}>
          {used.toLocaleString("id-ID")}
          <span className="font-normal text-text-muted"> / {limit.toLocaleString("id-ID")}</span>
        </span>
        {ratio >= 1 && <span className="text-[12px] font-semibold text-danger">lewat batas</span>}
      </span>
      <span
        role="meter"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={Math.min(used, limit)}
        aria-label={`Transaksi bulan ini ${used} dari ${limit}`}
        className="block h-2 w-full overflow-hidden rounded-full bg-bg-muted"
      >
        <span className={`block h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(used > 0 ? 3 : 0, ratio * 100))}%` }} />
      </span>
    </span>
  );
}
