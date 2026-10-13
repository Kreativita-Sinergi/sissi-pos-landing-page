// Impor Excel multi-lembar — port `sissi-app/lib/features/products/models/import_workbook.dart` (template Sissi atau
// ekspor POS lain). Lembar dikenali dari JUDUL KOLOM, bukan nama lembar (nama lembar hanya petunjuk cadangan untuk
// lembar bahan):
// - Produk — kolom nama + harga (sama dengan CSV, lihat `IMPORT_FIELDS`).
// - Varian — nama produk + nama varian (+ harga, modal, SKU, barcode).
// - Bahan baku — nama bahan (+ satuan, harga beli, isi kemasan, stok min).
// - Resep — nama produk + nama bahan + jumlah (+ varian, satuan).
// - Pilihan ekstra — grup + nama pilihan (+ harga, pilih satu).
// - Penghubung — nama produk + grup pilihan ekstra.
// Baris lembar tambahan dikaitkan ke produk lewat NAMA (tanpa beda huruf besar/kecil). Yang tidak bisa dikaitkan/tidak
// sah menjadi `ImportNote` (ditampilkan di pratinjau, tidak menggagalkan impor). Modul ini murni (tanpa zip): pembaca
// .xlsx ada di `xlsx.ts` dan dimuat dinamis oleh `readImportXlsx`.
import { parseQty } from "./catalog";
import {
  addVariant,
  failedImport,
  fieldFromHeader,
  FILE_ERRORS,
  IMPORT_EXTRA_LIMITS,
  IMPORT_LIMITS,
  importHeaderKey,
  normalizeMaterialUnit,
  parseImportBool,
  parseImportMoney,
  parseImportRows,
  templateFields,
  type CsvRow,
  type FieldKey,
  type ImportFile,
  type ImportMaterial,
  type ImportModifierGroup,
  type ImportNote,
  type ImportRow,
  type MaterialIssue,
  type SheetKind,
} from "./productImport";
import type { XlsxCell, XlsxSheet, XlsxSheetData } from "./xlsx";

// ——— Peran kolom lembar tambahan (`ImportRole`) ———

type Role = "product" | "variant" | "price" | "cost" | "sku" | "barcode" | "material" | "unit" | "qty" | "packSize" | "minStock" | "group" | "option" | "singleChoice";

const ROLE_ALIASES: [Role, string[]][] = [
  ["product", ["nama_produk", "produk", "nama", "product", "product_name", "nama_barang", "nama_item", "item", "item_name", "nama_menu", "menu"]],
  ["variant", ["nama_varian", "varian", "variant", "variant_name", "variasi", "nama_variasi", "option1_value"]],
  [
    "price",
    [
      "harga", "harga_jual", "price", "harga_varian", "variant_price", "harga_pilihan", "harga_opsi", "harga_ekstra", "harga_tambahan",
      "modifier_price", "option_price", "selling_price", "sell_price", "sale_price",
    ],
  ],
  [
    "cost",
    [
      "modal", "harga_modal", "harga_beli", "hpp", "cost", "cost_price", "harga_pokok", "purchase_price", "buy_price", "harga_bahan", "avg_cost",
      "cost_per_item", "harga_beli_per_kemasan",
    ],
  ],
  ["sku", ["sku", "kode", "kode_sku", "kode_bahan", "kode_barang", "variant_sku", "item_code"]],
  ["barcode", ["barcode", "kode_barcode", "variant_barcode"]],
  [
    "material",
    ["nama_bahan", "bahan", "bahan_baku", "nama_bahan_baku", "ingredient", "ingredient_name", "ingredients", "material", "raw_material", "material_name", "nama_material"],
  ],
  ["unit", ["satuan", "unit", "uom", "satuan_bahan", "satuan_resep", "unit_name"]],
  ["qty", ["qty_dibutuhkan", "jumlah", "qty", "takaran", "kebutuhan", "quantity", "jumlah_dibutuhkan", "jumlah_bahan", "qty_bahan", "amount", "pemakaian"]],
  ["packSize", ["isi_kemasan", "isi", "isi_per_kemasan", "pack_size", "ukuran_kemasan", "netto", "isi_bersih"]],
  ["minStock", ["stok_min", "stok_minimum", "minimum_stok", "min_stock", "stok_minimal", "minimal_stok", "minimum_stock", "batas_stok"]],
  [
    "group",
    [
      "grup", "grup_pilihan_ekstra", "nama_kelompok_pilihan_ekstra", "kelompok_pilihan_ekstra", "pilihan_ekstra", "kelompok", "nama_kelompok",
      "grup_modifier", "modifier_group", "modifier_group_name", "nama_grup", "group", "group_name", "add_on_group", "grup_ekstra", "kelompok_ekstra",
      "grup_topping", "modifier_set",
    ],
  ],
  [
    "option",
    [
      "pilihan", "nama_pilihan", "opsi", "nama_opsi", "modifier", "modifier_name", "option", "option_name", "add_on", "nama_ekstra", "ekstra", "topping",
      "nama_topping", "modifier_option",
    ],
  ],
  ["singleChoice", ["pilih_satu", "hanya_pilih_satu", "pelanggan_hanya_bisa_pilih_satu_ekstra", "single_choice", "single_select", "pilihan_tunggal", "satu_pilihan"]],
];

