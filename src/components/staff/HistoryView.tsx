"use client";

import React, { useEffect, useState } from "react";
import { CalendarX2, MapPinOff } from "lucide-react";
import { Badge, focusRing, Notice } from "@/components/admin/ui";
import { viaSummary } from "@/lib/attendanceVia";
import { staffApi, StaffApiError } from "@/lib/staff/api";
import { dateParts, formatTime, monthLabel, monthOptions, STATUS_LABEL } from "@/lib/staff/clock";
import { clockErrorMessage } from "@/lib/staff/errors";
import type { StaffAttendance, StaffHistory } from "@/lib/staff/types";
import { useStaff } from "./StaffShell";

// Riwayat kehadiran (/karyawan/riwayat): pilih bulan (bulan ini + 12 sebelumnya), ringkasan, daftar per hari dengan
// label "via". Cermin Riwayat Kehadiran app. Tetap terbuka saat paket Gratis (baca saja).

type Loaded = { key: string; data?: StaffHistory; error?: unknown };

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "brand" | "neutral"> = {
  ontime: "success",
  late: "warning",
  permit: "brand",
  sick: "brand",
  leave: "brand",
  absent: "danger",
};

export function HistoryView() {
  const { session } = useStaff();
  const tz = session.business.timezone;
  const multi = session.outlets.length > 1;
  // `null` = bulan ini menurut server (respons pertama menetapkan bulan acuan pilihan).
  const [month, setMonth] = useState<string | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const key = `${month ?? ""}:${tick}`;

  useEffect(() => {
    const ctrl = new AbortController();
    staffApi()
      .then((api) => api.history({ month: month ?? undefined }, ctrl.signal))
      .then((data) => {
        if (ctrl.signal.aborted) return;
        if (!month) setCurrent(data.month);
        setLoaded({ key, data });
      })
      .catch((error) => {
        if (ctrl.signal.aborted) return;
        if (error instanceof StaffApiError && error.status === 401) return;
        setLoaded((prev) => ({ key, data: prev?.data, error }));
      });
    return () => ctrl.abort();
  }, [key, month]);

  const ready = loaded?.key === key;
  const data = loaded?.data;
  const shownMonth = month ?? current;
  const options = current ? monthOptions(current) : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[22px] leading-tight font-bold tracking-tight text-text-heading">Riwayat kehadiran</h1>
        <div className="w-full min-[420px]:w-auto">
          <label htmlFor="bulan" className="mb-1 block text-[12.5px] font-semibold text-text-heading">
            Bulan
          </label>
          <select
            id="bulan"
            value={shownMonth ?? ""}
            disabled={!current}
            onChange={(e) => setMonth(e.target.value === current ? null : e.target.value)}
            className={`min-h-11 w-full rounded-[10px] border border-border-subtle bg-white px-3 text-[14px] font-semibold text-text-heading min-[420px]:w-[200px] ${focusRing}`}
          >
            {options.length === 0 && <option value="">Memuat…</option>}
            {options.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {ready && loaded?.error ? (
        <Notice tone="danger" role="alert" title="Gagal memuat riwayat">
          <p>{clockErrorMessage(loaded.error, { action: "in", sentGeo: false }).text}</p>
          <button type="button" onClick={() => setTick((t) => t + 1)} className={`mt-2 font-semibold underline underline-offset-2 ${focusRing}`}>
            Coba lagi
          </button>
        </Notice>
      ) : null}

      {data ? (
        <div className={`flex flex-col gap-4 transition-opacity ${ready ? "" : "opacity-60"}`} aria-busy={!ready}>
          <Summary data={data} />
          {data.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-[18px] border border-border-subtle bg-white px-5 py-10 text-center">
              <CalendarX2 size={24} aria-hidden className="text-text-muted" />
              <p className="text-[14px] font-semibold text-text-heading">Belum ada catatan di {monthLabel(data.month)}.</p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2" aria-label={`Catatan kehadiran ${monthLabel(data.month)}`}>
              {data.items.map((r) => (
                <HistoryRow key={r.id} row={r} tz={tz} showOutlet={multi} />
              ))}
            </ul>
          )}
        </div>
      ) : (
        !loaded?.error && (
          <div role="status" aria-label="Memuat riwayat" className="flex animate-pulse flex-col gap-3">
            <div className="h-[104px] rounded-[18px] border border-border-subtle bg-white" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-[72px] rounded-[14px] border border-border-subtle bg-white" />
            ))}
          </div>
        )
      )}
    </div>
  );
}

