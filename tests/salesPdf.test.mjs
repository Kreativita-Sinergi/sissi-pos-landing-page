// Tes unit ringkasan ekspor PDF Transaksi: rumus sama dengan laporan server (api.md "Laporan penjualan") —
// penjualan = lunas + kasbon sesudah refund sebagian, batal/refund penuh terpisah, pesanan berjalan tidak dihitung.
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { summaryFromRows, summaryFromReport, dayLabel } = await import("../src/lib/owner/salesPdf.ts");
const { setOwnerZone } = await import("../src/lib/owner/tz.ts");
setOwnerZone("Asia/Jakarta");

const sale = (o) => ({
  id: o.id,
  receipt_no: o.id,
  paid_at: o.at ?? "2026-11-05T03:00:00Z",
  outlet_id: "o1",
  outlet_name: "Dago",
  cashier_id: o.cashier ?? "c1",
  cashier_name: o.cashier === "c2" ? "Budi" : "Rani",
  customer_name: null,
  table_name: null,
  order_type: null,
  status: o.status ?? "paid",
  payment_method: o.method ?? "cash",
  total: o.total,
  paid_total: o.total,
  items_count: 1,
  refunded_total: o.refunded ?? 0,
});

test("rows: penjualan = lunas + kasbon sesudah refund sebagian; batal terpisah; berjalan diabaikan", () => {
  const s = summaryFromRows(
    [
      sale({ id: "a", total: 50_000 }),
      sale({ id: "b", total: 30_000, refunded: 10_000, method: "qris" }),
      sale({ id: "c", total: 20_000, status: "unpaid", method: "credit", cashier: "c2" }),
      sale({ id: "d", total: 40_000, status: "void", cashier: "c2" }),
      sale({ id: "e", total: 15_000, status: "refunded" }),
      sale({ id: "f", total: 99_000, status: "open" }),
    ],
    false
  );
  assert.equal(s.source, "rows");
  assert.equal(s.transactions, 3);
  assert.equal(s.revenue, 50_000 + 20_000 + 20_000);
  assert.equal(s.average, 30_000);
  assert.deepEqual(s.cancelled, { count: 2, amount: 55_000 });
  assert.deepEqual(s.perMethod, [
    { method: "cash", amount: 50_000 },
    { method: "qris", amount: 20_000 },
    { method: "credit", amount: 20_000 },
  ]);
  assert.deepEqual(s.perCashier, [
    { name: "Rani", count: 2, revenue: 70_000, average: 35_000, cancelled: 1 },
    { name: "Budi", count: 1, revenue: 20_000, average: 20_000, cancelled: 1 },
  ]);
  assert.deepEqual(s.perPeriod, [{ label: dayLabel("2026-11-05"), count: 3, revenue: 90_000 }]);
});

test("rows: periode satu hari → per jam di zona usaha", () => {
  const s = summaryFromRows([sale({ id: "a", total: 10_000, at: "2026-11-05T02:30:00Z" }), sale({ id: "b", total: 5_000, at: "2026-11-05T02:59:00Z" })], true);
  assert.equal(s.hourly, true);
  assert.deepEqual(s.perPeriod, [{ label: "09.00", count: 2, revenue: 15_000 }]);
});

test("rows: kosong → nol tanpa bagi nol", () => {
  const s = summaryFromRows([], false);
  assert.equal(s.transactions, 0);
  assert.equal(s.average, 0);
  assert.deepEqual(s.perCashier, []);
});

test("report: kasir urut penjualan, metode nol dibuang, ember jam berlabel HH.00", () => {
  const s = summaryFromReport({
    from: "2026-11-05",
    to: "2026-11-05",
    days: 1,
    hourly: true,
    revenue: 100,
    transactions: 2,
    average: 50,
    discounts: 5,
    tax: 10,
    service_fee: 0,
    rounding: 0,
    net_items: 85,
    cost: 0,
    net_items_with_cost: 0,
    items_without_cost: 0,
    items_sold: 2,
    gross_profit: null,
    previous: { from: "", to: "", revenue: 0, transactions: 0 },
    growth_percent: null,
    credit: { outstanding: 0, count: 0 },
    cancelled: { count: 0, amount: 0 },
    per_method: [
      { method: "cash", amount: 40 },
      { method: "card", amount: 0 },
      { method: "qris", amount: 60 },
    ],
    buckets: [{ start: "2026-11-05T09:00", revenue: 100, count: 2 }],
    cashiers: [
      { cashier_id: "1", name: "A", count: 1, revenue: 30, average: 30, cancelled: 0 },
      { cashier_id: "2", name: "B", count: 1, revenue: 70, average: 70, cancelled: 0 },
    ],
    order_types: [],
    products: null,
    products_total: null,
    per_hour: null,
    per_weekday: null,
    peak_hour: null,
  });
  assert.deepEqual(s.perMethod.map((m) => m.method), ["qris", "cash"]);
  assert.deepEqual(s.perCashier.map((c) => c.name), ["B", "A"]);
  assert.deepEqual(s.perPeriod, [{ label: "09.00", count: 2, revenue: 100 }]);
  assert.equal(s.money.discounts, 5);
});

test("dayLabel: tanggal kalender tanpa geser zona", () => {
  assert.match(dayLabel("2026-11-05"), /5 Nov 2026/);
});
