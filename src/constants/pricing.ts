export interface PricingPlan {
  id: "free" | "pro";
  name: string;
  tagline: string;
  badge?: string;
  priceMonthly: string;
  priceYearly: string;
  periodMonthly: string;
  periodYearly: string;
  equivalentNote?: string;
  ctaText: string;
  ctaVariant: "outline" | "primary";
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Gratis",
    tagline: "Untuk usaha yang baru mulai",
    priceMonthly: "Rp0",
    priceYearly: "Rp0",
    periodMonthly: "selamanya",
    periodYearly: "selamanya",
    ctaText: "Mulai gratis",
    ctaVariant: "outline",
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Semua fitur untuk usaha yang berkembang",
    badge: "SEMUA FITUR",
    priceMonthly: "Rp59rb",
    priceYearly: "Rp590rb",
    periodMonthly: "/bulan",
    periodYearly: "/tahun",
    equivalentNote: "setara Rp49rb per bulan (hemat 2 bulan)",
    ctaText: "Coba gratis 30 hari",
    ctaVariant: "primary",
  },
];

export interface FeatureComparisonItem {
  name: string;
  freeValue: string | boolean;
  proValue: string | boolean;
}

export const PRICING_FEATURES: FeatureComparisonItem[] = [
  {
    name: "Transaksi per bulan",
    freeValue: "50",
    proValue: "Tanpa batas",
  },
  {
    name: "Outlet",
    freeValue: "1",
    proValue: "1 termasuk",
  },
  {
    name: "Kasir, struk & printer",
    freeValue: true,
    proValue: true,
  },
  {
    name: "Tunai, QRIS, kartu & transfer",
    freeValue: true,
    proValue: true,
  },
  {
    name: "Mode offline",
    freeValue: true,
    proValue: true,
  },
  {
    name: "Laporan dasar",
    freeValue: true,
    proValue: true,
  },
  {
    name: "Diskon, refund & void",
    freeValue: true,
    proValue: true,
  },
  {
    name: "Kasbon dengan pengingat",
    freeValue: false,
    proValue: true,
  },
  {
    name: "Meja, pesanan berjalan & layar dapur",
    freeValue: false,
    proValue: true,
  },
  {
    name: "Antrean servis, jadwal & sesi sewa",
    freeValue: false,
    proValue: true,
  },
  {
    name: "Absensi, jadwal shift & gaji",
    freeValue: false,
    proValue: true,
  },
  {
    name: "Jam ramai & produk terlaris",
    freeValue: false,
    proValue: true,
  },
  {
    name: "Bantuan prioritas",
    freeValue: false,
    proValue: true,
  },
];
