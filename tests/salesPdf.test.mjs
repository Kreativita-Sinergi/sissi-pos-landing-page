// Tes unit ringkasan ekspor PDF Transaksi: rumus sama dengan laporan server (api.md "Laporan penjualan") —
// penjualan = lunas + kasbon sesudah refund sebagian, batal/refund penuh terpisah, pesanan berjalan tidak dihitung.
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { summaryFromRows, summaryFromReport, withOutlets, withPrevious, groupProducts, dayLabel } = await import("../src/lib/owner/salesPdf.ts");
const { buildInsights } = await import("../src/lib/owner/salesInsights.ts");
const { zonedToday } = await import("../src/lib/owner/tz.ts");
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
    { from: "2026-10-30", to: "2026-11-05" }
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
    { id: "c1", name: "Rani", count: 2, revenue: 70_000, average: 35_000, cancelled: 1 },
    { id: "c2", name: "Budi", count: 1, revenue: 20_000, average: 20_000, cancelled: 1 },
  ]);
  assert.deepEqual(s.perPeriod, [{ label: dayLabel("2026-11-05"), count: 3, revenue: 90_000 }]);
  // 2026-11-05 = Kamis (indeks 3); 03:00Z = 10.00 WIB.
  assert.equal(s.perWeekday[3], 3);
  assert.equal(s.perHour[10], 3);
  assert.equal(s.peakHour, 10);
});

test("rows: periode satu hari → per jam di zona usaha", () => {
  const s = summaryFromRows([sale({ id: "a", total: 10_000, at: "2026-11-05T02:30:00Z" }), sale({ id: "b", total: 5_000, at: "2026-11-05T02:59:00Z" })], { from: "2026-11-05", to: "2026-11-05" });
  assert.equal(s.hourly, true);
  assert.deepEqual(s.perPeriod, [{ label: "09.00", count: 2, revenue: 15_000 }]);
});

test("rows: kosong → nol tanpa bagi nol", () => {
  const s = summaryFromRows([], { from: "2026-11-01", to: "2026-11-07" });
  assert.equal(s.transactions, 0);
  assert.equal(s.average, 0);
  assert.deepEqual(s.perCashier, []);
  assert.equal(s.perHour, null);
  assert.deepEqual(buildInsights(s), { conclusions: [{ theme: "Penjualan", text: "Belum ada penjualan pada periode ini." }], suggestions: [] });
});

const REPORT = () => ({
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
    peak_weekday: null,
    locked: [],
});

test("report: kasir urut penjualan, metode nol dibuang, ember jam berlabel HH.00", () => {
  const s = summaryFromReport(REPORT());
  assert.deepEqual(s.perMethod.map((m) => m.method), ["qris", "cash"]);
  assert.deepEqual(s.perCashier.map((c) => c.name), ["B", "A"]);
  assert.deepEqual(s.perPeriod, [{ label: "09.00", count: 2, revenue: 100 }]);
  assert.equal(s.money.discounts, 5);
});

test("dayLabel: tanggal kalender tanpa geser zona", () => {
  assert.match(dayLabel("2026-11-05"), /5 Nov 2026/);
});

const RICH = () => ({
  ...REPORT(),
  // Senin 2026-10-19 .. Minggu 2026-10-25 (masa lalu: "hari ini" tidak ikut).
  from: "2026-10-19",
  to: "2026-10-25",
  hourly: false,
  buckets: [5, 1, 4, 4, 6, 10, 10].map((count, i) => ({ start: `2026-10-${19 + i}`, revenue: count * 25_000, count })),
  revenue: 1_000_000,
  transactions: 40,
  average: 25_000,
  discounts: 150_000,
  net_items: 800_000,
  gross_profit: 300_000,
  items_sold: 100,
  items_without_cost: 2,
  previous: { from: "2026-10-26", to: "2026-11-01", revenue: 1_250_000, transactions: 50 },
  growth_percent: -20,
  credit: { outstanding: 75_000, count: 3 },
  cancelled: { count: 4, amount: 100_000 },
  per_method: [
    { method: "cash", amount: 700_000 },
    { method: "qris", amount: 300_000 },
  ],
  cashiers: [
    { cashier_id: "1", name: "Rani", count: 25, revenue: 750_000, average: 30_000, cancelled: 3 },
    { cashier_id: "2", name: "Budi", count: 20, revenue: 400_000, average: 20_000, cancelled: 1 },
  ],
  order_types: [
    { order_type: "dine_in", count: 30, revenue: 700_000 },
    { order_type: "takeaway", count: 10, revenue: 300_000 },
  ],
  products: [
    { key: "a", name: "Kopi Susu", variant_name: null, is_custom: false, quantity: 50, revenue: 500_000 },
    { key: "b", name: "Americano", variant_name: null, is_custom: false, quantity: 20, revenue: 200_000 },
    { key: "c", name: "Croissant", variant_name: null, is_custom: false, quantity: 15, revenue: 150_000 },
    { key: "d", name: "Teh", variant_name: "Dingin", is_custom: false, quantity: 8, revenue: 64_000 },
    { key: "e", name: "Roti", variant_name: null, is_custom: false, quantity: 5, revenue: 50_000 },
    { key: "f", name: "Matcha", variant_name: null, is_custom: false, quantity: 2, revenue: 36_000 },
    { key: "custom:es batu", name: "Tambahan es batu", variant_name: null, is_custom: true, quantity: 1, revenue: 2_000 },
  ],
  products_total: 7,
  // Sen..Min: akhir pekan ramai, Selasa sepi.
  per_weekday: [5, 1, 4, 4, 6, 10, 10],
  per_hour: [0, 0, 0, 0, 0, 0, 0, 2, 3, 4, 2, 1, 8, 9, 3, 0, 2, 3, 3, 0, 0, 0, 0, 0],
  peak_hour: 13,
  peak_weekday: 5,
});