function roleOf(header: string): Role | null {
  const h = importHeaderKey(header);
  for (const [r, aliases] of ROLE_ALIASES) if (aliases.includes(h)) return r;
  return null;
}

/** Lembar dengan peran kolomnya. */
class Sheet {
  readonly roles = new Map<Role, number>();
  readonly fields = new Set<FieldKey>();
  constructor(readonly source: XlsxSheet) {
    (source.rows[0]?.cells ?? []).forEach((h, i) => {
      const r = roleOf(h);
      if (r && !this.roles.has(r)) this.roles.set(r, i);
      const f = fieldFromHeader(h);
      if (f) this.fields.add(f);
    });
  }
  get name() {
    return this.source.name;
  }
  get data(): CsvRow[] {
    return this.source.rows.slice(1);
  }
  has(r: Role) {
    return this.roles.has(r);
  }
  get isProductCandidate() {
    return this.fields.has("name") && this.fields.has("price");
  }
  cell(row: CsvRow, role: Role): string | null {
    const i = this.roles.get(role);
    if (i === undefined || i >= row.cells.length) return null;
    const v = row.cells[i].trim().replace(/\s+/g, " ");
    return v ? v : null;
  }
}

function classify(s: Sheet): SheetKind | null {
  const name = importHeaderKey(s.name);
  const materialHint = /bahan|ingredient|material|inventor/.test(name) && !/komposisi|resep|recipe/.test(name);
  if (s.has("material") && s.has("product") && s.has("qty")) return "recipes";
  if (s.has("group") && s.has("option")) return "modifiers";
  if (s.has("material") && !s.has("product")) return "materials";
  if (materialHint && s.has("product") && !s.has("qty") && !s.has("group")) return "materials";
  if (s.has("product") && s.has("group") && !s.fields.has("price")) return "modifierLinks";
  return null;
}

/**
 * Membaca berkas .xlsx untuk impor (memuat `xlsx.ts` + fflate secara dinamis). Angka desimal Excel ditulis dengan koma
 * (seperti CSV Excel berlokal Indonesia) agar `0.5` tidak terbaca "5 ribu" oleh `parseQty`/`parseImportMoney`.
 */
export async function readImportXlsx(bytes: Uint8Array, service: boolean): Promise<ImportFile> {
  const { readXlsx } = await import("./xlsx");
  return parseImportWorkbook(readXlsx(bytes, ","), service);
}

