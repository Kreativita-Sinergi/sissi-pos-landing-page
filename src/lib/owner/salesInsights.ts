// Kesimpulan & saran otomatis untuk laporan PDF Transaksi. Aturan tetap (bukan AI) agar setiap kalimat bisa
// ditelusuri ke angka di laporan yang sama dan diuji. Masukan = SalesSummary (dari laporan server atau dari transaksi
// yang cocok dengan filter). Kalimat hanya dibuat bila datanya cukup; ambang di bawah sengaja konservatif.
import type { SalesSummary } from "./salesPdf";
import { zonedToday } from "./tz";
import { labelOf, METHODS, orderTypeLabel, WEEKDAYS } from "@/components/owner/labels";

export type Insights = { conclusions: string[]; suggestions: string[] };

/** Ambang saran (dipakai juga oleh tes). */
export const THRESHOLDS = {
  /** Rasio pembatalan terhadap (transaksi + batal) yang dianggap tinggi. */
  cancelRate: 0.03,
  /** Diskon terhadap penjualan yang perlu ditinjau. */
  discountRate: 0.1,
  /** Penurunan penjualan (persen) yang memicu saran promo. */
  growthDrop: -5,
  /** Selisih rata-rata transaksi antar kasir (rasio) yang layak dibagikan caranya. */
  cashierGap: 1.25,
  /** Minimal transaksi per kasir agar perbandingan rata-rata adil. */
  cashierMinCount: 20,
  /** Porsi tunai yang dianggap dominan. */
  cashShare: 0.6,
} as const;

const rp = (n: number) => `${n < 0 ? "-" : ""}Rp${Math.round(Math.abs(n)).toLocaleString("id-ID")}`;
const num = (n: number) => n.toLocaleString("id-ID");
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const hourLabel = (h: number) => `${String(h).padStart(2, "0")}.00`;

/** Blok dua jam berurutan dengan transaksi terbanyak: [jam mulai, jumlah]. */
function busiestTwoHours(perHour: number[]): [number, number] | null {
  let best: [number, number] | null = null;
  for (let h = 0; h < 23; h++) {
    const n = perHour[h] + perHour[h + 1];
    if (n > 0 && (!best || n > best[1])) best = [h, n];
  }
  return best;
}