test("insights: kesimpulan memuat produk, kasir, hari, jam, metode, laba, pembatalan, outlet, jenis pesanan", () => {
  const s = withOutlets(summaryFromReport(RICH()), {
    from: "2026-10-19",
    to: "2026-10-25",
    outlets: [
      { outlet_id: "1", name: "Dago", status: "open", revenue: 900_000, transactions: 38, average: 23_684, gross_profit: null, cancelled_count: 4, credit_outstanding: 0, share_percent: 90 },
      { outlet_id: "2", name: "Setiabudi", status: "open", revenue: 100_000, transactions: 2, average: 50_000, gross_profit: null, cancelled_count: 0, credit_outstanding: 0, share_percent: 10 },
      { outlet_id: "3", name: "Bandara", status: "open", revenue: 0, transactions: 0, average: 0, gross_profit: null, cancelled_count: 0, credit_outstanding: 0, share_percent: 0 },
    ],
    total: { revenue: 1_000_000, transactions: 40, average: 25_000, gross_profit: null, cancelled_count: 4, credit_outstanding: 0 },
  });
  const { conclusions, suggestions } = buildInsights(s);
  const all = conclusions.map((c) => c.text).join("\n");
  assert.ok(conclusions.every((c) => typeof c.theme === "string"), "setiap kesimpulan bertema");
  assert.match(all, /turun 20% dibanding periode sebelumnya \(Rp1\.250\.000\)/);
  assert.match(all, /Produk paling laris: Kopi Susu, terjual 50 porsi senilai Rp500\.000 \(50% dari semua item terjual\)/);
  assert.match(all, /Tiga produk teratas \(Kopi Susu, Americano, Croissant\) menyumbang 85%/);
  assert.match(all, /Kasir dengan penjualan tertinggi: Rani, Rp750\.000/);
  assert.match(all, /Hari teramai: Sabtu/);
  assert.match(all, /Akhir pekan \d+% lebih ramai dari hari kerja/);
  assert.match(all, /Jam tersibuk 13\.00–14\.00; rentang 12\.00–14\.00 menyumbang 43% transaksi/);
  assert.match(all, /Tunai jadi metode bayar terbanyak \(70% nominal\)/);
  assert.match(all, /Laba kotor Rp300\.000 \(margin 38% dari pendapatan bersih\)/);
  assert.match(all, /4 transaksi dibatalkan atau dikembalikan senilai Rp100\.000 \(9,1% dari transaksi\)/);
  assert.match(all, /Outlet dengan penjualan tertinggi: Dago/);
  assert.match(all, /Makan di tempat paling banyak|paling banyak \(70% penjualan/);

  const tips = suggestions.join("\n");
  assert.match(tips, /Jaga stok Kopi Susu/);
  assert.match(tips, /Matcha \(2\), Roti \(5\) paling jarang terjual/);
  assert.doesNotMatch(tips, /es batu/, "item cepat tidak disebut jarang laku");
  assert.match(tips, /Rata-rata transaksi Rani \(Rp30\.000\) 50% lebih tinggi dari Budi/);
  assert.match(tips, /Selasa paling sepi/);
  assert.match(tips, /Siapkan kasir, barista, dan bahan sebelum 11\.00/);
  assert.match(tips, /Tunai masih 70% pembayaran/);
  assert.match(tips, /2 baris penjualan belum punya harga modal/);
  assert.match(tips, /Rasio pembatalan 9,1% cukup tinggi, terbanyak oleh Rani \(3\)/);
  assert.match(tips, /Diskon mencapai 15% dari penjualan/);
  assert.match(tips, /kasbon belum lunas Rp75\.000 dari 3 transaksi/);
  assert.match(tips, /Penjualan turun 20%/);
  assert.match(tips, /Bandara tidak mencatat transaksi/);
});

test("insights: paket terkunci (produk & pola waktu null) tetap memberi kesimpulan dasar tanpa galat", () => {
  const s = summaryFromReport({ ...RICH(), products: null, products_total: null, per_hour: null, per_weekday: null, peak_hour: null, peak_weekday: null, locked: ["insights"] });
  assert.equal(s.insightsLocked, true);
  const { conclusions } = buildInsights(s);
  const texts = conclusions.map((c) => c.text);
  assert.ok(texts.some((c) => c.startsWith("Penjualan periode ini")));
  assert.ok(!texts.some((c) => c.includes("Produk paling laris")));
  assert.ok(!texts.some((c) => c.includes("Jam tersibuk")));
});

test("insights: hari ini yang masih berjalan tidak ikut rata-rata hari", () => {
  const today = zonedToday();
  const [y, m, d] = today.split("-").map(Number);
  const days = Array.from({ length: 8 }, (_, i) => new Date(Date.UTC(y, m - 1, d - 7 + i)).toISOString().slice(0, 10));
  // 7 hari penuh ramai (20), hari ini baru 1 transaksi.
  const buckets = days.map((day) => ({ start: day, revenue: 0, count: day === today ? 1 : 20 }));
  const s = summaryFromReport({ ...RICH(), from: days[0], to: today, buckets });
  const { conclusions, suggestions } = buildInsights(s);
  assert.ok(conclusions.some((c) => c.text.includes("hari ini belum dihitung")));
  assert.ok(!suggestions.some((t) => t.includes("paling sepi")), "hari ini tidak dianggap hari sepi");
});

test("produk digabung per nama: varian/ukuran dijumlah", () => {
  const g = groupProducts([
    { key: "k/reg", name: "Kopi Susu", variant_name: "Reguler", is_custom: false, quantity: 300, revenue: 7_000_000 },
    { key: "k/lg", name: "Kopi Susu", variant_name: "Large", is_custom: false, quantity: 116, revenue: 3_400_000 },
    { key: "c", name: "Cappuccino", variant_name: null, is_custom: false, quantity: 110, revenue: 3_100_000 },
  ]);
  assert.deepEqual(g[0], { name: "Kopi Susu", quantity: 416, revenue: 10_400_000, variants: 2, isCustom: false });
  const s = summaryFromReport({ ...RICH(), items_sold: 526, products: [
    { key: "k/reg", name: "Kopi Susu", variant_name: "Reguler", is_custom: false, quantity: 300, revenue: 7_000_000 },
    { key: "k/lg", name: "Kopi Susu", variant_name: "Large", is_custom: false, quantity: 116, revenue: 3_400_000 },
    { key: "c", name: "Cappuccino", variant_name: null, is_custom: false, quantity: 110, revenue: 3_100_000 },
  ], products_total: 3 });
  const texts = buildInsights(s).conclusions.map((c) => c.text).join("\n");
  assert.match(texts, /Produk paling laris: Kopi Susu \(semua varian\), terjual 416 porsi senilai Rp10\.400\.000 \(79% dari semua item terjual\)/);
});

test("tren periode lalu: produk naik/turun, kasir, rata-rata per transaksi", () => {
  const now = summaryFromReport({ ...RICH(), revenue: 1_100_000, transactions: 40, average: 27_500, previous: { from: "2026-10-12", to: "2026-10-18", revenue: 1_000_000, transactions: 50 }, growth_percent: 10 });
  const prev = { ...RICH(), products: [
    { key: "a", name: "Kopi Susu", variant_name: null, is_custom: false, quantity: 30, revenue: 300_000 },
    { key: "b", name: "Americano", variant_name: null, is_custom: false, quantity: 40, revenue: 400_000 },
    { key: "c", name: "Croissant", variant_name: null, is_custom: false, quantity: 14, revenue: 140_000 },
    { key: "f", name: "Matcha", variant_name: null, is_custom: false, quantity: 3, revenue: 54_000 },
  ], products_total: 4, cashiers: [
    { cashier_id: "1", name: "Rani", count: 20, revenue: 500_000, average: 25_000, cancelled: 0 },
    { cashier_id: "2", name: "Budi", count: 20, revenue: 380_000, average: 19_000, cancelled: 0 },
  ] };
  const s = withPrevious(now, prev);
  assert.equal(s.previous.productsComplete, true);
  const { conclusions, suggestions } = buildInsights(s);
  const all = conclusions.map((c) => c.text).join("\n");
  // Kopi Susu 30 → 50 (+67%); Americano 40 → 20 (-50%); Matcha basis 3 < 10 → diabaikan.
  assert.match(all, /Naik paling tinggi: Kopi Susu, 50 porsi \(\+67% dari 30 di periode lalu\)/);
  assert.match(all, /Turun paling dalam: Americano, 20 porsi \(-50% dari 40 di periode lalu\)/);
  assert.doesNotMatch(all, /Matcha.*periode lalu/);
  assert.match(suggestions.join("\n"), /Penjualan Americano turun 50% dari periode lalu/);
  // Rani 500.000 → 750.000 (+50%); Budi 380.000 → 400.000 (+5%, di bawah ambang).
  assert.match(all, /Dibanding periode lalu: penjualan Rani naik 50%\./);
  // Rata-rata 20.000 → 27.500 (+38%).
  assert.match(all, /Rata-rata belanja per transaksi naik 38% \(Rp20\.000 menjadi Rp27\.500\)/);
  const themes = new Set(conclusions.map((c) => c.theme));
  for (const t of ["Penjualan", "Produk", "Waktu ramai", "Tim & outlet", "Pembayaran & lainnya"]) assert.ok(themes.has(t), `tema ${t}`);
});
