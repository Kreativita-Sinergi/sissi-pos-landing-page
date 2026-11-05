// Kesimpulan & saran otomatis untuk laporan PDF Transaksi. Aturan tetap (bukan AI) agar setiap kalimat bisa
// ditelusuri ke angka di laporan yang sama dan diuji. Masukan = SalesSummary (dari laporan server atau dari transaksi
// yang cocok dengan filter). Kalimat hanya dibuat bila datanya cukup; ambang di bawah sengaja konservatif.
import { changePct, groupProducts, type SalesSummary } from "./salesPdf";
import { zonedToday } from "./tz";
import { labelOf, METHODS, orderTypeLabel, WEEKDAYS } from "@/components/owner/labels";

/** Urutan tema kesimpulan di PDF. */
export const THEMES = ["Penjualan", "Produk", "Waktu ramai", "Tim & outlet", "Pembayaran & lainnya"] as const;
export type Theme = (typeof THEMES)[number];
export type Insights = { conclusions: { theme: Theme; text: string }[]; suggestions: string[] };

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
  /** Tren produk: minimal terjual periode lalu agar persen bermakna, dan perubahan minimal (persen). */
  trendMinBase: 10,
  trendMinChange: 20,
  /** Penurunan produk (persen) yang memicu saran. */
  productDrop: -30,
  /** Perubahan rata-rata per transaksi / penjualan kasir (persen) yang layak disebut. */
  averageChange: 3,
  cashierChange: 10,
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
  const conclusions: Insights["conclusions"] = [];
  const suggestions: string[] = [];
  const add = (theme: Theme, text: string) => conclusions.push({ theme, text });
  if (s.transactions === 0) {
    add("Penjualan", "Belum ada penjualan pada periode ini.");
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
  add("Penjualan", sales);
  const avgChange = changePct(s.average, s.prevAverage);
  if (avgChange !== null && s.prevAverage !== null && Math.abs(avgChange) >= THRESHOLDS.averageChange) {
    add(
      "Penjualan",
      `Rata-rata belanja per transaksi ${avgChange > 0 ? "naik" : "turun"} ${Math.abs(avgChange)}% (${rp(s.prevAverage)} menjadi ${rp(s.average)})${
        avgChange > 0 ? ", tanda pelanggan membeli lebih banyak per kunjungan" : ""
      }.`
    );
  }

  // ——— Outlet ———
  const outlets = s.outlets.filter((o) => o.transactions > 0);
  if (s.outlets.length > 1 && outlets.length) {
    const best = s.outlets[0];
    add("Tim & outlet", `Outlet dengan penjualan tertinggi: ${best.name}, ${rp(best.revenue)} (${best.share.toLocaleString("id-ID")}% dari semua outlet).`);
    const idle = s.outlets.filter((o) => o.transactions === 0);
    if (idle.length) suggestions.push(`${idle.map((o) => o.name).join(", ")} tidak mencatat transaksi pada periode ini. Pastikan perangkat kasirnya aktif dan sudah sinkron.`);
  }

  // ——— Produk ———
  // Kesimpulan memakai produk digabung per nama (semua varian/ukuran); tabel PDF tetap per varian.
  const products = groupProducts((s.products ?? []).filter((p) => p.quantity > 0));
  if (products.length) {
    const top = products[0];
    const name = top.variants > 1 ? `${top.name} (semua varian)` : top.name;
    const share = s.itemsSold ? ` (${pct(top.quantity, s.itemsSold)}% dari semua item terjual)` : "";
    add("Produk", `Produk paling laris: ${name}, terjual ${num(top.quantity)} porsi senilai ${rp(top.revenue)}${share}.`);
    if (products.length >= 3 && s.itemsSold) {
      const top3 = products.slice(0, 3);
      add("Produk", `Tiga produk teratas (${top3.map((p) => p.name).join(", ")}) menyumbang ${pct(top3.reduce((a, p) => a + p.quantity, 0), s.itemsSold)}% item terjual.`);
    }
    suggestions.push(`Jaga stok ${top.name} dan bahan bakunya selalu cukup, terutama menjelang jam ramai; jadikan andalan di menu atau paket bundling.`);

    // Tren dibanding periode lalu (produk menu yang cukup laku di periode lalu).
    const prev = s.previous;
    if (prev) {
      const moves = products
        .filter((p) => !p.isCustom)
        .map((p) => ({ p, before: prev.productsByName.get(p.name) ?? 0, change: changePct(p.quantity, prev.productsByName.get(p.name)) }))
        .filter((m): m is { p: (typeof products)[number]; before: number; change: number } => m.change !== null && m.before >= THRESHOLDS.trendMinBase);
      const up = moves.filter((m) => m.change >= THRESHOLDS.trendMinChange).sort((a, b) => b.change - a.change)[0];
      const down = moves.filter((m) => m.change <= -THRESHOLDS.trendMinChange).sort((a, b) => a.change - b.change)[0];
      if (up) add("Produk", `Naik paling tinggi: ${up.p.name}, ${num(up.p.quantity)} porsi (+${up.change}% dari ${num(up.before)} di periode lalu).`);
      if (down) {
        add("Produk", `Turun paling dalam: ${down.p.name}, ${num(down.p.quantity)} porsi (${down.change}% dari ${num(down.before)} di periode lalu).`);
        if (down.change <= THRESHOLDS.productDrop) {
          suggestions.push(`Penjualan ${down.p.name} turun ${Math.abs(down.change)}% dari periode lalu. Cek ketersediaan stok, konsistensi rasa, atau posisinya di menu.`);
        }
      }
    }

    // Produk paling jarang laku hanya bila daftar produk lengkap (server mengirim ≤ 100 teratas): produk menu (bukan
    // item cepat) yang terjual ≤ 10% dari VARIAN terlaris (bukan gabungan, agar produk bervarian tidak menaikkan ambang).
    const complete = s.productsTotal !== null && s.productsTotal <= (s.products ?? []).length;
    const topVariant = Math.max(...(s.products ?? []).map((p) => p.quantity));
    const slow = complete ? products.filter((p) => !p.isCustom && p.quantity <= topVariant * 0.1).slice(-3).reverse() : [];
    if (slow.length) {
      suggestions.push(
        `${slow.map((p) => `${p.name} (${num(p.quantity)})`).join(", ")} paling jarang terjual. Evaluasi harga, resep, atau tampilannya di menu; pertimbangkan menghapus yang tidak bergerak.`
      );
    }
  }

  // ——— Kasir ———
  const cashiers = s.perCashier.filter((c) => c.count > 0);
  if (cashiers.length > 1) {
    const top = cashiers[0];
    add("Tim & outlet", `Kasir dengan penjualan tertinggi: ${top.name}, ${rp(top.revenue)} dari ${num(top.count)} transaksi (${pct(top.revenue, s.revenue)}% dari penjualan).`);
    const prevC = s.previous?.cashiers;
    if (prevC) {
      const moves = cashiers
        .map((c) => ({ c, change: changePct(c.revenue, prevC.get(c.id)) }))
        .filter((m): m is { c: (typeof cashiers)[number]; change: number } => m.change !== null && Math.abs(m.change) >= THRESHOLDS.cashierChange)
        .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
        .slice(0, 2);
      if (moves.length) {
        add("Tim & outlet", `Dibanding periode lalu: ${moves.map((m) => `penjualan ${m.c.name} ${m.change > 0 ? "naik" : "turun"} ${Math.abs(m.change)}%`).join(", ")}.`);
      }
    }
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
    add("Tim & outlet", `Semua transaksi dicatat oleh ${cashiers[0].name}.`);
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
    add("Waktu ramai", `Hari teramai: ${WEEKDAYS[best[0]]}, rata-rata ${num(Math.round(best[1]))} transaksi per hari${skippedToday ? " (hari ini belum dihitung karena masih berjalan)" : ""}.`);
    const avgOf = (idx: number[]) => {
      const n = idx.reduce((a, i) => a + occ[i], 0);
      return n ? idx.reduce((a, i) => a + sum[i], 0) / n : null;
    };
    const we = avgOf([5, 6]);
    const wd = avgOf([0, 1, 2, 3, 4]);
    if (we !== null && wd !== null && wd > 0 && we > 0 && Math.abs(we / wd - 1) >= 0.1) {
      add("Waktu ramai", 
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
    add("Waktu ramai", 
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
    add("Pembayaran & lainnya", `${orderTypeLabel(top.orderType)} paling banyak (${pct(top.revenue, sum)}% penjualan, ${num(top.count)} transaksi).`);
  }

  // ——— Metode bayar ———
  const positive = s.perMethod.filter((m) => m.amount > 0);
  const paid = positive.reduce((a, m) => a + m.amount, 0);
  if (positive.length) {
    const top = positive[0];
    add("Pembayaran & lainnya", `${labelOf(METHODS, top.method)} jadi metode bayar terbanyak (${pct(top.amount, paid)}% nominal).`);
    const cash = positive.find((m) => m.method === "cash");
    if (cash && paid && cash.amount / paid >= THRESHOLDS.cashShare) {
      suggestions.push(`Tunai masih ${pct(cash.amount, paid)}% pembayaran. Tawarkan QRIS untuk mempercepat antrean dan mengurangi selisih kas.`);
    }
  }

  // ——— Laba ———
  if (s.grossProfit !== null && s.money && s.money.netItems > 0) {
    add("Penjualan", `Laba kotor ${rp(s.grossProfit)} (margin ${pct(s.grossProfit, s.money.netItems)}% dari pendapatan bersih).`);
  }
  if (s.itemsWithoutCost > 0) {
    suggestions.push(`${num(s.itemsWithoutCost)} baris penjualan belum punya harga modal (HPP). Lengkapi HPP produk agar laba kotor terhitung akurat.`);
  }

  // ——— Pembatalan, diskon, kasbon ———
  const attempts = s.transactions + s.cancelled.count;
  if (s.cancelled.count > 0) {
    const rate = s.cancelled.count / attempts;
    add("Pembayaran & lainnya", `${num(s.cancelled.count)} transaksi dibatalkan atau dikembalikan senilai ${rp(s.cancelled.amount)} (${(Math.round(rate * 1000) / 10).toLocaleString("id-ID")}% dari transaksi).`);
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
