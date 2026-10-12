"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AppVersionConfig, AppVersionInput, VersionDistribution, VersionImpact } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { Meter } from "./charts";
import { ConfirmDialog } from "./ConfirmDialog";
import { Chip } from "./filters";
import { useToast } from "./toast";
import {
  Badge,
  btn,
  ErrorBlock,
  errorMessage,
  Field,
  fieldErrors,
  formatDateTime,
  formatRelative,
  inputClass,
  LoadingBlock,
  Notice,
  PageHeader,
  Section,
  Skeleton,
  Spinner,
  useLoad,
} from "./ui";

// Pengaturan versi Android (GET/PUT /admin/app-version). Menaikkan build minimum memblokir sinkron
// HP lama → peringatan jelas + konfirmasi (server juga menolak tanpa confirm_min_raise → 409).

type Form = {
  latest_version: string;
  latest_build: string;
  min_build: string;
  store_url: string;
  apk_url: string;
  message: string;
};

const MAX_BUILD = 2_100_000_000;
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function toForm(c: AppVersionConfig): Form {
  return {
    latest_version: c.latest_version,
    latest_build: String(c.latest_build),
    min_build: String(c.min_build),
    store_url: c.store_url,
    apk_url: c.apk_url,
    message: c.message,
  };
}

function parseBuild(s: string): number | null {
  if (!/^\d+$/.test(s.trim())) return null;
  const n = Number(s.trim());
  return Number.isSafeInteger(n) && n <= MAX_BUILD ? n : null;
}

function validate(f: Form): Record<string, string> {
  const e: Record<string, string> = {};
  const latest = parseBuild(f.latest_build);
  const min = parseBuild(f.min_build);
  if (!VERSION_RE.test(f.latest_version.trim())) e.latest_version = "Format x.y.z, mis. 1.4.2.";
  if (latest === null) e.latest_build = "Bilangan bulat 0–2.100.000.000.";
  if (min === null) e.min_build = "Bilangan bulat 0–2.100.000.000.";
  if (latest !== null && min !== null && min > latest) e.min_build = "Tidak boleh lebih besar dari build terbaru.";
  if (!f.store_url.trim().startsWith("https://")) e.store_url = "Harus diawali https://.";
  else if (f.store_url.trim().length > 500) e.store_url = "Maksimal 500 karakter.";
  if (f.apk_url.trim() && !f.apk_url.trim().startsWith("https://")) e.apk_url = "Kosongkan atau isi URL https://.";
  else if (f.apk_url.trim().length > 500) e.apk_url = "Maksimal 500 karakter.";
  if (f.message.length > 300) e.message = "Maksimal 300 karakter.";
  return e;
}

export function VersionView() {
  const { state, reload, setData } = useLoad<AppVersionConfig>(async (signal) => (await adminApi()).appVersion(signal), []);
  return (
    <>
      <PageHeader
        title="Versi aplikasi"
        description="Menentukan versi terbaru yang ditawarkan ke pengguna Android dan build minimum yang masih boleh sinkron."
      />
      {state.status === "error" && !state.data && <ErrorBlock error={state.error} onRetry={reload} />}
      {state.status === "loading" && !state.data && <LoadingBlock />}
      {state.data && <VersionForm config={state.data} onSaved={setData} />}
    </>
  );
}

