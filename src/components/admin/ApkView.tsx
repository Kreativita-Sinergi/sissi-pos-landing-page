"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import { CircleCheck, Download, FileUp, TriangleAlert, Trash2, Upload, X } from "lucide-react";
import { adminApi, type UploadHandle } from "@/lib/admin/api";
import type { ApkAbi, Release, ReleaseList, UploadApkResult } from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { ConfirmDialog } from "./ConfirmDialog";
import {
  Badge,
  btn,
  CopyButton,
  ErrorBlock,
  errorMessage,
  Field,
  fieldErrors,
  focusRing,
  formatBytes,
  formatDateTime,
  iconBtn,
  inputClass,
  LoadingBlock,
  Notice,
  PageHeader,
  Section,
  shortHash,
  Spinner,
  useLoad,
} from "./ui";

// Unggah APK langsung browser → API (bukan lewat Vercel yang membatasi body 4,5 MB) dengan progres XHR,
// lalu daftar rilis di folder /unduh (terbaru + 3 lama) dengan hapus versi lama.

const MAX_BYTES = 200 * 1024 * 1024;
const NAME_RE = /^sissi-pos-(\d{1,3}\.\d{1,3}\.\d{1,3})\+(\d+)-(arm64|armv7)\.apk$/;
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const SHA_RE = /^[0-9a-fA-F]{64}$/;

export function ApkView() {
  const { state, reload } = useLoad<ReleaseList>(async (signal) => (await adminApi()).releases(signal), []);
  return (
    <>
      <PageHeader
        title="APK langsung"
        description="Unduhan untuk HP tanpa Google Play, disajikan di apipos.sissi.id/unduh. Server menyimpan versi terbaru dan 3 versi lama."
      />
      <div className="flex flex-col gap-5">
        <UploadForm onUploaded={reload} />
        <Section title="Rilis tersimpan" bodyClass="">
          {state.status === "error" && !state.data && (
            <div className="p-4">
              <ErrorBlock error={state.error} onRetry={reload} />
            </div>
          )}
          {state.status === "loading" && !state.data && <LoadingBlock />}
          {state.data && <ReleaseTable releases={state.data.releases} onChanged={reload} />}
        </Section>
      </div>
    </>
  );
}

type Form = { version: string; build: string; abi: ApkAbi; sha256: string; makeLatest: boolean; updateVersion: boolean };

const EMPTY: Form = { version: "", build: "", abi: "arm64", sha256: "", makeLatest: true, updateVersion: false };

