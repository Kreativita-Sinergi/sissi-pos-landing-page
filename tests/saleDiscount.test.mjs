// Tes unit dasbor (2026-10-21 rev. 2): alasan diskon per baris di rincian transaksi dan penanda "Diskon tanpa
// persetujuan" (penegakan server `transaction.pin_for_discount`).
// Kontrak: sissi-pos-service/docs/api.md "Alasan diskon baris & DP pesanan berjalan (2026-10-21)" dan
// "Persetujuan diskon kasir (pin_for_discount, 2026-10-21 rev. 2)". Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { discountApprover, isDiscountUnapproved, lineDiscountReason } = await import("../src/lib/owner/saleDiscount.ts");
const { ACTIVITY_KIND, ACTIVITY_KINDS } = await import("../src/components/owner/labels.ts");

test("alasan diskon baris: hanya baris berdiskon dengan alasan tidak kosong", () => {
  assert.equal(lineDiscountReason({ discount: 2000, discount_reason: "  Teman pemilik " }), "Teman pemilik");
  assert.equal(lineDiscountReason({ discount: 2000, discount_reason: "   " }), null);
  assert.equal(lineDiscountReason({ discount: 2000 }), null); // server lama: tanpa field
  assert.equal(lineDiscountReason({ discount: 2000, discount_reason: null }), null);
  // Alasan tanpa diskon (diskon baris dihapus) tidak ditampilkan.
  assert.equal(lineDiscountReason({ discount: 0, discount_reason: "Lama" }), null);
});

test("penanda diskon tanpa persetujuan & nama penyetuju (server lama: tidak ada)", () => {
  assert.equal(isDiscountUnapproved({ discount_unapproved: true }), true);
  assert.equal(isDiscountUnapproved({ discount_unapproved: false }), false);
  assert.equal(isDiscountUnapproved({}), false);
  assert.equal(discountApprover({ discount_approved_by_name: " Rina " }), "Rina");
  assert.equal(discountApprover({ discount_approved_by_name: null }), null);
  assert.equal(discountApprover({}), null);
});

test("log aktivitas mengenal jenis discount_unapproved", () => {
  assert.ok(ACTIVITY_KINDS.includes("discount_unapproved"));
  assert.equal(ACTIVITY_KIND.discount_unapproved, "Diskon tanpa persetujuan");
});
