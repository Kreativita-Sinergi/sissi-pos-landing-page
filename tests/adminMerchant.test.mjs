// Tes unit label & tingkat warna peta jam ramai admin (kontrak api.md "Admin platform — informasi merchant").
import assert from "node:assert/strict";
import { test } from "node:test";
import { heatLevel, hourRange, peakLabel, slotLabel } from "../src/lib/admin/merchant.ts";

test("slotLabel memetakan dow ISO dan jam", () => {
  assert.equal(slotLabel(1, 8), "Sen 08.00–09.00");
  assert.equal(slotLabel(6, 19), "Sab 19.00–20.00");
  assert.equal(slotLabel(7, 23), "Min 23.00–24.00");
});

test("peakLabel tanpa transaksi", () => {
  assert.equal(peakLabel(null), "—");
  assert.equal(peakLabel({ dow: 5, hour: 12, count: 3 }), "Jum 12.00–13.00");
});

test("heatLevel: kosong 0, ada transaksi minimal 1, tertinggi 5", () => {
  assert.equal(heatLevel(0, 0, 100), 0);
  assert.equal(heatLevel(0, 2, 100), 1); // nilai Rp0 (mis. refund penuh sebagian) tetap terlihat ada transaksi
  assert.equal(heatLevel(1, 1, 100), 1);
  assert.equal(heatLevel(50, 5, 100), 3);
  assert.equal(heatLevel(100, 9, 100), 5);
});

test("hourRange memangkas jam kosong tapi minimal 12 kolom", () => {
  assert.deepEqual(hourRange([]), []);
  assert.deepEqual(hourRange([{ hour: 8 }, { hour: 22 }]), [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  assert.equal(hourRange([{ hour: 12 }]).length, 12);
  assert.equal(hourRange([{ hour: 23 }]).at(-1), 23);
  assert.equal(hourRange([{ hour: 0 }]).at(0), 0);
  assert.equal(hourRange([{ hour: 0 }, { hour: 23 }]).length, 24);
});
