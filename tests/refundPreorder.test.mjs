// Tes unit dasbor (2026-10-21): refund sebagian per item (tampilan + batal sesudahnya hanya mengembalikan sisa),
// "Kembalikan DP" atas pesanan awal reservasi B3 (`items: []` di pembatalan yang sama), dan sel persen Excel.
// Kontrak: sissi-pos-service/docs/api.md "Refund sebagian per item (2026-10-21)" & "DP reservasi" › "Pesanan awal (B3)".
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";
import { strToU8, zipSync } from "fflate";

const { hasPartialRefund, netTotalOf, outstandingOf, receiptTotals, refundedQtyByIndex, refundedTotalOf, refundEntries, shownTotalOf } = await import(
  "../src/lib/owner/saleRefunds.ts"
);
const { cancelChange, isDepositRefund, isPreorderDeposit, isPreorderWithoutDeposit, refundPlan } = await import("../src/lib/owner/cancelSale.ts");
const { depositBadge } = await import("../src/components/owner/labels.ts");
const { percentStyles, readXlsx, xlsxPercent } = await import("../src/lib/owner/xlsx.ts");
const { readImportXlsx } = await import("../src/lib/owner/productImportXlsx.ts");
const { wastePercentBp } = await import("../src/lib/owner/productImport.ts");

const NOW = new Date("2026-10-21T05:00:00Z");

// ——— Refund sebagian ———

const REFUNDS = [
  {
    id: "rf1", refunded_at: "2026-10-21T03:00:00Z", cashier_id: "c1", approved_by: "o1", reason: "Salah pesan", amount: 22_000,
    lines: [{ index: 1, line_id: "l2", quantity: 1, amount: 22_000 }], payments: [{ id: "p3", method: "cash", amount: -22_000 }],
  },
  {
    id: "rf2", refunded_at: "2026-10-21T04:00:00Z", cashier_id: "c1", approved_by: null, reason: "Dingin", amount: 30_000,
    lines: [{ index: 1, line_id: "l2", quantity: 1, amount: 22_000 }, { index: 0, line_id: "l1", quantity: 1, amount: 8_000 }],
    payments: [{ id: "p4", method: "qris", amount: -20_000 }, { id: "p5", method: "cash", amount: -10_000 }],
  },
];
const ITEMS = [
  { name: "Es teh", variant_name: "Besar", quantity: 2 },
  { name: "Nasi goreng", variant_name: null, quantity: 3 },
];

test("angka refund sebagian: total sesudah refund, label hanya untuk transaksi yang masih berlaku", () => {
  const s = { total: 100_000, status: "paid", refunded_total: 52_000 };
  assert.equal(refundedTotalOf(s), 52_000);
  assert.equal(netTotalOf(s), 48_000);
  assert.equal(hasPartialRefund(s), true);
  // Server lama (tanpa field) / tanpa refund.
  assert.equal(refundedTotalOf({ total: 1 }), 0);
  assert.equal(hasPartialRefund({ total: 100_000, status: "paid" }), false);
  // Refund berulang sampai habis → status refunded (batal penuh), bukan "refund sebagian" lagi.
  assert.equal(hasPartialRefund({ ...s, status: "refunded", refunded_total: 100_000 }), false);
  assert.equal(hasPartialRefund({ ...s, status: "void" }), false);
});

test("qty kembali per baris & riwayat refund (waktu, alasan, metode, nominal, barang)", () => {
  assert.deepEqual([...refundedQtyByIndex(REFUNDS)].sort(), [[0, 1], [1, 2]]);
  assert.equal(refundedQtyByIndex(undefined).size, 0);
  const h = refundEntries({ items: ITEMS, refunds: REFUNDS });
  assert.equal(h.length, 2);
  assert.deepEqual(h[0], {
    id: "rf1", at: "2026-10-21T03:00:00Z", reason: "Salah pesan", amount: 22_000, methods: ["cash"],
    lines: [{ name: "Nasi goreng", variant_name: null, quantity: 1, amount: 22_000 }],
  });
  assert.deepEqual(h[1].methods, ["qris", "cash"]);
  assert.deepEqual(h[1].lines[1], { name: "Es teh", variant_name: "Besar", quantity: 1, amount: 8_000 });
  // Indeks di luar daftar item (snapshot rusak) tidak membuat tampilan gagal.
  assert.equal(refundEntries({ items: [], refunds: [REFUNDS[0]] })[0].lines[0].name, "Baris 2");
  assert.deepEqual(refundEntries({ items: ITEMS }), []);
});

