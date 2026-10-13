"use client";

import React, { useState } from "react";
import { ArrowRight } from "lucide-react";
import { btn, errorMessage, Field, formatRupiah, inputClass, Notice, Spinner, tdClass, thClass } from "@/components/admin/ui";
import {
  applyPriceOp,
  cheapestPrice,
  editChange,
  resultMessage,
  sortCategories,
  summarize,
  type PriceOp,
  type Product,
  type ResultSummary,
} from "@/lib/owner/catalog";
import type { Change, ChangeResult } from "@/lib/owner/types";
import { ProgressBar, ResultCounts, Sheet } from "./bits";
import type { CatalogData, CommitOutcome } from "./useCatalog";
import { Select } from "../Select";

// Edit massal produk terpilih: harga (set / ±% / ±Rp + pembulatan), kategori, atau status aktif.
// Alur: isi aturan → pratinjau (hanya baris yang berubah) → kirim per 200 dengan progres → ringkasan hasil.

type Action = "price" | "category" | "status";
type Step = "form" | "preview" | "sending" | "done";
type PreviewRow = { key: string; name: string; sub?: string; before: string; after: string; change: Change };

const ROUNDS: { value: PriceOp["round"]; label: string }[] = [
  { value: 0, label: "Tanpa pembulatan" },
  { value: 100, label: "Kelipatan Rp100" },
  { value: 500, label: "Kelipatan Rp500" },
  { value: 1000, label: "Kelipatan Rp1.000" },
];

