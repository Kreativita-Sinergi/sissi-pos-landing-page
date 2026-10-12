export interface ComparisonRow {
  task: string;
  before: string;
  after: string;
}

export const COMPARISON_DATA: ComparisonRow[] = [
  {
    task: "Internet putus",
    before: "Catat di kertas, input ulang nanti",
    after: "Tetap jualan, data terkirim saat sinyal kembali",
  },
  {
    task: "Pesanan ke dapur",
    before: "Kertas pesanan dan teriak ke dapur",
    after: "Muncul di layar dapur per meja",
  },
  {
    task: "Modal per menu",
    before: "Ditebak dari harga jual",
    after: "HPP dari resep, per varian",
  },
  {
    task: "Kasbon pelanggan",
    before: "Buku utang terpisah",
    after: "Tercatat di transaksi, diingatkan lewat WhatsApp",
  },
  {
    task: "Tutup kasir",
    before: "Hitung manual pakai kalkulator",
    after: "Selisih kas langsung terlihat",
  },
  {
    task: "Absen karyawan",
    before: "Kertas absen di dinding",
    after: "Absen dengan PIN di perangkat kasir",
  },
  {
    task: "Kabar ke pemilik",
    before: "Foto buku dikirim lewat chat",
    after: "Laporan di aplikasi, notifikasi ke HP pemilik",
  },
];
