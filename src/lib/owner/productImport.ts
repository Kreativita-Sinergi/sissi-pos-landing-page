// Impor & ekspor produk (CSV & Excel) — format SAMA dengan aplikasi (`sissi-app/lib/features/products/models/
// product_import.dart`, `import_workbook.dart`, dan `catalog_repository.dart` `importProducts`), sehingga template/ekspor
// web bisa diimpor di aplikasi dan sebaliknya. Satu baris = satu produk; baris bernama sama dengan kolom `varian` digabung
// menjadi satu produk bervarian (satu pilihan "Varian"). Excel boleh membawa lembar Varian, Bahan, Resep, dan Pilihan
// Ekstra (lihat `productImportXlsx.ts`). Pemeriksaan & pencocokan mengikuti aplikasi: SKU → barcode → nama (bila salah
// satu tanpa SKU), kembaran di berkas, produk bervarian tidak bisa ditimpa. Perbedaan yang tidak bisa dihindari web:
// kiriman tidak satu transaksi (dipecah per 200 perubahan; resep & stok awal dikirim setelah produknya tersimpan).
import { newId } from "./api";
import { codeKey, createChange, editChange, formatQty, LIMITS, parseQty, recordData, sortVariants, type Product, type Variant } from "./catalog";
import type { Change, SyncRecord, WritableEntity } from "./types";

// ——— Kolom ———

export type FieldKey =
  | "name"
  | "variant"
  | "category"
  | "price"
  | "cost"
  | "sku"
  | "barcode"
  | "unit"
  | "trackStock"
  | "initialStock"
  | "minStock"
  | "taxable"
  | "description"
  | "modifiers"
  | "duration";

type FieldDef = { key: FieldKey; header: string; aliases: string[]; label: string; hint: string };

/** Urutan = urutan kolom template aplikasi. Alias = judul kolom ekspor POS lain (sama dengan aplikasi). */
export const IMPORT_FIELDS: readonly FieldDef[] = [
  {
    key: "name",
    header: "nama",
    aliases: ["nama_produk", "produk", "name", "product_name", "product", "nama_barang", "barang", "nama_item", "item", "item_name", "nama_menu", "menu", "title", "nama_layanan"],
    label: "Nama",
    hint: "maks. 100 karakter",
  },
  {
    key: "variant",
    header: "varian",
    aliases: ["nama_varian", "variant", "variant_name", "variasi", "nama_variasi", "option1_value"],
    label: "Varian",
    hint: "boleh kosong; untuk produk bervarian, ulangi nama produk di baris lain dengan varian berbeda",
  },
  {
    key: "category",
    header: "kategori",
    aliases: ["category", "kategori_produk", "kategori_barang", "kategori_menu", "category_name", "product_category", "kelompok", "golongan"],
    label: "Kategori",
    hint: "dibuat otomatis bila belum ada",
  },
  {
    key: "price",
    header: "harga",
    aliases: [
      "harga_jual", "price", "sell_price", "selling_price", "sale_price", "harga_satuan", "harga_jual_satuan", "harga_eceran", "retail_price",
      "harga_produk", "harga_menu", "variant_price", "default_price", "unit_price",
    ],
    label: "Harga jual",
    hint: "angka tanpa titik/koma desimal, mis. 15000",
  },
  {
    key: "cost",
    header: "modal",
    aliases: [
      "harga_modal", "hpp", "cost", "cost_price", "harga_beli", "harga_pokok", "harga_dasar", "harga_pokok_penjualan", "buy_price", "purchase_price",
      "cogs", "unit_cost", "cost_per_item", "modal_satuan",
    ],
    label: "Harga modal",
    hint: "boleh kosong",
  },
  {
    key: "sku",
    header: "sku",
    aliases: ["kode", "kode_produk", "kode_barang", "kode_item", "kode_sku", "item_code", "product_code", "sku_code", "variant_sku", "plu"],
    label: "SKU",
    hint: "kode unik, maks. 40 karakter",
  },
  {
    key: "barcode",
    header: "barcode",
    aliases: ["barcodes", "kode_barcode", "no_barcode", "nomor_barcode", "upc", "ean", "gtin", "variant_barcode"],
    label: "Barcode",
    hint: "lebih dari satu dipisah titik koma (;)",
  },
  { key: "unit", header: "satuan", aliases: ["unit", "uom", "unit_name", "satuan_produk", "satuan_jual"], label: "Satuan", hint: "mis. pcs, porsi, kg; kosong = pcs" },
  {
    key: "trackStock",
    header: "lacak_stok",
    aliases: ["kelola_stok", "track_stock", "pantau_stok", "track_inventory", "manage_stock", "stok_dilacak"],
    label: "Lacak stok",
    hint: "ya / tidak; kosong = ya bila stok diisi",
  },
  {
    key: "initialStock",
    header: "stok_awal",
    aliases: [
      "stok", "initial_stock", "stock", "jumlah_stok", "stok_saat_ini", "sisa_stok", "persediaan", "qty", "quantity", "stock_qty", "in_stock",
      "stock_quantity", "current_stock",
    ],
    label: "Stok awal",
    hint: "hanya untuk produk baru; dicatat sebagai stok masuk di outlet yang dipilih",
  },
  {
    key: "minStock",
    header: "stok_min",
    aliases: [
      "stok_minimum", "min_stock", "minimum_stok", "stok_minimal", "minimal_stok", "min_stok", "batas_stok", "minimum_stock", "low_stock",
      "low_stock_alert", "reorder_point", "peringatan_stok",
    ],
    label: "Stok minimum",
    hint: "batas peringatan stok menipis",
  },
  { key: "taxable", header: "kena_pajak", aliases: ["pajak", "is_taxable", "taxable", "kena_ppn", "dikenakan_pajak", "charge_tax"], label: "Kena pajak", hint: "ya / tidak; kosong = ya" },
  {
    key: "description",
    header: "deskripsi",
    aliases: ["keterangan", "description", "deskripsi_produk", "product_description", "catatan"],
    label: "Deskripsi",
    hint: "maks. 300 karakter",
  },
  {
    key: "modifiers",
    header: "pilihan_ekstra",
    aliases: ["grup_pilihan_ekstra", "grup_ekstra", "grup_modifier", "modifier", "modifiers", "modifier_groups", "add_on", "add_ons", "topping"],
    label: "Pilihan ekstra",
    hint: "nama grup pilihan ekstra, pisahkan dengan titik koma (;)",
  },
  { key: "duration", header: "durasi_menit", aliases: ["durasi", "duration_min", "duration", "durasi_layanan", "lama_layanan"], label: "Durasi (menit)", hint: "estimasi lama layanan" },
];

const FIELD_BY_KEY = new Map(IMPORT_FIELDS.map((f) => [f.key, f]));

export const fieldLabelOf = (k: FieldKey) => FIELD_BY_KEY.get(k)?.label ?? k;

/** Kolom template untuk jenis usaha (durasi hanya untuk jasa). `workbook` = lembar Produk template Excel (varian di lembar Varian). */
export function templateFields(service: boolean, workbook = false): FieldDef[] {
  return IMPORT_FIELDS.filter((f) => (f.key !== "duration" || service) && (f.key !== "variant" || !workbook));
}

