// Ekspor PDF halaman Transaksi: laporan penjualan yang MENJELASKAN, bukan daftar data (keputusan pemilik 2026-11-05).
// jsPDF + jspdf-autotable dimuat hanya saat ekspor.
//
// Isi: kepala → angka utama → "Kesimpulan" (kalimat) → "Saran" (salesInsights.ts) → produk terlaris → pola hari & jam
// (grafik batang) → per kasir → per metode bayar → rincian uang → per hari/jam → nomor halaman. Tanpa daftar per
// transaksi (itu tugas Ekspor CSV).
//
// Sumber ringkasan:
// - "report": tanpa filter tambahan (metode/status/kasir/cari) → GET /owner/reports/sales, angka SAMA dengan halaman
//   Laporan (penjualan = lunas + kasbon sesudah refund sebagian; batal/refund penuh dihitung terpisah). Produk terlaris
//   & jam/hari ramai = fitur `insights` (null bila paket terkunci → `insightsLocked`).
// - "rows": ada filter tambahan → dihitung dari transaksi yang cocok dengan rumus yang sama; diskon/pajak/laba/produk
//   tidak ada di daftar transaksi sehingga tidak ditampilkan.
import type { OutletsReport, ProductSales, SaleListItem, SalesReport } from "./types";
import { netTotalOf } from "./saleRefunds";
import { formatDateTime, zonedDay, zonedHour, zoneLabel, zonedToday } from "./tz";
import { buildInsights, THEMES } from "./salesInsights";
import { labelOf, METHODS, orderTypeLabel, WEEKDAYS_SHORT } from "@/components/owner/labels";

const COUNTED = new Set(["paid", "unpaid", "partial"]);
const CANCELLED = new Set(["void", "refunded"]);

export type SalesSummary = {
  source: "report" | "rows";
  from: string;
  to: string;
  transactions: number;
  revenue: number;
  average: number;
  cancelled: { count: number; amount: number };
  /** Hanya dari laporan. */
  money?: { discounts: number; tax: number; serviceFee: number; rounding: number; netItems: number; creditOutstanding: number; creditCount: number };
  growthPercent: number | null;
  previousRevenue: number | null;
  grossProfit: number | null;
  itemsSold: number | null;
  itemsWithoutCost: number;
  /** Urut jumlah terjual turun (≤ 100 teratas dari server); null bila tidak tersedia/terkunci. */
  products: ProductSales[] | null;
  productsTotal: number | null;
  /** Jumlah transaksi per jam (24) & per hari (Senin = 0); null bila tidak tersedia/terkunci. */
  perHour: number[] | null;
  perWeekday: number[] | null;
  peakHour: number | null;
  /** Produk terlaris & jam/hari ramai terkunci paket. */
  insightsLocked: boolean;
  perMethod: { method: string; amount: number }[];
  perCashier: { id: string; name: string; count: number; revenue: number; average: number; cancelled: number }[];
  /** Rata-rata per transaksi periode sebelumnya (null bila tidak ada transaksi / filter tambahan). */
  prevAverage: number | null;
  /** Pembanding per produk & per kasir dari laporan periode sebelumnya (withPrevious); null bila tidak diambil. */
  previous: {
    /** Per varian (`key`) dan per nama produk (semua varian). */
    productsByKey: Map<string, number>;
    productsByName: Map<string, number>;
    /** Daftar produk periode lalu lengkap (≤ 100) → produk yang tidak ada berarti 0. */
    productsComplete: boolean;
    cashiers: Map<string, number>;
  } | null;
  perPeriod: { label: string; count: number; revenue: number }[];
  /** Jumlah transaksi per tanggal (kosong bila periode satu hari) — dasar rata-rata per hari di kesimpulan. */
  days: { day: string; count: number }[];
  /** Jenis pesanan (makan di tempat, bawa pulang, …); hanya dari laporan. */
  orderTypes: { orderType: string | null; count: number; revenue: number }[];
  /** Perbandingan outlet (ekspor "Semua outlet" dengan > 1 outlet); diisi lewat withOutlets(). */
  outlets: { name: string; revenue: number; transactions: number; average: number; share: number; cancelled: number }[];
  hourly: boolean;
};

