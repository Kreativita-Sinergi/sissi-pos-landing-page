"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, Check, Lock, LogIn, LogOut, MapPin, MapPinOff, RotateCw } from "lucide-react";
import { Badge, focusRing, Notice, Spinner } from "@/components/admin/ui";
import { missingLocation, viaLabel } from "@/lib/attendanceVia";
import { newKey, staffApi, StaffApiError } from "@/lib/staff/api";
import { clockOffset, formatDateLong, formatTime, nextStep, STATUS_LABEL, zonedClock, zonedDate } from "@/lib/staff/clock";
import { clockErrorMessage, formatDistance, isNetworkError, type StaffMessage } from "@/lib/staff/errors";
import { GEO_FAILURE_TEXT, locate, type GeoFailure } from "@/lib/staff/geo";
import type { ClockInput, StaffAttendance, StaffGeo, StaffToday } from "@/lib/staff/types";
import { useStaff } from "./StaffShell";

// Halaman Absen (/karyawan) — mobile-first. Jam besar = waktu server (`today.now`) yang berjalan dengan selisih dari
// jam browser, bukan jam browser mentah. Lokasi diminta hanya saat tombol ditekan; ditolak → `geo: null`.
// Idempotency-Key UUID per percobaan, dipakai ulang saat mengulang karena galat jaringan.

const OUTLET_KEY = "sissi-staff:outlet";
const REFRESH_MS = 5 * 60_000;

type Phase = "idle" | "locating" | "sending";
type Pending = { key: string; body: ClockInput; failure: GeoFailure | null };
type Feedback = { tone: "success" | StaffMessage["tone"]; title?: string; text: string; retry?: boolean };

