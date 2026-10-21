"use client";

import React, { useId, useState } from "react";
import { ArrowDown, ArrowUp, Eye, GripVertical, Layers, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { btn, Field, focusRing, formatRupiah, iconBtn, inputClass, Notice } from "@/components/admin/ui";
import { formatQty, LIMITS, marginPercent, norm, nullIfBlank, parseQty, type VariantDimension } from "@/lib/owner/catalog";
import {
  bulkTargets,
  dimensionIssue,
  MAX_DIMENSIONS,
  previewBulk,
  type BulkChange,
  type BulkFill,
  type CostMode,
  type CostSource,
  type EditorState,
  type RawMaterial,
  type RecipeBatch,
  type RecipeItem,
  type VDraft,
} from "@/lib/owner/productForm";
import { Check, MoneyInput, Sheet } from "./bits";
import { BarcodeEditor, CostModeSwitch, MarginLine, QtyInput, qtyError, RecipeEditor, type CreateMaterial } from "./formParts";
import { PhotoField } from "./PhotoField";

// Bagian "Punya varian" form produk — sama dengan aplikasi: `variant_dimensions_view.dart` (kartu pilihan + menu),
// `variant_dimension_sheet.dart` (pilihan/nilai baru), `variant_combo_list.dart` (daftar kombinasi, seret/naik-turun),
// `variant_sheet.dart` (lembar satu varian) dan `bulk_fill_sheet.dart` (isi massal 2 langkah dengan pratinjau).

export type ResolvedCost = { cost: number | null; source: CostSource };
/** Stok di baris kombinasi: varian baru = stok awal (null = belum diisi), tersimpan = stok saat ini. */
export type VariantStock = { qty: number | null; isNew: boolean };

const SUGGESTIONS = ["Ukuran", "Suhu", "Rasa", "Warna"];

// ——— Pilihan (dimensi) ———

type DimAction =
  | { kind: "add" }
  | { kind: "values"; index: number }
  | { kind: "renameDim"; index: number }
  | { kind: "renameValue"; index: number; value: string }
  | { kind: "dimMenu"; index: number }
  | { kind: "valueMenu"; index: number; value: string };

export function DimensionsView({
  editor,
  showErrors,
  onAdd,
  onAddValues,
  onRemoveDim,
  onRenameDim,
  onRenameValue,
  onRemoveValue,
}: {
  editor: EditorState;
  showErrors: boolean;
  onAdd: (d: VariantDimension) => void;
  onAddValues: (index: number, values: string[]) => void;
  onRemoveDim: (index: number) => void;
  onRenameDim: (index: number, to: string) => void;
  onRenameValue: (index: number, from: string, to: string) => void;
  onRemoveValue: (index: number, value: string) => void;
}) {
  const [action, setAction] = useState<DimAction | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dims = editor.dims;
  const rid = useId();
  const open = (a: DimAction, initial = "") => {
    setAction(a);
    setText(initial);
    setError(null);
  };

  function rename() {
    if (!action) return;
    const to = text.trim();
    if (action.kind === "renameDim") {
      const dim = dims[action.index];
      if (!to) return setError("Nama pilihan wajib diisi.");
      if (to === dim.name) return setAction(null);
      if (dims.some((d, i) => i !== action.index && norm(d.name) === norm(to))) return setError(`Pilihan "${to}" sudah ada.`);
      onRenameDim(action.index, to);
    } else if (action.kind === "renameValue") {
      const dim = dims[action.index];
      if (!to) return setError("Wajib diisi");
      if (to === action.value) return setAction(null);
      if (dim.values.some((v) => v !== action.value && norm(v) === norm(to))) return setError(`"${to}" sudah ada di pilihan ini.`);
      onRenameValue(action.index, action.value, to);
    }
    setAction(null);
  }

  return (
    <div className="space-y-2.5">
      {dims.map((d, i) => {
        const issue = showErrors && !editor.legacy ? dimensionIssue(d, dims) : null;
        return (
          <div key={`${i}-${d.name}`} className={`rounded-[12px] border p-3 ${issue ? "border-danger" : "border-border-subtle"}`}>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{d.name}</p>
                <p className="text-[12px] text-text-muted">{d.values.length} nilai</p>
              </div>
              <button type="button" className={iconBtn} aria-label={`Menu pilihan ${d.name}`} title={`Menu pilihan ${d.name}`} onClick={() => open({ kind: "dimMenu", index: i })}>
                <MoreHorizontal size={18} aria-hidden />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {d.values.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => open({ kind: "valueMenu", index: i, value: v })}
                  className={`rounded-full border border-border-subtle bg-white px-3 py-1 text-[13px] hover:border-border-active ${focusRing}`}
                >
                  {v}
                </button>
              ))}
              {d.values.length < LIMITS.dimensionValues && (
                <button
                  type="button"
                  onClick={() => setAction({ kind: "values", index: i })}
                  className={`inline-flex items-center gap-1 rounded-full border border-dashed border-border-active px-3 py-1 text-[13px] font-semibold text-brand-ink ${focusRing}`}
                >
                  <Plus size={13} aria-hidden /> Nilai
                </button>
              )}
            </div>
            {issue && <p className="mt-1.5 text-[12.5px] text-danger">{issue}</p>}
          </div>
        );
      })}
      {dims.length < MAX_DIMENSIONS && (
        <button
          type="button"
          onClick={() => setAction({ kind: "add" })}
          className={`flex w-full items-center gap-2.5 rounded-[12px] border border-dashed border-border-active p-3 text-left hover:bg-bg-muted ${focusRing}`}
        >
          <Plus size={18} className="text-brand-ink" aria-hidden />
          <span>
            <span className="block text-[14px] font-semibold text-brand-ink">Tambah pilihan</span>
            <span className="block text-[12.5px] text-text-muted">{dims.length ? `Bisa ${MAX_DIMENSIONS - dims.length} lagi (maks 3 pilihan)` : "Mis. Ukuran: S, M, L · Suhu: Panas, Es"}</span>
          </span>
        </button>
      )}

      {(action?.kind === "add" || action?.kind === "values") && (
        <DimensionDialog
          existing={action.kind === "values" ? dims[action.index] : undefined}
          taken={new Set(dims.map((d) => norm(d.name)))}
          onClose={() => setAction(null)}
          onSave={(d) => {
            const a = action;
            setAction(null);
            if (a.kind === "add") onAdd(d);
            else onAddValues(a.index, d.values);
          }}
        />
      )}

      <Modal open={action?.kind === "dimMenu" || action?.kind === "valueMenu"} title={action?.kind === "dimMenu" ? dims[action.index]?.name ?? "" : action?.kind === "valueMenu" ? `${dims[action.index]?.name}: ${action.value}` : ""} onClose={() => setAction(null)}>
        <div className="-mx-2 space-y-0.5">
          <button
            type="button"
            className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2.5 text-left font-semibold hover:bg-bg-muted ${focusRing}`}
            onClick={() => {
              if (action?.kind === "dimMenu") open({ kind: "renameDim", index: action.index }, dims[action.index].name);
              else if (action?.kind === "valueMenu") open({ kind: "renameValue", index: action.index, value: action.value }, action.value);
            }}
          >
            <Pencil size={16} aria-hidden /> {action?.kind === "dimMenu" ? "Ganti nama pilihan" : "Ganti nama nilai"}
          </button>
          <button
            type="button"
            className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2.5 text-left font-semibold text-danger hover:bg-danger-tint ${focusRing}`}
            onClick={() => {
              const a = action;
              setAction(null);
              if (a?.kind === "dimMenu") onRemoveDim(a.index);
              else if (a?.kind === "valueMenu") onRemoveValue(a.index, a.value);
            }}
          >
            <Trash2 size={16} aria-hidden /> {action?.kind === "dimMenu" ? "Hapus pilihan ini" : "Hapus nilai"}
          </button>
        </div>
      </Modal>

      <Modal
        open={action?.kind === "renameDim" || action?.kind === "renameValue"}
        title={action?.kind === "renameDim" ? "Ganti nama pilihan" : "Ganti nama nilai"}
        onClose={() => setAction(null)}
        footer={
          <>
            <button type="button" className={btn.secondary} onClick={() => setAction(null)}>
              Batal
            </button>
            <button type="button" className={btn.primary} onClick={rename}>
              Simpan
            </button>
          </>
        }
      >
        <Field id={rid} label={action?.kind === "renameDim" ? "Nama pilihan" : action?.kind === "renameValue" ? dims[action.index]?.name ?? "Nilai" : "Nilai"} error={error ?? undefined}>
          <input
            id={rid}
            className={inputClass}
            autoFocus
            value={text}
            maxLength={action?.kind === "renameDim" ? LIMITS.dimensionName : LIMITS.variantValue}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                rename();
              }
            }}
          />
        </Field>
      </Modal>
    </div>
  );
}