function VersionForm({ config, onSaved }: { config: AppVersionConfig; onSaved: (c: AppVersionConfig) => void }) {
  const [form, setForm] = useState<Form>(() => toForm(config));
  const [touched, setTouched] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [serverConfirm, setServerConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [result, setResult] = useState<{ warnings: string[] } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const toast = useToast();

  const errors = useMemo(() => ({ ...(touched ? validate(form) : {}), ...serverErrors }), [form, touched, serverErrors]);
  const original = useMemo(() => toForm(config), [config]);
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== original[k]);

  const newMin = parseBuild(form.min_build);
  const minRaised = newMin !== null && newMin > config.min_build;
  const preview = useImpactPreview(newMin !== null && newMin !== config.min_build ? newMin : null);
  const impact = preview.impact && preview.impact.min_build === newMin ? preview.impact : null;

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setServerErrors((s) => {
      if (!s[k]) return s;
      const rest = { ...s };
      delete rest[k];
      return rest;
    });
    setResult(null);
  };

  function body(confirm: boolean): AppVersionInput {
    return {
      platform: "android",
      latest_version: form.latest_version.trim(),
      latest_build: parseBuild(form.latest_build) ?? 0,
      min_build: parseBuild(form.min_build) ?? 0,
      store_url: form.store_url.trim(),
      apk_url: form.apk_url.trim(),
      message: form.message.trim(),
      ...(confirm ? { confirm_min_raise: true } : {}),
    };
  }

  function requestSave(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setSaveError(null);
    if (Object.keys(validate(form)).length > 0) return;
    setServerConfirm(null);
    setConfirmText("");
    setConfirmOpen(true);
  }

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      const api = await adminApi();
      const res = await api.saveAppVersion(body(minRaised || serverConfirm !== null));
      setConfirmOpen(false);
      setResult({ warnings: res.warnings ?? [] });
      toast.success(
        minRaised ? `Build minimum dinaikkan ke ${res.config.min_build}. Berlaku ±30 detik.` : "Pengaturan versi disimpan."
      );
      onSaved(res.config);
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONFIRMATION_REQUIRED") {
        // Nilai efektif di server berubah sejak halaman dimuat — minta konfirmasi eksplisit.
        setServerConfirm(err.message);
      } else {
        setConfirmOpen(false);
        if (err instanceof ApiError && err.code === "VALIDATION_ERROR") setServerErrors(fieldErrors(err));
        setSaveError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  const changes = (Object.keys(form) as (keyof Form)[]).filter((k) => form[k].trim() !== original[k].trim());
  const LABELS: Record<keyof Form, string> = {
    latest_version: "Versi terbaru",
    latest_build: "Build terbaru",
    min_build: "Build minimum",
    store_url: "URL Play Store",
    apk_url: "URL APK langsung",
    message: "Pesan pembaruan",
  };
  const danger = minRaised || serverConfirm !== null;
  // Sangat berisiko (ada bisnis terdampak) → ketik angka build baru untuk konfirmasi.
  const mustType = danger && (impact?.businesses ?? 1) > 0;
  const typedOk = !mustType || confirmText.trim() === String(newMin);

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="xl:col-span-2">
        <DistributionPanel config={config} previewMin={newMin !== null && newMin !== config.min_build ? newMin : null} />
      </div>
      <form onSubmit={requestSave} noValidate className="flex flex-col gap-5">
        {result?.warnings.map((w) => (
          <Notice key={w} tone="warning" role="status" icon={<TriangleAlert size={18} aria-hidden />}>
            {w}
          </Notice>
        ))}
        {saveError && (
          <Notice tone="danger" role="alert" icon={<TriangleAlert size={18} aria-hidden />} title="Gagal menyimpan">
            {saveError}
          </Notice>
        )}

        <Section title="Versi" description="Build = versionCode Android; versi = versionName.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field id="latest_version" label="Versi terbaru" error={errors.latest_version} hint="Format x.y.z">
              <input
                id="latest_version"
                className={inputClass}
                value={form.latest_version}
                onChange={set("latest_version")}
                inputMode="decimal"
                aria-invalid={!!errors.latest_version}
                aria-describedby={errors.latest_version ? "latest_version-error" : "latest_version-hint"}
              />
            </Field>
            <Field id="latest_build" label="Build terbaru" error={errors.latest_build}>
              <input
                id="latest_build"
                className={`${inputClass} tabular-nums`}
                value={form.latest_build}
                onChange={set("latest_build")}
                inputMode="numeric"
                aria-invalid={!!errors.latest_build}
                aria-describedby={errors.latest_build ? "latest_build-error" : undefined}
              />
            </Field>
            <Field
              id="min_build"
              label="Build minimum"
              error={errors.min_build}
              hint={`Saat ini ${config.min_build}. Build di bawahnya tidak bisa sinkron.`}
            >
              <input
                id="min_build"
                className={`${inputClass} tabular-nums`}
                value={form.min_build}
                onChange={set("min_build")}
                inputMode="numeric"
                aria-invalid={!!errors.min_build}
                aria-describedby={errors.min_build ? "min_build-error" : "min_build-hint"}
              />
            </Field>
          </div>
          {newMin !== null && newMin !== config.min_build && !errors.min_build && (
            <div className="mt-4">
              <ImpactPreview
                from={config.min_build}
                to={newMin}
                impact={impact}
                unknown={preview.unknown}
                loading={preview.loading}
                error={preview.error}
              />
            </div>
          )}
        </Section>

        <Section title="Tautan & pesan">
          <div className="flex flex-col gap-4">
            <Field id="store_url" label="URL Play Store" error={errors.store_url}>
              <input
                id="store_url"
                type="url"
                className={inputClass}
                value={form.store_url}
                onChange={set("store_url")}
                aria-invalid={!!errors.store_url}
                aria-describedby={errors.store_url ? "store_url-error" : undefined}
              />
            </Field>
            <Field id="apk_url" label="URL APK langsung" error={errors.apk_url} hint="Opsional. Untuk HP tanpa Play Store.">
              <input
                id="apk_url"
                type="url"
                className={inputClass}
                value={form.apk_url}
                onChange={set("apk_url")}
                placeholder="https://apipos.sissi.id/unduh/sissi-pos-latest.apk"
                aria-invalid={!!errors.apk_url}
                aria-describedby={errors.apk_url ? "apk_url-error" : "apk_url-hint"}
              />
            </Field>
            <Field
              id="message"
              label="Pesan pembaruan"
              error={errors.message}
              hint={`${form.message.length}/300 · Ditampilkan di aplikasi saat ada versi baru.`}
            >
              <textarea
                id="message"
                rows={3}
                className={`${inputClass} py-2.5 leading-relaxed`}
                value={form.message}
                onChange={set("message")}
                aria-invalid={!!errors.message}
                aria-describedby={errors.message ? "message-error" : "message-hint"}
              />
            </Field>
          </div>
        </Section>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className={btn.secondary}
            disabled={!dirty || busy}
            onClick={() => {
              setForm(original);
              setServerErrors({});
              setTouched(false);
            }}
          >
            Kembalikan
          </button>
          <button type="submit" className={btn.primary} disabled={!dirty || busy}>
            {busy && <Spinner />}
            Simpan perubahan
          </button>
        </div>
      </form>

      <aside className="flex flex-col gap-3 text-[14px]">
        <Section title="Nilai efektif sekarang">
          <dl className="flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Sumber</dt>
              <dd>{config.source === "db" ? <Badge tone="success">Database</Badge> : <Badge tone="warning">Env server</Badge>}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Diubah</dt>
              <dd className="text-right">{formatDateTime(config.updated_at)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-text-muted">Oleh</dt>
              <dd className="truncate text-right">{config.updated_by?.name ?? "—"}</dd>
            </div>
          </dl>
        </Section>
        <Notice tone="info" icon={<Info size={16} aria-hidden />}>
          {config.source === "env"
            ? "Belum pernah disimpan dari sini; nilai di atas berasal dari env server. Simpan sekali untuk memindahkannya ke database."
            : "Aplikasi membaca nilai ini lewat /app/version. Salah menaikkan build minimum bisa dipulihkan dengan menurunkannya lagi."}
        </Notice>
      </aside>

      <ConfirmDialog
        open={confirmOpen}
        title={danger ? `Naikkan build minimum ke ${newMin}?` : "Simpan pengaturan versi?"}
        confirmLabel={danger ? "Naikkan & simpan" : "Simpan"}
        tone={danger ? "danger" : "primary"}
        busy={busy}
        confirmDisabled={!typedOk}
        onConfirm={save}
        onClose={() => setConfirmOpen(false)}
      >
        {danger && (
          <div className="mb-4 rounded-[12px] bg-danger-tint px-4 py-3 text-danger">
            {impact ? (
              <>
                <p className="flex flex-wrap items-baseline gap-x-2 leading-tight">
                  <span className="text-[30px] font-bold tabular-nums">{impact.devices.toLocaleString("id-ID")}</span>
                  <span className="font-semibold">perangkat di</span>
                  <span className="text-[30px] font-bold tabular-nums">{impact.businesses.toLocaleString("id-ID")}</span>
                  <span className="font-semibold">bisnis</span>
                </p>
                <p className="mt-1 text-[14px] font-medium">akan berhenti sinkron sampai memperbarui aplikasi.</p>
                {impact.businesses_all_devices > 0 && (
                  <p className="mt-1 text-[13px]">
                    {impact.businesses_all_devices.toLocaleString("id-ID")} bisnis kehilangan semua perangkat aktifnya.
                  </p>
                )}
              </>
            ) : (
              <p className="font-medium">
                {serverConfirm ?? `Pengguna build di bawah ${newMin} tidak bisa sinkron sampai memperbarui aplikasi.`}
              </p>
            )}
          </div>
        )}
        <ul className="flex flex-col gap-1">
          {changes.map((k) => (
            <li key={k} className="flex flex-wrap gap-x-2">
              <span className="text-text-muted">{LABELS[k]}:</span>
              <span className="break-all">
                <span className="line-through decoration-text-muted/60">{original[k] || "kosong"}</span> →{" "}
                <span className="font-semibold text-text-heading">{form[k].trim() || "kosong"}</span>
              </span>
            </li>
          ))}
        </ul>
        {mustType && (
          <div className="mt-4">
            <label htmlFor="confirm-build" className="mb-1.5 block text-[13px] font-semibold text-text-heading">
              Ketik <span className="font-mono">{newMin}</span> untuk melanjutkan
            </label>
            <input
              id="confirm-build"
              className={`${inputClass} tabular-nums`}
              inputMode="numeric"
              autoComplete="off"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && typedOk && !busy) save();
              }}
            />
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

// ——— Sebaran versi & pratinjau dampak (tahap 2) ———

/** Memanggil distribution?min_build= 400 ms setelah isian berhenti berubah. */
function useImpactPreview(min: number | null) {
  const [debounced, setDebounced] = useState<number | null>(min);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(min), 400);
    return () => clearTimeout(t);
  }, [min]);
  const { state } = useLoad<VersionDistribution | null>(
    async (signal) => (debounced === null ? null : (await adminApi()).versionDistribution({ min_build: debounced }, signal)),
    [debounced ?? -1]
  );
  return {
    impact: state.data?.impact ?? null,
    unknown: state.data?.totals.unknown_build_devices ?? 0,
    loading: state.status === "loading" || debounced !== min,
    error: state.status === "error" ? state.error : null,
  };
}