/** Judul kolom → kunci pembanding: huruf kecil, isi kurung dibuang, tanda baca & spasi jadi `_` (`importHeaderKey`). */
export function importHeaderKey(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function fieldFromHeader(raw: string): FieldKey | null {
  const h = importHeaderKey(raw);
  for (const f of IMPORT_FIELDS) if (f.header === h || f.aliases.includes(h)) return f.key;
  return null;
}

/** Batas (sama dengan aplikasi & validasi server). */
export const IMPORT_LIMITS = {
  maxRows: 1000,
  /** Baris per lembar tambahan Excel (varian, bahan, resep, pilihan ekstra). */
  maxExtraRows: 5000,
  maxFileBytes: 2 * 1024 * 1024,
  maxXlsxBytes: 5 * 1024 * 1024,
  nameLength: 100,
  categoryLength: 60,
  descriptionLength: 300,
  codeLength: 40,
  unitLength: 20,
  barcodes: 11,
  maxPrice: 1_000_000_000,
  maxDurationMin: 10080,
  variantValue: 40,
  variants: 20,
} as const;

/** Nama pilihan varian hasil impor (satu pilihan) — `CatalogRepository.importVariantDimension`. */
export const IMPORT_VARIANT_DIMENSION = "Varian";

// ——— CSV ———

export type CsvRow = { line: number; cells: string[] };

/** Pengurai CSV RFC 4180 (sama dengan `parseCsv` aplikasi): pemisah koma/titik koma/tab dari baris pertama, BOM dibuang, baris kosong dilewati, awalan `'` pencegah rumus dibuang. */
export function parseCsv(text: string): CsvRow[] {
  const src = text.startsWith("﻿") ? text.slice(1) : text;
  const sep = detectSeparator(src);
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  const endCell = () => {
    cells.push(/^'[=+\-@]/.test(cell) ? cell.slice(1) : cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    if (cells.some((c) => c.trim() !== "")) rows.push({ line: rowLine, cells });
    cells = [];
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else {
        if (c === "\n") line++;
        cell += c;
      }
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === sep) endCell();
    else if (c === "\r" || c === "\n") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      endRow();
      line++;
      rowLine = line;
    } else cell += c;
  }
  if (cell !== "" || cells.length) endRow();
  return rows;
}

function detectSeparator(src: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const c of src) {
    if (c === '"') quoted = !quoted;
    if (quoted) continue;
    if (c === "\n" || c === "\r") break;
    if (c in counts) counts[c]++;
  }
  let best = ",";
  for (const k of Object.keys(counts)) if (counts[k] > counts[best]) best = k;
  return best;
}