/** Tambahkan pembanding per produk (jumlah terjual) & per kasir (penjualan) dari laporan periode sebelumnya. */
export function withPrevious(s: SalesSummary, prev: SalesReport): SalesSummary {
  const byKey = new Map<string, number>();
  const byName = new Map<string, number>();
  for (const p of prev.products ?? []) {
    byKey.set(p.key, (byKey.get(p.key) ?? 0) + p.quantity);
    byName.set(p.name, (byName.get(p.name) ?? 0) + p.quantity);
  }
  return {
    ...s,
    previous: {
      productsByKey: byKey,
      productsByName: byName,
      productsComplete: prev.products !== null && prev.products_total !== null && prev.products_total <= prev.products.length,
      cashiers: new Map(prev.cashiers.map((c) => [c.cashier_id, c.revenue])),
    },
  };
}

/** Produk digabung per nama (semua varian/ukuran), urut jumlah terjual turun. */
export function groupProducts(products: ProductSales[]): { name: string; quantity: number; revenue: number; variants: number; isCustom: boolean }[] {
  const map = new Map<string, { name: string; quantity: number; revenue: number; variants: number; isCustom: boolean }>();
  for (const p of products) {
    const g = map.get(p.name) ?? { name: p.name, quantity: 0, revenue: 0, variants: 0, isCustom: p.is_custom };
    g.quantity += p.quantity;
    g.revenue += p.revenue;
    g.variants++;
    map.set(p.name, g);
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

/** Perubahan persen (bulat) atau null bila pembanding 0. */
export const changePct = (now: number, before: number | undefined | null): number | null =>
  before ? Math.round(((now - before) / before) * 100) : null;

/** Tambahkan perbandingan outlet dari GET /owner/reports/outlets (outlet tanpa transaksi tetap ditampilkan). */
export function withOutlets(s: SalesSummary, r: OutletsReport): SalesSummary {
  return {
    ...s,
    outlets: r.outlets.map((o) => ({ name: o.name, revenue: o.revenue, transactions: o.transactions, average: o.average, share: o.share_percent, cancelled: o.cancelled_count })),
  };
}

const rp = (n: number) => `${n < 0 ? "-" : ""}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
const num = (n: number) => n.toLocaleString("id-ID");

/** Semua tanggal kalender `from`..`to` (inklusif), format YYYY-MM-DD. */
export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  for (let t = Date.UTC(y, m - 1, d); out.length < 400; t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    if (day > to) break;
    out.push(day);
  }
  return out;
}

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
    from: r.from,
    to: r.to,
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
    growthPercent: r.growth_percent,
    previousRevenue: r.growth_percent === null ? null : r.previous.revenue,
    grossProfit: r.gross_profit,
    itemsSold: r.items_sold,
    itemsWithoutCost: r.items_without_cost,
    products: r.products ? [...r.products].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue) : null,
    productsTotal: r.products_total,
    perHour: r.per_hour,
    perWeekday: r.per_weekday,
    peakHour: r.peak_hour,
    insightsLocked: r.locked.includes("insights"),
    perMethod: r.per_method.filter((m) => m.amount !== 0).sort((a, b) => b.amount - a.amount),
    perCashier: [...r.cashiers].sort((a, b) => b.revenue - a.revenue).map((c) => ({ id: c.cashier_id, name: c.name, count: c.count, revenue: c.revenue, average: c.average, cancelled: c.cancelled })),
    prevAverage: r.previous.transactions > 0 ? Math.round(r.previous.revenue / r.previous.transactions) : null,
    previous: null,
    perPeriod: r.buckets.map((b) => ({ label: r.hourly ? `${b.start.slice(11, 13)}.00` : dayLabel(b.start.slice(0, 10)), count: b.count, revenue: b.revenue })),
    days: r.hourly ? [] : r.buckets.map((b) => ({ day: b.start.slice(0, 10), count: b.count })),
    orderTypes: r.order_types.filter((o) => o.count > 0).map((o) => ({ orderType: o.order_type, count: o.count, revenue: o.revenue })).sort((a, b) => b.revenue - a.revenue),
    outlets: [],
    hourly: r.hourly,
  };
}

/** Ringkasan dari daftar transaksi (filter tambahan aktif). Periode satu hari → per jam. */
export function summaryFromRows(rows: SaleListItem[], range: { from: string; to: string }): SalesSummary {
  const hourly = range.from === range.to;
  let transactions = 0;
  let revenue = 0;
  const cancelled = { count: 0, amount: 0 };
  const methods = new Map<string, number>();
  const cashiers = new Map<string, { id: string; name: string; count: number; revenue: number; cancelled: number }>();
  const periods = new Map<string, { count: number; revenue: number }>();
  const perHour = Array<number>(24).fill(0);
  const perWeekday = Array<number>(7).fill(0);
  for (const s of rows) {
    const c = cashiers.get(s.cashier_id) ?? { id: s.cashier_id, name: s.cashier_name, count: 0, revenue: 0, cancelled: 0 };
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
    const hour = zonedHour(s.paid_at);
    const day = zonedDay(s.paid_at);
    perHour[hour]++;
    const [y, m, d] = day.split("-").map(Number);
    perWeekday[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]++;
    const key = hourly ? `${String(hour).padStart(2, "0")}.00` : day;
    const p = periods.get(key) ?? { count: 0, revenue: 0 };
    p.count++;
    p.revenue += net;
    periods.set(key, p);
  }
  const any = transactions > 0;
  return {
    source: "rows",
    from: range.from,
    to: range.to,
    transactions,
    revenue,
    average: transactions ? Math.round(revenue / transactions) : 0,
    cancelled,
    growthPercent: null,
    previousRevenue: null,
    grossProfit: null,
    itemsSold: null,
    itemsWithoutCost: 0,
    products: null,
    productsTotal: null,
    perHour: any ? perHour : null,
    perWeekday: any && !hourly ? perWeekday : null,
    peakHour: any ? perHour.indexOf(Math.max(...perHour)) : null,
    insightsLocked: false,
    perMethod: [...methods].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
    perCashier: [...cashiers.values()]
      .filter((c) => c.count || c.cancelled)
      .map((c) => ({ ...c, average: c.count ? Math.round(c.revenue / c.count) : 0 }))
      .sort((a, b) => b.revenue - a.revenue),
    prevAverage: null,
    previous: null,
    perPeriod: [...periods]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => ({ label: hourly ? k : dayLabel(k), ...v })),
    days: hourly ? [] : daysBetween(range.from, range.to).map((day) => ({ day, count: periods.get(day)?.count ?? 0 })),
    orderTypes: [],
    outlets: [],
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
  /** Total transaksi yang cocok dengan filter (meta.total). */
  total: number;
  /** Logo usaha (data URL PNG/JPEG) untuk kepala laporan; null = tanpa logo. */
  logo?: { dataUrl: string; width: number; height: number } | null;
  /** Jumlah transaksi yang dipakai menghitung ringkasan "rows" (untuk catatan ringkasan sebagian). */
  summarizedCount: number;
  /** Ringkasan "rows" hanya dari sebagian transaksi (melebihi batas ambil). */
  partialSummary: boolean;
  generatedAt: Date;
};

type RGB = [number, number, number];
const BRAND: RGB = [184, 92, 46];
const BRAND_SOFT: RGB = [233, 196, 176];
const INK: RGB = [33, 30, 28];
const MUTED: RGB = [110, 104, 100];
const LINE: RGB = [226, 222, 218];
const TINT: RGB = [251, 240, 233];
const GREEN_TINT: RGB = [235, 245, 238];
const GREEN: RGB = [34, 120, 72];
const RED: RGB = [180, 48, 40];

type Doc = import("jspdf").jsPDF;

export async function buildSalesPdf(input: SalesPdfInput): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const M = 14;
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const CW = W - 2 * M;
  const s = input.summary;
  const insights = buildInsights(s);
  let y = M + 2;

  const lastY = () => (doc as Doc & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? y;
  /** Pindah halaman bila sisa ruang < `need` mm. */
  const ensure = (need: number) => {
    if (y + need > H - 16) {
      doc.addPage();
      y = M + 2;
    }
  };
  const heading = (text: string, need = 30) => {
    ensure(need);
    doc.setFont("helvetica", "bold").setFontSize(12.5).setTextColor(...INK).text(text, M, y + 4);
    y += 8;
  };
  const note = (text: string) => {
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    const lines = doc.splitTextToSize(text, CW) as string[];
    ensure(lines.length * 3.6 + 4);
    doc.text(lines, M, y + 3);
    y += 3 + lines.length * 3.6 + 2;
  };
  const table = (head: string[], body: string[][], rightCols: number[], widths: Record<number, number> = {}) => {
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, top: M + 2 },
      head: [head],
      body,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 1.8, textColor: INK, lineColor: LINE, lineWidth: 0.2, overflow: "ellipsize" },
      headStyles: { fillColor: TINT, textColor: INK, fontStyle: "bold" },
      columnStyles: Object.fromEntries(
        head.map((_, i) => [i, { ...(rightCols.includes(i) ? { halign: "right" as const } : {}), ...(widths[i] ? { cellWidth: widths[i] } : {}) }])
      ),
      // columnStyles hanya berlaku untuk isi; judul kolom angka ikut rata kanan.
      didParseCell: (d) => {
        if (d.section === "head" && rightCols.includes(d.column.index)) d.cell.styles.halign = "right";
      },
    });
    y = lastY() + 6;
  };
  /** Kotak berlatar dengan judul + butir kalimat (kesimpulan/saran). */
  const bulletBox = (title: string, items: string[], fill: RGB, accent: RGB) => {
    if (!items.length) return;
    doc.setFont("helvetica", "normal").setFontSize(9.5);
    const wrapped = items.map((t) => doc.splitTextToSize(t, CW - 12) as string[]);
    const bodyH = wrapped.reduce((a, l) => a + l.length * 4.4 + 1.6, 0);
    ensure(Math.min(bodyH + 14, 80));
    const startY = y;
    let cy = y + 11;
    // Gambar latar lebih dulu bila muat satu halaman; bila tidak, latar per halaman dilewati (teks tetap terbaca).
    const fits = startY + bodyH + 14 <= H - 16;
    if (fits) doc.setFillColor(...fill).roundedRect(M, startY, CW, bodyH + 14, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...accent).text(title, M + 5, y + 7);
    doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK);
    for (const lines of wrapped) {
      if (cy + lines.length * 4.4 > H - 16) {
        doc.addPage();
        cy = M + 4;
      }
      doc.setFillColor(...accent).circle(M + 6.2, cy - 1.2, 0.8, "F");
      doc.text(lines, M + 9, cy);
      cy += lines.length * 4.4 + 1.6;
    }
    y = cy + 4;
  };
  /** Kotak kesimpulan per tema: judul kotak, lalu sub-judul tema + butir kalimat. */
  const themedBox = (title: string, groups: { theme: string; items: string[] }[], fill: RGB, accent: RGB) => {
    const used = groups.filter((g) => g.items.length);
    if (!used.length) return;
    doc.setFont("helvetica", "normal").setFontSize(9.5);
    const blocks = used.map((g) => ({ theme: g.theme, lines: g.items.map((t) => doc.splitTextToSize(t, CW - 12) as string[]) }));
    const bodyH = blocks.reduce((a, b) => a + 6 + b.lines.reduce((x, l) => x + l.length * 4.4 + 1.6, 0), 0);
    ensure(Math.min(bodyH + 12, 90));
    if (y + bodyH + 12 <= H - 16) doc.setFillColor(...fill).roundedRect(M, y, CW, bodyH + 12, 2.5, 2.5, "F");
    doc.setFont("helvetica", "bold").setFontSize(11).setTextColor(...accent).text(title, M + 5, y + 7);
    let cy = y + 13;
    for (const b of blocks) {
      if (cy + 10 > H - 16) {
        doc.addPage();
        cy = M + 4;
      }
      doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(...MUTED).text(b.theme.toUpperCase(), M + 5, cy);
      cy += 4.8;
      doc.setFont("helvetica", "normal").setFontSize(9.5).setTextColor(...INK);
      for (const lines of b.lines) {
        if (cy + lines.length * 4.4 > H - 16) {
          doc.addPage();
          cy = M + 4;
        }
        doc.setFillColor(...accent).circle(M + 6.2, cy - 1.2, 0.8, "F");
        doc.text(lines, M + 9, cy);
        cy += lines.length * 4.4 + 1.6;
      }
      cy += 1.2;
    }
    y = cy + 3;
  };
  const vsPrev = (now: number, before: number | undefined | null) => {
    const c = changePct(now, before);
    return c === null ? (before === 0 ? "baru" : "-") : `${c > 0 ? "+" : ""}${c}%`;
  };
  /** Grafik batang horizontal: label kiri, batang, nilai kanan; batang tertinggi diberi warna utama. */
  const bars = (items: { label: string; value: number; text: string }[]) => {
    const max = Math.max(...items.map((i) => i.value), 1);
    const labelW = 16;
    const valueW = 26;
    const barW = CW - labelW - valueW - 4;
    const rowH = 5.4;
    ensure(items.length * rowH + 4);
    doc.setFontSize(8.5);
    for (const it of items) {
      doc.setFont("helvetica", "normal").setTextColor(...MUTED).text(it.label, M, y + 3.6);
      doc.setFillColor(...LINE).rect(M + labelW, y + 1, barW, 3.4, "F");
      const w = (it.value / max) * barW;
      if (w > 0) doc.setFillColor(...(it.value === max ? BRAND : BRAND_SOFT)).rect(M + labelW, y + 1, w, 3.4, "F");
      doc.setTextColor(...INK).text(it.text, W - M, y + 3.6, { align: "right" });
      y += rowH;
    }
    y += 4;
  };

  // ——— Kepala ———
  doc.setFont("helvetica", "bold").setFontSize(18).setTextColor(...INK).text("Laporan Penjualan", M, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(...MUTED).text(input.businessName, M, y + 10.5);
  if (input.logo) {
    // Muat dalam kotak 32 × 14 mm di kanan atas, rasio dijaga.
    const k = Math.min(32 / input.logo.width, 14 / input.logo.height);
    const lw = input.logo.width * k;
    const lh = input.logo.height * k;
    try {
      doc.addImage(input.logo.dataUrl, W - M - lw, y + 12 - lh, lw, lh);
    } catch {
      // Gambar tidak dikenali jsPDF → laporan tetap dibuat tanpa logo.
    }
  }
  doc.setDrawColor(...BRAND).setLineWidth(0.8).line(M, y + 14, W - M, y + 14);
  y += 19;
  const ongoing = s.to === zonedToday();
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    styles: { fontSize: 9.5, cellPadding: { top: 0.7, bottom: 0.7, left: 0, right: 2 }, textColor: INK },
    columnStyles: { 0: { cellWidth: 22, textColor: MUTED } },
    body: [
      ["Outlet", input.outletLabel],
      ["Periode", ongoing ? `${input.periodLabel} · hari ini masih berjalan` : input.periodLabel],
      ["Filter", input.filters.length ? input.filters.join(" · ") : "Tanpa filter tambahan"],
      ["Dibuat", `${formatDateTime(input.generatedAt.toISOString())} ${zoneLabel()}`],
      ["Catatan", "Hanya transaksi dari perangkat kasir yang sudah sinkron; transaksi yang dibuat saat offline masuk setelah perangkat tersambung internet."],
    ],
  });
  y = lastY() + 5;

  // ——— Angka utama ———
  const growth =
    s.growthPercent === null ? "" : s.growthPercent === 0 ? "sama dgn periode lalu" : `${s.growthPercent > 0 ? "+" : "-"}${Math.abs(s.growthPercent)}% vs periode lalu`;
  const kpis: [string, string, string][] = [
    ["Penjualan", rp(s.revenue), growth],
    ["Transaksi", num(s.transactions), `rata-rata ${rp(s.average)}${s.prevAverage ? ` (${vsPrev(s.average, s.prevAverage)})` : ""}`],
    s.grossProfit !== null ? ["Laba kotor", rp(s.grossProfit), s.money?.netItems ? `margin ${Math.round((s.grossProfit / s.money.netItems) * 100)}%` : ""] : ["Item terjual", s.itemsSold !== null ? num(s.itemsSold) : "-", ""],
    ["Dibatalkan", num(s.cancelled.count), rp(s.cancelled.amount)],
  ];
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    theme: "plain",
    body: [kpis.map((k) => k[0]), kpis.map((k) => k[1]), kpis.map((k) => k[2])],
    styles: { fontSize: 8.5, textColor: MUTED, cellPadding: { top: 0.4, bottom: 0.4, left: 3, right: 3 }, fillColor: TINT },
    didParseCell: (d) => {
      if (d.row.index === 0) d.cell.styles.cellPadding = { top: 3, bottom: 0.4, left: 3, right: 3 };
      if (d.row.index === 1) {
        d.cell.styles.fontSize = 14;
        d.cell.styles.fontStyle = "bold";
        d.cell.styles.textColor = INK;
      }
      if (d.row.index === 2) {
        d.cell.styles.cellPadding = { top: 0.4, bottom: 3, left: 3, right: 3 };
        if (d.column.index === 0 && s.growthPercent) d.cell.styles.textColor = s.growthPercent > 0 ? GREEN : RED;
      }
    },
  });
  y = lastY() + 6;

  // ——— Kesimpulan & saran ———
  themedBox(
    "Kesimpulan periode ini",
    THEMES.map((theme) => ({ theme, items: insights.conclusions.filter((c) => c.theme === theme).map((c) => c.text) })),
    TINT,
    BRAND
  );
  bulletBox("Saran", insights.suggestions, GREEN_TINT, GREEN);
  if (insights.suggestions.length) note("Saran dibuat otomatis dari pola data penjualan periode ini sebagai bahan pertimbangan, bukan nasihat keuangan.");
  if (s.insightsLocked) note("Produk terlaris serta jam & hari ramai tersedia di paket Pro (atur langganan lewat aplikasi Sissi).");
  if (s.source === "rows") {
    note(
      `Ada filter tambahan, jadi angka dihitung dari transaksi yang cocok; produk terlaris, laba, dan rincian diskon/pajak hanya tersedia tanpa filter tambahan.${
        input.partialSummary ? ` Hanya ${num(input.summarizedCount)} dari ${num(input.total)} transaksi pertama yang dihitung - persempit periode untuk angka lengkap.` : ""
      }`
    );
  }

  // ——— Produk terlaris ———
  const products = (s.products ?? []).filter((p) => p.quantity > 0);
  if (products.length) {
    y += 2;
    heading("Produk terlaris", 70);
    const top = products.slice(0, 10);
    const prev = s.previous;
    table(
      ["#", "Produk", "Terjual", ...(prev ? ["vs lalu"] : []), "Penjualan", "Porsi item"],
      top.map((p, i) => [
        String(i + 1),
        p.variant_name ? `${p.name} (${p.variant_name})` : p.name,
        num(p.quantity),
        ...(prev ? [vsPrev(p.quantity, prev.productsByKey.get(p.key) ?? (prev.productsComplete ? 0 : null))] : []),
        rp(p.revenue),
        s.itemsSold ? `${Math.round((p.quantity / s.itemsSold) * 100)}%` : "-",
      ]),
      prev ? [0, 2, 3, 4, 5] : [0, 2, 3, 4],
      prev ? { 0: 9, 2: 18, 3: 18, 4: 28, 5: 20 } : { 0: 9, 2: 20, 3: 30, 4: 22 }
    );
    y -= 4;
    note(
      `Penjualan produk = subtotal baris setelah diskon per item, sebelum diskon nota & pajak. Porsi item = bagian dari semua item terjual.${
        prev ? " vs lalu = perubahan jumlah terjual dibanding periode sebelumnya dengan panjang sama." : ""
      }`
    );
  }

  // ——— Pola hari & jam ———
  const hasWeekday = !!s.perWeekday?.some((n) => n > 0) && !s.hourly;
  const hasHour = !!s.perHour?.some((n) => n > 0);
  if (hasWeekday || hasHour) {
    heading("Kapan pelanggan paling ramai", 60);
    if (hasWeekday) {
      ensure(7 * 5.4 + 12); // judul + 7 batang tetap satu halaman
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...INK).text("Jumlah transaksi per hari (total sepanjang periode)", M, y + 3);
      y += 6;
      bars(s.perWeekday!.map((n, i) => ({ label: WEEKDAYS_SHORT[i], value: n, text: `${num(n)} trx` })));
      if (ongoing) {
        y -= 2;
        note(`${WEEKDAYS_SHORT[(new Date(`${s.to}T00:00:00Z`).getUTCDay() + 6) % 7]} termasuk hari ini yang masih berjalan, jadi batangnya bisa tampak lebih rendah.`);
      }
    }
    if (hasHour) {
      const hours = s.perHour!;
      const active = hours.map((n, h) => [h, n] as const).filter(([, n]) => n > 0);
      const first = active[0][0];
      const last = active[active.length - 1][0];
      ensure((last - first + 1) * 5.4 + 12); // judul + semua batang jam tetap satu halaman
      doc.setFont("helvetica", "bold").setFontSize(9.5).setTextColor(...INK);
      doc.text("Jumlah transaksi per jam (total sepanjang periode)", M, y + 3);
      y += 6;
      bars(
        hours
          .slice(first, last + 1)
          .map((n, i) => ({ label: `${String(first + i).padStart(2, "0")}.00`, value: n, text: `${num(n)} trx` }))
      );
    }
  }

  // ——— Outlet ———
  if (s.outlets.length > 1) {
    heading("Perbandingan outlet");
    table(
      ["Outlet", "Transaksi", "Penjualan", "Porsi", "Rata-rata", "Dibatalkan"],
      s.outlets.map((o) => [o.name, num(o.transactions), rp(o.revenue), `${o.share.toLocaleString("id-ID")}%`, rp(o.average), num(o.cancelled)]),
      [1, 2, 3, 4, 5]
    );
  }

  // ——— Kasir ———
  if (s.perCashier.length) {
    heading("Kinerja kasir");
    const prevC = s.previous?.cashiers;
    table(
      ["Kasir", "Transaksi", "Penjualan", ...(prevC ? ["vs lalu"] : []), "Porsi", "Rata-rata", "Dibatalkan"],
      s.perCashier.map((c) => [
        c.name,
        num(c.count),
        rp(c.revenue),
        ...(prevC ? [vsPrev(c.revenue, prevC.get(c.id) ?? 0)] : []),
        s.revenue ? `${Math.round((c.revenue / s.revenue) * 100)}%` : "-",
        rp(c.average),
        num(c.cancelled),
      ]),
      prevC ? [1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5]
    );
  }

  // ——— Metode bayar ———
  if (s.perMethod.length) {
    const sum = s.perMethod.reduce((a, b) => a + Math.max(0, b.amount), 0);
    heading("Metode bayar");
    table(
      ["Metode", "Nominal", "Porsi"],
      s.perMethod.map((m) => [labelOf(METHODS, m.method), rp(m.amount), sum && m.amount > 0 ? `${Math.round((m.amount / sum) * 100)}%` : "-"]),
      [1, 2]
    );
    if (s.source === "report") {
      y -= 4;
      note("Dari pembayaran yang diterima di periode ini, termasuk pengembalian (negatif).");
    }
  }

  // ——— Jenis pesanan ———
  if (s.orderTypes.length) {
    const sum = s.orderTypes.reduce((a, o) => a + o.revenue, 0);
    heading("Jenis pesanan");
    table(
      ["Jenis", "Transaksi", "Penjualan", "Porsi"],
      s.orderTypes.map((o) => [orderTypeLabel(o.orderType), num(o.count), rp(o.revenue), sum ? `${Math.round((o.revenue / sum) * 100)}%` : "-"]),
      [1, 2, 3]
    );
  }

  // ——— Rincian uang ———
  if (s.money) {
    const m = s.money;
    heading("Rincian penjualan");
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
        ...(s.grossProfit !== null ? [["Laba kotor", rp(s.grossProfit), "Pendapatan bersih dikurangi modal (HPP)"]] : []),
        ["Piutang kasbon (semua tanggal)", rp(m.creditOutstanding), `${num(m.creditCount)} transaksi belum lunas`],
      ],
      didParseCell: (d) => {
        const label = String(d.row.raw && (d.row.raw as string[])[0]);
        if (d.column.index < 2 && (label.startsWith("Penjualan") || label === "Pendapatan bersih" || label === "Laba kotor")) d.cell.styles.fontStyle = "bold";
      },
    });
    y = lastY() + 3;
    note("Angka sama dengan halaman Laporan: penjualan = transaksi lunas + kasbon (sesudah refund sebagian); pembatalan & refund penuh dihitung terpisah.");
    y += 3;
  }

  // ——— Per hari / per jam ———
  if (s.perPeriod.some((p) => p.count)) {
    heading(s.hourly ? "Penjualan per jam" : "Penjualan per hari");
    const rowsP = (s.hourly ? s.perPeriod.filter((p) => p.count) : s.perPeriod).map((p) => [p.label, num(p.count), rp(p.revenue)]);
    table([s.hourly ? "Jam" : "Tanggal", "Transaksi", "Penjualan"], rowsP, [1, 2]);
  }
  note("Laporan ini berisi ringkasan dan analisis. Untuk daftar per transaksi, gunakan Ekspor CSV di halaman Transaksi.");

  // ——— Kaki: nomor halaman ———
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(...MUTED);
    doc.text(`${input.businessName} · Laporan Penjualan · ${input.periodLabel}`, M, H - 8);
    doc.text(`Halaman ${i} dari ${pages}`, W - M, H - 8, { align: "right" });
  }
  return doc.output("blob");
}
