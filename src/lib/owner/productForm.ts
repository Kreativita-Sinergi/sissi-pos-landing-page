// Logika murni form produk dasbor — cermin aplikasi Sissi:
// `variant_options.dart`, `variant_matrix.dart`, `variant_editor.dart` (pilihan varian 1–3 → kombinasi otomatis),
// `bulk_fill_sheet.dart` (isi massal), `cost_source.dart` + `core/stock/recipe.dart` (sumber HPP & resep),
// `core/stock/material_units.dart` (satuan bahan g↔kg, ml↔l), `stock_ledger.dart` (gerakan stok),
// `product_form_draft_store.dart` (draf form). Kuantitas stok & resep = mili-satuan (×1000).
import { newId } from "./api";
import { codeKey, LIMITS, type Variant, type VariantDimension } from "./catalog";
import type { Change, SyncRecord, WritableEntity } from "./types";

// ——— Resep & bahan baku ———

export type RecipeItem = { raw_material_id: string; qty: number; unit: string };

/** Record sync `recipes`: satu resep aktif per (produk, varian); `variant_id` null = resep produk. */
export type Recipe = SyncRecord & { product_id: string; variant_id: string | null; items: RecipeItem[] };

/** Record sync `raw_materials` (`avg_cost` = rupiah per satuan bahan). */
export type RawMaterial = SyncRecord & {
  name: string;
  sku: string | null;
  unit: string;
  min_stock: number;
  avg_cost: number;
  is_active: boolean;
};

/** Satuan bahan baku (`MaterialUnits.all`, enum server). */
export const MATERIAL_UNITS = ["g", "kg", "ml", "l", "pcs", "pack", "botol", "sachet"];

export const MAX_RECIPE_ITEMS = 50;

/** Dimensi satuan: mass (g/kg), volume (ml/l), atau satuan itu sendiri. */
export function unitDimension(unit: string): string {
  if (unit === "g" || unit === "kg") return "mass";
  if (unit === "ml" || unit === "l") return "volume";
  return unit;
}

const factor = (unit: string) => (unit === "kg" || unit === "l" ? 1000 : 1);

/** Satuan yang bisa dipakai untuk bahan bersatuan [unit]. */
export function compatibleUnits(unit: string): string[] {
  return MATERIAL_UNITS.filter((u) => unitDimension(u) === unitDimension(unit));
}

/** Satuan resep bawaan: g untuk bahan ber-kg, ml untuk ber-liter. */
export function defaultRecipeUnit(unit: string): string {
  return unit === "kg" ? "g" : unit === "l" ? "ml" : unit;
}

/** Mili-satuan [from] → mili-satuan [to]; null bila beda dimensi. Pembagian dibulatkan setengah ke atas. */
export function convertQty(milli: number, from: string, to: string): number | null {
  if (unitDimension(from) !== unitDimension(to)) return null;
  const f = factor(from);
  const t = factor(to);
  if (f === t) return milli;
  if (f > t) return milli * (f / t);
  const d = t / f;
  const abs = Math.floor((Math.abs(milli) + Math.floor(d / 2)) / d);
  return milli < 0 ? -abs : abs;
}

/** Biaya [milli] mili-satuan seharga [unitCost] per satuan → rupiah bulat (setengah ke atas). */
export function costOfQty(milli: number, unitCost: number): number {
  const v = BigInt(Math.round(milli)) * BigInt(Math.round(unitCost));
  const abs = v < BigInt(0) ? -v : v;
  const r = (abs + BigInt(500)) / BigInt(1000);
  return Number(v < BigInt(0) ? -r : r);
}

/** HPP satu porsi = Σ pemakaian (dikonversi ke satuan bahan) × avg_cost; bahan hilang/tak cocok diabaikan. */
export function recipeCost(items: RecipeItem[], materials: Map<string, RawMaterial>): number {
  let total = 0;
  for (const i of items) {
    const m = materials.get(i.raw_material_id);
    if (!m) continue;
    const usage = convertQty(i.qty, i.unit, m.unit);
    if (usage === null) continue;
    total += costOfQty(usage, m.avg_cost);
  }
  return total;
}