function savedOutlet(): string | undefined {
  try {
    return localStorage.getItem(OUTLET_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function ClockView() {
  const { session } = useStaff();
  const tz = session.business.timezone;
  const outlets = session.outlets;
  const [today, setToday] = useState<StaffToday | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [offset, setOffset] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const pending = useRef<Pending | null>(null);
  const reqId = useRef(0);
  /** Outlet pilihan karyawan (undefined = bawaan server). */
  const outletRef = useRef<string | undefined>(undefined);

  const load = useCallback(
    async (outlet: string | undefined, opts: { quiet?: boolean } = {}) => {
      const id = ++reqId.current;
      if (!opts.quiet) setLoadError(null);
      try {
        const api = await staffApi();
        const t0 = Date.now();
        const t = await api.today({ outlet_id: outlet });
        const t1 = Date.now();
        if (id !== reqId.current) return;
        setOffset(clockOffset(t.now, t0, t1));
        setToday(t);
        setLoadError(null);
      } catch (err) {
        if (id !== reqId.current) return;
        if (err instanceof StaffApiError && err.status === 401) return; // StaffShell mengarahkan ke masuk.
        // Outlet tersimpan tidak lagi diizinkan → kembali ke bawaan server.
        if (err instanceof StaffApiError && err.code === "FORBIDDEN" && outlet) {
          try {
            localStorage.removeItem(OUTLET_KEY);
          } catch {}
          outletRef.current = undefined;
          return load(undefined, opts);
        }
        if (!opts.quiet) setLoadError(err);
      }
    },
    []
  );

  // Muat pertama (outlet tersimpan, bila masih termasuk outlet milik karyawan).
  useEffect(() => {
    const saved = savedOutlet();
    const initial = saved && outlets.some((o) => o.id === saved) ? saved : undefined;
    outletRef.current = initial;
    load(initial);
  }, [load, outlets]);

  // Jam berjalan: waktu server = jam browser + selisih.
  useEffect(() => {
    if (!today) return;
    const tick = () => setNow(Date.now() + offset);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today, offset]);

  // Segarkan berkala, saat tab kembali aktif, dan saat tanggal berganti (lewat tengah malam zona usaha).
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && phase === "idle") load(outletRef.current, { quiet: true });
    };
    const id = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [load, phase]);
  const serverDate = now !== null ? zonedDate(now, tz) : null;
  useEffect(() => {
    if (today && serverDate && serverDate > today.date && phase === "idle") load(outletRef.current, { quiet: true });
  }, [serverDate, today, phase, load]);

  function chooseOutlet(id: string) {
    outletRef.current = id;
    setFeedback(null);
    pending.current = null;
    try {
      localStorage.setItem(OUTLET_KEY, id);
    } catch {}
    load(id);
  }

  async function send(p: Pending, autoRetry: boolean) {
    setPhase("sending");
    const api = await staffApi();
    try {
      const row = await api.clock(p.body, p.key);
      pending.current = null;
      setToday((t) => (t ? { ...t, attendance: row } : t));
      const at = formatTime(p.body.action === "in" ? row.clock_in_at : row.clock_out_at, tz);
      const late = p.body.action === "in" && row.status === "late" ? ` · terlambat ${row.late_minutes} menit` : "";
      setFeedback({
        tone: "success",
        title: p.body.action === "in" ? `Absen masuk tercatat ${at}` : `Absen pulang tercatat ${at}`,
        text: p.failure ? `${GEO_FAILURE_TEXT[p.failure]} — tercatat tanpa lokasi${late}.` : `Lokasi ikut tercatat${late}.`,
      });
      setPhase("idle");
      load(outletRef.current, { quiet: true });
    } catch (err) {
      if (isNetworkError(err)) {
        if (autoRetry) {
          await new Promise((r) => setTimeout(r, 1500));
          return send(p, false);
        }
        // Simpan percobaan: "Coba lagi" memakai Idempotency-Key & isi yang sama (server memutar ulang hasil pertama).
        pending.current = p;
        const m = clockErrorMessage(err, { action: p.body.action, sentGeo: !!p.body.geo });
        setFeedback({ ...m, retry: true });
        setPhase("idle");
        return;
      }
      pending.current = null;
      const m = clockErrorMessage(err, { action: p.body.action, sentGeo: !!p.body.geo });
      setFeedback(m);
      setPhase("idle");
      if (err instanceof StaffApiError) {
        // ALREADY_CLOCKED tidak membawa baris → muat ulang GET /staff/today.
        if (
          err.code === "ALREADY_CLOCKED" ||
          err.code === "NOT_CLOCKED_IN" || err.code === "ATTENDANCE_DAY_CLOSED" || err.code === "PRO_REQUIRED") {
          load(outletRef.current, { quiet: true });
        }
      }
    }
  }

  async function clock(action: "in" | "out") {
    if (!today || !today.outlet_id || phase !== "idle") return;
    const outletId = today.outlet_id;
    setFeedback(null);
    // Percobaan sebelumnya gagal jaringan → ulangi dengan Idempotency-Key & isi yang sama (bisa saja sudah tercatat).
    const prev = pending.current;
    if (prev && prev.body.action === action && prev.body.outlet_id === today.outlet_id) return send(prev, false);
    setPhase("locating");
    const loc = await locate();
    const p: Pending = { key: newKey(), body: { outlet_id: outletId, action, geo: loc.geo }, failure: loc.failure };
    pending.current = p;
    await send(p, true);
  }

  function retry() {
    const p = pending.current;
    if (!p || phase !== "idle") return;
    setFeedback(null);
    send(p, false);
  }

  if (!today) {
    return loadError ? (
      <Notice tone="danger" role="alert" title="Gagal memuat absen hari ini">
        <p>{clockErrorMessage(loadError, { action: "in", sentGeo: false }).text}</p>
        <button type="button" onClick={() => load(outletRef.current)} className={`mt-2 font-semibold underline underline-offset-2 ${focusRing}`}>
          Coba lagi
        </button>
      </Notice>
    ) : (
      <ClockSkeleton />
    );
  }

  const locked = today.locked || session.locked;
  const step = nextStep(today);
  const a = today.attendance;
  const clockNow = now !== null ? zonedClock(now, tz) : null;
  const first = session.user.name.split(/\s+/)[0];
  const busy = phase !== "idle";
  const outletName = outlets.find((o) => o.id === today.outlet_id)?.name;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[14px] text-text-body">{greeting(clockNow?.hm)},</p>
          <h1 className="text-[22px] leading-tight font-bold tracking-tight break-words text-text-heading">{first}</h1>
        </div>
        {outlets.length > 1 ? (
          <div className="w-full min-[420px]:w-auto">
            <label htmlFor="outlet" className="mb-1 block text-[12.5px] font-semibold text-text-heading">
              Outlet
            </label>
            <select
              id="outlet"
              value={today.outlet_id ?? ""}
              onChange={(e) => chooseOutlet(e.target.value)}
              disabled={busy}
              className={`min-h-11 w-full max-w-full rounded-[10px] border border-border-subtle bg-white px-3 text-[14px] font-semibold text-text-heading min-[420px]:w-[230px] ${focusRing}`}
            >
              {outlets.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          outletName && (
            <p className="inline-flex max-w-full items-center gap-1.5 text-[13.5px] font-semibold text-text-body">
              <MapPin size={15} aria-hidden className="shrink-0 text-brand-primary" />
              <span className="truncate">{outletName}</span>
            </p>
          )
        )}
      </div>

      {/* Jam & jadwal */}
      <section aria-labelledby="jam-title" className="overflow-hidden rounded-[18px] border border-border-subtle bg-white">
        <h2 id="jam-title" className="sr-only">
          Jam sekarang dan jadwal
        </h2>
        <div className="px-5 pt-5 pb-4 text-center">
          <p className="text-[13.5px] font-semibold text-text-body">{formatDateLong(today.date)}</p>
          <p className="mt-1 leading-none font-bold tracking-[-0.04em] text-text-heading tabular-nums" aria-label={clockNow ? `Pukul ${clockNow.hm}` : undefined}>
            <span className="text-[clamp(52px,17vw,76px)]">{clockNow?.hm ?? "--:--"}</span>
            <span aria-hidden className="ml-1 align-top text-[clamp(18px,5vw,24px)] text-text-muted">
              {clockNow?.s ?? "--"}
            </span>
          </p>
          <p className="mt-2 text-[12px] text-text-muted">Waktu server · {tzLabel(tz)}</p>
        </div>
        <dl className="grid grid-cols-2 border-t border-border-subtle bg-bg-muted/60 text-center">
          {today.rules.off_day ? (
            <div className="col-span-2 px-3 py-3">
              <dt className="text-[12px] text-text-muted">Jadwal</dt>
              <dd className="text-[15px] font-semibold text-text-heading">Hari libur</dd>
            </div>
          ) : (
            <>
              <div className="border-r border-border-subtle px-3 py-3">
                <dt className="text-[12px] text-text-muted">Jadwal masuk</dt>
                <dd className="text-[17px] font-semibold text-text-heading tabular-nums">{today.rules.work_start}</dd>
              </div>
              <div className="px-3 py-3">
                <dt className="text-[12px] text-text-muted">Jadwal pulang</dt>
                <dd className="text-[17px] font-semibold text-text-heading tabular-nums">{today.rules.work_end}</dd>
              </div>
            </>
          )}
        </dl>
        {!today.rules.off_day && today.rules.late_tolerance_min > 0 && (
          <p className="border-t border-border-subtle px-4 py-2 text-center text-[12.5px] text-text-muted">
            Toleransi terlambat {today.rules.late_tolerance_min} menit
          </p>
        )}
      </section>

      {/* Status hari ini */}
      <section aria-labelledby="status-title" className="rounded-[18px] border border-border-subtle bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-5 py-3">
          <h2 id="status-title" className="text-[15px] font-semibold text-text-heading">
            {step.kind === "out" && step.carried ? "Absen kemarin belum pulang" : "Status hari ini"}
          </h2>
          <StatusBadge row={a} step={step.kind} />
        </div>
        <ul className="divide-y divide-border-subtle">
          <ClockLine label="Masuk" at={a?.clock_in_at ?? null} tz={tz} source={a?.source} via={a?.clock_in_via ?? null} geo={a?.clock_in_geo ?? null} late={a?.status === "late" ? a.late_minutes : 0} />
          <ClockLine label="Pulang" at={a?.clock_out_at ?? null} tz={tz} source={a?.source} via={a?.clock_out_via ?? null} geo={a?.clock_out_geo ?? null} late={0} />
        </ul>
        {a && a.outlet_id !== today.outlet_id && a.outlet_name && (
          <p className="border-t border-border-subtle px-5 py-2.5 text-[12.5px] text-text-muted">Tercatat di {a.outlet_name}.</p>
        )}
        {a?.note && <p className="border-t border-border-subtle px-5 py-2.5 text-[13px] text-text-body">Catatan: {a.note}</p>}
      </section>

      {/* Aksi */}
      <div aria-live="polite" className="flex flex-col gap-3">
        {feedback && (
          <Notice
            tone={feedback.tone === "success" ? "success" : feedback.tone}
            role={feedback.tone === "success" ? "status" : "alert"}
            icon={feedback.tone === "success" ? <Check size={18} aria-hidden /> : undefined}
            title={feedback.title}
          >
            <p>{feedback.text}</p>
            {feedback.retry && (
              <button type="button" onClick={retry} className={`mt-2 inline-flex min-h-9 items-center gap-1.5 font-semibold underline underline-offset-2 ${focusRing}`}>
                <RotateCw size={15} aria-hidden /> Coba lagi
              </button>
            )}
          </Notice>
        )}
      </div>

      {locked ? (
        <section className="rounded-[18px] border border-warning/25 bg-warning-tint px-5 py-4 text-warning" aria-labelledby="locked-title">
          <p id="locked-title" className="flex items-center gap-2 text-[15px] font-semibold">
            <Lock size={17} aria-hidden /> Fitur ini butuh Sissi Pro — hubungi pemilik
          </p>
          <p className="mt-1 text-[13.5px] leading-relaxed">Absen dari website aktif lagi setelah pemilik usaha berlangganan Sissi Pro. Riwayat tetap bisa dilihat.</p>
          <button type="button" disabled className="mt-3 inline-flex min-h-14 w-full cursor-not-allowed items-center justify-center gap-2 rounded-[14px] bg-border-subtle text-[17px] font-bold text-text-muted">
            <Lock size={18} aria-hidden /> Absen tidak tersedia
          </button>
        </section>
      ) : !today.outlet_id ? (
        <Notice tone="warning" role="status" title="Belum terdaftar di outlet">
          <p>Akunmu belum ditempatkan di outlet aktif mana pun. Minta pemilik mengatur outlet untukmu di menu Tim.</p>
        </Notice>
      ) : step.kind === "closed" ? (
        <Notice tone="info" title={`Hari ini tercatat ${(STATUS_LABEL[step.status] ?? step.status).toLowerCase()}`}>
          <p>Absen masuk/pulang ditutup untuk hari ini. Hubungi pemilik bila keliru.</p>
        </Notice>
      ) : step.kind === "done" ? (
        <div className="flex items-center gap-3 rounded-[18px] border border-success/25 bg-success-tint px-5 py-4 text-success">
          <Check size={22} aria-hidden className="shrink-0" />
          <div>
            <p className="text-[15px] font-semibold">Absen hari ini selesai</p>
            <p className="text-[13.5px]">Terima kasih, sampai jumpa besok.</p>
          </div>
        </div>
      ) : (
        <div>
          <button
            type="button"
            onClick={() => clock(step.kind)}
            disabled={busy}
            aria-describedby="geo-hint"
            className={`inline-flex min-h-16 w-full items-center justify-center gap-2.5 rounded-[16px] px-5 text-[19px] font-bold text-white transition-colors disabled:cursor-wait disabled:opacity-70 ${
              step.kind === "in" ? "bg-brand-deep shadow-[0_8px_20px_-10px_rgba(190,88,35,0.6)] hover:bg-brand-deeper" : "bg-brand-dark hover:bg-black"
            } ${focusRing}`}
          >
            {busy ? <Spinner size={20} /> : step.kind === "in" ? <LogIn size={22} aria-hidden /> : <LogOut size={22} aria-hidden />}
            {phase === "locating" ? "Mencari lokasi…" : phase === "sending" ? "Mengirim…" : step.kind === "in" ? "Absen Masuk" : "Absen Pulang"}
          </button>
          {step.kind === "out" && step.carried && (
            // Absen kemarin masih terbuka tidak menghalangi masuk hari ini (server hanya melihat baris hari ini).
            <button
              type="button"
              onClick={() => clock("in")}
              disabled={busy}
              className={`mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[14px] border border-border-subtle bg-white px-4 text-[15px] font-semibold text-text-heading hover:border-border-active disabled:opacity-60 ${focusRing}`}
            >
              <LogIn size={18} aria-hidden /> Lewati, absen masuk hari ini
            </button>
          )}
          <p id="geo-hint" className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-relaxed text-text-muted">
            {today.geo.enabled && today.geo.outside === "reject" ? (
              <>
                <MapPin size={14} aria-hidden className="mt-0.5 shrink-0 text-brand-primary" />
                Outlet ini hanya menerima absen di lokasi (radius {today.geo.radius_m}{"\u00a0"}m). Izinkan akses lokasi saat browser meminta.
              </>
            ) : (
              <>
                <MapPin size={14} aria-hidden className="mt-0.5 shrink-0" />
                Browser akan meminta lokasi; lokasi ikut dicatat untuk pemilik bila kamu izinkan.
              </>
            )}
          </p>
        </div>
      )}

      <Link href="/karyawan/riwayat" className={`inline-flex min-h-11 items-center gap-2 self-start rounded-[10px] text-[14px] font-semibold text-brand-ink hover:underline ${focusRing}`}>
        <CalendarDays size={16} aria-hidden /> Lihat riwayat kehadiran
      </Link>
    </div>
  );
}

