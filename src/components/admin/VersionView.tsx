"use client";

import React, { useMemo, useState } from "react";
import { CircleCheck, Info, TriangleAlert } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type { AppVersionConfig, AppVersionInput } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  Badge,
  btn,
  ErrorBlock,
  errorMessage,
  Field,
  fieldErrors,
  formatDateTime,
  inputClass,
  LoadingBlock,
  Notice,
  PageHeader,
  Section,
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

  const errors = useMemo(() => ({ ...(touched ? validate(form) : {}), ...serverErrors }), [form, touched, serverErrors]);
  const original = useMemo(() => toForm(config), [config]);
  const dirty = (Object.keys(form) as (keyof Form)[]).some((k) => form[k] !== original[k]);

  const newMin = parseBuild(form.min_build);
  const minRaised = newMin !== null && newMin > config.min_build;

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

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={requestSave} noValidate className="flex flex-col gap-5">
        {result && (
          <Notice tone="success" role="status" icon={<CircleCheck size={18} aria-hidden />} title="Tersimpan">
            Perubahan berlaku untuk aplikasi dalam ±30 detik.
          </Notice>
        )}
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
          {minRaised && !errors.min_build && (
            <div className="mt-4">
              <Notice tone="warning" role="status" icon={<TriangleAlert size={18} aria-hidden />} title={`Build minimum naik ${config.min_build} → ${newMin}`}>
                Pengguna build di bawah {newMin} tidak bisa sinkron sampai memperbarui aplikasi. Pastikan versi baru
                sudah tersedia di Play Store dan sebagai APK langsung.
              </Notice>
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
        title={danger ? "Naikkan build minimum?" : "Simpan pengaturan versi?"}
        confirmLabel={danger ? "Ya, naikkan & simpan" : "Simpan"}
        tone={danger ? "danger" : "primary"}
        busy={busy}
        onConfirm={save}
        onClose={() => setConfirmOpen(false)}
      >
        {danger && (
          <p className="mb-3 rounded-[10px] bg-danger-tint px-3 py-2 font-medium text-danger">
            {serverConfirm ??
              `Pengguna build di bawah ${newMin} tidak bisa sinkron sampai memperbarui aplikasi.`}
          </p>
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
      </ConfirmDialog>
    </div>
  );
}