/** Resep sama persis (urutan & isi) — `listEquals` aplikasi. */
export function sameRecipe(a: RecipeItem[] | undefined, b: RecipeItem[] | undefined): boolean {
  const x = a ?? [];
  const y = b ?? [];
  return x.length === y.length && x.every((i, k) => i.raw_material_id === y[k].raw_material_id && i.qty === y[k].qty && i.unit === y[k].unit);
}

/** Item resep dari JSON record (toleran). */
export function recipeItemsOf(raw: unknown): RecipeItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({ raw_material_id: String(e.raw_material_id ?? ""), qty: Number(e.qty) || 0, unit: String(e.unit ?? "g") }));
}

// ——— Sumber HPP ———

/** Sumber HPP yang dipilih pemilik: angka manual, atau dihitung dari resep bahan baku. */
export type CostMode = "manual" | "recipe";
export type CostSource = "manual" | "recipe" | "none";

/** Kunci target resep/sumber HPP: "" = produk, selain itu id varian (seperti draf aplikasi). */
export const PRODUCT_KEY = "";

// ——— Varian ———

/** Satu varian di form (`VariantDraft` aplikasi). Stok = mili-satuan. */
export type VDraft = {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  /** null = belum diisi / ikut resep. */
  cost_price: number | null;
  /** null = ikut produk. */
  min_stock: number | null;
  sku: string | null;
  barcode: string | null;
  barcodes: string[];
  /** Stok awal varian baru; null = belum diisi (dicatat 0). */
  initial_stock: number | null;
  options: Record<string, string>;
  image_url: string | null;
};

export function draftOf(v: Variant): VDraft {
  return {
    id: v.id,
    name: v.name,
    price: v.price,
    is_active: v.is_active,
    cost_price: v.cost_price ?? null,
    min_stock: v.min_stock ?? null,
    sku: v.sku ?? null,
    barcode: v.barcode ?? null,
    barcodes: [...(v.barcodes ?? [])],
    initial_stock: null,
    options: { ...(v.options ?? {}) },
    image_url: v.image_url ?? null,
  };
}

function freshDraft(id: string, name: string, options: Record<string, string>): VDraft {
  return { id, name, price: 0, is_active: true, cost_price: null, min_stock: null, sku: null, barcode: null, barcodes: [], initial_stock: null, options, image_url: null };
}

export const MAX_DIMENSIONS = 3;
export const LEGACY_DIMENSION = "Varian";

const has = (o: Record<string, string>, k: string) => Object.prototype.hasOwnProperty.call(o, k);

/** Semua kombinasi nilai (dimensi pertama paling luar): Ukuran [S, M] × Suhu [Panas, Es] → S·Panas, S·Es, M·Panas, M·Es. */
export function combinations(dims: VariantDimension[]): Record<string, string>[] {
  const usable = dims.filter((d) => d.values.length);
  if (!usable.length) return [];
  let combos: Record<string, string>[] = [{}];
  for (const d of usable) combos = combos.flatMap((c) => d.values.map((v) => ({ ...c, [d.name]: v })));
  return combos;
}

/** Nama varian dari kombinasi, urut dimensi: "L / Es". */
export function comboName(combo: Record<string, string>, dims: VariantDimension[]): string {
  return dims
    .map((d) => combo[d.name])
    .filter((v) => v !== undefined)
    .join(" / ");
}

/** Kunci pembanding kombinasi (urut dimensi, tanpa beda huruf besar/kecil). */
export function comboKey(combo: Record<string, string>, dims: VariantDimension[]): string {
  return dims.map((d) => (combo[d.name] ?? "").toLowerCase()).join("\u0001");
}

