export interface BusinessType {
  id: string;
  name: string;
  description: string;
  suitableFor: string;
  /** Contoh konkret yang terjadi di kasir jenis usaha ini. */
  example: string;
}

export const BUSINESS_TYPES: BusinessType[] = [
  {
    id: "kuliner",
    name: "Kuliner",
    description: "Pesanan per meja, langsung ke layar dapur.",
    suitableFor: "Kafe, kedai kopi, rumah makan, restoran, katering",
    example: "Kopi Susu L, es: Rp23.000. HPP dari resep: susu, kopi, gula aren.",
  },
  {
    id: "ritel",
    name: "Ritel",
    description: "Pindai barcode, bayar, stok berkurang sendiri.",
    suitableFor: "Toko kelontong, minimarket, toko sembako, fashion",
    example: "Minyak Goreng 2 L dipindai, stok tinggal 4, muncul di daftar stok menipis.",
  },
  {
    id: "jasa",
    name: "Jasa",
    description: "Order servis dari diterima sampai diambil.",
    suitableFor: "Bengkel, servis HP, laundry, salon, barbershop, percetakan",
    example: "Honda Vario B 4521 KL: dikerjakan teknisi Andi, estimasi selesai 14.00.",
  },
  {
    id: "penyewaan",
    name: "Penyewaan",
    description: "Booking per unit, sesi berjalan dengan timer.",
    suitableFor: "Lapangan padel, futsal, badminton, biliar, rental PlayStation",
    example: "Padel 1, 19.00–21.00, tarif jam ramai, DP Rp100.000 tercatat.",
  },
];
