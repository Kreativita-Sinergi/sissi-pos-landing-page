// Sumber isi panduan pengguna (kasir.sissi.id/panduan).
//
// Aturan menulis:
// - Nama tombol/menu ditulis PERSIS seperti di aplikasi (sumber: sissi-app lib/l10n/arb/app_id.arb),
//   diapit tanda kutip “…”. Jalur menu memakai “›”.
// - Jangan mengarang perilaku. Kalau ragu, cek kode aplikasi atau tulis netral.
// - Slug adalah alamat halaman: JANGAN diubah. Kalau terpaksa, tambahkan slug lama ke `LEGACY_SLUGS`.
// - Gambar hanya tangkapan layar asli aplikasi (public/panduan/).

export type GuideCategoryId =
  | "mulai"
  | "produk"
  | "jualan"
  | "shift"
  | "stok"
  | "pelanggan"
  | "laporan"
  | "tim"
  | "jasa"
  | "sewa"
  | "notifikasi"
  | "offline"
  | "pembaruan"
  | "akun"
  | "langganan"
  | "masalah";

export interface GuideCategory {
  id: GuideCategoryId;
  label: string;
  description: string;
}

export interface GuideImage {
  src: string;
  alt: string;
  caption: string;
  device: "hp" | "tablet";
  width: number;
  height: number;
}

export interface GuideCallout {
  type: "tip" | "info" | "warning";
  /** Kosong = judul bawaan (“Tips”, “Catatan”, “Perhatian”). */
  title?: string;
  text: string;
}

export interface GuideStep {
  /** Jangkar URL (#id). Jangan diubah setelah tayang. */
  id: string;
  title: string;
  description?: string;
  /** Langkah bernomor. */
  steps?: string[];
  /** Poin tambahan tanpa urutan. */
  points?: string[];
  /** Isi bila tampilan HP dan tablet berbeda. */
  devices?: { hp?: string; tablet?: string };
  image?: GuideImage;
  callout?: GuideCallout;
}

export interface GuideFAQ {
  question: string;
  answer: string;
}

export type GuideAudience = "Pemilik" | "Kasir" | "Dapur";

export interface GuideItem {
  slug: string;
  category: GuideCategoryId;
  title: string;
  /** Satu kalimat untuk daftar & meta description. */
  description: string;
  audience: GuideAudience[];
  readMinutes: number;
  lastUpdated: string;
  overview: string;
  prerequisites?: string[];
  steps: GuideStep[];
  faqs?: GuideFAQ[];
  relatedSlugs: string[];
  /** Kata kunci tambahan untuk pencarian (sinonim, istilah awam). */
  keywords?: string[];
}

export const GUIDE_CATEGORIES: GuideCategory[] = [
  { id: "mulai", label: "Mulai", description: "Daftar akun, siapkan outlet & perangkat, dan kenali menu aplikasi." },
  { id: "produk", label: "Produk & HPP", description: "Produk, varian, harga modal (HPP), resep, bahan baku, pilihan ekstra, dan diskon." },
  { id: "jualan", label: "Jualan", description: "Kasir, pesanan berjalan, meja, dapur, pembayaran, kasbon, dan pembatalan." },
  { id: "shift", label: "Shift & kas", description: "Buka kasir, catat kas masuk/keluar, dan tutup kasir." },
  { id: "stok", label: "Stok & inventori", description: "Stok barang, pesanan pembelian (PO), pemasok, saran belanja, opname, dan transfer stok." },
  { id: "pelanggan", label: "Pelanggan & member", description: "Data pelanggan, member, poin, dan tingkat member." },
  { id: "laporan", label: "Laporan", description: "Penjualan, laba kotor & laba bersih, produk terlaris, jam ramai, dan riwayat penjualan." },
  { id: "tim", label: "Tim", description: "Karyawan, PIN, absen, dan gaji." },
  { id: "jasa", label: "Jasa / servis", description: "Order servis, antrean, uang muka, dan penyerahan." },
  { id: "sewa", label: "Penyewaan", description: "Unit sewa, tarif, booking, dan sesi dengan timer." },
  { id: "notifikasi", label: "Notifikasi", description: "Notifikasi di aplikasi dan peringatan pemilik di HP." },
  { id: "offline", label: "Bekerja offline", description: "Apa yang terjadi saat internet putus, status sinkron, dan perubahan ditolak." },
  { id: "pembaruan", label: "Perbarui aplikasi", description: "Pembaruan biasa dan pembaruan wajib." },
  { id: "akun", label: "Akun & keamanan", description: "Kata sandi, keluar akun, login perangkat baru, dan hapus akun." },
  { id: "langganan", label: "Langganan", description: "Paket Gratis dan Pro, batas transaksi, dan cara memperpanjang." },
  { id: "masalah", label: "Masalah umum", description: "Jawaban cepat untuk kendala yang sering terjadi." },
];

/** Tiga panduan yang ditonjolkan untuk pengguna baru. */
export const START_HERE_SLUGS = [
  "mulai-dalam-5-menit",
  "setup-outlet-dan-perangkat",
  "mencatat-transaksi-di-kasir",
];

/** Slug lama → slug baru. Kosong selama semua slug lama masih dipakai. */
export const LEGACY_SLUGS: Record<string, string> = {};

const UPDATED = "12 Oktober 2026";
const UPDATED_NEW = "13 Oktober 2026";
const UPDATED_OCT21 = "21 Oktober 2026";
const UPDATED_OCT23 = "23 Oktober 2026";

// Semua gambar panduan memakai tampilan tablet lanskap 1280×800 (keputusan pemilik).
const TABLET = { device: "tablet" as const, width: 1280, height: 800 };