test("batal/refund penuh sesudah refund sebagian hanya mengembalikan SISA per metode (Σ bersih = 0)", () => {
  const payments = [
    { method: "cash", amount: 60_000 },
    { method: "qris", amount: 40_000 },
    { method: "cash", amount: -22_000, purpose: "refund" },
    { method: "qris", amount: -20_000, purpose: "refund" },
    { method: "cash", amount: -10_000, purpose: "refund" },
  ];
  const plan = refundPlan(payments);
  assert.deepEqual(plan, [
    { method: "cash", amount: 28_000 },
    { method: "qris", amount: 20_000 },
  ]);
  const sale = { id: "s1", outlet_id: "o1", updated_at: "2026-10-21T04:00:00Z", status: "paid", reservation_id: null, refunded_total: 52_000 };
  const c = cancelChange(sale, { kind: "refunded", reason: "Komplain", refunds: plan.map((p) => ({ from: p.method, method: p.method, amount: p.amount })) }, "owner", NOW);
  assert.equal(c.data.status, "refunded");
  const sum = [...payments, ...c.data.payments].reduce((a, p) => a + p.amount, 0);
  assert.equal(sum, 0);
  // Pengembalian dari web tidak pernah ber-purpose "refund" (hanya untuk perubahan refund sebagian) dan tanpa items.
  for (const p of c.data.payments) assert.equal("purpose" in p, false);
  assert.equal("items" in c.data, false);
  // Sudah habis direfund sebagian → tidak ada uang tersisa.
  assert.deepEqual(refundPlan([{ method: "cash", amount: 10_000 }, { method: "cash", amount: -10_000 }]), []);
});

test("refund sebagian lewat metode lain (metode bebas): rencana batal hanya SISA uang, Σ akhir = 0", () => {
  const sumAfter = (payments, plan) => payments.reduce((a, p) => a + p.amount, 0) - plan.reduce((a, p) => a + p.amount, 0);
  // Lunas Rp100.000 QRIS, refund sebagian Rp30.000 dikembalikan tunai.
  const qris = [{ method: "qris", amount: 100_000 }, { method: "cash", amount: -30_000, purpose: "refund" }];
  assert.deepEqual(refundPlan(qris), [{ method: "qris", amount: 70_000 }]);
  assert.equal(sumAfter(qris, refundPlan(qris)), 0);
  // Sisa DP dikembalikan lewat metode lain (D7): DP QRIS 100.000, deposit_refund tunai 40.000.
  const dp = [{ method: "qris", amount: 100_000, purpose: "deposit" }, { method: "cash", amount: -40_000, purpose: "deposit_refund" }];
  assert.deepEqual(refundPlan(dp), [{ method: "qris", amount: 60_000 }]);
  // Dua metode positif: yang terbesar dikurangi dulu; urutan tampil tetap urutan metode pertama muncul.
  const split = [{ method: "qris", amount: 40_000 }, { method: "cash", amount: 60_000 }, { method: "card", amount: -50_000, purpose: "refund" }];
  assert.deepEqual(refundPlan(split), [{ method: "qris", amount: 40_000 }, { method: "cash", amount: 10_000 }]);
  assert.equal(sumAfter(split, refundPlan(split)), 0);
  // Negatif melebihi metode terbesar → lanjut ke metode berikutnya.
  const big = [{ method: "qris", amount: 40_000 }, { method: "cash", amount: 60_000 }, { method: "card", amount: -70_000, purpose: "refund" }];
  assert.deepEqual(refundPlan(big), [{ method: "qris", amount: 30_000 }]);
  // Tidak ada uang tersisa (Σ ≤ 0) → kosong.
  assert.deepEqual(refundPlan([{ method: "qris", amount: 30_000 }, { method: "cash", amount: -30_000 }]), []);
});

test("rincian: sisa kasbon & baris total memakai tagihan setelah refund (bukan total − paid_total)", () => {
  // Regresi: lunas Rp100.000 direfund sebagian Rp52.000 → paid_total 48.000 → sisa 0 (dulu "Sisa (kasbon) Rp52.000").
  const paid = { total: 100_000, status: "paid", refunded_total: 52_000, paid_total: 48_000 };
  assert.equal(outstandingOf(paid), 0);
  assert.equal(outstandingOf({ total: 100_000, status: "partial", paid_total: 40_000 }), 60_000);
  assert.equal(outstandingOf({ total: 100_000, status: "unpaid", paid_total: 0, refunded_total: 0 }), 100_000);
  assert.equal(outstandingOf({ total: 10_000, status: "paid", paid_total: 12_000 }), 0); // tidak pernah negatif
  assert.deepEqual(receiptTotals(paid), { totalStrong: false, refunded: 52_000, netTotal: 48_000 });
  // Refund sebagian lalu refund penuh: hanya riwayat "Refund sebagian", tanpa "Total setelah refund".
  assert.deepEqual(receiptTotals({ ...paid, status: "refunded", paid_total: 0 }), { totalStrong: true, refunded: 52_000, netTotal: null });
  assert.deepEqual(receiptTotals({ total: 100_000, status: "paid" }), { totalStrong: true, refunded: null, netTotal: null });
  // Nominal baris daftar: setelah refund bila masih berlaku; batal = nilai asli (dicoret).
  assert.equal(shownTotalOf(paid), 48_000);
  assert.equal(shownTotalOf({ ...paid, status: "void" }), 100_000);
  assert.equal(shownTotalOf({ total: 5_000, status: "paid" }), 5_000);
});

