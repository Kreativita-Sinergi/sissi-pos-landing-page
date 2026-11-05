// PIN terpisah (2026-11-05): pin_for_order_edit tidak ada → mengikuti pin_for_void. Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { mergeSection, readTransaction } = await import("../src/lib/owner/settings.ts");

test("pin_for_order_edit tanpa kunci mengikuti pin_for_void", () => {
  assert.equal(readTransaction({}).pin_for_order_edit, true);
  assert.equal(readTransaction({ transaction: { pin_for_void: false } }).pin_for_order_edit, false);
  assert.equal(readTransaction({ transaction: { pin_for_void: false, pin_for_order_edit: true } }).pin_for_order_edit, true);
});

test("simpan menulis kedua kunci", () => {
  const draft = readTransaction({ transaction: { pin_for_void: false } });
  const saved = mergeSection({}, "transaction", draft);
  assert.equal(saved.transaction.pin_for_void, false);
  assert.equal(saved.transaction.pin_for_order_edit, false);
});
