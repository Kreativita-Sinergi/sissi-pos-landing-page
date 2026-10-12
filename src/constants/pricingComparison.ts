export interface PricingComparisonItem {
  name: string;
  gratis: string | boolean;
  pro: string | boolean;
}

export interface PricingComparisonCategory {
  category: string;
  items: PricingComparisonItem[];
}

export const PRICING_COMPARISON: PricingComparisonCategory[] = [
  {
    category: "Penjualan",
    items: [
      { name: "Transaksi per bulan", gratis: "50", pro: "Tanpa batas" },
      { name: "Kasir, struk & printer", gratis: true, pro: true },
      { name: "Tunai, QRIS, kartu & transfer", gratis: true, pro: true },
      { name: "Mode offline", gratis: true, pro: true },
      { name: "Diskon, refund & void", gratis: false, pro: true },
      { name: "Bayar sebagian & kasbon", gratis: false, pro: true },
    ],
  },
  {
    category: "Meja & dapur",
    items: [
      { name: "Meja & pesanan berjalan", gratis: false, pro: true },
      { name: "Layar dapur", gratis: false, pro: true },
    ],
  },
  {
    category: "Jasa & penyewaan",
    items: [
      { name: "Antrean servis & status pengerjaan", gratis: false, pro: true },
      { name: "Jadwal booking, jam ramai & DP", gratis: false, pro: true },
      { name: "Sesi berjalan dengan timer", gratis: false, pro: true },
    ],
  },
  {
    category: "Tim",
    items: [
      { name: "Buka/tutup kasir & PIN", gratis: true, pro: true },
      { name: "Kehadiran & jadwal shift", gratis: false, pro: true },
      { name: "Gaji & slip gaji", gratis: false, pro: true },
    ],
  },
  {
    category: "Produk & stok",
    items: [
      { name: "Produk, varian & stok menipis", gratis: true, pro: true },
    ],
  },
  {
    category: "Laporan & bantuan",
    items: [
      { name: "Laporan dasar", gratis: true, pro: true },
      { name: "Jam ramai & produk terlaris", gratis: false, pro: true },
      { name: "Outlet", gratis: "1", pro: "1 termasuk" },
      { name: "Bantuan prioritas", gratis: false, pro: true },
    ],
  },
];

export const PRICING_FAQS = [
  {
    question: "Apakah perlu kartu kredit untuk uji coba?",
    answer: "Tidak. Uji coba 30 hari langsung aktif tanpa data pembayaran.",
  },
  {
    question: "Apa yang terjadi kalau Pro tidak diperpanjang?",
    answer:
      "Akun otomatis kembali ke paket Gratis. Data tetap aman, hanya fitur Pro yang terkunci.",
  },
  {
    question: "Bagaimana cara bayar?",
    answer:
      "Lewat QRIS atau transfer bank dari menu Langganan di aplikasi.",
  },
  {
    question: "Apakah perpanjangan otomatis?",
    answer:
      "Tidak. Kami mengirim pengingat beberapa hari sebelum masa langganan habis.",
  },
  {
    question: "Bisa pindah dari bulanan ke tahunan?",
    answer:
      "Bisa, kapan saja. Sisa masa bulanan tetap terhitung.",
  },
];