// ——— Pesanan awal reservasi (B3) ———

const INPUT = { kind: "void", reason: "Pelanggan batal", refunds: [{ from: "cash", method: "cash", amount: 50_000 }] };
const DP = { id: "s2", outlet_id: "o1", updated_at: "2026-10-21T01:00:00Z", status: "open", reservation_id: "r1", deposit: "held", items_count: 3 };

test("pesanan awal = DP tertahan/perlu diproses yang ber-item (tanpa field baru)", () => {
  assert.equal(isPreorderDeposit(DP), true);
  assert.equal(isPreorderDeposit({ ...DP, deposit: "to_process" }), true);
  assert.equal(isPreorderDeposit({ ...DP, items_count: 0 }), false);
  assert.equal(isPreorderDeposit({ ...DP, deposit: "order" }), false); // sudah bermeja
  assert.equal(isPreorderDeposit({ ...DP, deposit: null }), false);
  assert.equal(isPreorderDeposit({ items_count: 2 }), false); // server lama tanpa deposit
});

test("pesanan awal tanpa DP tidak dilabeli DP (cermin depositBadgeOf app)", () => {
  assert.equal(isPreorderWithoutDeposit({ ...DP, paid_total: 0 }), true);
  assert.equal(isPreorderWithoutDeposit({ ...DP, paid_total: 50_000 }), false);
  assert.equal(isPreorderWithoutDeposit({ ...DP, items_count: 0, paid_total: 0 }), false);
  assert.deepEqual(depositBadge("held", { preorder: true }), { label: "DP · Pesanan awal", tone: "brand" });
  assert.deepEqual(depositBadge("held", { preorder: true, noMoney: true }), { label: "Pesanan awal", tone: "brand" });
  assert.equal(depositBadge("held", { preorder: true, noMoney: true, long: true }).label, "Pesanan awal · tamu belum datang");
  assert.deepEqual(depositBadge("to_process", { preorder: true, noMoney: true }), { label: "Pesanan awal perlu dihapus", tone: "warning" });
  assert.deepEqual(depositBadge("to_process", { preorder: true }), { label: "DP perlu diproses", tone: "warning", extra: "Pesanan awal" });
  assert.deepEqual(depositBadge("held"), { label: "DP tertahan", tone: "brand" });
  assert.equal(depositBadge("order", { preorder: true }), null);
  assert.equal(depositBadge(null), null);
});

test("Kembalikan DP atas pesanan awal: SATU perubahan void + items: [] + deposit_refund + re-date (butir 5)", () => {
  const c = cancelChange(DP, INPUT, "owner", NOW);
  assert.equal(c.entity, "sales");
  assert.equal(c.op, "upsert");
  assert.equal(c.base_updated_at, DP.updated_at);
  assert.deepEqual(c.data.items, []);
  assert.equal(c.data.status, "void");
  assert.equal(c.data.paid_at, NOW.toISOString());
  assert.equal(c.data.shift_id, null);
  assert.equal(c.data.payments.length, 1);
  assert.equal(c.data.payments[0].purpose, "deposit_refund");
  assert.equal(c.data.payments[0].amount, -50_000);
  // Bentuk persis: hanya kunci yang dikontrakkan (rincian dikosongkan server, bukan klien).
  assert.deepEqual(Object.keys(c.data).sort(), ["approved_by", "items", "paid_at", "payments", "shift_id", "status", "void_reason"]);
  // Pesanan awal tanpa DP: tetap satu perubahan pembatalan ber-items: [] tanpa pembayaran.
  const free = cancelChange({ ...DP, deposit: "to_process" }, { ...INPUT, refunds: [] }, "owner", NOW);
  assert.deepEqual(free.data.items, []);
  assert.deepEqual(free.data.payments, []);
});

test("items: [] HANYA untuk pesanan awal (DP 0 item, pesanan meja berjalan, transaksi tertagih: tanpa kunci items)", () => {
  const empty = cancelChange({ ...DP, items_count: 0 }, INPUT, "owner", NOW);
  assert.equal("items" in empty.data, false);
  assert.equal(empty.data.payments[0].purpose, "deposit_refund");
  // Tamu sudah didudukkan (open ber-meja → deposit "order"): Kembalikan DP biasa, items server tidak disentuh.
  const seated = { ...DP, deposit: "order" };
  assert.equal(isDepositRefund(seated), true);
  assert.equal("items" in cancelChange(seated, INPUT, "owner", NOW).data, false);
  // Sudah ditagih: pembatalan biasa.
  const billed = cancelChange({ ...DP, status: "paid", deposit: "order" }, INPUT, "owner", NOW);
  assert.equal("items" in billed.data, false);
  assert.equal("paid_at" in billed.data, false);
});