function UploadForm({ onUploaded }: { onUploaded: () => void }) {
  const fileId = useId();
  const jsonRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [handle, setHandle] = useState<UploadHandle | null>(null);
  const [done, setDone] = useState<UploadApkResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [jsonNote, setJsonNote] = useState<string | null>(null);

  const uploading = handle !== null;

  // Tutup tab saat unggah → peringatan peramban.
  useEffect(() => {
    if (!uploading) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [uploading]);

  function pickFile(f: File | null) {
    setDone(null);
    setFailure(null);
    setErrors({});
    setFile(f);
    if (!f) return;
    const m = NAME_RE.exec(f.name);
    if (m) setForm((s) => ({ ...s, version: m[1], build: m[2], abi: m[3] as ApkAbi }));
  }

  async function readLatestJson(f: File | null) {
    setJsonNote(null);
    if (!f) return;
    try {
      const j = JSON.parse(await f.text()) as { version?: unknown; build?: unknown; sha256?: unknown; file?: unknown };
      setForm((s) => ({
        ...s,
        version: typeof j.version === "string" ? j.version : s.version,
        build: typeof j.build === "number" || typeof j.build === "string" ? String(j.build) : s.build,
        sha256: typeof j.sha256 === "string" ? j.sha256 : s.sha256,
        abi: typeof j.file === "string" && j.file.includes("-armv7") ? "armv7" : s.abi,
      }));
      setJsonNote(
        typeof j.file === "string" && file && j.file !== file.name
          ? `Diisi dari latest.json, tetapi nama berkas di sana (${j.file}) berbeda dengan APK yang dipilih.`
          : "Versi, build, dan SHA-256 diisi dari latest.json."
      );
    } catch {
      setJsonNote("Berkas bukan latest.json yang sah.");
    }
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!file) e.file = "Pilih berkas APK.";
    else if (!file.name.toLowerCase().endsWith(".apk")) e.file = "Berkas harus berekstensi .apk.";
    else if (file.size > MAX_BYTES) e.file = `Maksimal 200 MB (berkas ini ${formatBytes(file.size)}).`;
    if (!VERSION_RE.test(form.version.trim())) e.version = "Format x.y.z, mis. 1.4.3.";
    if (!/^\d+$/.test(form.build.trim()) || Number(form.build) <= 0 || Number(form.build) > 2_100_000_000)
      e.build = "Bilangan bulat lebih dari 0.";
    if (form.sha256.trim() && !SHA_RE.test(form.sha256.trim())) e.sha256 = "64 karakter heksadesimal.";
    return e;
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setFailure(null);
    setDone(null);
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0 || !file) return;
    const api = await adminApi();
    setProgress({ loaded: 0, total: file.size });
    const h = api.uploadApk(
      {
        file,
        version: form.version.trim(),
        build: Number(form.build),
        abi: form.abi,
        sha256: form.sha256.trim(),
        make_latest: form.makeLatest,
        update_app_version: form.updateVersion,
      },
      (loaded, total) => setProgress({ loaded, total })
    );
    setHandle(h);
    try {
      const res = await h.promise;
      setDone(res);
      setFile(null);
      setForm(EMPTY);
      setJsonNote(null);
      if (fileRef.current) fileRef.current.value = "";
      onUploaded();
    } catch (err) {
      if (err instanceof ApiError && err.code === "ABORTED") setFailure("Unggahan dibatalkan.");
      else {
        setErrors(fieldErrors(err));
        setFailure(uploadErrorMessage(err));
      }
    } finally {
      setHandle(null);
      setProgress(null);
    }
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((s) => ({ ...s, [k]: v }));
  const pct = progress && progress.total > 0 ? Math.min(100, Math.round((progress.loaded / progress.total) * 100)) : 0;
  const sent = progress !== null && pct >= 100;

  return (
    <Section title="Unggah APK" description="APK rilis bertanda tangan dari tool/build_apk.sh. Maks 200 MB.">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {done && (
          <Notice tone="success" role="status" icon={<CircleCheck size={18} aria-hidden />} title="APK diterbitkan">
            <span className="break-all">{done.release.file}</span> ({formatBytes(done.release.size_bytes)})
            {done.release.is_latest ? " kini menjadi unduhan terbaru." : " tersedia lewat URL bernomor."}
            {done.app_version && ` Pengaturan versi ikut diperbarui ke ${done.app_version.latest_version} (build ${done.app_version.latest_build}).`}
          </Notice>
        )}
        {done?.warnings?.map((w) => (
          <Notice key={w} tone="warning" icon={<TriangleAlert size={18} aria-hidden />}>
            {w}
          </Notice>
        ))}
        {failure && (
          <Notice tone="danger" role="alert" icon={<TriangleAlert size={18} aria-hidden />} title="Unggahan gagal">
            {failure}
          </Notice>
        )}

        <div>
          <label
            htmlFor={fileId}
            onDragOver={(e) => {
              e.preventDefault();
              if (!uploading) setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (!uploading) pickFile(e.dataTransfer.files[0] ?? null);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-[12px] border-2 border-dashed px-4 py-6 text-center transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-primary ${
              errors.file ? "border-danger/50 bg-danger-tint/40" : drag ? "border-brand-primary bg-brand-tint" : "border-border-subtle bg-bg-muted/60 hover:border-border-active"
            } ${uploading ? "pointer-events-none opacity-60" : ""}`}
          >
            <FileUp size={22} aria-hidden className="text-text-muted" />
            {file ? (
              <>
                <span className="max-w-full break-all text-[14px] font-semibold text-text-heading">{file.name}</span>
                <span className="text-[13px] text-text-muted">{formatBytes(file.size)} · klik untuk mengganti</span>
              </>
            ) : (
              <>
                <span className="text-[14px] font-semibold text-text-heading">Pilih atau seret berkas .apk</span>
                <span className="text-[13px] text-text-muted">Nama sissi-pos-x.y.z+build-abi.apk mengisi versi otomatis</span>
              </>
            )}
            <input
              ref={fileRef}
              id={fileId}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              aria-invalid={!!errors.file}
              aria-describedby={errors.file ? `${fileId}-error` : undefined}
            />
          </label>
          {errors.file && (
            <p id={`${fileId}-error`} className="mt-1.5 text-[13px] text-danger">
              {errors.file}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <Field id="apk-version" label="Versi" error={errors.version}>
            <input
              id="apk-version"
              className={inputClass}
              value={form.version}
              onChange={(e) => set("version", e.target.value)}
              placeholder="1.4.3"
              inputMode="decimal"
              disabled={uploading}
              aria-invalid={!!errors.version}
              aria-describedby={errors.version ? "apk-version-error" : undefined}
            />
          </Field>
          <Field id="apk-build" label="Build" error={errors.build}>
            <input
              id="apk-build"
              className={`${inputClass} tabular-nums`}
              value={form.build}
              onChange={(e) => set("build", e.target.value)}
              placeholder="43"
              inputMode="numeric"
              disabled={uploading}
              aria-invalid={!!errors.build}
              aria-describedby={errors.build ? "apk-build-error" : undefined}
            />
          </Field>
          <fieldset className="col-span-2 sm:col-span-1">
            <legend className="mb-1.5 text-[13px] font-semibold text-text-heading">ABI</legend>
            <div className="inline-flex rounded-[10px] border border-border-subtle bg-bg-muted p-0.5">
              {(["arm64", "armv7"] as const).map((abi) => (
                <label
                  key={abi}
                  className={`inline-flex min-h-9 cursor-pointer items-center rounded-[8px] px-3.5 text-[14px] font-medium focus-within:outline-2 focus-within:outline-brand-primary ${
                    form.abi === abi ? "bg-white text-text-heading shadow-sm" : "text-text-body"
                  }`}
                >
                  <input
                    type="radio"
                    name="abi"
                    value={abi}
                    checked={form.abi === abi}
                    onChange={() => set("abi", abi)}
                    disabled={uploading}
                    className="sr-only"
                  />
                  {abi}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <Field
          id="apk-sha"
          label="SHA-256 (opsional)"
          error={errors.sha256}
          hint={
            jsonNote ?? (
              <>
                Bila diisi, server menolak berkas yang tidak cocok.{" "}
                <button
                  type="button"
                  className={`font-semibold text-brand-ink underline underline-offset-2 ${focusRing}`}
                  onClick={() => jsonRef.current?.click()}
                  disabled={uploading}
                >
                  Isi dari latest.json
                </button>
              </>
            )
          }
        >
          <input
            id="apk-sha"
            className={`${inputClass} font-mono text-[13px]`}
            value={form.sha256}
            onChange={(e) => set("sha256", e.target.value)}
            spellCheck={false}
            autoComplete="off"
            disabled={uploading}
            aria-invalid={!!errors.sha256}
            aria-describedby={errors.sha256 ? "apk-sha-error" : "apk-sha-hint"}
          />
        </Field>
        <input
          ref={jsonRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            void readLatestJson(e.target.files?.[0] ?? null);
            e.target.value = "";
          }}
        />

        <div className="flex flex-col gap-2.5">
          <Check
            checked={form.makeLatest}
            onChange={(v) => set("makeLatest", v)}
            disabled={uploading}
            label="Jadikan versi terbaru"
            hint="Mengganti sissi-pos-latest.apk dan latest.json (halaman /download)."
          />
          <Check
            checked={form.updateVersion}
            onChange={(v) => set("updateVersion", v)}
            disabled={uploading}
            label="Sekaligus perbarui pengaturan versi"
            hint="Mengisi versi & build terbaru di Versi aplikasi. Build minimum tidak berubah."
          />
        </div>

        {progress && (
          <div className="rounded-[12px] border border-border-subtle bg-bg-muted/60 p-3.5">
            <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
              <span className="font-semibold text-text-heading">
                {sent ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={14} /> Memverifikasi APK di server…
                  </span>
                ) : (
                  `Mengunggah ${pct}%`
                )}
              </span>
              <span className="tabular-nums text-text-muted">
                {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Progres unggah"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={pct}
              className="h-2 overflow-hidden rounded-full bg-border-subtle"
            >
              <div className="h-full rounded-full bg-brand-deep transition-[width] duration-200" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {uploading && (
            <button type="button" className={btn.secondary} onClick={() => handle?.abort()} disabled={sent}>
              <X size={16} aria-hidden /> Batalkan
            </button>
          )}
          <button type="submit" className={btn.primary} disabled={uploading}>
            {uploading ? <Spinner /> : <Upload size={16} aria-hidden />}
            {uploading ? "Mengunggah…" : "Unggah & terbitkan"}
          </button>
        </div>
      </form>
    </Section>
  );
}

function Check({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className={`mt-0.5 h-[18px] w-[18px] shrink-0 accent-brand-deep ${focusRing}`}
      />
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold text-text-heading">{label}</span>
        <span className="block text-[13px] text-text-muted">{hint}</span>
      </span>
    </label>
  );
}

function uploadErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return errorMessage(err);
  switch (err.code) {
    case "INVALID_APK": {
      const d = err.details.map((x) => x.message).join(" ");
      return `Berkas ditolak: bukan APK sah/bertanda tangan, atau package/versi di manifest tidak cocok dengan isian.${d ? ` ${d}` : ""}`;
    }
    case "APK_HASH_MISMATCH":
      return "SHA-256 berkas berbeda dengan isian. Pastikan berkas dan latest.json dari build yang sama.";
    case "RELEASE_EXISTS":
      return "Versi + build + ABI ini sudah pernah diunggah. Naikkan build bila ingin menerbitkan ulang.";
    case "FILE_TOO_LARGE":
      return "Berkas melebihi batas 200 MB.";
    case "STORAGE_UNAVAILABLE":
      return "Penyimpanan rilis di server tidak bisa ditulis atau ruang disk kurang.";
    default:
      return errorMessage(err);
  }
}

function ReleaseTable({ releases, onChanged }: { releases: Release[]; onChanged: () => void }) {
  const [target, setTarget] = useState<Release | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await (await adminApi()).deleteRelease(target.file);
      setTarget(null);
      onChanged();
    } catch (err) {
      setTarget(null);
      setError(
        err instanceof ApiError && err.code === "RELEASE_IN_USE"
          ? "Versi ini sedang menjadi unduhan terbaru, tidak bisa dihapus."
          : errorMessage(err)
      );
    } finally {
      setBusy(false);
    }
  }

  if (releases.length === 0) {
    return <p className="px-5 py-8 text-center text-[14px] text-text-muted">Belum ada APK di server.</p>;
  }

  return (
    <>
      {error && (
        <div className="px-4 pt-4 sm:px-5">
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        </div>
      )}
      <ul className="divide-y divide-border-subtle">
        {releases.map((r) => (
          <li key={r.file} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 gap-y-1.5 px-4 py-3.5 sm:px-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-semibold text-text-heading">{r.version}</span>
                <span className="text-[13px] text-text-muted">
                  build {r.build} · {r.abi}
                </span>
                {r.is_latest && <Badge tone="success">Terbaru</Badge>}
              </div>
              <p className="mt-0.5 text-[13px] text-text-muted">
                {formatBytes(r.size_bytes)} · {formatDateTime(r.released_at)}
                {r.uploaded_by ? ` · ${r.uploaded_by.name}` : " · lewat skrip"}
              </p>
            </div>
            <div className="col-span-2 row-start-2 flex min-w-0 items-center gap-1 md:col-span-1 md:col-start-2 md:row-start-1">
              <span className="shrink-0 text-[12px] font-semibold text-text-muted">SHA-256</span>
              {r.sha256 ? (
                <>
                  <code className="min-w-0 truncate px-1 font-mono text-[12.5px] text-text-body" title={r.sha256}>
                    {shortHash(r.sha256)}
                  </code>
                  <CopyButton value={r.sha256} label={`Salin SHA-256 ${r.version}`} />
                </>
              ) : (
                <span className="px-1 text-[13px] text-text-muted">tidak tercatat</span>
              )}
            </div>
            <div className="col-start-2 row-start-1 flex items-center gap-1 self-start md:col-start-3 md:self-center md:justify-end">
              <a
                href={r.url}
                className={iconBtn}
                aria-label={`Unduh ${r.file}`}
                title="Unduh"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download size={16} aria-hidden />
              </a>
              <button
                type="button"
                className={`${iconBtn} hover:text-danger`}
                onClick={() => setTarget(r)}
                disabled={r.is_latest}
                aria-label={r.is_latest ? `${r.file} sedang menjadi unduhan terbaru` : `Hapus ${r.file}`}
                title={r.is_latest ? "Unduhan terbaru tidak bisa dihapus" : "Hapus"}
              >
                <Trash2 size={16} aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        title="Hapus APK ini?"
        confirmLabel="Hapus"
        tone="danger"
        busy={busy}
        onConfirm={remove}
        onClose={() => setTarget(null)}
      >
        {target && (
          <>
            <span className="font-semibold break-all text-text-heading">{target.file}</span> akan dihapus dari server.
            Tautan bernomor versi ini berhenti berfungsi. Tindakan ini tidak bisa dibatalkan.
          </>
        )}
      </ConfirmDialog>
    </>
  );
}
