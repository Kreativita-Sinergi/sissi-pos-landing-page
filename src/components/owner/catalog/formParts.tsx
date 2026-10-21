"use client";

import React, { useId, useState } from "react";
import { Pencil, Plus, ScanBarcode, Wheat, X } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { btn, errorMessage, Field, focusRing, formatRupiah, iconBtn, inputClass, Notice, Spinner, useLoad } from "@/components/admin/ui";
import { newId, ownerApi, pushChanges } from "@/lib/owner/api";
import { codeKey, createChange, formatQty, LIMITS, marginPercent, norm, parseQty, resultFieldErrors } from "@/lib/owner/catalog";
import {
  compatibleUnits,
  convertQty,
  costOfQty,
  defaultRecipeUnit,
  deriveRecipeItems,
  ent,
  formatBp,
  formatYield,
  MATERIAL_UNITS,
  MAX_RECIPE_ITEMS,
  recipeCost,
  sameRecipe,
  stockMoveChange,
  type CostMode,
  type RawMaterial,
  type RecipeBatch,
  type RecipeItem,
} from "@/lib/owner/productForm";
import type { ChangeResult, StockRow } from "@/lib/owner/types";
import { MoneyInput } from "./bits";
import { Select } from "../Select";

// Potongan form produk yang meniru widget aplikasi: QtyField, CostModeSwitch, BarcodeEditor, StockRecipeWarning,
// CurrentStockField + lembar Penyesuaian stok, RecipeEditor (+ buat bahan baku ringkas). Teks = l10n aplikasi.

// ——— Jumlah (mili-satuan) ———

/** Isian jumlah + satuan (`QtyField`): teks bebas, dibaca `parseQty` saat simpan. */
export function QtyInput({
  id,
  value,
  onChange,
  unit,
  placeholder,
  invalid,
  label,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  unit: string;
  placeholder?: string;
  invalid?: boolean;
  label?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        className={`${inputClass} tabular-nums`}
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="shrink-0 text-[13px] text-text-muted">{unit}</span>
    </div>
  );
}

/** Pesan galat jumlah: kosong = sah (opsional). */
export function qtyError(text: string, opts: { required?: boolean; allowZero?: boolean } = {}): string | null {
  const t = text.trim();
  if (!t) return opts.required ? "Wajib diisi" : null;
  const q = parseQty(t);
  if (q === null) return "Isi jumlah yang benar (mis. 2 atau 2,5)";
  if (q === 0 && opts.allowZero === false) return "Isi jumlah yang benar (mis. 2 atau 2,5)";
  return null;
}

// ——— Sumber HPP ———

