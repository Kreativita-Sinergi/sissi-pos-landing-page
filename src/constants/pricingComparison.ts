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
      { name: "Diskon, refund & void", gratis: true, pro: true },
      { name: "Bayar dengan beberapa cara (split)", gratis: true, pro: true },
      { name: "Kasbon dengan pengingat", gratis: false, pro: true },
    ],
  },
  {
    category: "Meja & dapur",
    items: [
      { name: "Meja & pesanan berjalan", gratis: false, pro: true },
      { name: "Layar dapur", gratis: false, pro: true },
      { name: "Pesan & Bayar Mandiri lewat QR", gratis: false, pro: true },
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
      { name: "Impor produk dari CSV", gratis: true, pro: true },
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
    answer: "Tidak. Uji coba Pro 30 hari langsung aktif sejak daftar, tanpa data pembayaran.",
  },
  {
    question: "Apa yang terjadi kalau Pro tidak diperpanjang?",
    answer:
      "Ada masa tenggang 3 hari, lalu akun kembali ke paket Gratis. Data tetap aman, hanya fitur Pro yang terkunci; pesanan dan kasbon yang masih berjalan tetap bisa diselesaikan.",
  },
  {
    question: "Bagaimana cara bayar?",
    answer:
      "Transfer ke rekening yang tertera di menu Pengaturan › Langganan, lalu konfirmasi ke admin lewat tombol “Chat admin via WhatsApp”. Pro aktif setelah pembayaran dicatat.",
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
