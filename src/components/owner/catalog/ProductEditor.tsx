"use client";

import React, { useEffect, useRef, useState } from "react";
import { CircleDot, Circle, FileClock, Layers, ListChecks, Plus, Tag, Trash2 } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, errorMessage, Field, focusRing, inputClass, Notice, Spinner, Switch, useLoad } from "@/components/admin/ui";
import { newId, ownerApi, pushChanges } from "@/lib/owner/api";
import {
  codeKey,
  CONFLICT_MESSAGE,
  createChange,
  deleteChange,
  editChange,
  fieldLabel,
  formatQty,
  LIMITS,
  milliToInput,
  norm,
  nullIfBlank,
  parseQty,
  PRODUCT_UNITS,
  resultFieldErrors,
  sortCategories,
  sortVariants,
  type Product,
  type Variant,
} from "@/lib/owner/catalog";
import {
  cheapest,
  clearDraft,
  commitPlan,
  draftOf,
  EMPTY_EDITOR,
  editorIssues,
  ent,
  loadDraft,
  loadEditor,
  planAddDimension,
  planAddValues,
  planRemoveDimension,
  planRemoveValue,
  planRenameDimension,
  planRenameValue,
  PRODUCT_KEY,
  recipeCost,
  reorder,
  sameRecipe,
  saveDraft,
  stockMoveChange,
  toSave,
  updateAll,
  updateVariant,
  type CostMode,
  type EditorState,
  type RecipeItem,
  type VariantPlan,
  type VariantSource,
  type VDraft,
} from "@/lib/owner/productForm";
import type { BusinessType, Change, ChangeResult, StockRow } from "@/lib/owner/types";
import { deleteUploadedPhotos } from "@/lib/owner/upload";
import { useOwner } from "../OwnerShell";
import { Check, MoneyInput, Sheet } from "./bits";
import { BarcodeEditor, CostModeSwitch, CurrentStock, MarginLine, pushNewMaterial, QtyInput, qtyError, RecipeEditor, StockRecipeWarning, type CreateMaterial, type StockContext } from "./formParts";
import { GroupEditor } from "./ModifiersPanel";
import { PhotoField } from "./PhotoField";
import type { CatalogData, CommitOutcome } from "./useCatalog";
import type { InventoryData } from "./useInventory";
import { BulkFillSheet, ComboList, DimensionsView, VariantSheet, type ResolvedCost } from "./VariantParts";
import { Select } from "../Select";

// Tambah/ubah produk — SAMA dengan form aplikasi (`product_form_screen.dart`): urutan seksi, label, pilihan, nilai
// bawaan, validasi, dan aturan simpan. Urutan: foto · nama · kategori → Satuan & stok (+ peringatan stok & resep) →
// Jenis harga (Satu harga | Punya varian) → harga, HPP (Modal manual | Resep), stok awal/saat ini + minimum, kode +
// barcode tambahan — atau pilihan varian 1–3 (kombinasi otomatis) + daftar kombinasi (seret/naik-turun = sort_order
// 0..n, lembar per varian, Isi massal) → pengaturan jual → grup modifier (bisa membuat grup baru).
//
// Simpan (`CatalogRepository.saveProduct`): satu kiriman /owner/changes = produk → hapus resep varian terhapus → hapus
// varian → varian baru/berubah → resep yang berubah (satu resep per produk/varian; `variant_id` null = resep produk).
// Setelah record `applied`, gerakan stok dikirim terpisah: stok awal (`in`, unit_cost = modal manual) untuk produk/
// varian baru, dan pindah stok lama ke varian (`adjust` −stok produk & +stok varian, catatan "Pindah stok lama ke
// varian") bila produk pertama kali diberi varian. Penyesuaian stok produk tersimpan = lembar terpisah (langsung
// tercatat, seperti aplikasi). Foto lama yang diganti/dihapus lalu dibersihkan (best effort).
// Punya varian: `price` = harga varian aktif termurah, modal & resep produk dipindah ke varian (`_adoptProductCost`).
// Draf produk baru tersimpan otomatis di browser ini (localStorage) dan ditawarkan saat membuka "Tambah produk".

type Form = {
  v: 2;
  image: string | null;
  name: string;
  categoryId: string;
  unit: string;
  trackStock: boolean;
  hasVariants: boolean;
  price: number | null;
  cost: number | null;
  sku: string;
  barcode: string;
  barcodes: string[];
  minStock: string;
  initialStock: string;
  editor: EditorState;
  /** Sumber HPP yang SENGAJA dipilih pemilik per target ("" = produk). */
  costModes: Record<string, CostMode>;
  /** Resep per target ("" = produk, lalu id varian). */
  recipes: Record<string, RecipeItem[]>;
  duration: string;
  active: boolean;
  taxable: boolean;
  cookable: boolean;
  groupIds: string[];
};

const OTHER_UNIT = "\u0000lain";
const NEW_CATEGORY = "\u0000baru";
const MOVE_NOTE = "Pindah stok lama ke varian";

const clean = (items: RecipeItem[] | undefined) => (items ?? []).filter((i) => i.qty > 0);

/** Resep tersimpan produk [productId] per kunci target. */
function recipesOf(inv: InventoryData | null, productId: string): Record<string, RecipeItem[]> {
  const out: Record<string, RecipeItem[]> = {};
  for (const r of inv?.recipes ?? []) if (r.product_id === productId) out[r.variant_id ?? PRODUCT_KEY] = r.items;
  return out;
}

/**
 * Isian awal dari record. [recipesKnown] = resep termuat: produk bervarian lama → modal/resep produk dipindah ke varian
 * tanpa sumber sendiri (`_adoptProductCost`; tersimpan hanya bila pemilik menyimpan).
 */