export function buildInsights(s: SalesSummary): Insights {
  const conclusions: string[] = [];
  const suggestions: string[] = [];
  if (s.transactions === 0) {
    conclusions.push("Belum ada penjualan pada periode ini.");
    return { conclusions, suggestions };
  }

  // ——— Penjualan & pembanding ———
  let sales = `Penjualan periode ini ${rp(s.revenue)} dari ${num(s.transactions)} transaksi, rata-rata ${rp(s.average)} per transaksi`;
  if (s.growthPercent !== null && s.previousRevenue !== null) {
    sales +=
      s.growthPercent === 0
        ? `, sama dengan periode sebelumnya.`
        : `, ${s.growthPercent > 0 ? "naik" : "turun"} ${Math.abs(s.growthPercent)}% dibanding periode sebelumnya (${rp(s.previousRevenue)}).`;
  } else {
    sales += ".";
  }
  conclusions.push(sales);

  // ——— Outlet ———
  const outlets = s.outlets.filter((o) => o.transactions > 0);
  if (s.outlets.length > 1 && outlets.length) {
    const best = s.outlets[0];
    conclusions.push(`Outlet dengan penjualan tertinggi: ${best.name}, ${rp(best.revenue)} (${best.share.toLocaleString("id-ID")}% dari semua outlet).`);
    const idle = s.outlets.filter((o) => o.transactions === 0);
    if (idle.length) suggestions.push(`${idle.map((o) => o.name).join(", ")} tidak mencatat transaksi pada periode ini. Pastikan perangkat kasirnya aktif dan sudah sinkron.`);
  }

  // ——— Produk ———
  const products = (s.products ?? []).filter((p) => p.quantity > 0);
  if (products.length) {
    const top = products[0];
    const name = productName(top);
    const share = s.itemsSold ? ` (${pct(top.quantity, s.itemsSold)}% dari semua item terjual)` : "";
    conclusions.push(`Produk paling laris: ${name}, terjual ${num(top.quantity)} porsi senilai ${rp(top.revenue)}${share}.`);
    if (products.length >= 3 && s.itemsSold) {
      const top3 = products.slice(0, 3);
      conclusions.push(`Tiga produk teratas (${top3.map(productName).join(", ")}) menyumbang ${pct(top3.reduce((a, p) => a + p.quantity, 0), s.itemsSold)}% item terjual.`);
    }
    suggestions.push(`Jaga stok ${name} dan bahan bakunya selalu cukup, terutama menjelang jam ramai; jadikan andalan di menu atau paket bundling.`);
    // Produk paling jarang laku hanya bila daftar produk lengkap (server mengirim ≤ 100 teratas).
    const complete = s.productsTotal !== null && s.productsTotal <= (s.products ?? []).length;
    // Hanya produk menu (bukan item cepat) yang terjual ≤ 10% dari produk terlaris.
    const slow = complete ? products.filter((p) => !p.is_custom && p.quantity <= top.quantity * 0.1).slice(-3).reverse() : [];
    if (slow.length) {
      suggestions.push(
        `${slow.map((p) => `${productName(p)} (${num(p.quantity)})`).join(", ")} paling jarang terjual. Evaluasi harga, resep, atau tampilannya di menu; pertimbangkan menghapus yang tidak bergerak.`
      );
    }
  }

  // ——— Kasir ———
  const cashiers = s.perCashier.filter((c) => c.count > 0);
  if (cashiers.length > 1) {
    const top = cashiers[0];
    conclusions.push(`Kasir dengan penjualan tertinggi: ${top.name}, ${rp(top.revenue)} dari ${num(top.count)} transaksi (${pct(top.revenue, s.revenue)}% dari penjualan).`);
    const fair = cashiers.filter((c) => c.count >= THRESHOLDS.cashierMinCount).sort((a, b) => b.average - a.average);
    if (fair.length > 1) {
      const hi = fair[0];
      const lo = fair[fair.length - 1];
      if (lo.average > 0 && hi.average / lo.average >= THRESHOLDS.cashierGap) {
        suggestions.push(
          `Rata-rata transaksi ${hi.name} (${rp(hi.average)}) ${Math.round((hi.average / lo.average - 1) * 100)}% lebih tinggi dari ${lo.name} (${rp(lo.average)}). Bagikan cara ${hi.name} menawarkan menu tambahan ke kasir lain.`
        );
      }
    }
  } else if (cashiers.length === 1) {
    conclusions.push(`Semua transaksi dicatat oleh ${cashiers[0].name}.`);
  }

  // ——— Hari ———
  // Rata-rata per hari dari data harian. Hari ini dikeluarkan bila masih berjalan (data setengah hari membuat hari itu
  // tampak sepi). Tanggal tanpa transaksi tetap dihitung (bisa berarti tutup — tetap informasi yang benar).
  const today = zonedToday();
  const days = s.days.filter((d) => d.day !== today);
  const skippedToday = days.length < s.days.length;
  // Minimal 5 hari penuh (mis. "7 hari terakhir" = 6 hari penuh + hari ini) agar perbandingan hari bermakna.
  if (days.length >= 5 && days.some((d) => d.count > 0)) {
    const sum = [0, 0, 0, 0, 0, 0, 0];
    const occ = [0, 0, 0, 0, 0, 0, 0];
    for (const d of days) {
      const i = weekdayIndex(d.day);
      sum[i] += d.count;
      occ[i]++;
    }
    const ranked = sum.map((n, i) => [i, occ[i] ? n / occ[i] : null] as const).filter((x): x is readonly [number, number] => x[1] !== null);
    const best = ranked.reduce((a, b) => (b[1] > a[1] ? b : a));
    const worst = ranked.reduce((a, b) => (b[1] < a[1] ? b : a));
    conclusions.push(`Hari teramai: ${WEEKDAYS[best[0]]}, rata-rata ${num(Math.round(best[1]))} transaksi per hari${skippedToday ? " (hari ini belum dihitung karena masih berjalan)" : ""}.`);
    const avgOf = (idx: number[]) => {
      const n = idx.reduce((a, i) => a + occ[i], 0);
      return n ? idx.reduce((a, i) => a + sum[i], 0) / n : null;
    };
    const we = avgOf([5, 6]);
    const wd = avgOf([0, 1, 2, 3, 4]);
    if (we !== null && wd !== null && wd > 0 && we > 0 && Math.abs(we / wd - 1) >= 0.1) {
      conclusions.push(
        we > wd
          ? `Akhir pekan ${Math.round((we / wd - 1) * 100)}% lebih ramai dari hari kerja (${num(Math.round(we))} vs ${num(Math.round(wd))} transaksi per hari).`
          : `Hari kerja ${Math.round((wd / we - 1) * 100)}% lebih ramai dari akhir pekan (${num(Math.round(wd))} vs ${num(Math.round(we))} transaksi per hari).`
      );
    }
    if (best[0] !== worst[0] && worst[1] < best[1] * 0.75) {
      suggestions.push(
        `${WEEKDAYS[worst[0]]} paling sepi (rata-rata ${num(Math.round(worst[1]))} transaksi). Coba promo khusus ${WEEKDAYS[worst[0]]} atau paket hemat untuk menarik pengunjung.`
      );
    }
  }

  // ——— Jam ———
  if (s.perHour && s.perHour.some((n) => n > 0)) {
    const total = s.perHour.reduce((a, b) => a + b, 0);
    const peak = s.peakHour ?? s.perHour.indexOf(Math.max(...s.perHour));
    const block = busiestTwoHours(s.perHour);
    conclusions.push(
      `Jam tersibuk ${hourLabel(peak)}–${hourLabel(peak + 1)}${
        block ? `; rentang ${hourLabel(block[0])}–${hourLabel(block[0] + 2)} menyumbang ${pct(block[1], total)}% transaksi` : ""
      }.`
    );
    suggestions.push(`Siapkan kasir, barista, dan bahan sebelum ${hourLabel(Math.max(0, (block?.[0] ?? peak) - 1))} agar antrean jam ramai tetap cepat.`);
    // Jam sepi di dalam jam buka (antara jam pertama & terakhir yang ada transaksi).
    const open = s.perHour.map((n, h) => [h, n] as const).filter(([, n]) => n > 0);
    const first = open[0][0];
    const last = open[open.length - 1][0];
    const inside = s.perHour.map((n, h) => [h, n] as const).filter(([h]) => h > first && h < last);
    if (inside.length >= 3) {
      const quiet = inside.reduce((a, b) => (b[1] < a[1] ? b : a));
      if (quiet[1] < (s.perHour[peak] || 0) * 0.3) {
        suggestions.push(`Jam ${hourLabel(quiet[0])}–${hourLabel(quiet[0] + 1)} sepi. Pertimbangkan happy hour atau promo paket di jam itu.`);
      }
    }
  }

  // ——— Jenis pesanan ———
  if (s.orderTypes.length > 1) {
    const sum = s.orderTypes.reduce((a, o) => a + o.revenue, 0);
    const top = s.orderTypes[0];
    conclusions.push(`${orderTypeLabel(top.orderType)} paling banyak (${pct(top.revenue, sum)}% penjualan, ${num(top.count)} transaksi).`);
  }

  // ——— Metode bayar ———
  const positive = s.perMethod.filter((m) => m.amount > 0);
  const paid = positive.reduce((a, m) => a + m.amount, 0);
  if (positive.length) {
    const top = positive[0];
    conclusions.push(`${labelOf(METHODS, top.method)} jadi metode bayar terbanyak (${pct(top.amount, paid)}% nominal).`);
    const cash = positive.find((m) => m.method === "cash");
    if (cash && paid && cash.amount / paid >= THRESHOLDS.cashShare) {
      suggestions.push(`Tunai masih ${pct(cash.amount, paid)}% pembayaran. Tawarkan QRIS untuk mempercepat antrean dan mengurangi selisih kas.`);
    }
  }

  // ——— Laba ———
  if (s.grossProfit !== null && s.money && s.money.netItems > 0) {
    conclusions.push(`Laba kotor ${rp(s.grossProfit)} (margin ${pct(s.grossProfit, s.money.netItems)}% dari pendapatan bersih).`);
  }
  if (s.itemsWithoutCost > 0) {
    suggestions.push(`${num(s.itemsWithoutCost)} baris penjualan belum punya harga modal (HPP). Lengkapi HPP produk agar laba kotor terhitung akurat.`);
  }

  // ——— Pembatalan, diskon, kasbon ———
  const attempts = s.transactions + s.cancelled.count;
  if (s.cancelled.count > 0) {
    const rate = s.cancelled.count / attempts;
    conclusions.push(`${num(s.cancelled.count)} transaksi dibatalkan atau dikembalikan senilai ${rp(s.cancelled.amount)} (${(Math.round(rate * 1000) / 10).toLocaleString("id-ID")}% dari transaksi).`);
    if (rate >= THRESHOLDS.cancelRate) {
      const worst = [...s.perCashier].sort((a, b) => b.cancelled - a.cancelled)[0];
      suggestions.push(
        `Rasio pembatalan ${(Math.round(rate * 1000) / 10).toLocaleString("id-ID")}% cukup tinggi${worst?.cancelled ? `, terbanyak oleh ${worst.name} (${num(worst.cancelled)})` : ""}. Cek alasannya di halaman Aktivitas.`
      );
    }
  }
  if (s.money && s.revenue > 0 && s.money.discounts / s.revenue >= THRESHOLDS.discountRate) {
    suggestions.push(`Diskon mencapai ${pct(s.money.discounts, s.revenue)}% dari penjualan (${rp(s.money.discounts)}). Pastikan promo yang berjalan masih menguntungkan.`);
  }
  if (s.money && s.money.creditOutstanding > 0) {
    suggestions.push(`Ada kasbon belum lunas ${rp(s.money.creditOutstanding)} dari ${num(s.money.creditCount)} transaksi. Tagih secara berkala.`);
  }
  if (s.growthPercent !== null && s.growthPercent <= THRESHOLDS.growthDrop) {
    suggestions.push(`Penjualan turun ${Math.abs(s.growthPercent)}% dari periode sebelumnya. Aktifkan promo atau program loyalti member untuk mengajak pelanggan kembali.`);
  }

  return { conclusions, suggestions };
}

/** Senin = 0 dari tanggal kalender YYYY-MM-DD. */
function weekdayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function productName(p: { name: string; variant_name: string | null }): string {
  return p.variant_name ? `${p.name} (${p.variant_name})` : p.name;
}