/** Membaca Excel: lembar produk diurai seperti CSV, lembar lain dikaitkan ke produk berkas lewat nama. */
export function parseImportWorkbook(workbook: XlsxSheet[], service: boolean): ImportFile {
  const sheets = workbook.filter((s) => s.rows.length).map((s) => new Sheet(s));
  if (!sheets.length) return failedImport(FILE_ERRORS.empty);
  if (sheets.length === 1) return parseImportRows(sheets[0].source.rows, service);

  const kinds = new Map<Sheet, SheetKind>();
  for (const s of sheets) {
    const k = classify(s);
    if (k) kinds.set(s, k);
  }
  const candidates = sheets.filter((s) => !kinds.has(s) && s.isProductCandidate);
  const product = candidates.find((s) => !s.has("variant")) ?? candidates[0];
  if (!product) return failedImport(FILE_ERRORS.noProductSheet);
  kinds.set(product, "products");
  for (const s of sheets) if (!kinds.has(s) && s.has("product") && s.has("variant")) kinds.set(s, "variants");
  for (const s of sheets) {
    if (kinds.get(s) !== "products" && kinds.has(s) && s.data.length > IMPORT_LIMITS.maxExtraRows) {
      return failedImport(`Lembar "${s.name}" lebih dari ${IMPORT_LIMITS.maxExtraRows.toLocaleString("id-ID")} baris. Bagi menjadi beberapa berkas.`);
    }
  }

  const file = parseImportRows(product.source.rows, service);
  if (file.error) return file;

  const byName = new Map<string, ImportRow>();
  for (const r of file.rows) if (r.name && !byName.has(r.name.toLowerCase())) byName.set(r.name.toLowerCase(), r);
  const notes: ImportNote[] = [];
  const productOf = (s: Sheet, row: CsvRow): ImportRow | null => {
    const name = s.cell(row, "product");
    if (name === null) {
      notes.push({ sheet: s.name, line: row.line, code: "missingValue" });
      return null;
    }
    const hit = byName.get(name.toLowerCase());
    if (!hit) notes.push({ sheet: s.name, line: row.line, code: "productMissing", detail: name });
    return hit ?? null;
  };
  const of = (k: SheetKind) => sheets.filter((s) => kinds.get(s) === k);
  const code = (v: string | null) => (v !== null && v.length <= IMPORT_LIMITS.codeLength ? v : null);

  // Bahan baku dulu: resep membutuhkan satuannya.
  const materials: ImportMaterial[] = [];
  for (const s of of("materials")) {
    const nameRole: Role = s.has("material") ? "material" : "product";
    for (const row of s.data) {
      const name = s.cell(row, nameRole);
      if (name === null) continue;
      if (name.length > IMPORT_EXTRA_LIMITS.nameLength) {
        notes.push({ sheet: s.name, line: row.line, code: "tooLong" });
        continue;
      }
      if (materials.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
        notes.push({ sheet: s.name, line: row.line, code: "duplicate", detail: name });
        continue;
      }
      const issues: MaterialIssue[] = [];
      const rawUnit = s.cell(row, "unit");
      const unit = normalizeMaterialUnit(rawUnit);
      if (unit === null) issues.push("unitAssumed");
      const costText = s.cell(row, "cost") ?? s.cell(row, "price");
      const cost = costText === null ? null : parseImportMoney(costText);
      if (costText !== null && cost === null) issues.push("costInvalid");
      const packText = s.cell(row, "packSize");
      const pack = packText === null ? null : parseQty(packText);
      if (packText !== null && (pack === null || pack <= 0)) issues.push("packInvalid");
      materials.push({
        line: row.line,
        name,
        unit: unit ?? "pcs",
        rawUnit,
        cost,
        pack: pack !== null && pack > 0 ? pack : null,
        minStock: parseQty(s.cell(row, "minStock") ?? "") ?? 0,
        sku: code(s.cell(row, "sku")),
        issues,
      });
    }
  }

  for (const s of of("variants")) {
    for (const row of s.data) {
      const target = productOf(s, row);
      if (!target) continue;
      const name = s.cell(row, "variant");
      if (name === null) {
        notes.push({ sheet: s.name, line: row.line, code: "missingValue" });
        continue;
      }
      const priceText = s.cell(row, "price");
      const price = priceText === null ? target.price : parseImportMoney(priceText);
      const costText = s.cell(row, "cost");
      const cost = costText === null ? null : parseImportMoney(costText);
      const barcodes = (s.cell(row, "barcode") ?? "")
        .split(/[;|,]/)
        .map((b) => b.trim())
        .filter((b) => b && b.length <= IMPORT_LIMITS.codeLength);
      addVariant(
        target,
        { line: row.line, name, price: price ?? 0, cost, sku: code(s.cell(row, "sku")), barcodes, initialStock: null, minStock: null },
        price === null || price > IMPORT_LIMITS.maxPrice || (costText !== null && cost === null)
      );
    }
  }

  for (const s of of("recipes")) {
    for (const row of s.data) {
      const target = productOf(s, row);
      if (!target) continue;
      const material = s.cell(row, "material");
      if (material === null) {
        notes.push({ sheet: s.name, line: row.line, code: "missingValue" });
        continue;
      }
      const qty = parseQty(s.cell(row, "qty") ?? "");
      if (qty === null || qty <= 0) {
        notes.push({ sheet: s.name, line: row.line, code: "invalidQty", detail: material });
        continue;
      }
      target.recipe.push({ line: row.line, material, qty, variant: s.cell(row, "variant"), givenUnit: normalizeMaterialUnit(s.cell(row, "unit")), unit: null });
    }
  }

  const groups: ImportModifierGroup[] = [];
  for (const s of of("modifiers")) {
    for (const row of s.data) {
      const groupName = s.cell(row, "group");
      const option = s.cell(row, "option");
      if (groupName === null) {
        if (option !== null) notes.push({ sheet: s.name, line: row.line, code: "missingValue" });
        continue;
      }
      if (groupName.length > IMPORT_EXTRA_LIMITS.groupNameLength) {
        notes.push({ sheet: s.name, line: row.line, code: "tooLong", detail: groupName });
        continue;
      }
      let group = groups.find((g) => g.name.toLowerCase() === groupName.toLowerCase());
      if (!group) {
        group = { line: row.line, name: groupName, singleChoice: null, options: [], usedBy: 0 };
        groups.push(group);
      }
      const single = s.cell(row, "singleChoice");
      if (group.singleChoice === null && single !== null) group.singleChoice = parseImportBool(single);
      // "-" dsb. = penanda "tanpa pilihan" di POS lain: lewati diam-diam.
      if (option === null || /^[\W_]+$/.test(option)) continue;
      if (option.length > IMPORT_EXTRA_LIMITS.groupNameLength) {
        notes.push({ sheet: s.name, line: row.line, code: "tooLong", detail: option });
        continue;
      }
      const priceText = s.cell(row, "price");
      const price = priceText === null ? 0 : parseImportMoney(priceText);
      if (price === null || price > IMPORT_LIMITS.maxPrice) {
        notes.push({ sheet: s.name, line: row.line, code: "invalidPrice", detail: option });
        continue;
      }
      if (group.options.some((o) => o.name.toLowerCase() === option.toLowerCase())) {
        notes.push({ sheet: s.name, line: row.line, code: "duplicate", detail: option });
        continue;
      }
      if (group.options.length >= IMPORT_EXTRA_LIMITS.options) {
        notes.push({ sheet: s.name, line: row.line, code: "tooManyOptions", detail: group.name });
        continue;
      }
      group.options.push({ name: option, price });
    }
  }
  for (const g of groups) if (!g.options.length) notes.push({ sheet: of("modifiers")[0].name, line: g.line, code: "emptyGroup", detail: g.name });

  for (const s of of("modifierLinks")) {
    for (const row of s.data) {
      const group = s.cell(row, "group");
      if (group === null) continue;
      const target = productOf(s, row);
      if (!target) continue;
      if (!target.groupNames.some((n) => n.toLowerCase() === group.toLowerCase())) target.groupNames.push(group);
    }
  }
  for (const g of groups) g.usedBy = file.rows.filter((r) => r.groupNames.some((n) => n.toLowerCase() === g.name.toLowerCase())).length;

  const sheetsByKind: Partial<Record<SheetKind, string[]>> = {};
  for (const k of ["products", "variants", "materials", "recipes", "modifiers", "modifierLinks"] as SheetKind[]) {
    const list = of(k);
    if (list.length) sheetsByKind[k] = list.map((s) => s.name);
  }
  return {
    ...file,
    extras: {
      materials,
      modifierGroups: groups,
      notes,
      productSheet: product.name,
      sheets: sheetsByKind,
      // Daftar kategori saja tidak dianggap diabaikan: kategori dibuat dari kolom produk.
      ignoredSheets: sheets
        .filter((s) => !kinds.has(s) && s.data.length && !(s.fields.size && [...s.fields].every((f) => f === "category")))
        .map((s) => s.name),
    },
  };
}