function initForm(p: Product | undefined, variants: Variant[], recipes: Record<string, RecipeItem[]>, defaultCategory: string, recipesKnown: boolean): Form {
  let editor = p ? loadEditor(sortVariants(variants).map(draftOf), p.variant_options ?? []) : EMPTY_EDITOR;
  let cost = p?.cost_price ?? null;
  let recs = { ...recipes };
  if (p && editor.variants.length && recipesKnown) {
    const productRecipe = recs[PRODUCT_KEY] ?? [];
    if (productRecipe.length || cost !== null) {
      const productCost = cost;
      const next = { ...recs };
      editor = {
        ...editor,
        variants: editor.variants.map((v) => {
          const own = (next[v.id] ?? []).length > 0;
          if (!own && productRecipe.length) next[v.id] = productRecipe;
          return v.cost_price === null && !own && productCost !== null ? { ...v, cost_price: productCost } : v;
        }),
      };
      next[PRODUCT_KEY] = [];
      recs = next;
      cost = null;
    }
  }
  return {
    v: 2,
    image: p?.image_url ?? null,
    name: p?.name ?? "",
    categoryId: p ? (p.category_id ?? "") : defaultCategory,
    unit: p?.unit ?? PRODUCT_UNITS[0],
    trackStock: p?.track_stock ?? false,
    hasVariants: editor.variants.length > 0,
    price: p ? p.price : null,
    cost,
    sku: p?.sku ?? "",
    barcode: p?.barcode ?? "",
    barcodes: [...(p?.barcodes ?? [])],
    minStock: milliToInput(p?.min_stock ?? 0),
    initialStock: "",
    editor,
    costModes: {},
    recipes: recs,
    duration: p?.duration_min ? String(p.duration_min) : "",
    active: p?.is_active ?? true,
    taxable: p?.is_taxable ?? true,
    cookable: p?.is_cookable ?? true,
    groupIds: [...(p?.modifier_group_ids ?? [])],
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

function diff(rec: Record<string, unknown>, patch: Record<string, unknown>): boolean {
  return Object.entries(patch).some(([k, v]) => !same(rec[k], v));
}

type Confirm = { title: string; body: React.ReactNode; label: string; run: () => void; keepOpen?: boolean; tone?: "danger" | "primary" };

type Props = {
  productId: string | null;
  data: CatalogData;
  commit: (changes: Change[]) => Promise<CommitOutcome>;
  businessType: BusinessType;
  /** Fitur dapur aktif di salah satu outlet (`outlets.settings.features.kitchen`, null = bawaan kuliner). */
  kitchen: boolean;
  /** Resep & bahan baku; null = gagal dimuat (resep tidak bisa diubah, data resep dipertahankan). */
  inventory: InventoryData | null;
  inventoryLoading: boolean;
  /** Terapkan hasil kiriman `recipes`/`raw_materials` ke data resep lokal. */
  onInventoryResults: (results: ChangeResult[]) => void;
  defaultCategory?: string;
  onClose: () => void;
};

/** Menunggu resep & bahan baku termuat (isian awal bergantung pada resep), lalu membuka form. */
export function ProductEditor(props: Props) {
  if (props.inventoryLoading && !props.inventory) {
    return (
      <Sheet open wide title={props.productId ? "Ubah produk" : "Tambah produk"} onClose={props.onClose}>
        <p className="flex items-center gap-2 text-[14px] text-text-muted">
          <Spinner /> Memuat resep & bahan baku…
        </p>
      </Sheet>
    );
  }
  return <ProductForm {...props} />;
}

function ProductForm({ productId, data, commit, businessType, kitchen, inventory, onInventoryResults, defaultCategory = "", onClose }: Props) {
  const toast = useToast();
  const { session, outletId: shellOutlet } = useOwner();
  const [id] = useState(() => productId ?? newId());
  const original = data.products.find((p) => p.id === id);
  const existing = !!original;
  const recipesKnown = inventory !== null;
  const [initial] = useState(() => initForm(original, data.variants.filter((v) => v.product_id === id), recipesOf(inventory, id), defaultCategory, recipesKnown));
  const [form, setForm] = useState<Form>(initial);
  const [baseline, setBaseline] = useState(() => JSON.stringify(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, Record<string, string>>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [notice, setNotice] = useState<{ tone: "warning" | "danger"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploads, setUploads] = useState(0);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [otherUnit, setOtherUnit] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState<{ name: string; error?: string } | null>(null);
  const [editingVariant, setEditingVariant] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [groupEditor, setGroupEditor] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [move, setMove] = useState<{ total: number; levels: { outletId: string; qty: number }[] } | null>(null);
  const [draftOffer, setDraftOffer] = useState<Form | null>(() => (productId ? null : validDraft(loadDraft<Form>(session.business.id))));
  const [stockOutlet, setStockOutlet] = useState<string>(() => shellOutlet ?? (session.outlets.length === 1 ? session.outlets[0].id : ""));
  /** Foto yang diunggah di form ini (dihapus lagi bila akhirnya tidak dipakai). */
  const uploaded = useRef(new Set<string>());

  function validDraft(d: Form | null): Form | null {
    if (!d || d.v !== 2 || !d.editor || !Array.isArray(d.editor.variants)) return null;
    return {
      ...d,
      categoryId: data.categories.some((c) => c.id === d.categoryId) ? d.categoryId : "",
      groupIds: (d.groupIds ?? []).filter((g) => data.groups.some((x) => x.id === g)),
      barcodes: d.barcodes ?? [],
      costModes: d.costModes ?? {},
      recipes: d.recipes ?? {},
    };
  }

  const categories = sortCategories(data.categories);
  const groups = [...data.groups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "id"));
  const isService = businessType === "service";
  const showDuration = isService || original?.duration_min != null;
  const savedVariantIds = new Set(data.variants.filter((v) => v.product_id === id).map((v) => v.id));
  const materials = inventory?.materials ?? [];
  const materialsById = new Map(materials.map((m) => [m.id, m]));
  const anyRecipe = Object.values(form.recipes).some((r) => r.length > 0);
  // Ritel tanpa bahan baku tidak butuh resep; jasa tidak memakai resep.
  const showRecipe = recipesKnown && !isService && (businessType !== "retail" || materials.length > 0 || anyRecipe);
  const dirty = JSON.stringify(form) !== baseline;
  const uploading = uploads > 0;
  const editor = form.editor;
  const unpriced = new Set(editor.unpriced);
  const multiOutlet = session.outlets.length > 1;
  const outletName = session.outlets.find((o) => o.id === stockOutlet)?.name ?? null;

  // Stok saat ini per outlet stok (produk tersimpan ber-lacak stok).
  const stock = useLoad<StockRow[]>(
    async (signal) => (existing && stockOutlet ? (await ownerApi()).stock({ outlet_id: stockOutlet }, signal) : []),
    [existing ? id : "", stockOutlet]
  );
  const stockRow = (variantId: string | null) => stock.state.data?.find((r) => r.kind === "product" && r.product_id === id && (r.variant_id ?? null) === variantId) ?? null;
  const stockCtx: StockContext = { outletId: stockOutlet || null, outletName, employeeId: session.user.id, reload: stock.reload };

  // Draf produk baru: simpan otomatis (ditunda sebentar) selama isian berubah.
  useEffect(() => {
    if (productId || existing || draftOffer || !dirty) return;
    const t = setTimeout(() => saveDraft(session.business.id, form), 600);
    return () => clearTimeout(t);
  }, [form, dirty, productId, existing, draftOffer, session.business.id]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setEditor = (fn: (e: EditorState) => EditorState) => setForm((f) => ({ ...f, editor: fn(f.editor) }));
  const onUploading = (on: boolean) => setUploads((n) => Math.max(0, n + (on ? 1 : -1)));
  const onUploaded = (url: string) => uploaded.current.add(url);

  // ——— Sumber HPP ———

  /** Sumber HPP target: pilihan pemilik, atau yang berlaku menurut data (modal manual menimpa resep). */
  const modeOf = (f: Form, key: string, manual: number | null): CostMode => f.costModes[key] ?? (manual === null && (f.recipes[key] ?? []).length ? "recipe" : "manual");
  /** Resep yang akan tersimpan (dibuang bila pemilik memilih Modal manual). */
  const keptRecipe = (f: Form, key: string): RecipeItem[] => (f.costModes[key] === "manual" ? [] : (f.recipes[key] ?? []));

  const variantCost = (v: VDraft): ResolvedCost => {
    if (!showRecipe || modeOf(form, v.id, v.cost_price) === "manual") return v.cost_price === null ? { cost: null, source: "none" } : { cost: v.cost_price, source: "manual" };
    const items = form.recipes[v.id] ?? [];
    return items.length ? { cost: recipeCost(items, materialsById), source: "recipe" } : { cost: null, source: "none" };
  };

  const createMaterial: CreateMaterial = async (d) => {
    const { material, results } = await pushNewMaterial(d);
    onInventoryResults(results);
    return material;
  };

  // ——— Jenis harga & varian ———

  function setHasVariants(value: boolean) {
    if (value === form.hasVariants) return;
    if (!value && editor.variants.length) {
      setConfirm({
        title: "Hapus semua varian?",
        body: `${editor.variants.length} varian beserta harga, HPP, dan resepnya akan dihapus saat produk disimpan. Produk kembali memakai satu harga.`,
        label: "Hapus",
        run: () => setForm((f) => ({ ...f, hasVariants: false, price: f.price ?? cheapest(f.editor.variants), editor: EMPTY_EDITOR })),
      });
      return;
    }
    set("hasVariants", value);
  }

  /** Isian kombinasi pertama saat produk satu harga diberi varian (harga, modal manual, stok minimum produk). */
  const template = (): VariantSource | null =>
    form.price === null
      ? null
      : { id: null, price: form.price, is_active: true, cost_price: modeOf(form, PRODUCT_KEY, form.cost) === "manual" ? form.cost : null, min_stock: form.minStock.trim() ? parseQty(form.minStock) : null };

  /** Terapkan rencana pilihan; varian terhapus (tersimpan atau sudah berisi) dikonfirmasi dulu. Kombinasi baru menyalin resep & sumber HPP sumbernya. */
  function applyPlan(p: VariantPlan) {
    const run = () =>
      setForm((f) => {
        const recipes = { ...f.recipes };
        const costModes = { ...f.costModes };
        for (const [nid, src] of Object.entries(p.sources)) {
          const from = recipes[src ?? PRODUCT_KEY];
          if (from?.length) recipes[nid] = from;
          const mode = f.costModes[src ?? PRODUCT_KEY];
          if (mode) costModes[nid] = mode;
        }
        return { ...f, recipes, costModes, editor: commitPlan(f.editor, p) };
      });
    const removed = p.result.removed.filter((v) => savedVariantIds.has(v.id) || !unpriced.has(v.id));
    if (!removed.length) return run();
    setConfirm({
      title: `Hapus ${removed.length} varian?`,
      body: `${removed.map((v) => v.name).join(", ")} akan dihapus beserta harga, HPP, dan resepnya saat produk disimpan.`,
      label: "Hapus",
      run,
    });
  }

  // ——— Barcode ———

  /** Pemilik barcode lain di usaha (produk/varian lain); [exceptVariant] → ikut produk ini & varian lain di form. */
  function barcodeOwner(code: string, exceptVariant?: string): string | null {
    const k = codeKey(code);
    const hit = (codes: (string | null | undefined)[]) => codes.some((c) => c && codeKey(c) === k);
    for (const p of data.products) if (p.id !== id && hit([p.barcode, ...(p.barcodes ?? [])])) return p.name;
    const names = new Map(data.products.map((p) => [p.id, p.name]));
    for (const v of data.variants) if (v.product_id !== id && hit([v.barcode, ...(v.barcodes ?? [])])) return `${names.get(v.product_id) ?? ""} · ${v.name}`;
    if (exceptVariant !== undefined) {
      const name = form.name.trim();
      if (hit([form.barcode.trim(), ...form.barcodes])) return name;
      for (const v of editor.variants) if (v.id !== exceptVariant && hit([v.barcode, ...v.barcodes])) return `${name} · ${v.name}`;
    }
    return null;
  }

  // ——— Kategori & satuan ———

  async function createCategory() {
    if (!newCategory) return;
    const n = newCategory.name.trim();
    let problem: string | null = null;
    if (!n) problem = "Wajib diisi";
    else if (n.length > LIMITS.categoryName) problem = `Maksimal ${LIMITS.categoryName} karakter`;
    else if (data.categories.some((c) => norm(c.name) === norm(n))) problem = "Kategori dengan nama itu sudah ada";
    if (problem) return setNewCategory({ name: newCategory.name, error: problem });
    const cid = newId();
    try {
      const out = await commit([createChange("categories", { name: n }, cid)]);
      const r = out.results[0];
      if (r?.status === "applied") {
        set("categoryId", cid);
        setNewCategory(null);
      } else setNewCategory({ name: newCategory.name, error: resultFieldErrors(r).name ?? r?.message ?? "Gagal membuat kategori." });
    } catch (err) {
      setNewCategory({ name: newCategory.name, error: errorMessage(err) });
    }
  }

  function applyOtherUnit() {
    const u = (otherUnit ?? "").trim().toLowerCase();
    if (!u) return;
    set("unit", u.slice(0, LIMITS.unit));
    setOtherUnit(null);
  }

  // ——— Validasi ———

  type Valid = { errs: Record<string, string>; rows: Record<string, Record<string, string>>; minStock: number; duration: number | null };

  function validate(): Valid {
    const errs: Record<string, string> = {};
    const rows: Record<string, Record<string, string>> = {};
    const name = form.name.trim();
    if (!name) errs.name = "Wajib diisi";
    else if (name.length > LIMITS.productName) errs.name = `Maksimal ${LIMITS.productName} karakter`;
    if (!form.unit.trim()) errs.unit = "Wajib diisi";
    const minStock = form.minStock.trim() ? parseQty(form.minStock) : 0;
    if (minStock === null) errs.min_stock = "Isi jumlah yang benar (mis. 2 atau 2,5)";
    let duration: number | null = null;
    if (showDuration && form.duration.trim()) {
      const d = Number(form.duration);
      if (!Number.isInteger(d) || d < 1 || d > LIMITS.maxDurationMin) errs.duration_min = "Isi 1–10080 menit";
      else duration = d;
    }
    if (form.groupIds.length > LIMITS.modifierGroups) errs.modifier_group_ids = `Maksimal ${LIMITS.modifierGroups} grup`;
    const needOutlet = "Pilih outlet stok untuk mencatat stok awal.";

    if (!form.hasVariants) {
      if (form.price === null) errs.price = "Wajib diisi";
      if (form.sku.trim().length > LIMITS.code) errs.sku = `Maksimal ${LIMITS.code} karakter`;
      const bc = form.barcode.trim();
      if (bc.length > LIMITS.code) errs.barcode = `Maksimal ${LIMITS.code} karakter`;
      else if (bc) {
        const owner = barcodeOwner(bc);
        if (owner !== null) errs.barcode = `Barcode ini sudah dipakai ${owner}`;
      }
      const taken = form.barcodes.map((b) => [b, barcodeOwner(b)] as const).find(([, o]) => o !== null);
      if (taken) errs.barcodes = `Barcode ${taken[0]} sudah dipakai ${taken[1]}`;
      if (form.trackStock && !existing) {
        const e = qtyError(form.initialStock);
        if (e) errs.initial_stock = e;
        else if ((parseQty(form.initialStock) ?? 0) > 0 && !stockOutlet) errs.initial_stock = needOutlet;
      }
      return { errs, rows, minStock: minStock ?? 0, duration };
    }

    const issues = editorIssues(editor);
    if (issues.length) errs.variants = issues.join(" ");
    const productName = name || "Produk ini";
    const own = new Map<string, string>();
    for (const r of editor.variants) {
      const e: Record<string, string> = {};
      if ((r.sku ?? "").length > LIMITS.code) e.sku = `Maksimal ${LIMITS.code} karakter`;
      for (const c of [r.barcode, ...r.barcodes]) {
        if (!c) continue;
        const owner = barcodeOwner(c) ?? own.get(codeKey(c)) ?? null;
        if (owner !== null) e.barcode = `Barcode ${c} sudah dipakai ${owner}`;
        own.set(codeKey(c), `${productName} · ${r.name}`);
      }
      if (form.trackStock && !savedVariantIds.has(r.id) && (r.initial_stock ?? 0) > 0 && !stockOutlet) e.initial_stock = needOutlet;
      if (Object.keys(e).length) rows[r.id] = e;
    }
    if (Object.values(rows).some((e) => e.initial_stock)) errs.stock_outlet = needOutlet;
    return { errs, rows, minStock: minStock ?? 0, duration };
  }

  // ——— Simpan ———

  async function save() {
    if (uploading || busy) return;
    setShowErrors(true);
    const v = validate();
    setErrors(v.errs);
    setRowErrors(v.rows);
    setNotice(null);
    if (Object.keys(v.errs).length || Object.keys(v.rows).length) {
      setNotice({ tone: "danger", text: "Periksa isian yang ditandai merah." });
      return;
    }
    // Produk yang punya stok level produk ≠ 0 dan pertama kali diberi varian: tanya stok lama dipindah ke mana.
    if (existing && savedVariantIds.size === 0 && form.hasVariants && editor.variants.length && original?.track_stock) {
      setBusy(true);
      try {
        const outlets = stockOutlet ? [stockOutlet] : session.outlets.map((o) => o.id);
        const api = await ownerApi();
        const levels: { outletId: string; qty: number }[] = [];
        for (const o of outlets) {
          const rows = await api.stock({ outlet_id: o });
          const q = rows.find((r) => r.kind === "product" && r.product_id === id && !r.variant_id)?.qty ?? 0;
          if (q !== 0) levels.push({ outletId: o, qty: q });
        }
        if (levels.length) {
          setMove({ total: levels.reduce((a, l) => a + l.qty, 0), levels });
          return;
        }
      } catch (err) {
        setNotice({ tone: "danger", text: `Stok lama tidak bisa dibaca: ${errorMessage(err)}` });
        return;
      } finally {
        setBusy(false);
      }
    }
    await persist(v, null);
  }

  async function persist(v: Valid, moveTo: { variantId: string; levels: { outletId: string; qty: number }[] } | null) {
    const cur = data.products.find((p) => p.id === id);
    const hasVariants = form.hasVariants && editor.variants.length > 0;
    const saved = hasVariants ? toSave(editor) : { dims: [], variants: [] as VDraft[] };
    const variants = saved.variants.map((r) => ({ ...r, name: r.name.trim(), cost_price: form.costModes[r.id] === "recipe" ? null : r.cost_price }));
    const barcode = nullIfBlank(form.barcode);
    const productCost = hasVariants ? (recipesKnown ? null : (cur?.cost_price ?? null)) : form.costModes[PRODUCT_KEY] === "recipe" ? null : form.cost;
    const productFields: Record<string, unknown> = {
      category_id: form.categoryId || null,
      name: form.name.trim(),
      description: cur?.description ?? "",
      price: hasVariants ? cheapest(variants) : form.price,
      sku: nullIfBlank(form.sku),
      barcode,
      image_url: form.image,
      is_active: form.active,
      cost_price: productCost,
      track_stock: form.trackStock,
      min_stock: v.minStock,
      unit: form.unit.trim(),
      is_taxable: form.taxable,
      is_cookable: form.cookable,
      barcodes: form.barcodes.filter((b) => b !== barcode),
      modifier_group_ids: form.groupIds,
      duration_min: showDuration ? v.duration : (cur?.duration_min ?? null),
      variant_options: hasVariants ? saved.dims : [],
    };

    const changes: Change[] = [];
    if (cur) {
      if (diff(cur as unknown as Record<string, unknown>, productFields)) changes.push(editChange("products", cur, productFields));
    } else changes.push(createChange("products", productFields, id));
    const kept = new Set(variants.map((r) => r.id));
    const removedVariants = data.variants.filter((rec) => rec.product_id === id && !kept.has(rec.id));
    const removedIds = new Set(removedVariants.map((r) => r.id));
    // Resep dihapus sebelum variannya.
    if (recipesKnown) for (const r of inventory?.recipes ?? []) if (r.product_id === id && r.variant_id && removedIds.has(r.variant_id)) changes.push(deleteChange(ent("recipes"), r));
    for (const rec of removedVariants) changes.push(deleteChange("product_variants", rec));
    variants.forEach((r, order) => {
      const rec = data.variants.find((x) => x.id === r.id);
      const fields: Record<string, unknown> = {
        product_id: id,
        name: r.name,
        price: r.price,
        is_active: r.is_active,
        sku: r.sku,
        barcode: r.barcode,
        cost_price: r.cost_price,
        min_stock: r.min_stock,
        barcodes: r.barcodes,
        sort_order: order,
        options: r.options,
        image_url: r.image_url,
      };
      if (!rec) changes.push(createChange("product_variants", fields, r.id));
      else if (diff(rec as unknown as Record<string, unknown>, fields)) changes.push(editChange("product_variants", rec, fields));
    });
    // Resep per target dibanding resep tersimpan di server (kosong = hapus).
    if (recipesKnown) {
      const targets: [string | null, RecipeItem[]][] = [[null, hasVariants ? [] : keptRecipe(form, PRODUCT_KEY)], ...variants.map((r) => [r.id, keptRecipe(form, r.id)] as [string, RecipeItem[]])];
      for (const [vid, items] of targets) {
        const want = clean(items);
        const rec = inventory?.recipes.find((r) => r.product_id === id && (r.variant_id ?? null) === vid);
        if (!want.length) {
          if (rec) changes.push(deleteChange(ent("recipes"), rec));
        } else if (!rec) changes.push(createChange(ent("recipes"), { product_id: id, variant_id: vid, items: want }));
        else if (!sameRecipe(rec.items, want)) changes.push(editChange(ent("recipes"), rec, { items: want }));
      }
    }
    if (!changes.length && !moveTo) {
      finishClean();
      return;
    }

    setBusy(true);
    let out: CommitOutcome;
    try {
      out = changes.length ? await commit(changes) : { results: [], next: data, summary: { applied: 0, conflict: 0, rejected: 0, total: 0 } };
    } catch (err) {
      setBusy(false);
      setNotice({ tone: "danger", text: `Gagal menyimpan: ${errorMessage(err)} Data dimuat ulang dari server.` });
      return;
    }
    onInventoryResults(out.results);
    const ok = (entity: string, rid: string) => out.results.find((r) => r.entity === entity && r.id === rid)?.status === "applied";
    const productOk = ok("products", id) || (!changes.some((c) => c.entity === "products") && !!cur);

    // Gerakan stok setelah record applied (stok awal & pindah stok lama).
    const moves: Change[] = [];
    if (form.trackStock && stockOutlet && productOk) {
      if (!cur && !hasVariants) {
        const q = parseQty(form.initialStock) ?? 0;
        if (q > 0) moves.push(stockMoveChange({ outlet_id: stockOutlet, product_id: id, variant_id: null, qty_delta: q, type: "in", unit_cost: productCost, employee_id: session.user.id }));
      }
      for (const r of variants) {
        if (savedVariantIds.has(r.id) || !ok("product_variants", r.id) || (r.initial_stock ?? 0) <= 0) continue;
        moves.push(
          stockMoveChange({ outlet_id: stockOutlet, product_id: id, variant_id: r.id, qty_delta: r.initial_stock ?? 0, type: "in", unit_cost: r.cost_price ?? productCost, employee_id: session.user.id })
        );
      }
    }
    if (moveTo && productOk && ok("product_variants", moveTo.variantId)) {
      for (const l of moveTo.levels) {
        moves.push(stockMoveChange({ outlet_id: l.outletId, product_id: id, variant_id: null, qty_delta: -l.qty, type: "adjust", note: MOVE_NOTE, employee_id: session.user.id }));
        moves.push(stockMoveChange({ outlet_id: l.outletId, product_id: id, variant_id: moveTo.variantId, qty_delta: l.qty, type: "adjust", note: MOVE_NOTE, employee_id: session.user.id }));
      }
    }
    let stockFailed = 0;
    if (moves.length) {
      try {
        const res = await pushChanges(moves);
        stockFailed = res.filter((r) => r.status !== "applied").length;
      } catch {
        stockFailed = moves.length;
      }
    }

    // Foto lama yang diganti/dihapus (record applied) + unggahan sesi ini yang tidak terpakai.
    const stale: (string | null)[] = [];
    if (cur?.image_url && cur.image_url !== form.image && ok("products", id)) stale.push(cur.image_url);
    for (const rec of data.variants.filter((x) => x.product_id === id && x.image_url)) {
      const now = variants.find((r) => r.id === rec.id);
      if ((now ? now.image_url !== rec.image_url : true) && ok("product_variants", rec.id)) stale.push(rec.image_url);
    }
    const used = new Set([form.image, ...variants.map((r) => r.image_url)]);
    for (const u of uploaded.current) if (!used.has(u)) stale.push(u);
    void deleteUploadedPhotos(stale);
    setBusy(false);

    if (out.summary.applied === out.summary.total) {
      if (!productId) clearDraft(session.business.id);
      if (stockFailed) toast.error(`Produk disimpan, tetapi ${stockFailed} gerakan stok ditolak server. Periksa stok di aplikasi.`);
      else toast.success(existing ? "Produk disimpan." : "Produk ditambahkan.");
      onClose();
      return;
    }
    handleFailure(out);
  }

  /** Tutup form; foto yang diunggah di form ini dan tidak tersimpan dihapus lagi ([discard] = semua unggahan sesi). */
  function finishClean(discard = false) {
    void deleteUploadedPhotos([...uploaded.current].filter((u) => discard || (u !== form.image && !editor.variants.some((v) => v.image_url === u))));
    onClose();
  }

  function handleFailure(out: CommitOutcome) {
    const { results, next } = out;
    const pr = results.find((r) => r.entity === "products" && r.id === id);
    if (results.some((r) => r.status === "conflict")) {
      // Server menang: muat ulang seluruh isian dari record terbaru.
      const recs = recipesOf(inventory, id);
      for (const r of results) {
        if (r.entity !== "recipes" || !r.record) continue;
        const key = (r.record.variant_id as string | null) ?? PRODUCT_KEY;
        if (r.record.deleted_at) delete recs[key];
        else recs[key] = r.record.items as RecipeItem[];
      }
      const fresh = initForm(
        next.products.find((p) => p.id === id),
        next.variants.filter((x) => x.product_id === id),
        recs,
        defaultCategory,
        recipesKnown
      );
      setForm(fresh);
      setBaseline(JSON.stringify(fresh));
      setErrors({});
      setRowErrors({});
      setNotice({ tone: "warning", text: pr?.code === "DELETED" ? "Produk ini sudah dihapus di perangkat lain." : CONFLICT_MESSAGE });
      return;
    }
    const errs = resultFieldErrors(pr);
    const rows: Record<string, Record<string, string>> = {};
    for (const r of results) if (r.entity === "product_variants" && r.status === "rejected") rows[r.id] = resultFieldErrors(r);
    const recipeBad = results.filter((r) => r.entity === "recipes" && r.status === "rejected");
    setErrors(errs);
    setRowErrors(rows);
    const parts = [`${out.summary.applied} dari ${out.summary.total} perubahan tersimpan.`, "Perbaiki isian yang ditandai lalu simpan lagi."];
    if (errs._) parts.push(errs._);
    if (recipeBad.length) parts.push(`Resep: ${recipeBad.map((r) => r.details?.[0]?.message ?? r.message).join("; ")}`);
    setNotice({ tone: "danger", text: parts.join(" ") });
  }

  async function remove() {
    const cur = data.products.find((p) => p.id === id);
    if (!cur) return;
    setBusy(true);
    try {
      const changes: Change[] = [...(inventory?.recipes ?? []).filter((r) => r.product_id === id).map((r) => deleteChange(ent("recipes"), r)), deleteChange("products", cur)];
      const out = await commit(changes);
      onInventoryResults(out.results);
      const r = out.results.find((x) => x.entity === "products");
      if (r?.status === "applied") {
        toast.success(`"${cur.name}" dihapus.`);
        void deleteUploadedPhotos([...uploaded.current]);
        onClose();
        return;
      }
      setConfirm(null);
      if (r?.status === "conflict") {
        const p = out.next.products.find((x) => x.id === id);
        const fresh = initForm(p, out.next.variants.filter((x) => x.product_id === id), recipesOf(inventory, id), defaultCategory, recipesKnown);
        setForm(fresh);
        setBaseline(JSON.stringify(fresh));
        setNotice({ tone: "warning", text: `${CONFLICT_MESSAGE} Periksa lalu hapus lagi bila masih perlu.` });
      } else setNotice({ tone: "danger", text: r?.message ?? "Gagal menghapus." });
    } catch (err) {
      setConfirm(null);
      setNotice({ tone: "danger", text: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    if (!dirty) return finishClean();
    if (existing) {
      setConfirm({ title: "Buang perubahan?", body: "Perubahan pada produk ini belum disimpan dan akan hilang.", label: "Buang", run: () => finishClean(true) });
      return;
    }
    setLeaving(true);
  }

  const err = (k: string) => errors[k];
  const fid = (k: string) => `pe-${k}`;
  const units = [...new Set([...PRODUCT_UNITS, form.unit])];
  const productMode = showRecipe ? modeOf(form, PRODUCT_KEY, form.cost) : "manual";
  const recipeCuts = form.hasVariants ? editor.variants.some((v) => keptRecipe(form, v.id).length > 0) : keptRecipe(form, PRODUCT_KEY).length > 0;
  const variantEditing = editor.variants.find((v) => v.id === editingVariant) ?? null;
  const editingIsNew = variantEditing ? !savedVariantIds.has(variantEditing.id) : false;

  const section = (title: string, hint?: string) => (
    <div className="pt-2">
      <h3 className="text-[15px] font-semibold text-text-heading">{title}</h3>
      {hint && <p className="mt-0.5 text-[12.5px] text-text-muted">{hint}</p>}
    </div>
  );

  const modeCard = (on: boolean, icon: React.ReactNode, title: string, hint: string, pick: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={pick}
      className={`flex items-start gap-2.5 rounded-[12px] border p-3 text-left ${on ? "border-brand-primary bg-brand-tint" : "border-border-subtle bg-white hover:border-border-active"} ${focusRing}`}
    >
      {on ? <CircleDot size={18} className="mt-0.5 shrink-0 text-brand-deep" aria-hidden /> : <Circle size={18} className="mt-0.5 shrink-0 text-border-active" aria-hidden />}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[14px] font-semibold text-text-heading">
          {icon} {title}
        </span>
        <span className="mt-0.5 block text-[12.5px] text-text-muted">{hint}</span>
      </span>
    </button>
  );

  /** Pemilih outlet stok bila dasbor sedang "Semua outlet" (aplikasi memakai outlet aktif). */
  const outletPicker =
    form.trackStock && multiOutlet && !shellOutlet ? (
      <Field id={fid("outlet")} label="Outlet stok" error={err("stock_outlet")} hint="Stok dicatat per outlet. Pilih outlet untuk stok awal / stok saat ini.">
        <Select
          id={fid("outlet")}
          className="max-w-[320px]"
          value={stockOutlet}
          placeholder="Pilih outlet…"
          invalid={!!err("stock_outlet")}
          onChange={setStockOutlet}
          options={session.outlets.map((o) => ({ value: o.id, label: o.name }))}
        />
      </Field>
    ) : form.trackStock && multiOutlet && outletName ? (
      <p className="text-[12.5px] text-text-muted">Stok dicatat di outlet {outletName}.</p>
    ) : null;

  return (
    <Sheet
      open
      wide
      busy={busy}
      title={existing ? "Ubah produk" : "Tambah produk"}
      subtitle={existing ? original?.name : "Produk baru langsung tersedia di kasir setelah perangkat sinkron."}
      onClose={close}
      footer={
        <>
          {existing && (
            <button
              type="button"
              className={`${btn.ghost} mr-auto text-danger hover:bg-danger-tint hover:text-danger`}
              onClick={() =>
                setConfirm({
                  title: "Hapus produk?",
                  body: (
                    <>
                      <p>{original?.name} beserta variannya akan dihapus dari kasir di semua perangkat setelah sinkron. Riwayat transaksi tetap tersimpan.</p>
                      <p className="mt-2">
                        Hanya ingin menyembunyikan sementara? Matikan <strong>Dijual di kasir</strong> lalu simpan.
                      </p>
                    </>
                  ),
                  label: "Hapus",
                  run: remove,
                  keepOpen: true,
                })
              }
              disabled={busy}
            >
              <Trash2 size={16} aria-hidden /> Hapus
            </button>
          )}
          <button type="button" className={btn.secondary} onClick={close} disabled={busy}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={save} disabled={busy || uploading}>
            {busy && <Spinner />} Simpan
          </button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        noValidate
      >
        {draftOffer && (
          // Di dalam panel (bukan dialog terpisah) agar tidak tertumpuk di belakang panel Tambah produk.
          <div role="status" className="flex flex-col gap-3 rounded-[12px] border border-brand-primary/40 bg-brand-tint p-3.5 sm:flex-row sm:items-center">
            <FileClock size={18} className="shrink-0 text-brand-ink" aria-hidden />
            <div className="min-w-0 flex-1 text-[13.5px]">
              <p className="font-semibold text-text-heading">Lanjutkan draf?</p>
              <p className="text-text-body">
                {draftOffer.name.trim()
                  ? `Ada draf produk "${draftOffer.name.trim()}" yang belum disimpan di browser ini.`
                  : "Ada draf produk yang belum disimpan di browser ini."}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                className={btn.secondary}
                onClick={() => {
                  clearDraft(session.business.id);
                  setDraftOffer(null);
                }}
              >
                Mulai baru
              </button>
              <button
                type="button"
                className={btn.primary}
                onClick={() => {
                  setForm(draftOffer);
                  setDraftOffer(null);
                }}
              >
                Lanjutkan
              </button>
            </div>
          </div>
        )}
        {notice && (
          <Notice tone={notice.tone} role="alert">
            {notice.text}
          </Notice>
        )}
        {!recipesKnown && !isService && (
          <Notice tone="info">Resep & bahan baku gagal dimuat — HPP resep tidak bisa diubah dari form ini dan resep yang ada dipertahankan. Muat ulang halaman untuk mencoba lagi.</Notice>
        )}

        <PhotoField
          name={form.name}
          url={form.image}
          onChange={(u) => {
            if (u) onUploaded(u);
            set("image", u);
          }}
          onUploading={onUploading}
          emptyHint="Tambah foto agar tampil di kasir dan daftar produk."
        />
        <Field id={fid("name")} label="Nama produk" error={err("name")}>
          <input
            id={fid("name")}
            className={inputClass}
            value={form.name}
            placeholder="Mis. Kopi Susu"
            maxLength={LIMITS.productName}
            aria-invalid={!!err("name") || undefined}
            onChange={(e) => set("name", e.target.value)}
            autoFocus={!existing}
          />
        </Field>
        <Field id={fid("cat")} label="Kategori" error={err("category_id")}>
          <Select
            id={fid("cat")}
            value={newCategory ? NEW_CATEGORY : form.categoryId}
            invalid={!!err("category_id")}
            onChange={(v) => {
              if (v === NEW_CATEGORY) setNewCategory({ name: "" });
              else {
                setNewCategory(null);
                set("categoryId", v);
              }
            }}
            options={[
              { value: "", label: "Tanpa kategori" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
              { value: NEW_CATEGORY, label: <span className="font-semibold text-brand-ink">+ Buat kategori baru</span>, text: "Buat kategori baru" },
            ]}
          />
        </Field>
        {newCategory && (
          <div className="flex flex-wrap items-start gap-2 rounded-[12px] bg-bg-muted p-3">
            <div className="min-w-[200px] flex-1">
              <label htmlFor={fid("newcat")} className="mb-1 block text-[13px] font-semibold">
                Nama kategori
              </label>
              <input
                id={fid("newcat")}
                className={inputClass}
                placeholder="Mis. Minuman"
                value={newCategory.name}
                maxLength={LIMITS.categoryName}
                autoFocus
                aria-invalid={!!newCategory.error || undefined}
                onChange={(e) => setNewCategory({ name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    createCategory();
                  }
                }}
              />
              {newCategory.error && <p className="mt-1 text-[12.5px] text-danger">{newCategory.error}</p>}
            </div>
            <div className="flex gap-1 pt-6">
              <button type="button" className={btn.primary} onClick={createCategory}>
                Simpan
              </button>
              <button type="button" className={btn.ghost} onClick={() => setNewCategory(null)}>
                Batal
              </button>
            </div>
          </div>
        )}

        {section("Satuan & stok")}
        <Field id={fid("unit")} label="Satuan" error={err("unit")} hint={form.hasVariants ? "Satuan & lacak stok berlaku untuk semua varian." : undefined}>
          <Select
            id={fid("unit")}
            className="max-w-[280px]"
            value={otherUnit !== null ? OTHER_UNIT : form.unit}
            onChange={(v) => {
              if (v === OTHER_UNIT) setOtherUnit("");
              else {
                setOtherUnit(null);
                set("unit", v);
              }
            }}
            options={[...units.map((u) => ({ value: u, label: u })), { value: OTHER_UNIT, label: "Satuan lain…" }]}
          />
        </Field>
        {otherUnit !== null && (
          <div className="flex flex-wrap items-end gap-2 rounded-[12px] bg-bg-muted p-3">
            <Field id={fid("unit-other")} label="Nama satuan" hint="Tulis sendiri (mis. ikat, lembar)" className="min-w-[200px] flex-1">
              <input
                id={fid("unit-other")}
                className={inputClass}
                placeholder="Mis. ikat"
                value={otherUnit}
                maxLength={LIMITS.unit}
                autoFocus
                onChange={(e) => setOtherUnit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyOtherUnit();
                  }
                }}
              />
            </Field>
            <div className="flex gap-1 pb-7">
              <button type="button" className={btn.primary} onClick={applyOtherUnit} disabled={!otherUnit.trim()}>
                Pakai
              </button>
              <button type="button" className={btn.ghost} onClick={() => setOtherUnit(null)}>
                Batal
              </button>
            </div>
          </div>
        )}
        <Switch id={fid("track")} checked={form.trackStock} onChange={(v) => set("trackStock", v)} label="Lacak stok" description="Stok berkurang otomatis saat terjual" />
        {form.trackStock && recipeCuts && !warningDismissed && <StockRecipeWarning onTurnOff={() => set("trackStock", false)} onKeep={() => setWarningDismissed(true)} />}

        {section("Jenis harga")}
        <div role="radiogroup" aria-label="Jenis harga" className="grid gap-2.5 sm:grid-cols-2">
          {modeCard(!form.hasVariants, <Tag size={15} aria-hidden />, "Satu harga", "Satu harga untuk produk ini", () => setHasVariants(false))}
          {modeCard(form.hasVariants, <Layers size={15} aria-hidden />, "Punya varian", "Mis. ukuran atau suhu, harga per pilihan", () => setHasVariants(true))}
        </div>

        {!form.hasVariants ? (
          <>
            {section("Harga & HPP")}
            <Field id={fid("price")} label="Harga" error={err("price")}>
              <MoneyInput id={fid("price")} value={form.price} onChange={(n) => set("price", n)} invalid={!!err("price")} placeholder="Mis. 25.000" className="max-w-[320px]" />
            </Field>
            <div className="space-y-2">
              <p className="text-[13px] font-semibold">HPP (harga modal)</p>
              {showRecipe && <CostModeSwitch mode={productMode} onChange={(m) => setForm((f) => ({ ...f, costModes: { ...f.costModes, [PRODUCT_KEY]: m } }))} />}
              {productMode === "manual" ? (
                <>
                  <Field id={fid("cost")} label="Harga modal" error={err("cost_price")}>
                    <MoneyInput id={fid("cost")} value={form.cost} onChange={(n) => set("cost", n)} invalid={!!err("cost_price")} placeholder="Opsional" className="max-w-[320px]" />
                  </Field>
                  {form.price !== null && form.cost !== null && <MarginLine price={form.price} cost={form.cost} unit={form.unit} />}
                  {showRecipe && (form.recipes[PRODUCT_KEY] ?? []).length > 0 && (
                    <p className="text-[12.5px] text-text-muted">
                      {form.costModes[PRODUCT_KEY] === "manual"
                        ? "Resep akan dihapus saat disimpan karena sumber HPP diganti ke Modal manual."
                        : "Modal manual menimpa HPP resep. Resep tetap memotong stok bahan; pilih Resep untuk memakai HPP-nya."}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="text-[12.5px] text-text-muted">Bahan yang terpakai per 1 porsi. Stok bahan berkurang otomatis saat produk terjual.</p>
                  <RecipeEditor
                    targets={[{ key: PRODUCT_KEY, label: "Resep & HPP", price: form.price, manualCost: null }]}
                    recipes={form.recipes}
                    onChange={(r) => set("recipes", r)}
                    materials={materials}
                    createMaterial={createMaterial}
                  />
                </>
              )}
            </div>
            {form.trackStock && (
              <>
                {section("Stok")}
                {outletPicker}
                <div className="grid gap-4 sm:grid-cols-2">
                  {existing ? (
                    <CurrentStock row={stockRow(null)} loading={stock.state.status === "loading"} unit={form.unit} productId={id} variantId={null} itemName={form.name || original?.name || ""} ctx={stockCtx} />
                  ) : (
                    <Field id={fid("init")} label="Stok awal" error={err("initial_stock")}>
                      <QtyInput id={fid("init")} value={form.initialStock} onChange={(t) => set("initialStock", t)} unit={form.unit} invalid={!!err("initial_stock")} />
                    </Field>
                  )}
                  <Field id={fid("min")} label="Stok minimum" error={err("min_stock")}>
                    <QtyInput id={fid("min")} value={form.minStock} onChange={(t) => set("minStock", t)} unit={form.unit} placeholder="Mis. 5" invalid={!!err("min_stock")} />
                  </Field>
                </div>
                <p className="text-[12.5px] text-text-muted">Peringatan stok menipis muncul bila stok di bawah stok minimum.</p>
              </>
            )}
            {section("Kode barang")}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id={fid("sku")} label="SKU (opsional)" error={err("sku")}>
                <input id={fid("sku")} className={inputClass} placeholder="Mis. KOP-001" value={form.sku} maxLength={LIMITS.code} onChange={(e) => set("sku", e.target.value)} aria-invalid={!!err("sku") || undefined} />
              </Field>
              <Field id={fid("barcode")} label="Barcode (opsional)" error={err("barcode")}>
                <input
                  id={fid("barcode")}
                  className={inputClass}
                  placeholder="Mis. 8991234567890"
                  value={form.barcode}
                  maxLength={LIMITS.code}
                  onChange={(e) => set("barcode", e.target.value)}
                  aria-invalid={!!err("barcode") || undefined}
                />
              </Field>
            </div>
            <BarcodeEditor codes={form.barcodes} onChange={(v) => set("barcodes", v)} ownerOf={(c) => (codeKey(c) === codeKey(form.barcode) ? form.name.trim() || "produk ini" : barcodeOwner(c))} />
            {err("barcodes") && <p className="text-[13px] text-danger">{err("barcodes")}</p>}
          </>
        ) : (
          <>
            {section("Pilihan varian", "Kombinasi dibuat otomatis dari pilihan (maks 3).")}
            {form.trackStock && outletPicker}
            <DimensionsView
              editor={editor}
              showErrors={showErrors}
              onAdd={(d) => applyPlan(planAddDimension(editor, d, template()))}
              onAddValues={(i, values) => applyPlan(planAddValues(editor, i, values))}
              onRemoveDim={(i) => applyPlan(planRemoveDimension(editor, i))}
              onRenameDim={(i, to) => applyPlan(planRenameDimension(editor, i, to))}
              onRenameValue={(i, from, to) => applyPlan(planRenameValue(editor, i, from, to))}
              onRemoveValue={(i, value) => applyPlan(planRemoveValue(editor, i, value))}
            />
            {editor.variants.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-[13px] font-semibold">Daftar kombinasi ({editor.variants.length})</p>
                  <button type="button" className={`${btn.secondary} min-h-9`} onClick={() => setBulkOpen(true)}>
                    <ListChecks size={16} aria-hidden /> Isi massal
                  </button>
                </div>
                <p className="text-[12.5px] text-text-muted">Seret baris (atau tombol naik/turun) untuk mengurutkan tampilan di kasir. Klik baris untuk harga, HPP, dan kode.</p>
                <ComboList
                  variants={editor.variants}
                  costOf={variantCost}
                  unpriced={unpriced}
                  unit={form.unit}
                  showErrors={showErrors}
                  stockOf={
                    form.trackStock
                      ? (v) => (savedVariantIds.has(v.id) ? { qty: stockRow(v.id)?.qty ?? 0, isNew: false } : { qty: v.initial_stock, isNew: true })
                      : null
                  }
                  onOpen={setEditingVariant}
                  onActive={(vid, on) => setEditor((e) => ({ ...e, variants: e.variants.map((x) => (x.id === vid ? { ...x, is_active: on } : x)) }))}
                  onReorder={(from, to) => setEditor((e) => reorder(e, from, to))}
                />
                {Object.entries(rowErrors).map(([rid, e]) => {
                  const v = editor.variants.find((x) => x.id === rid);
                  if (!v || !Object.keys(e).length) return null;
                  return (
                    <p key={rid} className="text-[12.5px] text-danger">
                      {v.name}:{" "}
                      {Object.entries(e)
                        .map(([k, msg]) => (k === "_" ? msg : `${fieldLabel(k)}: ${msg}`))
                        .join(" · ")}
                    </p>
                  );
                })}
                <p className="text-[12.5px] text-text-muted">Harga produk di kasir = harga varian aktif termurah.</p>
              </div>
            )}
            {(showErrors || err("variants")) && editorIssues(editor).length > 0 && (
              <ul role="alert" className="space-y-1">
                {editorIssues(editor).map((m) => (
                  <li key={m} className="text-[13px] font-semibold text-danger">
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {section(form.hasVariants ? "Berlaku untuk semua varian" : "Pengaturan jual")}
        {showDuration && (
          <Field id={fid("dur")} label="Estimasi durasi" error={err("duration_min")}>
            <div className="flex max-w-[220px] items-center gap-2">
              <input
                id={fid("dur")}
                className={`${inputClass} tabular-nums`}
                inputMode="numeric"
                placeholder="Mis. 60"
                maxLength={5}
                value={form.duration}
                onChange={(e) => set("duration", e.target.value.replace(/\D/g, ""))}
                aria-invalid={!!err("duration_min") || undefined}
              />
              <span className="text-[13px] text-text-muted">menit</span>
            </div>
          </Field>
        )}
        <Switch id={fid("active")} checked={form.active} onChange={(v) => set("active", v)} label="Dijual di kasir" />
        <Switch id={fid("tax")} checked={form.taxable} onChange={(v) => set("taxable", v)} label="Kena pajak" description="Pajak outlet dihitung untuk produk ini" />
        {kitchen && <Switch id={fid("cook")} checked={form.cookable} onChange={(v) => set("cookable", v)} label="Kirim ke dapur" description="Masuk tiket dapur saat dipesan" />}

        {section("Grup modifier", "Pilihan tambahan saat dipesan, mis. level gula atau topping.")}
        {err("modifier_group_ids") && <p className="text-[13px] text-danger">{err("modifier_group_ids")}</p>}
        {groups.length === 0 ? (
          <p className="text-[13px] text-text-muted">Belum ada grup modifier (mis. Level pedas, Topping).</p>
        ) : (
          <div className="grid gap-1 sm:grid-cols-2">
            {groups.map((g) => (
              <Check
                key={g.id}
                checked={form.groupIds.includes(g.id)}
                onChange={(on) => set("groupIds", on ? [...form.groupIds, g.id] : form.groupIds.filter((x) => x !== g.id))}
                label={
                  <>
                    {g.name} <span className="text-text-muted">· {g.options.length} opsi</span>
                  </>
                }
              />
            ))}
          </div>
        )}
        <button type="button" className={`${btn.ghost} -ml-2`} onClick={() => setGroupEditor(true)}>
          <Plus size={16} aria-hidden /> Buat grup modifier baru
        </button>
        <button type="submit" className="sr-only" tabIndex={-1}>
          Simpan
        </button>
      </form>

      {variantEditing && (
        <VariantSheet
          key={variantEditing.id}
          variant={variantEditing}
          mode={modeOf(form, variantEditing.id, variantEditing.cost_price)}
          recipe={form.recipes[variantEditing.id] ?? []}
          unit={form.unit}
          trackStock={form.trackStock}
          isNew={editingIsNew}
          showRecipe={showRecipe}
          priceMissing={unpriced.has(variantEditing.id)}
          barcodeOwner={(c) => barcodeOwner(c, variantEditing.id)}
          currentStock={
            <CurrentStock
              row={stockRow(variantEditing.id)}
              loading={stock.state.status === "loading"}
              unit={form.unit}
              productId={id}
              variantId={variantEditing.id}
              itemName={`${form.name} · ${variantEditing.name}`}
              ctx={stockCtx}
            />
          }
          materials={materials}
          createMaterial={createMaterial}
          onUploaded={onUploaded}
          onClose={() => setEditingVariant(null)}
          onSave={(r) => {
            const before = modeOf(form, variantEditing.id, variantEditing.cost_price);
            setForm((f) => ({
              ...f,
              costModes: r.mode !== before ? { ...f.costModes, [r.draft.id]: r.mode } : f.costModes,
              recipes: { ...f.recipes, [r.draft.id]: r.recipe },
              editor: updateVariant(f.editor, r.draft),
            }));
            setEditingVariant(null);
          }}
        />
      )}

      {bulkOpen && (
        <BulkFillSheet
          dims={editor.dims}
          variants={editor.variants}
          trackStock={form.trackStock}
          unit={form.unit}
          unpriced={unpriced}
          hasRecipe={(vid) => keptRecipe(form, vid).length > 0}
          isNew={(v) => !savedVariantIds.has(v.id)}
          onClose={() => setBulkOpen(false)}
          onApply={(changed, priced) => {
            setForm((f) => {
              const costModes = { ...f.costModes };
              const cur = new Map(f.editor.variants.map((v) => [v.id, v]));
              for (const v of changed) if (v.cost_price !== cur.get(v.id)?.cost_price) costModes[v.id] = "manual";
              return { ...f, costModes, editor: updateAll(f.editor, changed, priced) };
            });
            setBulkOpen(false);
          }}
        />
      )}

      {groupEditor && (
        <GroupEditor
          groupId={null}
          data={data}
          commit={commit}
          recipes={recipesKnown ? { materials, createMaterial, showRecipe } : null}
          onClose={() => setGroupEditor(false)}
          onSaved={(gid) => setForm((f) => ({ ...f, groupIds: [...f.groupIds, gid] }))}
        />
      )}

      <Modal
        open={!!move}
        title="Stok lama produk"
        description={move ? `Produk ini punya stok ${formatQty(move.total)} ${form.unit}. Pindahkan ke varian:` : undefined}
        onClose={() => setMove(null)}
      >
        <div className="-mx-2 max-h-[50vh] space-y-0.5 overflow-y-auto">
          {editor.variants.map((v) => (
            <button
              key={v.id}
              type="button"
              className={`flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2.5 text-left font-semibold hover:bg-bg-muted ${focusRing}`}
              onClick={() => {
                const m = move;
                setMove(null);
                if (m) void persist(validate(), { variantId: v.id, levels: m.levels });
              }}
            >
              <Layers size={16} aria-hidden /> {v.name}
            </button>
          ))}
          <button
            type="button"
            className={`flex w-full items-start gap-2.5 rounded-[10px] px-2 py-2.5 text-left hover:bg-bg-muted ${focusRing}`}
            onClick={() => {
              setMove(null);
              void persist(validate(), null);
            }}
          >
            <ListChecks size={16} className="mt-0.5" aria-hidden />
            <span>
              <span className="block font-semibold">Atur nanti lewat opname</span>
              <span className="block text-[12.5px] text-text-muted">Stok lama tetap tercatat dan ditandai di layar Stok.</span>
            </span>
          </button>
        </div>
      </Modal>

      <Modal
        open={leaving}
        title="Simpan sebagai draf?"
        icon={<FileClock size={18} aria-hidden />}
        description="Produk ini belum disimpan. Simpan sebagai draf untuk dilanjutkan nanti di browser ini, atau buang isiannya."
        onClose={() => setLeaving(false)}
        footer={
          <>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => {
                setLeaving(false);
                clearDraft(session.business.id);
                finishClean(true);
              }}
            >
              Buang
            </button>
            <button type="button" className={btn.secondary} onClick={() => setLeaving(false)}>
              Lanjut mengisi
            </button>
            <button
              type="button"
              className={btn.primary}
              onClick={() => {
                saveDraft(session.business.id, form);
                setLeaving(false);
                toast.success("Draf produk disimpan di browser ini.");
                onClose();
              }}
            >
              Simpan sebagai draf
            </button>
          </>
        }
      >
        <span />
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        title={confirm?.title ?? ""}
        confirmLabel={confirm?.label ?? "Ya"}
        tone={confirm?.tone ?? "danger"}
        busy={busy}
        onConfirm={() => {
          const c = confirm;
          if (!c) return;
          if (!c.keepOpen) setConfirm(null);
          c.run();
        }}
        onClose={() => setConfirm(null)}
      >
        {typeof confirm?.body === "string" ? <p>{confirm.body}</p> : confirm?.body}
      </ConfirmDialog>
    </Sheet>
  );
}

