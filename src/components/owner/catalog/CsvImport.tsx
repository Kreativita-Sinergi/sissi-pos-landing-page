"use client";

import React, { useMemo, useState } from "react";
import { FileUp } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Badge, btn, errorMessage, formatRupiah, Notice, Spinner } from "@/components/admin/ui";
import { pullAll } from "@/lib/owner/api";
import { formatQty, resultMessage, summarize, type ResultSummary } from "@/lib/owner/catalog";
import { downloadCsv } from "@/lib/owner/csv";
import {
  analyzeImport,
  buildImportChanges,
  defaultPacks,
  defaultSelection,
  IMPORT_LIMITS,
  issueText,
  kindOf,
  MATCH_REASON,
  newCategories,
  parseImportFile,
  rowValid,
  selectable,
  templateFields,
  templateRows,
  type ImportAnalysis,
  type ImportFile,
  type ImportRow,
  type RawMaterial,
  type Recipe,
  type RowKind,
} from "@/lib/owner/productImport";
import { formatYield } from "@/lib/owner/productForm";
import { downloadImportXlsxTemplate, readImportXlsx } from "@/lib/owner/productImportXlsx";
import type { Change, ChangeResult, DataEntity } from "@/lib/owner/types";
import { useOwner } from "../OwnerShell";
import { Check, ProgressBar, ResultCounts, Sheet } from "./bits";
import { ImportContents, ImportMaterials, ImportModifiers, ImportNotes } from "./ImportExtrasSections";
import type { CatalogData, CommitOutcome } from "./useCatalog";
import { Select } from "../Select";

// Impor produk dari CSV atau Excel (.xlsx) — format, pencocokan, dan pilihan sama dengan aplikasi (lihat
// `lib/owner/productImport.ts` & `productImportXlsx.ts`). Excel boleh membawa lembar Varian, Bahan, Resep, dan Pilihan
// Ekstra. Produk yang sudah ada tidak ditimpa kecuali dipilih "Pakai berkas"; baris kembar dipilih satu (nama sama
// boleh lebih dari satu). Kiriman dua tahap: kategori → bahan baku → grup pilihan ekstra → produk → varian, lalu resep
// dan stok awal (gerakan `in` oleh pemilik di outlet terpilih) hanya untuk record yang sudah `applied`.

/** Template CSV sederhana (produk saja; varian lewat kolom `varian`). */
export function downloadTemplate(service: boolean) {
  const { header, rows } = templateRows(service);
  downloadCsv("template-impor-produk.csv", header, rows);
}

/** Template Excel lengkap (Produk, Varian, Bahan, Resep, Pilihan Ekstra) — pustaka .xlsx dimuat saat diklik. */
export function downloadXlsxTemplate(service: boolean) {
  return downloadImportXlsxTemplate(service);
}

const SHEET_COLUMNS: [string, string][] = [
  ["Varian", "nama_produk, varian, harga, modal, sku, barcode"],
  ["Bahan", "nama_bahan, satuan (g, kg, ml, l, pcs…), harga_beli, isi_kemasan, stok_min, sku, susut_persen (opsional, mis. 10 = 10% terbuang saat dibersihkan)"],
  [
    "Resep",
    "nama_produk, varian (boleh kosong), nama_bahan, jumlah, satuan, hasil_porsi (opsional: isi bila jumlah = berat bersih satu adonan yang menghasilkan N porsi)",
  ],
  ["Pilihan Ekstra", "grup, pilih_satu (ya/tidak), pilihan, harga"],
];

/** Nilai pemilih outlet stok awal: id outlet, "skip" = tidak dicatat, "" = belum dipilih. */
const SKIP_STOCK = "skip";

type Step = "pick" | "preview" | "sending" | "done";
type Filter = "all" | RowKind;

const KIND_LABEL: Record<RowKind, string> = { ready: "Siap", duplicate: "Kembar", existing: "Sudah ada", invalid: "Gagal" };

