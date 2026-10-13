export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Jenis usaha apa saja yang bisa memakai Sissi?",
    answer:
      "Empat jenis: kuliner (kafe, kedai kopi, rumah makan, restoran), ritel (toko kelontong, minimarket), jasa (bengkel, servis HP, laundry, salon, percetakan), dan penyewaan (lapangan padel, futsal, badminton, biliar, rental PS). Jenis usaha dipilih saat daftar; menu dan istilah di aplikasi menyesuaikan.",
  },
  {
    question: "Benar-benar bisa dipakai tanpa internet?",
    answer:
      "Bisa. Penjualan, pesanan, stok, dan shift dicatat di perangkat lebih dulu. Begitu online, data dikirim ke server dan perangkat lain di outlet ikut terbarui. Kalau dua perangkat mengubah data yang sama, versi di server yang dipakai dan aplikasi memberi tahu perubahan mana yang tidak tersimpan.",
  },
  {
    question: "Perangkat apa yang didukung?",
    answer:
      "HP dan tablet Android 7.0 atau lebih baru. Tampilan menyesuaikan: HP tegak, tablet mendatar dengan daftar dan detail berdampingan. Saat ini belum tersedia untuk iPhone dan iPad.",
  },
  {
    question: "Bagaimana cara menerima QRIS?",
    answer:
      "Di Pengaturan › Metode pembayaran, unggah gambar QRIS statis tokomu atau pindai stikernya dengan kamera. Sissi memeriksa kodenya dan mengisi nama merchant. Saat pelanggan membayar, QR tampil di layar dan kasir menekan \"Sudah dibayar\" setelah dana masuk di aplikasi bank.",
  },
  {
    question: "Printer apa yang bisa dipakai?",
    answer:
      "Printer thermal Bluetooth atau jaringan (LAN/Wi-Fi), kertas 58 mm atau 80 mm. Satu perangkat bisa memakai beberapa printer, misalnya satu untuk struk kasir dan satu khusus tiket dapur. Printer USB belum didukung. Struk juga bisa dikirim ke pelanggan lewat WhatsApp.",
  },
  {
    question: "Bagaimana akses karyawan diatur?",
    answer:
      "Ada tiga peran: pemilik, kasir, dan dapur. Setiap karyawan masuk ke perangkat kasir dengan PIN sendiri, dan menunya mengikuti perannya. Setelah 5 kali salah PIN, perangkat terkunci 15 menit.",
  },
  {
    question: "Apa yang dikirim ke HP pemilik?",
    answer:
      "Notifikasi saat ada selisih kas di tutup kasir, transaksi dibatalkan atau dikembalikan (void/refund), dan saat akun dipakai masuk dari perangkat baru. Setiap jenis notifikasi bisa dinyalakan atau dimatikan.",
  },
  {
    question: "Kalau tablet hilang atau rusak, datanya?",
    answer:
      "Data yang sudah tersinkron tersimpan di server. Masuk di perangkat baru, data outlet ditarik kembali. Transaksi yang belum sempat terkirim dari perangkat yang hilang tidak bisa dipulihkan, jadi sambungkan internet sesekali.",
  },
  {
    question: "Bagaimana cara menghapus akun?",
    answer:
      "Pemilik bisa meminta penghapusan lewat halaman Hapus akun di situs ini, dengan kode konfirmasi yang dikirim ke email akun. Akun dan seluruh data usaha dihapus permanen setelah masa tunggu 30 hari; masuk lagi sebagai pemilik selama masa itu membatalkan penghapusan.",
  },
];
