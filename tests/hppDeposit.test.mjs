// Tes unit penyelarasan dasbor dengan app (2026-10-21): resep per adonan & susut (HPP tahap 4, cermin
// `core/stock/recipe_batch.dart` + impor Excel app) dan pembatalan DP reservasi (D10 `SaleRepository.cancel`).
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { deriveRecipeItems, freshBatch, parseRecipeBatch, portionQtyOf, recipeItemsPatch } = await import("../src/lib/owner/productForm.ts");
const { cancelChange, isDepositRefund } = await import("../src/lib/owner/cancelSale.ts");
const { recipeTargets, targetBatch, wastePercentBp } = await import("../src/lib/owner/productImport.ts");

// Contoh catatan app: 1.500 g bersih sekali masak, hasil 10 porsi, susut 20% → 187,5 g kotor per porsi.
const BATCH = { yield_qty: 10_000, items: [{ raw_material_id: "m1", qty: 1_500_000, unit: "g", waste_bp: 2000 }] };

test("takaran per porsi = round_half_up(bersih × 10.000 × 1.000 ÷ ((10.000 − susut) × hasil))", () => {
  assert.equal(portionQtyOf(1_500_000, 2000, 10_000), 187_500);
  assert.equal(portionQtyOf(1_000, 0, 3_000), 333); // 0,333… dibulatkan
  assert.equal(portionQtyOf(2_000, 0, 3_000), 667); // 0,666… setengah ke atas
  assert.equal(portionQtyOf(1, 0, 1_000_000), 0); // terlalu kecil per porsi
  assert.equal(portionQtyOf(1_000, 10_000, 1_000), 0); // susut tidak sah
  assert.deepEqual(deriveRecipeItems(BATCH), [{ raw_material_id: "m1", qty: 187_500, unit: "g" }]);
});

test("batch segar vs basi (diubah klien yang hanya mengirim items)", () => {
  const items = [{ raw_material_id: "m1", qty: 187_500, unit: "g" }];
  assert.deepEqual(freshBatch({ items, batch: BATCH }), BATCH);
  assert.equal(freshBatch({ items: [{ ...items[0], qty: 200_000 }], batch: BATCH }), null);
  assert.equal(freshBatch({ items, batch: null }), null);
  // Toleran seperti app: susut dijepit 0–9000, bahan tanpa id dilewati, bentuk asing = null.
  assert.deepEqual(parseRecipeBatch({ yield_qty: 1000, items: [{ raw_material_id: "", qty: 1 }, { raw_material_id: "a", qty: 5, waste_bp: 99999 }] }), {
    yield_qty: 1000,
    items: [{ raw_material_id: "a", qty: 5, unit: "g", waste_bp: 9000 }],
  });
  assert.equal(parseRecipeBatch("x"), null);
});

test("edit resep dari web membuang catatan per adonan (tidak meninggalkan batch basi)", () => {
  const items = [{ raw_material_id: "m1", qty: 150_000, unit: "g" }];
  assert.deepEqual(recipeItemsPatch({ batch: BATCH }, items), { items, batch: null });
  assert.deepEqual(recipeItemsPatch({ batch: null }, items), { items });
  assert.deepEqual(recipeItemsPatch({}, items), { items });
});

test("impor: susut_persen & hasil_porsi", () => {
  assert.equal(wastePercentBp("35"), 3500);
  assert.equal(wastePercentBp("12,5%"), 1250);
  assert.equal(wastePercentBp("0"), 0);
  assert.equal(wastePercentBp("0,35"), null); // ambigu (sel persen Excel) — tidak ditebak
  assert.equal(wastePercentBp("95"), null); // > 90%
  assert.equal(wastePercentBp("abc"), null);

  const lines = [
    { line: 2, material: "Beras", qty: 1_500_000, variant: null, givenUnit: "g", unit: "g", yieldQty: 10_000 },
    { line: 3, material: "Bawang merah", qty: 200_000, variant: null, givenUnit: "g", unit: "g", yieldQty: 10_000 },
    { line: 4, material: "beras", qty: 500_000, variant: null, givenUnit: "g", unit: "g", yieldQty: null },
  ];
  const [t] = recipeTargets(lines);
  assert.equal(t.yieldQty, 10_000);
  assert.equal(t.mixedYield, true); // baris tanpa hasil ikut dianggap takaran adonan
  assert.deepEqual(t.items, [
    { material: "Beras", qty: 2_000_000, unit: "g" },
    { material: "Bawang merah", qty: 200_000, unit: "g" },
  ]);
  const b = targetBatch(t, (m) => ({ beras: "b1", "bawang merah": "b2" })[m.toLowerCase()], (m) => (m === "Bawang merah" ? 1000 : 0));
  assert.deepEqual(b, {
    yield_qty: 10_000,
    items: [
      { raw_material_id: "b1", qty: 2_000_000, unit: "g", waste_bp: 0 },
      { raw_material_id: "b2", qty: 200_000, unit: "g", waste_bp: 1000 },
    ],
  });
  assert.deepEqual(deriveRecipeItems(b).map((i) => i.qty), [200_000, 22_222]);
  // Tanpa hasil_porsi = resep per porsi (tanpa batch).
  assert.equal(targetBatch(recipeTargets([{ ...lines[0], yieldQty: null }])[0], () => "b1", () => 0), null);
});

test("Kembalikan DP: pengembalian ber-deposit_refund + re-date tanpa shift (hanya transaksi DP open)", () => {
  const now = new Date("2026-10-21T03:00:00Z");
  const input = { kind: "void", reason: "Pelanggan batal", refunds: [{ from: "qris", method: "qris", amount: 50_000 }] };
  const dp = { id: "s1", outlet_id: "o1", updated_at: "2026-10-20T01:00:00Z", status: "open", reservation_id: "r1" };
  assert.equal(isDepositRefund(dp), true);
  const c = cancelChange(dp, input, "owner", now);
  assert.equal(c.data.paid_at, now.toISOString());
  assert.equal(c.data.shift_id, null);
  assert.equal(c.data.payments[0].purpose, "deposit_refund");
  assert.equal(c.data.payments[0].amount, -50_000);

  // Transaksi reservasi yang sudah ditagih = pembatalan biasa (tanggal omzet tetap).
  const billed = cancelChange({ ...dp, status: "paid" }, input, "owner", now);
  assert.equal("paid_at" in billed.data, false);
  assert.equal("purpose" in billed.data.payments[0], false);
  const plain = cancelChange({ ...dp, reservation_id: null }, input, "owner", now);
  assert.equal("purpose" in plain.data.payments[0], false);
});