export function CostModeSwitch({ mode, onChange }: { mode: CostMode; onChange: (m: CostMode) => void }) {
  const seg = (m: CostMode, label: string, icon: React.ReactNode) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === m}
      onClick={() => onChange(m)}
      className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-[8px] px-3 text-[14px] font-semibold ${
        mode === m ? "bg-white text-text-heading shadow-sm" : "text-text-muted hover:text-text-heading"
      } ${focusRing}`}
    >
      {icon} {label}
    </button>
  );
  return (
    <div role="radiogroup" aria-label="Sumber HPP" className="flex max-w-[360px] gap-1 rounded-[10px] bg-bg-muted p-1">
      {seg("manual", "Modal manual", <Pencil size={14} aria-hidden />)}
      {seg("recipe", "Resep", <Wheat size={14} aria-hidden />)}
    </div>
  );
}

/** "Laba Rp… / unit · margin …%" atau peringatan rugi. */
export function MarginLine({ price, cost, unit }: { price: number; cost: number; unit: string }) {
  if (cost > price) return <p className="text-[12.5px] text-warning">Harga modal lebih tinggi dari harga jual</p>;
  const m = marginPercent(price, cost);
  return (
    <p className="text-[12.5px] text-text-muted">
      Laba {formatRupiah(price - cost)} / {unit}
      {m !== null ? ` · margin ${m.toLocaleString("id-ID")}%` : ""}
    </p>
  );
}

// ——— Barcode tambahan ———

/** Chip barcode tambahan + tambah/hapus (`BarcodeEditor`). [ownerOf] = nama barang lain yang memakai kode (null = bebas). */
export function BarcodeEditor({ codes, onChange, ownerOf }: { codes: string[]; onChange: (v: string[]) => void; ownerOf: (code: string) => string | null }) {
  const [adding, setAdding] = useState<{ text: string; error?: string } | null>(null);
  const id = useId();

  function add() {
    if (!adding) return;
    const t = adding.text.trim();
    if (!t) return setAdding({ ...adding, error: "Wajib diisi" });
    if (t.length > LIMITS.code) return setAdding({ ...adding, error: `Maksimal ${LIMITS.code} karakter` });
    if (codes.some((c) => codeKey(c) === codeKey(t))) return setAdding(null);
    const owner = ownerOf(t);
    if (owner !== null) return setAdding({ ...adding, error: `Barcode ini sudah dipakai ${owner}` });
    onChange([...codes, t]);
    setAdding(null);
  }

  return (
    <div>
      <p className="text-[13px] font-semibold">Barcode tambahan</p>
      <p className="text-[12.5px] text-text-muted">Untuk barang dengan beberapa kemasan/kode.</p>
      {codes.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {codes.map((c) => (
            <li key={c} className="inline-flex items-center gap-0.5 rounded-full border border-border-subtle bg-white py-0.5 pr-0.5 pl-3 text-[13px] font-semibold">
              <span className="max-w-[220px] truncate">{c}</span>
              <button type="button" className={`${iconBtn} h-7 w-7`} aria-label={`Hapus barcode ${c}`} title={`Hapus barcode ${c}`} onClick={() => onChange(codes.filter((x) => x !== c))}>
                <X size={14} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {codes.length < LIMITS.extraBarcodes && (
        <button type="button" className={`${btn.ghost} mt-1 -ml-2 min-h-8 px-2 text-[13px]`} onClick={() => setAdding({ text: "" })}>
          + Tambah barcode
        </button>
      )}
      <Modal
        open={!!adding}
        title="Barcode tambahan"
        icon={<ScanBarcode size={18} aria-hidden />}
        onClose={() => setAdding(null)}
        footer={
          <>
            <button type="button" className={btn.secondary} onClick={() => setAdding(null)}>
              Batal
            </button>
            <button type="button" className={btn.primary} onClick={add}>
              Tambah barcode
            </button>
          </>
        }
      >
        <Field id={id} label="Barcode (opsional)" error={adding?.error}>
          <input
            id={id}
            className={inputClass}
            placeholder="Mis. 8991234567890"
            maxLength={LIMITS.code}
            autoFocus
            value={adding?.text ?? ""}
            aria-invalid={!!adding?.error || undefined}
            onChange={(e) => setAdding({ text: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
          />
        </Field>
      </Modal>
    </div>
  );
}

// ——— Peringatan stok + resep ———

export function StockRecipeWarning({ onTurnOff, onKeep }: { onTurnOff: () => void; onKeep: () => void }) {
  return (
    <div>
      <Notice tone="warning" title="Stok produk & bahan sama-sama berkurang">
        Lacak stok aktif dan produk ini memakai resep: setiap terjual, stok produk jadi DAN bahan bakunya berkurang. Cocok bila produk disiapkan lebih dulu. Bila dibuat
        saat dipesan, matikan Lacak stok agar bahan saja yang berkurang.
      </Notice>
      <div className="mt-1 flex flex-wrap justify-end gap-1">
        <button type="button" className={`${btn.ghost} min-h-8 px-2 text-[13px]`} onClick={onKeep}>
          Biarkan keduanya
        </button>
        <button type="button" className={`${btn.ghost} min-h-8 px-2 text-[13px] text-brand-ink`} onClick={onTurnOff}>
          Matikan lacak stok
        </button>
      </div>
    </div>
  );
}

// ——— Stok saat ini + penyesuaian ———

/** Konteks tulis stok: outlet terpilih, pengguna pemilik (employee_id), dan muat ulang stok setelah menulis. */
export type StockContext = { outletId: string | null; outletName: string | null; employeeId: string; reload: () => void };

/** Stok saat ini (baca saja) + "Sesuaikan" (`CurrentStockField`). [row] null = belum dilacak di server. */
export function CurrentStock({
  label = "Stok saat ini",
  row,
  loading,
  unit,
  productId,
  variantId,
  itemName,
  ctx,
}: {
  label?: string;
  row: StockRow | null;
  loading: boolean;
  unit: string;
  productId: string;
  variantId: string | null;
  itemName: string;
  ctx: StockContext;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <p className="mb-1.5 text-[13px] font-semibold">{label}</p>
      <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-[10px] border border-border-subtle bg-bg-muted px-3">
        <span className="flex-1 tabular-nums">{loading ? "Memuat…" : row ? `${formatQty(row.qty)} ${unit}` : "—"}</span>
        <button type="button" className={`${btn.ghost} min-h-8 px-2 text-[13px] text-brand-ink`} onClick={() => setOpen(true)} disabled={loading || !row || !ctx.outletId}>
          Sesuaikan
        </button>
      </div>
      {!loading && !row && <p className="mt-1 text-[12.5px] text-text-muted">Stok tampil setelah produk tersimpan dengan Lacak stok aktif.</p>}
      {!loading && row && !ctx.outletId && <p className="mt-1 text-[12.5px] text-text-muted">Pilih outlet stok untuk menyesuaikan stok.</p>}
      {open && row && ctx.outletId && <StockAdjustDialog itemName={itemName} unit={unit} productId={productId} variantId={variantId} ctx={ctx} onClose={() => setOpen(false)} />}
    </div>
  );
}

type Reason = "lost" | "damaged" | "correction";
const REASONS: { id: Reason; label: string }[] = [
  { id: "lost", label: "Hilang" },
  { id: "damaged", label: "Rusak" },
  { id: "correction", label: "Koreksi hitung" },
];

/**
 * Penyesuaian stok (`StockRepository.adjust`): Hilang/Rusak = gerakan `out` −jumlah; Koreksi hitung = gerakan `adjust`
 * sebesar jumlah fisik − stok saat ini (dibaca ulang dari /owner/stock tepat sebelum menulis). Catatan = alasan[: catatan].
 */
function StockAdjustDialog({
  itemName,
  unit,
  productId,
  variantId,
  ctx,
  onClose,
}: {
  itemName: string;
  unit: string;
  productId: string;
  variantId: string | null;
  ctx: StockContext;
  onClose: () => void;
}) {
  const [reason, setReason] = useState<Reason>("lost");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState<number | null>(null);
  const qid = useId();
  const nid = useId();
  const correction = reason === "correction";
  const entered = qty.trim() ? parseQty(qty) : null;

  async function readLevel(signal?: AbortSignal): Promise<number> {
    const rows = await (await ownerApi()).stock({ outlet_id: ctx.outletId ?? undefined }, signal);
    return rows.find((r) => r.kind === "product" && r.product_id === productId && (r.variant_id ?? null) === variantId)?.qty ?? 0;
  }
  // Stok terbaru outlet ini (bukan dari daftar yang mungkin sudah usang).
  const level = useLoad<number>((signal) => readLevel(signal), [ctx.outletId ?? "", productId, variantId ?? ""]);
  const current = fresh ?? level.state.data ?? null;

  async function save() {
    const problem = qtyError(qty, { required: true, allowZero: correction });
    if (problem || entered === null) return setError(problem ?? "Isi jumlah yang benar (mis. 2 atau 2,5)");
    if (!ctx.outletId) return;
    setBusy(true);
    setError(null);
    try {
      const now = await readLevel();
      setFresh(now);
      const delta = correction ? entered - now : -entered;
      if (delta === 0) {
        setError("Jumlah fisik sama dengan stok sekarang.");
        return;
      }
      const label = REASONS.find((r) => r.id === reason)?.label ?? "";
      const free = note.trim();
      const results = await pushChanges([
        stockMoveChange({
          outlet_id: ctx.outletId,
          product_id: productId,
          variant_id: variantId,
          qty_delta: delta,
          type: correction ? "adjust" : "out",
          employee_id: ctx.employeeId,
          note: free ? `${label}: ${free}` : label,
        }),
      ]);
      const r = results[0];
      if (r?.status !== "applied") {
        setError(r?.message ?? "Ditolak server.");
        return;
      }
      ctx.reload();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const after = entered === null || current === null ? null : correction ? entered : current - entered;
  return (
    <Modal
      open
      title="Penyesuaian stok"
      description={`${itemName} · ${ctx.outletName ?? ""} · Stok: ${current === null ? "…" : `${formatQty(current)} ${unit}`}`}
      onClose={() => !busy && onClose()}
      dismissible={!busy}
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
      <div className="space-y-4">
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <div>
          <p className="mb-1.5 text-[13px] font-semibold">Alasan</p>
          <div role="radiogroup" aria-label="Alasan" className="flex gap-1 rounded-[10px] bg-bg-muted p-1">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                role="radio"
                aria-checked={reason === r.id}
                onClick={() => setReason(r.id)}
                className={`min-h-9 flex-1 rounded-[8px] px-2 text-[13.5px] font-semibold ${reason === r.id ? "bg-white text-text-heading shadow-sm" : "text-text-muted"} ${focusRing}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <Field id={qid} label={correction ? "Jumlah fisik sekarang" : "Jumlah berkurang"}>
          <QtyInput id={qid} value={qty} onChange={setQty} unit={unit} autoFocus />
        </Field>
        {after !== null && <p className={`text-[12.5px] ${after < 0 ? "text-danger" : "text-text-muted"}`}>Stok menjadi {formatQty(after)} {unit}</p>}
        <Field id={nid} label="Catatan">
          <input id={nid} className={inputClass} maxLength={150} placeholder="Opsional, mis. kemasan bocor" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// ——— Resep ———

