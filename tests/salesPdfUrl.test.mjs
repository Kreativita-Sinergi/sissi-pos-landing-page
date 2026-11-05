// Tes pembuat jalur PDF Laporan Penjualan: query = filter Transaksi tanpa page/per_page, larik digabung koma.
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { salesPdfPath } = await import("../src/lib/owner/api.ts");

test("salesPdfPath: semua filter ikut, page/per_page dibuang", () => {
  const p = salesPdfPath({ from: "2026-11-01", to: "2026-11-05", outlet_id: "o1", status: ["paid", "void"], method: ["qris"], cashier_id: "c1", q: "ab c", sort: "newest", page: 3, per_page: 100 });
  const u = new URL(p, "http://x");
  assert.equal(u.pathname, "/reports/sales.pdf");
  assert.deepEqual(Object.fromEntries(u.searchParams), { from: "2026-11-01", to: "2026-11-05", outlet_id: "o1", status: "paid,void", method: "qris", cashier_id: "c1", q: "ab c", sort: "newest" });
});

test("salesPdfPath: filter kosong dibuang", () => {
  assert.equal(salesPdfPath({ from: "2026-11-01", to: "2026-11-05", status: [], q: "" }), "/reports/sales.pdf?from=2026-11-01&to=2026-11-05");
});