/** Galat satu pilihan di antara [all] (`dimensionIssue` + teks l10n aplikasi). null = sah. */
export function dimensionIssue(d: VariantDimension, all: VariantDimension[]): string | null {
  const name = d.name.trim();
  if (!name) return "Nama pilihan wajib diisi.";
  if (name.length > LIMITS.dimensionName) return `Nama pilihan maksimal ${LIMITS.dimensionName} huruf.`;
  if (all.filter((o) => o.name.trim().toLowerCase() === name.toLowerCase()).length > 1) return "Nama pilihan sudah dipakai.";
  if (!d.values.length) return "Tambahkan minimal satu nilai.";
  if (d.values.length > LIMITS.dimensionValues) return `Maksimal ${LIMITS.dimensionValues} nilai per pilihan.`;
  if (d.values.some((v) => v.trim().length > LIMITS.variantValue)) return `Nilai maksimal ${LIMITS.variantValue} huruf.`;
  if (new Set(d.values.map((v) => v.trim().toLowerCase())).size !== d.values.length) return "Ada nilai kembar di pilihan ini.";
  return null;
}

export type MatrixResult = { variants: VDraft[]; removed: VDraft[]; added: string[] };

/** Sumber isian kombinasi baru: varian (id) atau produk (id null). */
export type VariantSource = { id: string | null; price: number; is_active: boolean; cost_price: number | null; min_stock: number | null };

/** Rencana perubahan pilihan (menunggu konfirmasi bila ada varian terhapus). sources: id baru → id sumber (null = produk). */
export type VariantPlan = { dims: VariantDimension[]; result: MatrixResult; sources: Record<string, string | null> };

function isCanonical(variants: VDraft[], dims: VariantDimension[]): boolean {
  const order = new Map(combinations(dims).map((c, i) => [comboKey(c, dims), i]));
  let last = -1;
  for (const v of variants) {
    const i = order.get(comboKey(v.options, dims));
    if (i === undefined) continue;
    if (i < last) return false;
    last = i;
  }
  return true;
}

/**
 * Menyusun varian untuk [dims] (`VariantMatrix.rebuild`): kombinasi yang ada dipertahankan (id, harga, modal, stok,
 * resep), yang baru dibuat lewat [create], yang hilang → removed. Urutan kombinasi baru dipakai selama daftar belum
 * diurutkan sendiri; bila sudah, urutan itu dipertahankan dan kombinasi baru ditambahkan di akhir.
 */
export function rebuild(
  dims: VariantDimension[],
  current: VDraft[],
  create: (combo: Record<string, string>, name: string) => VDraft,
  previous?: VariantDimension[]
): MatrixResult {
  const combos = combinations(dims);
  const keyed = new Map<string, VDraft>();
  const removed: VDraft[] = [];
  for (const v of current) {
    const key = comboKey(v.options, dims);
    const complete = dims.every((d) => has(v.options, d.name));
    if (!complete || keyed.has(key)) removed.push(v);
    else keyed.set(key, v);
  }
  const valid = new Set(combos.map((c) => comboKey(c, dims)));
  for (const [k, v] of [...keyed]) {
    if (!valid.has(k)) {
      removed.push(v);
      keyed.delete(k);
    }
  }
  const added: string[] = [];
  const fit = (combo: Record<string, string>): VDraft => {
    const name = comboName(combo, dims);
    const old = keyed.get(comboKey(combo, dims));
    if (old) return { ...old, options: combo, name };
    const fresh = create(combo, name);
    added.push(fresh.id);
    return fresh;
  };
  if (isCanonical(current, previous ?? dims)) return { variants: combos.map(fit), removed, added };
  const byKey = new Map(combos.map((c) => [comboKey(c, dims), c]));
  const keptIds = new Set([...keyed.values()].map((v) => v.id));
  const kept = current.filter((v) => keptIds.has(v.id)).map((v) => fit(byKey.get(comboKey(v.options, dims)) ?? v.options));
  const fresh = combos.filter((c) => !keyed.has(comboKey(c, dims))).map(fit);
  return { variants: [...kept, ...fresh], removed, added };
}