function ImpactPreview({
  from,
  to,
  impact,
  unknown,
  loading,
  error,
}: {
  from: number;
  to: number;
  impact: VersionImpact | null;
  unknown: number;
  loading: boolean;
  error: unknown;
}) {
  if (to < from) {
    return (
      <Notice tone="info" icon={<Info size={18} aria-hidden />} title={`Build minimum turun ${from} → ${to}`}>
        Build {to}–{from - 1} boleh sinkron lagi. Tidak ada perangkat yang terblokir karena perubahan ini.
      </Notice>
    );
  }
  if (error && !impact) {
    return (
      <Notice tone="warning" icon={<TriangleAlert size={18} aria-hidden />} title={`Build minimum naik ${from} → ${to}`}>
        Dampak belum bisa dihitung ({errorMessage(error)}). Pengguna build di bawah {to} tidak bisa sinkron sampai
        memperbarui aplikasi.
      </Notice>
    );
  }
  const zero = impact !== null && impact.devices === 0;
  return (
    <div
      role="status"
      aria-busy={loading}
      className={`rounded-[12px] border px-4 py-3.5 transition-opacity ${
        zero ? "border-success/25 bg-success-tint text-success" : "border-danger/25 bg-danger-tint text-danger"
      } ${loading && impact ? "opacity-60" : ""}`}
    >
      <p className="text-[13px] font-semibold">Dampak menaikkan build minimum {from} → {to}</p>
      {impact ? (
        zero ? (
          <p className="mt-1 flex items-center gap-2 text-[15px] font-semibold">
            <CircleCheck size={18} aria-hidden /> Tidak ada perangkat aktif yang terdampak.
          </p>
        ) : (
          <>
            <p className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 leading-none">
              <span className="text-[32px] font-bold tabular-nums">{impact.devices.toLocaleString("id-ID")}</span>
              <span className="text-[14px] font-semibold">perangkat</span>
              <span aria-hidden className="px-1 text-[20px] opacity-50">·</span>
              <span className="text-[32px] font-bold tabular-nums">{impact.businesses.toLocaleString("id-ID")}</span>
              <span className="text-[14px] font-semibold">bisnis akan berhenti sinkron</span>
            </p>
            <ul className="mt-2.5 flex flex-col gap-0.5 text-[13px]">
              {impact.businesses_all_devices > 0 && (
                <li>
                  <strong className="tabular-nums">{impact.businesses_all_devices.toLocaleString("id-ID")}</strong> bisnis
                  kehilangan semua perangkat aktif.
                </li>
              )}
              {unknown > 0 && (
                <li className="opacity-80">
                  {unknown.toLocaleString("id-ID")} perangkat dengan build tak diketahui (tidak terdampak).
                </li>
              )}
            </ul>
          </>
        )
      ) : (
        <div className="mt-2 flex gap-3" aria-label="Menghitung dampak…">
          <Skeleton className="h-8 w-24 bg-danger/15" />
          <Skeleton className="h-8 w-32 bg-danger/15" />
        </div>
      )}
      <p className="mt-2 text-[12px] opacity-80">Perangkat aktif 30 hari terakhir.</p>
    </div>
  );
}

