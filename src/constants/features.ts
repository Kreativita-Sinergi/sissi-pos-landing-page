export interface FeatureTab {
  id: string;
  name: string;
  summary: string;
  imageSrc: string;
  imageAlt: string;
}

/** Tab fitur di beranda. Semua gambar = layar asli aplikasi (render 1280×800). */
export const FEATURE_TABS: FeatureTab[] = [
  {
    id: "kasir",
    name: "Kasir & pembayaran",
    summary:
      "Tunai dengan kembalian, QRIS statis tokomu, kartu, transfer, atau dibagi beberapa cara. Sisa tagihan bisa dicatat sebagai kasbon pelanggan.",
    imageSrc: "/images/app/bayar-tablet.webp",
    imageAlt: "Layar Pembayaran Sissi dengan pilihan Tunai, QRIS, Kartu, Transfer, dan Kasbon.",
  },
  {
    id: "meja",
    name: "Meja & dapur",
    summary:
      "Pesanan disimpan per meja dan dikirim ke layar dapur. Pesanan bisa ditambah atau dipisah; tiket dapurnya ikut pindah.",
    imageSrc: "/images/app/dapur-tablet.webp",
    imageAlt: "Layar dapur Sissi dengan tiket per meja di kolom Masuk, Dimasak, dan Siap.",
  },
  {
    id: "produk",
    name: "Varian & HPP",
    summary:
      "Varian bertingkat seperti Ukuran × Suhu dengan isi massal. HPP diisi manual atau dihitung dari resep, per varian dan per pilihan tambahan.",
    imageSrc: "/images/app/varian-tablet.webp",
    imageAlt: "Form produk Sissi: pilihan varian Ukuran (S, M, L) dan Suhu (Panas, Es) dengan daftar kombinasi.",
  },
  {
    id: "stok",
    name: "Stok & pembelian",
    summary:
      "Bahan baku berkurang tiap ada penjualan. Ada stok opname, PO ke supplier, transfer antar-outlet, dan saran belanja dari stok yang menipis.",
    imageSrc: "/images/app/inventori-tablet.webp",
    imageAlt: "Halaman Inventori Sissi: stok barang, bahan baku, opname, pembelian, supplier, transfer stok, dan saran belanja.",
  },
  {
    id: "shift",
    name: "Shift & kas",
    summary:
      "Buka kasir dengan modal awal, catat kas masuk dan keluar, lalu tutup kasir dengan mengetik total uang fisik. Selisihnya langsung terlihat.",
    imageSrc: "/images/app/tutup-kasir-tablet.webp",
    imageAlt: "Layar Tutup Kasir Sissi dengan hitungan uang fisik.",
  },
  {
    id: "laporan",
    name: "Laporan",
    summary:
      "Omzet, laba kotor, produk terjual, jam ramai, dan penjualan per kasir. Bisa diekspor ke CSV.",
    imageSrc: "/images/app/laporan-tablet.webp",
    imageAlt: "Laporan Sissi tab Jam ramai: grafik transaksi per jam dan per hari.",
  },
  {
    id: "tim",
    name: "Tim & absensi",
    summary:
      "Karyawan masuk dengan PIN, aksesnya sesuai peran pemilik, kasir, atau dapur. Absen masuk dan pulang di perangkat kasir, gaji jadi slip.",
    imageSrc: "/images/app/kehadiran-tablet.webp",
    imageAlt: "Layar Kehadiran Sissi dengan tombol Absen masuk dan Absen pulang.",
  },
  {
    id: "pelanggan",
    name: "Pelanggan & member",
    summary:
      "Poin dan tingkat member berjalan otomatis, diskon per tingkat, dan kasbon yang bisa diingatkan lewat WhatsApp.",
    imageSrc: "/images/app/pelanggan-tablet.webp",
    imageAlt: "Detail pelanggan Sissi: total belanja, kunjungan, poin, dan tingkat member.",
  },
];