/** Status bagian varian (`VariantEditor`): dimensi, kombinasi (urut tampil), varian baru belum berharga, varian lama. */
export type EditorState = { dims: VariantDimension[]; variants: VDraft[]; unpriced: string[]; legacy: boolean };

export const EMPTY_EDITOR: EditorState = { dims: [], variants: [], unpriced: [], legacy: false };

/** Varian tersimpan (urut tampil) + dimensi produk; varian lama tanpa `options` = satu pilihan "Varian". */
export function loadEditor(loaded: VDraft[], productDims: VariantDimension[]): EditorState {
  if (loaded.length && !productDims.length && loaded.every((v) => !Object.keys(v.options).length)) {
    return {
      dims: [{ name: LEGACY_DIMENSION, values: loaded.map((v) => v.name) }],
      variants: loaded.map((v) => ({ ...v, options: { [LEGACY_DIMENSION]: v.name } })),
      unpriced: [],
      legacy: true,
    };
  }
  return { dims: productDims.map((d) => ({ name: d.name, values: [...d.values] })), variants: [...loaded], unpriced: [], legacy: false };
}

function plan(state: EditorState, next: VariantDimension[], current: VDraft[], sourceOf?: (combo: Record<string, string>) => VariantSource | null | undefined): VariantPlan {
  const sources: Record<string, string | null> = {};
  const result = rebuild(
    next,
    current,
    (combo, name) => {
      const id = newId();
      const source = sourceOf?.(combo);
      if (!source) return freshDraft(id, name, combo);
      sources[id] = source.id;
      return { ...freshDraft(id, name, combo), price: source.price, is_active: source.is_active, cost_price: source.cost_price, min_stock: source.min_stock };
    },
    state.dims
  );
  return { dims: next, result, sources };
}

const withoutKey = (o: Record<string, string>, k: string) => {
  const c = { ...o };
  delete c[k];
  return c;
};

const sameMap = (a: Record<string, string>, b: Record<string, string>) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([k, v]) => b[k] === v);

/** Pilihan baru. Kombinasi baru menyalin isian "saudaranya" (mis. S / Es dari S); tanpa varian → [template] produk. */
export function planAddDimension(state: EditorState, d: VariantDimension, template: VariantSource | null): VariantPlan {
  const next = state.variants.map((v) => ({ ...v, options: { ...v.options, [d.name]: d.values[0] } }));
  return plan(state, [...state.dims, d], next, (combo) => {
    if (!state.variants.length) return template;
    const rest = withoutKey(combo, d.name);
    const sib = next.find((v) => v.options[d.name] === d.values[0] && sameMap(withoutKey(v.options, d.name), rest));
    return sib ? { id: sib.id, price: sib.price, is_active: sib.is_active, cost_price: sib.cost_price, min_stock: sib.min_stock } : null;
  });
}

export function planRemoveDimension(state: EditorState, index: number): VariantPlan {
  const name = state.dims[index].name;
  return plan(
    state,
    state.dims.filter((_, i) => i !== index),
    state.variants.map((v) => ({ ...v, options: withoutKey(v.options, name) }))
  );
}

export function planRenameDimension(state: EditorState, index: number, to: string): VariantPlan {
  const from = state.dims[index].name;
  return plan(
    state,
    state.dims.map((d, i) => (i === index ? { ...d, name: to } : d)),
    state.variants.map((v) => ({ ...v, options: Object.fromEntries(Object.entries(v.options).map(([k, x]) => [k === from ? to : k, x])) }))
  );
}

export function planAddValues(state: EditorState, index: number, values: string[]): VariantPlan {
  return plan(
    state,
    state.dims.map((d, i) => (i === index ? { ...d, values: [...d.values, ...values] } : d)),
    state.variants
  );
}

export function planRenameValue(state: EditorState, index: number, from: string, to: string): VariantPlan {
  const dim = state.dims[index].name;
  return plan(
    state,
    state.dims.map((d, i) => (i === index ? { ...d, values: d.values.map((v) => (v === from ? to : v)) } : d)),
    state.variants.map((v) => (v.options[dim] === from ? { ...v, options: { ...v.options, [dim]: to } } : v))
  );
}