/** Pilihan baru (nama + nilai) atau tambah nilai ke pilihan [existing] (`_DimensionForm`). */
function DimensionDialog({ existing, taken, onClose, onSave }: { existing?: VariantDimension; taken: Set<string>; onClose: () => void; onSave: (d: VariantDimension) => void }) {
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [values, setValues] = useState<string[]>([]);
  const [valuesError, setValuesError] = useState<string | null>(null);
  const fid = useId();
  const current = existing?.values ?? [];

  /** Menambah isi kolom nilai (dipisah koma); null bila ada yang tidak sah. */
  function take(): string[] | null {
    const parts = value
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (!parts.length) return values;
    const seen = new Set([...current, ...values].map(norm));
    for (const p of parts) {
      if (p.length > LIMITS.variantValue) {
        setValuesError(`Nilai maksimal ${LIMITS.variantValue} huruf.`);
        return null;
      }
      if (seen.has(norm(p))) {
        setValuesError(`"${p}" sudah ada di pilihan ini.`);
        return null;
      }
      seen.add(norm(p));
    }
    if (current.length + values.length + parts.length > LIMITS.dimensionValues) {
      setValuesError(`Maksimal ${LIMITS.dimensionValues} nilai per pilihan.`);
      return null;
    }
    const next = [...values, ...parts];
    setValues(next);
    setValue("");
    setValuesError(null);
    return next;
  }

  function submit() {
    let nameOk = true;
    if (!existing) {
      const n = name.trim();
      const problem = !n ? "Nama pilihan wajib diisi." : n.length > LIMITS.dimensionName ? `Nama pilihan maksimal ${LIMITS.dimensionName} huruf.` : taken.has(norm(n)) ? "Nama pilihan sudah dipakai." : null;
      setNameError(problem);
      nameOk = !problem;
    }
    const all = take();
    if (!all) return;
    if (!all.length) return setValuesError("Tambahkan minimal satu nilai.");
    if (!nameOk) return;
    onSave({ name: existing ? existing.name : name.trim(), values: all });
  }

  const suggestions = SUGGESTIONS.filter((s) => !taken.has(norm(s)));
  return (
    <Modal
      open
      title={existing ? `Tambah nilai · ${existing.name}` : "Tambah pilihan"}
      icon={<Layers size={18} aria-hidden />}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={submit}>
            Simpan
          </button>
        </>
      }
    >
      <div className="space-y-3.5">
        {!existing && (
          <Field id={`${fid}-n`} label="Nama pilihan" error={nameError ?? undefined}>
            <input id={`${fid}-n`} className={inputClass} autoFocus placeholder="Mis. Ukuran" maxLength={LIMITS.dimensionName} value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError || undefined} />
            {suggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => setName(s)} className={`rounded-full border border-border-subtle px-2.5 py-0.5 text-[12.5px] hover:border-border-active ${focusRing}`}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}
        <div>
          <label htmlFor={`${fid}-v`} className="mb-1.5 block text-[13px] font-semibold">
            Nilai
          </label>
          <div className="flex gap-2">
            <input
              id={`${fid}-v`}
              className={inputClass}
              autoFocus={!!existing}
              placeholder="Mis. S, M, L"
              value={value}
              aria-invalid={!!valuesError || undefined}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  take();
                }
              }}
            />
            <button type="button" className={btn.secondary} onClick={() => take()} aria-label="Nilai">
              <Plus size={16} aria-hidden />
            </button>
          </div>
          <p className={`mt-1.5 text-[12.5px] ${valuesError ? "text-danger" : "text-text-muted"}`}>{valuesError ?? "Ketik lalu Enter; boleh dipisah koma"}</p>
          {values.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {values.map((v) => (
                <li key={v} className="inline-flex items-center gap-0.5 rounded-full bg-bg-muted py-0.5 pr-0.5 pl-3 text-[13px]">
                  {v}
                  <button type="button" className={`${iconBtn} h-7 w-7`} aria-label={`Hapus ${v}`} onClick={() => setValues(values.filter((x) => x !== v))}>
                    <X size={13} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ——— Daftar kombinasi ———

export function ComboList({
  variants,
  costOf,
  unpriced,
  unit,
  stockOf,
  showErrors,
  onOpen,
  onActive,
  onReorder,
}: {
  variants: VDraft[];
  costOf: (v: VDraft) => ResolvedCost;
  unpriced: Set<string>;
  unit: string;
  stockOf: ((v: VDraft) => VariantStock) | null;
  showErrors: boolean;
  onOpen: (id: string) => void;
  onActive: (id: string, active: boolean) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  return (
    <ul className="divide-y divide-border-subtle overflow-hidden rounded-[12px] border border-border-subtle bg-white">
      {variants.map((v, i) => {
        const missing = unpriced.has(v.id);
        const c = costOf(v);
        const costText = c.source === "none" ? "HPP belum diisi" : `HPP ${formatRupiah(c.cost ?? 0)} (${c.source === "manual" ? "manual" : "resep"})`;
        const m = c.cost !== null && !missing && v.price > 0 ? marginPercent(v.price, c.cost) : null;
        const stock = stockOf?.(v) ?? null;
        const stockMissing = stock?.isNew && stock.qty === null;
        const stockText = !stock ? null : stock.isNew ? (stock.qty === null ? "Stok awal belum diisi" : `Stok awal: ${formatQty(stock.qty)} ${unit}`) : `Stok ${formatQty(stock.qty ?? 0)} ${unit}`;
        return (
          <li
            key={v.id}
            draggable
            onDragStart={(e) => {
              setDrag(i);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (drag === null) return;
              e.preventDefault();
              setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag !== null && drag !== i) onReorder(drag, i);
              setDrag(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            className={`flex items-center gap-1.5 py-2 pr-3 pl-1 ${over === i && drag !== null && drag !== i ? "bg-brand-tint" : ""} ${drag === i ? "opacity-50" : ""}`}
          >
            <span className="cursor-grab text-text-muted" title={`Seret untuk mengurutkan ${v.name}`} aria-hidden>
              <GripVertical size={18} />
            </span>
            <span className="flex flex-col">
              <button type="button" className={`${iconBtn} h-6 w-7`} onClick={() => onReorder(i, i - 1)} disabled={i === 0} aria-label={`Naikkan ${v.name}`}>
                <ArrowUp size={14} aria-hidden />
              </button>
              <button type="button" className={`${iconBtn} h-6 w-7`} onClick={() => onReorder(i, i + 1)} disabled={i === variants.length - 1} aria-label={`Turunkan ${v.name}`}>
                <ArrowDown size={14} aria-hidden />
              </button>
            </span>
            <button type="button" onClick={() => onOpen(v.id)} className={`min-w-0 flex-1 rounded px-1 text-left ${focusRing} ${v.is_active ? "" : "opacity-60"}`}>
              <span className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{v.name}</span>
                <span className={`shrink-0 text-[14px] font-semibold tabular-nums ${missing ? (showErrors ? "text-danger" : "text-warning") : ""}`}>{missing ? "Harga belum diisi" : formatRupiah(v.price)}</span>
              </span>
              <span className="block truncate text-[12.5px] text-text-muted">
                {[costText, m !== null ? `margin ${m.toLocaleString("id-ID")}%` : null].filter(Boolean).join(" · ")}
              </span>
              {stockText && <span className={`block text-[12.5px] ${stockMissing ? "text-warning" : "text-text-muted"}`}>{stockText}</span>}
            </button>
            <Check checked={v.is_active} onChange={(on) => onActive(v.id, on)} label={`${v.name} dijual`} srOnlyLabel />
          </li>
        );
      })}
    </ul>
  );
}

// ——— Lembar satu varian ———

export type VariantEdit = { draft: VDraft; mode: CostMode; recipe: RecipeItem[] };

export function VariantSheet({
  variant,
  mode,
  recipe,
  batch,
  unit,
  trackStock,
  isNew,
  showRecipe,
  priceMissing,
  barcodeOwner,
  currentStock,
  materials,
  createMaterial,
  onUploaded,
  onSave,
  onClose,
}: {
  variant: VDraft;
  mode: CostMode;
  recipe: RecipeItem[];
  /** Catatan isian per adonan dari aplikasi (batch segar resep varian); null = per porsi. */
  batch?: RecipeBatch | null;
  unit: string;
  trackStock: boolean;
  isNew: boolean;
  showRecipe: boolean;
  priceMissing: boolean;
  barcodeOwner: (code: string) => string | null;
  currentStock: React.ReactNode;
  materials: RawMaterial[];
  createMaterial: CreateMaterial;
  onUploaded: (url: string) => void;
  onSave: (e: VariantEdit) => void;
  onClose: () => void;
}) {
  const [price, setPrice] = useState<number | null>(priceMissing ? null : variant.price);
  const [cost, setCost] = useState<number | null>(variant.cost_price);
  const [costMode, setCostMode] = useState<CostMode>(showRecipe ? mode : "manual");
  const [items, setItems] = useState<RecipeItem[]>(recipe);
  const [sku, setSku] = useState(variant.sku ?? "");
  const [barcode, setBarcode] = useState(variant.barcode ?? "");
  const [barcodes, setBarcodes] = useState<string[]>(variant.barcodes);
  const [min, setMin] = useState(variant.min_stock === null ? "" : formatQty(variant.min_stock));
  const [initial, setInitial] = useState(variant.initial_stock === null ? "" : formatQty(variant.initial_stock));
  const [image, setImage] = useState(variant.image_url);
  const [active, setActive] = useState(variant.is_active);
  const [uploads, setUploads] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmClose, setConfirmClose] = useState(false);
  const fid = useId();
  const snapshot = JSON.stringify([price, cost, costMode, items, sku, barcode, barcodes, min, initial, image, active]);
  const [initialSnap] = useState(snapshot);

  function submit() {
    const e: Record<string, string> = {};
    if (price === null) e.price = "Wajib diisi";
    if (sku.trim().length > LIMITS.code) e.sku = `Maksimal ${LIMITS.code} karakter`;
    const bc = barcode.trim();
    if (bc.length > LIMITS.code) e.barcode = `Maksimal ${LIMITS.code} karakter`;
    else if (bc) {
      const owner = barcodeOwner(bc);
      if (owner !== null) e.barcode = `Barcode ini sudah dipakai ${owner}`;
      else if (barcodes.some((b) => norm(b) === norm(bc))) e.barcode = `Barcode ini sudah dipakai ${variant.name}`;
    }
    const minErr = qtyError(min);
    if (minErr) e.min_stock = minErr;
    const initErr = isNew ? qtyError(initial) : null;
    if (initErr) e.initial_stock = initErr;
    setErrors(e);
    if (Object.keys(e).length) return;
    const manual = costMode === "manual";
    onSave({
      draft: {
        ...variant,
        price: price ?? 0,
        is_active: active,
        cost_price: manual ? cost : null,
        min_stock: min.trim() ? parseQty(min) : null,
        sku: nullIfBlank(sku),
        barcode: nullIfBlank(barcode),
        barcodes,
        initial_stock: isNew && initial.trim() ? parseQty(initial) : null,
        image_url: image,
      },
      mode: costMode,
      recipe: items,
    });
  }

  const close = () => (snapshot === initialSnap ? onClose() : setConfirmClose(true));
  return (
    <Sheet
      open
      title={variant.name || "Varian"}
      subtitle="Varian"
      onClose={close}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={close}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={submit} disabled={uploads > 0}>
            Simpan
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field id={`${fid}-p`} label="Harga" error={errors.price}>
          <MoneyInput id={`${fid}-p`} value={price} onChange={setPrice} invalid={!!errors.price} placeholder="Mis. 25.000" />
        </Field>
        <div className="space-y-2">
          <p className="text-[13px] font-semibold">HPP (harga modal)</p>
          {showRecipe && <CostModeSwitch mode={costMode} onChange={setCostMode} />}
          {costMode === "manual" ? (
            <>
              <Field id={`${fid}-c`} label="Harga modal">
                <MoneyInput id={`${fid}-c`} value={cost} onChange={setCost} placeholder="Opsional" />
              </Field>
              {price !== null && cost !== null && <MarginLine price={price} cost={cost} unit={unit} />}
              {showRecipe && items.length > 0 && (
                <p className="text-[12.5px] text-text-muted">
                  {mode === "manual"
                    ? "Modal manual menimpa HPP resep. Resep tetap memotong stok bahan; pilih Resep untuk memakai HPP-nya."
                    : "Resep akan dihapus saat disimpan karena sumber HPP diganti ke Modal manual."}
                </p>
              )}
            </>
          ) : (
            <RecipeEditor
              targets={[{ key: variant.id, label: variant.name, price, manualCost: null }]}
              recipes={{ [variant.id]: items }}
              batches={batch ? { [variant.id]: batch } : undefined}
              onChange={(r) => setItems(r[variant.id] ?? [])}
              materials={materials}
              createMaterial={createMaterial}
            />
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={`${fid}-s`} label="SKU (opsional)" error={errors.sku}>
            <input id={`${fid}-s`} className={inputClass} placeholder="Mis. KOP-001" maxLength={LIMITS.code} value={sku} onChange={(e) => setSku(e.target.value)} aria-invalid={!!errors.sku || undefined} />
          </Field>
          <Field id={`${fid}-b`} label="Barcode (opsional)" error={errors.barcode}>
            <input id={`${fid}-b`} className={inputClass} placeholder="Mis. 8991234567890" maxLength={LIMITS.code} value={barcode} onChange={(e) => setBarcode(e.target.value)} aria-invalid={!!errors.barcode || undefined} />
          </Field>
        </div>
        <BarcodeEditor codes={barcodes} onChange={setBarcodes} ownerOf={(c) => (norm(c) === norm(barcode) ? variant.name : barcodeOwner(c))} />
        {trackStock && (
          <div className="grid gap-4 sm:grid-cols-2">
            {isNew ? (
              <Field id={`${fid}-i`} label="Stok awal" error={errors.initial_stock}>
                <QtyInput id={`${fid}-i`} value={initial} onChange={setInitial} unit={unit} invalid={!!errors.initial_stock} />
              </Field>
            ) : (
              currentStock
            )}
            <Field id={`${fid}-m`} label="Stok minimum" error={errors.min_stock} hint="Peringatan stok menipis muncul bila stok di bawah stok minimum.">
              <QtyInput id={`${fid}-m`} value={min} onChange={setMin} unit={unit} placeholder="Mis. 5" invalid={!!errors.min_stock} />
            </Field>
          </div>
        )}
        <PhotoField
          name={variant.name}
          url={image}
          label="Foto varian"
          emptyHint="Opsional — tanpa foto, kasir memakai foto produk."
          onChange={(u) => {
            if (u) onUploaded(u);
            setImage(u);
          }}
          onUploading={(on) => setUploads((n) => Math.max(0, n + (on ? 1 : -1)))}
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold">Dijual</p>
            <p className="text-[13px] text-text-muted">Nonaktif = tidak bisa dipilih di kasir</p>
          </div>
          <Check checked={active} onChange={setActive} label="Dijual" srOnlyLabel />
        </div>
        <button type="submit" className="sr-only" tabIndex={-1}>
          Simpan
        </button>
      </form>
      <ConfirmDialog open={confirmClose} title="Buang perubahan?" confirmLabel="Buang" tone="danger" onConfirm={onClose} onClose={() => setConfirmClose(false)}>
        <p>Perubahan pada varian ini belum diterapkan.</p>
      </ConfirmDialog>
    </Sheet>
  );
}

// ——— Isi massal ———

export function BulkFillSheet({
  dims,
  variants,
  trackStock,
  unit,
  unpriced,
  hasRecipe,
  isNew,
  onApply,
  onClose,
}: {
  dims: VariantDimension[];
  variants: VDraft[];
  trackStock: boolean;
  unit: string;
  unpriced: Set<string>;
  hasRecipe: (id: string) => boolean;
  isNew: (v: VDraft) => boolean;
  onApply: (changed: VDraft[], priced: boolean) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<Record<string, string[]>>(() => Object.fromEntries(dims.map((d) => [d.name, []])));
  const [price, setPrice] = useState<number | null>(null);
  const [cost, setCost] = useState<number | null>(null);
  const [min, setMin] = useState("");
  const [initial, setInitial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<BulkChange[] | null>(null);
  const fid = useId();
  const targets = bulkTargets(variants, filter);
  const anyNew = variants.some(isNew);
  const fill: BulkFill = {
    price,
    cost_price: cost,
    min_stock: min.trim() ? parseQty(min) : null,
    initial_stock: initial.trim() ? parseQty(initial) : null,
  };

  function showPreview() {
    const problem = qtyError(min) ?? qtyError(initial);
    if (problem) return setError(problem);
    if (fill.price === null && fill.cost_price === null && fill.min_stock === null && fill.initial_stock === null) return setError("Isi minimal satu kolom.");
    const changes = previewBulk(targets, fill, isNew, unpriced);
    if (!changes.length) return setError("Tidak ada yang berubah untuk kombinasi ini.");
    setError(null);
    setPreview(changes);
  }

  const money = (v: number | null) => (v === null ? "–" : formatRupiah(v));
  const qty = (v: number | null) => (v === null ? "–" : `${formatQty(v)} ${unit}`);
  const lines = (c: BulkChange) => {
    const b = c.before;
    const a = c.after;
    const missing = unpriced.has(b.id);
    return [
      a.price !== b.price || missing ? `Harga ${missing ? "Harga belum diisi" : money(b.price)} → ${money(a.price)}` : null,
      a.cost_price !== b.cost_price ? `HPP ${money(b.cost_price)} → ${money(a.cost_price)}` : null,
      a.initial_stock !== b.initial_stock ? `Stok awal ${qty(b.initial_stock)} → ${qty(a.initial_stock)}` : null,
      a.min_stock !== b.min_stock ? `Stok min ${qty(b.min_stock)} → ${qty(a.min_stock)}` : null,
    ].filter(Boolean);
  };

  if (preview) {
    const recipeReplaced = fill.cost_price !== null && preview.some((c) => hasRecipe(c.before.id));
    return (
      <Sheet
        open
        title="Pratinjau isi massal"
        subtitle={`${preview.length} varian berubah`}
        onClose={onClose}
        footer={
          <>
            <button type="button" className={btn.secondary} onClick={() => setPreview(null)}>
              Ubah
            </button>
            <button type="button" className={btn.primary} onClick={() => onApply(preview.map((c) => c.after), fill.price !== null)}>
              Terapkan ke {preview.length} varian
            </button>
          </>
        }
      >
        {recipeReplaced && <p className="mb-2 text-[12.5px] text-warning">Sebagian varian memakai resep — HPP-nya diganti modal manual (resepnya dihapus saat disimpan).</p>}
        <ul className="divide-y divide-border-subtle">
          {preview.map((c) => (
            <li key={c.after.id} className="py-2.5">
              <p className="font-semibold">{c.after.name}</p>
              {lines(c).map((l) => (
                <p key={l} className="text-[12.5px] text-text-muted">
                  {l}
                </p>
              ))}
            </li>
          ))}
        </ul>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      title="Isi massal"
      subtitle="Harga, HPP, atau stok sekaligus"
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={showPreview} disabled={!targets.length}>
            <Eye size={16} aria-hidden /> Lihat pratinjau
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
          <p className="text-[13px] font-semibold">Terapkan ke</p>
          <p className="text-[12.5px] text-text-muted">
            {targets.length} dari {variants.length} kombinasi. Tanpa pilihan = semua.
          </p>
          {dims.map((d) => (
            <div key={d.name} className="mt-2.5">
              <p className="mb-1.5 text-[12.5px] text-text-muted">{d.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {[null, ...d.values].map((v) => {
                  const sel = filter[d.name] ?? [];
                  const on = v === null ? !sel.length : sel.includes(v);
                  return (
                    <button
                      key={v ?? "\u0000semua"}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setFilter((f) => ({
                          ...f,
                          [d.name]: v === null ? [] : sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v],
                        }))
                      }
                      className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${on ? "border-brand-primary bg-brand-tint" : "border-border-subtle"} ${focusRing}`}
                    >
                      {v ?? "Semua"}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12.5px] text-text-muted">Kosongkan kolom yang tidak ingin diubah.</p>
        <Field id={`${fid}-p`} label="Harga">
          <MoneyInput id={`${fid}-p`} value={price} onChange={setPrice} placeholder="Tidak diubah" />
        </Field>
        <Field id={`${fid}-c`} label="HPP manual">
          <MoneyInput id={`${fid}-c`} value={cost} onChange={setCost} placeholder="Tidak diubah" />
        </Field>
        {trackStock && anyNew && (
          <Field id={`${fid}-i`} label="Stok awal (varian baru)">
            <QtyInput id={`${fid}-i`} value={initial} onChange={setInitial} unit={unit} placeholder="Tidak diubah" />
          </Field>
        )}
        {trackStock && (
          <Field id={`${fid}-m`} label="Stok minimum">
            <QtyInput id={`${fid}-m`} value={min} onChange={setMin} unit={unit} placeholder="Tidak diubah" />
          </Field>
        )}
      </div>
    </Sheet>
  );
}

