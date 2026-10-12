export interface UsahaSubpageData {
  slug: string;
  name: string;
  title: string;
  subtitle: string;
  suitablePills: string[];
  image: string;
  imageAlt: string;
  problems: {
    title: string;
    description: string;
  }[];
  screens: {
    title: string;
    description: string;
  }[];
  devices: {
    title: string;
    description: string;
  }[];
}

export const USAHA_SUBPAGES: Record<string, UsahaSubpageData> = {
  kuliner: {
    slug: "kuliner",
    name: "Kuliner",
    title: "Sissi untuk usaha kuliner",
    subtitle:
      "Pesanan per meja langsung ke layar dapur. Varian, catatan, dan HPP dari resep tercatat tanpa ditulis ulang.",
    suitablePills: [
      "Kafe & kedai kopi",
      "Rumah makan",
      "Restoran",
      "Katering",
      "Kuliner lainnya",
    ],
    image: "/images/app/dapur-tablet.webp",
    imageAlt: "Layar dapur Sissi dengan tiket per meja di kolom Masuk, Dimasak, dan Siap.",
    problems: [
      {
        title: "Pesanan bertumpuk di jam makan",
        description:
          "Pesanan disimpan per meja; dapur melihat tiket berurutan dan menandai item yang sudah jadi.",
      },
      {
        title: "Varian dan tambahan",
        description:
          "Kopi Susu ukuran L, es, extra shot. Harga tambahan dan modalnya dihitung otomatis.",
      },
      {
        title: "Satu meja minta bayar terpisah",
        description:
          "Pisah pesanan ke tagihan baru; tiket dapurnya ikut pindah.",
      },
    ],
    screens: [
      {
        title: "Kasir",
        description: "Pilih menu, varian, dan catatan, lalu simpan ke meja atau langsung bayar.",
      },
      {
        title: "Meja",
        description: "Meja kosong dan terisi, lama duduk, dan total tagihannya.",
      },
      {
        title: "Layar dapur",
        description: "Tiket per ronde. Tambahan pesanan ditandai TAMBAHAN.",
      },
    ],
    devices: [
      {
        title: "Tablet di meja kasir",
        description: "Menu dan pesanan berdampingan dalam satu layar.",
      },
      {
        title: "Tablet atau HP untuk dapur",
        description: "Atur perangkat sebagai layar dapur, lalu masuk dengan PIN karyawan dapur.",
      },
      {
        title: "Printer thermal jaringan",
        description: "Kertas 58 atau 80 mm untuk struk dan tiket dapur.",
      },
    ],
  },
  ritel: {
    slug: "ritel",
    name: "Ritel",
    title: "Sissi untuk usaha ritel",
    subtitle:
      "Pindai barcode, bayar, stok berkurang sendiri. Harga modal tersimpan, laba kotor terlihat di laporan.",
    suitablePills: [
      "Toko kelontong",
      "Minimarket",
      "Toko sembako",
      "Fashion",
      "Ritel lainnya",
    ],
    image: "/images/app/kasir-ritel-tablet.webp",
    imageAlt: "Kasir ritel Sissi: kolom pindai barcode, daftar produk dengan stok, dan keranjang Rp161.500.",
    problems: [
      {
        title: "Ratusan barang",
        description:
          "Ketik nama atau pindai barcode; tidak perlu hafal harga.",
      },
      {
        title: "Modal berubah-ubah",
        description:
          "Harga modal tersimpan per produk dan varian, laba kotor dihitung dari situ.",
      },
      {
        title: "Barang tiba-tiba habis",
        description:
          "Daftar stok menipis dan saran belanja, langsung jadi draf PO ke supplier.",
      },
    ],
    screens: [
      {
        title: "Kasir ritel",
        description: "Kolom pindai di atas, stok tampil di setiap baris produk.",
      },
      {
        title: "Stok & harga modal",
        description: "Stok masuk, penyesuaian, minimum, dan riwayat per barang.",
      },
      {
        title: "Stok opname",
        description: "Hitung fisik dengan pindai barcode, lihat selisih dan nilainya.",
      },
    ],
    devices: [
      {
        title: "Tablet atau HP Android",
        description: "Tablet untuk meja kasir, HP cukup untuk toko kecil.",
      },
      {
        title: "Scanner barcode mode keyboard",
        description: "Kode langsung masuk ke kolom pindai. Di HP bisa memakai kamera.",
      },
      {
        title: "Printer thermal jaringan",
        description: "Kertas 58 atau 80 mm, dengan header dan footer toko.",
      },
    ],
  },
  jasa: {
    slug: "jasa",
    name: "Jasa",
    title: "Sissi untuk usaha jasa",
    subtitle:
      "Order servis masuk antrean, dikerjakan, lalu diambil. Pelanggan bisa dikabari lewat WhatsApp saat siap.",
    suitablePills: [
      "Bengkel",
      "Servis HP",
      "Laundry",
      "Salon & barbershop",
      "Percetakan",
      "Jasa lainnya",
    ],
    image: "/images/app/servis-tablet.webp",
    imageAlt: "Antrean servis Sissi dengan kolom Diterima, Dikerjakan, dan Siap diambil.",
    problems: [
      {
        title: "Order menumpuk di meja depan",
        description:
          "Setiap order punya nomor, status, teknisi, dan estimasi selesai.",
      },
      {
        title: "Data unit pelanggan",
        description:
          "Plat nomor, IMEI, atau data lain sesuai jenis jasa tercatat bersama ordernya.",
      },
      {
        title: "Pelanggan bolak-balik bertanya",
        description:
          "Kabari lewat WhatsApp dari detail order; pesannya sudah disiapkan.",
      },
    ],
    screens: [
      {
        title: "Antrean servis",
        description: "Diterima, dikerjakan, siap diambil. Yang terlambat tampil paling atas.",
      },
      {
        title: "Order baru",
        description: "Pelanggan, layanan, teknisi, dan estimasi selesai dari durasi layanan.",
      },
      {
        title: "Detail order",
        description: "Linimasa status, DP dan sisa bayar, nota ambil.",
      },
    ],
    devices: [
      {
        title: "Tablet di meja depan",
        description: "Papan antrean tiga kolom dalam satu layar.",
      },
      {
        title: "HP Android",
        description: "Cukup untuk usaha jasa kecil; antrean tampil per status.",
      },
      {
        title: "Printer thermal jaringan",
        description: "Cetak nota ambil untuk pelanggan.",
      },
    ],
  },
  penyewaan: {
    slug: "penyewaan",
    name: "Penyewaan",
    title: "Sissi untuk usaha penyewaan",
    subtitle:
      "Booking per unit dengan tarif jam ramai, DP tercatat, dan sesi berjalan dengan timer.",
    suitablePills: [
      "Lapangan padel",
      "Futsal & mini soccer",
      "Badminton",
      "Biliar",
      "Rental PlayStation",
      "Penyewaan lainnya",
    ],
    image: "/images/app/jadwal-sewa-tablet.webp",
    imageAlt: "Jadwal sewa Sissi: kisi unit lapangan dan meja biliar per jam.",
    problems: [
      {
        title: "Jadwal bentrok",
        description:
          "Semua unit terlihat per jam. Jam yang sudah terisi tidak bisa dipesan dua kali.",
      },
      {
        title: "DP dan pelunasan",
        description:
          "Uang muka dan sisa bayar tercatat per booking. Batal atau tidak datang punya aturan sendiri.",
      },
      {
        title: "Hitung waktu main",
        description:
          "Timer per unit, tarif meter atau paket, dan pesanan minuman masuk tagihan yang sama.",
      },
    ],
    screens: [
      {
        title: "Jadwal",
        description: "Kisi unit × jam di tablet; di HP per hari dan per unit.",
      },
      {
        title: "Booking",
        description: "Nama penyewa, unit, jam, dan DP.",
      },
      {
        title: "Sesi berjalan",
        description: "Timer per detik, perpanjang, lalu hentikan dan tagih.",
      },
    ],
    devices: [
      {
        title: "Tablet di meja kasir",
        description: "Jadwal semua unit terlihat sekaligus.",
      },
      {
        title: "HP Android",
        description: "Cek jadwal hari ini dan sesi yang sedang berjalan.",
      },
      {
        title: "Printer thermal jaringan",
        description: "Bukti booking dan struk sewa dengan durasi dan tarif.",
      },
    ],
  },
};