function greeting(hm: string | undefined): string {
  const h = hm ? Number(hm.slice(0, 2)) : 12;
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

function tzLabel(tz: string): string {
  if (tz === "Asia/Jakarta") return "WIB";
  if (tz === "Asia/Makassar") return "WITA";
  if (tz === "Asia/Jayapura") return "WIT";
  return tz;
}

function StatusBadge({ row, step }: { row: StaffAttendance | null; step: string }) {
  if (step === "closed" && row) return <Badge tone="brand">{STATUS_LABEL[row.status] ?? row.status}</Badge>;
  if (!row || !row.clock_in_at) return <Badge>Belum absen</Badge>;
  if (row.clock_out_at) return <Badge>Selesai</Badge>;
  return <Badge tone="success">Sedang bekerja</Badge>;
}

function ClockLine({
  label,
  at,
  tz,
  source,
  via,
  geo,
  late,
}: {
  label: string;
  at: string | null;
  tz: string;
  source: string | undefined;
  via: string | null;
  geo: StaffGeo | null;
  late: number;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
      <span className="w-14 shrink-0 text-[13px] font-semibold text-text-muted">{label}</span>
      <span className="text-[20px] font-bold text-text-heading tabular-nums">{formatTime(at, tz)}</span>
      {at && (
        <span className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          {late > 0 && <Badge tone="warning">Telat {late} menit</Badge>}
          {source && <Badge>{viaLabel(source, via)}</Badge>}
          {source && missingLocation(source, via, geo) && (
            <Badge tone="warning">
              <MapPinOff size={12} aria-hidden /> tanpa lokasi
            </Badge>
          )}
          {geo?.outside_area && (
            <Badge tone="danger">{geo.distance_m !== null ? `di luar area · ${formatDistance(geo.distance_m)}` : "di luar area"}</Badge>
          )}
        </span>
      )}
    </li>
  );
}

function ClockSkeleton() {
  return (
    <div role="status" aria-label="Memuat absen hari ini" className="flex animate-pulse flex-col gap-4">
      <div className="h-12 w-40 rounded bg-border-subtle" />
      <div className="h-[220px] rounded-[18px] border border-border-subtle bg-white" />
      <div className="h-[120px] rounded-[18px] border border-border-subtle bg-white" />
      <div className="h-16 rounded-[16px] bg-border-subtle" />
    </div>
  );
}
