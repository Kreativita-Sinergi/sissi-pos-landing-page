"use client";

import React, { useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { Badge, btn, cardClass, EmptyState, errorMessage, Field, formatRupiah, iconBtn, inputClass, Notice, Spinner, Switch } from "@/components/admin/ui";
import { newId } from "@/lib/owner/api";
import {
  byName,
  CONFLICT_MESSAGE,
  createChange,
  dayToIso,
  deleteChange,
  editChange,
  fieldLabel,
  isoToDay,
  LIMITS,
  norm,
  parsePercentBp,
  resultFieldErrors,
  sortCategories,
  type Discount,
} from "@/lib/owner/catalog";
import type { Change } from "@/lib/owner/types";
import { formatDate, zoneLabel } from "@/lib/owner/tz";
import { Check, MoneyInput, reportOutcome, Sheet } from "./bits";
import type { CatalogData, CommitOutcome } from "./useCatalog";
import { Select } from "../Select";

// Master diskon — sama dengan aplikasi (`discount_sheet.dart`): persen (basis poin, maks. 2 desimal) atau nominal;
// cakupan nota/kategori/produk + target; minimum belanja; periode = rentang tanggal penuh (mulai 00:00 s.d. selesai
// 23:59:59) atau "Selalu berlaku" — tidak bisa hanya salah satu; otomatis; aktif. Zona tanggal web = zona usaha (lihat
// `dayToIso`); aplikasi memakai zona perangkat. Aturan pakai (satu diskon otomatis) ditegakkan kasir.

const SCOPES: Record<Discount["scope"], string> = { cart: "Seluruh nota", category: "Kategori", product: "Produk" };

export function discountValue(d: Pick<Discount, "type" | "value">): string {
  return d.type === "percent" ? `${(d.value / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%` : formatRupiah(d.value);
}

export function DiscountsPanel({ data, commit }: { data: CatalogData; commit: (changes: Change[]) => Promise<CommitOutcome> }) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<Discount | null>(null);
  const [busy, setBusy] = useState(false);
  const list = [...data.discounts].sort((a, b) => Number(b.is_active) - Number(a.is_active) || byName(a, b));
  const [now] = useState(() => Date.now());

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      reportOutcome(toast, await commit([deleteChange("discounts", deleting)]), `Diskon "${deleting.name}" dihapus.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-text-body">Diskon otomatis langsung terpasang di kasir; diskon lain dipilih kasir saat transaksi.</p>
        <button type="button" className={btn.primary} onClick={() => setEditing({ id: null, key: Date.now() })}>
          <Plus size={16} aria-hidden /> Diskon
        </button>
      </div>
      <section className={`${cardClass} overflow-hidden`}>
        {list.length === 0 ? (
          <EmptyState icon={<Tag size={22} aria-hidden />} title="Belum ada diskon">
            Buat diskon persen atau nominal, untuk seluruh nota atau produk tertentu.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map((d) => {
              const ended = d.ends_at && Date.parse(d.ends_at) < now;
              const upcoming = d.starts_at && Date.parse(d.starts_at) > now;
              return (
                <li key={d.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="mt-0.5 inline-flex min-w-16 justify-center rounded-[8px] bg-brand-tint px-2 py-1 text-[13px] font-bold text-brand-ink tabular-nums">{discountValue(d)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-semibold">
                      {d.name}
                      {d.auto_apply && <Badge tone="brand">Otomatis</Badge>}
                      {!d.is_active ? <Badge>Nonaktif</Badge> : ended ? <Badge tone="warning">Berakhir</Badge> : upcoming ? <Badge tone="warning">Belum mulai</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-[12.5px] text-text-muted">
                      {SCOPES[d.scope] ?? d.scope}
                      {d.scope !== "cart" && ` (${d.target_ids.length})`}
                      {d.min_purchase > 0 && ` · min. belanja ${formatRupiah(d.min_purchase)}`}
                      {(d.starts_at || d.ends_at) && ` · ${d.starts_at ? formatDate(d.starts_at) : "…"} – ${d.ends_at ? formatDate(d.ends_at) : "…"}`}
                    </p>
                  </div>
                  <button type="button" className={iconBtn} onClick={() => setEditing({ id: d.id, key: Date.now() })} aria-label={`Ubah ${d.name}`} title="Ubah">
                    <Pencil size={16} aria-hidden />
                  </button>
                  <button type="button" className={`${iconBtn} hover:text-danger`} onClick={() => setDeleting(d)} aria-label={`Hapus ${d.name}`} title="Hapus">
                    <Trash2 size={16} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && <DiscountEditor key={editing.key} discountId={editing.id} data={data} commit={commit} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!deleting}
        title={`Hapus diskon "${deleting?.name ?? ""}"?`}
        confirmLabel="Hapus diskon"
        tone="danger"
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        <p>Diskon hilang dari kasir setelah perangkat sinkron. Transaksi lama yang memakainya tidak berubah. Untuk menghentikan sementara, matikan Aktif saja.</p>
      </ConfirmDialog>
    </div>
  );
}

type Form = {
  name: string;
  type: Discount["type"];
  percent: string;
  fixed: number | null;
  scope: Discount["scope"];
  targets: string[];
  minPurchase: number | null;
  start: string;
  end: string;
  auto: boolean;
  active: boolean;
};

function formOf(d: Discount | undefined): Form {
  return {
    name: d?.name ?? "",
    type: d?.type ?? "percent",
    percent: d?.type === "percent" ? String(d.value / 100).replace(".", ",") : "",
    fixed: d?.type === "fixed" ? d.value : null,
    scope: d?.scope ?? "cart",
    targets: d?.target_ids ?? [],
    minPurchase: d?.min_purchase || null,
    start: isoToDay(d?.starts_at),
    end: isoToDay(d?.ends_at),
    auto: d?.auto_apply ?? false,
    active: d?.is_active ?? true,
  };
}

function DiscountEditor({
  discountId,
  data,
  commit,
  onClose,
}: {
  discountId: string | null;
  data: CatalogData;
  commit: (changes: Change[]) => Promise<CommitOutcome>;
  onClose: () => void;
}) {
  const toast = useToast();
  const [id] = useState(() => discountId ?? newId());
  const original = data.discounts.find((d) => d.id === id);
  const [form, setForm] = useState<Form>(() => formOf(original));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const options =
    form.scope === "category"
      ? sortCategories(data.categories).map((c) => ({ id: c.id, name: c.name }))
      : form.scope === "product"
        ? [...data.products].sort(byName).map((p) => ({ id: p.id, name: p.name }))
        : [];
  const known = new Set(options.map((o) => o.id));
  const missing = form.targets.filter((t) => !known.has(t)).length;
  const shown = options.filter((o) => !q || norm(o.name).includes(norm(q))).slice(0, 300);

  async function save() {
    const errs: Record<string, string> = {};
    const n = form.name.trim();
    if (!n) errs.name = "Wajib diisi";
    else if (n.length > LIMITS.discountName) errs.name = `Maksimal ${LIMITS.discountName} karakter`;
    let value = 0;
    if (form.type === "percent") {
      const bp = form.percent.trim() ? parsePercentBp(form.percent) : 0;
      if (bp === null) errs.value = "Isi persen 0–100, maksimal 2 angka desimal.";
      else value = bp;
    } else value = form.fixed ?? 0;
    if (!errs.value && value <= 0) errs.value = "Isi besar potongan.";
    const targets = form.scope === "cart" ? [] : form.targets.filter((t) => known.has(t));
    if (form.scope !== "cart" && !targets.length) errs.target_ids = "Pilih minimal satu kategori atau produk.";
    if (targets.length > LIMITS.discountTargets) errs.target_ids = `Maksimal ${LIMITS.discountTargets}`;
    // Periode = rentang tanggal penuh atau tanpa periode (aplikasi tidak bisa menyimpan hanya salah satu).
    let [start, end] = [form.start, form.end];
    if (!!start !== !!end) errs.ends_at = "Isi tanggal mulai dan selesai, atau hapus periode (Selalu berlaku).";
    if (start && end && end < start) [start, end] = [end, start];
    setErrors(errs);
    setNotice(null);
    if (Object.keys(errs).length) return;

    const fields = {
      name: n,
      type: form.type,
      value,
      scope: form.scope,
      target_ids: targets,
      min_purchase: form.minPurchase ?? 0,
      starts_at: start ? dayToIso(start) : null,
      ends_at: end ? dayToIso(end, true) : null,
      auto_apply: form.auto,
      is_active: form.active,
    };
    const cur = data.discounts.find((d) => d.id === id);
    setBusy(true);
    try {
      const out = await commit([cur ? editChange("discounts", cur, fields) : createChange("discounts", fields, id)]);
      const r = out.results[0];
      if (r?.status === "applied") {
        toast.success(cur ? "Diskon disimpan." : "Diskon ditambahkan.");
        onClose();
      } else if (r?.status === "conflict") {
        setForm(formOf(out.next.discounts.find((d) => d.id === id)));
        setNotice(CONFLICT_MESSAGE);
      } else {
        const fe = resultFieldErrors(r);
        setErrors(fe);
        setNotice(
          Object.entries(fe)
            .map(([k, m]) => (k === "_" ? m : `${fieldLabel(k)}: ${m}`))
            .join(" · ") || "Ditolak server."
        );
      }
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const radio = (name: string, checked: boolean, onPick: () => void, label: string) => (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-[14px]">
      <input type="radio" name={name} checked={checked} onChange={onPick} className="accent-[var(--color-brand-deep)]" /> {label}
    </label>
  );

  return (
    <Sheet
      open
      busy={busy}
      title={original ? "Ubah diskon" : "Tambah diskon"}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={save} disabled={busy}>
            {busy && <Spinner />} Simpan
          </button>
        </>
      }
    >
      <form
        className="space-y-5"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {notice && (
          <Notice tone="warning" role="alert">
            {notice}
          </Notice>
        )}
        <Field id="dc-name" label="Nama diskon" error={errors.name}>
          <input id="dc-name" className={inputClass} value={form.name} placeholder="Mis. Promo gajian" maxLength={LIMITS.discountName} onChange={(e) => set("name", e.target.value)} aria-invalid={!!errors.name || undefined} autoFocus={!original} />
        </Field>
        <fieldset>
          <legend className="sr-only">Jenis potongan</legend>
          <div className="flex gap-5">
            {radio("dc-type", form.type === "percent", () => setForm((f) => ({ ...f, type: "percent", percent: "", fixed: null })), "Persen")}
            {radio("dc-type", form.type === "fixed", () => setForm((f) => ({ ...f, type: "fixed", percent: "", fixed: null })), "Nominal")}
          </div>
        </fieldset>
        <Field id="dc-value" label="Besar potongan" error={errors.value}>
          {form.type === "percent" ? (
            <input
              id="dc-value"
              className={`${inputClass} max-w-[160px] tabular-nums`}
              inputMode="decimal"
              placeholder="10"
              value={form.percent}
              onChange={(e) => set("percent", e.target.value)}
              aria-invalid={!!errors.value || undefined}
            />
          ) : (
            <MoneyInput id="dc-value" className="max-w-[220px]" value={form.fixed} onChange={(v) => set("fixed", v)} invalid={!!errors.value} />
          )}
        </Field>
        <Field id="dc-scope" label="Berlaku untuk" error={errors.target_ids}>
          <Select
            id="dc-scope"
            className="max-w-[280px]"
            value={form.scope}
            onChange={(v) => {
              setForm((f) => ({ ...f, scope: v, targets: [] }));
              setQ("");
            }}
            options={(Object.keys(SCOPES) as Discount["scope"][]).map((s) => ({ value: s, label: SCOPES[s] }))}
          />
        </Field>
        {form.scope !== "cart" && (
          <div className="rounded-[12px] border border-border-subtle">
            <div className="flex flex-wrap items-center gap-2 border-b border-border-subtle p-2">
              <input
                aria-label={form.scope === "category" ? "Cari kategori" : "Cari produk"}
                className={`${inputClass} min-h-9 flex-1`}
                placeholder={form.scope === "category" ? "Cari kategori" : "Cari produk"}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <span className="text-[12.5px] text-text-muted tabular-nums">{form.targets.filter((t) => known.has(t)).length} dipilih</span>
            </div>
            <div className="max-h-[260px] overflow-y-auto px-3 py-1.5">
              {shown.length === 0 ? (
                <p className="py-3 text-[13px] text-text-muted">{options.length ? "Tidak ada yang cocok." : form.scope === "category" ? "Belum ada kategori." : "Belum ada produk."}</p>
              ) : (
                shown.map((o) => (
                  <div key={o.id}>
                    <Check
                      checked={form.targets.includes(o.id)}
                      onChange={(on) => set("targets", on ? [...form.targets, o.id] : form.targets.filter((x) => x !== o.id))}
                      label={o.name}
                    />
                  </div>
                ))
              )}
            </div>
            {missing > 0 && <p className="border-t border-border-subtle px-3 py-2 text-[12.5px] text-warning">{missing} target sudah dihapus dan akan dibuang saat disimpan.</p>}
          </div>
        )}
        <Field id="dc-min" label="Minimum belanja" hint="0 = tanpa minimum. Untuk kategori/produk, dihitung dari barang yang terkena.">
          <MoneyInput id="dc-min" className="max-w-[220px]" value={form.minPurchase} onChange={(v) => set("minPurchase", v)} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-semibold">Periode berlaku</legend>
          <div className="grid grid-cols-2 gap-3 sm:max-w-[420px]">
            <Field id="dc-start" label="Mulai">
              <input id="dc-start" type="date" className={`${inputClass} tabular-nums`} value={form.start} onChange={(e) => set("start", e.target.value)} aria-invalid={!!errors.ends_at || undefined} />
            </Field>
            <Field id="dc-end" label="Selesai">
              <input id="dc-end" type="date" className={`${inputClass} tabular-nums`} value={form.end} onChange={(e) => set("end", e.target.value)} aria-invalid={!!errors.ends_at || undefined} />
            </Field>
          </div>
          {errors.ends_at ? (
            <p className="mt-1.5 text-[13px] text-danger">{errors.ends_at}</p>
          ) : (
            <p className="mt-1.5 text-[13px] text-text-muted">
              {form.start && form.end ? `Berlaku dari awal tanggal mulai sampai akhir tanggal selesai (${zoneLabel()}).` : "Kosong = Selalu berlaku."}
            </p>
          )}
          {(form.start || form.end) && (
            <button type="button" className={`${btn.ghost} -ml-2 mt-1 min-h-8 px-2 text-[13px]`} onClick={() => setForm((f) => ({ ...f, start: "", end: "" }))}>
              Hapus periode
            </button>
          )}
        </fieldset>
        <Switch
          id="dc-auto"
          checked={form.auto}
          onChange={(v) => set("auto", v)}
          label="Pakai otomatis"
          description="Hanya satu diskon otomatis per nota: minimum belanja tertinggi yang terpenuhi."
        />
        <Switch id="dc-active" checked={form.active} onChange={(v) => set("active", v)} label="Aktif" />
        <button type="submit" className="sr-only" tabIndex={-1}>
          Simpan
        </button>
      </form>
    </Sheet>
  );
}