/** Rupiah dari sel: `15000`, `15.000`, `15,000`, `Rp 15.000`, `15000.00`. Desimal selain ,00 ditolak (`parseImportMoney`). */
export function parseImportMoney(text: string): number | null {
  let t = text
    .trim()
    .replace(/^Rp\.?/i, "")
    .replace(/\s/g, "");
  t = t.replace(/[.,]0{1,2}$/, "");
  if (!/^(\d{1,3}([.,]\d{3})+|\d+)$/.test(t)) return null;
  const n = Number(t.replace(/[.,]/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** `ya/tidak` (juga y/n, yes/no, true/false, 1/0); null bila lain (`parseImportBool`). */
export function parseImportBool(text: string): boolean | null {
  const t = text.trim().toLowerCase();
  if (["ya", "y", "yes", "true", "1", "iya", "aktif"].includes(t)) return true;
  if (["tidak", "tdk", "t", "n", "no", "false", "0"].includes(t)) return false;
  return null;
}

// ——— Baris ———

export type IssueCode =
  | "required"
  | "invalidNumber"
  | "tooLarge"
  | "tooLong"
  | "invalidBool"
  | "tooManyBarcodes"
  | "usedByVariant"
  | "matchesTwoProducts"
  | "stockIgnored"
  | "stockNotUpdated"
  | "variantInvalid"
  | "variantDuplicate"
  | "variantTooMany"
  | "variantCodeUsed"
  | "recipeMaterialMissing"
  | "recipeUnitMismatch"
  | "recipeVariantMissing"
  | "groupMissing";

export type Issue = { field: FieldKey | null; code: IssueCode; limit?: number; detail?: string };

/** Teks masalah (teks aplikasi `productImportIssue*`). */
export function issueText(i: Issue): string {
  const msg = (() => {
    switch (i.code) {
      case "required":
        return "wajib diisi";
      case "invalidNumber":
        return "bukan angka yang sah";
      case "tooLarge":
        return "melebihi batas";
      case "tooLong":
        return `maksimal ${i.limit} karakter`;
      case "invalidBool":
        return 'isi "ya" atau "tidak"';
      case "tooManyBarcodes":
        return `maksimal ${i.limit} barcode`;
      case "usedByVariant":
        return `sudah dipakai varian ${i.detail}`;
      case "matchesTwoProducts":
        return "SKU dan barcode cocok dengan dua produk berbeda";
      case "stockIgnored":
        return "diabaikan karena lacak stok = tidak";
      case "stockNotUpdated":
        return "stok produk yang sudah ada tidak diubah";
      case "variantInvalid":
        return `varian "${i.detail}" (baris ${i.limit}) dilewati: harga atau namanya tidak sah`;
      case "variantDuplicate":
        return `varian "${i.detail}" ganda, yang berikutnya dilewati`;
      case "variantTooMany":
        return `maksimal ${i.limit} varian, sisanya dilewati`;
      case "variantCodeUsed":
        return `kode ${i.detail} sudah dipakai di daftar produk, dikosongkan`;
      case "recipeMaterialMissing":
        return `Resep: bahan "${i.detail}" tidak ditemukan, dilewati`;
      case "recipeUnitMismatch":
        return `Resep: satuan bahan "${i.detail}" tidak cocok, dilewati`;
      case "recipeVariantMissing":
        return `Resep: varian "${i.detail}" tidak ada, dilewati`;
      case "groupMissing":
        return `grup "${i.detail}" tidak ditemukan, dilewati`;
    }
  })();
  return i.field && !["variantInvalid", "variantDuplicate", "variantTooMany", "variantCodeUsed", "groupMissing"].includes(i.code)
    ? `${fieldLabelOf(i.field)}: ${msg}`
    : msg;
}

export type ImportVariant = {
  line: number;
  name: string;
  price: number;
  cost: number | null;
  sku: string | null;
  barcodes: string[];
  initialStock: number | null;
  minStock: number | null;
};

export type ImportRow = {
  line: number;
  name: string;
  price: number | null;
  category: string | null;
  cost: number | null;
  sku: string | null;
  barcodes: string[];
  unit: string | null;
  trackStock: boolean | null;
  /** Mili-satuan. */
  initialStock: number | null;
  minStock: number | null;
  taxable: boolean | null;
  description: string | null;
  duration: number | null;
  variantName: string | null;
  variants: ImportVariant[];
  mergedLines: number[];
  /** Resep dari lembar Resep (bahan dicocokkan saat analisis). */
  recipe: ImportRecipeLine[];
  groupNames: string[];
  errors: Issue[];
  warnings: Issue[];
};

/** Satu baris resep: `qty` mili-satuan bahan `material` untuk produk (atau `variant`). */
export type ImportRecipeLine = {
  line: number;
  material: string;
  qty: number;
  variant: string | null;
  /** Satuan dari berkas (sudah dinormalkan); null = satuan bahan. */
  givenUnit: string | null;
  /** Satuan terselesaikan saat analisis; null = baris dilewati. */
  unit: string | null;
};

export const rowValid = (r: ImportRow) => r.errors.length === 0;

export function addVariant(row: ImportRow, v: ImportVariant, error?: boolean) {
  if (error || v.name.length > IMPORT_LIMITS.variantValue) {
    row.warnings.push({ field: "variant", code: "variantInvalid", detail: v.name, limit: v.line });
  } else if (row.variants.some((o) => o.name.toLowerCase() === v.name.toLowerCase())) {
    row.warnings.push({ field: "variant", code: "variantDuplicate", detail: v.name });
  } else if (row.variants.length >= IMPORT_LIMITS.variants) {
    if (!row.warnings.some((w) => w.code === "variantTooMany")) row.warnings.push({ field: "variant", code: "variantTooMany", limit: IMPORT_LIMITS.variants });
  } else row.variants.push(v);
}

export type ImportFile = { rows: ImportRow[]; columns: Set<FieldKey>; ignored: string[]; extras: ImportExtras; error?: string };

export const FILE_ERRORS = {
  empty: "Berkas kosong. Isi minimal satu baris produk di bawah judul kolom.",
  tooManyRows: "Berkas lebih dari 1.000 baris. Bagi menjadi beberapa berkas.",
  noProductSheet: "Lembar produk tidak ditemukan. Salah satu lembar harus punya kolom nama dan harga produk.",
} as const;

export const failedImport = (error: string): ImportFile => ({ rows: [], columns: new Set(), ignored: [], extras: NO_EXTRAS, error });

/** Mengurai teks CSV (baris pertama = judul kolom). */
export function parseImportFile(text: string, service: boolean): ImportFile {
  return parseImportRows(parseCsv(text), service);
}

/** Mengurai baris lembar produk (CSV atau satu lembar Excel). Baris pertama = judul kolom (`ImportFile.fromRows`). */
export function parseImportRows(csv: CsvRow[], service: boolean): ImportFile {
  const fail = failedImport;
  if (csv.length < 2) return fail(FILE_ERRORS.empty);
  const index = new Map<FieldKey, number>();
  const ignored: string[] = [];
  csv[0].cells.forEach((h, i) => {
    const f = fieldFromHeader(h);
    if (!f || index.has(f) || (f === "duration" && !service)) {
      if (h.trim()) ignored.push(h.trim());
      return;
    }
    index.set(f, i);
  });
  if (!index.has("name")) return fail('Kolom "nama" tidak ditemukan. Pakai judul kolom dari template.');
  if (!index.has("price")) return fail('Kolom "harga" tidak ditemukan. Pakai judul kolom dari template.');
  if (csv.length - 1 > IMPORT_LIMITS.maxRows) return fail(FILE_ERRORS.tooManyRows);
  return { rows: mergeVariantRows(csv.slice(1).map((r) => parseRow(r, index))), columns: new Set(index.keys()), ignored, extras: NO_EXTRAS };
}

/** Baris bernama sama yang mengisi `varian` → satu produk bervarian (baris pertama = produk; kode & stok pindah ke variannya). */
function mergeVariantRows(rows: ImportRow[]): ImportRow[] {
  const heads = new Map<string, ImportRow>();
  const out: ImportRow[] = [];
  for (const r of rows) {
    if (r.variantName === null || !r.name) {
      out.push(r);
      continue;
    }
    const key = r.name.toLowerCase();
    const head = heads.get(key);
    const v: ImportVariant = {
      line: r.line,
      name: r.variantName,
      price: r.price ?? head?.price ?? 0,
      cost: r.cost,
      sku: r.sku,
      barcodes: r.barcodes,
      initialStock: r.initialStock,
      minStock: r.minStock,
    };
    if (!head) {
      heads.set(key, r);
      r.sku = null;
      r.barcodes = [];
      addVariant(r, v);
      out.push(r);
      continue;
    }
    head.mergedLines.push(r.line);
    addVariant(head, v, !rowValid(r));
  }
  return out;
}

function parseRow(csv: CsvRow, index: Map<FieldKey, number>): ImportRow {
  const row: ImportRow = {
    line: csv.line,
    name: "",
    price: null,
    category: null,
    cost: null,
    sku: null,
    barcodes: [],
    unit: null,
    trackStock: null,
    initialStock: null,
    minStock: null,
    taxable: null,
    description: null,
    duration: null,
    variantName: null,
    variants: [],
    mergedLines: [],
    recipe: [],
    groupNames: [],
    errors: [],
    warnings: [],
  };
  const cell = (f: FieldKey): string | null => {
    const i = index.get(f);
    if (i === undefined || i >= csv.cells.length) return null;
    const v = csv.cells[i].trim().replace(/\s+/g, " ");
    return v ? v : null;
  };
  const error = (field: FieldKey, code: IssueCode, limit?: number) => row.errors.push({ field, code, limit });
  const text = (f: FieldKey, max: number) => {
    const v = cell(f);
    if (v !== null && v.length > max) error(f, "tooLong", max);
    return v;
  };
  const money = (f: FieldKey) => {
    const v = cell(f);
    if (v === null) return null;
    const n = parseImportMoney(v);
    if (n === null) error(f, "invalidNumber");
    else if (n > IMPORT_LIMITS.maxPrice) error(f, "tooLarge");
    return n;
  };
  const qty = (f: FieldKey) => {
    const v = cell(f);
    if (v === null) return null;
    const n = parseQty(v);
    if (n === null) error(f, "invalidNumber");
    return n;
  };
  const flag = (f: FieldKey) => {
    const v = cell(f);
    if (v === null) return null;
    const b = parseImportBool(v);
    if (b === null) error(f, "invalidBool");
    return b;
  };

  row.name = text("name", IMPORT_LIMITS.nameLength) ?? "";
  row.price = money("price");
  row.category = text("category", IMPORT_LIMITS.categoryLength);
  row.cost = money("cost");
  row.sku = text("sku", IMPORT_LIMITS.codeLength);
  row.unit = text("unit", IMPORT_LIMITS.unitLength);
  row.trackStock = flag("trackStock");
  row.initialStock = qty("initialStock");
  row.minStock = qty("minStock");
  row.taxable = flag("taxable");
  row.description = text("description", IMPORT_LIMITS.descriptionLength);
  row.variantName = text("variant", IMPORT_LIMITS.variantValue);
  for (const g of (cell("modifiers") ?? "").split(/[;|,]/)) {
    const t = g.trim();
    if (t && !row.groupNames.some((n) => n.toLowerCase() === t.toLowerCase())) row.groupNames.push(t);
  }
  if (!row.name) error("name", "required");
  if (cell("price") === null) error("price", "required");

  const barcodes: string[] = [];
  for (const b of (cell("barcode") ?? "").split(/[;|,]/)) {
    const t = b.trim();
    if (!t || barcodes.includes(t)) continue;
    if (t.length > IMPORT_LIMITS.codeLength) error("barcode", "tooLong", IMPORT_LIMITS.codeLength);
    barcodes.push(t);
  }
  if (barcodes.length > IMPORT_LIMITS.barcodes) error("barcode", "tooManyBarcodes", IMPORT_LIMITS.barcodes);
  row.barcodes = barcodes;

  const duration = cell("duration");
  if (duration !== null) {
    const n = /^\d+$/.test(duration) ? Number(duration) : NaN;
    if (!Number.isInteger(n) || n < 1) error("duration", "invalidNumber");
    else if (n > IMPORT_LIMITS.maxDurationMin) error("duration", "tooLarge");
    else row.duration = n;
  }
  if (row.trackStock === false && row.initialStock !== null) row.warnings.push({ field: "initialStock", code: "stockIgnored" });
  return row;
}

// ——— Lembar tambahan Excel (`import_workbook.dart`) ———

/** Satuan bahan baku Sissi (`MaterialUnits.all`). */
export const MATERIAL_UNITS = ["g", "kg", "ml", "l", "pcs", "pack", "botol", "sachet"] as const;

/** Batas lembar tambahan (sama dengan aplikasi `ImportExtraLimits`). */
export const IMPORT_EXTRA_LIMITS = { nameLength: 100, groupNameLength: 60, options: 30 } as const;

export type MaterialIssue = "unitAssumed" | "costInvalid" | "packInvalid";

/** Bahan baku dari berkas. */
export type ImportMaterial = {
  line: number;
  name: string;
  /** Satuan Sissi (`MATERIAL_UNITS`). */
  unit: string;
  /** Teks satuan di berkas (mis. "Mililiter"). */
  rawUnit: string | null;
  /** Harga beli di berkas (rupiah) untuk `pack` satuan. */
  cost: number | null;
  /** Isi kemasan dari kolom berkas (mili-satuan); null = tidak ada. */
  pack: number | null;
  minStock: number;
  sku: string | null;
  issues: MaterialIssue[];
};

export type ImportModifierOption = { name: string; price: number };

/** Grup pilihan ekstra dari berkas. */
export type ImportModifierGroup = {
  line: number;
  name: string;
  /** Pelanggan hanya boleh memilih satu (null = tidak diisi → bebas). */
  singleChoice: boolean | null;
  options: ImportModifierOption[];
  /** Jumlah produk berkas yang memakai grup ini. */
  usedBy: number;
};

export type NoteCode = "productMissing" | "invalidPrice" | "invalidQty" | "missingValue" | "duplicate" | "tooLong" | "tooManyOptions" | "emptyGroup";

/** Baris lembar tambahan yang dilewati. */
export type ImportNote = { sheet: string; line: number; code: NoteCode; detail?: string };

export type SheetKind = "products" | "variants" | "materials" | "recipes" | "modifiers" | "modifierLinks";

export const SHEET_KIND_LABEL: Record<SheetKind, string> = {
  products: "Produk",
  variants: "Varian",
  materials: "Bahan baku",
  recipes: "Resep",
  modifiers: "Pilihan ekstra",
  modifierLinks: "Penghubung pilihan ekstra",
};

/** Isi lembar tambahan Excel. */
export type ImportExtras = {
  materials: ImportMaterial[];
  modifierGroups: ImportModifierGroup[];
  notes: ImportNote[];
  /** Lembar yang dipakai per jenis. */
  sheets: Partial<Record<SheetKind, string[]>>;
  /** Lembar berisi data yang tidak dikenali (diabaikan). */
  ignoredSheets: string[];
  productSheet: string | null;
};

export const NO_EXTRAS: ImportExtras = { materials: [], modifierGroups: [], notes: [], sheets: {}, ignoredSheets: [], productSheet: null };

export const materialKey = (m: { name: string }) => m.name.toLowerCase();
export const groupValid = (g: ImportModifierGroup) => g.options.length > 0;

function extraMaterial(x: ImportExtras, name: string): ImportMaterial | undefined {
  const k = name.trim().toLowerCase();
  return x.materials.find((m) => materialKey(m) === k);
}

function extraGroup(x: ImportExtras, name: string): ImportModifierGroup | undefined {
  const k = name.trim().toLowerCase();
  return x.modifierGroups.find((g) => g.name.toLowerCase() === k && groupValid(g));
}

/** Teks catatan baris dilewati (`productImportNote*`). */
export function noteText(n: ImportNote): string {
  const msg = (() => {
    switch (n.code) {
      case "productMissing":
        return `produk "${n.detail}" tidak ada di lembar produk`;
      case "invalidPrice":
        return `harga "${n.detail}" bukan angka`;
      case "invalidQty":
        return `jumlah "${n.detail}" harus angka lebih dari 0`;
      case "missingValue":
        return "kolom wajib kosong";
      case "duplicate":
        return `"${n.detail}" ganda`;
      case "tooLong":
        return "nama terlalu panjang";
      case "tooManyOptions":
        return `grup "${n.detail}" lebih dari ${IMPORT_EXTRA_LIMITS.options} pilihan, sisanya dilewati`;
      case "emptyGroup":
        return `grup "${n.detail}" tanpa pilihan`;
    }
  })();
  return `${n.sheet} · baris ${n.line}: ${msg}`;
}

export const MATERIAL_ISSUE_TEXT: Record<MaterialIssue, (m: ImportMaterial) => string> = {
  unitAssumed: (m) => `Satuan "${m.rawUnit ?? ""}" tidak dikenal, dianggap pcs`,
  costInvalid: () => "Harga beli bukan angka, dianggap 0",
  packInvalid: () => "Isi kemasan bukan angka, diabaikan",
};

/** Satuan bahan dari teks berkas → satuan Sissi; null bila tidak dikenal (`normalizeMaterialUnit`). */
export function normalizeMaterialUnit(raw: string | null | undefined): string | null {
  const t = importHeaderKey(raw ?? "");
  if (["g", "gr", "gram", "grams", "gm", "grm", "gram_g"].includes(t)) return "g";
  if (["kg", "kilo", "kilogram", "kgs"].includes(t)) return "kg";
  if (["ml", "mililiter", "milliliter", "millilitre", "cc"].includes(t)) return "ml";
  if (["l", "lt", "ltr", "liter", "litre"].includes(t)) return "l";
  if (["pcs", "pc", "piece", "pieces", "buah", "bh", "biji", "butir", "unit", "item", "ea", "each", "lembar"].includes(t)) return "pcs";
  if (["pack", "pak", "pck", "bungkus", "bks", "packet"].includes(t)) return "pack";
  if (["botol", "btl", "bottle"].includes(t)) return "botol";
  if (["sachet", "saset", "sachets", "sct"].includes(t)) return "sachet";
  return null;
}

/** Dimensi satuan bahan (`unitDimension`): g↔kg massa, ml↔l volume, lainnya dirinya sendiri. */
export function unitDimension(unit: string): string {
  if (unit === "g" || unit === "kg") return "mass";
  if (unit === "ml" || unit === "l") return "volume";
  return unit;
}

const unitFactor = (u: string) => (u === "kg" || u === "l" ? 1000 : 1);

/** `milli` mili-satuan `from` → mili-satuan `to`; null bila beda dimensi (`convertQty`, bulat setengah ke atas). */
export function convertQty(milli: number, from: string, to: string): number | null {
  if (unitDimension(from) !== unitDimension(to)) return null;
  const f = unitFactor(from);
  const t = unitFactor(to);
  if (f === t) return milli;
  if (f > t) return milli * (f / t);
  const d = t / f;
  const abs = Math.floor((Math.abs(milli) + Math.floor(d / 2)) / d);
  return milli < 0 ? -abs : abs;
}

/** Harga ≥ Rp1.000 per gram/ml hampir pasti harga per kg/liter. */
export const looksPerKiloOrLiter = (m: ImportMaterial) => m.pack === null && (m.unit === "g" || m.unit === "ml") && (m.cost ?? 0) >= 1000;

/** Isi kemasan awal (mili-satuan): kolom `isi_kemasan`, 1.000 bila harganya per kg/liter, selain itu 1 satuan. */
export const suggestedPack = (m: ImportMaterial) => m.pack ?? (looksPerKiloOrLiter(m) ? 1_000_000 : 1000);

/** Harga per satuan bila `cost` berlaku untuk `packMilli` mili-satuan (dibulatkan setengah ke atas). */
export function costPerUnit(m: ImportMaterial, packMilli: number): number {
  const c = m.cost ?? 0;
  if (packMilli <= 0) return c;
  return Math.floor((c * 1000 + Math.floor(packMilli / 2)) / packMilli);
}

// ——— Analisis ———

export type MatchBy = "sku" | "barcode" | "name" | "sameProduct";

export const MATCH_REASON: Record<MatchBy, string> = {
  sku: "SKU sama",
  barcode: "barcode sama",
  name: "nama sama",
  sameProduct: "produk tujuan sama",
};

export type ImportMatch = { product: Product; by: MatchBy; updatable: boolean; fileVariants: boolean };

export type DuplicateGroup = { lines: number[]; reasons: Set<MatchBy>; allowsMultiple: boolean };

/** Bahan baku server (`raw_materials`). */
export type RawMaterial = SyncRecord & { name: string; sku: string | null; unit: string; min_stock: number; avg_cost: number; is_active: boolean };

/** Resep server (`recipes`). */
export type RecipeItem = { raw_material_id: string; qty: number; unit: string };
export type Recipe = SyncRecord & { product_id: string; variant_id: string | null; items: RecipeItem[] };

export type ImportAnalysis = {
  file: ImportFile;
  matches: Map<number, ImportMatch>;
  groups: DuplicateGroup[];
  groupOf: Map<number, number>;
  /** Nama kategori (huruf kecil) → id. */
  categories: Map<string, string>;
  /** Nama grup modifier (huruf kecil) → id. */
  modifierGroups: Map<string, string>;
  /** Nama bahan baku (huruf kecil) yang sudah ada — dipakai ulang, tidak diubah. */
  materials: Map<string, RawMaterial>;
  /** Resep yang sudah ada (untuk produk yang ditimpa). */
  recipes: Recipe[];
};

export type CatalogSnapshot = {
  products: Product[];
  variants: Variant[];
  categories: { id: string; name: string }[];
  groups: { id: string; name: string }[];
  materials?: RawMaterial[];
  recipes?: Recipe[];
};

const allBarcodes = (x: { barcode: string | null; barcodes?: string[] }) => [...(x.barcode ? [x.barcode] : []), ...(x.barcodes ?? [])];

export function analyzeImport(file: ImportFile, data: CatalogSnapshot): ImportAnalysis {
  const key = codeKey;
  const bySku = new Map<string, Product>();
  const byBarcode = new Map<string, Product>();
  const byName = new Map<string, Product>();
  for (const p of data.products) {
    if (p.sku) bySku.set(key(p.sku), p);
    for (const b of allBarcodes(p)) byBarcode.set(key(b), p);
    if (!byName.has(key(p.name))) byName.set(key(p.name), p);
  }
  const variantCodes = new Map<string, string>();
  const variantProducts = new Set<string>();
  const productNames = new Map(data.products.map((p) => [p.id, p.name]));
  for (const v of data.variants) {
    variantProducts.add(v.product_id);
    const label = `${productNames.get(v.product_id) ?? ""} · ${v.name}`;
    for (const c of [...(v.sku ? [v.sku] : []), ...allBarcodes(v)]) variantCodes.set(key(c), label);
  }

  const matches = new Map<number, ImportMatch>();
  for (const row of file.rows) {
    if (!rowValid(row)) continue;
    if (row.sku && variantCodes.has(key(row.sku))) row.errors.push({ field: "sku", code: "usedByVariant", detail: variantCodes.get(key(row.sku)) });
    for (const b of row.barcodes) {
      const label = variantCodes.get(key(b));
      if (label) {
        row.errors.push({ field: "barcode", code: "usedByVariant", detail: label });
        break;
      }
    }
    const skuHit = row.sku ? bySku.get(key(row.sku)) : undefined;
    const barcodeHit = row.barcodes.map((b) => byBarcode.get(key(b))).find((p) => !!p);
    if (skuHit && barcodeHit && skuHit.id !== barcodeHit.id) row.errors.push({ field: "barcode", code: "matchesTwoProducts" });
    if (!rowValid(row)) continue;
    let hit: Product | undefined;
    let by: MatchBy;
    if (skuHit) [hit, by] = [skuHit, "sku"];
    else if (barcodeHit) [hit, by] = [barcodeHit, "barcode"];
    else {
      const p = byName.get(key(row.name));
      // Cocok nama hanya bila salah satu tanpa SKU (SKU beda = produk lain).
      hit = p && (row.sku === null || p.sku === null) ? p : undefined;
      by = "name";
    }
    if (!hit) continue;
    matches.set(row.line, { product: hit, by, updatable: !variantProducts.has(hit.id) && row.variants.length === 0, fileVariants: row.variants.length > 0 });
    if (row.initialStock !== null) row.warnings.push({ field: "initialStock", code: "stockNotUpdated" });
  }

  const groupIds = new Map(data.groups.map((g) => [key(g.name), g.id]));
  const existingMaterials = new Map((data.materials ?? []).map((m) => [key(m.name), m]));
  const extras = file.extras;
  const codeTaken = (c: string) => bySku.has(key(c)) || byBarcode.has(key(c)) || variantCodes.has(key(c));
  for (const row of file.rows) {
    const warn = (field: FieldKey | null, code: IssueCode, detail: string) => {
      if (!row.warnings.some((w) => w.code === code && w.detail === detail)) row.warnings.push({ field, code, detail });
    };
    for (const v of row.variants) {
      for (const c of [...(v.sku ? [v.sku] : []), ...v.barcodes]) {
        if (!codeTaken(c)) continue;
        warn("variant", "variantCodeUsed", c);
        if (v.sku === c) v.sku = null;
        v.barcodes = v.barcodes.filter((b) => b !== c);
      }
    }
    for (const l of row.recipe) {
      l.unit = null;
      // Bahan bernama sama yang sudah ada dipakai ulang → satuannya yang menentukan kecocokan resep.
      const target = existingMaterials.get(key(l.material))?.unit ?? extraMaterial(extras, l.material)?.unit;
      if (!target) {
        warn(null, "recipeMaterialMissing", l.material);
        continue;
      }
      // Jumlah resep berkas mengacu ke satuan bahan di berkas.
      const u = l.givenUnit ?? extraMaterial(extras, l.material)?.unit ?? target;
      if (unitDimension(u) !== unitDimension(target)) {
        warn(null, "recipeUnitMismatch", l.material);
        continue;
      }
      if (l.variant !== null && !row.variants.some((v) => v.name.toLowerCase() === l.variant!.toLowerCase())) {
        warn(null, "recipeVariantMissing", l.variant);
        continue;
      }
      l.unit = u;
    }
    for (const g of row.groupNames) if (!extraGroup(extras, g) && !groupIds.has(key(g))) warn("modifiers", "groupMissing", g);
  }

  // Kembaran di berkas: SKU, barcode, nama (tanpa SKU), atau produk tujuan yang sama.
  const valid = file.rows.filter(rowValid);
  const parent = valid.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const firstOf = new Map<string, number>();
  const linkReasons = new Map<number, Set<MatchBy>>();
  const link = (i: number, k: string, by: MatchBy) => {
    const j = firstOf.get(k);
    if (j === undefined) {
      firstOf.set(k, i);
      return;
    }
    const a = find(i);
    const b = find(j);
    const reasons = new Set<MatchBy>([...(linkReasons.get(a) ?? []), ...(linkReasons.get(b) ?? []), by]);
    linkReasons.delete(a);
    parent[a] = b;
    linkReasons.set(b, reasons);
  };
  valid.forEach((r, i) => {
    if (r.sku) link(i, `sku:${key(r.sku)}`, "sku");
    for (const b of r.barcodes) link(i, `bc:${key(b)}`, "barcode");
    if (r.sku === null) link(i, `nm:${key(r.name)}`, "name");
    const m = matches.get(r.line);
    if (m) link(i, `pr:${m.product.id}`, "sameProduct");
  });
  const members = new Map<number, number[]>();
  valid.forEach((r, i) => {
    const root = find(i);
    members.set(root, [...(members.get(root) ?? []), r.line]);
  });
  const groups: DuplicateGroup[] = [];
  const groupOf = new Map<number, number>();
  for (const [root, lines] of members) {
    if (lines.length < 2) continue;
    for (const l of lines) groupOf.set(l, groups.length);
    const reasons = linkReasons.get(root) ?? new Set<MatchBy>();
    groups.push({ lines, reasons, allowsMultiple: reasons.size === 1 && reasons.has("name") });
  }
  return {
    file,
    matches,
    groups,
    groupOf,
    categories: new Map(data.categories.map((c) => [key(c.name), c.id])),
    modifierGroups: groupIds,
    materials: existingMaterials,
    recipes: data.recipes ?? [],
  };
}

export type RowKind = "invalid" | "duplicate" | "existing" | "ready";

export function kindOf(a: ImportAnalysis, r: ImportRow): RowKind {
  if (!rowValid(r)) return "invalid";
  if (a.groupOf.has(r.line)) return "duplicate";
  if (a.matches.has(r.line)) return "existing";
  return "ready";
}

/** Baris boleh dipilih (dibuat atau ditimpa). */
export function selectable(a: ImportAnalysis, line: number): boolean {
  const r = a.file.rows.find((x) => x.line === line);
  if (!r || !rowValid(r)) return false;
  return a.matches.get(line)?.updatable ?? true;
}

/** Pilihan awal (sama dengan aplikasi): baris siap + baris pertama tiap kembaran bila produk baru; produk yang sudah ada tidak ditimpa sampai dipilih "Pakai berkas". */
export function defaultSelection(a: ImportAnalysis): Set<number> {
  const out = new Set<number>();
  for (const r of a.file.rows) if (kindOf(a, r) === "ready") out.add(r.line);
  for (const g of a.groups) {
    const line = g.lines.find((l) => selectable(a, l));
    if (line !== undefined && !a.matches.has(line)) out.add(line);
  }
  return out;
}

/** Kategori baru (nama asli, urut kemunculan) untuk baris terpilih. */
export function newCategories(a: ImportAnalysis, selected: Set<number>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of a.file.rows) {
    if (!selected.has(r.line) || !selectable(a, r.line) || !r.category) continue;
    const k = r.category.toLowerCase();
    if (!a.categories.has(k) && !seen.has(k)) {
      seen.add(k);
      out.push(r.category);
    }
  }
  return out;
}

/** Bahan baku berkas yang akan dibuat (yang namanya sudah ada dipakai ulang). */
export const newMaterials = (a: ImportAnalysis) => a.file.extras.materials.filter((m) => !a.materials.has(materialKey(m)));

/** Grup pilihan ekstra berkas yang akan dibuat. */
export const newGroups = (a: ImportAnalysis) => a.file.extras.modifierGroups.filter((g) => groupValid(g) && !a.modifierGroups.has(g.name.toLowerCase()));

/** Isi kemasan awal tiap bahan baru (kunci nama huruf kecil → mili-satuan). */
export function defaultPacks(a: ImportAnalysis): Map<string, number> {
  return new Map(newMaterials(a).map((m) => [materialKey(m), suggestedPack(m)]));
}

/** Perubahan entitas yang belum ada di `WritableEntity` web (bahan baku, resep, gerakan stok) — bentuk `Change` sama. */
type ExtraEntity = "raw_materials" | "recipes" | "stock_movements";
const entityChange = (entity: ExtraEntity, data: Record<string, unknown>, id: string = newId(), base?: SyncRecord): Change =>
  ({ entity: entity as unknown as WritableEntity, op: "upsert", id, data, ...(base ? { base_updated_at: base.updated_at } : {}) }) as Change;

/** Perubahan tahap kedua: dikirim hanya bila semua record `deps` (id baru di tahap pertama) `applied`. */
export type FollowUp = { change: Change; deps: string[] };

export type ImportPlan = {
  /** Tahap 1, urut dependensi: kategori → bahan baku → grup pilihan ekstra → produk → varian. */
  changes: Change[];
  /** Tahap 2: resep → stok awal (setelah produk/varian/bahannya tersimpan). */
  followUps: FollowUp[];
  labels: Map<string, string>;
  create: number;
  update: number;
  same: number;
  variants: number;
  recipes: number;
  materials: number;
  groups: number;
  /** Gerakan stok awal yang dibuat (0 bila outlet belum dipilih). */
  stock: number;
  /** Produk/varian baru yang membawa stok awal (butuh outlet). */
  stockWanted: number;
};

export type PlanOptions = {
  /** Isi kemasan harga beli bahan baru (kunci nama huruf kecil → mili-satuan). */
  packs?: Map<string, number>;
  /** Outlet & pegawai (pemilik) untuk gerakan stok awal; tanpa salah satunya stok awal tidak dicatat. */
  outletId?: string | null;
  employeeId?: string | null;
  /** Waktu gerakan stok (ISO); bawaan sekarang. */
  now?: string;
};

/**
 * Perubahan untuk baris terpilih (sama dengan `importProducts` aplikasi): kategori baru ({name}, sort_order bawaan
 * server 0), bahan baku & grup pilihan ekstra baru (semua, tidak bergantung pilihan baris), produk baru (+ varian satu
 * pilihan "Varian"), produk yang ditimpa mempertahankan nilai lama untuk sel kosong; lalu resep (bahan sama dijumlah)
 * dan stok awal (`in`, harga modal sebagai `unit_cost`) produk/varian baru.
 */
export function buildImportChanges(a: ImportAnalysis, selected: Set<number>, opts: PlanOptions = {}): ImportPlan {
  const categoryChanges: Change[] = [];
  const extraChanges: Change[] = [];
  const productChanges: Change[] = [];
  const recipeFollowUps: FollowUp[] = [];
  const stockFollowUps: FollowUp[] = [];
  const labels = new Map<string, string>();
  const categoryIds = new Map(a.categories);
  const now = opts.now ?? new Date().toISOString();
  const canStock = !!opts.outletId && !!opts.employeeId;
  let create = 0;
  let update = 0;
  let same = 0;
  let variants = 0;
  let recipes = 0;
  let stockWanted = 0;

  // Bahan baku: yang sudah ada dipakai ulang; baru → avg_cost = harga beli ÷ isi kemasan.
  const materials = new Map<string, { id: string; unit: string; isNew: boolean }>();
  for (const [k, m] of a.materials) materials.set(k, { id: m.id, unit: m.unit, isNew: false });
  const freshMaterials = newMaterials(a);
  for (const m of freshMaterials) {
    const id = newId();
    const pack = opts.packs?.get(materialKey(m)) ?? suggestedPack(m);
    extraChanges.push(
      entityChange("raw_materials", { name: m.name, sku: m.sku, unit: m.unit, min_stock: m.minStock, avg_cost: costPerUnit(m, pack), is_active: true }, id)
    );
    labels.set(id, `Bahan baku "${m.name}"`);
    materials.set(materialKey(m), { id, unit: m.unit, isNew: true });
  }
  // Grup pilihan ekstra baru: opsional (min 0), pilih satu → maks 1, selain itu maks = jumlah pilihan (≤ batas server).
  const groupIds = new Map(a.modifierGroups);
  const freshGroups = newGroups(a);
  for (const g of freshGroups) {
    const id = newId();
    extraChanges.push(
      createChange(
        "modifier_groups",
        {
          name: g.name,
          min_select: 0,
          max_select: g.singleChoice ? 1 : Math.min(g.options.length, LIMITS.modifierMaxSelect),
          options: g.options.map((o) => ({ id: newId(), name: o.name, price: o.price })),
        },
        id
      )
    );
    labels.set(id, `Grup pilihan ekstra "${g.name}"`);
    groupIds.set(g.name.toLowerCase(), id);
  }

  /** Resep per target (null = produk, lalu id varian); bahan sama dijumlahkan dalam satuan baris pertama. */
  const recipesOf = (r: ImportRow, variantIds: Map<string, string>) => {
    const out = new Map<string | null, RecipeItem[]>();
    for (const l of r.recipe) {
      const material = materials.get(l.material.toLowerCase());
      if (!l.unit || !material) continue;
      let target: string | null = null;
      if (l.variant !== null) {
        const v = variantIds.get(l.variant.toLowerCase());
        if (!v) continue;
        target = v;
      }
      const items = out.get(target) ?? [];
      out.set(target, items);
      const i = items.findIndex((it) => it.raw_material_id === material.id);
      if (i < 0) items.push({ raw_material_id: material.id, qty: l.qty, unit: l.unit });
      else items[i] = { ...items[i], qty: items[i].qty + (convertQty(l.qty, l.unit, items[i].unit) ?? 0) };
    }
    return out;
  };
  const freshMaterialIds = new Set([...materials.values()].filter((m) => m.isNew).map((m) => m.id));
  const recipeDeps = (items: RecipeItem[], productDeps: string[]) => [...productDeps, ...items.map((it) => it.raw_material_id).filter((id) => freshMaterialIds.has(id))];

  for (const r of a.file.rows) {
    if (!selected.has(r.line) || !selectable(a, r.line)) continue;
    let categoryId: string | null = null;
    if (r.category) {
      const k = r.category.toLowerCase();
      let id = categoryIds.get(k);
      if (!id) {
        id = newId();
        categoryIds.set(k, id);
        categoryChanges.push(createChange("categories", { name: r.category }, id));
        labels.set(id, `Kategori baru "${r.category}"`);
      }
      categoryId = id;
    }
    const rowGroups = [...new Set(r.groupNames.map((n) => groupIds.get(n.toLowerCase())).filter((x): x is string => !!x))];
    const label = `Baris ${r.line} · ${r.name}`;
    const match = a.matches.get(r.line);
    if (!match) {
      const hasVariantStock = r.variants.some((v) => v.initialStock !== null || v.minStock !== null);
      const trackForNew = r.trackStock ?? (r.initialStock !== null || r.minStock !== null);
      const track = r.trackStock ?? (trackForNew || hasVariantStock);
      const id = newId();
      productChanges.push(
        createChange(
          "products",
          {
            category_id: categoryId,
            name: r.name,
            description: r.description ?? "",
            price: r.price ?? 0,
            sku: r.sku,
            barcode: r.barcodes[0] ?? null,
            image_url: null,
            is_active: true,
            cost_price: r.cost,
            track_stock: track,
            min_stock: track ? (r.minStock ?? 0) : 0,
            unit: r.unit ?? "pcs",
            is_taxable: r.taxable ?? true,
            is_cookable: true,
            barcodes: r.barcodes.slice(1),
            modifier_group_ids: rowGroups,
            duration_min: r.duration,
            variant_options: r.variants.length ? [{ name: IMPORT_VARIANT_DIMENSION, values: r.variants.map((v) => v.name) }] : [],
          },
          id
        )
      );
      labels.set(id, label);
      const variantIds = new Map<string, string>();
      const variantName = new Map<string, string>();
      const stockMove = (qty: number, variantId: string | null, unitCost: number | null) => {
        stockWanted++;
        if (!canStock) return;
        const sid = newId();
        stockFollowUps.push({
          change: entityChange(
            "stock_movements",
            {
              outlet_id: opts.outletId,
              product_id: id,
              raw_material_id: null,
              variant_id: variantId,
              qty_delta: qty,
              type: "in",
              ref_id: null,
              note: "",
              unit_cost: unitCost,
              employee_id: opts.employeeId,
              occurred_at: now,
            },
            sid
          ),
          deps: [id, ...(variantId ? [variantId] : [])],
        });
        labels.set(sid, `${label} — stok awal${variantId ? ` varian ${variantName.get(variantId)}` : ""}`);
      };
      r.variants.forEach((v, i) => {
        const vid = newId();
        variantIds.set(v.name.toLowerCase(), vid);
        variantName.set(vid, v.name);
        productChanges.push(
          createChange(
            "product_variants",
            {
              product_id: id,
              name: v.name,
              price: v.price,
              is_active: true,
              sku: v.sku,
              barcode: v.barcodes[0] ?? null,
              cost_price: v.cost,
              min_stock: track ? v.minStock : null,
              barcodes: v.barcodes.slice(1),
              sort_order: i,
              options: { [IMPORT_VARIANT_DIMENSION]: v.name },
              image_url: null,
            },
            vid
          )
        );
        labels.set(vid, `${label} — varian ${v.name}`);
        if (track && (v.initialStock ?? 0) > 0) stockMove(v.initialStock!, vid, v.cost ?? r.cost);
      });
      if (track && !r.variants.length && (r.initialStock ?? 0) > 0) stockMove(r.initialStock!, null, r.cost);
      for (const [target, items] of recipesOf(r, variantIds)) {
        const rid = newId();
        recipeFollowUps.push({
          change: entityChange("recipes", { product_id: id, variant_id: target, items }, rid),
          deps: recipeDeps(items, [id, ...(target ? [target] : [])]),
        });
        labels.set(rid, `${label} — resep${target ? ` varian ${variantName.get(target)}` : ""}`);
        recipes++;
      }
      create++;
      variants += r.variants.length;
      continue;
    }
    const p = match.product;
    const codes = r.barcodes.length ? r.barcodes : allBarcodes(p);
    const patch: Record<string, unknown> = {
      name: r.name,
      price: r.price ?? p.price,
      category_id: categoryId ?? p.category_id,
      description: r.description ?? p.description,
      sku: r.sku ?? p.sku,
      barcode: codes[0] ?? null,
      barcodes: codes.slice(1),
      cost_price: r.cost ?? p.cost_price,
      track_stock: r.trackStock ?? p.track_stock,
      min_stock: r.minStock ?? p.min_stock,
      unit: r.unit ?? p.unit,
      is_taxable: r.taxable ?? p.is_taxable,
      modifier_group_ids: [...new Set([...(p.modifier_group_ids ?? []), ...rowGroups])],
      duration_min: r.duration ?? p.duration_min,
    };
    // Resep produk yang ditimpa (produk tanpa varian → hanya resep produk); sama persis = tidak dikirim.
    let recipeChanged = false;
    const items = recipesOf(r, new Map()).get(null);
    if (items?.length) {
      const cur = a.recipes.find((x) => x.product_id === p.id && !x.variant_id);
      if (!cur || JSON.stringify(cur.items) !== JSON.stringify(items)) {
        const rid = cur?.id ?? newId();
        recipeFollowUps.push({
          change: cur ? entityChange("recipes", { ...recordData(cur), items }, rid, cur) : entityChange("recipes", { product_id: p.id, variant_id: null, items }, rid),
          deps: recipeDeps(items, []),
        });
        labels.set(rid, `${label} — resep`);
        recipes++;
        recipeChanged = true;
      }
    }
    const rec = p as unknown as Record<string, unknown>;
    if (Object.entries(patch).every(([k, v]) => JSON.stringify(rec[k] ?? null) === JSON.stringify(v ?? null))) {
      if (recipeChanged) update++;
      else same++;
      continue;
    }
    productChanges.push(editChange("products", p, patch));
    labels.set(p.id, label);
    update++;
  }
  return {
    changes: [...categoryChanges, ...extraChanges, ...productChanges],
    followUps: [...recipeFollowUps, ...stockFollowUps],
    labels,
    create,
    update,
    same,
    variants,
    recipes,
    materials: freshMaterials.length,
    groups: freshGroups.length,
    stock: stockFollowUps.length,
    stockWanted,
  };
}

// ——— Template & ekspor ———

type Cell = string | number | null;

/** Isi template CSV aplikasi (`importTemplateRows`): judul kolom + contoh. */
export function templateRows(service: boolean): { header: string[]; rows: Cell[][] } {
  const fields = templateFields(service);
  const samples: Partial<Record<FieldKey, Cell>>[] = service
    ? [
        { name: "Potong rambut", category: "Layanan", price: 50000, cost: 10000, sku: "JS-001", unit: "pcs", trackStock: "tidak", taxable: "ya", duration: 30 },
        {
          name: "Pomade 100 g",
          category: "Produk",
          price: 85000,
          cost: 60000,
          sku: "PM-100",
          barcode: "8991234567890",
          unit: "pcs",
          trackStock: "ya",
          initialStock: 12,
          minStock: 3,
          taxable: "ya",
        },
      ]
    : [
        { name: "Es Teh Manis", category: "Minuman", price: 8000, cost: 2500, sku: "MNM-001", unit: "cup", trackStock: "tidak", taxable: "ya", description: "Teh melati, gula asli" },
        { name: "Kopi Susu", variant: "Reguler", category: "Minuman", price: 18000, cost: 7000, unit: "cup", taxable: "ya" },
        { name: "Kopi Susu", variant: "Large", category: "Minuman", price: 23000, cost: 9500, unit: "cup", taxable: "ya" },
        {
          name: "Air Mineral 600 ml",
          category: "Minuman",
          price: 5000,
          cost: 3000,
          sku: "MNM-002",
          barcode: "8991234567890;8991234567891",
          unit: "botol",
          trackStock: "ya",
          initialStock: 48,
          minStock: 12,
          taxable: "ya",
        },
      ];
  return { header: fields.map((f) => f.header), rows: samples.map((s) => fields.map((f) => s[f.key] ?? null)) };
}

/** Jumlah mili-satuan → sel CSV yang terbaca ulang oleh `parseQty` (bulat "12"; desimal pakai koma "0,5"). */
function qtyCell(milli: number | null | undefined): Cell {
  if (milli === null || milli === undefined) return null;
  if (milli % 1000 === 0) return milli / 1000;
  return formatQty(milli).replace(/\./g, "");
}

const yn = (b: boolean) => (b ? "ya" : "tidak");

/** Ekspor produk dengan kolom template aplikasi; produk bervarian = satu baris per varian (nama diulang, kolom `varian`). */
export function exportRows(
  data: CatalogSnapshot & { products: Product[] },
  service: boolean
): { header: string[]; rows: Cell[][] } {
  const fields = templateFields(service);
  const cats = new Map(data.categories.map((c) => [c.id, c.name]));
  const groupNames = new Map(data.groups.map((g) => [g.id, g.name]));
  const byProduct = new Map<string, Variant[]>();
  for (const v of data.variants) byProduct.set(v.product_id, [...(byProduct.get(v.product_id) ?? []), v]);
  const rows: Cell[][] = [];
  const list = [...data.products].sort((a, b) => a.name.localeCompare(b.name, "id"));
  for (const p of list) {
    const base: Partial<Record<FieldKey, Cell>> = {
      name: p.name,
      category: p.category_id ? (cats.get(p.category_id) ?? null) : null,
      price: p.price,
      cost: p.cost_price,
      sku: p.sku,
      barcode: allBarcodes(p).join(";") || null,
      unit: p.unit,
      trackStock: yn(p.track_stock),
      minStock: p.track_stock && p.min_stock ? qtyCell(p.min_stock) : null,
      taxable: yn(p.is_taxable),
      description: p.description || null,
      modifiers:
        (p.modifier_group_ids ?? [])
          .map((id) => groupNames.get(id))
          .filter(Boolean)
          .join(";") || null,
      duration: p.duration_min,
    };
    const variants = sortVariants(byProduct.get(p.id) ?? []);
    if (!variants.length) {
      rows.push(fields.map((f) => base[f.key] ?? null));
      continue;
    }
    for (const v of variants) {
      const r: Partial<Record<FieldKey, Cell>> = {
        ...base,
        variant: v.name,
        price: v.price,
        cost: v.cost_price,
        sku: v.sku,
        barcode: allBarcodes(v).join(";") || null,
        minStock: p.track_stock && v.min_stock ? qtyCell(v.min_stock) : null,
      };
      rows.push(fields.map((f) => r[f.key] ?? null));
    }
  }
  return { header: fields.map((f) => f.header), rows };
}
