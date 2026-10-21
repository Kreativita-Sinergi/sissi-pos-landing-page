// Tes unit dasbor (2026-10-21): pengaturan struk mempertahankan kunci `receipt` dari aplikasi (logo & ukuran kertas)
// saat disimpan dari web, dan membaca preset kertas + logo secara toleran.
// Kontrak: sissi-pos-service/docs/api.md "Struk satu sumber: logo & ukuran kertas (2026-10-21)". Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { mergeReceipt, paperLabel, readReceipt, readReceiptLogo, readReceiptPaper } = await import("../src/lib/owner/settings.ts");

const LOGO = "https://apipos.sissi.id/files/0192a7c4-aaaa-7000-8000-000000000001/0192a7c4-cccc-7000-8000-000000000003.png";
const stored = {
  rounding: { enabled: true, unit: 500 },
  receipt: {
    header: "Lama",
    footer: "",
    instagram: "",
    paper_mm: 58,
    show_logo: true,
    show_tax_rate: true,
    merchant_copy: true,
    merchant_copy_style: "compact",
    logo_url: LOGO,
    logo_style: "dither",
    paper: { preset: "58b", columns: 42, dots: 384, font: "b" },
    kunci_versi_depan: { x: 1 },
  },
};

test("simpan struk dari web: kunci receipt dari aplikasi tetap utuh", () => {
  const draft = { ...readReceipt(stored), header: "  Baru  ", instagram: "@@kopi", show_logo: false };
  const out = mergeReceipt(stored, draft);
  assert.deepEqual(out.rounding, stored.rounding);
  assert.equal(out.receipt.header, "Baru");
  assert.equal(out.receipt.instagram, "kopi");
  assert.equal(out.receipt.show_logo, false);
  assert.equal(out.receipt.logo_url, LOGO);
  assert.equal(out.receipt.logo_style, "dither");
  assert.deepEqual(out.receipt.paper, stored.receipt.paper);
  assert.equal(out.receipt.merchant_copy_style, "compact");
  assert.deepEqual(out.receipt.kunci_versi_depan, { x: 1 });
  // Web tidak pernah menulis logo_url sendiri.
  assert.equal("logo_url" in draft, false);
});

test("ganti 58↔80 di web: paper diselaraskan ke preset dasar ukuran baru", () => {
  const out = mergeReceipt(stored, { ...readReceipt(stored), paper_mm: 80 });
  assert.equal(out.receipt.paper_mm, 80);
  assert.deepEqual(out.receipt.paper, { preset: "80", columns: 48, dots: 576, font: "a" });
  // Ukuran sama → paper (huruf kecil) dipertahankan; tanpa paper tersimpan → tidak ditambahkan.
  assert.deepEqual(mergeReceipt(stored, readReceipt(stored)).receipt.paper, stored.receipt.paper);
  const legacy = { receipt: { paper_mm: 58 } };
  assert.equal("paper" in mergeReceipt(legacy, { ...readReceipt(legacy), paper_mm: 80 }).receipt, false);
});

test("baca preset kertas: tabel, Lainnya, rusak, dan rekonsiliasi paper_mm", () => {
  assert.deepEqual(readReceiptPaper(stored), { preset: "58b", columns: 42, dots: 384, font: "b" });
  assert.equal(paperLabel(readReceiptPaper(stored)), "58 mm, huruf kecil · 42 kolom");
  // Preset dikenal memakai nilai tabel, bukan cermin yang dikirim.
  assert.equal(readReceiptPaper({ receipt: { paper_mm: 58, paper: { preset: "44", columns: 99 } } }).columns, 24);
  const custom = { receipt: { paper_mm: 80, paper: { preset: "custom", columns: 56, dots: 560, font: "b" } } };
  assert.equal(paperLabel(readReceiptPaper(custom)), "Lainnya, huruf kecil · 56 kolom");
  assert.equal(readReceiptPaper({ receipt: { paper: { preset: "custom", columns: 70, dots: 384 } } }), null);
  assert.equal(readReceiptPaper({ receipt: { paper: "58" } }), null);
  assert.equal(readReceiptPaper({}), null);
  // App/web lama mengubah paper_mm ke 80 tanpa mengenal paper → paper_mm menang.
  assert.equal(readReceiptPaper({ receipt: { paper_mm: 80, paper: { preset: "58b" } } }), null);
});

test("baca logo: kosong/null/bukan teks = tanpa logo", () => {
  assert.equal(readReceiptLogo(stored), LOGO);
  assert.equal(readReceiptLogo({ receipt: { logo_url: "" } }), "");
  assert.equal(readReceiptLogo({ receipt: { logo_url: null } }), "");
  assert.equal(readReceiptLogo({ receipt: { logo_url: 5 } }), "");
  assert.equal(readReceiptLogo({}), "");
});
