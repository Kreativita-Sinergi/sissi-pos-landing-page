"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { useToast } from "@/components/admin/toast";
import { btn, cardClass, errorMessage, focusRing, inputClass, Notice, Spinner } from "@/components/admin/ui";
import { saveErrorText, type SaveOutcome } from "@/lib/owner/records";
import { bpToPercentText, intText, percentTextToBp } from "@/lib/owner/settings";
import type { SyncRecord } from "@/lib/owner/types";
import { ConfirmCancelled } from "./ConfirmIdentityDialog";

// Komponen bersama untuk formulir kelola data dasbor pemilik (Pelanggan, Pengaturan).

/**
 * Draf formulir di atas nilai server `base`. Bila `base` berubah dari luar (mis. bagian lain disimpan) dan draf belum
 * diubah, draf ikut. `dirty` = draf berbeda dari `base`; selama dirty, menutup tab memunculkan peringatan browser.
 */
export function useDraft<T>(base: T) {
  const baseKey = JSON.stringify(base);
  const [draft, setDraft] = useState<T>(base);
  const [prevKey, setPrevKey] = useState(baseKey);
  if (baseKey !== prevKey) {
    if (JSON.stringify(draft) === prevKey) setDraft(base);
    setPrevKey(baseKey);
  }
  const dirty = JSON.stringify(draft) !== baseKey;
  useUnsavedWarning(dirty);
  return { draft, setDraft, dirty, reset: () => setDraft(base) };
}

export function useUnsavedWarning(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [active]);
}

/** Kartu satu bagian pengaturan dengan tombol Simpan sendiri. */
export function EditSection({
  id,
  title,
  description,
  dirty,
  saving,
  canSave = true,
  error,
  onSave,
  onReset,
  children,
  aside,
}: {
  id?: string;
  title: string;
  description?: React.ReactNode;
  dirty: boolean;
  saving: boolean;
  /** false = ada isian tidak sah (tombol Simpan mati). */
  canSave?: boolean;
  error?: React.ReactNode;
  onSave: () => void;
  onReset: () => void;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section id={id} className={`${cardClass} scroll-mt-20`} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 id={id ? `${id}-title` : undefined} className="text-[15px] font-semibold text-text-heading">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] leading-relaxed text-text-muted">{description}</p>}
        </div>
        {aside}
      </div>
      <form
        className="p-4 sm:p-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (dirty && canSave && !saving) onSave();
        }}
      >
        <div className="flex flex-col gap-4">{children}</div>
        {error && (
          <div className="mt-4">
            <Notice tone="danger" role="alert" icon={<AlertTriangle size={18} aria-hidden />}>
              {error}
            </Notice>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-border-subtle pt-4">
          <p className="mr-auto text-[13px] text-text-muted" aria-live="polite">
            {dirty ? (
              <span className="font-semibold text-warning">Perubahan belum disimpan</span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <Check size={14} aria-hidden /> Tersimpan
              </span>
            )}
          </p>
          {dirty && (
            <button type="button" className={btn.ghost} onClick={onReset} disabled={saving}>
              Batalkan
            </button>
          )}
          <button type="submit" className={btn.primary} disabled={!dirty || !canSave || saving}>
            {saving && <Spinner />}
            Simpan
          </button>
        </div>
      </form>
    </section>
  );
}

/**
 * Isian angka dengan teks lokal (boleh sementara tidak sah saat mengetik). `kind: "percent"` = nilai basis poin,
 * ditulis sebagai persen ("11,5"). Teks tidak sah → `onChange(NaN)` (pemanggil menandai tidak sah).
 */
export function NumberInput({
  id,
  value,
  onChange,
  kind = "int",
  suffix,
  prefix,
  invalid,
  describedBy,
  className = "",
  placeholder,
}: {
  id: string;
  value: number;
  onChange: (v: number) => void;
  kind?: "int" | "percent";
  suffix?: string;
  prefix?: string;
  invalid?: boolean;
  describedBy?: string;
  className?: string;
  placeholder?: string;
}) {
  const fmt = (n: number) => (Number.isNaN(n) ? "" : kind === "percent" ? bpToPercentText(n) : String(n));
  const parse = kind === "percent" ? percentTextToBp : intText;
  const [text, setText] = useState(() => fmt(value));
  const [synced, setSynced] = useState(value);
  if (!Object.is(value, synced)) {
    setSynced(value);
    const p = parse(text);
    const same = Number.isNaN(value) ? p === null : p === value;
    if (!same) setText(fmt(value));
  }
  return (
    <div className={`relative ${className}`}>
      {prefix && (
        <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-text-muted">
          {prefix}
        </span>
      )}
      <input
        id={id}
        inputMode={kind === "percent" ? "decimal" : "numeric"}
        autoComplete="off"
        className={`${inputClass} tabular-nums ${prefix ? "pl-9" : ""} ${suffix ? "pr-10" : ""}`}
        value={text}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => {
          setText(e.target.value);
          const n = parse(e.target.value);
          onChange(n === null ? NaN : n);
        }}
      />
      {suffix && (
        <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[14px] text-text-muted">
          {suffix}
        </span>
      )}
    </div>
  );
}

/** Grup tombol pilihan (centang ganda) — mis. jenis pesanan, hari libur. */
export function ChipGroup<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (next: T[]) => void;
  disabled?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.value);
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              on ? "border-brand-primary bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-body hover:border-border-active"
            } ${focusRing}`}
          >
            {on && <Check size={14} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Pilihan tunggal bergaya segmen (mis. 58/80 mm). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[10px] border border-border-subtle bg-bg-muted p-0.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-h-9 rounded-[8px] px-3.5 text-[13.5px] font-semibold transition-colors ${
              on ? "bg-white text-text-heading shadow-[0_1px_2px_rgba(16,24,40,0.12)]" : "text-text-body hover:text-text-heading"
            } ${focusRing}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Simpan + umpan balik standar (applied/conflict/rejected) untuk satu bagian. */
export function useSaver(onRecord: (r: SyncRecord) => void) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<React.ReactNode>(null);
  const run = async (fn: () => Promise<SaveOutcome>, okText: string, onConflict: (r: SyncRecord) => void) => {
    setSaving(true);
    setError(null);
    try {
      const r = await fn();
      if (r.status === "applied") {
        if (r.record) onRecord(r.record);
        toast.success(okText);
      } else if (r.status === "conflict") {
        if (r.record) {
          onRecord(r.record);
          onConflict(r.record);
        }
        setError(r.message);
        toast.error(r.message);
      } else {
        if (r.record) onRecord(r.record);
        setError(
          <>
            <p>{r.message}</p>
            {r.details.length > 0 && (
              <ul className="mt-1 list-disc pl-5">
                {r.details.map((d) => (
                  <li key={`${d.field}-${d.message}`}>{d.message}</li>
                ))}
              </ul>
            )}
          </>
        );
      }
    } catch (err) {
      if (err instanceof ConfirmCancelled) setError("Perubahan belum disimpan: konfirmasi kata sandi dibatalkan.");
      else setError(saveErrorText(err, errorMessage));
    } finally {
      setSaving(false);
    }
  };
  return { saving, error, run, clearError: () => setError(null) };
}
