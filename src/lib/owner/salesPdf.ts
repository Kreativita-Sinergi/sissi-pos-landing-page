// Ekspor PDF halaman Transaksi (jsPDF + jspdf-autotable, dimuat hanya saat ekspor).
//
// Isi: kepala (usaha, outlet, periode, filter, waktu dibuat) → ringkasan → per metode bayar → per kasir → per hari/jam
// → nomor halaman di setiap halaman. Tanpa daftar per transaksi (itu tugas Ekspor CSV).
//
// Sumber ringkasan:
// - "report": tanpa filter tambahan (metode/status/kasir/cari) → GET /owner/reports/sales, angka SAMA dengan halaman
//   Laporan (penjualan = lunas + kasbon sesudah refund sebagian; batal/refund penuh dihitung terpisah).
// - "rows": ada filter tambahan → dihitung dari transaksi yang cocok dengan rumus yang sama (api.md "Laporan
//   penjualan"); diskon/pajak/biaya layanan tidak ada di daftar transaksi sehingga tidak ditampilkan.
import type { SaleListItem, SalesReport } from "./types";
import { netTotalOf } from "./saleRefunds";
import { formatDateTime, zonedDay, zonedHHMM, zoneLabel } from "./tz";
import { labelOf, METHODS } from "@/components/owner/labels";

const COUNTED = new Set(["paid", "unpaid", "partial"]);
const CANCELLED = new Set(["void", "refunded"]);

export type SalesSummary = {
  source: "report" | "rows";
  transactions: number;
  revenue: number;
  average: number;
  cancelled: { count: number; amount: number };
  /** Hanya dari laporan. */
  money?: { discounts: number; tax: number; serviceFee: number; rounding: number; netItems: number; creditOutstanding: number; creditCount: number };
  perMethod: { method: string; amount: number }[];
  perCashier: { name: string; count: number; revenue: number; average: number; cancelled: number }[];
  perPeriod: { label: string; count: number; revenue: number }[];
  hourly: boolean;
};