export function planRemoveValue(state: EditorState, index: number, value: string): VariantPlan {
  return plan(
    state,
    state.dims.map((d, i) => (i === index ? { ...d, values: d.values.filter((v) => v !== value) } : d)),
    state.variants
  );
}

/** Menerapkan rencana: kombinasi baru tanpa sumber (atau sumbernya belum berharga) menunggu harga. */
export function commitPlan(state: EditorState, p: VariantPlan): EditorState {
  const alive = new Set(p.result.variants.map((v) => v.id));
  const before = new Set(state.unpriced);
  const unpriced = [
    ...state.unpriced.filter((id) => alive.has(id)),
    ...p.result.added.filter((id) => !(id in p.sources) || (p.sources[id] !== null && before.has(p.sources[id] as string))),
  ];
  return { dims: p.dims, variants: p.result.variants, unpriced: [...new Set(unpriced)], legacy: false };
}

export function updateVariant(state: EditorState, v: VDraft): EditorState {
  return { ...state, variants: state.variants.map((x) => (x.id === v.id ? v : x)), unpriced: state.unpriced.filter((id) => id !== v.id) };
}

/** Isi massal; [priced] = harganya ikut diisi. */
export function updateAll(state: EditorState, changed: VDraft[], priced: boolean): EditorState {
  const byId = new Map(changed.map((v) => [v.id, v]));
  return {
    ...state,
    variants: state.variants.map((v) => byId.get(v.id) ?? v),
    unpriced: state.unpriced.filter((id) => !priced || !byId.has(id)),
  };
}

/** Pindah baris [from] ke posisi [to] (indeks setelah baris diangkat). */
export function reorder(state: EditorState, from: number, to: number): EditorState {
  const list = [...state.variants];
  const [item] = list.splice(from, 1);
  list.splice(Math.max(0, Math.min(to, list.length)), 0, item);
  return { ...state, variants: list };
}

/** Galat yang menghalangi Simpan (teks l10n aplikasi). */
export function editorIssues(state: EditorState): string[] {
  const out: string[] = [];
  if (!state.dims.length || !state.variants.length) out.push('Tambahkan minimal satu pilihan varian, atau pilih "Satu harga".');
  if (!state.legacy && state.dims.some((d) => dimensionIssue(d, state.dims))) out.push("Ada pilihan varian yang perlu diperbaiki (lihat kotak merah).");
  if (state.variants.length > LIMITS.maxCombos) out.push(`Maksimal ${LIMITS.maxCombos} kombinasi; sekarang ${state.variants.length}. Kurangi nilai pilihan.`);
  if (state.variants.some((v) => v.name.length > LIMITS.variantName)) out.push(`Nama kombinasi terlalu panjang (maks ${LIMITS.variantName} huruf) — singkatkan nilainya.`);
  if (state.unpriced.length) out.push(`${state.unpriced.length} varian belum diberi harga. Klik barisnya atau pakai Isi massal.`);
  return out;
}

/** Dimensi & varian untuk disimpan (varian lama yang susunannya belum diubah tetap tanpa dimensi). */
export function toSave(state: EditorState): { dims: VariantDimension[]; variants: VDraft[] } {
  if (state.legacy) return { dims: [], variants: state.variants.map((v) => ({ ...v, options: {} })) };
  return { dims: state.dims.map((d) => ({ name: d.name.trim(), values: d.values.map((x) => x.trim()) })), variants: state.variants };
}

/** Harga produk bervarian = harga varian aktif termurah (semua varian bila tak ada yang aktif). */
export function cheapest(variants: VDraft[]): number | null {
  const active = variants.filter((v) => v.is_active);
  const pool = active.length ? active : variants;
  return pool.length ? Math.min(...pool.map((v) => v.price)) : null;
}

// ——— Isi massal ———