const DAY_OPTIONS = [7, 30, 90];

function DistributionPanel({ config, previewMin }: { config: AppVersionConfig; previewMin: number | null }) {
  const [days, setDays] = useState(30);
  const { state, reload } = useLoad<VersionDistribution>(
    async (signal) => (await adminApi()).versionDistribution({ active_days: days }, signal),
    [days, config.min_build, config.latest_build]
  );
  const d = state.data;
  const max = d ? Math.max(1, ...d.builds.map((b) => b.devices)) : 1;
  const min = previewMin ?? d?.min_build ?? config.min_build;
  const firstBelow = d ? d.builds.findIndex((b) => b.build < min) : -1;

  return (
    <Section
      title="Sebaran build Android"
      description={
        d ? (
          <>
            <strong className="font-semibold text-text-heading tabular-nums">{d.totals.devices.toLocaleString("id-ID")}</strong> perangkat
            aktif di <strong className="font-semibold text-text-heading tabular-nums">{d.totals.businesses.toLocaleString("id-ID")}</strong>{" "}
            bisnis
            {d.totals.unknown_build_devices > 0 && ` · ${d.totals.unknown_build_devices.toLocaleString("id-ID")} perangkat build tak diketahui`}
          </>
        ) : (
          "Perangkat aktif per build."
        )
      }
      actions={
        <div className="flex gap-1.5" role="group" aria-label="Rentang aktif">
          {DAY_OPTIONS.map((n) => (
            <Chip key={n} active={days === n} onClick={() => setDays(n)}>
              {n} hari
            </Chip>
          ))}
        </div>
      }
      bodyClass="px-4 py-3 sm:px-5"
    >
      {state.status === "error" && !d && <ErrorBlock error={state.error} onRetry={reload} />}
      {!d && state.status === "loading" && (
        <div className="flex flex-col gap-3 py-1" aria-label="Memuat sebaran">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid grid-cols-[96px_minmax(0,1fr)_88px] items-center gap-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-2.5" />
              <Skeleton className="h-4 w-14 justify-self-end" />
            </div>
          ))}
        </div>
      )}
      {d && d.builds.length === 0 && (
        <p className="py-6 text-center text-[14px] text-text-muted">
          Belum ada perangkat yang melaporkan build dalam {d.active_days} hari terakhir.
        </p>
      )}
      {d && d.builds.length > 0 && (
        <ul className={`flex flex-col transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`} aria-label="Perangkat per build">
          {d.builds.map((b, i) => {
            const belowPreview = b.build < min;
            const tone = belowPreview ? (previewMin !== null && b.build >= d.min_build ? "danger" : "warning") : b.build === d.latest_build ? "brand" : "neutral";
            return (
              <React.Fragment key={b.build}>
                {i === firstBelow && (
                  <li aria-hidden className="my-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-warning">
                    <span className="h-px flex-1 border-t border-dashed border-warning/50" />
                    {previewMin !== null ? `Minimum baru ${min}` : `Minimum ${min}`} — di bawah ini tidak bisa sinkron
                    <span className="h-px flex-1 border-t border-dashed border-warning/50" />
                  </li>
                )}
                <li
                  className="grid grid-cols-[minmax(96px,auto)_minmax(0,1fr)] items-center gap-x-3 gap-y-1 py-1.5 sm:grid-cols-[150px_minmax(0,1fr)_170px]"
                  title={`Build ${b.build}: ${b.devices} perangkat, ${b.businesses} bisnis · terakhir ${formatRelative(b.last_seen_at)}`}
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-[14px]">
                    <span className="font-semibold tabular-nums text-text-heading">{b.build}</span>
                    <span className="truncate text-[13px] text-text-muted">{b.version ? `v${b.version}` : "versi ?"}</span>
                    {b.build === d.latest_build && <Badge tone="success">terbaru</Badge>}
                    {belowPreview && <Badge tone={tone === "danger" ? "danger" : "warning"}>terblokir</Badge>}
                  </span>
                  <span className="text-right text-[13px] tabular-nums text-text-body sm:order-last">
                    <strong className="font-semibold text-text-heading">{b.devices.toLocaleString("id-ID")}</strong> perangkat
                    <span className="text-text-muted"> · {b.businesses.toLocaleString("id-ID")} bisnis</span>
                  </span>
                  <span className="col-span-2 sm:col-span-1">
                    <Meter value={b.devices} max={max} tone={tone} />
                  </span>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