// ——— Persen Excel ———

const STYLES =
  '<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="3"><numFmt numFmtId="164" formatCode="0.0%"/><numFmt numFmtId="165" formatCode="0.0&quot;%&quot;"/>' +
  '<numFmt numFmtId="166" formatCode="0\\%"/></numFmts>' +
  '<cellStyleXfs count="1"><xf numFmtId="9"/></cellStyleXfs>' +
  '<cellXfs count="6"><xf numFmtId="0"/><xf numFmtId="9" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"><alignment horizontal="right"/></xf>' +
  '<xf numFmtId="165"/><xf numFmtId="10"/><xf numFmtId="166"/></cellXfs></styleSheet>';

function workbook(sheets, styles = STYLES) {
  const ns = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const files = {
    "xl/workbook.xml": strToU8(
      `<workbook ${ns} xmlns:r="${rel}"><sheets>${sheets.map((s, i) => `<sheet name="${s.name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="${rel}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join("")}</Relationships>`
    ),
  };
  if (styles) files["xl/styles.xml"] = strToU8(styles);
  sheets.forEach((s, i) => {
    const rows = s.rows
      .map((cells, r) => `<row r="${r + 1}">${cells.map(([v, style], c) => {
        const ref = `${String.fromCharCode(65 + c)}${r + 1}`;
        const st = style === undefined ? "" : ` s="${style}"`;
        return typeof v === "number" ? `<c r="${ref}"${st}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"><is><t>${v}</t></is></c>`;
      }).join("")}</row>`)
      .join("");
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(`<worksheet ${ns}><sheetData>${rows}</sheetData></worksheet>`);
  });
  return zipSync(files);
}

test("format sel persen dari styles.xml: bawaan 9/10 + kustom ber-% (bukan % berkutip/ber-escape)", () => {
  assert.deepEqual([...percentStyles(STYLES)].sort(), [1, 2, 4]);
  assert.equal(percentStyles(null).size, 0);
  assert.equal(percentStyles("<styleSheet/>").size, 0);
  assert.equal(xlsxPercent("0.35"), "35");
  assert.equal(xlsxPercent("0.125"), "12.5");
  assert.equal(xlsxPercent("0.07"), "7"); // 7.000000000000001 → 7
  assert.equal(xlsxPercent("abc"), "abc");
});

test("readXlsx: 0,35 berformat persen = \"35%\"; tanpa format persen tetap 0,35", () => {
  const bytes = workbook([{ name: "S", rows: [[[0.35, 1], [0.125, 2], [0.35, 3], [0.35], [0.35, 0], [0.5, 4], [0.35, 5]]] }]);
  const [sheet] = readXlsx(bytes, ",");
  assert.deepEqual(sheet.rows[0].cells, ["35%", "12,5%", "0,35", "0,35", "0,35", "50%", "0,35"]);
  // Tanpa styles.xml sama sekali: angka apa adanya.
  const [plain] = readXlsx(workbook([{ name: "S", rows: [[[0.35, 1]]] }], null), ",");
  assert.deepEqual(plain.rows[0].cells, ["0,35"]);
  assert.equal(wastePercentBp("35%"), 3500);
  assert.equal(wastePercentBp("12,5%"), 1250);
  assert.equal(wastePercentBp("0,35"), null);
});

test("impor Excel: susut 0,35 berformat persen = 35%; tanpa format persen ditolak (ambigu)", async () => {
  const bytes = workbook([
    { name: "Produk", rows: [[["nama"], ["harga"]], [["Nasi goreng"], [25000]]] },
    {
      name: "Bahan baku",
      rows: [
        [["nama_bahan"], ["satuan"], ["susut_persen"]],
        [["Beras"], ["g"], [0.35, 1]],
        [["Bawang"], ["g"], [0.35]],
        [["Minyak"], ["ml"], [12]],
      ],
    },
  ]);
  const file = await readImportXlsx(bytes, false);
  assert.equal(file.error, undefined);
  const [beras, bawang, minyak] = file.extras.materials;
  assert.equal(beras.name, "Beras");
  assert.equal(beras.wasteBp, 3500);
  assert.equal(beras.wasteGiven, true);
  assert.deepEqual(beras.issues, []);
  assert.equal(bawang.wasteBp, 0);
  assert.ok(bawang.issues.includes("wasteInvalid"));
  assert.equal(minyak.wasteBp, 1200);
});