export function CsvImport({
  data,
  commit,
  service,
  onClose,
}: {
  data: CatalogData;
  commit: (changes: Change[], onProgress?: (done: number) => void) => Promise<CommitOutcome>;
  service: boolean;
  onClose: () => void;
}) {
  const { session, outletId } = useOwner();
  const [step, setStep] = useState<Step>("pick");
  const [reading, setReading] = useState(false);
  const [packs, setPacks] = useState<Map<string, number>>(new Map());
  const [stockOutlet, setStockOutlet] = useState<string>(outletId ?? (session.outlets.length === 1 ? session.outlets[0].id : ""));
  const [fileName, setFileName] = useState("");
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState<string | null>(null);
  const [confirmUpdate, setConfirmUpdate] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [failures, setFailures] = useState<{ label: string; message: string }[]>([]);

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file || reading) return;
    const lower = file.name.toLowerCase();
    const excel = lower.endsWith(".xlsx");
    if (!excel && !lower.endsWith(".csv") && !lower.endsWith(".txt")) {
      setError("Pilih berkas .xlsx atau .csv. Berkas .xls lama: buka di Excel lalu simpan ulang sebagai .xlsx.");
      return;
    }
    if (file.size > (excel ? IMPORT_LIMITS.maxXlsxBytes : IMPORT_LIMITS.maxFileBytes)) {
      setError("Berkas terlalu besar (maksimal 2 MB untuk CSV, 5 MB untuk Excel).");
      return;
    }
    setReading(true);
    try {
      let parsed: ImportFile;
      try {
        if (excel) parsed = await readImportXlsx(new Uint8Array(await file.arrayBuffer()), service);
        else {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let text: string;
          try {
            text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          } catch {
            // Excel Windows lama menyimpan CSV dalam Windows-1252.
            text = new TextDecoder("windows-1252").decode(bytes);
          }
          parsed = parseImportFile(text, service);
        }
      } catch {
        setError("Berkas tidak bisa dibaca. Pastikan formatnya Excel (.xlsx) atau CSV.");
        return;
      }
      setFileName(file.name);
      if (parsed.error) {
        setError(parsed.error);
        return;
      }
      // Bahan baku & resep yang sudah ada: dipakai ulang (bahan) / diganti (resep produk yang ditimpa).
      const [materials, recipes] = await Promise.all([pullAll<RawMaterial>("raw_materials"), pullAll<Recipe>("recipes" as DataEntity)]);
      const a = analyzeImport(parsed, { ...data, materials, recipes });
      setAnalysis(a);
      setSelected(defaultSelection(a));
      setPacks(defaultPacks(a));
      setFilter("all");
      setStep("preview");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setReading(false);
    }
  }

  const stockTarget = stockOutlet && stockOutlet !== SKIP_STOCK ? stockOutlet : null;
  const plan = useMemo(
    () => (analysis ? buildImportChanges(analysis, selected, { packs, outletId: stockTarget, employeeId: session.user.id }) : null),
    [analysis, selected, packs, stockTarget, session.user.id]
  );
  const needsOutlet = !!plan && plan.stockWanted > 0 && !stockOutlet;
  const cats = analysis ? newCategories(analysis, selected) : [];
  const count = (k: RowKind) => analysis?.file.rows.filter((r) => kindOf(analysis, r) === k).length ?? 0;

  function toggle(line: number, on: boolean) {
    if (!analysis) return;
    setSelected((s) => {
      const n = new Set(s);
      if (!on) {
        n.delete(line);
        return n;
      }
      n.add(line);
      // Kembar karena kode/produk tujuan: hanya satu baris yang boleh diimpor.
      const g = analysis.groupOf.get(line);
      if (g !== undefined && !analysis.groups[g].allowsMultiple) for (const other of analysis.groups[g].lines) if (other !== line) n.delete(other);
      return n;
    });
  }

  async function send() {
    if (!plan) return;
    setConfirmUpdate(false);
    setStep("sending");
    setProgress(0);
    setTotal(plan.changes.length + plan.followUps.length);
    const results: ChangeResult[] = [];
    try {
      if (plan.changes.length) results.push(...(await commit(plan.changes, setProgress)).results);
      // Tahap 2: resep & stok awal hanya untuk produk/varian/bahan yang tersimpan.
      const applied = new Set(results.filter((r) => r.status === "applied").map((r) => r.id));
      const ready = plan.followUps.filter((f) => f.deps.every((d) => applied.has(d)));
      const skipped = plan.followUps.filter((f) => !ready.includes(f));
      if (ready.length) {
        const base = plan.changes.length;
        results.push(...(await commit(ready.map((f) => f.change), (n) => setProgress(base + n))).results);
      }
      setProgress(plan.changes.length + plan.followUps.length);
      setSummary(summarize(results));
      setFailures([
        ...results.filter((r) => r.status !== "applied").map((r) => ({ label: plan.labels.get(r.id) ?? r.id, message: resultMessage(r) })),
        ...skipped.map((f) => ({ label: plan.labels.get(f.change.id) ?? f.change.id, message: "dilewati karena produk, varian, atau bahan terkait tidak tersimpan" })),
      ]);
    } catch (err) {
      setError(`${errorMessage(err)} Sebagian baris mungkin sudah tersimpan — data dimuat ulang, cek sebelum mengimpor ulang.`);
      setSummary(summarize([]));
    }
    setStep("done");
  }

  const rows = analysis ? analysis.file.rows.filter((r) => filter === "all" || kindOf(analysis, r) === filter) : [];
  const picked = (plan?.create ?? 0) + (plan?.update ?? 0);
  const extrasOnly = !picked && ((plan?.materials ?? 0) > 0 || (plan?.groups ?? 0) > 0);
  const canImport = !!plan && (plan.changes.length > 0 || plan.followUps.length > 0) && !needsOutlet;

  return (
    <Sheet
      open
      wide
      busy={step === "sending"}
      title="Impor produk"
      subtitle={
        fileName
          ? `${fileName}${analysis ? ` · ${analysis.file.rows.length.toLocaleString("id-ID")} baris` : ""}`
          : "Tambah banyak produk sekaligus dari Excel (.xlsx) atau CSV — format sama dengan aplikasi."
      }
      onClose={onClose}
      footer={
        step === "preview" ? (
          <>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                setAnalysis(null);
                setStep("pick");
              }}
            >
              Ganti berkas
            </button>
            <button type="button" className={btn.primary} onClick={() => ((plan?.update ?? 0) > 0 ? setConfirmUpdate(true) : send())} disabled={!canImport}>
              {picked ? `Impor ${picked.toLocaleString("id-ID")} produk` : extrasOnly ? "Impor bahan & pilihan ekstra" : "Pilih produk untuk diimpor"}
            </button>
          </>
        ) : step === "sending" ? (
          <button type="button" className={btn.primary} disabled>
            <Spinner /> Mengimpor…
          </button>
        ) : step === "done" ? (
          <button type="button" className={btn.primary} onClick={onClose}>
            Selesai
          </button>
        ) : (
          <button type="button" className={btn.secondary} onClick={onClose}>
            Batal
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

      {step === "pick" && (
        <div className="space-y-4">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-border-active px-4 py-10 text-center hover:border-brand-primary hover:bg-brand-tint/40 focus-within:border-brand-primary">
            {reading ? <Spinner size={26} /> : <FileUp size={26} aria-hidden className="text-brand-ink" />}
            <span className="text-[15px] font-semibold">{reading ? "Membaca berkas…" : "Pilih berkas Excel atau CSV"}</span>
            <span className="text-[13px] text-text-muted">.xlsx (maks. 5 MB) atau .csv (maks. 2 MB) · maks. 1.000 produk</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.csv,text/csv,.txt"
              className="sr-only"
              disabled={reading}
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-[13.5px] leading-relaxed text-text-body">
            Isi template di Excel atau Google Sheets, lalu pilih berkasnya. Ekspor Excel dari aplikasi kasir lain juga bisa langsung dipilih: lembar dan
            kolomnya dikenali otomatis. Anda bisa memeriksa dan memilih produk mana yang diimpor sebelum disimpan.
          </p>
          <div className="rounded-[12px] bg-bg-muted px-4 py-3 text-[13.5px] leading-relaxed text-text-body">
            <p className="font-semibold text-text-heading">Kolom lembar Produk (dan CSV)</p>
            <ul className="mt-1.5 space-y-0.5">
              {templateFields(service).map((f) => (
                <li key={f.key}>
                  <code className="font-mono text-[12.5px] text-text-heading">{f.header}</code>
                  {(f.key === "name" || f.key === "price") && <span className="ml-1 text-[12px] font-semibold text-danger">wajib</span>}
                  <span className="text-text-muted"> — {f.hint}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Produk yang sudah ada (SKU, barcode, atau nama sama) tidak diubah kecuali Anda memilih &quot;Pakai berkas&quot;; sel kosong mempertahankan data lama dan stoknya tidak
              diubah. Produk yang sudah punya varian diubah lewat form produk.
            </p>
            <p className="mt-3 font-semibold text-text-heading">Lembar lain di template Excel</p>
            <p className="text-text-muted">
              Lembar dikenali dari judul kolomnya, jadi ekspor aplikasi lain dengan kolom serupa juga terbaca. Lembar yang tidak dikenali diabaikan.
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {SHEET_COLUMNS.map(([name, cols]) => (
                <li key={name}>
                  <span className="font-semibold text-text-heading">{name}</span>
                  <span className="text-text-muted"> — {cols}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={btn.secondary}
                onClick={() => downloadXlsxTemplate(service).catch(() => setError("Template tidak bisa dibuat. Coba lagi."))}
              >
                Unduh template Excel lengkap
              </button>
              <button type="button" className={btn.secondary} onClick={() => downloadTemplate(service)}>
                Unduh template CSV sederhana
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "preview" && analysis && plan && (
        <div className="space-y-5">
          <ImportContents a={analysis} />
          <ImportMaterials a={analysis} packs={packs} onPack={(k, v) => setPacks((p) => new Map(p).set(k, v))} />
          <ImportModifiers a={analysis} />
          <ImportNotes a={analysis} />
          {plan.stockWanted > 0 && (
            <div className="rounded-[12px] border border-border-subtle px-4 py-3 text-[13.5px]">
              <label htmlFor="import-stock-outlet" className="font-semibold text-text-heading">
                Outlet untuk stok awal
              </label>
              <p className="text-[12.5px] text-text-muted">
                {plan.stockWanted.toLocaleString("id-ID")} produk/varian baru membawa stok awal; dicatat sebagai stok masuk atas nama Anda.
              </p>
              <div className="mt-2 max-w-sm">
                <Select
                  id="import-stock-outlet"
                  value={stockOutlet}
                  invalid={needsOutlet}
                  placeholder="Pilih outlet…"
                  onChange={setStockOutlet}
                  options={[
                    ...session.outlets.map((o) => ({ value: o.id, label: o.name })),
                    { value: SKIP_STOCK, label: "Jangan catat stok awal" },
                  ]}
                />
              </div>
              {needsOutlet && <p className="mt-1 text-[12.5px] text-danger">Pilih outlet dulu untuk mencatat stok awal.</p>}
            </div>
          )}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Saring baris">
            {(["all", "ready", "duplicate", "existing", "invalid"] as Filter[]).map((f) => {
              const n = f === "all" ? analysis.file.rows.length : count(f);
              if (f !== "all" && !n) return null;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={filter === f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-3 py-1 text-[13px] ${filter === f ? "border-brand-primary bg-brand-tint font-semibold text-brand-ink" : "border-border-subtle text-text-body"}`}
                >
                  {f === "all" ? "Semua" : KIND_LABEL[f]} ({n.toLocaleString("id-ID")})
                </button>
              );
            })}
          </div>
          <p className="text-[13.5px] text-text-body">
            <strong className="text-text-heading">
              {plan.create.toLocaleString("id-ID")} baru · {plan.update.toLocaleString("id-ID")} ditimpa
            </strong>
            {plan.same > 0 && ` · ${plan.same.toLocaleString("id-ID")} sama (dilewati)`}
            {plan.variants > 0 && ` · ${plan.variants.toLocaleString("id-ID")} varian`}
            {plan.recipes > 0 && ` · ${plan.recipes.toLocaleString("id-ID")} resep`}
            {plan.materials > 0 && ` · ${plan.materials.toLocaleString("id-ID")} bahan baru`}
            {plan.groups > 0 && ` · ${plan.groups.toLocaleString("id-ID")} grup ekstra baru`}
            {plan.stock > 0 && ` · ${plan.stock.toLocaleString("id-ID")} stok awal`}
          </p>
          {cats.length > 0 && <p className="text-[13px] text-text-muted">Kategori baru yang akan dibuat: {cats.join(", ")}</p>}
          {analysis.file.ignored.length > 0 && <p className="text-[13px] text-text-muted">Kolom tidak dikenali dan diabaikan: {analysis.file.ignored.join(", ")}</p>}
          {count("duplicate") > 0 && <p className="text-[13px] text-text-muted">Kode (SKU/barcode) sama: pilih satu baris. Nama sama: centang semua yang ingin diimpor.</p>}

          <ul className="max-h-[60vh] divide-y divide-border-subtle overflow-auto rounded-[12px] border border-border-subtle">
            {rows.slice(0, 500).map((r) => (
              <ImportRowItem key={r.line} a={analysis} row={r} checked={selected.has(r.line)} onToggle={(on) => toggle(r.line, on)} />
            ))}
            {rows.length === 0 && <li className="px-4 py-3 text-[13px] text-text-muted">Tidak ada baris yang cocok</li>}
          </ul>
          {rows.length > 500 && <p className="text-[12.5px] text-text-muted">Menampilkan 500 dari {rows.length.toLocaleString("id-ID")} baris.</p>}
        </div>
        </div>
      )}

      {step === "sending" && <ProgressBar done={progress} total={total} label="Mengirim" />}

      {step === "done" && summary && (
        <div className="space-y-4">
          <ResultCounts summary={summary} />
          {failures.length > 0 && (
            <div>
              <p className="mb-2 text-[14px] font-semibold">Yang tidak tersimpan</p>
              <ul className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle text-[13.5px]">
                {failures.slice(0, 300).map((f, i) => (
                  <li key={i} className="px-3 py-2">
                    <span className="font-semibold text-text-heading">{f.label}</span> — <span className="text-text-body">{f.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmUpdate}
        title="Timpa produk yang sudah ada?"
        confirmLabel="Timpa & impor"
        onConfirm={send}
        onClose={() => setConfirmUpdate(false)}
      >
        <p>{plan?.update ?? 0} produk akan diperbarui dengan data berkas (nama, harga, kategori, kode, pengaturan). Stoknya tidak diubah.</p>
      </ConfirmDialog>
    </Sheet>
  );
}

function ImportRowItem({ a, row, checked, onToggle }: { a: ImportAnalysis; row: ImportRow; checked: boolean; onToggle: (on: boolean) => void }) {
  const kind = kindOf(a, row);
  const match = a.matches.get(row.line);
  const canPick = selectable(a, row.line);
  const newCat = row.category && !a.categories.has(row.category.toLowerCase());
  const tone = kind === "invalid" ? "danger" : kind === "duplicate" ? "warning" : kind === "existing" ? "brand" : "success";
  return (
    <li className={`flex items-start gap-3 px-3 py-2.5 text-[13.5px] ${kind === "invalid" ? "bg-danger-tint/40" : ""}`}>
      <div className="pt-0.5">
        <Check checked={checked && canPick} disabled={!canPick} onChange={onToggle} label={match ? `Pakai berkas untuk baris ${row.line}` : `Impor baris ${row.line}`} srOnlyLabel />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] text-text-muted tabular-nums">Baris {row.line}</span>
          <Badge tone={tone}>{KIND_LABEL[kind]}</Badge>
          <span className="font-semibold text-text-heading">{row.name || <em className="text-text-muted">(tanpa nama)</em>}</span>
          {row.price !== null && rowValid(row) && <span className="text-text-body tabular-nums">{formatRupiah(row.price)}</span>}
        </p>
        <p className="mt-0.5 text-[12.5px] text-text-muted">
          {[
            row.category ? `${row.category}${newCat ? " (kategori baru)" : ""}` : null,
            row.sku ? `SKU ${row.sku}` : null,
            row.cost !== null ? `Modal ${formatRupiah(row.cost)}` : null,
            row.variants.length ? `${row.variants.length} varian: ${row.variants.map((v) => v.name).join(", ")}` : null,
            row.trackStock || (row.trackStock === null && (row.initialStock !== null || row.minStock !== null)) ? "Lacak stok" : null,
            row.initialStock !== null ? `Stok awal ${formatQty(row.initialStock)}` : null,
            row.recipe.length
              ? `Resep: ${new Set(row.recipe.map((l) => l.material.toLowerCase())).size} bahan${
                  row.recipe.find((l) => l.yieldQty != null) ? ` · per adonan ${formatYield(row.recipe.find((l) => l.yieldQty != null)!.yieldQty!)} porsi` : ""
                }`
              : null,
            row.groupNames.length ? `Pilihan ekstra: ${row.groupNames.join(", ")}` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {match && (
          <p className="mt-0.5 text-[12.5px] text-text-body">
            Sama dengan &quot;{match.product.name}&quot; ({MATCH_REASON[match.by]})
            {!match.updatable && (
              <span className="block text-warning">
                {match.fileVariants ? "Berkas membawa varian untuk produk ini; atur variannya lewat form produk." : "Produk ini punya varian; ubah lewat form produk."}
              </span>
            )}
            {match.updatable && <span className="text-text-muted"> · centang = Pakai berkas, kosong = Pertahankan</span>}
          </p>
        )}
        {row.errors.length > 0 && <p className="mt-0.5 text-[12.5px] text-danger">{row.errors.map(issueText).join(" · ")}</p>}
        {row.warnings.length > 0 && <p className="mt-0.5 text-[12.5px] text-warning">{row.warnings.map(issueText).join(" · ")}</p>}
      </div>
    </li>
  );
}