const rp = (n: number) => `${n < 0 ? "-" : ""}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
const num = (n: number) => n.toLocaleString("id-ID");

/** "2026-11-05" → "Kam, 5 Nov 2026" (tanggal kalender, tanpa geser zona). */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export function summaryFromReport(r: SalesReport): SalesSummary {
  return {
    source: "report",
    transactions: r.transactions,
    revenue: r.revenue,
    average: r.average,
    cancelled: r.cancelled,
    money: {
      discounts: r.discounts,
      tax: r.tax,
      serviceFee: r.service_fee,
      rounding: r.rounding,
      netItems: r.net_items,
      creditOutstanding: r.credit.outstanding,
      creditCount: r.credit.count,
    },
    perMethod: r.per_method.filter((m) => m.amount !== 0).sort((a, b) => b.amount - a.amount),
    perCashier: [...r.cashiers].sort((a, b) => b.revenue - a.revenue),
    perPeriod: r.buckets.map((b) => ({ label: r.hourly ? `${b.start.slice(11, 13)}.00` : dayLabel(b.start.slice(0, 10)), count: b.count, revenue: b.revenue })),
    hourly: r.hourly,
  };
}

/** Ringkasan dari daftar transaksi (filter tambahan aktif). `hourly` bila periode satu hari. */
export function summaryFromRows(rows: SaleListItem[], hourly: boolean): SalesSummary {
  let transactions = 0;
  let revenue = 0;
  const cancelled = { count: 0, amount: 0 };
  const methods = new Map<string, number>();
  const cashiers = new Map<string, { name: string; count: number; revenue: number; cancelled: number }>();
  const periods = new Map<string, { count: number; revenue: number }>();
  for (const s of rows) {
    const c = cashiers.get(s.cashier_id) ?? { name: s.cashier_name, count: 0, revenue: 0, cancelled: 0 };
    cashiers.set(s.cashier_id, c);
    if (CANCELLED.has(s.status)) {
      cancelled.count++;
      cancelled.amount += s.total;
      c.cancelled++;
      continue;
    }
    if (!COUNTED.has(s.status)) continue;
    const net = netTotalOf(s);
    transactions++;
    revenue += net;
    c.count++;
    c.revenue += net;
    methods.set(s.payment_method, (methods.get(s.payment_method) ?? 0) + net);
    const key = hourly ? `${zonedHHMM(s.paid_at).slice(0, 2)}.00` : zonedDay(s.paid_at);
    const p = periods.get(key) ?? { count: 0, revenue: 0 };
    p.count++;
    p.revenue += net;
    periods.set(key, p);
  }
  return {
    source: "rows",
    transactions,
    revenue,
    average: transactions ? Math.round(revenue / transactions) : 0,
    cancelled,
    perMethod: [...methods].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
    perCashier: [...cashiers.values()]
      .filter((c) => c.count || c.cancelled)
      .map((c) => ({ ...c, average: c.count ? Math.round(c.revenue / c.count) : 0 }))
      .sort((a, b) => b.revenue - a.revenue),
    perPeriod: [...periods]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ label: hourly ? k : dayLabel(k), ...v })),
    hourly,
  };
}

export type SalesPdfInput = {
  businessName: string;
  outletLabel: string;
  periodLabel: string;
  /** Mis. ["Metode: QRIS, Tunai", "Kasir: Rani"]; kosong = tanpa filter tambahan. */
  filters: string[];
  summary: SalesSummary;
  /** Jumlah transaksi yang dipakai menghitung ringkasan "rows" (untuk catatan ringkasan sebagian). */
  summarizedCount: number;
  /** Total transaksi yang cocok dengan filter (meta.total). */
  total: number;
  /** Ringkasan "rows" hanya dari sebagian transaksi (melebihi batas ambil). */
  partialSummary: boolean;
  generatedAt: Date;
};

const BRAND: [number, number, number] = [184, 92, 46];
const INK: [number, number, number] = [33, 30, 28];
const MUTED: [number, number, number] = [110, 104, 100];
const LINE: [number, number, number] = [226, 222, 218];
const TINT: [number, number, number] = [251, 240, 233];

export async function buildSalesPdf(input: SalesPdfInput): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14;
  const W = doc.internal.pageSize.getWidth();
  const s = input.summary;
  let y = M + 2;
  const table = (startY: number, head: string[], body: string[][], rightCols: number[]) =>
    autoTable(doc, {
      startY,
      margin: { left: M, right: M },
      head: [head],
      body,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 1.8, textColor: INK, lineColor: LINE, lineWidth: 0.2 },
      headStyles: { fillColor: TINT, textColor: INK, fontStyle: "bold" },
      columnStyles: Object.fromEntries(rightCols.map((c) => [c, { halign: "right" as const }])),
      // columnStyles hanya berlaku untuk isi; judul kolom angka ikut rata kanan.
      didParseCell: (d) => {
        if (d.section === "head" && rightCols.includes(d.column.index)) d.cell.styles.halign = "right";
      },
    });

  // ——— Kepala ———
  doc.setFont("helvetica", "bold").setFontSize(17).setTextColor(...INK).text("Laporan Transaksi", M, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(...MUTED).text(input.businessName, M, y + 10);
  doc.setDrawColor(...BRAND).setLineWidth(0.8).line(M, y + 13.5, W - M, y + 13.5);
  y += 19;
  const meta: [string, string][] = [
    ["Outlet", input.outletLabel],
    ["Periode", input.periodLabel],
    ["Filter", input.filters.length ? input.filters.join(" · ") : "Tanpa filter tambahan"],
    ["Dibuat", `${formatDateTime(input.generatedAt.toISOString())} ${zoneLabel()}`],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: { top: 0.8, bottom: 0.8, left: 0, right: 2 }, textColor: INK },
    columnStyles: { 0: { cellWidth: 22, textColor: MUTED } },
    body: meta,
  });
  y = finalY(doc) + 6;

  // ——— Ringkasan ———
  y = heading(doc, "Ringkasan", M, y);
  const kpis: [string, string][] = [
    ["Transaksi", num(s.transactions)],
    ["Penjualan", rp(s.revenue)],
    ["Rata-rata per transaksi", rp(s.average)],
    ["Dibatalkan", `${num(s.cancelled.count)} · ${rp(s.cancelled.amount)}`],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    body: [kpis.map(([k]) => k), kpis.map(([, v]) => v)],
    styles: { fontSize: 9, textColor: MUTED, cellPadding: { top: 2.5, bottom: 0.5, left: 3, right: 3 }, fillColor: TINT },
    didParseCell: (d) => {
      if (d.row.index === 1) {
        d.cell.styles.fontSize = 13;
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.textColor = INK;
        d.cell.styles.cellPadding = { top: 0.5, bottom: 3, left: 3, right: 3 };
      }
    },
  });
  y = finalY(doc) + 3;
  if (s.money) {
    const m = s.money;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      theme: "plain",
      styles: { fontSize: 9.5, cellPadding: { top: 0.9, bottom: 0.9, left: 0, right: 0 }, textColor: INK },
      columnStyles: { 1: { halign: "right" }, 2: { textColor: MUTED, fontSize: 8.5, cellPadding: { top: 1, bottom: 0.9, left: 6, right: 0 } } },
      body: [
        ["Penjualan (total transaksi)", rp(s.revenue), "Termasuk pajak & biaya layanan"],
        ["Diskon", m.discounts ? `-${rp(m.discounts)}` : rp(0), "Diskon nota + diskon per item"],
        ["Pajak", rp(m.tax), ""],
        ["Biaya layanan", rp(m.serviceFee), ""],
        ["Pembulatan", rp(m.rounding), ""],
        ["Pendapatan bersih", rp(m.netItems), "Penjualan item setelah diskon, tanpa pajak & biaya layanan"],
        ["Piutang kasbon (semua tanggal)", rp(m.creditOutstanding), `${num(m.creditCount)} transaksi belum lunas`],
      ],
      didParseCell: (d) => {
        if (d.section === "body" && (d.row.index === 0 || d.row.index === 5) && d.column.index < 2) d.cell.styles.fontStyle = "bold";
      },
    });
    y = finalY(doc) + 2;
  }
  y = note(
    doc,
    s.source === "report"
      ? "Angka sama dengan halaman Laporan: penjualan = transaksi lunas + kasbon (sesudah refund sebagian); pembatalan & refund penuh dihitung terpisah."
      : `Dihitung dari transaksi yang cocok dengan filter (rumus sama dengan halaman Laporan).${
          input.partialSummary ? ` Hanya ${num(input.summarizedCount)} dari ${num(input.total)} transaksi pertama - persempit periode untuk angka lengkap.` : ""
        }`,
    M,
    y,
    W - 2 * M
  );

  // ——— Per metode bayar ———
  if (s.perMethod.length) {
    const sum = s.perMethod.reduce((a, b) => a + Math.max(0, b.amount), 0);
    y = section(doc, "Per metode bayar", y);
    table(y, ["Metode", "Nominal", "Porsi"], s.perMethod.map((m) => [labelOf(METHODS, m.method), rp(m.amount), sum && m.amount > 0 ? `${Math.round((m.amount / sum) * 100)}%` : "-"]), [1, 2]);
    y = finalY(doc) + 2;
    if (s.source === "report") y = note(doc, "Dari pembayaran yang diterima di periode ini, termasuk pengembalian (negatif).", M, y, W - 2 * M);
  }

  // ——— Per kasir ———
  if (s.perCashier.length) {
    y = section(doc, "Per kasir", y);
    table(
      y,
      ["Kasir", "Transaksi", "Penjualan", "Rata-rata", "Dibatalkan"],
      s.perCashier.map((c) => [c.name, num(c.count), rp(c.revenue), rp(c.average), num(c.cancelled)]),
      [1, 2, 3, 4]
    );
    y = finalY(doc) + 6;
  }

  // ——— Per hari / per jam ———
  if (s.perPeriod.some((p) => p.count)) {
    y = section(doc, s.hourly ? "Per jam" : "Per hari", y);
    const rowsP = (s.hourly ? s.perPeriod.filter((p) => p.count) : s.perPeriod).map((p) => [p.label, num(p.count), rp(p.revenue)]);
    table(y, [s.hourly ? "Jam" : "Tanggal", "Transaksi", "Penjualan"], rowsP, [1, 2]);
    y = finalY(doc) + 6;
  }

  // Daftar per transaksi sengaja tidak dimuat (keputusan pemilik 2026-11-05): PDF = laporan ringkas; rincian → CSV.
  note(doc, "Laporan ini hanya berisi ringkasan. Untuk daftar per transaksi, gunakan Ekspor CSV di halaman Transaksi.", M, y, W - 2 * M);

  // ——— Kaki: nomor halaman ———
  const pages = doc.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(`${input.businessName} · Laporan Transaksi · ${input.periodLabel}`, M, H - 8);
    doc.text(`Halaman ${i} dari ${pages}`, W - M, H - 8, { align: "right" });
  }
  return doc.output("blob");
}

// ——— Bantuan tata letak ———

type Doc = import("jspdf").jsPDF;

function finalY(doc: Doc): number {
  return (doc as Doc & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 20;
}

function heading(doc: Doc, text: string, x: number, y: number): number {
  doc.setFont("helvetica", "bold").setFontSize(12).setTextColor(...INK).text(text, x, y + 4);
  return y + 7;
}

/** Judul bagian; pindah halaman bila sisa ruang terlalu sedikit untuk judul + beberapa baris. */
function section(doc: Doc, text: string, y: number): number {
  const H = doc.internal.pageSize.getHeight();
  if (y > H - 50) {
    doc.addPage();
    y = 16;
  }
  return heading(doc, text, 14, y);
}

function note(doc: Doc, text: string, x: number, y: number, width: number): number {
  doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
  const lines = doc.splitTextToSize(text, width) as string[];
  doc.text(lines, x, y + 3);
  return y + 3 + lines.length * 3.6 + 3;
}