// ——— Template Excel (`importWorkbookTemplate`) ———

/** Template Excel lengkap: Produk, Varian, Bahan, Resep, Pilihan Ekstra (lembar & kolom sama dengan aplikasi). */
export function importWorkbookTemplate(service: boolean): XlsxSheetData[] {
  const fields = templateFields(service, true);
  const samples: Partial<Record<FieldKey, XlsxCell>>[] = service
    ? [
        { name: "Potong rambut", category: "Layanan", price: 50000, unit: "pcs", trackStock: "tidak", taxable: "ya", modifiers: "Tambahan", duration: 30 },
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
        {
          name: "Es Kopi Susu",
          category: "Minuman",
          price: 18000,
          unit: "cup",
          trackStock: "tidak",
          taxable: "ya",
          description: "Espresso, susu segar, gula aren",
          modifiers: "Topping",
        },
        { name: "Nasi Goreng", category: "Makanan", price: 25000, unit: "porsi", trackStock: "tidak", taxable: "ya", modifiers: "Level Pedas" },
        {
          name: "Air Mineral 600 ml",
          category: "Minuman",
          price: 5000,
          cost: 3000,
          sku: "MNM-002",
          barcode: "8991234567890",
          unit: "botol",
          trackStock: "ya",
          initialStock: 48,
          minStock: 12,
          taxable: "ya",
        },
      ];
  const first = service ? "Potong rambut" : "Es Kopi Susu";
  return [
    { name: "Produk", rows: [fields.map((f) => f.header), ...samples.map((s) => fields.map((f) => s[f.key] ?? null))] },
    {
      name: "Varian",
      rows: [
        ["nama_produk", "varian", "harga", "modal", "sku", "barcode"],
        ...(service
          ? [
              [first, "Dewasa", 50000],
              [first, "Anak", 35000],
            ]
          : [
              [first, "Reguler", 18000, 7000],
              [first, "Large", 23000, 9500],
            ]),
      ],
    },
    {
      name: "Bahan",
      rows: [
        ["nama_bahan", "satuan", "harga_beli", "isi_kemasan", "stok_min", "sku"],
        ...(service
          ? [
              ["Shampo", "ml", 90000, 1000, 500],
              ["Handuk sekali pakai", "pcs", 50000, 100, 20],
            ]
          : [
              ["Susu segar", "ml", 20000, 1000, 2000],
              ["Kopi bubuk", "g", 150000, 1000, 500],
              ["Gula aren cair", "ml", 45000, 1000, 500],
              ["Cup plastik", "pcs", 50000, 100, 50],
              ["Beras", "kg", 14000, 1, 5],
            ]),
      ],
    },
    {
      name: "Resep",
      rows: [
        ["nama_produk", "varian", "nama_bahan", "jumlah", "satuan"],
        ...(service
          ? [
              [first, "Dewasa", "Shampo", 15, "ml"],
              [first, "Dewasa", "Handuk sekali pakai", 1, "pcs"],
              [first, "Anak", "Shampo", 10, "ml"],
              [first, "Anak", "Handuk sekali pakai", 1, "pcs"],
            ]
          : [
              [first, "Reguler", "Susu segar", 120, "ml"],
              [first, "Reguler", "Kopi bubuk", 18, "g"],
              [first, "Reguler", "Gula aren cair", 20, "ml"],
              [first, "Reguler", "Cup plastik", 1, "pcs"],
              [first, "Large", "Susu segar", 180, "ml"],
              [first, "Large", "Kopi bubuk", 24, "g"],
              [first, "Large", "Gula aren cair", 30, "ml"],
              [first, "Large", "Cup plastik", 1, "pcs"],
              ["Nasi Goreng", null, "Beras", 150, "g"],
            ]),
      ],
    },
    {
      name: "Pilihan Ekstra",
      rows: [
        ["grup", "pilih_satu", "pilihan", "harga"],
        ...(service
          ? [
              ["Tambahan", "tidak", "Cuci rambut", 15000],
              ["Tambahan", "tidak", "Pijat kepala", 20000],
            ]
          : [
              ["Topping", "tidak", "Boba", 5000],
              ["Topping", "tidak", "Cheese foam", 6000],
              ["Level Pedas", "ya", "Tidak pedas", 0],
              ["Level Pedas", "ya", "Pedas", 0],
              ["Level Pedas", "ya", "Extra pedas", 2000],
            ]),
      ],
    },
  ];
}

/** Unduh template Excel (memuat penulis .xlsx secara dinamis). */
export async function downloadImportXlsxTemplate(service: boolean) {
  const { downloadXlsx } = await import("./xlsx");
  downloadXlsx("template-impor-produk.xlsx", importWorkbookTemplate(service));
}