/** Target resep (`RecipeTarget`): key "" = produk. [manualCost] menentukan pesan "dipakai/diabaikan". */
export type RecipeTarget = { key: string; label: string; price: number | null; manualCost: number | null };

/** Buat bahan baku baru di server; mengembalikan record terbaru (untuk ditambahkan ke resep). */
export type CreateMaterial = (data: { name: string; unit: string; min_stock: number; avg_cost: number }) => Promise<RawMaterial>;

/**
 * Editor resep (`RecipeEditor`): bahan per porsi + HPP (Σ bahan × harga rata-rata) & margin. Bahan baru bisa dibuat
 * tanpa meninggalkan form (`showRawMaterialForm(compact)`). Resep yang diisi "per adonan" di aplikasi ([batches],
 * `recipes.batch` segar) ditampilkan dengan hasil porsi & takaran bersih + susut; web tetap menyunting takaran per
 * porsi (sudah termasuk susut) — begitu diubah, resep disimpan per porsi.
 */
export function RecipeEditor({
  targets,
  recipes,
  batches,
  onChange,
  materials,
  createMaterial,
}: {
  targets: RecipeTarget[];
  recipes: Record<string, RecipeItem[]>;
  /** Batch segar per target (kunci = key target); kosong = semua per porsi. */
  batches?: Record<string, RecipeBatch>;
  onChange: (next: Record<string, RecipeItem[]>) => void;
  materials: RawMaterial[];
  createMaterial: CreateMaterial;
}) {
  const [targetKey, setTargetKey] = useState(targets[0]?.key ?? "");
  const [picking, setPicking] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ index: number | null; item: RecipeItem; material: RawMaterial } | null>(null);
  const target = targets.find((t) => t.key === targetKey) ?? targets[0];
  const key = target?.key ?? "";
  const items = recipes[key] ?? [];
  const byId = new Map(materials.map((m) => [m.id, m]));
  const hpp = recipeCost(items, byId);
  const set = (next: RecipeItem[]) => onChange({ ...recipes, [key]: next });
  const used = new Set(items.map((i) => i.raw_material_id));
  const choices = materials.filter((m) => m.is_active && !used.has(m.id)).sort((a, b) => a.name.localeCompare(b.name, "id"));
  const savedBatch = batches?.[key] ?? null;
  // Batch masih berlaku selama takaran per porsi belum diubah di sini.
  const batch = savedBatch && sameRecipe(deriveRecipeItems(savedBatch), items) ? savedBatch : null;
  const batchItemOf = (i: number) => (batch && batch.items[i]?.raw_material_id === items[i]?.raw_material_id ? batch.items[i] : null);

  const startItem = (m: RawMaterial) => setEditing({ index: null, item: { raw_material_id: m.id, qty: 0, unit: defaultRecipeUnit(m.unit) }, material: m });

  const costNote = () => {
    if (!target) return "";
    if (target.key !== "") return target.manualCost === null ? "Dipakai sebagai harga modal." : "Harga modal manual varian ini yang dipakai (menimpa resep); kosongkan agar HPP resep dipakai.";
    if (targets.length > 1)
      return target.manualCost === null
        ? "Dipakai varian yang tidak punya harga modal manual atau resep sendiri."
        : "Varian tanpa modal/resep sendiri memakai harga modal manual produk; resep ini tetap memotong stok bahan.";
    return target.manualCost === null ? "Dipakai sebagai harga modal." : "Harga modal manual yang dipakai (menimpa resep); kosongkan agar HPP resep dipakai. Resep tetap memotong stok bahan.";
  };

  return (
    <div className="space-y-2">
      {targets.length > 1 && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {targets.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTargetKey(t.key)}
                className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${t.key === key ? "border-brand-primary bg-brand-tint" : "border-border-subtle"} ${focusRing}`}
              >
                {t.label} · {(recipes[t.key] ?? []).length}
              </button>
            ))}
          </div>
          <p className="text-[12.5px] text-text-muted">Varian tanpa resep sendiri memakai resep &quot;Semua varian&quot;.</p>
        </>
      )}
      {materials.length === 0 ? (
        <div className="space-y-2 rounded-[12px] bg-bg-muted p-3">
          <p className="text-[14px]">Belum ada bahan baku. Buat langsung di sini tanpa meninggalkan form produk.</p>
          <button type="button" className={btn.secondary} onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> Buat bahan baku baru
          </button>
        </div>
      ) : (
        <>
          {items.length === 0 && <p className="py-1 text-[12.5px] text-text-muted">Belum ada bahan di resep ini.</p>}
          {batch && (
            <p className="rounded-[10px] bg-bg-muted px-3 py-2 text-[12.5px] text-text-body">
              Diisi per adonan di aplikasi: sekali masak menghasilkan <strong className="font-semibold">{formatYield(batch.yield_qty)} porsi</strong>. Takaran di bawah =
              yang dipotong dari stok per porsi (sudah termasuk susut). Mengubah resep di sini menyimpannya sebagai takaran per porsi.
            </p>
          )}
          {!batch && savedBatch && (
            <p className="rounded-[10px] bg-bg-muted px-3 py-2 text-[12.5px] text-text-body">
              Resep diubah di sini — disimpan sebagai takaran per porsi; isian per adonan dari aplikasi tidak dipakai lagi.
            </p>
          )}
          {items.length > 0 && (
            <ul className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle">
              {items.map((it, i) => {
                const m = byId.get(it.raw_material_id);
                const usage = m ? convertQty(it.qty, it.unit, m.unit) : null;
                const cost = m && usage !== null ? costOfQty(usage, m.avg_cost) : null;
                return (
                  <li key={`${it.raw_material_id}-${i}`} className="flex items-center gap-2 px-3 py-2">
                    <Wheat size={16} className="shrink-0 text-text-muted" aria-hidden />
                    <button
                      type="button"
                      className={`min-w-0 flex-1 text-left ${focusRing} rounded`}
                      disabled={!m}
                      onClick={() => m && setEditing({ index: i, item: it, material: m })}
                      aria-label={m ? `Ubah jumlah ${m.name}` : undefined}
                    >
                      <span className="block truncate text-[14px] font-semibold">{m?.name ?? "—"}</span>
                      <span className="block text-[12.5px] text-text-muted">
                        {formatQty(it.qty)} {it.unit}
                        {batch ? " per porsi" : ""}
                        {m && usage === null ? " · Satuan tidak cocok" : ""}
                      </span>
                      {(() => {
                        const b = batchItemOf(i);
                        if (b) {
                          return (
                            <span className="block text-[12px] text-text-muted">
                              Adonan: {formatQty(b.qty)} {b.unit} bersih{b.waste_bp > 0 ? ` · susut ${formatBp(b.waste_bp)}%` : ""}
                            </span>
                          );
                        }
                        return !batch && (m?.waste_bp ?? 0) > 0 ? (
                          <span className="block text-[12px] text-text-muted">Berat kotor (susut bahan {formatBp(m!.waste_bp!)}% saat dibersihkan)</span>
                        ) : null;
                      })()}
                    </button>
                    {cost !== null && <span className="text-[13px] font-semibold tabular-nums">{formatRupiah(cost)}</span>}
                    <button type="button" className={iconBtn} aria-label={`Hapus ${m?.name ?? "bahan"}`} title="Hapus" onClick={() => set(items.filter((_, k) => k !== i))}>
                      <X size={16} aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length < MAX_RECIPE_ITEMS && (
            <button type="button" className={btn.secondary} onClick={() => setPicking(true)}>
              <Plus size={16} aria-hidden /> Tambah bahan
            </button>
          )}
        </>
      )}
      {items.length > 0 && (
        <div className="rounded-[10px] bg-brand-tint px-3 py-2.5">
          <p className="text-[13.5px] font-semibold text-brand-ink">
            HPP {formatRupiah(hpp)}
            {target?.price ? ` · margin ${(marginPercent(target.price, hpp) ?? 0).toLocaleString("id-ID")}%` : ""}
          </p>
          <p className="text-[12.5px] text-text-muted">{costNote()}</p>
        </div>
      )}

      <Modal open={picking} title="Tambah bahan" onClose={() => setPicking(false)}>
        <ul className="-mx-2 max-h-[50vh] space-y-0.5 overflow-y-auto">
          {choices.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left hover:bg-bg-muted ${focusRing}`}
                onClick={() => {
                  setPicking(false);
                  startItem(m);
                }}
              >
                <Wheat size={16} className="shrink-0 text-text-muted" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{m.name}</span>
                  <span className="block text-[12.5px] text-text-muted">
                    {m.avg_cost > 0 ? `Rata-rata ${formatRupiah(m.avg_cost)}/${m.unit}` : m.unit}
                    {(m.waste_bp ?? 0) > 0 ? ` · susut ${formatBp(m.waste_bp!)}%` : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left font-semibold text-brand-ink hover:bg-bg-muted ${focusRing}`}
              onClick={() => {
                setPicking(false);
                setCreating(true);
              }}
            >
              <Plus size={16} aria-hidden /> Buat bahan baku baru
            </button>
          </li>
        </ul>
      </Modal>

      {creating && (
        <MaterialDialog
          taken={new Set(materials.map((m) => norm(m.name)))}
          create={createMaterial}
          onClose={() => setCreating(false)}
          onCreated={(m) => {
            setCreating(false);
            startItem(m);
          }}
        />
      )}

      {editing && (
        <RecipeQtyDialog
          material={editing.material}
          item={editing.item}
          onClose={() => setEditing(null)}
          onSave={(item) => {
            const cur = recipes[key] ?? [];
            set(editing.index === null ? [...cur, item] : cur.map((x, k) => (k === editing.index ? item : x)));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function RecipeQtyDialog({ material, item, onClose, onSave }: { material: RawMaterial; item: RecipeItem; onClose: () => void; onSave: (i: RecipeItem) => void }) {
  const [qty, setQty] = useState(item.qty ? formatQty(item.qty) : "");
  const [unit, setUnit] = useState(item.unit);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const units = compatibleUnits(material.unit);
  const save = () => {
    const problem = qtyError(qty, { required: true, allowZero: false });
    if (problem) return setError(problem);
    onSave({ ...item, qty: parseQty(qty) ?? 0, unit });
  };
  return (
    <Modal
      open
      title="Jumlah bahan per porsi"
      description={material.name}
      icon={<Wheat size={18} aria-hidden />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={save}>
            Simpan
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {units.length > 1 && (
          <div role="radiogroup" aria-label="Satuan" className="flex gap-1 rounded-[10px] bg-bg-muted p-1">
            {units.map((u) => (
              <button
                key={u}
                type="button"
                role="radio"
                aria-checked={unit === u}
                onClick={() => setUnit(u)}
                className={`min-h-9 flex-1 rounded-[8px] text-[14px] font-semibold ${unit === u ? "bg-white shadow-sm" : "text-text-muted"} ${focusRing}`}
              >
                {u}
              </button>
            ))}
          </div>
        )}
        <Field id={id} label="Jumlah" error={error ?? undefined}>
          <div
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                save();
              }
            }}
          >
            <QtyInput id={id} value={qty} onChange={setQty} unit={unit} invalid={!!error} autoFocus />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

/** Bahan baku baru versi ringkas (`_MaterialForm(compact)`): nama, satuan, stok minimum, harga beli per satuan. */
function MaterialDialog({
  taken,
  create,
  onClose,
  onCreated,
}: {
  taken: Set<string>;
  create: CreateMaterial;
  onClose: () => void;
  onCreated: (m: RawMaterial) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("g");
  const [min, setMin] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fid = useId();

  async function save() {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (!n) e.name = "Wajib diisi";
    else if (n.length > 60) e.name = "Maksimal 60 karakter";
    else if (taken.has(norm(n))) e.name = "Nama bahan baku sudah dipakai";
    const minErr = qtyError(min);
    if (minErr) e.min_stock = minErr;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      onCreated(await create({ name: n, unit, min_stock: min.trim() ? (parseQty(min) ?? 0) : 0, avg_cost: cost ?? 0 }));
    } catch (err) {
      const fe = (err as { fields?: Record<string, string> }).fields;
      setErrors(fe ?? { _: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Bahan baku baru"
      icon={<Wheat size={18} aria-hidden />}
      onClose={() => !busy && onClose()}
      dismissible={!busy}
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
      <div className="space-y-3.5">
        {errors._ && (
          <Notice tone="danger" role="alert">
            {errors._}
          </Notice>
        )}
        <Field id={`${fid}-n`} label="Nama bahan" error={errors.name}>
          <input id={`${fid}-n`} className={inputClass} maxLength={60} autoFocus placeholder="Mis. Biji kopi arabika" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name || undefined} />
        </Field>
        <Field id={`${fid}-u`} label="Satuan" hint="Satuan stok & harga rata-rata" error={errors.unit}>
          <Select
            id={`${fid}-u`}
            className="max-w-[200px]"
            value={unit}
            onChange={setUnit}
            options={MATERIAL_UNITS.map((u) => ({ value: u, label: u }))}
          />
        </Field>
        <Field id={`${fid}-m`} label="Stok minimum" hint="Diingatkan bila stok di bawah ini" error={errors.min_stock}>
          <QtyInput id={`${fid}-m`} value={min} onChange={setMin} unit={unit} invalid={!!errors.min_stock} />
        </Field>
        <Field id={`${fid}-c`} label={`Harga beli per ${unit}`} hint="Opsional" error={errors.avg_cost}>
          <MoneyInput id={`${fid}-c`} value={cost} onChange={setCost} placeholder="Opsional" />
        </Field>
      </div>
    </Modal>
  );
}

/** Kirim bahan baku baru ke server (`raw_materials` upsert); galat isian dilempar sebagai `{ fields }`. */
export async function pushNewMaterial(data: { name: string; unit: string; min_stock: number; avg_cost: number }): Promise<{ material: RawMaterial; results: ChangeResult[] }> {
  const results = await pushChanges([createChange(ent("raw_materials"), { ...data, sku: null, is_active: true }, newId())]);
  const r = results[0];
  if (r?.status === "applied" && r.record) return { material: r.record as RawMaterial, results };
  const fields = resultFieldErrors(r);
  throw Object.assign(new Error(r?.message ?? "Ditolak server."), { fields: Object.keys(fields).length ? fields : { _: r?.message ?? "Ditolak server." } });
}