/** null = tidak diubah. Stok dalam mili-satuan. */
export type BulkFill = { price: number | null; cost_price: number | null; min_stock: number | null; initial_stock: number | null };

/** Varian yang cocok dengan [filter] (dimensi → nilai terpilih; kosong = semua nilai). */
export function bulkTargets(variants: VDraft[], filter: Record<string, string[]>): VDraft[] {
  return variants.filter((v) => Object.entries(filter).every(([k, vals]) => !vals.length || vals.includes(v.options[k])));
}

/** Stok awal hanya untuk varian baru ([isNew]); varian tersimpan diubah stoknya lewat penyesuaian. */
export function applyBulk(v: VDraft, fill: BulkFill, isNew: boolean): VDraft {
  return {
    ...v,
    price: fill.price ?? v.price,
    cost_price: fill.cost_price ?? v.cost_price,
    min_stock: fill.min_stock ?? v.min_stock,
    initial_stock: isNew && fill.initial_stock !== null ? fill.initial_stock : v.initial_stock,
  };
}

export type BulkChange = { before: VDraft; after: VDraft };

export function previewBulk(targets: VDraft[], fill: BulkFill, isNew: (v: VDraft) => boolean, unpriced: Set<string>): BulkChange[] {
  const out: BulkChange[] = [];
  for (const v of targets) {
    const n = isNew(v);
    const changed =
      (fill.price !== null && (fill.price !== v.price || unpriced.has(v.id))) ||
      (fill.cost_price !== null && fill.cost_price !== v.cost_price) ||
      (fill.min_stock !== null && fill.min_stock !== v.min_stock) ||
      (fill.initial_stock !== null && n && fill.initial_stock !== v.initial_stock);
    if (changed) out.push({ before: v, after: applyBulk(v, fill, n) });
  }
  return out;
}

// ——— Barcode ———

/** Pemilik kode di antara daftar [codes] lain (tanpa beda huruf). */
export function codeIn(code: string, codes: (string | null | undefined)[]): boolean {
  const k = codeKey(code);
  return codes.some((c) => codeKey(c) === k);
}

// ——— Perubahan entitas di luar `WritableEntity` web lama ———

/** `recipes`, `raw_materials`, `stock_movements` kini boleh dikirim ke /owner/changes (api.md "Kelola data"). */
export const ent = (e: "recipes" | "raw_materials" | "stock_movements") => e as unknown as WritableEntity;

/** Satu gerakan stok baru (`StockLedger.record`): append-only, tanpa base_updated_at. */
export function stockMoveChange(m: {
  outlet_id: string;
  product_id: string;
  variant_id: string | null;
  qty_delta: number;
  type: "in" | "out" | "adjust";
  employee_id: string;
  note?: string;
  unit_cost?: number | null;
}): Change {
  return {
    entity: ent("stock_movements"),
    op: "upsert",
    id: newId(),
    data: {
      outlet_id: m.outlet_id,
      product_id: m.product_id,
      raw_material_id: null,
      variant_id: m.variant_id,
      qty_delta: m.qty_delta,
      type: m.type,
      ref_id: null,
      note: (m.note ?? "").trim().slice(0, 200),
      unit_cost: m.unit_cost ?? null,
      employee_id: m.employee_id,
      occurred_at: new Date().toISOString(),
    },
  };
}

// ——— Draf form produk baru (hanya di browser ini) ———

const draftKey = (businessId: string) => `sissi-owner:product-draft:${businessId}`;

export function loadDraft<T>(businessId: string): T | null {
  try {
    const raw = localStorage.getItem(draftKey(businessId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft(businessId: string, draft: unknown): void {
  try {
    localStorage.setItem(draftKey(businessId), JSON.stringify(draft));
  } catch {
    // Penyimpanan diblokir/penuh — draf tidak tersimpan.
  }
}

export function clearDraft(businessId: string): void {
  try {
    localStorage.removeItem(draftKey(businessId));
  } catch {
    // diabaikan
  }
}