function Summary({ data }: { data: StaffHistory }) {
  const s = data.summary;
  const away = s.permit + s.sick + s.leave;
  const cells: { label: string; value: React.ReactNode; hint?: string; tone?: string }[] = [
    { label: "Hadir", value: s.present, hint: `${s.ontime} tepat waktu` },
    { label: "Terlambat", value: s.late, hint: s.late_minutes ? `total ${s.late_minutes} menit` : undefined, tone: s.late ? "text-warning" : undefined },
    { label: "Izin/sakit/cuti", value: away, hint: away ? `${s.permit} izin · ${s.sick} sakit · ${s.leave} cuti` : undefined },
    { label: "Alpa", value: s.absent, tone: s.absent ? "text-danger" : undefined },
  ];
  return (
    <section aria-label={`Ringkasan ${monthLabel(data.month)}`} className="rounded-[18px] border border-border-subtle bg-white">
      <dl className="grid grid-cols-2 divide-border-subtle sm:grid-cols-4 sm:divide-x">
        {cells.map((c, i) => (
          <div key={c.label} className={`min-w-0 px-4 py-3 ${i < 2 ? "border-b border-border-subtle sm:border-b-0" : ""} ${i % 2 === 0 ? "border-r border-border-subtle sm:border-r-0" : ""}`}>
            <dt className="text-[12.5px] text-text-muted">{c.label}</dt>
            <dd className={`text-[22px] leading-tight font-bold tabular-nums ${c.tone ?? "text-text-heading"}`}>{c.value}</dd>
            {c.hint && <dd className="text-[12px] break-words text-text-muted">{c.hint}</dd>}
          </div>
        ))}
      </dl>
    </section>
  );
}

function HistoryRow({ row, tz, showOutlet }: { row: StaffAttendance; tz: string; showOutlet: boolean }) {
  const d = dateParts(row.date);
  const via = viaSummary(row);
  const worked = !!row.clock_in_at;
  return (
    <li className="flex gap-3 rounded-[14px] border border-border-subtle bg-white px-3.5 py-3">
      <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-[10px] bg-bg-muted py-1.5 text-center" aria-hidden>
        <span className="text-[11px] font-semibold text-text-muted uppercase">{d.weekday}</span>
        <span className="text-[19px] leading-tight font-bold text-text-heading tabular-nums">{d.day}</span>
        <span className="text-[11px] text-text-muted">{d.month}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="sr-only">
          {d.weekday} {d.day} {d.month}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
          {row.status === "late" && row.late_minutes > 0 && <span className="text-[12.5px] font-semibold text-warning">{row.late_minutes} menit</span>}
          {worked && (
            <span className="text-[15px] font-semibold text-text-heading tabular-nums">
              {formatTime(row.clock_in_at, tz)} – {row.clock_out_at ? formatTime(row.clock_out_at, tz) : <span className="text-[13px] font-normal text-text-muted">belum pulang</span>}
            </span>
          )}
        </div>
        {(via || showOutlet) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12.5px] text-text-body">
            {via && <span>{via.label}</span>}
            {via?.noLocation && (
              <Badge tone="warning">
                <MapPinOff size={12} aria-hidden /> tanpa lokasi
              </Badge>
            )}
            {showOutlet && row.outlet_name && <span className="text-text-muted">{via ? "· " : ""}{row.outlet_name}</span>}
          </p>
        )}
        {row.note && <p className="mt-1 text-[12.5px] break-words text-text-muted">{row.note}</p>}
      </div>
    </li>
  );
}