export function BulkEdit({
  ids,
  data,
  commit,
  onClose,
  onDone,
}: {
  ids: string[];
  data: CatalogData;
  commit: (changes: Change[], onProgress?: (done: number) => void) => Promise<CommitOutcome>;
  onClose: () => void;
  onDone: () => void;
}) {
  const [action, setAction] = useState<Action>("price");
  const [kind, setKind] = useState<PriceOp["kind"]>("pct");
  const [amount, setAmount] = useState("");
  const [round, setRound] = useState<PriceOp["round"]>(0);
  const [categoryId, setCategoryId] = useState("");
  const [active, setActive] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [failures, setFailures] = useState<{ name: string; message: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const selected = ids.map((id) => data.products.find((p) => p.id === id)).filter((p): p is Product => !!p);
  const anyVariants = selected.some((p) => data.variants.some((v) => v.product_id === p.id));
  const categories = sortCategories(data.categories);
  const catName = (id: string | null) => (id ? (data.categories.find((c) => c.id === id)?.name ?? "—") : "Tanpa kategori");

  function parseAmount(): number | null {
    const t = amount.trim().replace(/\s/g, "");
    if (!t) return null;
    if (kind === "pct") {
      const n = Number(t.replace(",", "."));
      return Number.isFinite(n) && n > -100 && n <= 1000 ? n : null;
    }
    const neg = t.startsWith("-");
    const digits = t.replace(/\D/g, "");
    if (!digits) return null;
    const n = Number(digits) * (neg && kind === "rp" ? -1 : 1);
    return Number.isFinite(n) ? n : null;
  }

  function buildPreview(): PreviewRow[] | string {
    const out: PreviewRow[] = [];
    if (action === "price") {
      const a = parseAmount();
      if (a === null) return kind === "pct" ? "Isi persen antara -99 dan 1000." : "Isi nominal rupiah.";
      const op: PriceOp = { kind, amount: a, round };
      for (const p of selected) {
        const variants = data.variants.filter((x) => x.product_id === p.id);
        // Produk bervarian (seperti aplikasi): harga diubah per varian, harga produk = harga varian aktif termurah.
        const nextVariants = variants.map((v) => ({ v, price: applyPriceOp(v.price, op) }));
        const np = variants.length ? (cheapestPrice(nextVariants.map((x) => ({ price: x.price, is_active: x.v.is_active }))) ?? p.price) : applyPriceOp(p.price, op);
        if (np !== p.price)
          out.push({ key: p.id, name: p.name, before: formatRupiah(p.price), after: formatRupiah(np), change: editChange("products", p, { price: np }) });
        for (const { v, price: nv } of nextVariants) {
          if (nv !== v.price)
            out.push({ key: v.id, name: p.name, sub: v.name, before: formatRupiah(v.price), after: formatRupiah(nv), change: editChange("product_variants", v, { price: nv }) });
        }
      }
    } else if (action === "category") {
      const target = categoryId || null;
      for (const p of selected)
        if ((p.category_id ?? null) !== target)
          out.push({ key: p.id, name: p.name, before: catName(p.category_id), after: catName(target), change: editChange("products", p, { category_id: target }) });
    } else {
      for (const p of selected)
        if (p.is_active !== active)
          out.push({
            key: p.id,
            name: p.name,
            before: p.is_active ? "Aktif" : "Nonaktif",
            after: active ? "Aktif" : "Nonaktif",
            change: editChange("products", p, { is_active: active }),
          });
    }
    return out;
  }

  function preview() {
    const r = buildPreview();
    if (typeof r === "string") {
      setError(r);
      return;
    }
    setError(null);
    setRows(r);
    setStep("preview");
  }

  async function send() {
    setStep("sending");
    setProgress(0);
    setError(null);
    try {
      const out = await commit(
        rows.map((r) => r.change),
        setProgress
      );
      const names = new Map(rows.map((r) => [r.key, r.sub ? `${r.name} — ${r.sub}` : r.name]));
      setSummary(out.summary);
      setFailures(
        out.results
          .filter((r: ChangeResult) => r.status !== "applied")
          .map((r) => ({ name: names.get(r.id) ?? r.id, message: resultMessage(r) }))
      );
      setStep("done");
    } catch (err) {
      setError(`${errorMessage(err)} Sebagian perubahan mungkin sudah tersimpan — data dimuat ulang.`);
      setSummary(summarize([]));
      setStep("done");
    }
  }

  const sending = step === "sending";
  const close = () => {
    if (step === "done") onDone();
    onClose();
  };
  const radio = (value: Action, label: string) => (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 text-[14px]">
      <input type="radio" name="bulk-action" checked={action === value} onChange={() => setAction(value)} className="accent-[var(--color-brand-deep)]" />
      {label}
    </label>
  );

  return (
    <Sheet
      open
      busy={sending}
      title={`Edit massal · ${selected.length.toLocaleString("id-ID")} produk`}
      subtitle="Perubahan dikirim ke server lalu diterima perangkat kasir saat sinkron."
      onClose={close}
      footer={
        step === "form" ? (
          <>
            <button type="button" className={btn.secondary} onClick={onClose}>
              Batal
            </button>
            <button type="button" className={btn.primary} onClick={preview} disabled={!selected.length}>
              Pratinjau <ArrowRight size={16} aria-hidden />
            </button>
          </>
        ) : step === "preview" ? (
          <>
            <button type="button" className={btn.secondary} onClick={() => setStep("form")}>
              Kembali
            </button>
            <button type="button" className={btn.primary} onClick={send} disabled={!rows.length}>
              Terapkan {rows.length.toLocaleString("id-ID")} perubahan
            </button>
          </>
        ) : step === "sending" ? (
          <button type="button" className={btn.primary} disabled>
            <Spinner /> Mengirim…
          </button>
        ) : (
          <button type="button" className={btn.primary} onClick={close}>
            Selesai
          </button>
        )
      }
    >
      {error && (
        <div className="mb-4">
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        </div>
      )}

      {step === "form" && (
        <div className="space-y-5">
          <fieldset>
            <legend className="mb-2 text-[14px] font-semibold">Yang diubah</legend>
            <div className="flex flex-wrap gap-x-5">
              {radio("price", "Harga")}
              {radio("category", "Kategori")}
              {radio("status", "Status aktif")}
            </div>
          </fieldset>

          {action === "price" && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field id="bulk-kind" label="Cara">
                  <Select
                    id="bulk-kind"
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: "pct", label: "Naik/turun persen" },
                      { value: "rp", label: "Naik/turun rupiah" },
                      { value: "set", label: "Jadikan harga tertentu" },
                    ]}
                  />
                </Field>
                <Field
                  id="bulk-amount"
                  label={kind === "pct" ? "Persen (%)" : kind === "rp" ? "Rupiah" : "Harga baru (Rp)"}
                  hint={kind === "set" ? undefined : "Pakai tanda minus untuk menurunkan, mis. -10"}
                >
                  <input
                    id="bulk-amount"
                    className={`${inputClass} tabular-nums`}
                    inputMode={kind === "pct" ? "decimal" : "numeric"}
                    value={amount}
                    placeholder={kind === "pct" ? "10" : kind === "rp" ? "2000" : "25000"}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
              </div>
              <Field id="bulk-round" label="Pembulatan">
                <Select
                  id="bulk-round"
                  className="sm:max-w-[260px]"
                  value={String(round)}
                  onChange={(v) => setRound(Number(v) as PriceOp["round"])}
                  options={ROUNDS.map((r) => ({ value: String(r.value), label: r.label }))}
                />
              </Field>
              {anyVariants && <p className="text-[13px] text-text-muted">Produk bervarian: harga tiap varian ikut diubah; harga produk mengikuti varian aktif termurah (sama dengan aplikasi).</p>}
            </div>
          )}

          {action === "category" && (
            <Field id="bulk-cat" label="Pindahkan ke kategori">
              <Select
                id="bulk-cat"
                className="sm:max-w-[320px]"
                value={categoryId}
                onChange={setCategoryId}
                options={[{ value: "", label: "Tanpa kategori" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </Field>
          )}

          {action === "status" && (
            <fieldset>
              <legend className="mb-2 text-[13px] font-semibold">Jadikan</legend>
              <div className="flex gap-5">
                <label className="inline-flex min-h-9 items-center gap-2 text-[14px]">
                  <input type="radio" name="bulk-active" checked={active} onChange={() => setActive(true)} className="accent-[var(--color-brand-deep)]" /> Aktif
                </label>
                <label className="inline-flex min-h-9 items-center gap-2 text-[14px]">
                  <input type="radio" name="bulk-active" checked={!active} onChange={() => setActive(false)} className="accent-[var(--color-brand-deep)]" /> Nonaktif
                </label>
              </div>
              <p className="mt-1 text-[13px] text-text-muted">Produk nonaktif disembunyikan dari kasir tanpa dihapus.</p>
            </fieldset>
          )}
        </div>
      )}

      {step === "preview" && (
        <div>
          <p className="mb-3 text-[14px] text-text-body">
            {rows.length ? (
              <>
                <strong className="text-text-heading tabular-nums">{rows.length.toLocaleString("id-ID")}</strong> perubahan akan dikirim. Produk yang nilainya sudah sama dilewati.
              </>
            ) : (
              "Tidak ada yang berubah — semua produk terpilih sudah bernilai sama."
            )}
          </p>
          {rows.length > 0 && <PreviewTable rows={rows} />}
        </div>
      )}

      {sending && <ProgressBar done={progress} total={rows.length} label="Mengirim" />}

      {step === "done" && summary && (
        <div className="space-y-4">
          <ResultCounts summary={summary} />
          {failures.length > 0 && (
            <div>
              <p className="mb-2 text-[14px] font-semibold">Yang tidak tersimpan</p>
              <ul className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle text-[13.5px]">
                {failures.slice(0, 200).map((f, i) => (
                  <li key={i} className="px-3 py-2">
                    <span className="font-semibold text-text-heading">{f.name}</span> — <span className="text-text-body">{f.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function PreviewTable({ rows }: { rows: PreviewRow[] }) {
  const shown = rows.slice(0, 300);
  return (
    <div className="max-h-[60vh] overflow-auto rounded-[12px] border border-border-subtle">
      <table className="w-full border-separate border-spacing-0 text-[13.5px]">
        <thead>
          <tr>
            <th scope="col" className={thClass}>
              Produk
            </th>
            <th scope="col" className={`${thClass} text-right`}>
              Sebelum
            </th>
            <th scope="col" className={`${thClass} text-right`}>
              Sesudah
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <tr key={r.key}>
              <td className={`${tdClass} border-b border-border-subtle`}>
                {r.name}
                {r.sub && <span className="text-text-muted"> — {r.sub}</span>}
              </td>
              <td className={`${tdClass} border-b border-border-subtle text-right text-text-muted tabular-nums`}>{r.before}</td>
              <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums`}>{r.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > shown.length && <p className="px-5 py-2 text-[12.5px] text-text-muted">…dan {(rows.length - shown.length).toLocaleString("id-ID")} lainnya.</p>}
    </div>
  );
}