export const GUIDES: GuideItem[] = [
  // ───────────────────────────── MULAI ─────────────────────────────
  {
    slug: "mulai-dalam-5-menit",
    category: "mulai",
    title: "Mulai dalam 5 menit",
    description: "Urutan singkat dari daftar akun sampai transaksi pertama.",
    audience: ["Pemilik"],
    readMinutes: 3,
    lastUpdated: UPDATED_NEW,
    overview:
      "Halaman ini merangkum urutan kerja pertama kali. Tiap langkah punya panduan lengkapnya sendiri; ikuti tautan di bagian “Baca juga” bila butuh rincian.",
    prerequisites: [
      "HP atau tablet Android dengan aplikasi Sissi POS terpasang.",
      "Internet untuk daftar, masuk, dan sinkron pertama. Setelah itu kasir tetap bisa dipakai saat internet putus.",
    ],
    steps: [
      {
        id: "daftar",
        title: "Daftar akun",
        description:
          "Di layar “Selamat datang di Sissi”, ketuk “Daftar Usaha Baru”, atau “Lanjut dengan Google” bila ingin memakai akun Google.",
        points: [
          "Pilih jenis usaha dengan teliti. Jenis usaha menentukan menu dan istilah di aplikasi, dan belum bisa diganti sendiri setelah daftar.",
        ],
      },
      {
        id: "outlet-perangkat",
        title: "Pilih outlet dan atur perangkat",
        description:
          "Setelah masuk, pilih outlet, beri nama perangkat, lalu pilih “Dipakai sebagai”. Untuk perangkat kasir, pilih “Kasir utama”.",
      },
      {
        id: "produk",
        title: "Tambahkan produk",
        description:
          "Buka “Produk”, ketuk “Tambah produk”, isi nama, kategori, dan harga. Kategori bisa dibuat langsung dari form lewat “Buat kategori baru”. Punya banyak produk? Impor sekaligus dari Excel atau CSV lewat “Kelola” › “Impor produk”.",
      },
      {
        id: "buka-kasir",
        title: "Buka kasir",
        description:
          "Sebelum menerima pembayaran, kasir harus dibuka. Ketuk “Buka Kasir”, isi “Kas awal di laci” (uang kembalian di laci), lalu ketuk “Buka Kasir”.",
      },
      {
        id: "transaksi-pertama",
        title: "Catat transaksi pertama",
        description:
          "Di “Kasir”, ketuk produk untuk menambahkannya ke pesanan, ketuk “Bayar”, pilih cara bayar, lalu “Selesaikan pembayaran”.",
        callout: {
          type: "tip",
          text: "Di Beranda ada kartu “Langkah persiapan” berisi daftar hal yang perlu disiapkan, misalnya “Tambah produk” dan “Atur meja”.",
        },
      },
    ],
    faqs: [
      {
        question: "Apakah Sissi bisa dipakai tanpa internet?",
        answer:
          "Bisa, setelah masuk dan sinkron pertama selesai. Transaksi tersimpan di perangkat dan dikirim ke server saat internet kembali. Baca “Bekerja offline & status sinkron”.",
      },
      {
        question: "Bisakah memakai HP biasa, bukan tablet?",
        answer:
          "Bisa. Di HP tampilan dibuat tegak (potret) dengan menu di bawah layar; di tablet tampilan mendatar (lanskap) dengan menu di sisi kiri.",
      },
    ],
    relatedSlugs: ["daftar-dan-masuk", "setup-outlet-dan-perangkat", "menambah-produk", "mencatat-transaksi-di-kasir"],
    keywords: ["memulai", "setup awal", "pertama kali", "cara pakai"],
  },
  {
    slug: "daftar-dan-masuk",
    category: "mulai",
    title: "Daftar akun & masuk (email atau Google)",
    description: "Membuat akun usaha baru, verifikasi email, masuk dengan Google, dan lupa kata sandi.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 4,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Akun dibuat oleh pemilik usaha. Kamu bisa mendaftar dengan email dan kata sandi, atau dengan akun Google tanpa perlu kode verifikasi.",
    steps: [
      {
        id: "daftar-email",
        title: "Daftar dengan email",
        steps: [
          "Di layar pembuka, ketuk “Daftar Usaha Baru”.",
          "Isi “Nama pemilik”, “Nama usaha”, “Email”, dan “Kata sandi”. “No. HP (opsional)” boleh dikosongkan. Di bawah kolom kata sandi ada daftar syarat yang tercentang satu per satu saat kamu mengetik (lihat “Syarat kata sandi” di bawah).",
          "Ketuk “Jenis usaha”, pilih kategori (mis. Kuliner), lalu jenisnya, dan ketuk tombol “Pilih …”.",
          "Centang persetujuan “Syarat & Ketentuan” dan “Kebijakan Privasi”, lalu ketuk “Buat Akun”.",
          "Buka email, salin kode 6 digit, masukkan di layar “Masukkan kode verifikasi”, lalu ketuk “Verifikasi”.",
        ],
        callout: {
          type: "warning",
          text: "Jenis usaha tidak bisa diganti sendiri setelah daftar. Bila salah pilih, hubungi dukungan Sissi.",
        },
      },
      {
        id: "syarat-kata-sandi",
        title: "Syarat kata sandi",
        description:
          "Syarat yang sama berlaku saat daftar, menerima undangan karyawan, mengganti, dan mengatur ulang kata sandi. Daftar syarat empat baris di bawah kolom kata sandi membantu mengeceknya sebelum disimpan.",
        points: [
          "“Minimal 8 karakter” (paling banyak 128 karakter).",
          "“Huruf besar & huruf kecil” — minimal satu dari masing-masing.",
          "“Angka” — minimal satu angka.",
          "“Simbol (!@#…)” — minimal satu simbol, mis. ! @ # ?",
          "Bukan kata sandi umum yang mudah ditebak, termasuk yang memakai nama aplikasi atau kata sehari-hari seperti “sissi”, “kasir”, atau “password” (mis. “Kasir123!” tetap ditolak). Bila ditolak, pesannya muncul di bawah kolom kata sandi.",
        ],
        callout: {
          type: "tip",
          text: "Kata sandi yang kuat sekaligus mudah diingat: gabungkan dua atau tiga kata yang hanya kamu tahu, lalu selipkan huruf besar, angka, dan simbol. Jangan pakai nama toko atau nomor HP.",
        },
      },
      {
        id: "daftar-google",
        title: "Daftar atau masuk dengan Google",
        steps: [
          "Ketuk “Lanjut dengan Google” di layar pembuka atau layar masuk, lalu pilih akun Google.",
          "Bila email itu sudah terdaftar, kamu langsung masuk.",
          "Bila email itu belum terdaftar, muncul layar “Lengkapi pendaftaran”. Nama pemilik sudah terisi dari Google; isi “Nama usaha” dan “Jenis usaha”, centang persetujuan, lalu ketuk “Buat Akun”.",
        ],
        points: [
          "Daftar lewat Google tidak memakai kata sandi dan tidak perlu kode verifikasi email. Bila ingin juga bisa masuk dengan kata sandi, buat kata sandi lewat “Lupa kata sandi?”.",
          "Akun pemilik yang dulu daftar dengan email bisa juga masuk lewat Google dengan email yang sama.",
          "“Lanjut dengan Google” hanya untuk pemilik. Karyawan tetap memakai PIN.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/lengkapi-pendaftaran-tablet.png",
          alt: "Layar Lengkapi pendaftaran setelah masuk dengan Google",
          caption: "Lengkapi pendaftaran: cukup isi data usaha.",
        },
      },
      {
        id: "masuk",
        title: "Masuk ke akun",
        description:
          "Di layar “Masuk ke akun”, isi “Email atau No. HP” dan “Kata sandi”, lalu ketuk “Masuk”. Centang “Ingat saya” di perangkat milik sendiri.",
        callout: {
          type: "info",
          text: "Kode tidak masuk? Cek folder spam atau promosi di email. Tombol “Kirim ulang” aktif lagi setelah hitung mundur selesai.",
        },
      },
      {
        id: "lupa-password",
        title: "Lupa kata sandi",
        steps: [
          "Di layar masuk, ketuk “Lupa kata sandi?”.",
          "Isi “Email atau No. HP”, lalu ketuk “Kirim Kode”. Kode dikirim ke email akun.",
          "Masukkan kode, lalu isi “Kata sandi baru” dan “Ulangi kata sandi”.",
          "Kata sandi baru harus memenuhi syarat di atas. Ketuk “Simpan kata sandi”, lalu masuk dengan kata sandi baru.",
        ],
      },
    ],
    faqs: [
      {
        question: "Muncul “Masuk dengan Google belum diaktifkan.”",
        answer: "Fitur Google belum aktif di versi aplikasi ini. Untuk sementara daftar atau masuk dengan email.",
      },
      {
        question: "Bagaimana kasir masuk?",
        answer:
          "Biasanya pemilik masuk sekali di perangkat kasir, lalu karyawan membuka kasir dengan PIN masing-masing. Baca “Karyawan, akses & PIN”.",
      },
    ],
    relatedSlugs: ["setup-outlet-dan-perangkat", "akun-dan-keamanan", "karyawan-dan-pin"],
    keywords: ["registrasi", "sign up", "login", "otp", "kode verifikasi", "google", "reset kata sandi", "reset password", "password", "syarat kata sandi", "kata sandi ditolak", "huruf besar", "simbol"],
  },
  {
    slug: "setup-outlet-dan-perangkat",
    category: "mulai",
    title: "Pilih outlet & atur perangkat",
    description: "Tiga langkah setelah masuk pertama kali, termasuk mode Kasir utama, Layar dapur, dan Pesan mandiri.",
    audience: ["Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED_NEW,
    overview:
      "Setiap perangkat dicatat milik satu outlet dan punya satu peran. Setup berjalan dalam tiga langkah: “Outlet”, “Perangkat”, dan “Sinkron”.",
    steps: [
      {
        id: "pilih-outlet",
        title: "Pilih outlet",
        description:
          "Di layar “Pilih outlet”, ketuk outlet yang dipakai, lalu “Lanjut”. Semua transaksi dari perangkat ini tercatat di outlet tersebut.",
        callout: {
          type: "info",
          text: "Tepat setelah daftar, daftar outlet kadang butuh beberapa detik untuk muncul. Aplikasi mencoba lagi sendiri; bila tetap kosong, ketuk “Coba lagi”.",
        },
      },
      {
        id: "atur-perangkat",
        title: "Beri nama perangkat dan pilih perannya",
        description:
          "Isi “Nama perangkat” (mis. Tablet Kasir Depan), lalu pilih “Dipakai sebagai”, dan ketuk “Simpan & Lanjut”.",
        points: [
          "“Kasir utama” — menerima pesanan dan pembayaran. Pilih ini untuk perangkat kasir biasa.",
          "“Layar dapur” — menampilkan pesanan untuk dimasak. Perangkat langsung membuka layar Dapur penuh tanpa menu kasir, dan layar dijaga tetap menyala.",
          "“Pesan mandiri” — disiapkan untuk perangkat pemesanan mandiri di toko yang akan datang. Saat ini bekerja seperti “Kasir utama”. Untuk pelanggan memesan dari HP-nya sendiri lewat QR meja, tidak perlu mode ini; baca “Pesan & Bayar Mandiri lewat QR”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/atur-perangkat-tablet.png",
          alt: "Layar Atur perangkat ini dengan pilihan Kasir utama, Layar dapur, dan Pesan mandiri",
          caption: "Langkah 2 dari 3: nama perangkat dan perannya.",
        },
      },
      {
        id: "sinkron",
        title: "Tunggu sinkron pertama",
        description:
          "Aplikasi mengunduh data outlet (produk, meja, pengaturan). Jangan tutup aplikasi sampai muncul “Siap dipakai”.",
        points: [
          "Bila muncul “Sinkronisasi belum berhasil”, periksa internet lalu ketuk “Coba lagi”, atau “Lanjut tanpa menunggu” bila data bisa menyusul.",
        ],
      },
      {
        id: "layar-dapur",
        title: "Khusus perangkat Layar dapur",
        description:
          "Layar dapur hanya tampil penuh bila fitur “Layar dapur” aktif di Pengaturan › “Jenis usaha” › “Fitur yang dipakai”, dan yang membuka perangkat adalah pemilik atau karyawan berperan Dapur. Kasir yang membuka perangkat ini tetap melihat aplikasi biasa.",
      },
    ],
    faqs: [
      {
        question: "Bisakah mengganti mode perangkat setelah setup?",
        answer:
          "Pengaturan › “Perangkat ini” menampilkan mode yang dipakai. Kami belum menemukan tombol untuk menggantinya di sana; bila perlu mengganti, hubungi dukungan Sissi.",
      },
      {
        question: "Bagaimana pindah ke outlet lain?",
        answer:
          "Pemilik bisa membuka menu akun “Akun & outlet”, memilih outlet lain, lalu “Pindah outlet”. Bila kasir masih terbuka, aplikasi meminta tutup kasir dulu.",
      },
    ],
    relatedSlugs: ["mulai-dalam-5-menit", "layar-dapur", "menyambungkan-printer-thermal-bluetooth", "pesan-dan-bayar-mandiri-qr"],
    keywords: ["outlet", "cabang", "perangkat", "kitchen display", "kds", "self order", "pesan mandiri", "kasir utama"],
  },
  {
    slug: "mengenal-menu-aplikasi",
    category: "mulai",
    title: "Mengenal menu di HP dan tablet",
    description: "Letak menu utama, isi “Lainnya”, susunan Pengaturan, dan pencarian cepat.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 4,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Menu yang tampil mengikuti jenis usaha dan peran orang yang sedang memakai perangkat. Kasir tidak melihat Produk, Laporan, Inventori, dan Pengaturan.",
    steps: [
      {
        id: "menu-utama",
        title: "Menu utama",
        devices: {
          hp: "Menu ada di bawah layar: empat menu utama sesuai jenis usaha, ditambah “Lainnya” di ujung kanan.",
          tablet: "Menu ada di sisi kiri. Notifikasi dan Pengaturan ada di bagian bawah sisi kiri.",
        },
        points: [
          "HP kuliner dengan meja: Beranda, Kasir, Pesanan, Meja, dan Lainnya. Riwayat pindah ke “Lainnya” › “Operasional”, karena pelayan jauh lebih sering membuka Meja.",
          "HP kuliner tanpa meja: Beranda, Kasir, Pesanan, Riwayat, dan Lainnya.",
          "HP ritel: Beranda, Kasir, Riwayat, dan Lainnya. HP jasa: Beranda, Kasir, Antrean, Riwayat, dan Lainnya. HP penyewaan: Beranda, Jadwal, Sesi, Riwayat, dan Lainnya (Kasir ada di Lainnya).",
          "Tablet kuliner: Beranda, Kasir, Pesanan, Meja, Dapur, Riwayat (ditambah “Pesanan QR” bila Pesan & Bayar Mandiri aktif).",
          "Tablet ritel: Beranda, Kasir, Riwayat, Produk. Tablet jasa: Beranda, Antrean, Kasir, Riwayat; menu Produk bernama “Layanan”. Tablet penyewaan: Beranda, Jadwal, Sesi, Kasir, Pesanan, Riwayat.",
          "Menu fitur Pro yang sedang terkunci diberi lencana “PRO”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/beranda-tablet.png",
          alt: "Beranda Sissi POS di tablet dengan menu di sisi kiri",
          caption: "Beranda di tablet. Kartu “Perlu perhatian” berisi hal yang perlu ditindaklanjuti.",
        },
      },
      {
        id: "lainnya",
        title: "Menu “Lainnya”",
        description:
          "Berisi menu yang tidak muat di menu utama, dikelompokkan menjadi empat:",
        points: [
          "“Operasional” — menu kerja harian yang tidak ada di menu utama (mis. “Riwayat”, “Pesanan QR”, “Dapur”) dan “Shift & Kas”.",
          "“Tim” — “Tim”, “Kehadiran”, dan “Gaji” (kasir hanya melihat “Kehadiran”).",
          "“Bisnis” — Produk, Inventori, dan Pelanggan.",
          "“Laporan” — “Laporan”, “Kasbon”, dan “Riwayat tutup kasir” (khusus pemilik).",
        ],
        devices: {
          hp: "“Lainnya” terbuka sebagai layar sendiri, dan juga memuat “Bantuan & Panduan”, “Kunci kasir”, dan “Keluar”.",
          tablet: "“Lainnya” terbuka sebagai panel di samping menu.",
        },
      },
      {
        id: "pengaturan",
        title: "Pengaturan (khusus pemilik)",
        description:
          "Paling atas ada kartu “Langganan” berisi status paket dan sisa harinya (berbingkai kuning bila tinggal 7 hari atau kurang, atau sedang masa tenggang). Di bawahnya, bagian dikelompokkan:",
        points: [
          "“Toko” — Profil toko, Jenis usaha, Kategori produk, Area meja.",
          "“Penjualan” — Pajak & biaya, Metode pembayaran, “Pesanan & keamanan kasir” (jenis pesanan, kasbon, PIN pemilik, tutup kasir tanpa angka sistem), Struk, Pelanggan & Member, dan Pesan & Bayar Mandiri (bila aktif).",
          "“Karyawan & absen” — “Jam kerja & telat”, “Lokasi absen”, dan “Shift kasir”.",
          "“Perangkat” — “Printer & laci uang”, “Perangkat ini”, dan “Notifikasi”.",
          "“Akun” — “Bahasa & mata uang” dan “Akun & keamanan”.",
          "Baris yang butuh tindakan diberi keterangan singkat berwarna, mis. “QRIS belum diatur” atau printer “Belum diatur”. Baris yang sudah beres tidak diberi keterangan.",
        ],
        devices: {
          hp: "Tiap bagian terbuka sebagai halaman sendiri.",
          tablet: "Daftar bagian di kiri, isinya tampil di panel kanan — termasuk Kategori produk, Area meja, dan Printer & laci uang.",
        },
        image: {
          ...TABLET,
          src: "/panduan/pengaturan-tablet.png",
          alt: "Hub Pengaturan berkelompok: kartu Langganan di atas, lalu Toko, Penjualan, dan Karyawan & absen, dengan Profil toko terbuka di panel kanan",
          caption: "Pengaturan dikelompokkan; tablet membuka tiap bagian di panel kanan.",
        },
      },
      {
        id: "tombol-kembali",
        title: "Tombol kembali Android",
        points: [
          "Di menu selain Beranda, tombol kembali membawa Anda ke Beranda.",
          "Di Beranda, tombol kembali memunculkan “Tekan sekali lagi untuk keluar”. Tekan lagi dalam ±2 detik untuk keluar dari aplikasi.",
          "Di perangkat “Layar dapur”, berandanya adalah layar Dapur.",
        ],
      },
      {
        id: "daftar-tablet",
        title: "Daftar dan saringan",
        points: [
          "Saringan di daftar (mis. Riwayat, Pelanggan, Stok) berupa tombol pemilih seperti “Status: Semua” atau segmen. Pilihan yang banyak terbuka di lembar opsi.",
          "Di tablet, Pelanggan, Bahan baku, dan Stok tampil dua kolom: daftar di kiri, rincian di kanan. Sebelum memilih, panel kanan menampilkan ringkasan (mis. jumlah stok habis dan menipis).",
          "Ketuk area kosong di layar untuk menutup keyboard.",
        ],
      },
      {
        id: "cari",
        title: "Pencarian cepat",
        description:
          "Kolom “Cari menu, produk, transaksi…” di Beranda mencari produk, pelanggan, transaksi, dan juga fitur. Coba ketik “Tutup kasir” atau “Stok menipis”. Produk hasil pencarian bisa langsung “Tambah ke pesanan”.",
      },
    ],
    relatedSlugs: ["karyawan-dan-pin", "setup-outlet-dan-perangkat", "notifikasi"],
    keywords: ["navigasi", "sidebar", "menu bawah", "lainnya", "pengaturan", "panel kanan", "cari", "tab meja", "riwayat di lainnya", "printer & laci uang", "karyawan & absen"],
  },
  {
    slug: "pasang-lewat-apk",
    category: "mulai",
    title: "Pasang lewat APK (HP tanpa Play Store)",
    description: "Memasang Sissi dari berkas APK di HP tanpa Google Play, misalnya Huawei, dan cara memperbaruinya.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 3,
    lastUpdated: UPDATED,
    overview:
      "Cara utama memasang Sissi adalah lewat Google Play. Bila HP atau tablet tokomu tidak punya Play Store (misalnya Huawei), unduh berkas APK dari halaman Unduh di kasir.sissi.id/download lalu pasang sendiri.",
    prerequisites: ["HP atau tablet Android 7.0 atau lebih baru yang bisa memasang berkas APK."],
    steps: [
      {
        id: "unduh-dan-pasang",
        title: "Unduh dan pasang",
        steps: [
          "Di HP yang akan dipakai, buka kasir.sissi.id/download, lalu ketuk “Unduh APK” di bagian “Unduh APK langsung”.",
          "Bila muncul peringatan berkas berbahaya dari browser, pastikan alamatnya apipos.sissi.id, lalu pilih unduh tetap.",
          "Buka berkas sissi-pos-latest.apk dari notifikasi unduhan atau aplikasi Berkas.",
          "Bila diminta, izinkan “Instal aplikasi tidak dikenal” untuk browser atau aplikasi Berkas, lalu kembali.",
          "Ketuk “Pasang”, tunggu selesai, lalu buka Sissi dan masuk seperti biasa.",
        ],
        callout: {
          type: "tip",
          text: "Setelah terpasang, izin “Instal aplikasi tidak dikenal” boleh dimatikan lagi. Nyalakan kembali hanya saat memperbarui.",
        },
      },
      {
        id: "batasan",
        title: "Yang tidak tersedia di HP tanpa layanan Google",
        points: [
          "Notifikasi push (misalnya peringatan untuk pemilik) tidak masuk. Notifikasi di dalam aplikasi tetap ada.",
          "“Lanjut dengan Google” tidak bisa dipakai. Daftar dan masuk dengan email dan kata sandi.",
          "Tidak ada pembaruan otomatis dari Play Store.",
        ],
        description: "Fitur kasir, stok, laporan, offline, dan sinkronisasi tetap berjalan normal.",
      },
      {
        id: "perbarui",
        title: "Memperbarui aplikasi",
        description:
          "Buka lagi kasir.sissi.id/download, unduh APK terbaru, lalu pasang di atas versi lama. Data tetap aman karena berasal dari jalur yang sama. Versi yang tersedia tertulis di halaman itu.",
      },
      {
        id: "pindah-jalur",
        title: "Pindah dari APK ke Play Store (atau sebaliknya)",
        description:
          "Aplikasi dari APK dan dari Play Store ditandatangani dengan kunci berbeda, jadi yang satu tidak bisa dipasang di atas yang lain. Untuk pindah, aplikasi lama harus dicopot dulu.",
        steps: [
          "Buka Sissi dalam keadaan online dan tunggu sampai status sinkron menjadi “Tersinkron …” (tidak ada lagi yang “menunggu dikirim”).",
          "Copot aplikasi Sissi.",
          "Pasang dari jalur yang baru, lalu masuk lagi dengan akun yang sama. Data yang sudah tersinkron muncul kembali.",
        ],
        callout: {
          type: "warning",
          text: "Data yang belum tersinkron saat aplikasi dicopot akan hilang. Jangan copot aplikasi saat masih offline.",
        },
      },
    ],
    faqs: [
      {
        question: "Muncul “Aplikasi tidak terpasang” saat memasang APK.",
        answer:
          "Biasanya karena Sissi dari Play Store masih terpasang. Ikuti langkah pindah jalur di atas: sinkronkan dulu, copot aplikasi lama, lalu pasang APK.",
      },
      {
        question: "Apakah APK ini aman?",
        answer:
          "Unduh hanya dari kasir.sissi.id/download. Halaman itu juga menampilkan kode SHA-256 untuk mencocokkan berkas bila diperlukan.",
      },
    ],
    relatedSlugs: ["daftar-dan-masuk", "perbarui-aplikasi", "bekerja-offline"],
    keywords: ["apk", "huawei", "harmonyos", "appgallery", "tanpa play store", "sideload", "unduh", "install"],
  },
  {
    slug: "menyambungkan-printer-thermal-bluetooth",
    category: "mulai",
    title: "Menyambungkan printer struk & dapur",
    description: "Pasang printer Bluetooth atau jaringan (Wi-Fi/LAN), pilih kegunaannya, tes cetak, cek status printer di Kasir, laci uang, dan logo struk.",
    audience: ["Pemilik"],
    readMinutes: 8,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Printer diatur per perangkat di Pengaturan › “Printer & laci uang”. Sissi mendukung printer thermal Bluetooth dan printer jaringan (Wi-Fi/LAN). Satu perangkat bisa memakai beberapa printer, misalnya satu untuk struk kasir dan satu khusus dapur. Printer USB belum tersedia.",
    prerequisites: [
      "Printer thermal ESC/POS ukuran kertas 58 mm atau 80 mm.",
      "Printer Bluetooth: printer menyala dan dekat dengan perangkat, serta tidak sedang tersambung ke HP lain.",
      "Printer jaringan: printer dan perangkat kasir tersambung ke Wi-Fi/LAN yang sama, dan kamu tahu alamat IP printer (biasanya tercetak saat printer dinyalakan sambil menahan tombol feed).",
    ],
    steps: [
      {
        id: "atur-printer",
        title: "Buka Printer & laci uang",
        steps: [
          "Buka Pengaturan, lalu di grup “Perangkat” ketuk “Printer & laci uang”.",
          "Ketuk “Tambah printer”. Lembar “Printer baru” terbuka.",
        ],
        devices: {
          hp: "“Printer & laci uang” terbuka sebagai halaman sendiri.",
          tablet: "“Printer & laci uang” tampil di panel kanan Pengaturan.",
        },
        points: [
          "Bisa juga lewat pencarian “Printer struk”, atau langkah “Hubungkan printer struk” di kartu persiapan Beranda.",
          "“Perangkat ini” tidak lagi berisi pengaturan printer. Semua printer, cetak otomatis, dan laci uang diatur di “Printer & laci uang”.",
          "Sakelar di halaman ini langsung tersimpan (muncul “Pengaturan tersimpan”). Printer baru atau yang diubah tersimpan saat kamu mengetuk “Simpan” di lembarnya.",
          "Tiap printer tampil sebagai kartu, mis. “Bluetooth · 58 mm”, dengan tanda kegunaannya dan status sambungannya (baca “Status printer di Kasir” di bawah).",
        ],
        image: {
          ...TABLET,
          src: "/panduan/atur-printer-tablet.png",
          alt: "Halaman Printer & laci uang dengan printer kasir Bluetooth dan printer dapur jaringan",
          caption: "Dua printer: Bluetooth untuk struk, Wi-Fi/LAN untuk dapur.",
        },
      },
      {
        id: "lembar-printer",
        title: "Isi lembar printer: bagian dasar",
        description: "Lembar printer dibuat ringkas. Bagian dasar cukup untuk kebanyakan printer:",
        steps: [
          "“Nama printer” — terisi otomatis dari nama Bluetooth; ganti bila perlu, atau pilih nama cepat “Printer kasir”, “Printer dapur”, atau “Printer bar”.",
          "“Jenis sambungan” — “Bluetooth” atau “Jaringan (Wi-Fi/LAN)”, lalu pilih printernya (lihat dua bagian di bawah).",
          "“Lebar kertas” — “58 mm” atau “80 mm”, sesuai gulungan kertas printer ini.",
          "“Dipakai untuk” — centang “Struk kasir”, “Tiket dapur”, atau keduanya (lihat “Kegunaan printer”).",
          "Ketuk “Tes cetak”, periksa kertasnya, lalu ketuk “Simpan”.",
        ],
        points: [
          "Setelah tes cetak muncul petunjuk “Struk terpotong, terlalu lebar, atau kertas terbuang banyak? Buka Penyesuaian lanjutan di bawah.”",
        ],
      },
      {
        id: "bluetooth",
        title: "Printer Bluetooth",
        steps: [
          "Pilih “Jenis sambungan”: “Bluetooth”.",
          "Nyalakan printer dan dekatkan ke HP, lalu ketuk “Pilih printer Bluetooth”. Bila diminta, ketuk “Izinkan” untuk izin Perangkat sekitar (atau Lokasi di Android 11 ke bawah). Bila Bluetooth mati, ketuk “Nyalakan Bluetooth”.",
          "Sissi langsung mencari sendiri; printer muncul di “Sudah dipasangkan” atau “Ditemukan di sekitar”. Printer terdekat diberi tanda “Paling dekat”.",
          "Ketuk printernya untuk memilih. Printer yang belum dipasangkan bertanda “Pasangkan” — ketuk untuk memasangkannya langsung dari aplikasi.",
        ],
        points: [
          "Punya beberapa printer bernama sama? Namanya dibedakan dengan kode singkat, mis. “RPP02N (1A90)”. Ketuk “Cetak tes” di sebelah printer — printer yang mengeluarkan kertas bertuliskan “PRINTER INI” adalah printer itu.",
          "Printer tidak ada di daftar? Sebagian printer tidak mengirim nama. Ketuk “Tampilkan perangkat lain”, lalu ketuk “Cetak tes” pada “Perangkat tanpa nama” untuk memastikan.",
          "Di sebagian HP (terutama Android 11 ke bawah), Lokasi (GPS) harus menyala agar printer bisa ditemukan. Bila muncul “Nyalakan Lokasi”, ketuk “Buka pengaturan Lokasi”. Sissi tidak menyimpan lokasimu.",
        ],
        callout: {
          type: "tip",
          text: "Gagal memasangkan? Pastikan printer menyala dan tidak tersambung ke HP lain. PIN printer biasanya 0000 atau 1234. Bila printer tidak muncul, matikan lalu nyalakan lagi printernya, kemudian ketuk “Cari lagi”.",
        },
        image: {
          ...TABLET,
          src: "/panduan/bluetooth-printer-tablet.png",
          alt: "Pemilih printer Bluetooth: dua printer RPP02N dibedakan kode (1A90) dan (2B07), lencana Paling dekat, dan tombol Cetak tes",
          caption: "Printer bernama sama dibedakan kode singkat; ketuk “Cetak tes” untuk memastikan.",
        },
      },
      {
        id: "jaringan",
        title: "Printer jaringan (Wi-Fi/LAN)",
        steps: [
          "Pilih “Jenis sambungan”: “Jaringan (Wi-Fi/LAN)”.",
          "Isi “Alamat printer (IP)” (mis. 192.168.1.50) dan “Port” (umumnya 9100).",
          "Atur lebar kertas dan kegunaannya, ketuk “Tes cetak”, lalu “Simpan”.",
        ],
      },
      {
        id: "peran",
        title: "Kegunaan printer: struk kasir dan tiket dapur",
        description:
          "Di “Dipakai untuk”, centang satu atau keduanya. Satu printer boleh mencetak struk sekaligus tiket dapur; punya printer khusus dapur, tambahkan sebagai printer kedua.",
        points: [
          "“Struk kasir” — struk, laporan shift, QR meja, dan laci uang. Bila ada beberapa printer struk, yang dipakai adalah printer struk pertama yang siap.",
          "“Tiket dapur” — pesanan yang dikirim ke dapur. Tiket dicetak ke semua printer dapur; bila satu gagal, printer lain tetap mencetak.",
          "Printer baru belum dicentang apa pun, supaya kegunaannya dipilih dengan sadar. Selama belum dipilih, tombol simpan bertuliskan “Pilih kegunaan printer dulu”; mengetuknya menggulir ke “Dipakai untuk” dan menandai bagian itu.",
          "Di daftar, tiap printer ditandai “Struk”, “Dapur”, “Tidak dipakai”, atau “Belum lengkap”.",
        ],
        callout: {
          type: "warning",
          text: "Bila muncul “Belum ada printer untuk struk kasir”, centang “Struk kasir” di salah satu printer. Tanpa itu struk tidak tercetak, dan baris “Printer & laci uang” di Pengaturan bertuliskan “Belum ada printer struk”.",
        },
      },
      {
        id: "kertas",
        title: "Penyesuaian lanjutan: sisa kertas, pemotong, logo, kalibrasi",
        description:
          "Bagian “Penyesuaian lanjutan” di lembar printer terlipat secara bawaan. Ketuk untuk membukanya bila hasil tes cetak belum pas. Bagian ini terbuka sendiri bila printer itu pernah disesuaikan.",
        points: [
          "“Sisa kertas setelah struk”: “Pendek”, “Sedang”, atau “Panjang”. Pilih Pendek bila kertas terlalu banyak terbuang; Panjang bila tulisan terakhir ikut tersobek.",
          "“Punya pemotong kertas otomatis” — matikan bila kertas disobek manual. Kertas lalu dimajukan sampai batang sobek tanpa perintah potong.",
          "“Pilihan struk” › “Cetak logo toko” — matikan bila printer ini mencetak karakter acak pada logo.",
          "“Uji kalibrasi” — “Cetak uji kalibrasi” mencetak penggaris kolom dan garis selebar kertas untuk memeriksa ukuran yang pas; “Lihat pratinjau” menampilkan contohnya di layar.",
          "Lebar kertas diatur per printer. Di Pengaturan › “Struk”, bagian “Kertas” hanya menunjukkan lebar printer perangkat ini beserta tautan “Atur printer”; pilihan “Kertas untuk pratinjau” hanya muncul bila perangkat belum punya printer.",
        ],
      },
      {
        id: "cetak-otomatis-laci",
        title: "Cetak otomatis dan laci uang",
        description:
          "Bagian “Cetak otomatis” di “Printer & laci uang” muncul setelah ada printer yang siap. Sakelar struk dan laci hanya muncul bila ada printer “Struk kasir”; sakelar tiket dapur hanya bila ada printer “Tiket dapur”.",
        points: [
          "“Cetak struk otomatis” — struk tercetak setelah pembayaran berhasil.",
          "“Cetak tiket dapur otomatis” — tiket tercetak di printer dapur saat pesanan dikirim ke dapur.",
          "“Buka laci otomatis” — laci terbuka hanya untuk pembayaran yang memuat tunai (termasuk pembayaran “Gabungan” dan pelunasan kasbon tunai). QRIS, kartu, dan transfer tidak membuka laci.",
          "Laci tetap terbuka walau cetak struk otomatis dimatikan. Cetak ulang struk tidak membuka laci.",
          "Sakelar ini hanya ada di “Printer & laci uang”, dan berlaku untuk perangkat ini saja.",
        ],
      },
      {
        id: "laci-uang",
        title: "Memasang laci uang",
        description:
          "Laci uang (cash drawer) tidak disambungkan ke HP atau tablet, melainkan dicolok ke port laci di printer struk. Sissi mengirim perintah buka laci lewat printer itu.",
        points: [
          "Colokkan kabel laci (biasanya konektor RJ11/RJ12, port bertanda “DK” atau “Cash drawer”) ke printer yang dicentang “Struk kasir”, bukan ke printer dapur.",
          "Printer meja 80 mm umumnya punya port laci. Printer portabel 58 mm umumnya tidak punya, sehingga laci tidak bisa dibuka otomatis.",
          "Cocokkan tegangan laci dengan printer (umumnya 12V atau 24V). Lihat label atau spesifikasi keduanya sebelum membeli.",
        ],
        callout: {
          type: "info",
          text: "Spesifikasi port laci berbeda antar merek printer. Bila ragu, tanyakan ke penjual apakah printer “mendukung cash drawer” dan berapa tegangannya.",
        },
      },
      {
        id: "tes",
        title: "Tes cetak dan tes laci",
        points: [
          "“Tes cetak” ada di lembar tiap printer dan mencetak “TES CETAK” ke printer itu, walau belum disimpan. Tidak ada lagi tombol tes struk umum di halaman printer.",
          "Ingin melihat tampilan struk? Buka Pengaturan › “Struk” › “Lihat pratinjau”.",
          "“Tes buka laci” muncul di “Printer & laci uang” bila sudah ada printer “Struk kasir”.",
          "Bila muncul “Perintah buka laci terkirim” tetapi laci tidak terbuka, periksa kabel laci ke port printer struk.",
        ],
      },
      {
        id: "status-printer",
        title: "Status printer di Kasir",
        description:
          "Bila perangkat punya printer yang siap, kepala layar Kasir (HP dan tablet) menampilkan ikon printer berlatar warna. Warnanya merangkum semua printer perangkat ini:",
        points: [
          "Hijau — semua printer siap (“Semua printer siap”).",
          "Kuning — ada printer yang kertasnya hampir habis.",
          "Merah — ada printer yang belum siap: “Tidak terjangkau”, “Bluetooth mati”, “Izin Bluetooth belum diberikan”, atau “Kertas habis”.",
          "Abu — printer belum dicek atau sedang dicek (“Mengecek…”).",
          "Ketuk ikonnya untuk membuka lembar “Status printer”: daftar printer beserta statusnya dan waktu cek (“Dicek …”), tombol “Cek ulang”, langkah cepat di “Coba langkah ini” (mis. “Nyalakan printer & dekatkan ke perangkat ini”, “Putuskan printer dari HP/tablet lain”), dan “Buka pengaturan printer”.",
          "Di “Printer & laci uang”, tiap kartu printer juga punya lencana status dan tombol “Cek”.",
        ],
        callout: {
          type: "info",
          title: "Kapan printer dicek?",
          text: "Sissi mengecek printer tanpa mencetak, hanya di saat penting: aplikasi dibuka atau kembali dibuka, layar Kasir tampil, kasir dibuka (buka shift), halaman Printer & laci uang dibuka, dan saat kamu mengetuk “Cek ulang” atau “Cek”. Hasil setiap cetak juga langsung memperbarui status. Printer tidak dicek terus-menerus, agar baterai hemat dan printer tidak direbut dari HP/tablet lain.",
        },
        image: {
          ...TABLET,
          src: "/panduan/status-printer-tablet.png",
          alt: "Kasir tablet dengan ikon printer berlatar merah dan lembar Status printer: printer kasir Terhubung, printer dapur Tidak terjangkau, langkah perbaikan, dan tombol Cek ulang",
          caption: "Ikon printer merah = ada printer bermasalah; ketuk untuk melihat rinciannya.",
        },
      },
      {
        id: "status-tips",
        title: "Bila status printer merah atau abu",
        points: [
          "Printer Bluetooth murah sering butuh beberapa detik untuk “bangun” setelah dinyalakan atau lama diam. Bila tertulis “Tidak terjangkau” padahal printer menyala, tunggu sebentar lalu ketuk “Cek ulang”.",
          "Banyak printer Bluetooth murah tidak bisa melaporkan sisa kertas. Printer seperti ini tetap tampil “Terhubung”, tetapi kertas habis tidak terdeteksi — periksa gulungan kertasnya secara berkala.",
          "“Tidak dapat dicek” berarti jenis printer ini tidak bisa dicek tanpa mencetak. Pakai “Tes cetak” untuk memastikan.",
          "Status “Bluetooth mati” atau “Izin Bluetooth belum diberikan”: nyalakan Bluetooth perangkat ini, atau izinkan Perangkat sekitar di Pengaturan HP › Aplikasi › Sissi › Izin.",
        ],
      },
      {
        id: "isi-struk",
        title: "Atur isi struk",
        description:
          "Buka Pengaturan › “Struk”. Isi “Teks atas struk” (mis. Selamat datang!), “Teks bawah struk” (mis. info WiFi), dan “Instagram”, pilih “Tampilkan persen pajak” bila perlu, lalu cek lewat “Lihat pratinjau”. Pengaturan ini berlaku untuk semua perangkat di outlet.",
      },
      {
        id: "logo-struk",
        title: "Logo toko di struk",
        steps: [
          "Buka Pengaturan › “Struk”, lalu di kartu “Logo toko” ketuk “Pilih logo” (atau “Ganti logo”). Unggah logo butuh internet; berkas JPG atau PNG maksimal 2 MB.",
          "Nyalakan “Tampilkan logo di struk”. Logo dicetak hitam-putih di atas nama usaha pada struk pelanggan.",
          "Pilih “Gaya cetak”: “Otomatis”, “Garis tegas” (untuk logo berwarna datar), atau “Foto (arsir)” (untuk gambar bergradasi). Periksa “Hasil cetak” di layar.",
        ],
        points: [
          "Logo dicetak paling lebar ⅔ lebar kertas dan tidak terlalu tinggi (sekitar 12 mm di kertas 58 mm, 18 mm di 80 mm), supaya struk tidak boros kertas.",
          "Paling bagus logo berwarna gelap dengan latar putih atau transparan. Aplikasi memberi peringatan bila logo terlalu terang, hampir hitam penuh, atau resolusinya kecil.",
          "Logo diunduh ke tiap perangkat agar tetap tercetak saat offline. Bila muncul “Logo belum tersimpan di perangkat ini”, sambungkan internet sebentar.",
          "Printer yang mencetak karakter acak pada logo: matikan “Cetak logo toko” di “Penyesuaian lanjutan” printer itu saja.",
        ],
      },
      {
        id: "salinan-toko",
        title: "Salinan struk untuk toko",
        description:
          "Perlu arsip kertas untuk kasir? Sissi bisa mencetak satu salinan bertanda “SALINAN TOKO” setelah struk pelanggan, untuk semua transaksi.",
        steps: [
          "Buka Pengaturan › “Struk”, lalu di kartu “Salinan untuk toko” nyalakan “Cetak salinan untuk toko”.",
          "Pilih “Isi salinan”: “Sama seperti struk”, atau “Ringkas” (tanpa daftar barang — hanya nomor, waktu, kasir, total, dan pembayaran; hemat kertas).",
          "Ketuk “Lihat contoh salinan” untuk melihat hasilnya.",
        ],
        points: [
          "Printer tanpa pemotong otomatis: setelah struk pelanggan, muncul “Sobek struk pelanggan dulu”. Sobek struknya, lalu ketuk “Cetak salinan”.",
          "Butuh salinan untuk transaksi yang sudah lewat? Buka “Riwayat” › pilih transaksi › “Lainnya” › “Salinan toko”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/struk-salinan-tablet.png",
          alt: "Pengaturan Struk dengan Cetak salinan untuk toko aktif, pilihan isi salinan Ringkas, dan pratinjau struk",
          caption: "Nyalakan salinan untuk toko dan pilih isinya.",
        },
      },
      {
        id: "cetak-ulang",
        title: "Bila struk atau tiket dapur gagal dicetak",
        points: [
          "Bila struk gagal, muncul “Struk gagal dicetak” dengan pilihan “Coba lagi” atau “Lewati”. Transaksi tetap tersimpan.",
          "Struk bisa dicetak ulang dari “Riwayat” › buka transaksi › “Cetak ulang” di bilah bawah.",
          "Bila tiket dapur gagal saat bayar langsung, layar “Pembayaran berhasil” menampilkan kotak merah “Tiket dapur gagal dicetak” beserta sebabnya. Ketuk “Cetak ulang tiket dapur” setelah printer dapur siap. Bila belum ada printer dapur, muncul “Belum ada printer dapur. Atur di Pengaturan › Printer & laci uang.”",
          "Tiket dapur transaksi yang sudah lewat bisa dicetak ulang dari “Riwayat” › buka transaksi › “Lainnya” › “Cetak tiket dapur” (muncul bila perangkat punya printer dapur dan transaksi itu punya tiket).",
          "Saat menyimpan atau mengubah pesanan berjalan, tiket dapur yang gagal ditampilkan sebagai pesan “Tiket dapur tidak tercetak: …”; pesanan tetap tersimpan.",
          "Bila sambungan ke printer dapur sempat ditolak, Sissi mencoba sekali lagi secara otomatis sebelum menyatakan gagal.",
          "Pengaturan printer tetap tersimpan di perangkat walau kamu keluar akun lalu masuk lagi atau mengulang setup perangkat.",
        ],
      },
    ],
    faqs: [
      {
        question: "Kertas keluar tetapi kosong.",
        answer: "Gulungan kertas thermal kemungkinan terbalik. Lapisan yang bisa dicetak hanya satu sisi.",
      },
      {
        question: "Muncul “Printer tidak terjangkau” atau status printer merah.",
        answer:
          "Pastikan printer menyala, lalu ketuk “Cek ulang” di lembar Status printer. Untuk printer jaringan, cek alamat IP dan pastikan satu Wi-Fi dengan perangkat (alamat IP bisa berubah bila router memberi alamat baru). Untuk Bluetooth, dekatkan printer, tunggu beberapa detik setelah dinyalakan, dan pastikan tidak tersambung ke HP lain.",
      },
      {
        question: "Bagaimana memilih ulang printer Bluetooth?",
        answer:
          "Buka Pengaturan › “Printer & laci uang”, ketuk kartu printernya, lalu ketuk “Pilih printer Bluetooth” dan pilih printernya lagi. Ketuk “Tes cetak”, lalu “Simpan”.",
      },
      {
        question: "Muncul “Izin Bluetooth belum diberikan”.",
        answer:
          "Buka Pengaturan HP › Aplikasi › Sissi › Izin, aktifkan Perangkat sekitar, lalu pilih ulang printernya di Pengaturan › “Printer & laci uang”.",
      },
      {
        question: "Printer sudah diatur, tetapi tertulis “Printer struk belum diatur” atau “Belum ada printer struk”.",
        answer:
          "Pastikan salah satu printer dicentang “Struk kasir” di “Dipakai untuk”. Printer yang hanya dicentang “Tiket dapur” tidak mencetak struk. Bila printer hilang sendiri dari daftar, perbarui aplikasi ke versi terbaru.",
      },
      {
        question: "Laci uang tidak terbuka.",
        answer:
          "Laci hanya terbuka untuk pembayaran tunai, dan harus dicolok ke port laci printer “Struk kasir”. Pastikan “Buka laci otomatis” menyala, lalu coba “Tes buka laci”. Printer portabel 58 mm umumnya tidak punya port laci.",
      },
      {
        question: "Bisakah memakai printer USB?",
        answer: "Belum. Gunakan printer Bluetooth atau jaringan (Wi-Fi/LAN).",
      },
      {
        question: "Bagaimana kalau belum punya printer?",
        answer:
          "Transaksi tetap bisa dicatat. Setelah bayar muncul “Struk tidak dicetak: printer struk belum diatur.”; struk bisa dilihat lewat “Pratinjau struk” atau dikirim lewat “Kirim struk via WhatsApp”.",
      },
      {
        question: "Apakah printer termasuk fitur Pro?",
        answer: "Tidak. Printer, tes cetak, status printer, laci, dan cetak ulang bisa dipakai di paket Gratis.",
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "layar-dapur", "tanya-jawab-masalah-umum"],
    keywords: ["printer", "bluetooth", "thermal", "struk", "nota", "wifi", "lan", "58mm", "80mm", "laci", "cash drawer", "printer dapur", "pairing", "pemotong", "auto cut", "cetak tes", "paling dekat", "salinan struk", "salinan toko", "arsip struk", "printer & laci uang", "status printer", "cek printer", "cek ulang", "logo struk", "logo toko", "header struk", "footer struk", "teks atas struk", "tiket dapur gagal", "cetak ulang tiket dapur", "kalibrasi", "printer belum diatur"],
  },

  // ───────────────────────────── PRODUK ─────────────────────────────
  {
    slug: "menambah-produk",
    category: "produk",
    title: "Menambah produk (satu harga)",
    description: "Isi form Tambah produk: kategori, satuan & stok, harga, HPP, dan pengaturan jual.",
    audience: ["Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Produk dikelola di menu “Produk” (khusus pemilik; untuk usaha jasa bernama “Layanan”). Form disusun dari atas ke bawah: identitas produk, satuan & stok, jenis harga, kode barang, lalu pengaturan jual dan pilihan ekstra.",
    steps: [
      {
        id: "buka-form",
        title: "Buka form dan isi nama",
        steps: [
          "Buka “Produk”, lalu ketuk “Tambah produk”.",
          "Tambahkan “Foto produk” bila ada (“Ambil foto” atau “Pilih dari galeri”). Unggah foto butuh internet.",
          "Pakai foto persegi: “Foto persegi (1:1), min. 600×600 px, objek di tengah”. Kartu produk di Kasir berbentuk persegi; foto yang tidak persegi tetap tampil utuh, dan sisa ruangnya diisi latar buram dari foto itu.",
          "Isi “Nama produk”.",
          "Ketuk “Kategori”. Belum ada kategori yang cocok? Ketuk “Buat kategori baru” di bawah daftar, isi namanya, dan kategori itu langsung terpilih.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/produk-pilih-kategori-tablet.png",
          alt: "Pemilih kategori dengan tombol Buat kategori baru",
          caption: "Kategori baru bisa dibuat tanpa keluar dari form.",
        },
      },
      {
        id: "satuan-stok",
        title: "Satuan & stok",
        description:
          "Pilih “Satuan” (pilih “Satuan lain…” untuk menulis sendiri). Nyalakan “Lacak stok” bila stok produk ini ingin berkurang otomatis saat terjual. Produk yang memakai resep tanpa lacak stok menampilkan “Stok dihitung dari bahan baku di resep”; ketuk “Hitung juga stok produk jadinya” bila tetap ingin melacak stok produknya.",
        image: {
          ...TABLET,
          src: "/panduan/produk-satuan-stok-tablet.png",
          alt: "Bagian Satuan & stok dan Jenis harga di form Tambah produk",
          caption: "Satuan & stok ada di atas, sebelum Jenis harga.",
        },
      },
      {
        id: "lipatan-hp",
        title: "Di HP: bagian form bisa dilipat",
        description:
          "Supaya form tidak terlalu panjang di HP, bagian “Satuan & stok”, “Kode barang”, “Pengaturan jual”, dan “Pilihan ekstra” bisa dilipat. Bagian terlipat hanya menampilkan judul dan ringkasan isinya, mis. “pcs · Lacak stok · Stok 6” atau “Dijual · Kena pajak · Ke dapur”. Ketuk judulnya untuk membuka atau melipat.",
        points: [
          "Foto, nama, kategori, jenis harga, harga/HPP/varian, dan stok selalu terbuka.",
          "Bagian yang sudah berisi data terbuka sendiri saat form dibuka. Setelah itu bagian hanya terlipat bila kamu sendiri yang melipatnya.",
          "Bila ada isian yang salah di bagian terlipat (mis. barcode ganda), bagian itu dibuka otomatis saat “Simpan”.",
          "Di tablet, form tetap satu kolom tanpa lipatan.",
        ],
      },
      {
        id: "harga",
        title: "Jenis harga, harga jual, dan HPP",
        steps: [
          "Pada “Jenis harga”, pilih “Satu harga”. (Untuk ukuran/rasa berbeda harga, baca “Produk dengan varian”.)",
          "Isi “Harga”.",
          "Pada “HPP (harga modal)”, pilih “Modal manual” lalu isi “Harga modal”, atau pilih “Resep” untuk menghitung dari bahan baku. Aplikasi menampilkan laba dan margin.",
          "Bila “Lacak stok” menyala, isi “Stok awal” dan “Stok minimum” (batas untuk peringatan stok menipis).",
          "“SKU (opsional)” dan “Barcode (opsional)” ada di bagian “Kode barang” dan berguna untuk scan barcode di kasir. Di tablet, usaha selain ritel melihatnya sebagai tautan “+ Tambah kode barang (SKU/barcode)” selama masih kosong; ketuk untuk membukanya.",
        ],
        callout: {
          type: "tip",
          text: "Harga modal boleh dikosongkan, tetapi laba kotor di laporan jadi tidak akurat. Laporan akan mengingatkan produk yang belum punya harga modal.",
        },
      },
      {
        id: "pengaturan-jual",
        title: "Pengaturan jual dan simpan",
        points: [
          "“Dijual di kasir” — matikan untuk menyembunyikan produk dari kasir tanpa menghapusnya.",
          "“Kena pajak” — ikut dihitung pajak.",
          "“Kirim ke dapur” — item masuk tiket dapur saat dipesan (muncul bila fitur dapur aktif).",
          "“Pilihan ekstra” — pasang grup pilihan tambahan seperti level gula atau topping lewat “Pilih grup pilihan ekstra”.",
        ],
        description: "Terakhir, ketuk “Simpan”. Bila ada isian yang belum benar, aplikasi menggulir ke isian itu.",
      },
      {
        id: "draf",
        title: "Keluar sebelum selesai: draf dan “Buang perubahan?”",
        description:
          "Bila form Tambah produk ditutup saat sudah terisi, muncul “Simpan sebagai draf?” dengan pilihan “Simpan sebagai draf”, “Lanjut mengisi”, atau “Buang”.",
        points: [
          "Saat membuka “Tambah produk” lagi, aplikasi menawarkan “Lanjutkan draf?” — pilih “Lanjutkan” atau “Mulai baru”.",
          "Draf hanya tersimpan di perangkat ini dan hanya satu per outlet.",
          "Saat mengubah produk yang sudah ada, menutup form memunculkan “Buang perubahan?”. Konfirmasi serupa ada di form lain di aplikasi.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/produk-simpan-draf-tablet.png",
          alt: "Dialog Simpan sebagai draf di form Tambah produk",
          caption: "Isian tidak hilang tanpa sengaja.",
        },
      },
    ],
    faqs: [
      {
        question: "Di mana mengatur kategori?",
        answer:
          "Di “Produk” › “Kelola” › “Kategori”, atau Pengaturan › “Kategori produk”. Di tablet, daftar produk juga punya kolom kategori dengan tautan “+ Kategori baru”.",
      },
      {
        question: "Bagaimana mencari produk di daftar?",
        answer:
          "Pakai kolom “Cari nama / SKU”. Di HP, ketuk “Filter” untuk menyaring kategori, “Status” (Dijual / Tidak dijual), “Stok” (Habis, Menipis, Aman, Tidak dilacak), harga modal, dan urutan, lalu “Terapkan”. Tombolnya menjadi “Filter (n)” selama ada saringan aktif; saringan aktif juga tampil sebagai chip — ketuk chip untuk menghapusnya. Di tablet, saringan ada di sebelah kolom cari.",
      },
      {
        question: "Bagaimana menyembunyikan produk dari kasir tanpa menghapusnya?",
        answer:
          "Matikan “Dijual di kasir” di form produk. Di daftar produk HP, ketuk menu ⋯ di baris produk › “Sembunyikan dari kasir” (dan “Jual lagi di kasir” untuk menampilkannya lagi); produknya diberi lencana “Tidak dijual”. Di tablet, pakai sakelar di kolom daftar.",
      },
      {
        question: "Bagaimana mengatur urutan kategori di kasir?",
        answer:
          "Buka “Produk” › “Kelola” › “Kategori”, lalu seret pegangan ⠿ di kiri kategori ke urutan yang diinginkan. Ubah atau hapus kategori lewat menu ⋯ di barisnya. Menu ⋯ yang sama dipakai di daftar area meja, diskon, dan pilihan ekstra.",
      },
      {
        question: "Bisakah impor produk dari Excel?",
        answer: "Bisa. Berkas Excel (.xlsx) atau CSV bisa langsung diimpor lewat “Produk” › “Kelola” › “Impor produk”. Baca “Impor banyak produk dari Excel atau CSV”.",
      },
    ],
    relatedSlugs: ["impor-produk-dari-csv", "produk-dengan-varian", "hpp-resep-dan-bahan-baku"],
    keywords: ["menu", "katalog", "item", "barang", "kategori", "harga", "foto produk", "draf", "sku", "barcode", "foto persegi", "ukuran foto", "1:1", "kode barang", "sembunyikan produk", "filter produk", "urutan kategori", "modifier"],
  },
  {
    slug: "impor-produk-dari-csv",
    category: "produk",
    title: "Impor banyak produk dari Excel atau CSV",
    description: "Isi template Excel atau CSV, periksa hasilnya, lalu impor sampai 1.000 produk sekaligus — lengkap dengan varian, bahan baku, resep, dan pilihan ekstra.",
    audience: ["Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Punya banyak produk? Daripada mengisi satu per satu, isi template lalu impor sekaligus. Berkas Excel (.xlsx) bisa langsung dipilih tanpa diubah ke CSV, dan template Excel lengkap juga memuat varian, bahan baku, resep, dan pilihan ekstra. Ekspor Excel dari aplikasi kasir lain juga bisa dicoba langsung: lembar dan kolomnya dikenali otomatis. Sebelum menyimpan, aplikasi menampilkan hasilnya sehingga kamu bisa memilih produk yang diimpor dan menangani baris kembar.",
    prerequisites: ["Aplikasi spreadsheet seperti Excel atau Google Sheets (di HP atau komputer)."],
    steps: [
      {
        id: "buka",
        title: "Buka Impor produk",
        steps: [
          "Buka “Produk”, ketuk “Kelola”, lalu “Impor produk”. Lembar “Kelola produk” juga berisi “Stok & harga modal”, “Stok menipis”, “Kategori”, “Pilihan ekstra”, dan “Diskon”.",
          "Bila daftar produk masih kosong, bisa juga lewat tautan “Atau impor banyak produk dari Excel atau CSV”.",
        ],
      },
      {
        id: "template",
        title: "Unduh dan isi template",
        steps: [
          "Ketuk “Unduh template”, lalu pilih “Excel lengkap” (produk, varian, bahan baku, resep, dan pilihan ekstra dalam satu berkas) atau “CSV sederhana” (produk saja; varian lewat kolom varian).",
          "Simpan atau kirim berkas templatenya (mis. ke Google Drive atau email), lalu buka di Excel/Google Sheets.",
          "Isi satu baris untuk satu produk; hapus baris contoh.",
          "Simpan sebagai .xlsx atau .csv (CSV boleh memakai pemisah koma atau titik koma).",
        ],
        points: [
          "Wajib: “nama” dan “harga” (angka tanpa titik, mis. 15000).",
          "Opsional: “kategori” (dibuat otomatis bila belum ada), “modal”, “sku”, “barcode” (lebih dari satu dipisah titik koma), “satuan” (kosong = pcs), “lacak_stok” (ya/tidak), “stok_awal”, “stok_min”, “kena_pajak” (ya/tidak, kosong = ya), dan “deskripsi”.",
          "Kolom “varian” boleh kosong; untuk produk bervarian, ulangi nama produk di baris lain dengan varian berbeda. Kolom “pilihan_ekstra” berisi nama grup pilihan ekstra, dipisah titik koma (;).",
          "Usaha jasa punya kolom tambahan “durasi_menit”.",
          "Kolom yang tidak dikenali diabaikan.",
        ],
      },
      {
        id: "lembar-excel",
        title: "Lembar lain di template Excel",
        description:
          "Template Excel lengkap punya lembar tambahan. Isi yang perlu saja; lembar dikenali dari judul kolomnya, dan lembar yang tidak dikenali diabaikan.",
        points: [
          "“Varian” — nama_produk, varian, harga, modal, sku, barcode.",
          "“Bahan” — nama_bahan, satuan (g, kg, ml, l, pcs…; liter ditulis “l” di berkas dan tampil “L” di aplikasi), harga_beli, isi_kemasan, stok_min, sku, susut_persen (opsional: bagian yang terbuang saat dibersihkan, mis. 10).",
          "“Resep” — nama_produk, varian (boleh kosong), nama_bahan, jumlah, satuan, hasil_porsi (opsional: isi bila jumlah = berat bersih satu adonan yang menghasilkan N porsi).",
          "“Pilihan Ekstra” — grup, pilih_satu (ya/tidak), pilihan, harga.",
        ],
      },
      {
        id: "pilih-berkas",
        title: "Pilih berkas dan periksa hasilnya",
        steps: [
          "Ketuk “Pilih berkas”, lalu pilih berkas .xlsx atau .csv. Muncul layar “Periksa impor”.",
          "Di bagian atas ada kartu berkas berisi nama berkas dan isinya (mis. jumlah produk, varian, bahan baku). Salah memilih berkas? Ketuk “Ganti berkas”.",
          "“Gagal” — baris yang isiannya salah, mis. “harga: bukan angka yang sah”. Perbaiki di berkas, lalu pilih ulang berkasnya.",
          "“Kembar di berkas” — baris dengan SKU/barcode sama: pilih satu yang dipakai. Baris dengan nama sama: centang semua yang memang ingin diimpor.",
          "“Sudah ada di daftar produk” — produk yang SKU, barcode, atau namanya sudah ada. Pilih “Pertahankan” (bawaan) atau “Pakai berkas” untuk menimpa.",
          "“Siap diimpor” — centang produk yang mau diimpor, atau “Pilih semua”.",
        ],
        points: [
          "Banner “Kategori baru yang akan dibuat” menunjukkan kategori yang belum ada.",
          "Bagian “Bahan baku” dan “Pilihan ekstra” menampilkan bahan dan grup yang akan dibuat. Bahan atau grup bernama sama yang sudah ada dipakai tanpa diubah.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/impor-csv-tablet.png",
          alt: "Layar Periksa impor dengan baris kembar dan tombol Impor 7 produk",
          caption: "Periksa impor: pilih baris kembar sebelum mengimpor.",
        },
      },
      {
        id: "impor",
        title: "Impor",
        steps: [
          "Ketuk “Impor … produk”. Bila ada produk yang ditimpa, konfirmasi “Timpa & impor”.",
          "Muncul “Impor selesai” dengan jumlah produk baru, diperbarui, dan dilewati (serta varian, resep, bahan baku, dan grup pilihan ekstra bila ada). Ketuk “Selesai” atau “Impor berkas lain”.",
        ],
        callout: {
          type: "info",
          text: "Impor berjalan tanpa internet. Produk tersimpan di perangkat lalu dikirim ke server saat ada koneksi. Bila gagal, tidak ada produk yang tersimpan sebagian.",
        },
      },
    ],
    faqs: [
      {
        question: "Apakah bisa mengimpor varian?",
        answer:
          "Bisa, untuk produk baru: isi lembar “Varian” di template Excel, atau ulangi nama produk dengan kolom “varian” berbeda. Varian produk yang sudah ada tetap diatur lewat form produk.",
      },
      {
        question: "Apakah stok produk yang sudah ada ikut berubah?",
        answer:
          "Tidak. “stok_awal” hanya berlaku untuk produk baru. Menimpa produk dengan “Pakai berkas” mengubah nama, harga, kategori, kode, dan pengaturan, tetapi tidak mengubah stok. Sel kosong mempertahankan data lama.",
      },
      {
        question: "Berapa batasnya?",
        answer: "Maksimal 1.000 produk per berkas, dengan ukuran berkas maksimal 2 MB untuk CSV dan 5 MB untuk Excel. Lebih dari itu, bagi menjadi beberapa berkas.",
      },
      {
        question: "Berkas saya .xls (Excel lama).",
        answer: "Buka di Excel lalu simpan ulang sebagai .xlsx, kemudian pilih lagi.",
      },
      {
        question: "Muncul “Kolom \"nama\" tidak ditemukan”.",
        answer: "Baris pertama berkas harus berisi judul kolom dari template. Unduh ulang template dan salin datamu ke dalamnya.",
      },
    ],
    relatedSlugs: ["menambah-produk", "produk-dengan-varian", "hpp-resep-dan-bahan-baku", "stok-barang-dan-stok-masuk"],
    keywords: ["impor", "import", "csv", "excel", "xlsx", "google sheets", "upload produk", "massal", "bulk", "template", "pindah dari aplikasi lain", "resep", "bahan baku", "pilihan ekstra", "modifier"],
  },
  {
    slug: "produk-dengan-varian",
    category: "produk",
    title: "Produk dengan varian",
    description: "Ukuran, suhu, rasa: pilihan varian maks 3, kombinasi otomatis, isi massal, dan stok per varian.",
    audience: ["Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED,
    overview:
      "Varian dipakai bila satu produk punya beberapa pilihan dengan harga atau stok berbeda, misalnya Es Kopi ukuran S/M/L dan suhu Panas/Es. Kamu cukup menulis pilihannya; kombinasinya dibuat otomatis.",
    steps: [
      {
        id: "pilih-punya-varian",
        title: "Pilih “Punya varian”",
        description:
          "Di form produk, pada “Jenis harga” pilih “Punya varian”. Harga, HPP, stok, SKU, dan barcode kini diatur per varian. “Satuan” dan “Lacak stok” tetap berlaku untuk semua varian.",
      },
      {
        id: "tambah-pilihan",
        title: "Tulis pilihan varian (maks 3)",
        steps: [
          "Ketuk “Tambah pilihan”, lalu tulis “Nama pilihan” (mis. Ukuran) atau ketuk usulan cepat seperti Ukuran, Suhu, Rasa, Warna.",
          "Ketik nilainya di “Nilai” lalu tekan Enter (boleh dipisah koma), mis. S, M, L.",
          "Ulangi untuk pilihan kedua atau ketiga bila perlu, mis. Suhu: Panas, Es.",
        ],
        points: [
          "Kombinasi dibuat otomatis, mis. “S / Panas”, “S / Es”, dan seterusnya (maks 100 kombinasi).",
          "Menu ⋯ di tiap pilihan berisi “Ganti nama pilihan” dan “Hapus pilihan ini”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/produk-varian-tablet.png",
          alt: "Bagian Pilihan varian dan Daftar kombinasi di form produk",
          caption: "Dua pilihan (Ukuran, Suhu) menghasilkan 6 kombinasi.",
        },
      },
      {
        id: "isi-kombinasi",
        title: "Isi harga, HPP, dan stok tiap kombinasi",
        description:
          "Di “Daftar kombinasi”, ketuk satu baris untuk membuka rinciannya: “Harga”, “HPP (harga modal)” (Modal manual atau Resep), “Stok awal”, “Stok minimum”, SKU, barcode, dan “Foto varian”.",
        points: [
          "Baris bertanda “Harga belum diisi” wajib diisi sebelum menyimpan.",
          "“Stok awal belum diisi” hanya pengingat, bukan galat.",
          "Seret pegangan di kiri baris untuk mengatur urutan tampil di kasir.",
          "Matikan sakelar di baris untuk menyembunyikan kombinasi itu dari kasir.",
        ],
      },
      {
        id: "isi-massal",
        title: "Isi massal: banyak varian sekaligus",
        steps: [
          "Ketuk “Isi massal”.",
          "Pada “Terapkan ke”, pilih nilai yang mau diubah (mis. hanya ukuran L). Tanpa pilihan berarti semua varian.",
          "Isi kolom yang perlu: “Harga”, “HPP manual”, “Stok minimum”, atau “Stok awal (varian baru)”. Kosongkan kolom yang tidak ingin diubah.",
          "Ketuk “Lihat pratinjau”, periksa perubahannya, lalu “Terapkan ke … varian”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/produk-isi-massal-tablet.png",
          alt: "Pratinjau isi massal sebelum diterapkan",
          caption: "Pratinjau menunjukkan harga lama → baru sebelum diterapkan.",
        },
      },
      {
        id: "stok-lama",
        title: "Produk lama yang sudah punya stok",
        description:
          "Bila produk yang stoknya dilacak diberi varian untuk pertama kali, saat “Simpan” muncul “Stok lama produk”. Pilih varian penampung stok lama, atau “Atur nanti lewat opname”.",
        callout: {
          type: "info",
          text: "Stok varian yang sudah tersimpan diubah lewat “Sesuaikan” (penyesuaian atau stok masuk), bukan lewat isi massal, agar perubahannya tercatat.",
        },
      },
    ],
    faqs: [
      {
        question: "Bagaimana kasir memilih varian?",
        answer:
          "Saat produk diketuk di Kasir, muncul pilihan per dimensi (mis. Ukuran lalu Suhu). Kombinasi yang dimatikan atau stoknya habis tidak bisa dipilih.",
      },
      {
        question: "Kenapa harga di kasir tertulis “Mulai Rp…”?",
        answer: "Untuk produk bervarian, kartu produk menampilkan harga varian aktif yang termurah.",
      },
    ],
    relatedSlugs: ["menambah-produk", "hpp-resep-dan-bahan-baku", "stok-barang-dan-stok-masuk"],
    keywords: ["varian", "ukuran", "size", "rasa", "warna", "suhu", "kombinasi", "isi massal", "bulk"],
  },
  {
    slug: "hpp-resep-dan-bahan-baku",
    category: "produk",
    title: "Harga modal (HPP), resep & bahan baku",
    description: "Pilih Modal manual atau Resep, isi resep per porsi atau per adonan, atur susut bahan, dan pahami satuan yang terkunci.",
    audience: ["Pemilik"],
    readMinutes: 8,
    lastUpdated: UPDATED_OCT23,
    overview:
      "HPP (harga pokok penjualan) adalah modal per porsi atau per barang. Sissi memakainya untuk menghitung laba kotor. HPP bisa ditulis langsung (Modal manual) atau dihitung dari resep bahan baku.",
    steps: [
      {
        id: "manual-atau-resep",
        title: "Modal manual atau Resep",
        points: [
          "“Modal manual” — tulis harga modal per satuan. Cocok untuk barang jadi yang dibeli lalu dijual lagi.",
          "“Resep” — tulis bahan yang terpakai per 1 porsi. HPP dihitung dari harga beli bahan, dan stok bahan berkurang otomatis saat produk terjual.",
        ],
      },
      {
        id: "isi-resep",
        title: "Mengisi resep",
        steps: [
          "Di form produk, pada “HPP (harga modal)” pilih “Resep”.",
          "Pada “Cara isi takaran”, biarkan “Per porsi”. Ketuk “Tambah bahan”, pilih bahan baku, lalu isi “Jumlah” per porsi.",
          "Bahan belum ada? Ketuk “Buat bahan baku baru”: isi nama, satuan, stok minimum, dan harga beli awal, lalu langsung isi takarannya.",
          "Hasilnya tampil sebagai “HPP … · margin …%”.",
          "Produk beresep yang stoknya tidak dilacak menampilkan “Stok dihitung dari bahan baku di resep”: setiap terjual, bahannya berkurang otomatis.",
        ],
        description: "Untuk produk bervarian, resep bisa dibuat untuk “Semua varian” atau per varian. Varian tanpa resep sendiri memakai resep “Semua varian”.",
      },
      {
        id: "resep-per-adonan",
        title: "Resep per adonan (sekali masak)",
        description:
          "Cocok untuk menu yang dimasak sekaligus banyak, mis. nasi goreng, rendang, atau sambal. Kamu cukup menulis bahan untuk sekali masak; Sissi menghitung takaran per porsinya.",
        steps: [
          "Di resep, pada “Cara isi takaran” pilih “Per adonan”.",
          "Isi “Hasil sekali masak”, mis. 10 porsi (ketik angkanya atau pakai tombol − / +).",
          "Ketuk “Tambah bahan”, lalu isi “Takaran bersih” untuk sekali masak: berat yang sudah dikupas atau dibersihkan, belum dimasak.",
          "Cek baris di bawah tiap bahan, mis. “Dipotong stok 25 g per porsi (susut 20%)”, lalu simpan produk.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/resep-per-adonan-tablet.png",
          alt: "Resep Nasi Goreng Kampung diisi per adonan: hasil 10 porsi dengan beras, bawang merah, dan minyak goreng",
          caption: "Takaran sekali masak untuk 10 porsi; stok tetap dipotong per porsi.",
        },
        callout: {
          type: "warning",
          text: "Bila bahan dicatat dalam satuan besar (mis. liter) dan takaran per porsinya kecil, takaran dibulatkan dan muncul peringatan kuning. Barisnya tertulis mis. “Dibulatkan dari 2,5 ml — terpotong lebih ~20%”; ketuk ikon (i) untuk penjelasannya. Untuk bahan baru seperti ini, pilih satuan g atau ml.",
        },
      },
      {
        id: "susut-bahan",
        title: "Susut bahan saat dibersihkan",
        steps: [
          "Buka “Inventori” › “Bahan baku”, pilih bahannya, lalu “Ubah bahan”.",
          "Isi “Susut saat dibersihkan (%)”, mis. 20 untuk bawang merah yang dikupas. Paling banyak 90%.",
          "Cek pratinjaunya, mis. “Beli 1.000 g → terpakai ± 800 g (susut 20%)”, lalu ketuk “Simpan”.",
          "Bila bahan dipakai resep per adonan, muncul “Hitung ulang resep?” berisi perubahan modal menu. Ketuk “Simpan & hitung ulang”.",
        ],
        points: [
          "Susut hanya untuk bagian yang dibuang sebelum dimasak (kulit, tulang, bonggol). Susut saat dimasak tidak dihitung.",
          "Resep yang diisi per porsi tidak ikut berubah. Buka resepnya bila ingin menerapkan susut.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/bahan-susut-tablet.png",
          alt: "Form Ubah bahan baku Bawang merah dengan susut saat dibersihkan 20%",
          caption: "Susut 20%: beli 1.000 g, terpakai sekitar 800 g.",
        },
      },
      {
        id: "urutan-hpp",
        title: "Urutan HPP yang dipakai",
        description: "Bila satu produk punya beberapa sumber HPP, Sissi memakai yang pertama tersedia dari urutan ini:",
        steps: [
          "Modal manual varian",
          "Resep varian",
          "Modal manual produk",
          "Resep produk",
        ],
        callout: {
          type: "info",
          text: "Mengganti sumber dari Resep ke Modal manual akan menghapus resep saat disimpan; aplikasi memberi tahu sebelum itu terjadi.",
        },
      },
      {
        id: "lacak-stok-dan-resep",
        title: "Lacak stok produk sekaligus resep",
        description:
          "Bila “Lacak stok” menyala dan produk memakai resep, muncul peringatan “Stok produk & bahan sama-sama berkurang”. Pilih “Matikan lacak stok” untuk produk racikan (mis. minuman), atau “Biarkan keduanya” bila memang perlu.",
      },
      {
        id: "kelola-bahan",
        title: "Mengelola bahan baku",
        description:
          "Bahan baku dikelola di “Inventori” › “Bahan baku”: tambah lewat “Bahan baru”, catat pembelian lewat “Bahan masuk”, dan kurangi stok lewat “Kurangi / sesuaikan” (alasan Limbah, Hilang/rusak, atau Koreksi hitung).",
      },
      {
        id: "satuan-terkunci",
        title: "Satuan bahan terkunci",
        description:
          "Satuan bahan (mis. g, kg, L) tidak bisa diganti lagi setelah bahan punya riwayat: pernah ada stok masuk atau keluar, dipakai resep atau resep pilihan ekstra, atau tercantum di pesanan pembelian (PO), opname, atau transfer. Kolom “Satuan” tampil dengan ikon gembok beserta sebabnya. Ini menjaga stok dan harga rata-rata yang sudah tercatat tetap benar, karena Sissi tidak mengubah angka lama secara otomatis.",
        steps: [
          "Perlu satuan lain? Di form “Ubah bahan baku”, ketuk “Buat bahan baku baru” di bawah kolom “Satuan”.",
          "Isi nama dan satuan yang benar, lalu simpan.",
          "Pakai bahan baru itu di resep menu, dan catat stoknya lewat “Bahan masuk”.",
        ],
        points: [
          "Terkunci karena pesanan pembelian? Hapus pesanan itu (bila masih draf) untuk membuka kunci.",
          "Terkunci karena resep? Keluarkan bahan dari resep itu untuk membuka kunci.",
          "Bahan yang belum punya riwayat apa pun bebas diganti satuannya.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/bahan-satuan-terkunci-tablet.png",
          alt: "Form Ubah bahan baku Susu UHT full cream dengan kolom Satuan terkunci dan tombol Buat bahan baku baru",
          caption: "Satuan terkunci karena bahan sudah punya riwayat stok.",
        },
      },
    ],
    faqs: [
      {
        question: "Bisakah resep dipakai di usaha ritel atau jasa?",
        answer:
          "Ritel bisa memakai resep bila sudah punya bahan baku. Usaha jasa tidak memakai resep.",
      },
      {
        question: "Pilih “Per porsi” atau “Per adonan”?",
        answer:
          "“Per porsi” untuk menu yang dibuat satu per satu (mis. kopi). “Per adonan” untuk menu yang dimasak sekaligus banyak lalu dibagi porsi. Keduanya memotong stok per porsi saat menu terjual.",
      },
    ],
    relatedSlugs: ["harga-jual-biaya-usaha-dan-balik-modal", "modifier-dan-opsi-tambahan", "barang-keluar"],
    keywords: ["hpp", "modal", "harga pokok", "food cost", "resep", "bahan baku", "takaran", "margin", "laba", "per adonan", "batch", "susut", "satuan terkunci", "ganti satuan"],
  },
  {
    slug: "harga-jual-biaya-usaha-dan-balik-modal",
    category: "produk",
    title: "Kalkulator harga jual, biaya usaha & balik modal",
    description: "Hitung harga jual dari target untung, catat biaya bulanan, dan lihat berapa porsi per hari supaya balik modal.",
    audience: ["Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Menu “HPP & Harga jual” ada di “Inventori”. Isinya tiga tab: “Menu”, “Biaya usaha”, dan “Balik modal”. Semua hitungan di sini hanya simulasi; harga produk baru berubah bila kamu menekan “Pakai harga ini”.",
    prerequisites: [
      "Modal (HPP) menu sudah diisi lewat Modal manual atau Resep (lihat “Harga modal (HPP), resep & bahan baku”).",
    ],
    steps: [
      {
        id: "kesehatan-menu",
        title: "Tab Menu: cek kesehatan menu",
        description:
          "Buka “Inventori” › “HPP & Harga jual”. Tiap menu diberi tanda dari “Bahan %” (food cost: HPP bahan ÷ harga jual): “Sehat” 35% ke bawah, “Tipis” 35–45%, “Bahaya” di atas 45%, “Rugi” bila modal sama dengan atau lebih besar dari harga jual, dan “Belum ada modal”.",
        points: [
          "Saring dengan “Semua”, “Perlu dicek”, atau “Tanpa modal”, atau cari lewat “Cari menu”.",
          "Kartu “Modal naik di … menu” muncul bila HPP sekarang naik dibanding modal penjualan 30 hari terakhir dan margin jadi lebih tipis. Ketuk “Lihat” untuk melihat menunya. Peringatan yang sama tampil di Beranda pemilik.",
        ],
      },
      {
        id: "hitung-harga",
        title: "Hitung harga jual",
        steps: [
          "Ketuk menu di daftar. Di tablet, “Hitung harga jual” terbuka di sebelah kanan.",
          "Periksa “Modal per porsi”. Tambahkan bila perlu “Cadangan bahan kecil” (minyak, gas, bumbu yang tidak masuk resep), “Kemasan per porsi”, dan “Biaya usaha per porsi”.",
          "Di “Mau untung berapa?”, pilih “Cara menentukan untung”: “Margin % (dari harga jual)”, “Untung dari modal % (markup)”, “Untung Rp per porsi”, atau “Bahan dari harga jual % (food cost)”, lalu isi angkanya.",
          "Pilih “Bulatkan ke atas”, mis. “Kelipatan Rp 500”.",
          "Lihat “Harga jual saran”. Bila cocok, ketuk “Pakai harga ini” lalu “Pakai harga”.",
        ],
        devices: {
          hp: "Hasilnya menempel di bilah bawah selama kamu mengisi, mis. “Rp 23.500 · untung Rp 14.252 (60,7%)”, dengan tombol “Pakai Rp 23.500” untuk langsung memakai harga itu.",
          tablet: "Kalkulator terbuka di sebelah kanan daftar menu; hasilnya tampil di bawah isian.",
        },
        points: [
          "“Kalau diskon” — melihat untung bila menu didiskon sekian persen.",
          "“Jual di ojol” — harga tayang agar untung per porsi sama dengan di toko. Isi komisi sesuai kontrakmu.",
          "“Hitung bebas” — untuk menu yang belum dibuat. Hasilnya tidak disimpan.",
          "Dari form produk, ketuk “Hitung harga jual” untuk membuka kalkulator menu itu.",
          "Bingung bedanya margin, untung dari modal (markup), dan bahan dari harga jual (food cost)? Ketuk ikon tanda tanya di judul “Mau untung berapa?” untuk contoh hitungannya.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/hpp-kalkulator-tablet.png",
          alt: "Tab Menu HPP & Harga jual di tablet: daftar menu dengan tanda kesehatan dan kalkulator harga jual Es Kopi Susu Gula Aren",
          caption: "Pilih menu di kiri, hitung harga jualnya di kanan.",
        },
        callout: {
          type: "info",
          text: "Biaya usaha per porsi tidak dikali target untung. Angka itu hanya mengurangi “Untung bersih perkiraan”.",
        },
      },
      {
        id: "biaya-usaha",
        title: "Tab Biaya usaha: biaya bulanan",
        steps: [
          "Buka tab “Biaya usaha”, lalu ketuk “Tambah biaya”.",
          "Pilih contoh seperti “Sewa tempat”, “Listrik & air”, “Internet & pulsa”, atau “Gas”, atau tulis “Nama biaya” sendiri. Isi “Biaya per bulan” (biaya tahunan dibagi 12, mingguan dikali 4).",
          "Ketuk “Isi dari data gaji” untuk memasukkan perkiraan gaji karyawan dari Tim › Gaji.",
          "Di “Porsi menu terjual per bulan”, pakai “Dari penjualan” (30 hari terakhir) atau “Isi perkiraan” bila toko baru buka.",
          "Ketuk “Simpan”.",
        ],
        description: "Catat biaya bulanan seperti sewa, gaji, dan listrik agar tiap porsi ikut menanggung biaya itu.",
        points: [
          "Hasilnya “Biaya usaha per porsi” = total biaya bulanan ÷ porsi menu per bulan. Angka ini menjadi saran “Pakai Rp … (dari Biaya usaha)” di kalkulator, dan tidak mengubah modal maupun laba kotor di laporan.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/hpp-biaya-usaha-tablet.png",
          alt: "Tab Biaya usaha dengan daftar biaya bulanan, porsi menu terjual per bulan, dan biaya usaha per porsi",
          caption: "Total Rp 18.000.000 per bulan ÷ 1.200 porsi = Rp 15.000 per porsi.",
        },
        callout: {
          type: "tip",
          text: "Biaya usaha dicatat per outlet. Bila ada perubahan yang belum disimpan, muncul tulisan “Belum disimpan” dengan tombol “Simpan” dan “Batal”.",
        },
      },
      {
        id: "balik-modal",
        title: "Tab Balik modal",
        description:
          "“Supaya balik modal” menunjukkan berapa porsi menu bermodal yang perlu terjual per hari agar biaya usaha tertutup, beserta perkiraan penjualan per hari. Penjualan di sini = sesudah diskon, sebelum pajak & biaya layanan.",
        points: [
          "Isi “Untung bersih per bulan” di “Mau untung berapa?” untuk melihat target porsi per hari.",
          "Bagian “30 hari terakhir” membandingkan laba kotor (penjualan sesudah diskon − modal menu) dengan biaya usaha, mis. “Sudah balik modal” atau “Belum balik modal · kurang 4 porsi/hari”.",
          "Menu yang modalnya belum diisi tidak ikut dihitung.",
          "Ketuk “Lihat laba rugi” untuk membuka laporan laba rugi.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/hpp-balik-modal-tablet.png",
          alt: "Tab Balik modal: perlu 39 porsi per hari, target untung Rp 5.000.000 per bulan, dan status 30 hari terakhir",
          caption: "Target untung Rp 5 juta per bulan butuh 50 porsi menu per hari.",
        },
      },
    ],
    faqs: [
      {
        question: "Apakah kalkulator langsung mengubah harga produk?",
        answer: "Tidak. Harga baru dipakai hanya bila kamu menekan “Pakai harga ini” (atau “Pakai Rp …” di bilah bawah HP) dan mengonfirmasi “Pakai harga”.",
      },
      {
        question: "Saran “Pakai Rp … (dari Biaya usaha)” tidak muncul.",
        answer:
          "Isi dan simpan biaya usaha dulu. Saran juga disembunyikan bila penjualan menu masih sedikit; pilih “Isi perkiraan” porsi per bulan di tab Biaya usaha.",
      },
    ],
    relatedSlugs: ["hpp-resep-dan-bahan-baku", "laporan-laba-rugi", "membaca-laporan-penjualan-dan-margin"],
    keywords: ["harga jual", "kalkulator harga", "margin", "markup", "food cost", "ojol", "gofood", "grabfood", "biaya usaha", "biaya operasional", "overhead", "balik modal", "bep", "break even", "omzet", "penjualan", "untung dari modal", "bahan dari harga jual"],
  },
  {
    slug: "modifier-dan-opsi-tambahan",
    category: "produk",
    title: "Pilihan ekstra: topping, level gula & HPP-nya",
    description: "Buat grup pilihan ekstra (dulu disebut modifier), atur wajib/opsional, harga tambahan, dan HPP per opsi.",
    audience: ["Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Pilihan ekstra (dulu disebut modifier) adalah pilihan tambahan saat memesan, misalnya Level gula (Normal, Less sugar) atau Topping (Boba +Rp5.000). Satu grup bisa dipasang di banyak produk.",
    steps: [
      {
        id: "buat-grup",
        title: "Buat grup pilihan ekstra",
        steps: [
          "Buka “Produk” › “Kelola” › “Pilihan ekstra”, lalu “Tambah grup pilihan ekstra”.",
          "Isi “Nama grup” (mis. Level gula).",
          "Pilih “Opsional” atau “Wajib”, dan isi “Maksimal pilihan”.",
          "Tambahkan opsi dengan “Tambah opsi”: nama opsi dan “Harga tambahan” (0 bila gratis).",
        ],
        points: ["Untuk mengubah atau menghapus grup, ketuk menu ⋯ di barisnya di daftar “Pilihan ekstra”."],
      },
      {
        id: "hpp-opsi",
        title: "HPP per opsi",
        description:
          "Ketuk baris HPP di bawah opsi (mis. “HPP belum diisi”) untuk membuka lembar HPP opsi. Pilih “Modal manual” atau “Resep”. Dengan resep, stok bahan opsi ikut berkurang saat opsi dipilih, dan modalnya masuk laba kotor di laporan.",
        image: {
          ...TABLET,
          src: "/panduan/modifier-hpp-resep-tablet.png",
          alt: "Dialog HPP opsi pilihan ekstra dengan pilihan Resep",
          caption: "Topping Boba memakai resep 30 g bahan Boba mentah.",
        },
      },
      {
        id: "pasang",
        title: "Pasang di produk",
        description:
          "Di form produk, bagian “Pilihan ekstra”, ketuk “Pilih grup pilihan ekstra”. Grup baru juga bisa dibuat dari situ lewat “Buat grup pilihan ekstra baru”. Di HP, bagian ini bisa dilipat; saat terlipat, judulnya menampilkan nama grup yang terpasang.",
      },
      {
        id: "di-kasir",
        title: "Yang terlihat di kasir",
        description:
          "Saat produk diketuk, grup tampil dengan label “Wajib” atau “Opsional”. Selama grup wajib belum dipilih, tombol bawah menyebut langkah yang kurang, mis. “Pilih Level gula dulu” atau “Pilih minimal 2 di Topping”. Setelah lengkap, tombolnya menjadi “Tambah · Rp …” dengan harga akhir.",
        points: ["Mengetuk tombol saat pilihan belum lengkap menandai grup yang kurang dengan warna merah dan menggulir ke sana."],
      },
    ],
    relatedSlugs: ["hpp-resep-dan-bahan-baku", "menambah-produk", "mencatat-transaksi-di-kasir"],
    keywords: ["modifier", "pilihan ekstra", "grup modifier", "topping", "add on", "extra", "level gula", "level pedas", "opsi tambahan"],
  },
  {
    slug: "diskon-dan-promo",
    category: "produk",
    title: "Membuat diskon",
    description: "Diskon persen atau nominal untuk nota, kategori, atau produk, plus diskon per baris langsung di kasir.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Ada tiga cara memberi potongan: diskon yang dibuat pemilik (promo), diskon per baris untuk satu item di pesanan, dan diskon manual per nota yang diisi kasir saat pembayaran.",
    steps: [
      {
        id: "buat-diskon",
        title: "Buat diskon (pemilik)",
        steps: [
          "Buka “Produk” › “Kelola” › “Diskon”, lalu “Tambah diskon”.",
          "Isi “Nama diskon” dan “Besar potongan” (“Persen” atau “Nominal”).",
          "Pilih “Berlaku untuk”: “Seluruh nota”, “Kategori”, atau “Produk”.",
          "Isi “Minimum belanja” bila perlu (0 = tanpa minimum) dan “Periode berlaku”.",
          "Nyalakan “Pakai otomatis” bila diskon ini harus terpasang sendiri, lalu simpan.",
        ],
        callout: {
          type: "info",
          text: "Hanya satu diskon otomatis per nota: yang minimum belanjanya tertinggi dan terpenuhi.",
        },
      },
      {
        id: "di-kasir",
        title: "Memakai diskon saat bayar (kasir)",
        description:
          "Di layar “Pembayaran”, buka lembar “Diskon, pajak & catatan”. Pilih promo di bagian “Promo”, atau isi diskon manual “Persen”/“Nominal” beserta “Alasan diskon”.",
        devices: {
          hp: "Ketuk tombol “Diskon” di samping tombol bayar. Setelah diskon manual diisi, tombol itu menampilkan nilainya, mis. “-10%” atau “-Rp 5.000”.",
          tablet: "Ketuk tombol “Diskon, pajak & catatan”.",
        },
        callout: {
          type: "warning",
          text: "Diskon terkunci setelah ada pembayaran masuk. Atur diskon sebelum menerima uang.",
        },
      },
      {
        id: "diskon-baris",
        title: "Diskon per baris (kasir)",
        description: "Untuk memotong harga satu item saja, mis. kue yang agak rusak atau minuman gratis untuk pelanggan setia.",
        steps: [
          "Di Kasir, ketuk “Diskon” di baris tautan bawah nama item (sebaris dengan “Tambah catatan” dan tombol − / +).",
          "Di lembar “Diskon baris”, pilih “Persen” (5%, 10%, 15%, 20%, “Gratis”, atau “Lainnya”) atau “Nominal”. Di “Nominal”, bila jumlah item lebih dari 1, ada pilihan cepat “Gratis 1”.",
          "Bila perlu, isi “Alasan diskon (opsional)” — alasan ikut tersimpan di rincian transaksi dan struk.",
          "Periksa “Harga baris jadi”, lalu ketuk “Terapkan”.",
        ],
        points: [
          "Diskon tidak boleh melebihi harga baris.",
          "Untuk menghapus, buka lagi lembarnya lalu ketuk “Hapus diskon”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/diskon-baris-tablet.png",
          alt: "Lembar Diskon baris untuk Es Kopi Susu Gula Aren dengan diskon 10%",
          caption: "Diskon 10% untuk 2 Es Kopi Susu Gula Aren: Rp 50.000 jadi Rp 45.000.",
        },
      },
      {
        id: "diskon-baris-di-pesanan",
        title: "Diskon baris di pesanan dan struk",
        points: [
          "Harga asli dicoret dan harga baru tampil di bawahnya. Di bawah nama item tertulis diskonnya, mis. “Diskon 10% · -Rp 5.000”.",
          "Diskon baris dipotong lebih dulu, sebelum diskon nota, promo, dan pajak.",
          "Diskon persen ikut menyesuaikan bila jumlah item diubah.",
          "Diskon baris ikut tercetak di struk dan pesan WhatsApp.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/diskon-baris-kasir-tablet.png",
          alt: "Panel pesanan Kasir di tablet dengan harga item dicoret dan keterangan diskon per baris",
          caption: "Diskon per baris tampil di bawah nama item.",
        },
      },
    ],
    relatedSlugs: ["mencatat-transaksi-di-kasir", "menerima-pembayaran-qris-dan-tunai", "menambah-produk"],
    keywords: ["diskon", "promo", "potongan", "voucher", "happy hour", "diskon item", "diskon per item", "diskon baris", "gratis"],
  },

  // ───────────────────────────── JUALAN ─────────────────────────────
  {
    slug: "mencatat-transaksi-di-kasir",
    category: "jualan",
    title: "Mencatat transaksi di Kasir",
    description: "Tambah produk, pilih varian, catatan item, item cepat, pelanggan, lalu bayar.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Layar “Kasir” (judul “Transaksi Baru”) adalah tempat mencatat penjualan. Pastikan kasir sudah dibuka; selama belum dibuka, layar hanya menampilkan tombol “Buka Kasir”.",
    prerequisites: ["Kasir sudah dibuka (lihat “Shift kas & tutup kasir harian”).", "Produk sudah dibuat."],
    steps: [
      {
        id: "tambah-produk",
        title: "Tambahkan produk ke pesanan",
        steps: [
          "Ketuk produk. Cari cepat lewat “Cari menu atau SKU”, atau saring dengan chip kategori.",
          "Untuk produk bervarian atau berpilihan ekstra, pilih varian dan opsinya, isi “Catatan (opsional)” bila perlu. Selama ada yang belum dipilih, tombol bawah menyebut langkahnya, mis. “Pilih varian dulu” atau “Pilih Level gula dulu”. Setelah lengkap, ketuk “Tambah · Rp …” (harga akhir).",
          "Ubah jumlah dengan tombol − / + di baris item, sebaris dengan tautan “Tambah catatan” dan “Diskon”. Pada jumlah 1, tombol − berubah menjadi ikon hapus merah (“Hapus dari pesanan”).",
          "Ketuk “Tambah catatan” untuk catatan seperti “kurang manis”.",
        ],
        points: [
          "Kartu produk berbentuk persegi dengan foto produk. Bila belum ada satu pun produk berfoto, kartu tampil ringkas dengan inisial di samping nama.",
        ],
        devices: {
          hp: "Pesanan tampil sebagai bilah melayang di bawah layar. Ketuk sisi kirinya (jumlah item, meja, “Lihat pesanan”) untuk membuka layar “Pesanan” berisi item, ringkasan, serta tombol Simpan dan Bayar. Tombol oranye “Bayar Rp …” di bilah itu langsung membuka layar Pembayaran.",
          tablet: "Pesanan tampil tetap di panel kanan.",
        },
        image: {
          ...TABLET,
          src: "/panduan/kasir-tablet.png",
          alt: "Layar Kasir di tablet dengan daftar produk dan panel pesanan di kanan",
          caption: "Kasir di tablet: produk di kiri, pesanan di kanan.",
        },
      },
      {
        id: "jenis-pelanggan-meja",
        title: "Jenis pesanan, pelanggan, dan meja",
        points: [
          "Pilih jenis pesanan, mis. “Makan di tempat” atau “Bawa pulang”. Pilihan ini hanya muncul bila lebih dari satu jenis diaktifkan di Pengaturan › “Pesanan & keamanan kasir” › “Jenis pesanan”.",
          "“Pilih pelanggan” untuk mencatat pelanggan (poin member dan kasbon butuh ini). Pelanggan baru bisa dibuat lewat “Tambah pelanggan”.",
          "“Pilih meja” hanya muncul untuk jenis pesanan “Makan di tempat” dan bila outlet punya meja aktif. Bila jenis diganti ke “Bawa pulang”, meja yang sudah dipilih otomatis dilepas.",
        ],
        callout: {
          type: "info",
          title: "Wajib nama pelanggan",
          text: "Bila pemilik menyalakan Pengaturan › “Pesanan & keamanan kasir” › “Wajib nama pelanggan”, menekan “Bayar” atau “Simpan” tanpa pelanggan terpilih memunculkan isian “Nama pelanggan”. Isi namanya lalu ketuk “Lanjut”.",
        },
      },
      {
        id: "item-cepat",
        title: "Item cepat (barang di luar daftar)",
        description:
          "Ketuk ikon petir (“Item cepat”), isi “Nama item” dan “Harga”, lalu “Tambah ke pesanan”. Cocok untuk barang yang jarang dijual, mis. kantong plastik.",
      },
      {
        id: "bayar-atau-simpan",
        title: "Bayar sekarang atau simpan dulu",
        points: [
          "“Bayar Rp …” — buka layar pembayaran. Angkanya adalah total tagihan; bila pembulatan tunai aktif, angka tunai yang dibulatkan baru tampil di layar Pembayaran. Baca “Pembayaran: tunai, QRIS, kartu, transfer”. Bila kasir belum dibuka, muncul lembar Buka kasir dan pembayaran langsung dilanjutkan setelahnya.",
          "“Simpan” — simpan sebagai pesanan berjalan untuk dibayar nanti (mis. makan dulu bayar belakangan). Baca “Pesanan berjalan & meja”.",
          "Ikon tempat sampah mengosongkan pesanan setelah konfirmasi “Kosongkan pesanan?”.",
        ],
      },
      {
        id: "ritel-barcode",
        title: "Untuk toko ritel: scan barcode",
        description:
          "Di usaha ritel, kolom cari menjadi “Scan barcode atau ketik nama barang”. Barcode utama, barcode tambahan, dan SKU dicocokkan.",
        devices: {
          hp: "Ketuk ikon kamera “Scan barcode” untuk memindai dengan kamera HP.",
          tablet: "Scanner USB/Bluetooth yang bekerja sebagai keyboard bisa langsung dipakai di kolom cari.",
        },
      },
    ],
    faqs: [
      {
        question: "Kenapa produk tidak muncul di Kasir?",
        answer:
          "Cek apakah “Dijual di kasir” menyala di form produk. Produk dengan stok habis ditandai “Habis” dan tidak bisa dijual.",
      },
      {
        question: "Muncul “Batas Gratis bulan ini tercapai”.",
        answer:
          "Paket Gratis dibatasi 50 transaksi per bulan. Pesanan yang sudah berjalan tetap bisa dibayar; untuk transaksi baru, pemilik perlu berlangganan Pro. Baca “Langganan: paket Gratis & Pro”.",
      },
      {
        question: "Bisakah memberi diskon per item?",
        answer: "Bisa. Ketuk “Diskon” di baris item di pesanan. Baca “Membuat diskon” bagian Diskon per baris.",
      },
      {
        question: "Bagaimana menghapus satu item dari pesanan?",
        answer: "Kurangi jumlahnya dengan tombol −. Saat jumlahnya tinggal 1, tombol − berubah menjadi ikon hapus merah; ketuk untuk menghapus item itu.",
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "mencatat-pesanan-dan-denah-meja", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["kasir", "transaksi", "jualan", "pos", "keranjang", "checkout", "item cepat", "scan barcode", "bawa pulang", "takeaway", "hapus item", "lihat pesanan", "pilih varian", "modifier"],
  },
  {
    slug: "mencatat-pesanan-dan-denah-meja",
    category: "jualan",
    title: "Pesanan berjalan & meja",
    description: "Simpan pesanan untuk dibayar nanti, terima DP, ubah, pisah pesanan, batalkan, dan kelola meja.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 7,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Pesanan berjalan adalah pesanan yang sudah dicatat tetapi belum dibayar, misalnya tamu makan dulu bayar belakangan. Pesanan bisa ditautkan ke meja dan dikirim ke dapur. Meja, pesanan berjalan, dan layar dapur termasuk paket Pro; pesanan yang sudah tersimpan tetap bisa dibayar walau Pro berakhir.",
    steps: [
      {
        id: "simpan-pesanan",
        title: "Menyimpan pesanan",
        steps: [
          "Di Kasir, tambahkan item lalu pilih meja dan/atau pelanggan.",
          "Ketuk “Simpan”. Muncul konfirmasi “Simpan pesanan?” berisi jumlah item dan total; bila fitur dapur aktif, item masak langsung dikirim ke dapur.",
          "Ketuk “Simpan pesanan”.",
        ],
        points: [
          "Tanpa meja dan tanpa pelanggan, yang muncul adalah dialog “Simpan pesanan” dengan isian “Nama atau penanda pesanan” (mis. Budi, baju merah).",
          "Bila “Wajib nama pelanggan” aktif, nama tetap diminta walau meja sudah dipilih.",
          "Meja hanya bisa dipilih untuk pesanan “Makan di tempat”.",
        ],
      },
      {
        id: "daftar-pesanan",
        title: "Melihat dan mengubah pesanan",
        description:
          "Buka “Pesanan” (judul “Pesanan berjalan”). Cari dengan “Cari nomor, nama, atau meja”. Tiap kartu menunjukkan status bayar dan progres dapur, mis. “2/3 siap”.",
        points: [
          "Pesanan yang sudah siap semua naik ke paling atas dan diberi bingkai hijau.",
          "Pakai saringan “Siap diantar” untuk melihat pesanan yang tinggal diantar saja. Status dapur kini tampil langsung di kartu, tanpa tab terpisah.",
          "Lama menunggu berwarna kuning setelah 15 menit dan merah setelah 30 menit, selama dapur belum selesai.",
        ],
        steps: [
          "Ketuk pesanan untuk membuka rinciannya. Bilah bawah berisi tombol ⋯, “Ubah”, dan “Bayar Rp …”. “Terima DP”, “Pisah pesanan”, dan “Batalkan pesanan” ada di menu ⋯.",
          "Ketuk “Ubah” (atau menu ⋯ di kartu › “Ubah”). Pesanan terbuka di Kasir dengan judul “Ubah pesanan …”.",
          "Tambah atau kurangi item, lalu ketuk “Simpan perubahan” dan konfirmasi “Simpan perubahan pesanan?”. Item tambahan dikirim ke dapur dengan tanda TAMBAHAN.",
          "Untuk menagih, ketuk “Bayar Rp …” di rincian atau “Bayar” di kartu pesanan.",
        ],
        callout: {
          type: "info",
          text: "Mengurangi item atau membatalkan pesanan bisa meminta PIN pemilik bila “PIN pemilik untuk batal & refund” aktif di Pengaturan › “Pesanan & keamanan kasir”.",
        },
      },
      {
        id: "terima-dp",
        title: "Terima DP untuk pesanan berjalan",
        description: "Tamu bisa membayar sebagian dulu (DP) untuk pesanan yang belum dibayar, mis. pesanan nasi kotak.",
        steps: [
          "Buka “Pesanan”, ketuk pesanannya, lalu ketuk ⋯ di bilah bawah › “Terima DP”.",
          "Pilih “Dibayar lewat”, lalu isi “Nominal DP” atau ketuk pilihan cepat (pilihan setengah tagihan dibulatkan ke Rp 10.000). Nominal harus kurang dari sisa tagihan; untuk melunasi, pakai “Bayar”.",
          "Centang “Cetak bukti DP” bila perlu (muncul bila printer tersambung; gulir ke bawah bila tidak terlihat), lalu ketuk “Terima DP Rp …”.",
        ],
        points: ["Kasir harus sudah dibuka untuk menerima DP."],
        image: {
          ...TABLET,
          src: "/panduan/dp-pesanan-tablet.png",
          alt: "Lembar Terima DP pesanan Meja 05 dengan total Rp 147.840, nominal Rp 50.000 tunai, dan Cetak bukti DP dicentang",
          caption: "DP pertama Rp 50.000 tunai untuk pesanan Meja 05 (total Rp 147.840).",
        },
      },
      {
        id: "pesanan-ber-dp",
        title: "Pesanan yang sudah ada DP",
        points: [
          "Pesanan tetap berjalan. Rinciannya menampilkan “Sudah dibayar (DP)” dan “Sisa tagihan”; tombol “Bayar” hanya menagih sisanya.",
          "DP bisa diterima lebih dari sekali.",
          "Total pesanan tidak boleh lebih kecil dari DP yang sudah dibayar. Jangan kurangi item atau tambah diskon sampai total di bawah DP.",
          "Membatalkan pesanan yang sudah ada uangnya meminta PIN pemilik bila dilakukan kasir.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/dp-pesanan-rincian-tablet.png",
          alt: "Rincian pesanan Meja 05 di tablet dengan Sudah dibayar (DP) dan Sisa tagihan",
          caption: "Setelah DP Rp 50.000, “Bayar” hanya menagih sisa Rp 97.840.",
        },
      },
      {
        id: "pisah-pesanan",
        title: "Pisah pesanan (tagihan terpisah)",
        steps: [
          "Di kartu pesanan atau di rincian pesanan, ketuk ⋯ › “Pisah pesanan”.",
          "Ketuk nama item untuk memindah semua porsinya (ketuk lagi untuk membatalkan), atau atur jumlahnya dengan − / + di kanan. Ringkasan “Pesanan asal” dan “Pesanan baru” di atas tombol berubah langsung.",
          "Ketuk “Pisahkan”. Pesanan baru mendapat nomor sendiri dan bisa dibayar dengan cara berbeda.",
        ],
        points: [
          "Bila pesanan sudah ada DP, ringkasannya menulis “DP Rp … tetap di sini”: DP tetap di pesanan asal.",
          "Pajak, biaya layanan, dan diskon persen dihitung ulang untuk tiap pesanan. Diskon nominal tetap di pesanan asal.",
          "Tiket dapur ikut berpindah ke pesanan baru.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pisah-pesanan-tablet.png",
          alt: "Dialog Pisah pesanan: ketuk nama item atau atur jumlah yang dipindah ke pesanan baru",
          caption: "Pilih jumlah yang dipindah ke pesanan baru.",
        },
      },
      {
        id: "batalkan",
        title: "Membatalkan pesanan",
        description:
          "Di kartu atau rincian pesanan, ketuk ⋯ › “Batalkan pesanan” (merah), isi “Alasan” (wajib), lalu “Batalkan”. Tiket dapurnya ikut dihapus. Bila pesanan sudah ada DP, tombolnya menjadi “Batalkan & kembalikan Rp …”.",
      },
      {
        id: "meja",
        title: "Layar Meja",
        points: [
          "Saring dengan tombol “Area: Semua (…)” dan segmen “Semua / Kosong / Dipesan / Terisi”. “Dipesan” = meja kosong yang sedang ditahan untuk reservasi (muncul bila ada).",
          "Warna status: “Kosong” hijau, “Dipesan” kuning, “Terisi” oranye. Meja dengan tamu reservasi yang telat ditandai merah.",
          "Kartu meja memberi lencana bila perlu tindakan: “N siap antar” (hijau), progres dapur mis. “3/20”, “DP” (kuning), dan “Pesanan awal belum ke dapur” (kuning). Lama duduk berwarna kuning setelah 60 menit.",
          "Tambah meja dan kelola area lewat tombol ⋯ di kanan atas (“Menu meja”) › “Tambah meja” atau “Kelola area”. Menu ini hanya terlihat oleh pemilik.",
          "Saat menambah meja, isi “Nama meja”, “Area” (atau “Buat area baru”), dan “Kapasitas (kursi)”.",
          "Ketuk meja kosong lalu “Mulai pesanan” untuk membuka Kasir dengan meja itu terpilih.",
          "Ketuk meja terisi untuk melihat “Lama duduk”, “Tagihan berjalan”, serta tombol “Ubah” dan “Bayar …”.",
        ],
        devices: {
          hp: "Rincian meja terbuka sebagai lembar dari bawah layar.",
          tablet: "Saat “Semua area” dipilih, meja dikelompokkan per area. Rincian meja terbuka sebagai dialog di tengah layar; tutup dengan ✕ atau ketuk di luar dialog.",
        },
        image: {
          ...TABLET,
          src: "/panduan/meja-detail-tablet.png",
          alt: "Dialog rincian Meja 1 di tablet dengan tombol Ubah dan Bayar",
          caption: "Rincian meja terisi di tablet.",
        },
      },
    ],
    faqs: [
      {
        question: "Bisakah pindah meja atau gabung meja?",
        answer: "Fitur pindah meja dan gabung meja belum tersedia. Bagi rata tagihan juga belum ada; gunakan “Pisah pesanan” atau pembayaran sebagian.",
      },
      {
        question: "Tombol “Simpan” tidak ada di Kasir.",
        answer: "Tombol itu hanya muncul bila fitur pesanan berjalan aktif di outlet. Hubungi pemilik untuk memeriksa pengaturannya.",
      },
    ],
    relatedSlugs: ["layar-dapur", "reservasi-meja-dan-dp", "menerima-pembayaran-qris-dan-tunai"],
    keywords: ["open bill", "pesanan", "meja", "denah", "area", "split bill", "pisah tagihan", "hold order", "simpan pesanan", "dp pesanan", "uang muka", "status dapur", "siap diantar", "meja dipesan", "warna meja"],
  },
  {
    slug: "reservasi-meja-dan-dp",
    category: "jualan",
    title: "Reservasi meja & uang muka (DP)",
    description: "Catat reservasi, terima DP, beri bukti DP, potong DP saat tamu datang, dan proses DP bila batal atau tidak datang.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 7,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Reservasi dicatat di layar “Meja”, tab “Reservasi”. Reservasi bisa disertai uang muka (DP). DP ditahan sampai tamu datang, lalu otomatis dipotong dari tagihan pesanan mejanya. Reservasi termasuk paket Pro dan memakai fitur meja.",
    prerequisites: [
      "Meja sudah dibuat (lihat “Pesanan berjalan & meja”).",
      "Untuk menerima DP, kasir harus sudah dibuka. Bila belum, aplikasi meminta “Buka Kasir” dulu.",
      "Aplikasi versi terbaru. Bila bagian “Uang muka (DP)” tidak ada di form reservasi, fitur DP belum aktif untuk outletmu.",
    ],
    steps: [
      {
        id: "buat",
        title: "Buat reservasi",
        steps: [
          "Buka “Meja” › tab “Reservasi”, lalu ketuk “Reservasi baru”.",
          "Isi “Nama tamu”, “No. HP (opsional)”, “Tanggal & jam”, dan “Jumlah orang”.",
          "Pilih “Meja” bila sudah tahu. Boleh dikosongkan dan dipilih saat tamu datang.",
          "Ketuk “Simpan reservasi”.",
        ],
        points: [
          "Durasi bawaan 90 menit. Ubah durasi dan isi catatan (mis. kursi bayi, ulang tahun) di bagian “Lainnya”.",
          "Bila meja sudah direservasi tamu lain di jam yang beririsan, reservasi diberi tanda “Bentrok”, mis. “Bentrok dgn Dewi 08.41”, di daftar dan rinciannya. Reservasi tetap bisa disimpan lewat “Tetap simpan”; pindahkan salah satunya ke meja lain.",
          "Jumlah tamu melebihi kursi meja? Muncul lencana kuning “Melebihi kapasitas (10/4)” beserta saran ganti meja atau siapkan meja tambahan.",
          "Meja reservasi masih punya pesanan berjalan tamu lain menjelang jam datang (30 menit atau kurang)? Muncul tanda “Meja masih terisi”. Selesaikan atau pindahkan pesanan itu sebelum tamu datang.",
          "Judul tab menunjukkan ringkasan hari itu, mis. “8 hari ini · 1 telat”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/reservasi-form-tablet.png",
          alt: "Form Reservasi baru di tablet dengan Nama tamu Sari, No. HP, Tanggal & jam, Jumlah orang, dan Meja",
          caption: "Isi data tamu, lalu simpan reservasi.",
        },
      },
      {
        id: "terima-dp",
        title: "Terima DP saat reservasi",
        steps: [
          "Di form reservasi, bagian “Uang muka (DP)”, isi “Nominal DP” atau ketuk pilihan cepat (mis. Rp 50.000).",
          "Pilih “Dibayar lewat” sesuai metode bayar yang aktif di outlet (mis. Tunai, QRIS, Transfer, Kartu). Untuk tunai, isi “Uang diterima” agar kembaliannya terhitung.",
          "Ketuk “Simpan reservasi”. DP langsung tercatat.",
        ],
        points: [
          "Tamu tidak membayar DP? Kosongkan “Nominal DP”.",
          "DP juga bisa diterima atau ditambah belakangan dari rincian reservasi lewat “Terima DP” atau “Tambah DP”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/reservasi-dp-form-tablet.png",
          alt: "Form Reservasi baru di tablet dengan bagian Uang muka (DP) Rp 50.000 tunai",
          caption: "DP Rp 50.000 tunai dicatat saat reservasi disimpan.",
        },
      },
      {
        id: "bukti-dp",
        title: "Bukti DP",
        description:
          "Bukti DP berupa struk berjudul BUKTI DP dengan jadwal reservasi, atau pesan WhatsApp ke no. HP tamu.",
        points: [
          "Saat menerima DP lewat “Terima DP” dan printer struk siap, centang “Cetak bukti DP” agar bukti langsung tercetak setelah DP diterima.",
          "Tanpa printer, setelah DP dicatat muncul lembar “Bukti DP” dengan pilihan “Cetak bukti DP” atau “Kirim lewat WhatsApp” (hanya bila no. HP tamu diisi).",
          "Bukti bisa diberikan lagi dari kartu DP di rincian reservasi lewat “Cetak bukti” atau “Kirim bukti”.",
        ],
      },
      {
        id: "tamu-datang",
        title: "Tamu datang: DP dipotong dari tagihan",
        steps: [
          "Di daftar “Akan datang”, ketuk tombol cepat “Datang” pada baris reservasi. Atau buka reservasinya, lalu ketuk “Tamu datang” yang menempel di bawah rincian. Bila belum ada meja, pilih meja tempat tamu duduk.",
          "Pesanan meja terbuka. Tambahkan menu seperti biasa.",
          "Saat menagih, tagihan menampilkan “Sudah dibayar (DP)” dan “Sisa tagihan”. Kasir hanya menagih sisanya.",
        ],
        points: [
          "Setelah tamu datang, tombol di bawah rincian berganti menjadi “Buka pesanan meja”.",
          "Salah ketuk “Tamu datang”? Pakai “Aksi lain” (⋯) › “Batalkan kedatangan”.",
          "Tamu sudah selesai dan pergi? Pakai “Aksi lain” › “Tamu sudah pulang”, lalu konfirmasi. Reservasi ditandai selesai; pesanan meja yang belum dibayar tetap berjalan.",
          "Pada ukuran huruf besar, tombol cepat “Datang” disembunyikan agar daftar tetap rapi; pakai “Tamu datang” di rincian.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/reservasi-dp-detail-tablet.png",
          alt: "Rincian reservasi Sari di tablet dengan kartu Uang muka (DP) berstatus DP tertahan dan tombol Tamu datang",
          caption: "DP tertahan sampai tamu datang. Bilah kuning di atas daftar = antrean DP perlu diproses.",
        },
      },
      {
        id: "dp-lebih",
        title: "DP lebih besar dari tagihan",
        description:
          "Bila tagihan lebih kecil dari DP, layar Pembayaran menampilkan “DP lebih Rp … dari tagihan”. Pilih salah satu, lalu ketuk “Selesaikan pembayaran”:",
        points: [
          "“Kembalikan sisa DP” — sisanya dikembalikan ke tamu lewat metode DP. Bisa meminta PIN pemilik bila “PIN pemilik untuk batal & refund” aktif.",
          "“Sisa DP tidak dikembalikan” — sisanya dicatat sebagai pendapatan (baris “Sisa DP”).",
        ],
        image: {
          ...TABLET,
          src: "/panduan/reservasi-dp-lebih-tablet.png",
          alt: "Layar Pembayaran: tagihan Rp 30.000, sudah dibayar DP Rp 50.000, pilihan Kembalikan sisa DP atau Sisa DP tidak dikembalikan",
          caption: "DP Rp 50.000, tagihan Rp 30.000: pilih nasib sisa Rp 20.000.",
        },
      },
      {
        id: "batal-tidak-datang",
        title: "Reservasi batal atau tamu tidak datang",
        steps: [
          "Di rincian reservasi, ketuk “Aksi lain” › “Batalkan reservasi” atau “Tandai tidak datang”.",
          "Reservasi tanpa DP yang dibatalkan: di dialog “Batalkan reservasi?”, pilih alasan cepat (“Tamu minta batal”, “Ganti jadwal”, “Tidak bisa dihubungi”, “Salah catat”) atau tulis sendiri di “Alasan (opsional)”. Alasan boleh dikosongkan.",
          "Untuk reservasi ber-DP, pilih apa yang terjadi dengan DP-nya, lalu konfirmasi sekali lagi: “Ya, DP Rp … hangus” (merah) atau “Ya, kembalikan Rp …”.",
        ],
        points: [
          "“Kembalikan DP” — uang dikembalikan lewat metode DP. Bila dilakukan kasir, perlu PIN pemilik.",
          "“DP hangus” — DP dicatat sebagai pendapatan hari ini dan tidak bisa dikembalikan lagi.",
          "“Proses nanti” — status reservasi tetap berubah, DP masuk antrean “DP perlu diproses”.",
          "Pilihan yang sudah ditandai: “Kembalikan DP” untuk batal, “DP hangus” untuk tidak datang.",
          "Rincian reservasi mencatat siapa dan kapan statusnya diubah, mis. “Dibatalkan — Rani · 22 Okt 10.31”, ditambah “Alasan” bila diisi. Hal yang sama tercatat untuk “Ditandai tidak datang” dan “Selesai”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/reservasi-dp-batal-tablet.png",
          alt: "Lembar Batalkan reservasi ber-DP dengan pilihan Kembalikan DP, DP hangus, dan Proses nanti",
          caption: "Tiga pilihan untuk DP saat reservasi dibatalkan.",
        },
        callout: {
          type: "warning",
          title: "Tamu mungkin sedang datang",
          text: "Mengembalikan DP sekitar jam reservasi (30 menit sebelum sampai 30 menit sesudah) memunculkan peringatan ini, karena tamu bisa saja sedang dalam perjalanan. Pastikan tamu memang batal, lalu ketuk “Tetap kembalikan”.",
        },
      },
      {
        id: "antrean-dp",
        title: "Antrean DP perlu diproses",
        description:
          "DP dari reservasi batal atau tidak datang yang belum dikembalikan atau dihanguskan muncul sebagai bilah kuning “… DP perlu diproses · Rp …” di tab Reservasi, dan di kartu “Perlu perhatian” Beranda pemilik. Ketuk bilahnya, buka reservasinya, lalu pilih “Kembalikan DP” atau “DP hangus”.",
        points: [
          "Ringkasan shift dan laporan tutup kasir memisahkan DP diterima dan DP dikembalikan, jadi uang di laci tetap cocok.",
        ],
      },
    ],
    faqs: [
      {
        question: "Apakah DP masuk penjualan?",
        answer:
          "DP yang dipotong ke tagihan menjadi bagian pembayaran pesanan itu. DP hangus dan “Sisa DP” yang tidak dikembalikan dicatat sebagai pendapatan.",
      },
      {
        question: "Tamu ingin memesan menu sebelum datang.",
        answer: "Bisa, lewat pesanan awal. Baca “Pesanan awal saat reservasi”.",
      },
    ],
    relatedSlugs: ["pesanan-awal-reservasi", "mencatat-pesanan-dan-denah-meja", "menerima-pembayaran-qris-dan-tunai"],
    keywords: ["reservasi", "booking meja", "pesan meja", "dp", "uang muka", "down payment", "deposit", "tidak datang", "no show", "hangus", "bukti dp", "tamu datang", "tamu sudah pulang", "bentrok", "kapasitas", "alasan batal"],
  },
  {
    slug: "pesanan-awal-reservasi",
    category: "jualan",
    title: "Pesanan awal saat reservasi",
    description: "Catat menu yang dipesan tamu sebelum datang, lihat perkiraan total, dan kirim ke dapur saat tamu tiba.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Pesanan awal adalah menu yang sudah dipilih tamu saat reservasi, misalnya untuk acara ulang tahun. Harga dikunci saat disimpan. Stok belum dipotong dan dapur belum menerima tiket sampai tamu datang. Pesanan awal hanya ada bila fitur DP reservasi juga aktif.",
    prerequisites: [
      "Reservasi sudah dibuat (lihat “Reservasi meja & uang muka (DP)”).",
      "Aplikasi versi terbaru. Bila tombol “Simpan & pilih menu” tidak muncul, fitur ini belum aktif untuk outletmu.",
    ],
    steps: [
      {
        id: "pilih-menu",
        title: "Pilih menu",
        steps: [
          "Saat membuat reservasi baru, ketuk “Simpan & pilih menu”. Untuk reservasi yang sudah ada, buka rinciannya, lalu di kartu “Pesanan awal” ketuk “Pilih menu”.",
          "Di layar “Pesanan awal”, ketuk menu untuk menambahkannya. Atur jumlah dengan − / +, dan ketuk “Tambah catatan” bila perlu.",
          "Ketuk “Simpan ke reservasi”.",
        ],
        points: [
          "Pesanan awal tanpa DP: setelah disimpan pertama kali, muncul “Bukti pesanan awal” untuk “Cetak bukti pesanan” (struk berjudul PESANAN AWAL) atau dikirim lewat WhatsApp.",
          "Untuk mengubah, ketuk “Ubah pesanan awal” di kartu. Pesanan awal bisa diubah selama tamu belum datang dan reservasi belum ditutup.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pesanan-awal-tablet.png",
          alt: "Layar Pesanan awal di tablet: daftar menu di kiri, 3 porsi dan perkiraan total Rp 68.000 di kanan",
          caption: "Pilih menu, lalu “Simpan ke reservasi”.",
        },
      },
      {
        id: "perkiraan",
        title: "Perkiraan total & saran DP",
        points: [
          "“Perkiraan total” sudah termasuk pajak dan biaya layanan saat ini. Promo dan angka akhir dihitung saat menagih.",
          "Kartu “Pesanan awal” di rincian reservasi menampilkan jumlah porsi, perkiraan total, dan “Sisa perkiraan setelah DP”.",
          "Saat menerima DP, ada “Saran dari pesanan awal”, mis. “50% · Rp 23.000” atau “Penuh · Rp 46.000”.",
          "Bukti DP untuk reservasi dengan pesanan awal memuat daftar menu, “Perkiraan total”, dan “Sisa (perkiraan)”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pesanan-awal-dp-tablet.png",
          alt: "Lembar Terima DP dengan saran dari pesanan awal 50% dan penuh, di atas rincian reservasi Wati",
          caption: "Saran DP dihitung dari perkiraan pesanan awal.",
        },
      },
      {
        id: "tamu-datang",
        title: "Tamu datang: kirim ke dapur",
        steps: [
          "Ketuk “Tamu datang” dan pilih meja bila perlu.",
          "Muncul “Kirim pesanan awal ke dapur?”. Pilih “Kirim ke dapur” agar tiket dapur dibuat sekarang, atau “Nanti”.",
          "Pesanan awal menjadi pesanan meja biasa: tambah menu bila perlu, lalu tagih seperti biasa. DP otomatis dipotong.",
        ],
        points: [
          "Memilih “Nanti”: tiket ikut terkirim saat pesanan disimpan atau dibayar, atau lewat tombol “Kirim pesanan awal ke dapur” di rincian pesanan. Selama belum dikirim, kartu mejanya diberi lencana kuning “Pesanan awal belum ke dapur”.",
          "Bila stok menu kurang, ada pilihan “Ubah pesanan” untuk mengganti menunya.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pesanan-awal-dapur-tablet.png",
          alt: "Lembar Kirim pesanan awal ke dapur? dengan pilihan Kirim ke dapur dan Nanti",
          caption: "Saat tamu datang, pilih kapan pesanan awal dikirim ke dapur.",
        },
      },
      {
        id: "hapus",
        title: "Hapus pesanan awal",
        points: [
          "Di layar “Pesanan awal”, kurangi semua menu sampai kosong, ketuk “Simpan ke reservasi”, lalu konfirmasi “Hapus pesanan awal”. DP yang sudah diterima tetap tertahan.",
          "Reservasi ber-DP yang batal atau tidak datang: pesanan awalnya ikut dihapus saat DP dikembalikan atau dihanguskan.",
          "Reservasi tanpa DP yang batal atau tidak datang: pesanan awalnya masuk antrean “… reservasi perlu diproses”. Buka reservasinya lalu ketuk “Hapus pesanan awal”.",
        ],
      },
    ],
    faqs: [
      {
        question: "Apakah stok berkurang saat pesanan awal disimpan?",
        answer: "Tidak. Stok baru dicek saat tamu datang, dan berkurang saat pesanan ditagih seperti pesanan biasa.",
      },
      {
        question: "Harga menu naik sebelum tamu datang. Harga mana yang dipakai?",
        answer: "Harga saat pesanan awal disimpan. Pajak, biaya layanan, dan promo dihitung ulang saat menagih.",
      },
      {
        question: "Tombol “Simpan & pilih menu” dan kartu “Pesanan awal” tidak ada.",
        answer:
          "Perbarui aplikasi ke versi terbaru di semua perangkat. Bila tetap tidak muncul, fitur pesanan awal belum aktif untuk outletmu.",
      },
    ],
    relatedSlugs: ["reservasi-meja-dan-dp", "layar-dapur", "mencatat-pesanan-dan-denah-meja"],
    keywords: ["pesanan awal", "pre order", "preorder", "pesan duluan", "pesan sebelum datang", "reservasi", "menu acara", "dp"],
  },
  {
    slug: "layar-dapur",
    category: "jualan",
    title: "Layar dapur",
    description: "Tiket masuk, dimasak, siap, dan sudah diambil — untuk dapur dan pelayan.",
    audience: ["Dapur", "Kasir"],
    readMinutes: 3,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Layar dapur menampilkan item yang perlu dimasak. Hanya produk dengan “Kirim ke dapur” yang masuk ke sini. Fitur “Layar dapur” diaktifkan pemilik di Pengaturan › “Jenis usaha” dan termasuk paket Pro. Tiket dapur juga bisa dicetak ke printer dapur; baca “Menyambungkan printer struk & dapur”.",
    steps: [
      {
        id: "kolom",
        title: "Tiga kolom: Masuk, Dimasak, Siap",
        description:
          "Tiket baru muncul di “Masuk”, lengkap dengan meja atau nomor antrean, jenis pesanan, catatan, dan lama menunggu. Item tambahan diberi tanda TAMBAHAN. Subjudul layar menghitung item yang belum siap, mis. “5 belum siap”, atau “Semua siap · 2 menunggu diambil”.",
        points: [
          "Warna kepala tiket menunjukkan lama menunggu: biru di bawah 10 menit, kuning 10–20 menit, merah 20 menit atau lebih.",
          "Kolom “Siap” selalu hijau.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/dapur-tablet.png",
          alt: "Layar dapur di tablet dengan kolom Masuk, Dimasak, dan Siap",
          caption: "Layar dapur di tablet.",
        },
      },
      {
        id: "aksi",
        title: "Menandai progres",
        steps: [
          "Ketuk tombol “Mulai” (▶) pada item, atau “Masak semua” untuk seluruh tiket.",
          "Ketuk tombol “Siap” (✓) pada item, atau “Semua siap”.",
          "Setelah diambil pelayan, ketuk “Sudah diambil”.",
        ],
        points: [
          "Hanya tombol “Mulai” dan “Siap” yang memindahkan status item. Mengetuk nama menu atau baris item tidak mengubah apa pun, jadi aman dari salah sentuh.",
          "Salah ketuk? Gunakan “Batalkan langkah”.",
        ],
      },
      {
        id: "pelayan",
        title: "Untuk pelayan dan kasir",
        description:
          "Saat dapur menandai pesanan siap, Kasir langsung memberi tahu: ikon lonceng berangka di kepala layar Kasir dan pesan singkat “… siap diantar”, di HP maupun tablet. Ketuk loncengnya untuk membuka lembar “Siap diantar”, antar ke tamu, lalu ketuk “Tandai sudah diantar”.",
        points: [
          "Di “Pesanan”, pesanan yang siap naik ke atas dengan bingkai hijau. Pakai saringan “Siap diantar” untuk melihatnya saja.",
          "Di layar Meja, kartu meja diberi lencana hijau “N siap antar”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/kasir-lonceng-siap-tablet.png",
          alt: "Layar Kasir di tablet dengan ikon lonceng berangka 2 di bagian atas",
          caption: "Angka di lonceng = jumlah pesanan yang siap diantar. Ketuk untuk membuka “Siap diantar”.",
        },
      },
      {
        id: "perangkat-khusus",
        title: "Perangkat khusus dapur",
        description:
          "Tablet di dapur bisa disetel sebagai “Layar dapur” saat setup perangkat. Perangkat itu langsung membuka layar dapur penuh dan layarnya dijaga tetap menyala. Pesanan dari QR pelanggan juga bisa dilihat lewat tombol “Pesanan QR” di layar dapur.",
      },
    ],
    relatedSlugs: ["setup-outlet-dan-perangkat", "mencatat-pesanan-dan-denah-meja", "karyawan-dan-pin"],
    keywords: ["dapur", "kitchen", "kds", "bar", "tiket", "chef", "masak", "siap diantar", "siap disajikan", "lonceng", "warna tiket", "status dapur"],
  },
  {
    slug: "pesan-dan-bayar-mandiri-qr",
    category: "jualan",
    title: "Pesan & Bayar Mandiri lewat QR: pengaturan",
    description: "Pelanggan memesan sendiri dari HP lewat QR meja, lalu membayar di kasir. Cara mengaktifkan, memilih mode meja, dan mencetak QR.",
    audience: ["Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_NEW,
    overview:
      "Dengan Pesan & Bayar Mandiri, pelanggan memindai QR di meja, memilih menu dari HP tanpa memasang aplikasi, lalu menyebut nomor pesanannya ke kasir untuk membayar. Setelah lunas, pesanan langsung masuk dapur. Fitur ini termasuk paket Pro.",
    prerequisites: [
      "Paket Pro atau masa uji coba Pro aktif.",
      "Produk sudah dibuat. Untuk QR per meja, meja juga sudah dibuat di menu Meja.",
    ],
    steps: [
      {
        id: "aktifkan",
        title: "Aktifkan pesanan dari QR",
        steps: [
          "Buka Pengaturan › “Penjualan” › “Pesan & Bayar Mandiri”.",
          "Di kartu “1. Aktifkan”, nyalakan “Terima pesanan dari QR”. Selama mati, hanya kartu ini yang tampil.",
          "Setelah dinyalakan, muncul kartu berikutnya berurutan: “Kode QR pesanan”, “2. Cara pesan”, “3. Pembayaran”, dan “4. Aturan pesanan”.",
          "Atur pilihan di tiap kartu (lihat langkah berikut), lalu ketuk “Simpan”.",
        ],
        callout: {
          type: "info",
          text: "Di paket Gratis, halaman ini menampilkan “Fitur Pro” dengan tombol “Lihat Langganan”. Baca “Langganan: paket Gratis & Pro”.",
        },
        image: {
          ...TABLET,
          src: "/panduan/pesan-mandiri-tablet.png",
          alt: "Pengaturan Pesan & Bayar Mandiri di tablet dengan sakelar Terima pesanan dari QR aktif, Kode QR pesanan, dan kartu Cara pesan",
          caption: "Nyalakan “Terima pesanan dari QR”, lalu atur cara pesan, pembayaran, dan aturan pesanan.",
        },
      },
      {
        id: "mode-meja",
        title: "2. Cara pesan: meja, jenis pesanan, dan pengantaran",
        description: "Di kartu “2. Cara pesan”, ketuk “Meja” lalu pilih salah satu di lembar pilihan (tiap pilihan ada penjelasannya):",
        points: [
          "“QR per meja” (bawaan) — tiap meja punya QR sendiri, meja terisi otomatis. QR outlet dipakai untuk pesanan tanpa meja.",
          "“Pilih meja” — cukup satu QR outlet; pelanggan memilih nomor meja saat makan di tempat.",
          "“Tanpa meja” — satu QR outlet; pelanggan mengambil pesanan di konter dengan nomor pesanan.",
          "Di “Jenis pesanan yang bisa dipilih”, aktifkan Makan di tempat, Bawa pulang, atau keduanya (minimal satu).",
          "“Pesanan sampai ke pelanggan”: “Diambil pelanggan” (pelanggan menyebut nomor pesanan) atau “Diantar ke meja” (pelayan mengantar pesanan makan di tempat; bawa pulang tetap diambil).",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pesan-mandiri-meja-tablet.png",
          alt: "Dialog pilihan Meja: QR per meja, Pilih meja, dan Tanpa meja beserta penjelasannya",
          caption: "Ketuk “Meja”, lalu pilih cara pelanggan menentukan meja.",
        },
      },
      {
        id: "pembayaran",
        title: "3. Pembayaran",
        description:
          "Di kartu “3. Pembayaran”, pilih “Bayar di kasir”: kasir menerima atau menolak pesanan, lalu menagih lewat Bayar seperti biasa. Pilihan “Bayar online” (QRIS di HP pelanggan) belum tersedia; selama belum diaktifkan, semua pesanan dibayar di kasir.",
      },
      {
        id: "alur",
        title: "4. Aturan pesanan: status untuk pelanggan",
        description: "Kartu terakhir, “4. Aturan pesanan”, dimulai dengan pengaturan status:",
        points: [
          "“Pelanggan memantau status pesanan” — bila menyala, halaman pelanggan menampilkan status sampai pesanan siap. Bila mati, halaman berhenti setelah pesanan lunas.",
          "Bila Layar dapur aktif, status “Sedang disiapkan” dan “Siap” berubah otomatis dari layar dapur. Tanpa layar dapur, kasir mengetuk “Tandai siap” saat pesanan siap.",
        ],
      },
      {
        id: "aturan",
        title: "4. Aturan pesanan: tambahan, batas, dan nomor",
        description: "Masih di kartu “4. Aturan pesanan”:",
        points: [
          "“Boleh pesan tambahan” — pelanggan bisa “Pesan lagi” selama pesanannya belum selesai; tambahan masuk ke tagihan yang sama.",
          "“Maks. pesanan menunggu per meja” (1–10, bawaan 3) — mencegah pesanan iseng menumpuk.",
          "“Batas tunggu dibayar di kasir (menit)” (5–60, bawaan 15) — pesanan yang tidak dibayar sampai batas ini menjadi “Kedaluwarsa”.",
          "“Awalan nomor pesanan” (1–2 huruf, bawaan A) — nomor dimulai ulang tiap hari, mis. A1, A2, ….",
        ],
      },
      {
        id: "kelola-qr",
        title: "Buat, cetak, dan tempel QR",
        steps: [
          "Di Pengaturan › “Pesan & Bayar Mandiri”, pada kartu “Kode QR pesanan” ketuk “Kelola & cetak QR” (atau tombol “Kelola QR” di layar Pesanan QR).",
          "Untuk QR per meja, di kartu “QR per meja” ketuk “Buat … QR” (mis. “Buat 8 QR”) untuk membuat QR semua meja sekaligus, atau “Buat QR” per meja. Belum ada meja? Ketuk “Buka menu Meja” untuk menambahkannya dulu.",
          "Kode muncul setelah perangkat online dan tersinkron: selama itu barisnya bertanda “Menunggu sinkron”, lalu tombol “Lihat” siap dipakai.",
          "Ketuk “Lihat” pada QR, lalu “Cetak” untuk mencetak ke printer struk perangkat ini, atau “Bagikan” untuk mengirim gambar QR (mis. untuk dicetak di percetakan).",
          "Tempel QR meja di tiap meja, dan QR outlet di kasir/konter.",
        ],
        callout: {
          type: "warning",
          text: "Tombol “Ganti kode” ada terpisah di bawah gambar QR, di bawah keterangan “QR hilang atau disalahgunakan?”. Setelah dikonfirmasi, QR lama langsung tidak berlaku — cetak dan tempel QR baru.",
        },
        image: {
          ...TABLET,
          src: "/panduan/kelola-qr-tablet.png",
          alt: "Layar Kode QR pesanan: QR outlet dan daftar QR per meja dengan tombol Buat 3 QR",
          caption: "Buat QR untuk semua meja sekaligus, lalu lihat, bagikan, atau cetak.",
        },
      },
      {
        id: "pelanggan",
        title: "Yang dilakukan pelanggan",
        steps: [
          "Memindai QR. Halaman kasir.sissi.id/pesan/… terbuka di browser HP.",
          "Memilih menu, varian, dan pilihan tambahan, lalu “Tambah”.",
          "Membuka “Lihat keranjang”, memilih “Makan di sini” atau “Bawa pulang”, mengisi “Nama pemesan (opsional)”, lalu “Kirim pesanan”.",
          "Menunjukkan nomor pesanan (mis. A12) ke kasir dan membayar.",
          "Memantau status (“Lunas di kasir”, “Sedang disiapkan”, “Siap diambil”), atau “Pesan lagi” untuk menambah.",
        ],
        points: ["Pelanggan bisa “Batalkan pesanan” sendiri selama belum dibayar."],
      },
    ],
    faqs: [
      {
        question: "Pelanggan melihat “Kode QR tidak berlaku”.",
        answer: "QR itu sudah diganti atau dinonaktifkan. Cetak QR terbaru dari “Kelola & cetak QR” dan tempel ulang.",
      },
      {
        question: "Pelanggan melihat “Pemesanan lewat QR sedang tutup”.",
        answer: "“Terima pesanan dari QR” sedang mati. Nyalakan lagi di Pengaturan › “Pesan & Bayar Mandiri”.",
      },
      {
        question: "Bisakah memberi diskon untuk pesanan QR?",
        answer: "Belum untuk pesanan yang dikirim pelanggan. Harga mengikuti harga produk dan pajak/biaya layanan outlet.",
      },
      {
        question: "Apa fungsi mode perangkat “Pesan mandiri” saat setup?",
        answer:
          "Mode itu disiapkan untuk perangkat pemesanan mandiri di toko yang akan datang. Saat ini perangkat dengan mode tersebut bekerja seperti “Kasir utama”. Pesanan QR pelanggan tidak memerlukan mode ini.",
      },
    ],
    relatedSlugs: ["menangani-pesanan-qr", "langganan-gratis-dan-pro", "layar-dapur"],
    keywords: ["qr", "self order", "pesan mandiri", "order dari meja", "scan menu", "menu digital", "qr meja", "bayar di kasir", "gacoan"],
  },
  {
    slug: "menangani-pesanan-qr",
    category: "jualan",
    title: "Menangani Pesanan QR di kasir",
    description: "Terima & bayar pesanan dari QR, tolak pesanan, tandai siap, serta suara dan notifikasi pesanan baru.",
    audience: ["Kasir", "Pemilik", "Dapur"],
    readMinutes: 4,
    lastUpdated: UPDATED_NEW,
    overview:
      "Pesanan yang dikirim pelanggan dari QR masuk ke menu “Pesanan QR”. Kasir menagihnya lewat “Terima & Bayar” saat pelanggan datang menyebut nomor pesanannya.",
    prerequisites: ["Pemilik sudah mengaktifkan Pesan & Bayar Mandiri (baca panduan pengaturannya).", "Kasir sudah dibuka."],
    steps: [
      {
        id: "masuk",
        title: "Saat pesanan baru masuk",
        points: [
          "Perangkat berbunyi dan muncul banner “Pesanan QR baru · A12” di atas layar berisi meja, jumlah item, total, dan “Bayar di kasir”. Ketuk “Lihat” untuk membuka antrean.",
          "Menu “Pesanan QR” menampilkan angka pesanan yang menunggu.",
          "Bila aplikasi tertutup, pesanan tampil sebagai notifikasi HP (perlu izin notifikasi).",
        ],
        devices: {
          hp: "“Pesanan QR” ada di “Lainnya” › “Operasional”.",
          tablet: "“Pesanan QR” ada di menu sisi kiri.",
        },
      },
      {
        id: "antrean",
        title: "Layar Pesanan QR",
        description: "Pesanan dibagi dalam tiga tab:",
        points: [
          "“Menunggu” — pesanan yang belum dibayar. Kartu menunjukkan nomor, meja (atau “Bawa pulang” / “Tanpa meja”), jumlah item, dan sisa waktu sebelum kedaluwarsa.",
          "“Diproses” — sudah lunas dan sedang disiapkan atau siap.",
          "“Selesai” — pesanan selesai, ditolak, dibatalkan, atau kedaluwarsa dalam 24 jam terakhir.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pesanan-qr-tablet.png",
          alt: "Layar Pesanan QR di tablet dengan tiga pesanan menunggu dibayar",
          caption: "Pesanan QR: tiap kartu punya tombol Tolak dan Terima & Bayar.",
        },
      },
      {
        id: "terima-bayar",
        title: "Terima & Bayar",
        steps: [
          "Tanyakan nomor pesanan pelanggan, lalu cari kartunya di tab “Menunggu”.",
          "Ketuk “Terima & Bayar”. Pesanan terbuka di layar Bayar.",
          "Selesaikan pembayaran seperti biasa (tunai, QRIS, kartu, atau transfer).",
          "Setelah lunas, item masak dikirim ke dapur dan halaman pelanggan berubah menjadi “Lunas di kasir”.",
        ],
        callout: {
          type: "tip",
          text: "“Terima & Bayar” tetap bisa dipakai saat internet putus. Statusnya terkirim ke pelanggan setelah perangkat online lagi.",
        },
      },
      {
        id: "tolak",
        title: "Menolak pesanan",
        description:
          "Ketuk “Tolak”, isi “Alasan” (mis. Menu habis), lalu “Tolak pesanan”. Alasan ditampilkan ke pelanggan di halaman pesanannya.",
      },
      {
        id: "siap",
        title: "Pesanan siap",
        points: [
          "Bila Layar dapur aktif, status menjadi “Siap” otomatis setelah semua item ditandai siap di dapur.",
          "Tanpa layar dapur, ketuk “Tandai siap” di tab “Diproses” saat pesanan siap. Dapur juga bisa menekannya.",
          "Pesanan “Siap” ditutup otomatis setelah 60 menit (tidak ada tombol untuk menyelesaikan manual).",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pesanan-siap-diantar-tablet.png",
          alt: "Pesanan berjalan dengan saringan Siap diantar aktif: tiga pesanan siap berbingkai hijau",
          caption: "Saringan “Siap diantar” menampilkan pesanan yang tinggal diserahkan.",
        },
      },
      {
        id: "notifikasi",
        title: "Izinkan notifikasi pesanan QR",
        description:
          "Saat fitur aktif, Beranda menampilkan sekali “Aktifkan notifikasi pesanan QR?”. Ketuk “Aktifkan” lalu izinkan notifikasi Android, agar pesanan tetap muncul walau aplikasi tertutup atau layar terkunci.",
        points: [
          "Terlanjur memilih “Nanti” atau menolak? Izinkan lewat Pengaturan Android › Aplikasi › Sissi › Notifikasi.",
          "Di pengaturan notifikasi Android, kanal “Pesanan QR” bisa diatur suaranya.",
        ],
      },
    ],
    faqs: [
      {
        question: "Pesanan baru tidak muncul.",
        answer:
          "Saat aplikasi terbuka, pesanan dicek tiap ±20 detik. Pastikan perangkat online. Bila aplikasi tertutup, pesanan hanya muncul lewat notifikasi, jadi izin notifikasi harus diberikan.",
      },
      {
        question: "Pesanan berstatus “Kedaluwarsa”.",
        answer:
          "Pelanggan tidak membayar sampai “Batas tunggu dibayar di kasir” habis. Pelanggan perlu memesan ulang dari QR, atau kasir mencatat pesanannya langsung di Kasir.",
      },
      {
        question: "Pelanggan ingin menambah pesanan.",
        answer:
          "Bila pemilik mengaktifkan “Boleh pesan tambahan”, pelanggan bisa “Pesan lagi” dari HP-nya. Tambahan muncul sebagai “A12 · Tambahan ke-1” dan masuk ke tagihan yang sama.",
      },
    ],
    relatedSlugs: ["pesan-dan-bayar-mandiri-qr", "menerima-pembayaran-qris-dan-tunai", "layar-dapur"],
    keywords: ["pesanan qr", "self order", "terima pesanan", "tolak pesanan", "nomor pesanan", "notifikasi pesanan", "bunyi pesanan"],
  },
  {
    slug: "menerima-pembayaran-qris-dan-tunai",
    category: "jualan",
    title: "Pembayaran: tunai, QRIS, kartu, transfer",
    description: "Uang pas dan kembalian, pembulatan tunai, QRIS toko, bayar pakai 2 metode, dan struk.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Layar “Pembayaran” muncul setelah menekan “Bayar”. Tunai selalu tersedia; QRIS, Kartu, Transfer, dan Kasbon hanya muncul bila diaktifkan pemilik.",
    steps: [
      {
        id: "tunai",
        title: "Bayar tunai",
        steps: [
          "Di “Cara bayar”, pilih “Tunai”.",
          "Ketuk “Uang pas” atau salah satu nominal saran, atau “Nominal lain” untuk mengetik sendiri. Selama uang diterima belum dipilih, tombol utama bertuliskan “Pilih uang diterima dulu”.",
          "Periksa “Kembalian”, lalu ketuk “Selesaikan pembayaran”.",
        ],
        points: [
          "Di lembar “Nominal lain”, tagihan tampil di atas (“Tagihan Rp …”), dan di bawah angka yang diketik langsung terlihat “Kembalian Rp …” (hijau) atau “Kurang Rp … (dicatat sebagian)” (kuning) bila uangnya kurang.",
          "Bila pembulatan tunai diatur pemilik (Pengaturan › “Pajak & biaya” › “Pembulatan tunai”), total di layar Pembayaran ikut dibulatkan selama Tunai dipilih, dengan catatan kecil “Termasuk pembulatan tunai +Rp …”. QRIS, kartu, dan transfer tetap memakai total asli, karena itu tombol “Bayar Rp …” di Kasir menampilkan total sebelum pembulatan.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/bayar-tablet.png",
          alt: "Layar Pembayaran dengan pilihan Tunai, QRIS, Kartu, Transfer, Kasbon",
          caption: "Cara bayar dan nominal cepat.",
        },
      },
      {
        id: "qris",
        title: "Bayar dengan QRIS",
        steps: [
          "Pilih “QRIS”, lalu ketuk “Tampilkan QRIS · Rp …”.",
          "Minta pelanggan memindai kode dan mengetik nominal yang tertera.",
          "Setelah dana masuk di rekening atau aplikasi merchant, ketuk “Sudah dibayar”.",
        ],
        callout: {
          type: "warning",
          text: "Sissi menampilkan QRIS toko (QRIS statis): nominal tidak tertanam di kode dan aplikasi tidak mengecek dana masuk. Pastikan dana benar-benar masuk sebelum menekan “Sudah dibayar”.",
        },
      },
      {
        id: "kartu-transfer",
        title: "Kartu dan transfer",
        points: [
          "“Kartu” — proses dulu di mesin EDC; selesaikan di Sissi setelah transaksi EDC berhasil.",
          "“Transfer” — layar menampilkan rekening tujuan. Selesaikan setelah transfer diterima.",
        ],
      },
      {
        id: "beberapa-cara",
        title: "Bayar pakai 2 metode (Gabungan)",
        steps: [
          "Pilih cara bayar pertama, mis. Tunai, lalu ketuk tautan “Bayar pakai 2 metode” di bawah “Cara bayar” (muncul sebelum ada pembayaran masuk).",
          "Masukkan nominal untuk metode pertama. Bila kurang dari tagihan, ketuk “Tambah pembayaran · Rp …”.",
          "Pada “Bayar sisa dengan”, pilih cara bayar berikutnya sampai “Sisa tagihan” habis.",
          "Ketuk “Selesaikan pembayaran”.",
        ],
        points: [
          "Salah masukkan? Hapus dengan “Hapus pembayaran”.",
          "Di Riwayat, laporan, dan struk, transaksi ini tercatat dengan metode “Gabungan” (dulu “Split”).",
          "Keluar dari layar Pembayaran setelah ada pembayaran masuk memunculkan “Keluar dari pembayaran?”. Pilih “Lanjutkan pembayaran”, atau “Keluar, buang Rp …” bila uangnya memang sudah dikembalikan ke tamu.",
        ],
      },
      {
        id: "selesai",
        title: "Setelah berhasil",
        description:
          "Layar “Pembayaran berhasil” menyediakan “Cetak struk” (berubah menjadi “Cetak ulang” setelah dicetak), “Kirim struk via WhatsApp”, “Lihat detail”, dan “Transaksi baru”.",
        points: [
          "Bila ada kembalian, angka “Kembalian” tampil paling besar berwarna hijau, dengan “Total tagihan Rp …” kecil di bawahnya, supaya kasir tidak salah memberi uang.",
          "Di HP, kartu rincian juga menampilkan pembayaran per metode (untuk tunai: uang yang diterima).",
          "Transaksi kasbon menampilkan kartu “Pelanggan: nama · no. HP”.",
          "Bila tiket dapur gagal dicetak, muncul kotak “Tiket dapur gagal dicetak” dengan tombol “Cetak ulang tiket dapur”.",
          "Laci uang terbuka otomatis untuk pembayaran tunai bila diaktifkan di pengaturan printer. Cetak ulang tidak membuka laci lagi.",
          "Bila printer struk belum diatur, muncul “Struk tidak dicetak: printer struk belum diatur.”; transaksi tetap tersimpan.",
        ],
      },
      {
        id: "atur-qris",
        title: "Pemilik: mengaktifkan QRIS dengan unggah gambar",
        steps: [
          "Buka Pengaturan › “Metode pembayaran”, lalu nyalakan “QRIS”.",
          "Ketuk “Unggah gambar QRIS” dan pilih foto atau screenshot QRIS toko. Bisa juga “Pindai dengan kamera”.",
          "Bila terbaca, muncul “QRIS terbaca” beserta “Nama di QRIS” dan kotanya. Periksa, lalu ketuk “Simpan”.",
        ],
        points: [
          "QRIS dinamis (sekali pakai untuk satu transaksi) ditolak; gunakan QRIS statis toko.",
          "“Isi manual (lanjutan)” hanya untuk kasus khusus, mis. memasukkan kode QRIS sebagai teks.",
          "Di halaman yang sama, aktifkan “Kartu” dan “Transfer” (isi rekening tujuan).",
        ],
        image: {
          ...TABLET,
          src: "/panduan/qris-pengaturan-tablet.png",
          alt: "Pengaturan Metode pembayaran dengan pratinjau QRIS terbaca",
          caption: "QRIS terbaca dari gambar, lengkap dengan nama di QRIS.",
        },
      },
    ],
    faqs: [
      {
        question: "Muncul “Kasir belum dibuka” saat mau bayar.",
        answer:
          "Isi “Kas awal di laci” lalu ketuk “Buka Kasir”. Pembayaran langsung dilanjutkan setelah kasir dibuka.",
      },
      {
        question: "Apakah ada biaya MDR QRIS dari Sissi?",
        answer:
          "Sissi hanya menampilkan QRIS milik toko. Biaya MDR mengikuti penyedia QRIS toko (bank atau penyedia pembayaran).",
      },
    ],
    relatedSlugs: ["kasbon-pelanggan", "membatalkan-transaksi-void-refund", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["bayar", "pembayaran", "qris", "tunai", "cash", "kembalian", "edc", "debit", "transfer", "split payment", "split", "gabungan", "2 metode", "pembulatan", "qris statis", "nominal lain", "struk", "whatsapp"],
  },
  {
    slug: "kasbon-pelanggan",
    category: "jualan",
    title: "Kasbon (bayar nanti) & pelunasan",
    description: "Catat utang pelanggan, atur jatuh tempo, tagih via WhatsApp, dan terima pelunasan.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Kasbon mencatat transaksi yang belum dibayar penuh atas nama pelanggan. Fitur ini mati secara bawaan; pemilik menyalakannya di Pengaturan › “Pesanan & keamanan kasir” › “Izinkan kasbon”. Kasbon baru termasuk paket Pro (pilihan “Kasbon” bertanda “PRO” di paket Gratis), tetapi kasbon lama selalu bisa dilunasi.",
    steps: [
      {
        id: "catat",
        title: "Mencatat kasbon",
        steps: [
          "Di layar Pembayaran, pilih “Kasbon”. (Bila pelanggan membayar sebagian dulu, masukkan pembayaran itu terlebih dahulu.)",
          "Ketuk “Simpan sebagai kasbon · …”.",
          "Di lembar “Simpan sebagai kasbon?”, isi “Nama pelanggan” bila belum dipilih, dan “Jatuh tempo” bila perlu.",
          "Ketuk “Simpan kasbon”. Layar berhasil menampilkan kartu “Pelanggan: nama · no. HP” agar mudah dicek.",
        ],
      },
      {
        id: "pantau",
        title: "Memantau kasbon",
        points: [
          "“Riwayat” › tab “Kasbon” (juga lewat “Lainnya” › “Kasbon”) berisi semua kasbon. Kartu atasnya merangkum “Piutang belum tertagih Rp … · N nota”. Tiap baris menampilkan nama pelanggan, sejak kapan (mis. “Sejak 22 Okt”), dan tanda jatuh tempo — merah bila sudah lewat. Kasbon yang terlambat ada di paling atas.",
          "Notifikasi “Kasbon jatuh tempo” muncul di menu Notifikasi.",
          "Di detail pelanggan, bagian “Kasbon berjalan” merangkum total utangnya.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pelanggan-kasbon-tablet.png",
          alt: "Detail pelanggan dengan kasbon berjalan dan tombol Lunasi semua",
          caption: "Kasbon berjalan di detail pelanggan.",
        },
      },
      {
        id: "lunasi",
        title: "Menerima pelunasan",
        steps: [
          "Buka transaksinya dari “Riwayat”, lalu ketuk “Lunasi Rp …” di bilah bawah. Atau dari detail pelanggan, ketuk “Lunasi semua”.",
          "Pilih lunas penuh atau “Sebagian” (isi “Nominal dibayar”), pilih “Cara bayar”.",
          "Ketuk “Terima …”. Centang “Cetak bukti pelunasan” bila perlu.",
        ],
        points: [
          "Untuk menagih, buka transaksinya lalu ketuk “Kirim via WA” › “Pengingat tagihan kasbon”. Pilih “Struk transaksi” bila ingin mengirim struknya. Dari detail pelanggan, pakai “Ingatkan via WA”.",
          "Aksi lain ada di tombol “Lainnya” di rincian transaksi: “Atur jatuh tempo”, “Cetak ulang”, “Salinan toko”, dan “Pesan ulang” (yang tersedia saja). Jatuh tempo tampil di blok “Sisa kasbon”.",
        ],
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "pelanggan-dan-member", "membaca-laporan-penjualan-dan-margin"],
    keywords: ["kasbon", "utang", "hutang", "piutang", "bon", "bayar nanti", "tempo", "jatuh tempo", "pelunasan", "tagih", "pengingat", "kirim via wa"],
  },
  {
    slug: "membatalkan-transaksi-void-refund",
    category: "jualan",
    title: "Membatalkan transaksi & refund (penuh atau sebagian)",
    description: "Batalkan transaksi dari Riwayat, atau kembalikan sebagian barang saja, dengan alasan dan persetujuan PIN pemilik.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Transaksi yang sudah dibayar tidak dihapus, tetapi dibatalkan dengan catatan. Uang yang sudah diterima dicatat kembali ke pelanggan, dan stok dikembalikan.",
    steps: [
      {
        id: "buka-transaksi",
        title: "Buka transaksinya",
        steps: [
          "Buka “Riwayat”, cari dengan “Cari no. struk / pelanggan”, lalu ketuk transaksinya.",
          "Di bilah bawah rincian, ketuk tombol ⋯ di samping tombol utama.",
          "Pilih “Refund” (transaksi lunas atau dibayar sebagian) atau “Batalkan” (yang belum dibayar). Pilihan ini sengaja disimpan di menu ⋯ dan berwarna merah, supaya tidak tertekan tanpa sengaja.",
        ],
      },
      {
        id: "pilih-jenis",
        title: "Pilih jenis dan alasan",
        steps: [
          "Di lembar “Refund transaksi”, pilih segmen “Refund semua”, “Refund sebagian”, atau “Batalkan” (uang belum diterima / salah input). Judul lembar ikut berubah, dan nomor struk tampil di bawah judul.",
          "Di “Alasan”, pilih “Salah input”, “Pelanggan batal”, “Pelanggan komplain”, atau “Transaksi ganda”, dan tambahkan keterangan bila perlu.",
          "Pada “Kembalikan lewat”, pilih “Sesuai pembayaran” atau cara lain.",
        ],
      },
      {
        id: "refund-sebagian",
        title: "Refund sebagian per barang",
        description: "Dipakai bila hanya sebagian barang yang dikembalikan, mis. 1 dari 2 es kopi tumpah.",
        steps: [
          "Di lembar Refund, pilih “Refund sebagian”.",
          "Di “Barang yang dikembalikan”, tekan + pada barang yang dikembalikan. “Pilih semua” memilih seluruh barang yang tersisa.",
          "Pilih alasan dan “Kembalikan lewat” (bawaan “Sesuai pembayaran”).",
          "Periksa “Uang dikembalikan”, lalu ketuk “Refund Rp …”.",
        ],
        points: [
          "Uangnya dihitung dari harga barang itu termasuk bagian diskon, pajak, dan biaya layanannya.",
          "Stok barang yang dikembalikan (termasuk bahan resepnya) masuk lagi, dan poin member dikurangi sebanding.",
          "Refund sebagian bisa diulang. Bila semua barang sudah dikembalikan, transaksi menjadi refund penuh.",
          "Refund sebagian hanya untuk transaksi yang sudah lunas.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/refund-sebagian-tablet.png",
          alt: "Lembar Refund sebagian di tablet: 1 Es Kopi Susu Gula Aren dipilih, uang dikembalikan sesuai pembayaran",
          caption: "Pilih jumlah barang yang dikembalikan; uangnya dihitung otomatis.",
        },
      },
      {
        id: "setelah-refund-sebagian",
        title: "Setelah refund sebagian",
        description:
          "Detail transaksi menampilkan lencana “Refund sebagian”, keterangan “… dikembalikan” di barangnya, baris “Refund sebagian” dan “Total setelah refund”, serta “Riwayat refund sebagian” (waktu, kasir, barang, alasan, dan penyetuju). Ketuk “Cetak struk refund” untuk mencetak struk refund.",
        points: [
          "Penjualan di Laporan dan Laba rugi berkurang pada tanggal transaksi aslinya.",
          "Uang yang dikembalikan tercatat di shift saat refund dilakukan, sebagai baris “Refund sebagian” di laporan tutup kasir.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/refund-sebagian-detail-tablet.png",
          alt: "Detail transaksi dengan lencana Refund sebagian, 1 dikembalikan, dan Total setelah refund",
          caption: "Detail transaksi setelah 1 barang direfund.",
        },
      },
      {
        id: "persetujuan",
        title: "Persetujuan pemilik",
        description:
          "Bila dilakukan kasir, pemilik perlu memasukkan PIN untuk menyetujui. Di detail transaksi tercatat “Disetujui …”.",
        callout: {
          type: "tip",
          text: "Pemilik bisa menerima peringatan di HP setiap ada transaksi dibatalkan atau di-refund. Baca “Notifikasi di aplikasi & peringatan pemilik”.",
        },
      },
    ],
    faqs: [
      {
        question: "Muncul “tidak tersimpan” atau “perubahan ditolak” setelah membatalkan.",
        answer:
          "Server menolak pembatalan bila perangkat ini belum menerima semua pembayaran transaksi itu dari perangkat lain. Tunggu sinkron selesai, lalu ulangi pembatalan.",
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "perubahan-ditolak", "notifikasi"],
    keywords: ["void", "refund", "batal", "retur", "pengembalian", "salah input", "refund sebagian", "retur sebagian", "kembalikan satu barang", "batalkan transaksi", "refund semua"],
  },

  // ───────────────────────────── SHIFT ─────────────────────────────
  {
    slug: "shift-kas-dan-tutup-kasir-harian",
    category: "shift",
    title: "Shift kas & tutup kasir harian",
    description: "Buka kasir dengan kas awal, catat kas masuk/keluar, hitung uang, dan cetak laporan tutup kasir.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Setiap uang tunai di laci tercatat dalam satu shift: dari kas awal, penjualan tunai, kas masuk/keluar, sampai hitungan akhir saat tutup kasir.",
    steps: [
      {
        id: "buka-kasir",
        title: "Buka kasir",
        steps: [
          "Ketuk “Buka Kasir” (di Beranda, Kasir, atau menu “Shift & Kas”).",
          "Hitung uang kembalian di laci dan isi “Kas awal di laci”.",
          "Tambahkan “Catatan (opsional)” bila perlu, lalu ketuk “Buka Kasir”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/buka-kasir-tablet.png",
          alt: "Dialog Buka kasir dengan isian Kas awal di laci dan papan angka",
          caption: "Isi kas awal sebelum mulai berjualan.",
        },
      },
      {
        id: "kas-masuk-keluar",
        title: "Catat kas masuk dan kas keluar",
        description:
          "Setiap uang yang diambil atau ditambahkan ke laci di luar penjualan harus dicatat, agar hitungan akhir cocok.",
        steps: [
          "Di “Shift saat ini”, ketuk “Kas masuk/keluar”.",
          "Pilih “Kas Masuk” atau “Kas Keluar”, isi “Nominal”.",
          "Pilih “Kategori” (wajib — tidak dipilih otomatis; mis. “Beli bahan”, “Operasional”, “Setor ke pemilik”) dan tulis “Catatan”. Bila lupa memilih, muncul “Pilih kategori kas dulu.”",
        ],
        points: [
          "Di “Shift saat ini”, pembayaran non-tunai tidak dihitung ke laci. Angkanya tampil di baris terpisah di bawah “Perkiraan uang di laci”: “Masuk ke rekening (QRIS/kartu/transfer)”.",
        ],
        callout: {
          type: "warning",
          text: "Selisih kas paling sering terjadi karena pengeluaran kecil yang tidak dicatat. Catat saat uang diambil, jangan menunggu tutup kasir.",
        },
      },
      {
        id: "tutup-kasir",
        title: "Tutup kasir",
        steps: [
          "Ketuk “Tutup Kasir”.",
          "Langkah 1: hitung uang fisik. Pilih “Per pecahan” (isi jumlah lembar per pecahan) atau “Isi total”, lalu “Lanjut”.",
          "Langkah 2: periksa “Ringkasan shift”. Sebelum ada uang dihitung, tertulis “Hitung uang di laci dulu — selisih tampil setelah uang dihitung.” Setelah dihitung, selisih ditulis dengan kata: “Pas”, “Kurang Rp…”, atau “Lebih Rp…”. Bila ada selisih, isi “Alasan selisih”.",
          "Konfirmasi “Tutup kasir sekarang?”. Shift yang sudah ditutup tidak bisa dibuka lagi.",
        ],
        devices: {
          hp: "Selama tutup kasir, menu bawah disembunyikan agar papan angka punya ruang. Baris pecahan yang sedang diisi digulir otomatis ke atas papan angka; tekan Enter untuk pindah ke pecahan berikutnya.",
        },
        image: {
          ...TABLET,
          src: "/panduan/tutup-kasir-tablet.png",
          alt: "Layar Tutup Kasir: hitung uang fisik per pecahan dan ringkasan shift",
          caption: "Hitung uang fisik per pecahan.",
        },
      },
      {
        id: "laporan",
        title: "Laporan tutup kasir",
        description:
          "Setelah ditutup, muncul “Laporan tutup kasir” berisi penjualan, metode pembayaran, kas masuk/keluar, uang fisik, dan selisih. Ketuk “Cetak” untuk mencetaknya.",
        points: [
          "Pemilik melihat semua laporan di “Lainnya” › “Laporan” › “Riwayat tutup kasir”. Ringkasannya memisahkan “Uang kurang” dan “Uang lebih”.",
          "Ketuk chip “Hanya yang ada selisih” untuk menampilkan shift yang kurang atau lebih saja; angka ringkasan ikut saringan.",
        ],
      },
      {
        id: "tutup-buta",
        title: "Tutup kasir tanpa angka sistem (bawaan untuk kasir)",
        description:
          "Secara bawaan, kasir menutup shift tanpa melihat jumlah uang yang seharusnya ada di laci. Kasir cukup menghitung uang fisik dengan jujur; pemilik yang memeriksa selisihnya.",
        points: [
          "Yang disembunyikan dari kasir: penjualan tunai dan total penjualan, kas masuk/keluar, DP dan refund, uang seharusnya di laci, dan selisih — di layar, juga di laporan yang dicetak atau dibagikan.",
          "Yang tetap terlihat oleh kasir: penjualan non-tunai, jumlah transaksi dan pembatalan, modal awal, uang fisik yang dihitung, dan catatan.",
          "Pemilik selalu melihat semua angka, termasuk saat membuka laporan shift kasir.",
          "Bila kasir boleh melihat angka sistem, matikan Pengaturan › “Pesanan & keamanan kasir” › “Tutup kasir tanpa melihat angka sistem”.",
        ],
        callout: {
          type: "info",
          text: "Perangkat yang masih memakai aplikasi versi lama bisa tetap menampilkan angka sistem ke kasir. Perbarui aplikasi di semua perangkat kasir.",
        },
      },
      {
        id: "pengaturan-pemilik",
        title: "Pengaturan pemilik",
        points: [
          "Pengaturan › “Shift kasir” (grup “Karyawan & absen”): “Daftar shift” (nama dan jam, tampil di Beranda) dan “Batas lama shift” (peringatan bila shift berjalan terlalu lama).",
          "“Kunci kasir” mengunci layar tanpa menutup shift; dibuka lagi dengan PIN karyawan.",
        ],
      },
    ],
    faqs: [
      {
        question: "Ada selisih uang. Apa yang harus dilakukan?",
        answer:
          "Tulis alasannya di “Alasan selisih”. Kasir tetap bisa menutup shift; pemilik bisa memeriksa transaksi dan kas keluar shift itu. Pemilik juga bisa menerima peringatan di HP saat shift ditutup dengan selisih.",
      },
      {
        question: "Muncul “… perubahan belum terkirim ke server” saat tutup kasir.",
        answer:
          "Ada data yang belum tersinkron. Shift tetap bisa ditutup; sebaiknya sambungkan internet agar data segera terkirim.",
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "membaca-laporan-penjualan-dan-margin", "karyawan-dan-pin"],
    keywords: ["shift", "buka kasir", "tutup kasir", "kas awal", "modal laci", "petty cash", "kas keluar", "kas masuk", "selisih", "laporan z", "blind close", "tutup buta", "riwayat tutup kasir", "uang kurang", "uang lebih"],
  },

  // ───────────────────────────── STOK ─────────────────────────────
  {
    slug: "stok-barang-dan-stok-masuk",
    category: "stok",
    title: "Stok barang: stok masuk, penyesuaian, stok menipis",
    description: "Pantau stok, catat barang datang, koreksi stok hilang/rusak, atur stok minimum, dan pantau bahan baku menipis.",
    audience: ["Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Stok hanya dihitung untuk produk yang “Lacak stok”-nya menyala. Stok berkurang saat pesanan ditagih, bukan saat pesanan disimpan. Semua menu stok ada di “Inventori” (tidak tersedia untuk usaha jasa dan penyewaan).",
    steps: [
      {
        id: "hub",
        title: "Inventori",
        description:
          "Menu “Inventori” berisi “Stok barang”, “Bahan baku”, “Barang keluar”, “HPP & Harga jual”, “Stok opname”, “Pembelian”, “Pemasok”, dan “Transfer stok”, ditambah kartu “Saran belanja ke pemasok” dan “Gerakan stok terakhir”.",
        image: {
          ...TABLET,
          src: "/panduan/inventori-tablet.png",
          alt: "Halaman Inventori di tablet",
          caption: "Inventori: menu stok, saran belanja, dan gerakan stok terakhir.",
        },
      },
      {
        id: "stok-masuk",
        title: "Catat barang datang (stok masuk)",
        steps: [
          "Buka “Inventori” › “Stok barang” (atau “Produk” › “Kelola” › “Stok & harga modal” — layarnya sama), pilih barang, lalu “Stok masuk”.",
          "Isi “Jumlah masuk” dan “Harga beli per satuan”.",
          "Nyalakan “Jadikan harga modal” bila harga beli ini mau dipakai sebagai HPP.",
        ],
        points: [
          "Untuk pembelian lewat pemasok yang dicatat lengkap, gunakan “Pembelian” (pesanan pembelian/PO).",
          "Di riwayat gerakan stok, stok masuk ditandai hijau; barang keluar, penyesuaian, dan selisih opname yang mengurangi stok ditandai merah.",
        ],
      },
      {
        id: "penyesuaian",
        title: "Penyesuaian stok",
        description:
          "Pilih barang › “Penyesuaian stok”. Pilih “Alasan”: “Hilang” atau “Rusak” (isi jumlah yang berkurang), atau “Koreksi hitung” (isi jumlah fisik sekarang).",
      },
      {
        id: "menipis",
        title: "Stok menipis",
        description:
          "Atur “Stok minimum” per barang. Barang di bawah batas tampil di tab “Perlu dibeli”, di kartu “Perlu perhatian” Beranda, dan sebagai notifikasi “Stok menipis”. Tombol “Salin daftar belanja” menyalin daftar untuk ditempel ke WhatsApp.",
        points: [
          "Kartu “Perlu perhatian” menyebut paling banyak 3 nama barang. Bila lebih, tertulis jumlahnya, mis. “5 barang menipis atau habis”.",
          "Ketuk “Beli lagi” di kartu itu untuk membuka daftar stok menipis. Dari layar “Stok menipis”, tombol “Buat pesanan ke pemasok” membuat draf pesanan pembelian.",
          "Warna stok sama di semua layar: “Menipis” kuning, “Habis” merah.",
        ],
      },
      {
        id: "bahan-menipis",
        title: "Bahan baku menipis",
        description:
          "Bahan baku masuk daftar “Perlu dibeli” bila stoknya sama dengan atau di bawah “Stok minimum”, minus, atau diperkirakan habis kurang dari 7 hari menurut pemakaian 30 hari terakhir. Aturan yang sama dipakai di Beranda, tab “Perlu dibeli”, “Saran belanja ke pemasok”, dan notifikasi.",
        points: [
          "Di Beranda pemilik, kartu “Perlu perhatian” menampilkan “… bahan baku menipis” beserta namanya (merah bila ada yang habis). Ketuk “Lihat” untuk membuka daftarnya.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/bahan-menipis-beranda-tablet.png",
          alt: "Kartu Perlu perhatian di Beranda tablet dengan baris 3 bahan baku menipis",
          caption: "Beranda pemilik: “3 bahan baku menipis” di kartu Perlu perhatian.",
        },
      },
      {
        id: "bahan-perlu-dibeli",
        title: "Tab Perlu dibeli",
        description:
          "Buka “Inventori” › “Bahan baku” › tab “Perlu dibeli”. Tiap bahan diberi lencana, mis. “Habis”, “… · menipis”, atau perkiraan habis seperti “3,4 kg · habis ±3 hari”. Dari sini kamu bisa langsung membuat draf pesanan pembelian per pemasok.",
        devices: {
          hp: "Bilah bawah tab “Perlu dibeli” berisi “Buat pesanan ke pemasok (n)” dan “Salin daftar belanja”.",
          tablet: "Panel ringkasan di kanan berisi tombol “Buat daftar pesanan ke pemasok”.",
        },
        image: {
          ...TABLET,
          src: "/panduan/bahan-perlu-dibeli-tablet.png",
          alt: "Tab Perlu dibeli di halaman Bahan baku tablet: gula aren habis, susu menipis, biji kopi diperkirakan habis 3 hari lagi",
          caption: "Bahan yang perlu dibeli, termasuk yang diperkirakan habis dalam 7 hari.",
        },
      },
      {
        id: "bahan-notifikasi",
        title: "Notifikasi bahan baku",
        description:
          "Pemilik menerima notifikasi “Bahan baku menipis” atau “Bahan baku habis” di menu Notifikasi (kelompok “Stok”). Notifikasi muncul sekali saat bahan turun, tidak diulang setiap hari. Setelah stok diisi cukup lalu turun lagi, notifikasi baru muncul.",
        image: {
          ...TABLET,
          src: "/panduan/bahan-menipis-notifikasi-tablet.png",
          alt: "Halaman Notifikasi tablet dengan notifikasi Bahan baku habis dan Bahan baku menipis",
          caption: "Notifikasi bahan baku menipis dan habis.",
        },
      },
    ],
    relatedSlugs: ["barang-keluar", "pembelian-po-dan-supplier", "stok-opname"],
    keywords: ["stok", "inventori", "stock", "barang masuk", "restok", "stok minimum", "stok habis", "penyesuaian", "bahan menipis", "bahan habis", "perlu dibeli", "beli lagi", "habis berapa hari"],
  },
  {
    slug: "barang-keluar",
    category: "stok",
    title: "Barang keluar: pemakaian bahan & produk",
    description: "Lihat bahan dan produk yang keluar per tanggal beserta nilainya, ekspor CSV, dan cek riwayat stok per tanggal.",
    audience: ["Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED_OCT21,
    overview:
      "“Barang keluar” merangkum bahan baku dan produk yang berkurang dari stok: terpakai & terjual, susut & penyesuaian, dan transfer keluar. Cocok untuk mengecek pemakaian harian atau mencocokkan dengan belanja.",
    steps: [
      {
        id: "buka",
        title: "Buka dan pilih periode",
        steps: [
          "Buka “Inventori” › “Barang keluar”.",
          "Pilih periode: “Hari ini”, “Kemarin”, “7 hari terakhir”, “30 hari terakhir”, atau “Pilih tanggal…” (maks 92 hari).",
          "Saring “Semua”, “Bahan baku”, atau “Produk”, atau cari lewat “Cari barang”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/inventori-tablet.png",
          alt: "Halaman Inventori di tablet dengan kartu Barang keluar dan HPP & Harga jual",
          caption: "Kartu “Barang keluar” ada di halaman Inventori.",
        },
      },
      {
        id: "baca-angka",
        title: "Membaca angkanya",
        points: [
          "“Nilai barang keluar” = jumlah × modal saat barang dipakai. Untuk data lama yang belum menyimpan modal, dipakai modal saat ini.",
          "Rinciannya: “Terpakai & terjual” (sudah dikurangi barang yang kembali karena refund), “Susut & penyesuaian”, dan “Transfer keluar”.",
          "Barang tanpa harga tetap dihitung jumlahnya, dengan peringatan “… barang belum punya harga”.",
          "“Per hari” berisi grafik dan daftar per tanggal. Ketuk satu hari untuk melihat barang keluar hari itu saja.",
          "Ketuk satu barang untuk melihat rinciannya: sebab keluar, keluar per hari, barang masuk, dan gerakan stok di periode itu.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/barang-keluar-tablet.png",
          alt: "Layar Barang keluar 7 hari terakhir: daftar barang, nilai barang keluar, dan grafik per hari",
          caption: "Barang keluar 7 hari terakhir: daftar di kiri, ringkasan nilai dan grafik per hari di kanan.",
        },
      },
      {
        id: "semua-outlet",
        title: "Gabungan semua outlet",
        description:
          "Bila usaha punya lebih dari satu outlet, ketuk pilihan outlet lalu pilih “Semua outlet” untuk melihat gabungannya. Pada pilihan ini, transfer antar-outlet tidak dihitung sebagai barang keluar.",
      },
      {
        id: "ekspor",
        title: "Ekspor CSV",
        description:
          "Ketuk “Ekspor CSV” untuk membagikan berkas berisi ringkasan, rincian per barang, dan per hari. Berkas bisa dibuka di Excel atau Google Sheets.",
      },
      {
        id: "riwayat-stok",
        title: "Riwayat stok per tanggal",
        steps: [
          "Buka “Inventori” › “Stok barang” atau “Bahan baku”, lalu pilih barangnya.",
          "Ketuk “Riwayat stok”.",
          "Ketuk “Semua tanggal (200 terbaru)”, lalu pilih periode untuk melihat gerakan stok di tanggal itu saja.",
          "Ketuk ✕ (“Hapus saringan tanggal”) untuk kembali ke semua tanggal.",
        ],
      },
    ],
    faqs: [
      {
        question: "Kenapa nilai barang keluar berbeda dengan total belanja?",
        answer:
          "Nilai barang keluar memakai modal saat barang dipakai (harga rata-rata bahan atau modal produk), bukan harga beli terakhir. Barang yang belum punya harga juga tidak ikut dinilai.",
      },
    ],
    relatedSlugs: ["stok-barang-dan-stok-masuk", "hpp-resep-dan-bahan-baku", "stok-opname"],
    keywords: ["barang keluar", "pemakaian bahan", "bahan terpakai", "usage", "riwayat stok", "kartu stok", "stock card", "mutasi stok", "csv"],
  },
  {
    slug: "pembelian-po-dan-supplier",
    category: "stok",
    title: "Pesanan pembelian (PO), pemasok & saran belanja",
    description: "Buat pesanan pembelian ke pemasok (supplier), kirim lewat WhatsApp, terima barang, dan pakai saran belanja.",
    audience: ["Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "“Pembelian” mencatat barang yang dipesan ke pemasok (supplier), disebut juga pesanan pembelian atau purchase order (PO). Saat barang diterima, stok dan harga rata-rata ikut diperbarui.",
    steps: [
      {
        id: "supplier",
        title: "Tambah pemasok",
        description:
          "Buka “Inventori” › “Pemasok” › “Pemasok baru”. Isi “Nama pemasok” dan “No. HP / WhatsApp”; email, alamat, dan catatan opsional.",
      },
      {
        id: "buat-po",
        title: "Buat pesanan pembelian",
        steps: [
          "Buka “Inventori” › “Pembelian” › “Pesanan baru”, lalu pilih pemasok.",
          "Ketuk “Tambah barang”, isi “Jumlah” dan “Harga per …”.",
          "Isi “Perkiraan tiba (opsional)” bila tahu.",
          "Ketuk “Simpan draf”, atau “Simpan & pesan” bila sudah dipesan. Total pesanan menempel di atas tombol.",
          "Kirim rinciannya ke pemasok lewat “Kirim ke WhatsApp” atau “Bagikan”. Pesannya memakai nomor dokumen, mis. “PO …”.",
        ],
        devices: {
          tablet: "Tiap barang tampil satu baris: nama, jumlah, harga, subtotal, dan tombol ✕ untuk menghapus.",
        },
      },
      {
        id: "terima",
        title: "Terima barang",
        description:
          "Buka pesanannya, ketuk “Terima barang”. Barang boleh diterima sebagian; gunakan “Terima semua” bila lengkap. Status berubah menjadi “Diterima sebagian” atau “Diterima”.",
        points: [
          "Membatalkan pesanan yang sudah dipesan atau menghapus draf ada di tombol teks merah di bawah daftar barang.",
        ],
      },
      {
        id: "saran-belanja",
        title: "Saran belanja ke pemasok",
        description:
          "Kartu ini di halaman Inventori mendaftar barang yang perlu dibeli: stoknya di bawah minimum, atau diperkirakan tidak cukup untuk 7 hari ke depan berdasarkan pemakaian 30 hari terakhir. Jumlah saran dan pemasoknya diambil dari pembelian terakhir.",
        points: [
          "“Buat daftar pesanan ke pemasok” (di HP: “Buat pesanan ke pemasok (n)”) — membuat draf pesanan pembelian sekaligus, satu per pemasok.",
          "“Salin daftar belanja” — menyalin daftar untuk ditempel di chat.",
          "Dari kartu “Perlu perhatian” di Beranda, tombol “Beli lagi” membuka daftar barang yang perlu dibeli.",
        ],
      },
    ],
    relatedSlugs: ["stok-barang-dan-stok-masuk", "stok-opname", "transfer-stok"],
    keywords: ["po", "purchase order", "pembelian", "pesanan pembelian", "supplier", "pemasok", "belanja", "restock", "restok", "beli lagi", "saran belanja"],
  },
  {
    slug: "stok-opname",
    category: "stok",
    title: "Stok opname",
    description: "Hitung stok fisik, lihat selisih, lalu terapkan hasil hitungnya.",
    audience: ["Pemilik"],
    readMinutes: 3,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Stok opname mencocokkan stok di aplikasi dengan jumlah fisik di rak atau gudang. Lakukan secara berkala, misalnya akhir bulan.",
    steps: [
      {
        id: "mulai",
        title: "Mulai opname",
        description:
          "Buka “Inventori” › “Stok opname” › “Mulai opname”. Pilih cakupan: semua barang atau sebagian.",
      },
      {
        id: "hitung",
        title: "Hitung",
        steps: [
          "Cari barang atau “Pindai barcode”.",
          "Isi “Jumlah fisik”. Aplikasi menampilkan selisihnya.",
          "Gunakan saringan “Belum dihitung”, “Sudah dihitung”, dan “Ada selisih” untuk memeriksa.",
        ],
        points: [
          "Di HP, progres tampil satu baris, mis. “3/5 dihitung · selisih −Rp …”, dan bilah bawah berisi “Batalkan” dan “Terapkan hasil hitung”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/opname-tablet.png",
          alt: "Layar Stok opname dengan ringkasan selisih dan tombol Terapkan hasil hitung",
          caption: "Progres hitung dan nilai selisih tampil satu baris; selisih lebih kuning, kurang merah.",
        },
      },
      {
        id: "posting",
        title: "Terapkan hasil hitung",
        description:
          "Periksa ringkasannya, lalu ketuk “Terapkan hasil hitung”. Konfirmasi “Terapkan hasil hitung?” menyebut berapa barang sudah dihitung dan nilai selisihnya; barang yang belum dihitung dianggap sesuai stok sistem (tidak diubah). Stok lalu disesuaikan dengan hasil hitung, dan sesi berstatus “Diterapkan”. Bila batal, ketuk “Batalkan opname”.",
        callout: {
          type: "tip",
          text: "Opname bisa dihentikan lalu dilanjutkan lewat “Lanjutkan opname”.",
        },
      },
    ],
    relatedSlugs: ["stok-barang-dan-stok-masuk", "pembelian-po-dan-supplier"],
    keywords: ["opname", "stock opname", "hitung stok", "audit stok", "selisih stok", "posting", "terapkan hasil hitung"],
  },
  {
    slug: "transfer-stok",
    category: "stok",
    title: "Transfer stok antar outlet",
    description: "Pindahkan barang dari satu outlet ke outlet lain.",
    audience: ["Pemilik"],
    readMinutes: 2,
    lastUpdated: UPDATED,
    overview: "Transfer stok membutuhkan minimal dua outlet dalam satu usaha.",
    steps: [
      {
        id: "buat",
        title: "Buat transfer",
        steps: [
          "Buka “Inventori” › “Transfer stok” › “Transfer baru”.",
          "Pilih “Outlet tujuan” dan barang yang dipindah.",
          "Biarkan “Langsung pindahkan stok” menyala bila barang langsung sampai.",
        ],
      },
      {
        id: "di-jalan",
        title: "Barang masih di jalan",
        description:
          "Matikan “Langsung pindahkan stok”. Transfer berstatus “Menunggu”; setelah barang sampai, buka transfernya dan ketuk “Selesaikan transfer”.",
      },
    ],
    faqs: [
      {
        question: "Bagaimana menambah outlet baru?",
        answer: "Outlet baru belum bisa ditambahkan dari aplikasi. Hubungi dukungan Sissi.",
      },
    ],
    relatedSlugs: ["stok-barang-dan-stok-masuk", "stok-opname"],
    keywords: ["transfer", "mutasi stok", "pindah stok", "antar outlet", "cabang"],
  },

  // ───────────────────────────── PELANGGAN ─────────────────────────────
  {
    slug: "pelanggan-dan-member",
    category: "pelanggan",
    title: "Pelanggan, member & poin",
    description: "Simpan data pelanggan, aktifkan poin, buat tingkat member, dan tukar poin di kasir.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 4,
    lastUpdated: UPDATED,
    overview:
      "Data pelanggan berguna untuk kasbon, struk WhatsApp, dan program poin. Member mendapat poin dan diskon sesuai tingkatnya.",
    steps: [
      {
        id: "tambah",
        title: "Tambah pelanggan",
        steps: [
          "Buka “Pelanggan” › “Tambah pelanggan” (atau dari Kasir lewat “Pilih pelanggan”).",
          "Isi “Nama pelanggan”; No. HP, email, tanggal lahir, dan catatan opsional.",
          "Nyalakan “Member” bila pelanggan ikut program poin.",
        ],
      },
      {
        id: "program-poin",
        title: "Atur program poin (pemilik)",
        description: "Buka Pengaturan › “Pelanggan & Member”.",
        points: [
          "“Aktifkan poin pelanggan” — poin didapat dari transaksi lunas.",
          "“Poin per Rp1.000 belanja”, “Nilai 1 poin saat ditukar (Rp)”, dan “Minimal tukar (poin)”.",
          "“Tingkat member” — tambah tingkat dengan syarat poin seumur hidup dan “Diskon member (%)”. Diskon tingkat terpasang otomatis di kasir.",
          "“Ulang tahun” — bonus poin di hari ulang tahun.",
        ],
      },
      {
        id: "tukar",
        title: "Tukar poin di kasir",
        description: "Di layar Pembayaran, ketuk “Tukar” pada bagian poin pelanggan.",
      },
      {
        id: "detail",
        title: "Detail pelanggan",
        description:
          "Berisi total belanja, kunjungan, poin, “Mutasi poin”, “Kasbon berjalan”, dan riwayat transaksi. Gunakan “Chat WA” untuk menghubungi, atau “Sesuaikan” untuk menambah/mengurangi poin dengan alasan.",
      },
    ],
    relatedSlugs: ["kasbon-pelanggan", "mencatat-transaksi-di-kasir"],
    keywords: ["pelanggan", "customer", "member", "poin", "loyalti", "tingkat", "ulang tahun", "crm"],
  },

  // ───────────────────────────── LAPORAN ─────────────────────────────
  {
    slug: "membaca-laporan-penjualan-dan-margin",
    category: "laporan",
    title: "Laporan penjualan, laba & jam ramai",
    description: "Penjualan, laba bersih & laba kotor, produk terjual, peta jam ramai & saran jadwal kasir, per kasir, riwayat, dan ekspor CSV.",
    audience: ["Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Menu “Laporan” (khusus pemilik) merangkum penjualan per periode. Untuk melihat transaksi satu per satu, gunakan “Riwayat”.",
    prerequisites: ["Harga modal (HPP) produk sudah diisi agar laba kotor akurat."],
    steps: [
      {
        id: "periode",
        title: "Pilih periode dan outlet",
        description:
          "Pilih “Hari ini”, “Kemarin”, “7 hari terakhir”, “30 hari terakhir”, “Bulan ini”, “Bulan lalu”, atau “Pilih tanggal…” (maks 92 hari). Bila punya beberapa outlet, pilih “Semua outlet” atau satu outlet.",
      },
      {
        id: "ringkasan",
        title: "Ringkasan",
        description:
          "Tab “Ringkasan” dimulai dengan angka utama, di HP maupun tablet:",
        points: [
          "“Penjualan” — total uang penjualan, sudah termasuk pajak (tertulis “Termasuk pajak Rp …”). Istilah ini sama di Beranda, Riwayat, Laporan, Shift, dan dasbor web.",
          "“Transaksi”, “Laba bersih”, “Piutang kasbon” (dengan jumlah yang “lewat jatuh tempo”), “Laba kotor”, “Rata-rata/transaksi”, “Diskon”, dan “Pajak” (dengan “Biaya layanan Rp …” bila ada).",
          "Ketuk “Laba bersih” untuk membuka Laba rugi. Bila biaya usaha atau modal menu belum lengkap, angkanya diberi tanda “Sementara — belum lengkap”.",
          "Di bawahnya: perbandingan dengan periode lalu, grafik penjualan, “Per metode bayar”, dan “Wawasan periode ini” (3 butir teratas; “Lihat semua (N)” untuk sisanya).",
        ],
        image: {
          ...TABLET,
          src: "/panduan/laporan-tablet.png",
          alt: "Laporan Ringkasan di tablet",
          caption: "Laporan Ringkasan 7 hari terakhir.",
        },
        callout: {
          type: "warning",
          text: "Bila muncul “… item tanpa harga modal”, laba kotor belum akurat. Isi harga modal produk tersebut.",
        },
      },
      {
        id: "tab-lain",
        title: "Produk terjual dan per kasir",
        description: "Di HP, tab-tab ini berlabel singkat “Produk”, “Jam”, dan “Kasir”.",
        points: [
          "“Produk terjual” — urutkan “Terlaris”, “Penjualan terbesar”, “Laba terbesar”, atau “Margin terendah” (untung paling tipis dulu — cek harga atau modalnya). Pilihan urutan tetap terlihat saat daftar digulir.",
          "“Per kasir” — penjualan per kasir.",
        ],
        callout: {
          type: "info",
          text: "Tab “Produk terjual” dan “Jam ramai” termasuk paket Pro. Ringkasan dan riwayat tetap tersedia di paket Gratis.",
        },
      },
      {
        id: "jam-ramai",
        title: "Jam ramai: peta jam × hari dan saran jadwal kasir",
        description:
          "Tab “Jam ramai” selalu memakai data 30 hari terakhir (tertulis “30 hari terakhir · …” di bawah judul), tidak ikut pemilih periode.",
        points: [
          "“Jam tersibuk” dan “Hari tersibuk” merangkum puncaknya. Bila dua hari sama ramainya, ditulis mis. “Senin & Kamis”.",
          "“Peta jam ramai” — kisi hari (Sen–Min) × jam. Tiap kotak = rata-rata transaksi per jam pada hari itu, dibagi berapa kali hari tersebut muncul sejak transaksi pertama di periode itu (jadi toko baru tidak tampak sepi). Makin pekat oranyenya, makin ramai; kotak polos = “Tanpa transaksi”. Jam yang tak pernah ada transaksi di awal dan akhir hari disembunyikan.",
          "Ketuk satu kotak untuk melihat rinciannya, mis. “Rata-rata Rp 450.000 dari 12 transaksi per hari”. Di HP, kolom jam bisa digeser ke samping.",
          "Grafik batang per jam tetap ada di bawah peta. Angka tampil di puncak batang bila muat; ketuk batang untuk melihat nilainya.",
        ],
        callout: {
          type: "tip",
          title: "Saran jadwal kasir",
          text: "Di bawah peta ada “Saran jadwal kasir”: “Paling padat: …” (jendela 2 jam teramai), “Tambah 1 kasir …” bila jam puncak jauh lebih ramai dari jam biasa (atau “Satu kasir masih cukup”), dan “Sepi … — cocok untuk restok/opname”. Saran baru muncul setelah ada data minimal 7 hari. Jadwal tetap Anda yang atur.",
        },
        image: {
          ...TABLET,
          src: "/panduan/jam-ramai-tablet.png",
          alt: "Laporan Jam ramai: peta jam × hari berwarna oranye bertingkat dan kartu Saran jadwal kasir",
          caption: "Makin gelap = makin ramai; saran jadwal muncul setelah 7 hari data.",
        },
      },
      {
        id: "riwayat-ekspor",
        title: "Riwayat penjualan dan ekspor",
        description:
          "“Riwayat” (Riwayat Penjualan) berisi semua transaksi dengan tab “Semua”, “Lunas”, “Kasbon”, “Batal”, serta saringan kasir, metode, dan periode. Di HP kuliner yang memakai meja, Riwayat ada di “Lainnya” › “Operasional”.",
        points: [
          "Di HP, judul tiap baris adalah nama pelanggan (atau “Umum · Meja … · Antrean …”), dan baris kedua berisi jam · jenis pesanan · metode bayar · nomor struk pendek, mis. “#028”. Pencarian tetap memakai nomor struk lengkap.",
          "Di tablet, tabel transaksi memenuhi layar; panel rincian muncul setelah transaksi diketuk.",
          "Rincian transaksi: “Cetak ulang” di bilah bawah (atau “Pratinjau struk” bila belum ada printer), “Kirim via WA”, “Lihat struk”, dan tombol “Lainnya” untuk aksi yang jarang dipakai (mis. “Salinan toko”, “Cetak tiket dapur”, “Pesan ulang”). Refund dan pembatalan ada di tombol ⋯ di bilah bawah.",
          "Metode bayar campuran tercatat sebagai “Gabungan”.",
          "“Ekspor CSV” tersedia di Laporan dan Riwayat. File CSV bisa dibuka di Excel atau Google Sheets.",
        ],
      },
    ],
    faqs: [
      {
        question: "Apakah laporan bisa dikirim otomatis ke email?",
        answer: "Belum. Ekspor CSV lalu bagikan secara manual.",
      },
      {
        question: "Di mana laporan tutup kasir?",
        answer: "Di Laporan bagian “Laporan tutup kasir”, atau “Lainnya” › “Laporan” › “Riwayat tutup kasir”.",
      },
      {
        question: "Kenapa tidak ada lagi istilah “omzet”?",
        answer:
          "Supaya tidak membingungkan, aplikasi kini memakai “Penjualan” (termasuk pajak) di Beranda, Riwayat, Laporan, dan Shift. “Pendapatan” (penjualan tanpa pajak) hanya dipakai di Laba rugi. Kolom CSV ikut memakai “Penjualan”.",
      },
    ],
    relatedSlugs: ["laporan-laba-rugi", "hpp-resep-dan-bahan-baku", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["laporan", "report", "omzet", "laba", "profit", "margin", "terlaris", "jam ramai", "peta jam ramai", "heatmap", "saran jadwal", "jadwal kasir", "laba bersih", "penjualan", "csv", "excel", "riwayat"],
  },
  {
    slug: "laporan-laba-rugi",
    category: "laporan",
    title: "Laporan laba rugi",
    description: "Baca pendapatan, laba kotor, pendapatan lain, biaya usaha, dan laba bersih per periode.",
    audience: ["Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "“Laba rugi” menunjukkan untung bersih usaha setelah modal menu (HPP) dan biaya usaha bulanan. Angkanya dihitung dari data di perangkat, jadi tetap bisa dibuka saat offline.",
    prerequisites: [
      "Modal (HPP) menu sudah diisi. Penjualan menu tanpa modal tidak dihitung ke laba.",
      "Biaya usaha sudah diisi di “HPP & Harga jual” › “Biaya usaha”. Tanpa itu, laba bersih belum dikurangi sewa, gaji, dan biaya bulanan lain.",
    ],
    steps: [
      {
        id: "buka",
        title: "Buka laba rugi",
        steps: [
          "Buka “Laporan”, tab “Ringkasan”, lalu ketuk angka “Laba bersih”. Bisa juga dari “HPP & Harga jual” › “Balik modal” › “Lihat laba rugi”.",
          "Pilih outlet dan periode. Selain pilihan biasa, ada “Bulan ini” dan “Bulan lalu”.",
        ],
        description: "Periode dan outlet sama dengan yang dipilih di Laporan, jadi angkanya mudah dicocokkan.",
        image: {
          ...TABLET,
          src: "/panduan/laporan-tablet.png",
          alt: "Laporan Ringkasan di tablet dengan angka Laba bersih di antara angka utama",
          caption: "Ketuk “Laba bersih” di tab Ringkasan Laporan untuk membuka Laba rugi.",
        },
      },
      {
        id: "cara-baca",
        title: "Cara membaca",
        description:
          "Paling atas ada kartu utama “Laba bersih” beserta “Untung …% dari pendapatan”. Tepat di bawahnya ada kartu “Dari penjualan ke pendapatan” (HP: kartu pertama; tablet: kolom kanan paling atas).",
        points: [
          "“Pendapatan” = penjualan dikurangi pajak (PB1). Pajak dititipkan untuk disetor, jadi bukan pendapatan. Kartu “Dari penjualan ke pendapatan” menjelaskan bedanya dengan angka Laporan.",
          "“Laba kotor” = penjualan menu bermodal dikurangi “Modal barang terjual”. Angkanya sama dengan Laba kotor di Laporan.",
          "“Pendapatan lain” = uang tanpa modal: DP hangus & sisa DP, biaya layanan, dan pembulatan. Ikut menambah laba bersih.",
          "“Biaya usaha” = biaya bulanan yang diisi, dibagi rata per hari kalender. Contoh: 7 hari di bulan Oktober (31 hari) memakai 7/31 dari biaya bulanan. Sebulan penuh = tepat biaya bulanan.",
          "“Laba bersih” = laba kotor + pendapatan lain − biaya usaha. Bila minus, tertulis “Rugi bersih” berwarna merah.",
          "Di bawah angka laba bersih ada perbandingan dengan periode sebelumnya, mis. “Naik Rp … vs periode lalu”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/laba-rugi-tablet.png",
          alt: "Layar Laba rugi 7 hari terakhir: pendapatan, laba kotor, biaya usaha diprorata, dan laba bersih",
          caption: "Contoh kedai kopi seminggu: laba kotor Rp 4.719.000, biaya usaha Rp 2.912.904, laba bersih Rp 2.090.826. Sebagian kecil penjualan (Rp 286.000) belum punya modal.",
        },
        callout: {
          type: "info",
          text: "Transaksi batal dan refund tidak dihitung. Refund sebagian mengurangi penjualan di tanggal transaksinya.",
        },
      },
      {
        id: "syarat",
        title: "Agar angkanya lengkap",
        points: [
          "Bila datanya belum lengkap, kartu “Laba bersih” diberi chip kuning “Sementara — biaya usaha belum diisi” atau “Sementara — modal menu belum lengkap”, dengan tombol “Isi biaya usaha” atau “Isi modal menu” di kartu itu.",
          "Muncul “… baris penjualan (Rp …) belum punya modal”? Penjualan itu tidak dihitung ke laba. Ketuk “Isi modal menu” dan isi modalnya.",
          "Biaya usaha “Belum diisi”? Ketuk “Isi biaya usaha”, lalu tambahkan sewa, gaji, listrik, dan biaya bulanan lain.",
          "Bila belum ada satu pun menu bermodal, laba kotor dan laba bersih tampil “—”.",
          "Pada “Semua outlet”, biaya usaha semua outlet dijumlahkan. Outlet yang belum mengisi diberi catatan.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/laba-rugi-biaya-kosong-tablet.png",
          alt: "Laba rugi dengan biaya usaha belum diisi dan tombol Isi biaya usaha",
          caption: "Biaya usaha belum diisi: laba bersih belum dikurangi biaya bulanan.",
        },
        callout: {
          type: "warning",
          text: "Biaya usaha memakai isian bulanan saat ini, juga untuk periode yang sudah lewat. Bila biaya berubah, angka periode lama ikut berubah.",
        },
      },
      {
        id: "ekspor",
        title: "Ekspor CSV",
        description:
          "Ketuk “Ekspor CSV” untuk membagikan rincian laba rugi, biaya usaha per kelompok (per bulan dan diprorata), jumlah hari periode, dan catatannya.",
      },
    ],
    faqs: [
      {
        question: "Kenapa laba bersih di sini beda dengan “Laba bersih perkiraan” di Balik modal?",
        answer:
          "Balik modal memakai 30 hari penuh sampai kemarin, tanpa pendapatan lain. Laba rugi memakai periode yang kamu pilih dan ikut menghitung pendapatan lain.",
      },
    ],
    relatedSlugs: ["membaca-laporan-penjualan-dan-margin", "harga-jual-biaya-usaha-dan-balik-modal", "hpp-resep-dan-bahan-baku"],
    keywords: ["laba rugi", "profit loss", "p&l", "laba bersih", "rugi", "untung bersih", "biaya operasional", "biaya usaha", "pendapatan", "sementara", "omzet"],
  },

  // ───────────────────────────── TIM ─────────────────────────────
  {
    slug: "karyawan-dan-pin",
    category: "tim",
    title: "Karyawan, akses & PIN",
    description: "Tambah karyawan, pilih akses di aplikasi (Pemilik/Kasir/Dapur/absen saja), undang ke HP pribadi, atur PIN, dan kunci kasir.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 6,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Karyawan tidak wajib punya akun email sendiri. Di perangkat toko yang sudah dimasuki pemilik, mereka membuka kasir dengan PIN 6 digit masing-masing. Bila perlu, karyawan juga bisa diundang masuk dari HP pribadinya.",
    steps: [
      {
        id: "tambah",
        title: "Tambah karyawan",
        steps: [
          "Buka “Tim” › “Karyawan” › “Tambah karyawan” (di HP tombolnya “+ Karyawan”).",
          "Isi “Nama karyawan”; “No. HP (opsional)” dan “Email (opsional)” boleh dikosongkan. No. HP wajib bila karyawan akan diundang ke HP pribadinya.",
          "Pilih “Akses di aplikasi” (lihat di bawah).",
          "Bila perlu, pilih “Jabatan (label saja, opsional)”, mis. barista atau pelayan. Jabatan hanya label dan tidak mengubah akses.",
          "Simpan. Gaji bisa diatur setelah karyawan disimpan (Tim › Gaji).",
        ],
      },
      {
        id: "akses",
        title: "Akses di aplikasi",
        description: "Tiap pilihan berupa kartu dengan penjelasan singkat:",
        points: [
          "“Pemilik” — semua menu, termasuk produk, laporan, tim, dan pengaturan. Memilih ini meminta konfirmasi “Beri akses pemilik?” lalu “Ya, jadikan pemilik”, karena orang itu juga bisa menyetujui refund dan pembatalan dengan PIN pemilik.",
          "“Kasir” — transaksi, pesanan, riwayat, pelanggan, dan absen.",
          "“Dapur” — layar dapur dan pesanan. Tersedia untuk usaha kuliner atau bila fitur dapur outlet diaktifkan.",
          "“Karyawan (absen saja)” — tanpa menu kasir dan tidak tampil di layar kunci. Absen dari HP pribadinya (Ruang Karyawan) atau di perangkat toko dengan PIN-nya. PIN untuk peran ini opsional.",
          "Kamu tidak dapat mengubah aksesmu sendiri.",
        ],
      },
      {
        id: "hp-pribadi",
        title: "Akses dari HP pribadi (undangan)",
        description:
          "Di kartu “Akses dari HP pribadi”, pilih “Akses”: “Tidak bisa login” (hanya PIN di perangkat toko), “Ruang Karyawan” (absen, riwayat kehadiran, dan slip gaji miliknya saja), atau “Sesuai tugas” (seperti di perangkat toko: Kasir atau Dapur sesuai tugasnya).",
        steps: [
          "Pastikan no. HP karyawan terisi dan karyawan aktif, lalu simpan.",
          "Di kartu “Akun HP pribadi”, ketuk “Undang”. Kirim tautan dan kodenya lewat WhatsApp. Kode hanya tampil sekali; bila hilang, ketuk “Kirim ulang undangan”.",
          "Karyawan membuka tautan, membuat kata sandi sendiri (syaratnya sama dengan kata sandi pemilik), lalu masuk di aplikasi dengan no. HP + kata sandi.",
        ],
        points: [
          "Karyawan berperan “Karyawan (absen saja)” juga bisa diundang; mereka masuk ke Ruang Karyawan.",
          "Satu akun terikat ke satu HP. Ganti HP? Ketuk “Lepas ikatan HP”, lalu karyawan masuk lagi dari HP baru.",
          "Lupa kata sandi? Ketuk “Kirim tautan reset kata sandi”.",
          "Perangkat toko tetap memakai PIN.",
        ],
      },
      {
        id: "pin",
        title: "Atur PIN",
        steps: [
          "Buka karyawan, lalu di kartu “PIN kasir” ketuk “Atur PIN”.",
          "Minta karyawan memasukkan PIN 6 digit, lalu mengulanginya.",
          "PIN yang terlalu mudah (angka sama atau berurutan) ditolak.",
        ],
        points: [
          "Pemilik juga bisa “Atur PIN saya”. PIN ini disebut “PIN pemilik” dan dipakai untuk menyetujui refund, pembatalan transaksi, dan aksi kasir lainnya.",
          "Bila masih ada karyawan aktif tanpa PIN, Beranda menampilkan catatan kuning yang menyebut namanya, mis. “Rani belum punya PIN…”, dengan tombol “Atur PIN” dan “Tutup”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pin-karyawan-tablet.png",
          alt: "Dialog Buat PIN baru untuk karyawan",
          caption: "PIN 6 digit untuk membuka kasir dan absen.",
        },
      },
      {
        id: "layar-kunci",
        title: "Layar kunci",
        description:
          "Bila ada karyawan aktif yang punya PIN, aplikasi terkunci saat dibuka ulang dan setelah tidak disentuh beberapa menit (bawaan 5 menit). Di layar “Siapa yang bertugas?”, karyawan memilih namanya lalu memasukkan PIN.",
        points: [
          "Kunci manual: “Kunci kasir” di menu Lainnya (HP) atau “Ganti karyawan (kunci)” di menu akun.",
          "Lama kunci otomatis diatur di Pengaturan › “Perangkat ini” › kartu “Lanjutan” › “Kunci kasir otomatis”: ketuk barisnya, lalu pilih “Mati” atau 1, 3, 5, 10, 15, atau 30 menit di lembar pilihan.",
          "Terlalu sering salah PIN membuat percobaan dikunci sementara. Lupa PIN? Pemilik bisa menggantinya.",
        ],
        callout: {
          type: "warning",
          text: "Tombol “Keluar dari akun usaha” di layar kunci mengeluarkan akun usaha dari perangkat, bukan sekadar ganti karyawan. Karena itu tombol ini meminta “PIN pemilik” (pilih pemiliknya bila lebih dari satu). Pengecualian: bila belum ada pemilik ber-PIN di perangkat itu, cukup konfirmasi biasa.",
        },
        image: {
          ...TABLET,
          src: "/panduan/kunci-otomatis-tablet.png",
          alt: "Dialog Kunci kasir otomatis dengan pilihan Mati sampai 30 menit",
          caption: "Pilih berapa lama kasir terkunci sendiri bila tidak disentuh.",
        },
      },
    ],
    relatedSlugs: ["absensi-karyawan", "gaji-dan-slip-gaji", "mengenal-menu-aplikasi"],
    keywords: ["karyawan", "staf", "pegawai", "pin", "pin pemilik", "pin supervisor", "peran", "role", "akses", "jabatan", "kasir", "dapur", "absen saja", "undangan", "hp pribadi", "ruang karyawan", "kunci", "lock", "keluar dari akun usaha"],
  },
  {
    slug: "absensi-karyawan",
    category: "tim",
    title: "Absen karyawan",
    description: "Absen masuk dan pulang dengan PIN, aturan jam kerja, dan koreksi manual.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 3,
    lastUpdated: UPDATED_OCT23,
    overview: "Absen dicatat di perangkat kasir dengan PIN, sehingga tidak perlu alat absen terpisah. Kehadiran termasuk paket Pro.",
    steps: [
      {
        id: "absen",
        title: "Absen masuk dan pulang",
        steps: [
          "Buka “Kehadiran” (atau pintasan “Absen” di Beranda).",
          "Ketuk “Absen masuk” atau “Absen pulang”.",
          "Pilih nama, lalu masukkan PIN. Kartu absen menuliskan: “Untuk siapa pun yang bertugas: pilih nama, lalu masukkan PIN.”",
        ],
        points: [
          "Karyawan tanpa PIN ditandai “Belum punya PIN” dan belum bisa absen di perangkat toko.",
          "Karyawan yang diundang ke HP pribadi (Ruang Karyawan) bisa absen dari HP-nya sendiri, di lokasi yang diatur pemilik di Pengaturan › “Lokasi absen”.",
          "Di layar Kehadiran, “Hari ini” dan “Riwayat” berupa chip kecil di bawah tab utama.",
        ],
      },
      {
        id: "aturan",
        title: "Jam kerja & telat (pemilik)",
        description:
          "Buka Pengaturan › grup “Karyawan & absen” › “Jam kerja & telat”, lalu ketuk “Ubah jam kerja”. Bisa juga lewat tombol “Jam kerja” di layar Kehadiran (tablet: di kepala layar; HP: di baris chip). Di lembar “Aturan jam kerja”, isi “Jam mulai”, “Jam selesai”, “Toleransi terlambat (menit)”, dan “Hari libur mingguan”. Aturan ini dipakai untuk status terlambat, lembur, dan libur.",
      },
      {
        id: "manual",
        title: "Koreksi absen (pemilik)",
        description:
          "Ketuk “Koreksi absen” di layar Kehadiran untuk mencatat izin, sakit, cuti, atau lupa absen. Isi karyawan, tanggal, status, jam, dan “Alasan perubahan”, lalu “Simpan absen”. Catatan ini ditandai sebagai input manual oleh pemilik.",
      },
    ],
    relatedSlugs: ["karyawan-dan-pin", "gaji-dan-slip-gaji"],
    keywords: ["absen", "absensi", "presensi", "kehadiran", "terlambat", "telat", "jam kerja", "koreksi absen", "absen manual", "lokasi absen", "izin", "sakit", "cuti"],
  },
  {
    slug: "gaji-dan-slip-gaji",
    category: "tim",
    title: "Gaji & slip gaji",
    description: "Atur gaji per karyawan, terbitkan slip dari data kehadiran, dan tandai sudah dibayar.",
    audience: ["Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED_OCT23,
    overview: "Gaji dihitung dari pengaturan gaji tiap karyawan dan data kehadirannya. Fitur gaji termasuk paket Pro.",
    steps: [
      {
        id: "atur",
        title: "Atur gaji karyawan",
        steps: [
          "Buka “Tim” › “Gaji”, pilih karyawan, ketuk “Atur gaji”.",
          "Pilih “Tipe gaji”: “Bulanan”, “Harian”, atau “Per jam”, lalu isi nominalnya.",
          "Isi bila perlu: “Lembur per jam”, “Tunjangan hadir per hari”, “Potongan telat per menit”, “Potongan alpa per hari”.",
        ],
      },
      {
        id: "terbit",
        title: "Terbitkan slip",
        description:
          "Buka slip karyawan untuk bulan itu, periksa rekap, lalu ketuk “Terbitkan slip”. Setelah terbit, perubahan kehadiran tidak lagi mengubah slip.",
        points: [
          "Status slip: “Belum terbit” (abu) → “Belum dibayar” (kuning, setelah slip terbit) → “Dibayar” (hijau).",
        ],
      },
      {
        id: "bayar",
        title: "Tandai sudah dibayar",
        description:
          "Untuk slip “Belum dibayar”, ketuk “Tandai sudah dibayar”. Bila dibayar dari laci, centang “Bayar tunai dari laci kasir” agar tercatat sebagai kas keluar shift. Statusnya menjadi “Dibayar”.",
        callout: { type: "warning", text: "Status dibayar tidak dapat dibatalkan." },
      },
    ],
    relatedSlugs: ["absensi-karyawan", "karyawan-dan-pin", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["gaji", "payroll", "slip gaji", "upah", "lembur", "potongan", "belum dibayar", "dibayar"],
  },

  // ───────────────────────────── JASA ─────────────────────────────
  {
    slug: "order-servis-dan-antrean",
    category: "jasa",
    title: "Order servis & antrean",
    description: "Catat order servis, pantau antrean, terima DP, dan serahkan ke pelanggan.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Untuk usaha jasa (bengkel, servis HP, laundry, salon, percetakan, dan lainnya). Isian order menyesuaikan jenis usaha, misalnya plat nomor untuk bengkel atau berat untuk laundry. Order servis baru termasuk paket Pro; order yang sudah berjalan tetap bisa diselesaikan dan ditagih.",
    steps: [
      {
        id: "order-baru",
        title: "Buat order servis",
        steps: [
          "Buka “Antrean” › “Order baru” (di HP: “+ Order baru”).",
          "Isi data pelanggan (nama, No. HP) dan “Data order” sesuai jenis usaha.",
          "“Tambah layanan” dari katalog, atau “Buat layanan baru” langsung di sini.",
          "Isi “Estimasi selesai” dan pilih petugas (mis. teknisi).",
          "Pilih pembayaran: “Saat diambil” atau “Bayar sekarang” (lunas atau uang muka/DP).",
          "Ketuk “Simpan” atau “Simpan & cetak”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/servis-order-baru-tablet.png",
          alt: "Form Order servis baru untuk bengkel",
          caption: "Contoh order bengkel: plat nomor, kilometer, merek & tipe.",
        },
      },
      {
        id: "antrean",
        title: "Pantau antrean",
        description:
          "Status order: “Diterima” → “Dikerjakan” → “Siap diambil” → “Diambil”. Majukan dengan tombol “Kerjakan”, “Selesai”, dan “Serahkan”. Order yang lewat estimasi ditandai “Terlambat” (merah).",
        points: [
          "Kartu antrean menampilkan kendaraan/plat (atau barang) lebih dulu; nomor nota tampil kecil di bawahnya.",
          "Tanda “Belum bayar” abu selama order dikerjakan, lalu kuning bila order sudah siap diambil tetapi belum lunas — tanda untuk ditagih saat pelanggan datang.",
        ],
      },
      {
        id: "serahkan",
        title: "Serahkan dan lunasi",
        description: "Di rincian order yang sudah siap tetapi belum lunas, pilih salah satu:",
        points: [
          "“Bayar Rp … & serahkan” (tombol utama) — tagih sisanya, lalu order langsung tercatat diambil.",
          "“Serahkan tanpa bayar (jadi kasbon)” — barang diserahkan dan sisa tagihan menjadi kasbon pelanggan, setelah konfirmasi. Hanya muncul bila kasbon diizinkan.",
          "“Bayar Rp … saja (belum diserahkan)” — terima pembayaran sekarang, barang diserahkan nanti.",
          "Dari tombol “Serahkan” di antrean, pilihannya “Bayar dulu” atau “Serahkan sebagai kasbon”.",
        ],
      },
      {
        id: "batal",
        title: "Batalkan order",
        description:
          "Ketuk “Batalkan order” dan tulis alasan. Bila sudah ada uang muka, uang itu dicatat dikembalikan ke pelanggan. Kasir mungkin perlu PIN pemilik.",
      },
    ],
    relatedSlugs: ["kasbon-pelanggan", "menerima-pembayaran-qris-dan-tunai", "karyawan-dan-pin"],
    keywords: ["servis", "service", "jasa", "bengkel", "laundry", "salon", "antrean", "teknisi", "dp", "uang muka", "serahkan", "ambil barang", "kasbon servis"],
  },

  // ───────────────────────────── SEWA ─────────────────────────────
  {
    slug: "penyewaan-booking-dan-sesi",
    category: "sewa",
    title: "Penyewaan: unit, booking & sesi",
    description: "Atur unit dan tarif, terima booking dengan DP, jalankan sesi dengan timer, dan tagih.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Untuk usaha sewa per waktu seperti lapangan, meja biliar, konsol game, atau ruangan. Menu utamanya “Jadwal” (booking) dan “Sesi” (pemakaian yang sedang berjalan). Booking dan sesi baru termasuk paket Pro; yang sudah berjalan tetap bisa diselesaikan.",
    steps: [
      {
        id: "unit",
        title: "Atur unit dan tarif (pemilik)",
        steps: [
          "Buka “Tarif & unit” (juga lewat tombol “Tarif & unit” di layar Sesi) › “Tambah unit”.",
          "Isi “Nama unit”, “Jenis”, “Tarif reguler per jam”, “Jam buka”, dan “Jam tutup”.",
          "Pilih “Cara tagih sesi walk-in”: “Per menit (meter)” atau “Paket”.",
          "Tambahkan tarif jam ramai lewat “Tambah jam ramai” bila tarif berbeda di hari & jam tertentu (lihat di bawah).",
        ],
      },
      {
        id: "jam-ramai",
        title: "Tarif jam ramai per unit (pemilik)",
        description:
          "Pada hari & jam yang dipilih, tarif tiap unit naik dari tarif regulernya, atau memakai satu harga tetap.",
        steps: [
          "Di “Tarif & unit”, ketuk “Tambah jam ramai”.",
          "Pilih “Berlaku untuk” (satu unit atau semua unit), “Hari”, serta jam mulai dan selesai.",
          "Pilih “Cara hitung tarif ramai”: “Naik %” (tarif reguler tiap unit dinaikkan sekian persen; bawaannya naik 50%), “Naik Rp” (tarif reguler ditambah nominal per jam), atau “Harga tetap” (semua unit yang dipilih memakai satu harga).",
          "Periksa pratinjau “Tarif ramai per unit”, mis. “Rp 40.000 → Rp 60.000/jam”, lalu simpan.",
        ],
        points: [
          "Unit yang tarif ramainya lebih murah dari reguler (“Lebih murah dari reguler”) atau lebih dari tiga kali lipat (“Lebih dari 3× reguler”) ditandai kuning. Tarif tetap boleh disimpan; periksa dulu bila tidak sengaja.",
          "Aturan untuk unit tertentu mengalahkan aturan “semua unit”. Bila ada beberapa aturan di jam yang sama, dipakai tarif tertinggi.",
        ],
        callout: {
          type: "warning",
          text: "Perbarui aplikasi di semua perangkat toko. Perangkat dengan aplikasi versi lama bisa menghitung tarif ramai berbeda.",
        },
      },
      {
        id: "booking",
        title: "Terima booking",
        steps: [
          "Buka “Jadwal” › “Booking baru” (di HP: “+ Booking baru”).",
          "Pilih unit, jam mulai, dan “Durasi”. Jadwal yang bentrok ditolak.",
          "Isi nama pemesan.",
          "Pilih pembayaran: “Bayar nanti”, “DP 50%”, atau “Lunas”, lalu simpan.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/sewa-jadwal-tablet.png",
          alt: "Beranda usaha penyewaan berisi booking hari ini dan sesi yang sedang main",
          caption: "Beranda usaha penyewaan: booking hari ini dan jadwal berikutnya.",
        },
      },
      {
        id: "sesi",
        title: "Jalankan sesi",
        steps: [
          "Saat pemesan datang, ketuk “Tamu datang · mulai main” pada booking. Timer sesi langsung berjalan. Untuk tamu tanpa booking, ketuk “Mulai” di unit kosong di “Sesi”.",
          "Gunakan “Tambah waktu” atau “Perpanjang” bila perlu.",
          "Ketuk “Selesai” (dulu “Stop”), lalu “Hentikan & tagih”. Tagihan terbuka di layar Bayar.",
        ],
      },
      {
        id: "batal",
        title: "Batal atau tidak datang",
        description:
          "Ketuk “Batalkan booking” atau “Tandai tidak datang” dan isi alasan. Bila DP sudah diterima, pilih “DP hangus” (dicatat sebagai pendapatan) atau “Kembalikan DP” (uang keluar dari laci, butuh PIN pemilik).",
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["sewa", "rental", "booking", "reservasi", "lapangan", "biliar", "ps", "timer", "sesi", "dp", "jam ramai", "tarif ramai", "peak hour", "check-in", "stop"],
  },

  // ───────────────────────────── NOTIFIKASI ─────────────────────────────
  {
    slug: "notifikasi",
    category: "notifikasi",
    title: "Notifikasi di aplikasi & peringatan pemilik",
    description: "Isi menu Notifikasi, cara mengaktifkan peringatan pemilik di HP, dan pilihan kategorinya.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 4,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Ada dua jenis notifikasi: daftar di menu “Notifikasi” (ikon lonceng) untuk semua pengguna, dan peringatan pemilik yang muncul di HP walau aplikasi tertutup.",
    steps: [
      {
        id: "menu-notifikasi",
        title: "Menu Notifikasi",
        description:
          "Berisi hal yang perlu diperhatikan di outlet, dikelompokkan lewat pilihan “Semua”, “Pesanan”, “Stok”, “Tim”, dan “Sistem” yang berjajar satu baris di atas daftar (geser ke samping bila tidak muat). Contohnya: pesanan QR baru, stok atau bahan baku menipis, kasbon jatuh tempo, pesanan siap diantar, order servis terlambat, booking segera mulai, shift terlalu lama, dan perubahan yang tidak tersimpan (“Perubahan gagal disimpan”).",
        points: [
          "Untuk membersihkan tanda baru, ketuk “Tandai semua dibaca”. Muncul konfirmasi “Tandai semua dibaca?”; ketuk “Tandai dibaca”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/notifikasi-tandai-dibaca-tablet.png",
          alt: "Dialog konfirmasi Tandai semua dibaca? di halaman Notifikasi",
          caption: "“Tandai semua dibaca” selalu dikonfirmasi dulu.",
        },
      },
      {
        id: "aktifkan",
        title: "Aktifkan peringatan pemilik",
        steps: [
          "Saat pemilik membuka Beranda pertama kali, muncul “Aktifkan notifikasi pemilik?”. Ketuk “Aktifkan”, lalu izinkan notifikasi Android.",
          "Bila tadi memilih “Nanti”, buka Pengaturan › “Notifikasi” dan nyalakan “Terima peringatan di perangkat ini”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/notifikasi-pengaturan-tablet.png",
          alt: "Pengaturan Notifikasi dengan sakelar peringatan pemilik per kategori",
          caption: "Pilih kategori peringatan yang ingin diterima di perangkat ini.",
        },
      },
      {
        id: "pesanan-qr",
        title: "Notifikasi pesanan QR (kasir)",
        description:
          "Bila Pesan & Bayar Mandiri aktif, perangkat kasir menampilkan sekali “Aktifkan notifikasi pesanan QR?”. Ketuk “Aktifkan” agar pesanan dari QR meja tetap muncul walau aplikasi tertutup. Saat aplikasi terbuka, pesanan baru tampil sebagai banner “Pesanan QR baru · …” disertai bunyi.",
      },
      {
        id: "kategori",
        title: "Pilih kategori",
        points: [
          "“Shift ditutup dengan selisih kas”.",
          "“Transaksi dibatalkan atau di-refund” — berisi nomor struk, nominal, dan outlet.",
          "“Login di perangkat baru” — akun dimasuki dari HP/tablet yang belum pernah dipakai.",
          "“Langganan” — pengingat masa Pro berakhir, batas transaksi Gratis, dan pembayaran tercatat.",
          "“Stok menipis atau habis” — barang atau bahan baku turun ke batas minimum atau habis, per outlet.",
          "“Ringkasan penjualan harian” — total penjualan dan jumlah transaksi hari ini, dikirim pukul 21.00.",
          "“Pengingat booking (usaha sewa)” — 15 menit sebelum booking mulai; juga muncul di perangkat kasir outlet itu.",
        ],
        callout: {
          type: "tip",
          text: "Pengaturan ini per perangkat. Nyalakan di HP pemilik, dan pilih “Nanti” atau matikan di tablet kasir bersama.",
        },
      },
    ],
    faqs: [
      {
        question: "Muncul “Izin notifikasi ditolak.”",
        answer: "Izinkan lewat Pengaturan Android › Aplikasi › Sissi › Notifikasi, lalu buka lagi Pengaturan › “Notifikasi” di Sissi.",
      },
      {
        question: "Apakah kasir menerima peringatan pemilik?",
        answer: "Tidak. Peringatan pemilik hanya untuk perangkat yang dipakai pemilik. Perangkat kasir hanya menerima notifikasi pesanan QR dan pengingat booking (usaha sewa).",
      },
      {
        question: "Saya membatalkan transaksi dari HP sendiri tetapi tidak dapat peringatan.",
        answer: "Peringatan tidak dikirim ke perangkat yang melakukan aksi tersebut; yang menerima adalah perangkat pemilik lainnya.",
      },
    ],
    relatedSlugs: ["akun-dan-keamanan", "membatalkan-transaksi-void-refund", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["notifikasi", "push", "pemberitahuan", "peringatan", "alert", "lonceng", "stok menipis", "ringkasan harian", "pengingat booking"],
  },

  // ───────────────────────────── OFFLINE ─────────────────────────────
  {
    slug: "bekerja-offline",
    category: "offline",
    title: "Bekerja offline & status sinkron",
    description: "Apa yang tetap bisa dilakukan saat internet putus dan arti tiap status sinkron.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED_NEW,
    overview:
      "Sissi menyimpan data di perangkat lebih dulu, lalu mengirimnya ke server di latar belakang. Karena itu kasir tetap bisa berjualan saat internet putus.",
    steps: [
      {
        id: "yang-bisa",
        title: "Yang tetap bisa saat offline",
        points: [
          "Mencatat transaksi, menyimpan pesanan, membuka dan menutup kasir.",
          "Data tersimpan di perangkat dan menunggu dikirim.",
          "Hal yang butuh server tetap perlu internet, misalnya masuk akun, unggah foto, dan sinkron pertama.",
          "Juga butuh internet: menerima Pesanan QR baru dari pelanggan, memperbarui status langganan, dan mengganti kata sandi.",
        ],
      },
      {
        id: "status",
        title: "Arti status sinkron",
        description: "Status tampil sebagai chip kecil di bagian atas layar (mis. di Beranda). Ketuk chip untuk mencoba sinkron sekarang.",
        points: [
          "“Tersinkron 12.30” — semua data sudah terkirim.",
          "“… menunggu dikirim” — ada perubahan yang belum terkirim.",
          "“Offline · … menunggu” — internet putus; data aman di perangkat.",
          "“Menyinkronkan…” — sedang mengirim.",
          "“Gagal sinkron · Ketuk untuk coba lagi”.",
          "“… perubahan ditolak” — ketuk untuk melihat daftarnya.",
          "“Perlu pembaruan · Sinkron berhenti” — perbarui aplikasi.",
        ],
      },
      {
        id: "kapan",
        title: "Kapan data dikirim",
        description:
          "Otomatis saat aplikasi dibuka, saat internet kembali, setelah ada perubahan, dan berkala tiap beberapa menit. Bila ada data dari perangkat lain yang bertentangan, versi server yang dipakai.",
        callout: {
          type: "warning",
          text: "Jangan keluar akun saat masih ada data menunggu dikirim. Aplikasi memperingatkan karena data yang belum terkirim akan hilang.",
        },
      },
    ],
    relatedSlugs: ["perubahan-ditolak", "perbarui-aplikasi", "tanya-jawab-masalah-umum"],
    keywords: ["offline", "tanpa internet", "sinkron", "sync", "internet mati", "koneksi"],
  },
  {
    slug: "perubahan-ditolak",
    category: "offline",
    title: "Perubahan ditolak server",
    description: "Kenapa perubahan bisa ditolak, dampaknya, dan cara menanganinya.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 3,
    lastUpdated: UPDATED,
    overview:
      "Kadang server menolak perubahan dari perangkat, misalnya karena pesanan yang sama sudah diubah di perangkat lain lebih dulu. Data di perangkat lalu dikembalikan ke versi server.",
    steps: [
      {
        id: "buka",
        title: "Buka daftarnya",
        description:
          "Ketuk chip “… perubahan ditolak”, atau kartu “Perubahan gagal disimpan” di Beranda/Notifikasi.",
      },
      {
        id: "baca",
        title: "Baca dampak dan alasannya",
        description:
          "Tiap item menjelaskan apa yang dikembalikan (mis. pembayaran yang dihapus dari perangkat dan kas shift) beserta “Alasan”.",
      },
      {
        id: "tangani",
        title: "Bereskan lalu tandai",
        steps: [
          "Bereskan dampaknya di dunia nyata, misalnya catat ulang transaksi atau kembalikan uang.",
          "Ketuk “Coba lagi” bila tersedia, atau “Tandai sudah ditangani”.",
          "Bila banyak, gunakan “Tandai semua sudah ditangani”.",
        ],
        callout: {
          type: "info",
          text: "Untuk konflik (data sudah diubah di perangkat lain), tombol “Coba lagi” tidak tersedia karena versi server yang dipakai.",
        },
      },
    ],
    relatedSlugs: ["bekerja-offline", "membatalkan-transaksi-void-refund"],
    keywords: ["ditolak", "rejected", "konflik", "gagal sinkron", "error sinkron"],
  },

  // ───────────────────────────── PEMBARUAN ─────────────────────────────
  {
    slug: "perbarui-aplikasi",
    category: "pembaruan",
    title: "Memperbarui aplikasi",
    description: "Bedanya “Versi baru tersedia” dan “Perbarui aplikasi” (wajib), serta “Lanjut tanpa sinkron”.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 3,
    lastUpdated: UPDATED,
    overview:
      "Sissi memeriksa versi terbaru saat aplikasi dibuka. Ada dua jenis pemberitahuan: pembaruan biasa yang boleh ditunda, dan pembaruan wajib.",
    steps: [
      {
        id: "tersedia",
        title: "“Versi baru tersedia” (boleh ditunda)",
        description:
          "Pembaruan membawa perbaikan, fitur baru, dan keamanan. Data tetap aman. Ketuk “Perbarui” untuk membuka Play Store, atau “Nanti” untuk menunda.",
        points: [
          "“Nanti” hanya berlaku untuk sesi itu; pop-up muncul lagi saat aplikasi dibuka berikutnya.",
          "Pop-up tidak muncul di tengah pembayaran.",
          "Pita “Versi baru tersedia” di bawah layar bisa ditutup.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pembaruan-tersedia-tablet.png",
          alt: "Pop-up Versi baru tersedia dengan tombol Nanti dan Perbarui",
          caption: "Pembaruan biasa: boleh ditunda.",
        },
      },
      {
        id: "wajib",
        title: "“Perbarui aplikasi” (wajib)",
        description:
          "Versi ini sudah tidak bisa sinkron dengan server. Pilih “Perbarui”, atau “Lanjut tanpa sinkron” bila sedang ramai.",
        points: [
          "Dengan “Lanjut tanpa sinkron”, kasir tetap bisa berjualan. Transaksi tersimpan di perangkat dan terkirim setelah aplikasi diperbarui.",
          "Status sinkron menjadi “Perlu pembaruan · Sinkron berhenti”, dan pita “Perbarui aplikasi” tidak bisa ditutup.",
          "Bila belum masuk atau belum selesai setup, aplikasi harus diperbarui dulu. Pilihannya “Perbarui” atau “Coba cek lagi”.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/pembaruan-wajib-tablet.png",
          alt: "Pop-up Perbarui aplikasi dengan tombol Perbarui dan Lanjut tanpa sinkron",
          caption: "Pembaruan wajib: sinkron berhenti sampai diperbarui.",
        },
        callout: {
          type: "warning",
          text: "Jangan menunda pembaruan wajib terlalu lama. Selama belum diperbarui, data tidak terkirim ke server dan laporan pemilik tidak bertambah.",
        },
      },
      {
        id: "tips",
        title: "Sebelum memperbarui",
        description:
          "Selesaikan transaksi yang sedang berjalan. Halaman “Pembaruan aplikasi” menunjukkan “Versi terpasang”, “Versi terbaru”, dan jumlah perubahan yang menunggu dikirim.",
        points: ["Bila Play Store tidak terbuka, perbarui Sissi POS lewat Play Store secara manual."],
      },
    ],
    relatedSlugs: ["bekerja-offline", "tanya-jawab-masalah-umum"],
    keywords: ["update", "pembaruan", "versi baru", "play store", "upgrade", "lanjut tanpa sinkron"],
  },

  // ───────────────────────────── AKUN ─────────────────────────────
  {
    slug: "akun-dan-keamanan",
    category: "akun",
    title: "Akun & keamanan",
    description: "Ganti kata sandi, PIN pemilik, login di perangkat baru, dan keluar akun.",
    audience: ["Pemilik"],
    readMinutes: 3,
    lastUpdated: UPDATED_OCT23,
    overview: "Pengaturan akun ada di Pengaturan › “Akun & keamanan”.",
    steps: [
      {
        id: "password",
        title: "Ganti kata sandi",
        description: "Khusus pemilik; karyawan masuk memakai PIN. Mengganti kata sandi butuh internet.",
        steps: [
          "Buka Pengaturan › “Akun & keamanan”. Di kartu “Keamanan”, pada baris “Kata sandi”, ketuk “Ganti”.",
          "Isi “Kata sandi saat ini”, lalu “Kata sandi baru” dan “Ulangi kata sandi”. Kata sandi baru harus 8–128 karakter, berisi huruf besar & huruf kecil, angka, dan simbol, serta bukan kata sandi umum (mis. yang memakai kata “sissi”, “kasir”, atau “password”). Daftar syarat di bawah kolom membantu mengeceknya.",
          "Nyalakan “Keluarkan perangkat lain” bila HP, tablet, dan dasbor web lain harus masuk lagi dengan kata sandi baru. Perangkat ini tetap masuk.",
          "Ketuk “Simpan kata sandi”. Muncul “Kata sandi berhasil disimpan.”",
        ],
        points: [
          "Daftar lewat Google dan belum pernah membuat kata sandi? Kosongkan “Kata sandi saat ini” untuk mengatur kata sandi.",
          "Lupa kata sandi saat ini? Gunakan “Lupa kata sandi?” di layar masuk; kode dikirim ke email akun.",
          "Bila muncul “Terlalu banyak percobaan”, tunggu sekitar 15 menit, lalu coba lagi.",
          "Kata sandi ditolak? Pesan penyebabnya tampil langsung di bawah kolom yang perlu diperbaiki.",
        ],
        image: {
          ...TABLET,
          src: "/panduan/ganti-password-tablet.png",
          alt: "Dialog Ganti kata sandi: kata sandi saat ini, kata sandi baru, ulangi kata sandi, dan sakelar Keluarkan perangkat lain",
          caption: "Isi kata sandi lama dan baru, lalu ketuk “Simpan kata sandi”.",
        },
      },
      {
        id: "pin-supervisor",
        title: "PIN pemilik",
        description:
          "“PIN pemilik” (dulu disebut PIN supervisor) dipakai untuk refund, membatalkan transaksi, menyetujui aksi kasir, dan keluar dari akun usaha di layar kunci. Atur di “Tim” › “Karyawan” (tombol “Atur PIN saya”), atau lewat Pengaturan › “Akun & keamanan” › “PIN pemilik” › “Atur”.",
      },
      {
        id: "perangkat-baru",
        title: "Login di perangkat baru",
        description:
          "Nyalakan kategori “Login di perangkat baru” di Pengaturan › “Notifikasi” agar HP pemilik diberi tahu setiap akun dimasuki dari perangkat yang belum pernah dipakai. Bila itu bukan kamu, segera ganti kata sandi.",
      },
      {
        id: "keluar",
        title: "Keluar dari akun",
        description:
          "Pilih “Keluar” di menu akun atau di “Lainnya”. Data di perangkat ini dihapus dan perlu internet untuk masuk lagi. Dari layar kunci, tombolnya bernama “Keluar dari akun usaha” dan meminta PIN pemilik.",
        callout: {
          type: "warning",
          text: "Bila muncul “Ada … perubahan yang belum terkirim ke server”, batalkan dulu dan sambungkan internet. Memilih “Tetap keluar” menghapus perubahan itu.",
        },
      },
    ],
    relatedSlugs: ["hapus-akun", "notifikasi", "karyawan-dan-pin"],
    keywords: ["akun", "password", "kata sandi", "ganti password", "syarat kata sandi", "keamanan", "logout", "keluar", "perangkat baru", "pin pemilik", "pin supervisor"],
  },
  {
    slug: "hapus-akun",
    category: "akun",
    title: "Menghapus akun",
    description: "Cara mengajukan penghapusan akun dan data usaha, serta masa tunggunya.",
    audience: ["Pemilik"],
    readMinutes: 2,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Penghapusan akun menghapus akun dan seluruh data usaha secara permanen. Hanya pemilik usaha yang bisa mengajukannya.",
    steps: [
      {
        id: "ajukan",
        title: "Ajukan lewat halaman Hapus akun",
        steps: [
          "Buka halaman kasir.sissi.id/hapus-akun (bisa dari HP atau komputer, tanpa memasang aplikasi).",
          "Isi “Email atau nomor HP akun” dan “Alasan (opsional)”, centang persetujuannya, lalu ketuk “Kirim kode verifikasi”.",
          "Masukkan “Kode verifikasi” yang dikirim ke email akun pemilik, lalu ketuk “Hapus akun permanen”.",
        ],
      },
      {
        id: "masa-tunggu",
        title: "Masa tunggu 30 hari",
        description:
          "Selama 30 hari kamu masih bisa membatalkan dengan masuk kembali ke aplikasi. Setelah itu data dihapus permanen dan tidak bisa dipulihkan.",
        callout: {
          type: "tip",
          text: "Ekspor dulu laporan dan riwayat penjualan (“Ekspor CSV”) bila masih membutuhkannya.",
        },
      },
      {
        id: "karyawan",
        title: "Akun karyawan",
        description:
          "Karyawan tidak perlu mengajukan penghapusan sendiri. Pemilik cukup menonaktifkan karyawan di “Tim” › “Karyawan” (matikan “Aktif”).",
      },
    ],
    relatedSlugs: ["akun-dan-keamanan"],
    keywords: ["hapus akun", "delete account", "tutup akun", "hapus data"],
  },

  // ───────────────────────────── LANGGANAN ─────────────────────────────
  {
    slug: "langganan-gratis-dan-pro",
    category: "langganan",
    title: "Langganan: paket Gratis & Pro",
    description: "Beda paket Gratis dan Pro, batas 50 transaksi per bulan, halaman Langganan, dan cara memperpanjang Pro.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 6,
    lastUpdated: UPDATED_OCT23,
    overview:
      "Sissi punya dua paket: Gratis dan Pro. Fitur dasar kasir selalu bisa dipakai gratis. Fitur lanjutan seperti meja, kasbon, dan laporan jam ramai termasuk paket Pro. Data kamu tidak pernah dihapus saat paket berakhir.",
    steps: [
      {
        id: "beda-paket",
        title: "Apa saja yang termasuk tiap paket",
        description: "Paket Gratis sudah mencakup kasir, struk, printer, semua metode bayar, mode offline, laporan dasar, diskon, pembatalan/refund, serta buka/tutup kasir. Paket Pro menambahkan:",
        points: [
          "“Transaksi tanpa batas”.",
          "“Kasbon & pengingat”.",
          "“Meja, pesanan berjalan & layar dapur”.",
          "“Antrean servis, jadwal & sesi sewa”.",
          "“Absensi, jadwal shift & gaji”.",
          "“Laporan jam ramai & produk terlaris”.",
          "“Pesan & Bayar Mandiri lewat QR”.",
          "“Bantuan prioritas”.",
        ],
        callout: {
          type: "info",
          text: "Usaha baru mendapat uji coba Pro selama 30 hari sejak daftar. Selama uji coba semua fitur Pro terbuka.",
        },
      },
      {
        id: "batas-transaksi",
        title: "Batas 50 transaksi per bulan di paket Gratis",
        points: [
          "Dihitung per bulan kalender (WIB): transaksi lunas dan yang di-refund. Transaksi yang dibatalkan dan pesanan yang belum dibayar tidak dihitung.",
          "Mulai transaksi ke-40, Kasir menampilkan “Sisa … transaksi Gratis bulan ini”.",
          "Saat batas tercapai, transaksi baru tidak bisa dimulai dan muncul “Batas Gratis bulan ini tercapai”. Pemilik bisa langsung ketuk “Upgrade ke Pro”.",
          "Pesanan yang sudah berjalan tetap bisa dibayar. Pelunasan kasbon, refund, pembatalan transaksi, tutup kasir, dan laporan juga tetap bisa.",
        ],
      },
      {
        id: "buka-halaman",
        title: "Membuka halaman Langganan (pemilik)",
        steps: [
          "Buka Pengaturan. Kartu “Langganan” ada paling atas, berisi status dan sisa hari (mis. “Uji coba Pro · Sisa 10 hari”). Bingkainya kuning bila tinggal 7 hari atau kurang, atau sedang masa tenggang. Ketuk kartunya.",
          "Lihat kartu status: “Paket Pro” atau “Paket Gratis”, statusnya (“Pro aktif”, “Uji coba Pro”, “Masa tenggang”, atau “Gratis”), dan sisa harinya. Di hari terakhir tertulis “Berakhir hari ini”.",
          "Kartu “Transaksi bulan ini” menunjukkan pemakaian, mis. “32 dari 50”.",
          "Kartu “Fitur Pro” menandai fitur yang aktif (centang) dan yang terkunci (gembok).",
          "Status diperbarui otomatis saat online. Ketuk “Muat ulang status” untuk mengambil status terbaru sekarang, mis. setelah admin mengonfirmasi pembayaran.",
        ],
        points: ["Halaman ini juga terbuka dari tombol “Lihat Langganan”, “Upgrade ke Pro”, atau “Perpanjang”."],
        image: {
          ...TABLET,
          src: "/panduan/langganan-tablet.png",
          alt: "Halaman Langganan: status uji coba Pro, transaksi bulan ini, dan fitur Pro",
          caption: "Halaman Langganan: status paket, pemakaian, dan fitur Pro. Cara bayar ada di bawahnya.",
        },
      },
      {
        id: "perpanjang",
        title: "Berlangganan atau memperpanjang Pro",
        description: "Pembayaran Pro saat ini dilakukan manual lewat transfer, lalu dikonfirmasi admin Sissi.",
        steps: [
          "Di halaman Langganan, ketuk “Berlangganan Pro” (atau “Perpanjang Pro” bila sedang Pro). Halaman langsung bergulir ke kartu “Cara bayar”.",
          "Di kartu “Cara bayar”, lihat harga bulanan/tahunan, rekening tujuan, dan petunjuk pembayaran. Ketuk ikon salin untuk menyalin nomor rekening. Bila rekening belum tampil, tanyakan lewat “Chat admin via WhatsApp”.",
          "Transfer sesuai harga paket yang dipilih.",
          "Ketuk “Chat admin via WhatsApp”. Pesan berisi nama usahamu sudah terisi; kirim beserta bukti transfer.",
          "Setelah admin mencatat pembayaran, status menjadi “Pro aktif” dan HP pemilik menerima notifikasi “Pro aktif sampai …”. Riwayatnya tampil di kartu “Riwayat pembayaran”.",
        ],
        points: [
          "Harga berlaku per usaha dengan 1 outlet termasuk, dan belum termasuk PPN.",
          "Bila diperpanjang sebelum habis, masa baru disambung dari tanggal berakhir yang lama, jadi tidak ada hari yang hilang.",
        ],
      },
      {
        id: "pengingat",
        title: "Pengingat sebelum Pro berakhir",
        points: [
          "Mulai 7 hari sebelum berakhir, muncul pita di bawah layar, mis. “Pro berakhir 3 hari lagi”. Pemilik bisa ketuk “Perpanjang”; kasir melihat “Beri tahu pemilik untuk memperpanjang.”",
          "Pita bisa ditutup untuk hari itu dengan tombol ✕.",
          "HP pemilik menerima notifikasi pada H-7, H-3, dan H-1, saat masa tenggang dimulai, saat kembali ke paket Gratis, dan saat transaksi Gratis hampir habis. Atur di Pengaturan › “Notifikasi” › kategori “Langganan”.",
        ],
      },
      {
        id: "berakhir",
        title: "Bila Pro berakhir",
        steps: [
          "Masa tenggang 3 hari: fitur Pro masih berjalan dan muncul peringatan “Masa tenggang”.",
          "Setelah itu paket kembali ke Gratis. Fitur Pro terkunci, tetapi data tetap aman dan tidak dihapus.",
        ],
        points: [
          "Yang sudah berjalan tetap bisa diselesaikan: pesanan dan meja yang terbuka bisa dibayar, order servis dan sesi sewa bisa ditagih, kasbon bisa dilunasi.",
          "Membuat yang baru (mis. simpan pesanan baru atau kasbon baru) menampilkan layar “Fitur Pro”. Pemilik bisa ketuk “Lihat Langganan”; kasir diminta menghubungi pemilik.",
          "Fitur yang terkunci diberi lencana “PRO” di menu.",
        ],
      },
      {
        id: "offline",
        title: "Langganan saat offline",
        description:
          "Status langganan disimpan di perangkat, jadi kasir tidak pernah terkunci hanya karena internet putus. Bila perangkat lebih dari 7 hari tidak online, muncul pesan “Sambungkan internet untuk memperbarui status langganan. Kasir tetap bisa dipakai.”",
      },
    ],
    faqs: [
      {
        question: "Kenapa halaman Langganan menulis “Paket belum diberlakukan”?",
        answer:
          "Artinya pembatasan paket belum dijalankan untuk akunmu. Semua fitur masih terbuka, dan status di halaman itu hanya sebagai informasi.",
      },
      {
        question: "Apakah data saya hilang bila tidak memperpanjang?",
        answer: "Tidak. Data tidak pernah dihapus. Fitur Pro hanya terkunci, dan terbuka lagi begitu Pro diperpanjang.",
      },
      {
        question: "Kasir tidak bisa membuka halaman Langganan.",
        answer: "Benar, halaman Langganan dan cara bayar hanya untuk pemilik di menu Pengaturan.",
      },
      {
        question: "Apakah ada pembayaran langsung di aplikasi?",
        answer: "Belum. Untuk saat ini pembayaran lewat transfer, lalu konfirmasi ke admin melalui “Chat admin via WhatsApp”.",
      },
    ],
    relatedSlugs: ["notifikasi", "akun-dan-keamanan", "pesan-dan-bayar-mandiri-qr"],
    keywords: ["langganan", "subscription", "pro", "gratis", "free", "upgrade", "perpanjang", "harga", "bayar langganan", "batas transaksi", "uji coba", "trial", "masa tenggang", "muat ulang status", "berlangganan pro", "perpanjang pro", "sisa hari"],
  },

  // ───────────────────────────── MASALAH UMUM ─────────────────────────────
  {
    slug: "tanya-jawab-masalah-umum",
    category: "masalah",
    title: "Tanya jawab masalah umum",
    description: "Jawaban cepat untuk kendala yang sering terjadi di kasir.",
    audience: ["Pemilik", "Kasir", "Dapur"],
    readMinutes: 5,
    lastUpdated: UPDATED_OCT23,
    overview: "Cari masalahmu di bawah. Bila belum terjawab, buka “Bantuan & Panduan” di aplikasi (menu Lainnya): panduan singkatnya dikelompokkan per topik, mis. “Transaksi & Pembayaran”, “Pesanan & Dapur”, dan “Akun & Langganan”, dan dari sana Anda bisa menghubungi tim Sissi.",
    steps: [
      {
        id: "kasir",
        title: "Di kasir",
        points: [
          "Tidak bisa menerima pembayaran → kasir belum dibuka. Ketuk “Buka Kasir” dan isi kas awal.",
          "Produk tidak muncul → cek “Dijual di kasir” di form produk, atau stoknya “Habis”.",
          "Varian tidak bisa dipilih → kombinasi itu dimatikan atau stoknya habis.",
          "Tombol “Simpan” tidak ada → fitur pesanan berjalan tidak aktif di outlet.",
          "QRIS tidak muncul di cara bayar → pemilik belum mengaktifkan QRIS di Pengaturan › “Metode pembayaran”.",
          "Muncul “Batas Gratis bulan ini tercapai” → paket Gratis sudah memakai 50 transaksi bulan ini. Pesanan yang berjalan tetap bisa dibayar; pemilik perlu berlangganan Pro untuk transaksi baru.",
          "Muncul layar “Fitur Pro” → fitur itu termasuk paket Pro. Data lama tetap aman; minta pemilik memperpanjang Pro lewat kartu “Langganan” di puncak Pengaturan.",
          "Tombol tunai bertuliskan “Pilih uang diterima dulu” → pilih “Uang pas”, nominal saran, atau “Nominal lain” dulu.",
          "Tombol − di item berubah jadi ikon hapus merah → jumlah item tinggal 1; mengetuknya menghapus item dari pesanan.",
          "“Pilih meja” tidak muncul → jenis pesanan bukan “Makan di tempat”.",
          "Pesanan QR tidak masuk → pastikan perangkat online dan izin notifikasi Sissi diberikan.",
        ],
      },
      {
        id: "sinkron",
        title: "Sinkron dan internet",
        points: [
          "Status “Offline · … menunggu” → data aman di perangkat; akan terkirim saat internet kembali.",
          "Status “Gagal sinkron” → ketuk chipnya untuk mencoba lagi.",
          "Status “Perlu pembaruan · Sinkron berhenti” → perbarui aplikasi di Play Store.",
          "Laporan di HP pemilik belum bertambah → perangkat kasir mungkin belum sinkron. Cek status sinkron di perangkat kasir.",
        ],
      },
      {
        id: "akun",
        title: "Masuk dan PIN",
        points: [
          "Kode verifikasi tidak masuk → cek folder spam/promosi, lalu “Kirim ulang” setelah hitung mundur.",
          "Lupa kata sandi → “Lupa kata sandi?” di layar masuk.",
          "Karyawan lupa PIN → pemilik mengganti PIN di “Tim” › “Karyawan”.",
          "PIN terkunci karena salah berkali-kali → tunggu beberapa menit sesuai pesan di layar.",
        ],
      },
      {
        id: "perangkat",
        title: "Printer dan perangkat",
        points: [
          "Pengaturan printer ada di mana? → Pengaturan › “Printer & laci uang” (grup “Perangkat”), bukan lagi di “Perangkat ini”.",
          "Ikon printer di kepala Kasir berwarna merah atau abu → ketuk ikonnya, lalu “Cek ulang” di lembar “Status printer”. Printer Bluetooth murah kadang butuh beberapa detik untuk siap setelah dinyalakan. Ikuti “Coba langkah ini”, atau ketuk “Buka pengaturan printer”.",
          "Printer Bluetooth tidak ditemukan → nyalakan printer, dekatkan, pastikan tidak tersambung ke HP lain, lalu “Cari lagi”. Beri izin Perangkat sekitar bila diminta.",
          "Struk tidak tercetak → cek ada printer yang dicentang “Struk kasir”. Untuk printer jaringan, cek alamat IP dan Wi-Fi yang sama.",
          "Tiket dapur tidak tercetak → di layar “Pembayaran berhasil” ketuk “Cetak ulang tiket dapur”, atau buka Riwayat › transaksinya › “Lainnya” › “Cetak tiket dapur”.",
          "Tulisan terakhir struk ikut tersobek, atau kertas terbuang banyak → buka “Penyesuaian lanjutan” di lembar printer, lalu atur “Sisa kertas setelah struk” dan “Punya pemotong kertas otomatis”.",
          "Laci tidak terbuka → laci hanya terbuka untuk pembayaran tunai dan harus dicolok ke port laci printer “Struk kasir” (printer portabel 58 mm umumnya tidak punya port laci). Coba “Tes buka laci” di “Printer & laci uang”; tombol ini baru muncul bila ada printer struk.",
          "Layar dapur tidak tampil penuh → pastikan fitur “Layar dapur” aktif dan yang membuka adalah pemilik atau karyawan berperan Dapur.",
          "Notifikasi pemilik tidak muncul → izinkan notifikasi Android untuk Sissi, lalu nyalakan di Pengaturan › “Notifikasi”.",
        ],
      },
      {
        id: "data",
        title: "Data dan laporan",
        points: [
          "Laba kotor terlihat aneh → masih ada produk tanpa harga modal.",
          "Stok tidak berkurang → “Lacak stok” mati, atau pesanan belum ditagih (stok berkurang saat dibayar).",
          "Stok produk dan bahan sama-sama berkurang → produk memakai resep dan “Lacak stok” menyala; pertimbangkan mematikan lacak stok produk.",
          "Ingin ganti jenis usaha → belum bisa sendiri; hubungi dukungan Sissi.",
        ],
      },
    ],
    relatedSlugs: ["bekerja-offline", "menyambungkan-printer-thermal-bluetooth", "langganan-gratis-dan-pro"],
    keywords: ["masalah", "error", "tidak bisa", "troubleshooting", "bantuan", "faq", "kendala", "printer merah", "status printer", "laci tidak terbuka", "tiket dapur tidak tercetak"],
  },
];

export function getGuide(slug: string): GuideItem | undefined {
  const resolved = LEGACY_SLUGS[slug] ?? slug;
  return GUIDES.find((guide) => guide.slug === resolved);
}

export function getCategory(id: GuideCategoryId): GuideCategory {
  return GUIDE_CATEGORIES.find((category) => category.id === id) ?? GUIDE_CATEGORIES[0];
}

/** Semua panduan dalam urutan baca (urutan kategori, lalu urutan di daftar). */
export function orderedGuides(): GuideItem[] {
  return GUIDE_CATEGORIES.flatMap((category) => GUIDES.filter((guide) => guide.category === category.id));
}

/** Teks gabungan untuk pencarian di halaman daftar. */
export function guideSearchText(guide: GuideItem): string {
  return [
    guide.title,
    guide.description,
    getCategory(guide.category).label,
    ...(guide.keywords ?? []),
    ...guide.steps.map((step) => step.title),
  ].join(" ");
}
