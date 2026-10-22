// Tes unit dasbor (2026-10-22): "Tutup kasir tanpa melihat angka sistem" aktif bawaan untuk kasir.
// Kontrak: sissi-pos-service/docs/api.md "Tutup buta bawaan (show_expected_cash, 2026-10-22)". Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { mergeSection, readTransaction } = await import("../src/lib/owner/settings.ts");

test("outlet lama (blind_close false, tanpa show_expected_cash) → buta", () => {
  const t = readTransaction({ transaction: { blind_close: false } });
  assert.equal(t.blind_close, true);
  assert.equal(t.show_expected_cash, false);
  assert.equal(readTransaction({}).blind_close, true);
});

test("pemilik mengizinkan (show_expected_cash true) → tidak buta", () => {
  const t = readTransaction({ transaction: { blind_close: false, show_expected_cash: true } });
  assert.equal(t.blind_close, false);
  assert.equal(t.show_expected_cash, true);
});

test("blind_close true dari app lama tetap menang", () => {
  const t = readTransaction({ transaction: { blind_close: true, show_expected_cash: true } });
  assert.equal(t.blind_close, true);
});

test("simpan menulis kedua kunci dan mempertahankan kunci lain", () => {
  const settings = { transaction: { blind_close: false, pin_for_discount: true } };
  const draft = { ...readTransaction(settings), blind_close: false, show_expected_cash: true };
  const merged = mergeSection(settings, "transaction", draft);
  assert.equal(merged.transaction.blind_close, false);
  assert.equal(merged.transaction.show_expected_cash, true);
  assert.equal(merged.transaction.pin_for_discount, true);
});
