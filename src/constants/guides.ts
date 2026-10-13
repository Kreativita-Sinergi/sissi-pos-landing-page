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
  { id: "produk", label: "Produk & HPP", description: "Produk, varian, harga modal (HPP), resep, bahan baku, modifier, dan diskon." },
  { id: "jualan", label: "Jualan", description: "Kasir, pesanan berjalan, meja, dapur, pembayaran, kasbon, dan pembatalan." },
  { id: "shift", label: "Shift & kas", description: "Buka kasir, catat kas masuk/keluar, dan tutup kasir." },
  { id: "stok", label: "Stok & inventori", description: "Stok barang, pembelian (PO), supplier, saran belanja, opname, dan transfer stok." },
  { id: "pelanggan", label: "Pelanggan & member", description: "Data pelanggan, member, poin, dan tingkat member." },
  { id: "laporan", label: "Laporan", description: "Omzet, laba kotor, produk terlaris, jam ramai, dan riwayat penjualan." },
  { id: "tim", label: "Tim", description: "Karyawan, PIN, absen, dan gaji." },
  { id: "jasa", label: "Jasa / servis", description: "Order servis, antrean, uang muka, dan penyerahan." },
  { id: "sewa", label: "Penyewaan", description: "Unit sewa, tarif, booking, dan sesi dengan timer." },
  { id: "notifikasi", label: "Notifikasi", description: "Notifikasi di aplikasi dan peringatan pemilik di HP." },
  { id: "offline", label: "Bekerja offline", description: "Apa yang terjadi saat internet putus, status sinkron, dan perubahan ditolak." },
  { id: "pembaruan", label: "Perbarui aplikasi", description: "Pembaruan biasa dan pembaruan wajib." },
  { id: "akun", label: "Akun & keamanan", description: "Password, keluar akun, login perangkat baru, dan hapus akun." },
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

const HP = { device: "hp" as const, width: 390, height: 844 };
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
          "Buka “Produk”, ketuk “Tambah produk”, isi nama, kategori, dan harga. Kategori bisa dibuat langsung dari form lewat “Buat kategori baru”. Punya banyak produk? Impor sekaligus dari CSV lewat “Kelola” › “Impor dari CSV”.",
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
    description: "Membuat akun usaha baru, verifikasi email, masuk dengan Google, dan lupa password.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 4,
    lastUpdated: UPDATED_NEW,
    overview:
      "Akun dibuat oleh pemilik usaha. Kamu bisa mendaftar dengan email dan password, atau dengan akun Google tanpa perlu kode verifikasi.",
    steps: [
      {
        id: "daftar-email",
        title: "Daftar dengan email",
        steps: [
          "Di layar pembuka, ketuk “Daftar Usaha Baru”.",
          "Isi “Nama pemilik”, “Nama usaha”, “Email”, dan “Password” (minimal 8 karakter, berisi huruf dan angka). “No. HP (opsional)” boleh dikosongkan.",
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
        id: "daftar-google",
        title: "Daftar atau masuk dengan Google",
        steps: [
          "Ketuk “Lanjut dengan Google” di layar pembuka atau layar masuk, lalu pilih akun Google.",
          "Bila email itu sudah terdaftar, kamu langsung masuk.",
          "Bila email itu belum terdaftar, muncul layar “Lengkapi pendaftaran”. Nama pemilik sudah terisi dari Google; isi “Nama usaha” dan “Jenis usaha”, centang persetujuan, lalu ketuk “Buat Akun”.",
        ],
        points: [
          "Daftar lewat Google tidak memakai password dan tidak perlu kode verifikasi email. Bila ingin juga bisa masuk dengan password, buat password lewat “Lupa password?”.",
          "Akun pemilik yang dulu daftar dengan email bisa juga masuk lewat Google dengan email yang sama.",
          "“Lanjut dengan Google” hanya untuk pemilik. Karyawan tetap memakai PIN.",
        ],
        image: {
          ...HP,
          src: "/panduan/lengkapi-pendaftaran-hp.png",
          alt: "Layar Lengkapi pendaftaran setelah masuk dengan Google",
          caption: "Lengkapi pendaftaran: cukup isi data usaha.",
        },
      },
      {
        id: "masuk",
        title: "Masuk ke akun",
        description:
          "Di layar “Masuk ke akun”, isi “Email atau No. HP” dan “Password”, lalu ketuk “Masuk”. Centang “Ingat saya” di perangkat milik sendiri.",
        callout: {
          type: "info",
          text: "Kode tidak masuk? Cek folder spam atau promosi di email. Tombol “Kirim ulang” aktif lagi setelah hitung mundur selesai.",
        },
      },
      {
        id: "lupa-password",
        title: "Lupa password",
        steps: [
          "Di layar masuk, ketuk “Lupa password?”.",
          "Isi “Email atau No. HP”, lalu ketuk “Kirim Kode”. Kode dikirim ke email akun.",
          "Masukkan kode, lalu isi “Password baru” dan “Ulangi password”.",
          "Ketuk “Simpan Password”, lalu masuk dengan password baru.",
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
          "Biasanya pemilik masuk sekali di perangkat kasir, lalu karyawan membuka kasir dengan PIN masing-masing. Baca “Karyawan, peran & PIN”.",
      },
    ],
    relatedSlugs: ["setup-outlet-dan-perangkat", "akun-dan-keamanan", "karyawan-dan-pin"],
    keywords: ["registrasi", "sign up", "login", "otp", "kode verifikasi", "google", "reset password"],
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
    description: "Letak menu utama, isi “Lainnya”, Pengaturan, dan pencarian cepat.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 3,
    lastUpdated: UPDATED_NEW,
    overview:
      "Menu yang tampil mengikuti jenis usaha dan peran orang yang sedang memakai perangkat. Kasir tidak melihat Produk, Laporan, Inventori, dan Pengaturan.",
    steps: [
      {
        id: "menu-utama",
        title: "Menu utama",
        devices: {
          hp: "Menu ada di bawah layar: Beranda, Kasir, Pesanan (atau Antrean untuk jasa), Riwayat, dan “Lainnya”.",
          tablet: "Menu ada di sisi kiri. Notifikasi dan Pengaturan ada di bagian bawah sisi kiri.",
        },
        points: [
          "Kuliner: Beranda, Kasir, Pesanan, Meja, Dapur, Riwayat (ditambah “Pesanan QR” bila Pesan & Bayar Mandiri aktif).",
          "Ritel: Beranda, Kasir, Riwayat, Produk.",
          "Jasa: Beranda, Antrean, Kasir, Riwayat. Menu Produk bernama “Layanan”.",
          "Penyewaan: Beranda, Jadwal, Sesi, Kasir, Pesanan, Riwayat.",
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
          "Berisi menu yang tidak muat di menu utama, dikelompokkan menjadi “Operasional” (mis. “Shift & Kas”, “Kehadiran”, “Pesanan QR”), “Bisnis” (Produk, Inventori, Pelanggan, Tim), dan “Laporan” (Laporan, “Kasbon”, “Tutup Kasir”, “Gaji”).",
        devices: {
          hp: "“Lainnya” terbuka sebagai layar sendiri, dan juga memuat “Bantuan & Panduan”, “Kunci kasir”, dan “Keluar”.",
          tablet: "“Lainnya” terbuka sebagai panel di samping menu.",
        },
      },
      {
        id: "pengaturan",
        title: "Pengaturan (khusus pemilik)",
        description:
          "Pengaturan dikelompokkan: “Toko” (Profil toko, Jenis usaha, Kategori produk, Area meja), “Penjualan” (Pajak & biaya, Metode pembayaran, Transaksi, Struk, Kasir & jadwal shift, Pelanggan & Member, Pesan & Bayar Mandiri), “Perangkat” (Perangkat ini dengan pengaturan printer, Notifikasi), dan “Akun” (termasuk “Langganan”).",
        devices: {
          hp: "Tiap bagian terbuka sebagai halaman sendiri.",
          tablet: "Daftar bagian di kiri, isinya tampil di panel kanan — termasuk Kategori produk dan Area meja.",
        },
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
    keywords: ["navigasi", "sidebar", "menu bawah", "lainnya", "pengaturan", "panel kanan", "cari"],
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
          "“Lanjut dengan Google” tidak bisa dipakai. Daftar dan masuk dengan email dan password.",
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
    description: "Pasang printer Bluetooth atau jaringan (Wi-Fi/LAN), pakai beberapa printer untuk struk dan dapur, tes cetak, dan laci uang.",
    audience: ["Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_NEW,
    overview:
      "Printer diatur per perangkat di Pengaturan › “Perangkat ini” › “Printer” › “Atur”, yang membuka layar “Atur printer”. Sissi mendukung printer thermal Bluetooth dan printer jaringan (Wi-Fi/LAN). Satu perangkat bisa memakai beberapa printer, misalnya satu untuk struk kasir dan satu khusus dapur. Printer USB belum tersedia.",
    prerequisites: [
      "Printer thermal ESC/POS ukuran kertas 58 mm atau 80 mm.",
      "Printer Bluetooth: printer menyala dan dekat dengan perangkat, serta tidak sedang tersambung ke HP lain.",
      "Printer jaringan: printer dan perangkat kasir tersambung ke Wi-Fi/LAN yang sama, dan kamu tahu alamat IP printer (biasanya tercetak saat printer dinyalakan sambil menahan tombol feed).",
    ],
    steps: [
      {
        id: "atur-printer",
        title: "Buka layar Atur printer",
        steps: [
          "Buka Pengaturan › “Perangkat ini”.",
          "Pada baris “Printer” (tertulis “Belum diatur” bila belum ada printer), ketuk “Atur”.",
          "Di layar “Atur printer”, ketuk “Tambah printer”.",
        ],
        devices: {
          hp: "“Atur printer” terbuka sebagai layar penuh.",
          tablet: "“Atur printer” terbuka sebagai panel di sisi kanan.",
        },
        points: [
          "Bisa juga lewat pencarian “Printer struk”, atau langkah “Hubungkan printer struk” di kartu persiapan Beranda.",
          "Perubahan di layar ini langsung tersimpan (muncul “Pengaturan tersimpan”); tidak perlu menekan Simpan kedua kali.",
        ],
      },
      {
        id: "bluetooth",
        title: "Printer Bluetooth",
        steps: [
          "Di lembar “Printer baru”, pilih “Jenis sambungan”: “Bluetooth”.",
          "Ketuk “Pilih printer Bluetooth”. Bila diminta, ketuk “Izinkan” untuk izin Perangkat sekitar (atau Lokasi di Android 11 ke bawah). Bila Bluetooth mati, ketuk “Nyalakan Bluetooth”.",
          "Pilih printer dari “Sudah dipasangkan”, atau dari “Ditemukan di sekitar”. Printer yang belum dipasangkan bertanda “Pasangkan” — ketuk untuk memasangkannya langsung dari aplikasi.",
          "“Nama printer” terisi otomatis dari nama Bluetooth; ganti bila perlu (mis. Printer kasir).",
          "Atur peran, lebar kertas, dan pemotong (lihat di bawah), ketuk “Tes cetak”, lalu “Simpan”.",
        ],
        callout: {
          type: "tip",
          text: "Gagal memasangkan? Pastikan printer menyala dan tidak tersambung ke HP lain. PIN printer biasanya 0000 atau 1234. Bila printer tidak muncul, ketuk “Cari lagi”.",
        },
      },
      {
        id: "jaringan",
        title: "Printer jaringan (Wi-Fi/LAN)",
        steps: [
          "Pilih “Jenis sambungan”: “Jaringan (Wi-Fi/LAN)”.",
          "Isi “Alamat printer (IP)” (mis. 192.168.1.50) dan “Port” (umumnya 9100).",
          "Atur peran dan lebar kertas, ketuk “Tes cetak”, lalu “Simpan”.",
        ],
      },
      {
        id: "peran",
        title: "Peran printer: struk kasir dan tiket dapur",
        description:
          "Di “Dipakai untuk”, centang satu atau keduanya. Satu printer boleh mencetak struk sekaligus tiket dapur; punya printer khusus dapur, tambahkan sebagai printer kedua.",
        points: [
          "“Struk kasir” — struk, laporan shift, QR meja, dan laci uang. Bila ada beberapa printer struk, yang dipakai adalah printer struk pertama yang siap.",
          "“Tiket dapur” — pesanan yang dikirim ke dapur. Tiket dicetak ke semua printer dapur; bila satu gagal, printer lain tetap mencetak.",
          "Printer pertama otomatis tercentang keduanya. Printer berikutnya otomatis hanya “Tiket dapur”.",
          "Di daftar, tiap printer ditandai “Struk”, “Dapur”, “Tidak dipakai”, atau “Belum lengkap”.",
        ],
        callout: {
          type: "warning",
          text: "Bila muncul “Belum ada printer untuk struk kasir”, centang “Struk kasir” di salah satu printer. Tanpa itu struk tidak tercetak.",
        },
      },
      {
        id: "kertas",
        title: "Lebar kertas, pemotong, dan sisa kertas",
        points: [
          "“Lebar kertas”: “58 mm” atau “80 mm”, diatur per printer.",
          "“Punya pemotong kertas otomatis” — matikan bila kertas disobek manual. Kertas lalu dimajukan sampai batang sobek tanpa perintah potong. Bawaannya mati untuk Bluetooth dan menyala untuk jaringan.",
          "“Sisa kertas di akhir”: “Pendek”, “Sedang”, atau “Panjang”. Pilih Pendek bila kertas terlalu banyak terbuang; Panjang bila tulisan terakhir ikut tersobek.",
        ],
      },
      {
        id: "cetak-otomatis-laci",
        title: "Cetak otomatis dan laci uang",
        points: [
          "“Cetak struk otomatis setelah bayar” — struk tercetak setelah pembayaran berhasil.",
          "“Cetak tiket dapur otomatis saat pesanan dikirim ke dapur” — tiket tercetak di printer dapur.",
          "“Buka laci saat bayar tunai (laci tersambung ke printer)” — laci terbuka hanya untuk pembayaran yang memuat tunai (termasuk split dan pelunasan kasbon tunai). QRIS, kartu, dan transfer tidak membuka laci.",
          "Laci tetap terbuka walau cetak struk otomatis dimatikan. Cetak ulang struk tidak membuka laci.",
        ],
        description: "Sakelar yang sama juga ada di Pengaturan › “Perangkat ini” (“Cetak struk otomatis”, “Cetak tiket dapur otomatis”, “Buka laci otomatis”).",
      },
      {
        id: "tes",
        title: "Tes cetak dan tes laci",
        points: [
          "“Tes cetak” di lembar printer mencetak “TES CETAK” ke printer itu, walau belum disimpan.",
          "“Tes cetak struk” dan “Tes buka laci” ada di layar Atur printer dan di “Perangkat ini”. Tombol tes bisa ditekan bersamaan.",
          "Bila muncul “Perintah buka laci terkirim” tetapi laci tidak terbuka, periksa kabel laci ke port printer.",
        ],
      },
      {
        id: "isi-struk",
        title: "Atur isi struk",
        description:
          "Buka Pengaturan › “Struk”. Isi “Header struk”, “Footer struk”, dan “Instagram”, pilih “Tampilkan persen pajak” bila perlu, lalu cek lewat “Lihat pratinjau”. Pengaturan ini berlaku untuk semua perangkat di outlet.",
      },
      {
        id: "cetak-ulang",
        title: "Bila struk gagal dicetak dan cetak ulang",
        points: [
          "Bila gagal, muncul “Struk gagal dicetak” dengan pilihan “Coba lagi” atau “Lewati”. Transaksi tetap tersimpan.",
          "Struk bisa dicetak ulang dari “Riwayat” › buka transaksi › “Cetak ulang”.",
          "Tiket dapur yang gagal ditampilkan sebagai pesan “Tiket dapur tidak tercetak: …”; pesanan tetap tersimpan.",
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
        question: "Muncul “Printer tidak terjangkau”.",
        answer:
          "Pastikan printer menyala. Untuk printer jaringan, cek alamat IP dan pastikan satu Wi-Fi dengan perangkat (alamat IP bisa berubah bila router memberi alamat baru). Untuk Bluetooth, dekatkan printer dan pastikan tidak tersambung ke HP lain.",
      },
      {
        question: "Muncul “Izin Bluetooth belum diberikan”.",
        answer:
          "Buka Pengaturan HP › Aplikasi › Sissi › Izin, aktifkan Perangkat sekitar, lalu pilih ulang printernya di layar Atur printer.",
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
        answer: "Tidak. Printer, tes cetak, laci, dan cetak ulang bisa dipakai di paket Gratis.",
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "layar-dapur", "tanya-jawab-masalah-umum"],
    keywords: ["printer", "bluetooth", "thermal", "struk", "nota", "wifi", "lan", "58mm", "80mm", "laci", "cash drawer", "printer dapur", "pairing", "pemotong", "auto cut"],
  },

  // ───────────────────────────── PRODUK ─────────────────────────────
  {
    slug: "menambah-produk",
    category: "produk",
    title: "Menambah produk (satu harga)",
    description: "Isi form Tambah produk: kategori, satuan & stok, harga, HPP, dan pengaturan jual.",
    audience: ["Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_NEW,
    overview:
      "Produk dikelola di menu “Produk” (khusus pemilik; untuk usaha jasa bernama “Layanan”). Form disusun dari atas ke bawah: identitas produk, satuan & stok, jenis harga, lalu pengaturan jual.",
    steps: [
      {
        id: "buka-form",
        title: "Buka form dan isi nama",
        steps: [
          "Buka “Produk”, lalu ketuk “Tambah produk”.",
          "Tambahkan “Foto produk” bila ada (“Ambil foto” atau “Pilih dari galeri”). Unggah foto butuh internet.",
          "Isi “Nama produk”.",
          "Ketuk “Kategori”. Belum ada kategori yang cocok? Ketuk “Buat kategori baru” di bawah daftar, isi namanya, dan kategori itu langsung terpilih.",
        ],
        image: {
          ...HP,
          src: "/panduan/produk-pilih-kategori-hp.png",
          alt: "Pemilih kategori dengan tombol Buat kategori baru",
          caption: "Kategori baru bisa dibuat tanpa keluar dari form.",
        },
      },
      {
        id: "satuan-stok",
        title: "Satuan & stok",
        description:
          "Pilih “Satuan” (pilih “Satuan lain…” untuk menulis sendiri). Nyalakan “Lacak stok” bila stok produk ini ingin berkurang otomatis saat terjual.",
        image: {
          ...HP,
          src: "/panduan/produk-satuan-stok-hp.png",
          alt: "Bagian Satuan & stok dan Jenis harga di form Tambah produk",
          caption: "Satuan & stok ada di atas, sebelum Jenis harga.",
        },
      },
      {
        id: "harga",
        title: "Jenis harga, harga jual, dan HPP",
        steps: [
          "Pada “Jenis harga”, pilih “Satu harga”. (Untuk ukuran/rasa berbeda harga, baca “Produk dengan varian”.)",
          "Isi “Harga”.",
          "Pada “HPP (harga modal)”, pilih “Modal manual” lalu isi “Harga modal”, atau pilih “Resep” untuk menghitung dari bahan baku. Aplikasi menampilkan laba dan margin.",
          "Bila “Lacak stok” menyala, isi “Stok awal” dan “Stok minimum” (batas untuk peringatan stok menipis).",
          "“SKU (opsional)” dan “Barcode (opsional)” berguna untuk scan barcode di kasir.",
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
          "“Grup modifier” — pasang pilihan tambahan seperti level gula atau topping.",
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
          ...HP,
          src: "/panduan/produk-simpan-draf-hp.png",
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
          "Pakai kolom “Cari nama / SKU”. Saringan “Status” (Dijual / Tidak dijual), “Stok” (Habis, Menipis, Aman, Tidak dilacak), dan “Urutkan” ada di sebelahnya.",
      },
      {
        question: "Bisakah impor produk dari Excel?",
        answer: "Bisa. Simpan daftar produk sebagai CSV, lalu impor lewat “Produk” › “Kelola” › “Impor dari CSV”. Baca “Impor banyak produk dari CSV”.",
      },
    ],
    relatedSlugs: ["impor-produk-dari-csv", "produk-dengan-varian", "hpp-resep-dan-bahan-baku"],
    keywords: ["menu", "katalog", "item", "barang", "kategori", "harga", "foto produk", "draf", "sku", "barcode"],
  },
  {
    slug: "impor-produk-dari-csv",
    category: "produk",
    title: "Impor banyak produk dari CSV",
    description: "Isi template di Excel atau Google Sheets, periksa hasilnya, lalu impor sampai 1.000 produk sekaligus.",
    audience: ["Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_NEW,
    overview:
      "Punya banyak produk? Daripada mengisi satu per satu, isi template CSV lalu impor sekaligus. Aplikasi menampilkan pratinjau sehingga kamu bisa memilih produk yang diimpor dan menangani baris kembar sebelum menyimpan.",
    prerequisites: ["Aplikasi spreadsheet seperti Excel atau Google Sheets (di HP atau komputer)."],
    steps: [
      {
        id: "buka",
        title: "Buka Impor produk",
        steps: [
          "Buka “Produk”, ketuk “Kelola”, lalu “Impor dari CSV”.",
          "Bila daftar produk masih kosong, bisa juga lewat tautan “Atau impor banyak produk dari CSV”.",
        ],
      },
      {
        id: "template",
        title: "Unduh dan isi template",
        steps: [
          "Ketuk “Unduh template”, lalu simpan atau kirim berkas template-impor-produk.csv (mis. ke Google Drive atau email).",
          "Buka di Excel/Google Sheets. Isi satu baris untuk satu produk; hapus baris contoh.",
          "Simpan sebagai CSV (pemisah koma atau titik koma).",
        ],
        points: [
          "Wajib: “nama” dan “harga” (angka tanpa titik, mis. 15000).",
          "Opsional: “kategori” (dibuat otomatis bila belum ada), “modal”, “sku”, “barcode” (lebih dari satu dipisah titik koma), “satuan” (kosong = pcs), “lacak_stok” (ya/tidak), “stok_awal”, “stok_min”, “kena_pajak” (ya/tidak, kosong = ya), dan “deskripsi”.",
          "Usaha jasa punya kolom tambahan “durasi_menit”.",
          "Kolom yang tidak dikenali diabaikan.",
        ],
      },
      {
        id: "pilih-berkas",
        title: "Pilih berkas dan periksa hasilnya",
        steps: [
          "Ketuk “Pilih berkas CSV”. Muncul layar “Periksa impor”.",
          "“Gagal” — baris yang isiannya salah, mis. “harga: bukan angka yang sah”. Perbaiki di berkas, lalu pilih ulang berkasnya.",
          "“Kembar di berkas” — baris dengan SKU/barcode sama: pilih satu yang dipakai. Baris dengan nama sama: centang semua yang memang ingin diimpor.",
          "“Sudah ada di daftar produk” — produk yang SKU, barcode, atau namanya sudah ada. Pilih “Pertahankan” (bawaan) atau “Pakai CSV” untuk menimpa.",
          "“Siap diimpor” — centang produk yang mau diimpor, atau “Pilih semua”.",
        ],
        points: ["Banner “Kategori baru yang akan dibuat” menunjukkan kategori yang belum ada."],
      },
      {
        id: "impor",
        title: "Impor",
        steps: [
          "Ketuk “Impor … produk”. Bila ada produk yang ditimpa, konfirmasi “Timpa & impor”.",
          "Muncul “Impor selesai” dengan jumlah produk baru, diperbarui, dan dilewati. Ketuk “Selesai” atau “Impor berkas lain”.",
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
        answer: "Belum. Impor membuat produk satu harga. Varian ditambahkan lewat form produk setelah impor.",
      },
      {
        question: "Apakah stok produk yang sudah ada ikut berubah?",
        answer:
          "Tidak. “stok_awal” hanya berlaku untuk produk baru. Menimpa produk dengan “Pakai CSV” mengubah nama, harga, kategori, kode, dan pengaturan, tetapi tidak mengubah stok, foto, maupun modifier.",
      },
      {
        question: "Berapa batasnya?",
        answer: "Maksimal 1.000 baris dan 2 MB per berkas. Lebih dari itu, bagi menjadi beberapa berkas.",
      },
      {
        question: "Muncul “Kolom \"nama\" tidak ditemukan”.",
        answer: "Baris pertama berkas harus berisi judul kolom dari template. Unduh ulang template dan salin datamu ke dalamnya.",
      },
    ],
    relatedSlugs: ["menambah-produk", "produk-dengan-varian", "stok-barang-dan-stok-masuk"],
    keywords: ["impor", "import", "csv", "excel", "google sheets", "upload produk", "massal", "bulk", "template"],
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
          ...HP,
          src: "/panduan/produk-varian-hp.png",
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
          ...HP,
          src: "/panduan/produk-isi-massal-hp.png",
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
    description: "Pilih Modal manual atau Resep, buat bahan baku dari form, dan pahami urutan HPP.",
    audience: ["Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED,
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
          "Ketuk “Tambah bahan”, pilih bahan baku, lalu isi “Jumlah” per porsi.",
          "Bahan belum ada? Ketuk “Buat bahan baku baru”: isi nama, satuan, stok minimum, dan harga beli awal, lalu langsung isi takarannya.",
          "Hasilnya tampil sebagai “HPP … · margin …%”.",
        ],
        description: "Untuk produk bervarian, resep bisa dibuat untuk “Semua varian” atau per varian. Varian tanpa resep sendiri memakai resep “Semua varian”.",
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
    ],
    faqs: [
      {
        question: "Bisakah resep dipakai di usaha ritel atau jasa?",
        answer:
          "Ritel bisa memakai resep bila sudah punya bahan baku. Usaha jasa tidak memakai resep.",
      },
    ],
    relatedSlugs: ["modifier-dan-opsi-tambahan", "produk-dengan-varian", "membaca-laporan-penjualan-dan-margin"],
    keywords: ["hpp", "modal", "harga pokok", "food cost", "resep", "bahan baku", "takaran", "margin", "laba"],
  },
  {
    slug: "modifier-dan-opsi-tambahan",
    category: "produk",
    title: "Modifier: topping, level gula & HPP-nya",
    description: "Buat grup modifier, atur wajib/opsional, harga tambahan, dan HPP per opsi.",
    audience: ["Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED,
    overview:
      "Modifier adalah pilihan tambahan saat memesan, misalnya Level gula (Normal, Less sugar) atau Topping (Boba +Rp5.000). Satu grup bisa dipasang di banyak produk.",
    steps: [
      {
        id: "buat-grup",
        title: "Buat grup modifier",
        steps: [
          "Buka “Produk” › “Kelola” › “Grup modifier”, lalu “Tambah grup modifier”.",
          "Isi “Nama grup” (mis. Level gula).",
          "Pilih “Opsional” atau “Wajib”, dan isi “Maksimal pilihan”.",
          "Tambahkan opsi dengan “Tambah opsi”: nama opsi dan “Harga tambahan” (0 bila gratis).",
        ],
      },
      {
        id: "hpp-opsi",
        title: "HPP per opsi",
        description:
          "Ketuk baris HPP di bawah opsi (mis. “HPP belum diisi”) untuk membuka lembar HPP opsi. Pilih “Modal manual” atau “Resep”. Dengan resep, stok bahan opsi ikut berkurang saat opsi dipilih, dan modalnya masuk laba kotor di laporan.",
        image: {
          ...HP,
          src: "/panduan/modifier-hpp-resep-hp.png",
          alt: "Lembar HPP opsi modifier dengan pilihan Resep",
          caption: "Topping Boba memakai resep 30 g bahan Boba mentah.",
        },
      },
      {
        id: "pasang",
        title: "Pasang di produk",
        description:
          "Di form produk, bagian “Grup modifier”, ketuk “Pilih grup modifier”. Grup baru juga bisa dibuat dari situ lewat “Buat grup modifier baru”.",
      },
      {
        id: "di-kasir",
        title: "Yang terlihat di kasir",
        description:
          "Saat produk diketuk, grup tampil dengan label “Wajib” atau “Opsional”. Kasir tidak bisa menambahkan item sebelum grup wajib dipilih.",
      },
    ],
    relatedSlugs: ["hpp-resep-dan-bahan-baku", "menambah-produk", "mencatat-transaksi-di-kasir"],
    keywords: ["modifier", "topping", "add on", "extra", "level gula", "level pedas", "opsi tambahan"],
  },
  {
    slug: "diskon-dan-promo",
    category: "produk",
    title: "Membuat diskon",
    description: "Diskon persen atau nominal, untuk seluruh nota, kategori, atau produk; otomatis atau dipilih kasir.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 3,
    lastUpdated: UPDATED,
    overview:
      "Ada dua cara memberi potongan: diskon yang dibuat pemilik (promo), dan diskon manual yang diisi kasir saat pembayaran.",
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
          "Di layar “Pembayaran”, ketuk “Diskon, pajak & catatan”. Pilih promo di bagian “Promo”, atau isi diskon manual “Persen”/“Nominal” beserta “Alasan diskon”.",
        callout: {
          type: "warning",
          text: "Diskon terkunci setelah ada pembayaran masuk. Atur diskon sebelum menerima uang.",
        },
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "menambah-produk"],
    keywords: ["diskon", "promo", "potongan", "voucher", "happy hour"],
  },

  // ───────────────────────────── JUALAN ─────────────────────────────
  {
    slug: "mencatat-transaksi-di-kasir",
    category: "jualan",
    title: "Mencatat transaksi di Kasir",
    description: "Tambah produk, pilih varian, catatan item, item cepat, pelanggan, lalu bayar.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_NEW,
    overview:
      "Layar “Kasir” (judul “Transaksi Baru”) adalah tempat mencatat penjualan. Pastikan kasir sudah dibuka; selama belum dibuka, layar hanya menampilkan tombol “Buka Kasir”.",
    prerequisites: ["Kasir sudah dibuka (lihat “Shift kas & tutup kasir harian”).", "Produk sudah dibuat."],
    steps: [
      {
        id: "tambah-produk",
        title: "Tambahkan produk ke pesanan",
        steps: [
          "Ketuk produk. Cari cepat lewat “Cari menu atau SKU”, atau saring dengan chip kategori.",
          "Untuk produk bervarian atau bermodifier, pilih varian dan opsinya, isi “Catatan (opsional)” bila perlu, lalu ketuk “Tambah · …”.",
          "Ubah jumlah dengan tombol − / +. Ketuk “Tambah catatan” di bawah item untuk catatan seperti “kurang manis”.",
        ],
        devices: {
          hp: "Pesanan tampil sebagai bilah “… item” di bawah layar. Ketuk “Lihat” untuk membuka layar “Pesanan” berisi item, ringkasan, serta tombol Simpan dan Bayar.",
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
          "Pilih jenis pesanan, mis. “Makan di tempat” atau “Bawa pulang”. Pilihan ini hanya muncul bila lebih dari satu jenis diaktifkan di Pengaturan › “Transaksi” › “Jenis pesanan”.",
          "“Pilih pelanggan” untuk mencatat pelanggan (poin member dan kasbon butuh ini). Pelanggan baru bisa dibuat lewat “Tambah pelanggan”.",
          "“Pilih meja” hanya muncul untuk jenis pesanan “Makan di tempat” dan bila outlet punya meja aktif. Bila jenis diganti ke “Bawa pulang”, meja yang sudah dipilih otomatis dilepas.",
        ],
        callout: {
          type: "info",
          title: "Wajib nama pelanggan",
          text: "Bila pemilik menyalakan Pengaturan › “Transaksi” › “Wajib nama pelanggan”, menekan “Bayar” atau “Simpan” tanpa pelanggan terpilih memunculkan isian “Nama pelanggan”. Isi namanya lalu ketuk “Lanjut”.",
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
          "“Bayar …” — buka layar pembayaran. Baca “Pembayaran: tunai, QRIS, kartu, transfer”. Bila kasir belum dibuka, muncul lembar Buka kasir dan pembayaran langsung dilanjutkan setelahnya.",
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
        answer: "Belum. Diskon diberikan per nota di layar Pembayaran, atau lewat diskon kategori/produk yang dibuat pemilik.",
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "mencatat-pesanan-dan-denah-meja", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["kasir", "transaksi", "jualan", "pos", "keranjang", "checkout", "item cepat", "scan barcode", "bawa pulang", "takeaway"],
  },
  {
    slug: "mencatat-pesanan-dan-denah-meja",
    category: "jualan",
    title: "Pesanan berjalan & meja",
    description: "Simpan pesanan untuk dibayar nanti, ubah, pisah pesanan, batalkan, dan kelola meja.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_NEW,
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
        steps: [
          "Ketuk menu ⋯ di kartu, lalu “Ubah”. Pesanan terbuka di Kasir dengan judul “Ubah pesanan …”.",
          "Tambah atau kurangi item, lalu ketuk “Simpan perubahan” dan konfirmasi “Simpan perubahan pesanan?”. Item tambahan dikirim ke dapur dengan tanda TAMBAHAN.",
          "Untuk menagih, ketuk “Bayar” di kartu pesanan.",
        ],
        callout: {
          type: "info",
          text: "Mengurangi item atau membatalkan pesanan bisa meminta PIN pemilik bila “PIN pemilik untuk batal & refund” aktif di Pengaturan › “Transaksi”.",
        },
      },
      {
        id: "pisah-pesanan",
        title: "Pisah pesanan (tagihan terpisah)",
        steps: [
          "Di kartu pesanan, ketuk ⋯ › “Pisah pesanan”.",
          "Tekan + pada item yang mau dipindah ke tagihan baru. Total “Pesanan asal” dan “Pesanan baru” berubah langsung.",
          "Ketuk “Pisahkan”. Pesanan baru mendapat nomor sendiri dan bisa dibayar dengan cara berbeda.",
        ],
        points: [
          "Pajak, biaya layanan, dan diskon persen dihitung ulang untuk tiap pesanan. Diskon nominal tetap di pesanan asal.",
          "Tiket dapur ikut berpindah ke pesanan baru.",
        ],
        image: {
          ...HP,
          src: "/panduan/pisah-pesanan-hp.png",
          alt: "Lembar Pisah pesanan dengan tombol Pindah per item",
          caption: "Pilih jumlah yang dipindah ke pesanan baru.",
        },
      },
      {
        id: "batalkan",
        title: "Membatalkan pesanan",
        description:
          "Ketuk ⋯ › “Batalkan pesanan”, isi “Alasan” (wajib), lalu “Batalkan”. Tiket dapurnya ikut dihapus.",
      },
      {
        id: "meja",
        title: "Layar Meja",
        points: [
          "Saring dengan tombol “Area: Semua (…)” dan segmen “Semua / Kosong / Terisi”.",
          "Tambah meja lewat “Tambah meja” (ikon + di HP): isi “Nama meja”, “Area” (atau “Buat area baru”), dan “Kapasitas (kursi)”.",
          "Kelola area lewat tombol ⋯ di kanan atas (“Menu meja”) › “Kelola area”. Tombol + di paling kanan untuk “Tambah meja”. Keduanya hanya terlihat oleh pemilik.",
          "Ketuk meja kosong lalu “Mulai pesanan” untuk membuka Kasir dengan meja itu terpilih.",
          "Ketuk meja terisi untuk melihat “Lama duduk”, “Tagihan berjalan”, serta tombol “Ubah” dan “Bayar …”.",
        ],
        devices: {
          hp: "Rincian meja terbuka sebagai lembar dari bawah layar.",
          tablet: "Rincian meja terbuka sebagai dialog di tengah layar. Tutup dengan ✕ atau ketuk di luar dialog.",
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
    relatedSlugs: ["layar-dapur", "menerima-pembayaran-qris-dan-tunai", "mencatat-transaksi-di-kasir"],
    keywords: ["open bill", "pesanan", "meja", "denah", "area", "split bill", "pisah tagihan", "hold order", "simpan pesanan"],
  },
  {
    slug: "layar-dapur",
    category: "jualan",
    title: "Layar dapur",
    description: "Tiket masuk, dimasak, siap, dan sudah diambil — untuk dapur dan pelayan.",
    audience: ["Dapur", "Kasir"],
    readMinutes: 3,
    lastUpdated: UPDATED_NEW,
    overview:
      "Layar dapur menampilkan item yang perlu dimasak. Hanya produk dengan “Kirim ke dapur” yang masuk ke sini. Fitur “Layar dapur” diaktifkan pemilik di Pengaturan › “Jenis usaha” dan termasuk paket Pro. Tiket dapur juga bisa dicetak ke printer dapur; baca “Menyambungkan printer struk & dapur”.",
    steps: [
      {
        id: "kolom",
        title: "Tiga kolom: Masuk, Dimasak, Siap",
        description:
          "Tiket baru muncul di “Masuk”, lengkap dengan meja atau nomor antrean, jenis pesanan, catatan, dan lama menunggu. Item tambahan diberi tanda TAMBAHAN.",
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
          "Ketuk “Mulai” pada item, atau “Masak semua” untuk seluruh tiket.",
          "Ketuk “Siap” pada item, atau “Semua siap”.",
          "Setelah diambil pelayan, ketuk “Sudah diambil”.",
        ],
        points: ["Salah ketuk? Gunakan “Batalkan langkah”."],
      },
      {
        id: "pelayan",
        title: "Untuk pelayan dan kasir",
        description:
          "Bila ada pesanan siap, Kasir menampilkan “Pesanan siap disajikan”. Di “Pesanan” › “Status dapur”, antar ke tamu lalu ketuk “Tandai sudah diantar”.",
      },
      {
        id: "perangkat-khusus",
        title: "Perangkat khusus dapur",
        description:
          "Tablet di dapur bisa disetel sebagai “Layar dapur” saat setup perangkat. Perangkat itu langsung membuka layar dapur penuh dan layarnya dijaga tetap menyala. Pesanan dari QR pelanggan juga bisa dilihat lewat tombol “Pesanan QR” di layar dapur.",
      },
    ],
    relatedSlugs: ["setup-outlet-dan-perangkat", "mencatat-pesanan-dan-denah-meja", "karyawan-dan-pin"],
    keywords: ["dapur", "kitchen", "kds", "bar", "tiket", "chef", "masak"],
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
      "Menu “Pesan & Bayar Mandiri” sudah tersedia untuk bisnismu. Bila halaman menulis “belum diaktifkan untuk bisnis ini”, hubungi Sissi.",
      "Produk sudah dibuat. Untuk QR per meja, meja juga sudah dibuat di menu Meja.",
    ],
    steps: [
      {
        id: "aktifkan",
        title: "Aktifkan pesanan dari QR",
        steps: [
          "Buka Pengaturan › “Penjualan” › “Pesan & Bayar Mandiri”.",
          "Nyalakan “Terima pesanan dari QR”.",
          "Atur kartu-kartu di bawahnya (lihat langkah berikut), lalu ketuk “Simpan”.",
        ],
        callout: {
          type: "info",
          text: "Di paket Gratis, halaman ini menampilkan “Fitur Pro” dengan tombol “Lihat Langganan”. Baca “Langganan: paket Gratis & Pro”.",
        },
      },
      {
        id: "mode-meja",
        title: "Pilih cara pelanggan menentukan meja",
        description: "Di kartu “Meja”, pilih salah satu:",
        points: [
          "“QR per meja” (bawaan) — tiap meja punya QR sendiri, meja terisi otomatis. QR outlet dipakai untuk pesanan tanpa meja.",
          "“Pilih meja” — cukup satu QR outlet; pelanggan memilih nomor meja saat makan di tempat.",
          "“Tanpa meja” — satu QR outlet; pelanggan mengambil pesanan di konter dengan nomor pesanan.",
          "Di “Jenis pesanan yang bisa dipilih”, aktifkan Makan di tempat, Bawa pulang, atau keduanya (minimal satu).",
        ],
      },
      {
        id: "pembayaran",
        title: "Pembayaran",
        description:
          "Pilih “Bayar di kasir”: kasir menerima atau menolak pesanan, lalu menagih lewat Bayar seperti biasa. Pilihan “Bayar online” (QRIS di HP pelanggan) belum tersedia; selama belum diaktifkan, semua pesanan dibayar di kasir.",
      },
      {
        id: "alur",
        title: "Alur pesanan setelah dibayar",
        points: [
          "“Pelanggan memantau status pesanan” — bila menyala, halaman pelanggan menampilkan status sampai pesanan siap. Bila mati, halaman berhenti setelah pesanan lunas.",
          "Bila Layar dapur aktif, status “Sedang disiapkan” dan “Siap” berubah otomatis dari layar dapur. Tanpa layar dapur, kasir mengetuk “Tandai siap” saat pesanan siap.",
          "“Pesanan sampai ke pelanggan”: “Diambil pelanggan” (pelanggan menyebut nomor pesanan) atau “Diantar ke meja” (pelayan mengantar pesanan makan di tempat; bawa pulang tetap diambil).",
        ],
      },
      {
        id: "aturan",
        title: "Aturan pesanan",
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
          "Di kartu “Kode QR pesanan”, ketuk “Kelola QR” (atau tombol “Kelola QR” di layar Pesanan QR).",
          "Untuk QR per meja, ketuk “Buat … QR” untuk membuat QR semua meja sekaligus, atau “Buat QR” per meja. Kode muncul setelah perangkat online dan tersinkron (status “Menunggu sinkron” lalu “Aktif”).",
          "Ketuk “Lihat” pada QR, lalu “Cetak” untuk mencetak ke printer struk perangkat ini, atau “Bagikan” untuk mengirim gambar QR (mis. untuk dicetak di percetakan).",
          "Tempel QR meja di tiap meja, dan QR outlet di kasir/konter.",
        ],
        callout: {
          type: "warning",
          text: "“Ganti kode” membuat QR lama langsung tidak berlaku. Gunakan bila QR hilang atau disalahgunakan, lalu cetak dan tempel QR baru.",
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
        answer: "QR itu sudah diganti atau dinonaktifkan. Cetak QR terbaru dari “Kelola QR” dan tempel ulang.",
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
        description: "Pesanan dibagi dalam tiga segmen:",
        points: [
          "“Menunggu” — pesanan yang belum dibayar. Kartu menunjukkan nomor, meja (atau “Bawa pulang” / “Tanpa meja”), jumlah item, dan sisa waktu sebelum kedaluwarsa.",
          "“Diproses” — sudah lunas dan sedang disiapkan atau siap.",
          "“Selesai” — pesanan selesai, ditolak, dibatalkan, atau kedaluwarsa dalam 24 jam terakhir.",
        ],
      },
      {
        id: "terima-bayar",
        title: "Terima & Bayar",
        steps: [
          "Tanyakan nomor pesanan pelanggan, lalu cari kartunya di segmen “Menunggu”.",
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
          "Tanpa layar dapur, ketuk “Tandai siap” di segmen “Diproses” saat pesanan siap. Dapur juga bisa menekannya.",
          "Pesanan “Siap” ditutup otomatis setelah 60 menit.",
        ],
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
    description: "Uang pas dan kembalian, QRIS statis, bayar dengan beberapa cara, dan struk.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED_NEW,
    overview:
      "Layar “Pembayaran” muncul setelah menekan “Bayar”. Tunai selalu tersedia; QRIS, Kartu, Transfer, dan Kasbon hanya muncul bila diaktifkan pemilik.",
    steps: [
      {
        id: "tunai",
        title: "Bayar tunai",
        steps: [
          "Di “Cara bayar”, pilih “Tunai”.",
          "Ketuk “Uang pas” atau salah satu nominal saran, atau “Nominal lain” untuk mengetik sendiri.",
          "Periksa “Kembalian”, lalu ketuk “Selesaikan pembayaran”.",
        ],
        image: {
          ...HP,
          src: "/panduan/bayar-hp.png",
          alt: "Layar Pembayaran dengan pilihan Tunai, QRIS, Kartu, Transfer, Kasbon",
          caption: "Cara bayar dan nominal cepat.",
        },
      },
      {
        id: "qris",
        title: "Bayar dengan QRIS",
        steps: [
          "Pilih “QRIS”, lalu ketuk “Tampilkan QRIS · …”.",
          "Minta pelanggan memindai kode dan mengetik nominal yang tertera.",
          "Setelah dana masuk di rekening atau aplikasi merchant, ketuk “Sudah dibayar”.",
        ],
        callout: {
          type: "warning",
          text: "QRIS di Sissi adalah QRIS statis: nominal tidak tertanam di kode dan aplikasi tidak mengecek dana masuk. Pastikan dana benar-benar masuk sebelum menekan “Sudah dibayar”.",
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
        title: "Bayar dengan beberapa cara (split)",
        steps: [
          "Pilih cara bayar pertama, ketuk “Ubah nominal”, lalu isi bagian yang dibayar.",
          "Ketuk “Tambah pembayaran · …”.",
          "Pada “Bayar sisa dengan”, pilih cara bayar berikutnya sampai “Sisa tagihan” habis.",
          "Ketuk “Selesaikan pembayaran”.",
        ],
        points: ["Salah masukkan? Hapus dengan “Hapus pembayaran”. Di Riwayat, transaksi ini tercatat sebagai “Split”."],
      },
      {
        id: "selesai",
        title: "Setelah berhasil",
        description:
          "Layar “Pembayaran berhasil” menyediakan “Cetak struk” (berubah menjadi “Cetak ulang” setelah dicetak), “Kirim struk via WhatsApp”, “Lihat detail”, dan “Transaksi baru”.",
        points: [
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
          "Bila terbaca, muncul “QRIS statis terbaca” beserta nama merchant, kota, dan NMID. Periksa, lalu ketuk “Simpan”.",
        ],
        points: [
          "QRIS dinamis (sekali pakai untuk satu transaksi) ditolak; gunakan QRIS statis toko.",
          "“Isi manual (lanjutan)” hanya untuk kasus khusus, mis. memasukkan kode QRIS sebagai teks.",
          "Di halaman yang sama, aktifkan “Kartu” dan “Transfer” (isi rekening tujuan).",
        ],
        image: {
          ...HP,
          src: "/panduan/qris-pengaturan-hp.png",
          alt: "Pengaturan Metode pembayaran dengan pratinjau QRIS statis terbaca",
          caption: "QRIS terbaca dari gambar, lengkap dengan nama merchant dan NMID.",
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
    keywords: ["bayar", "pembayaran", "qris", "tunai", "cash", "kembalian", "edc", "debit", "transfer", "split payment", "struk", "whatsapp"],
  },
  {
    slug: "kasbon-pelanggan",
    category: "jualan",
    title: "Kasbon (bayar nanti) & pelunasan",
    description: "Catat utang pelanggan, atur jatuh tempo, tagih via WhatsApp, dan terima pelunasan.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED_NEW,
    overview:
      "Kasbon mencatat transaksi yang belum dibayar penuh atas nama pelanggan. Fitur ini mati secara bawaan; pemilik menyalakannya di Pengaturan › “Transaksi” › “Izinkan kasbon”. Kasbon baru termasuk paket Pro (pilihan “Kasbon” bertanda “PRO” di paket Gratis), tetapi kasbon lama selalu bisa dilunasi.",
    steps: [
      {
        id: "catat",
        title: "Mencatat kasbon",
        steps: [
          "Di layar Pembayaran, pilih “Kasbon”. (Bila pelanggan membayar sebagian dulu, masukkan pembayaran itu terlebih dahulu.)",
          "Ketuk “Simpan sebagai kasbon · …”.",
          "Di lembar “Simpan sebagai kasbon?”, isi “Nama pelanggan” bila belum dipilih, dan “Jatuh tempo” bila perlu.",
          "Ketuk “Simpan kasbon”.",
        ],
      },
      {
        id: "pantau",
        title: "Memantau kasbon",
        points: [
          "“Riwayat” › tab “Belum lunas” berisi semua kasbon, dengan tanda “Jatuh tempo hari ini” atau “Terlambat … hari”.",
          "Notifikasi “Kasbon jatuh tempo” muncul di menu Notifikasi.",
          "Di detail pelanggan, bagian “Kasbon berjalan” merangkum total utangnya.",
        ],
        image: {
          ...HP,
          src: "/panduan/pelanggan-kasbon-hp.png",
          alt: "Detail pelanggan dengan kasbon berjalan dan tombol Lunasi semua",
          caption: "Kasbon berjalan di detail pelanggan.",
        },
      },
      {
        id: "lunasi",
        title: "Menerima pelunasan",
        steps: [
          "Buka transaksinya dari “Riwayat”, lalu ketuk “Lunasi …”. Atau dari detail pelanggan, ketuk “Lunasi semua”.",
          "Pilih lunas penuh atau “Sebagian” (isi “Nominal dibayar”), pilih “Cara bayar”.",
          "Ketuk “Terima …”. Centang “Cetak bukti pelunasan” bila perlu.",
        ],
        points: ["Untuk menagih, ketuk “Ingatkan via WA” di detail pelanggan."],
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "pelanggan-dan-member", "membaca-laporan-penjualan-dan-margin"],
    keywords: ["kasbon", "utang", "hutang", "piutang", "bon", "bayar nanti", "tempo", "pelunasan"],
  },
  {
    slug: "membatalkan-transaksi-void-refund",
    category: "jualan",
    title: "Membatalkan transaksi (void & refund)",
    description: "Batalkan transaksi dari Riwayat dengan alasan, persetujuan PIN pemilik, dan pengembalian uang.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 3,
    lastUpdated: UPDATED,
    overview:
      "Transaksi yang sudah dibayar tidak dihapus, tetapi dibatalkan dengan catatan. Uang yang sudah diterima dicatat kembali ke pelanggan, dan stok dikembalikan.",
    steps: [
      {
        id: "buka-transaksi",
        title: "Buka transaksinya",
        description:
          "Buka “Riwayat”, cari dengan “Cari no. struk / pelanggan”, lalu ketuk transaksinya. Tombol “Refund” tersedia untuk transaksi lunas atau dibayar sebagian; “Batalkan” untuk yang belum dibayar.",
      },
      {
        id: "pilih-jenis",
        title: "Pilih jenis dan alasan",
        steps: [
          "Pilih “Refund penuh” atau “Void”.",
          "Pilih alasan: “Salah input”, “Pelanggan batal”, “Pelanggan komplain”, atau “Transaksi ganda”, dan tambahkan keterangan bila perlu.",
          "Pada “Kembalikan lewat”, pilih “Sesuai pembayaran” atau cara lain.",
        ],
      },
      {
        id: "persetujuan",
        title: "Persetujuan pemilik",
        description:
          "Bila dilakukan kasir, pemilik perlu memasukkan PIN untuk menyetujui. Di detail transaksi tercatat “Disetujui …”.",
        callout: {
          type: "tip",
          text: "Pemilik bisa menerima peringatan di HP setiap ada void atau refund. Baca “Notifikasi di aplikasi & peringatan pemilik”.",
        },
      },
    ],
    faqs: [
      {
        question: "Muncul “perubahan ditolak” setelah membatalkan.",
        answer:
          "Server menolak pembatalan bila perangkat ini belum menerima semua pembayaran transaksi itu dari perangkat lain. Tunggu sinkron selesai, lalu ulangi pembatalan.",
      },
    ],
    relatedSlugs: ["menerima-pembayaran-qris-dan-tunai", "perubahan-ditolak", "notifikasi"],
    keywords: ["void", "refund", "batal", "retur", "pengembalian", "salah input"],
  },

  // ───────────────────────────── SHIFT ─────────────────────────────
  {
    slug: "shift-kas-dan-tutup-kasir-harian",
    category: "shift",
    title: "Shift kas & tutup kasir harian",
    description: "Buka kasir dengan kas awal, catat kas masuk/keluar, hitung uang, dan cetak laporan tutup kasir.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 6,
    lastUpdated: UPDATED,
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
          ...HP,
          src: "/panduan/buka-kasir-hp.png",
          alt: "Lembar Buka kasir dengan isian Kas awal di laci",
          caption: "Isi kas awal sebelum mulai berjualan.",
        },
      },
      {
        id: "kas-masuk-keluar",
        title: "Catat kas masuk dan kas keluar",
        description:
          "Setiap uang yang diambil atau ditambahkan ke laci di luar penjualan harus dicatat, agar hitungan akhir cocok.",
        steps: [
          "Di “Shift saat ini”, ketuk “Kas Masuk/Keluar”.",
          "Pilih “Kas Masuk” atau “Kas Keluar”, isi “Nominal”.",
          "Pilih “Kategori” (mis. “Beli bahan”, “Operasional”, “Setor ke pemilik”) dan tulis “Catatan”.",
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
          "Langkah 2: periksa “Ringkasan shift”. Bila ada selisih, isi “Alasan selisih”.",
          "Konfirmasi “Tutup kasir sekarang?”. Shift yang sudah ditutup tidak bisa dibuka lagi.",
        ],
        image: {
          ...HP,
          src: "/panduan/tutup-kasir-hp.png",
          alt: "Layar Tutup Kasir langkah 1, hitung per pecahan",
          caption: "Hitung uang fisik per pecahan.",
        },
      },
      {
        id: "laporan",
        title: "Laporan tutup kasir",
        description:
          "Setelah ditutup, muncul “Laporan tutup kasir” berisi penjualan, metode pembayaran, kas masuk/keluar, uang fisik, dan selisih. Ketuk “Cetak” untuk mencetaknya.",
        points: [
          "Pemilik melihat semua laporan di “Lainnya” › “Tutup Kasir” (Riwayat Tutup Kasir).",
        ],
      },
      {
        id: "pengaturan-pemilik",
        title: "Pengaturan pemilik",
        points: [
          "Pengaturan › “Transaksi” › “Tutup kasir tanpa melihat angka sistem”: kasir menghitung tanpa melihat jumlah seharusnya; pemilik yang memeriksa selisihnya.",
          "Pengaturan › “Kasir & jadwal shift”: “Daftar shift” (nama dan jam, tampil di Beranda) dan “Batas lama shift” (peringatan bila shift berjalan terlalu lama).",
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
    keywords: ["shift", "buka kasir", "tutup kasir", "kas awal", "modal laci", "petty cash", "kas keluar", "selisih", "laporan z", "blind close"],
  },

  // ───────────────────────────── STOK ─────────────────────────────
  {
    slug: "stok-barang-dan-stok-masuk",
    category: "stok",
    title: "Stok barang: stok masuk, penyesuaian, stok menipis",
    description: "Pantau stok, catat barang datang, koreksi stok hilang/rusak, dan atur stok minimum.",
    audience: ["Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED,
    overview:
      "Stok hanya dihitung untuk produk yang “Lacak stok”-nya menyala. Stok berkurang saat pesanan ditagih, bukan saat pesanan disimpan. Semua menu stok ada di “Inventori” (tidak tersedia untuk usaha jasa dan penyewaan).",
    steps: [
      {
        id: "hub",
        title: "Inventori",
        description:
          "Menu “Inventori” berisi “Stok barang”, “Bahan baku”, “Stok opname”, “Pembelian”, “Supplier”, dan “Transfer stok”, ditambah kartu “Saran belanja ke pemasok” dan “Gerakan stok terakhir”.",
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
          "Buka “Stok barang”, pilih barang, lalu “Stok masuk”.",
          "Isi “Jumlah masuk” dan “Harga beli per satuan”.",
          "Nyalakan “Jadikan harga modal” bila harga beli ini mau dipakai sebagai HPP.",
        ],
        points: ["Untuk pembelian lewat pemasok yang dicatat lengkap, gunakan “Pembelian” (PO)."],
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
      },
    ],
    relatedSlugs: ["pembelian-po-dan-supplier", "stok-opname", "hpp-resep-dan-bahan-baku"],
    keywords: ["stok", "inventori", "stock", "barang masuk", "restok", "stok minimum", "stok habis", "penyesuaian"],
  },
  {
    slug: "pembelian-po-dan-supplier",
    category: "stok",
    title: "Pembelian (PO), supplier & saran belanja",
    description: "Buat purchase order, kirim ke supplier lewat WhatsApp, terima barang, dan pakai saran belanja.",
    audience: ["Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED,
    overview:
      "Pembelian (purchase order/PO) mencatat barang yang dipesan ke supplier. Saat barang diterima, stok dan harga rata-rata ikut diperbarui.",
    steps: [
      {
        id: "supplier",
        title: "Tambah supplier",
        description:
          "Buka “Inventori” › “Supplier” › “Supplier baru”. Isi “Nama supplier” dan “No. HP / WhatsApp”; email, alamat, dan catatan opsional.",
      },
      {
        id: "buat-po",
        title: "Buat PO",
        steps: [
          "Buka “Pembelian” › “PO baru”, lalu pilih supplier.",
          "Ketuk “Tambah barang”, isi “Jumlah” dan “Harga per …”.",
          "Isi “Perkiraan tiba (opsional)” bila tahu.",
          "Ketuk “Simpan draf”, atau “Simpan & pesan” bila sudah dipesan.",
          "Kirim rinciannya ke supplier lewat “Kirim ke WhatsApp” atau “Bagikan”.",
        ],
      },
      {
        id: "terima",
        title: "Terima barang",
        description:
          "Buka PO, ketuk “Terima barang”. Barang boleh diterima sebagian; gunakan “Terima semua” bila lengkap. Status berubah menjadi “Diterima sebagian” atau “Diterima”.",
      },
      {
        id: "saran-belanja",
        title: "Saran belanja ke pemasok",
        description:
          "Kartu ini di halaman Inventori mendaftar barang yang perlu dibeli: stoknya di bawah minimum, atau diperkirakan tidak cukup untuk 7 hari ke depan berdasarkan pemakaian 30 hari terakhir. Jumlah saran dan pemasoknya diambil dari pembelian terakhir.",
        points: [
          "“Buat draf PO per supplier” — membuat draf PO sekaligus, satu per supplier.",
          "“Salin daftar belanja” — menyalin daftar untuk ditempel di chat.",
        ],
      },
    ],
    relatedSlugs: ["stok-barang-dan-stok-masuk", "stok-opname", "transfer-stok"],
    keywords: ["po", "purchase order", "pembelian", "supplier", "pemasok", "belanja", "restock", "saran belanja"],
  },
  {
    slug: "stok-opname",
    category: "stok",
    title: "Stok opname",
    description: "Hitung stok fisik, lihat selisih, lalu posting hasilnya.",
    audience: ["Pemilik"],
    readMinutes: 3,
    lastUpdated: UPDATED,
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
        image: {
          ...HP,
          src: "/panduan/opname-hp.png",
          alt: "Layar Stok opname dengan ringkasan selisih dan tombol Posting",
          caption: "Ringkasan: lebih, kurang, dan nilai bersih.",
        },
      },
      {
        id: "posting",
        title: "Posting",
        description:
          "Periksa “Ringkasan”, lalu ketuk “Posting”. Stok disesuaikan dengan hasil hitung. Barang yang belum dihitung tidak diubah. Bila batal, ketuk “Batalkan opname”.",
        callout: {
          type: "tip",
          text: "Opname bisa dihentikan lalu dilanjutkan lewat “Lanjutkan opname”.",
        },
      },
    ],
    relatedSlugs: ["stok-barang-dan-stok-masuk", "pembelian-po-dan-supplier"],
    keywords: ["opname", "stock opname", "hitung stok", "audit stok", "selisih stok"],
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
    title: "Laporan penjualan & laba kotor",
    description: "Omzet, laba kotor, produk terjual, jam ramai, per kasir, riwayat, dan ekspor CSV.",
    audience: ["Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_NEW,
    overview:
      "Menu “Laporan” (khusus pemilik) merangkum penjualan per periode. Untuk melihat transaksi satu per satu, gunakan “Riwayat”.",
    prerequisites: ["Harga modal (HPP) produk sudah diisi agar laba kotor akurat."],
    steps: [
      {
        id: "periode",
        title: "Pilih periode dan outlet",
        description:
          "Pilih “Hari ini”, “7 hari terakhir”, “30 hari terakhir”, atau “Pilih tanggal…” (maks 92 hari). Bila punya beberapa outlet, pilih “Semua outlet” atau satu outlet.",
      },
      {
        id: "ringkasan",
        title: "Ringkasan",
        description:
          "Tab “Ringkasan” menampilkan “Omzet”, “Transaksi”, “Rata-rata/transaksi”, “Laba kotor”, diskon, pajak, biaya layanan, “Piutang kasbon”, perbandingan dengan periode lalu, grafik omzet, “Per metode bayar”, dan “Wawasan periode ini”.",
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
        title: "Produk terjual, jam ramai, per kasir",
        points: [
          "“Produk terjual” — urutkan “Terlaris” atau “Omzet terbesar”.",
          "“Jam ramai” — “Jam tersibuk” dan “Hari tersibuk”, selalu dari 30 hari terakhir. Berguna untuk jadwal karyawan.",
          "“Per kasir” — penjualan per kasir.",
        ],
        callout: {
          type: "info",
          text: "Tab “Produk terjual” dan “Jam ramai” termasuk paket Pro. Ringkasan dan riwayat tetap tersedia di paket Gratis.",
        },
      },
      {
        id: "riwayat-ekspor",
        title: "Riwayat penjualan dan ekspor",
        description:
          "“Riwayat” (Riwayat Penjualan) berisi semua transaksi dengan tab “Semua”, “Lunas”, “Belum lunas”, “Batal”, serta saringan kasir, metode, dan periode. Detail transaksi bisa dicetak ulang, dikirim WA, atau dipesan ulang.",
        points: ["“Ekspor CSV” tersedia di Laporan dan Riwayat. File CSV bisa dibuka di Excel atau Google Sheets."],
      },
    ],
    faqs: [
      {
        question: "Apakah laporan bisa dikirim otomatis ke email?",
        answer: "Belum. Ekspor CSV lalu bagikan secara manual.",
      },
      {
        question: "Di mana laporan tutup kasir?",
        answer: "Di Laporan bagian “Laporan tutup kasir”, atau “Lainnya” › “Tutup Kasir”.",
      },
    ],
    relatedSlugs: ["hpp-resep-dan-bahan-baku", "shift-kas-dan-tutup-kasir-harian", "membatalkan-transaksi-void-refund"],
    keywords: ["laporan", "report", "omzet", "laba", "profit", "margin", "terlaris", "jam ramai", "csv", "excel", "riwayat"],
  },

  // ───────────────────────────── TIM ─────────────────────────────
  {
    slug: "karyawan-dan-pin",
    category: "tim",
    title: "Karyawan, peran & PIN",
    description: "Tambah karyawan, pilih peran Kasir/Dapur, atur PIN, dan kunci kasir.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 4,
    lastUpdated: UPDATED,
    overview:
      "Karyawan tidak perlu akun email sendiri. Mereka memakai perangkat yang sudah dimasuki pemilik, lalu membuka kasir dengan PIN 6 digit masing-masing.",
    steps: [
      {
        id: "tambah",
        title: "Tambah karyawan",
        steps: [
          "Buka “Tim” › “Karyawan” › “Tambah karyawan”.",
          "Isi “Nama karyawan”; No. HP dan email opsional.",
          "Pilih “Peran”: “Kasir” (transaksi, pesanan, riwayat, pelanggan, absen) atau “Dapur” (layar dapur dan pesanan; untuk usaha kuliner atau bila fitur dapur aktif).",
          "Simpan.",
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
        points: ["Pemilik juga bisa “Atur PIN saya” untuk menyetujui void, refund, dan aksi kasir lainnya."],
        image: {
          ...HP,
          src: "/panduan/pin-karyawan-hp.png",
          alt: "Lembar Buat PIN baru untuk karyawan",
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
          "Lama kunci otomatis diatur di Pengaturan › “Perangkat ini” › “Kunci kasir otomatis”.",
          "Terlalu sering salah PIN membuat percobaan dikunci sementara. Lupa PIN? Pemilik bisa menggantinya.",
        ],
        callout: {
          type: "warning",
          text: "Tombol “Keluar” di layar kunci mengeluarkan akun dari perangkat, bukan sekadar ganti karyawan.",
        },
      },
    ],
    relatedSlugs: ["absensi-karyawan", "gaji-dan-slip-gaji", "mengenal-menu-aplikasi"],
    keywords: ["karyawan", "staf", "pegawai", "pin", "peran", "role", "kasir", "dapur", "kunci", "lock"],
  },
  {
    slug: "absensi-karyawan",
    category: "tim",
    title: "Absen karyawan",
    description: "Absen masuk dan pulang dengan PIN, aturan jam kerja, dan koreksi manual.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 3,
    lastUpdated: UPDATED_NEW,
    overview: "Absen dicatat di perangkat kasir dengan PIN, sehingga tidak perlu alat absen terpisah. Kehadiran termasuk paket Pro.",
    steps: [
      {
        id: "absen",
        title: "Absen masuk dan pulang",
        steps: [
          "Buka “Kehadiran” (atau pintasan “Absen” di Beranda).",
          "Ketuk “Absen masuk” atau “Absen pulang”.",
          "Pilih nama, lalu masukkan PIN.",
        ],
        points: ["Karyawan tanpa PIN ditandai “Belum punya PIN” dan belum bisa absen sendiri."],
      },
      {
        id: "aturan",
        title: "Aturan jam kerja (pemilik)",
        description:
          "Buka “Aturan jam kerja”: isi “Jam mulai”, “Jam selesai”, “Toleransi terlambat (menit)”, dan “Hari libur mingguan”. Aturan ini dipakai untuk status terlambat, lembur, dan libur.",
      },
      {
        id: "manual",
        title: "Absen manual dan koreksi (pemilik)",
        description:
          "Gunakan “Absen manual” untuk mencatat izin, sakit, cuti, atau lupa absen. Isi karyawan, tanggal, status, jam, dan “Alasan perubahan”, lalu “Simpan absen”.",
      },
    ],
    relatedSlugs: ["karyawan-dan-pin", "gaji-dan-slip-gaji"],
    keywords: ["absen", "absensi", "presensi", "kehadiran", "terlambat", "izin", "sakit", "cuti"],
  },
  {
    slug: "gaji-dan-slip-gaji",
    category: "tim",
    title: "Gaji & slip gaji",
    description: "Atur gaji per karyawan, terbitkan slip dari data kehadiran, dan tandai sudah dibayar.",
    audience: ["Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED_NEW,
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
      },
      {
        id: "bayar",
        title: "Tandai sudah dibayar",
        description:
          "Ketuk “Tandai sudah dibayar”. Bila dibayar dari laci, centang “Bayar tunai dari laci kasir” agar tercatat sebagai kas keluar shift.",
        callout: { type: "warning", text: "Status dibayar tidak dapat dibatalkan." },
      },
    ],
    relatedSlugs: ["absensi-karyawan", "karyawan-dan-pin", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["gaji", "payroll", "slip gaji", "upah", "lembur", "potongan"],
  },

  // ───────────────────────────── JASA ─────────────────────────────
  {
    slug: "order-servis-dan-antrean",
    category: "jasa",
    title: "Order servis & antrean",
    description: "Catat order servis, pantau antrean, terima DP, dan serahkan ke pelanggan.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_NEW,
    overview:
      "Untuk usaha jasa (bengkel, servis HP, laundry, salon, percetakan, dan lainnya). Isian order menyesuaikan jenis usaha, misalnya plat nomor untuk bengkel atau berat untuk laundry. Order servis baru termasuk paket Pro; order yang sudah berjalan tetap bisa diselesaikan dan ditagih.",
    steps: [
      {
        id: "order-baru",
        title: "Buat order servis",
        steps: [
          "Buka “Antrean” › “Order baru”.",
          "Isi data pelanggan (nama, No. HP) dan “Data order” sesuai jenis usaha.",
          "“Tambah layanan” dari katalog, atau “Buat layanan baru” langsung di sini.",
          "Isi “Estimasi selesai” dan pilih petugas (mis. teknisi).",
          "Pilih pembayaran: “Saat diambil” atau “Bayar sekarang” (lunas atau uang muka/DP).",
          "Ketuk “Simpan” atau “Simpan & cetak”.",
        ],
        image: {
          ...HP,
          src: "/panduan/servis-order-baru-hp.png",
          alt: "Form Order servis baru untuk bengkel",
          caption: "Contoh order bengkel: plat nomor, kilometer, merek & tipe.",
        },
      },
      {
        id: "antrean",
        title: "Pantau antrean",
        description:
          "Status order: “Diterima” → “Dikerjakan” → “Siap diambil” → “Diambil”. Majukan dengan tombol “Kerjakan”, “Selesai”, dan “Serahkan”. Order yang lewat estimasi ditandai “Terlambat”.",
      },
      {
        id: "serahkan",
        title: "Serahkan dan lunasi",
        description:
          "Saat “Serahkan” dan masih ada sisa tagihan, pilih “Bayar dulu” atau “Serahkan sebagai kasbon”.",
      },
      {
        id: "batal",
        title: "Batalkan order",
        description:
          "Ketuk “Batalkan order” dan tulis alasan. Bila sudah ada uang muka, uang itu dicatat dikembalikan ke pelanggan. Kasir mungkin perlu PIN pemilik.",
      },
    ],
    relatedSlugs: ["kasbon-pelanggan", "menerima-pembayaran-qris-dan-tunai", "karyawan-dan-pin"],
    keywords: ["servis", "service", "jasa", "bengkel", "laundry", "salon", "antrean", "teknisi", "dp", "uang muka"],
  },

  // ───────────────────────────── SEWA ─────────────────────────────
  {
    slug: "penyewaan-booking-dan-sesi",
    category: "sewa",
    title: "Penyewaan: unit, booking & sesi",
    description: "Atur unit dan tarif, terima booking dengan DP, jalankan sesi dengan timer, dan tagih.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 5,
    lastUpdated: UPDATED_NEW,
    overview:
      "Untuk usaha sewa per waktu seperti lapangan, meja biliar, konsol game, atau ruangan. Menu utamanya “Jadwal” (booking) dan “Sesi” (pemakaian yang sedang berjalan). Booking dan sesi baru termasuk paket Pro; yang sudah berjalan tetap bisa diselesaikan.",
    steps: [
      {
        id: "unit",
        title: "Atur unit dan tarif (pemilik)",
        steps: [
          "Buka “Tarif & unit” › “Tambah unit”.",
          "Isi “Nama unit”, “Jenis”, “Tarif reguler per jam”, “Jam buka”, dan “Jam tutup”.",
          "Pilih “Cara tagih sesi walk-in”: “Per menit (meter)” atau “Paket”.",
          "Tambahkan tarif jam ramai lewat “Tambah jam ramai” bila tarif berbeda di jam tertentu.",
        ],
      },
      {
        id: "booking",
        title: "Terima booking",
        steps: [
          "Buka “Jadwal” › “Booking baru”.",
          "Pilih unit, jam mulai, dan “Durasi”. Jadwal yang bentrok ditolak.",
          "Isi nama pemesan.",
          "Pilih pembayaran: “Bayar nanti”, “DP 50%”, atau “Lunas”, lalu simpan.",
        ],
        image: {
          ...HP,
          src: "/panduan/sewa-jadwal-hp.png",
          alt: "Beranda usaha penyewaan berisi booking hari ini dan sesi yang sedang main",
          caption: "Beranda usaha penyewaan: booking hari ini dan jadwal berikutnya.",
        },
      },
      {
        id: "sesi",
        title: "Jalankan sesi",
        steps: [
          "Saat pemesan datang, ketuk “Mulai main (check-in)” pada booking. Untuk tamu tanpa booking, ketuk “Mulai” di unit kosong di “Sesi”.",
          "Gunakan “Tambah waktu” atau “Perpanjang” bila perlu.",
          "Ketuk “Stop”, lalu “Hentikan & tagih”. Tagihan terbuka di layar Bayar.",
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
    keywords: ["sewa", "rental", "booking", "reservasi", "lapangan", "biliar", "ps", "timer", "sesi", "dp"],
  },

  // ───────────────────────────── NOTIFIKASI ─────────────────────────────
  {
    slug: "notifikasi",
    category: "notifikasi",
    title: "Notifikasi di aplikasi & peringatan pemilik",
    description: "Isi menu Notifikasi, cara mengaktifkan peringatan pemilik di HP, dan pilihan kategorinya.",
    audience: ["Pemilik", "Kasir"],
    readMinutes: 4,
    lastUpdated: UPDATED_NEW,
    overview:
      "Ada dua jenis notifikasi: daftar di menu “Notifikasi” (ikon lonceng) untuk semua pengguna, dan peringatan pemilik yang muncul di HP walau aplikasi tertutup.",
    steps: [
      {
        id: "menu-notifikasi",
        title: "Menu Notifikasi",
        description:
          "Berisi hal yang perlu diperhatikan di outlet, dikelompokkan dalam tab “Semua”, “Pesanan”, “Stok”, “Tim”, dan “Sistem”. Contohnya: pesanan QR baru, stok menipis, kasbon jatuh tempo, pesanan siap disajikan, order servis terlambat, booking segera mulai, shift terlalu lama, dan perubahan ditolak server.",
        points: ["Ketuk “Tandai semua dibaca” untuk membersihkan tanda baru."],
      },
      {
        id: "aktifkan",
        title: "Aktifkan peringatan pemilik",
        steps: [
          "Saat pemilik membuka Beranda pertama kali, muncul “Aktifkan notifikasi pemilik?”. Ketuk “Aktifkan”, lalu izinkan notifikasi Android.",
          "Bila tadi memilih “Nanti”, buka Pengaturan › “Notifikasi” dan nyalakan “Terima peringatan di perangkat ini”.",
        ],
        image: {
          ...HP,
          src: "/panduan/notifikasi-pengaturan-hp.png",
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
          "“Transaksi dibatalkan (void) atau di-refund” — berisi nomor struk, nominal, dan outlet.",
          "“Login di perangkat baru” — akun dimasuki dari HP/tablet yang belum pernah dipakai.",
          "“Langganan” — pengingat masa Pro berakhir, batas transaksi Gratis, dan pembayaran tercatat.",
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
        answer: "Tidak. Peringatan pemilik hanya untuk perangkat yang dipakai pemilik. Kasir hanya menerima notifikasi pesanan QR.",
      },
      {
        question: "Saya void dari HP sendiri tetapi tidak dapat peringatan.",
        answer: "Peringatan tidak dikirim ke perangkat yang melakukan aksi tersebut; yang menerima adalah perangkat pemilik lainnya.",
      },
    ],
    relatedSlugs: ["akun-dan-keamanan", "membatalkan-transaksi-void-refund", "shift-kas-dan-tutup-kasir-harian"],
    keywords: ["notifikasi", "push", "pemberitahuan", "peringatan", "alert", "lonceng"],
  },

  // ───────────────────────────── OFFLINE ─────────────────────────────
  {
    slug: "bekerja-offline",
    category: "offline",
    title: "Bekerja offline & status sinkron",
    description: "Apa yang tetap bisa dilakukan saat internet putus dan arti tiap status sinkron.",
    audience: ["Kasir", "Pemilik"],
    readMinutes: 4,
    lastUpdated: UPDATED,
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
          "Ketuk chip “… perubahan ditolak”, atau kartu “Perubahan ditolak server” di Beranda/Notifikasi.",
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
          ...HP,
          src: "/panduan/pembaruan-tersedia-hp.png",
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
          ...HP,
          src: "/panduan/pembaruan-wajib-hp.png",
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
    description: "Ganti password, PIN supervisor, login di perangkat baru, dan keluar akun.",
    audience: ["Pemilik"],
    readMinutes: 3,
    lastUpdated: UPDATED,
    overview: "Pengaturan akun ada di Pengaturan › “Akun & keamanan”.",
    steps: [
      {
        id: "password",
        title: "Ganti password",
        description:
          "Belum ada form ganti password di dalam aplikasi. Keluar dari akun, lalu gunakan “Lupa password?” di layar masuk; kode dikirim ke email akun.",
      },
      {
        id: "pin-supervisor",
        title: "PIN supervisor",
        description:
          "PIN pemilik dipakai untuk menyetujui refund, void, dan aksi kasir lainnya. Atur di “Tim” › “Karyawan” (tombol “Atur PIN saya”).",
      },
      {
        id: "perangkat-baru",
        title: "Login di perangkat baru",
        description:
          "Nyalakan kategori “Login di perangkat baru” di Pengaturan › “Notifikasi” agar HP pemilik diberi tahu setiap akun dimasuki dari perangkat yang belum pernah dipakai. Bila itu bukan kamu, segera ganti password.",
      },
      {
        id: "keluar",
        title: "Keluar dari akun",
        description:
          "Pilih “Keluar” di menu akun atau di “Lainnya”. Data di perangkat ini dihapus dan perlu internet untuk masuk lagi.",
        callout: {
          type: "warning",
          text: "Bila muncul “Ada … perubahan yang belum terkirim ke server”, batalkan dulu dan sambungkan internet. Memilih “Tetap keluar” menghapus perubahan itu.",
        },
      },
    ],
    relatedSlugs: ["hapus-akun", "notifikasi", "karyawan-dan-pin"],
    keywords: ["akun", "password", "kata sandi", "keamanan", "logout", "keluar", "perangkat baru"],
  },
  {
    slug: "hapus-akun",
    category: "akun",
    title: "Menghapus akun",
    description: "Cara mengajukan penghapusan akun dan data usaha, serta masa tunggunya.",
    audience: ["Pemilik"],
    readMinutes: 2,
    lastUpdated: UPDATED,
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
          "Karyawan (kasir dan dapur) tidak punya akun terpisah. Pemilik cukup menonaktifkan karyawan di “Tim” › “Karyawan” (matikan “Aktif”).",
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
    lastUpdated: UPDATED_NEW,
    overview:
      "Sissi punya dua paket: Gratis dan Pro. Fitur dasar kasir selalu bisa dipakai gratis. Fitur lanjutan seperti meja, kasbon, dan laporan jam ramai termasuk paket Pro. Data kamu tidak pernah dihapus saat paket berakhir.",
    steps: [
      {
        id: "beda-paket",
        title: "Apa saja yang termasuk tiap paket",
        description: "Paket Gratis sudah mencakup kasir, struk, printer, semua metode bayar, mode offline, laporan dasar, diskon, void/refund, serta buka/tutup kasir. Paket Pro menambahkan:",
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
          "Dihitung per bulan kalender (WIB): transaksi lunas dan yang di-refund. Transaksi void dan pesanan yang belum dibayar tidak dihitung.",
          "Mulai transaksi ke-40, Kasir menampilkan “Sisa … transaksi Gratis bulan ini”.",
          "Saat batas tercapai, transaksi baru tidak bisa dimulai dan muncul “Batas Gratis bulan ini tercapai”. Pemilik bisa langsung ketuk “Upgrade ke Pro”.",
          "Pesanan yang sudah berjalan tetap bisa dibayar. Pelunasan kasbon, refund, void, tutup kasir, dan laporan juga tetap bisa.",
        ],
      },
      {
        id: "buka-halaman",
        title: "Membuka halaman Langganan (pemilik)",
        steps: [
          "Buka Pengaturan, lalu di grup “Akun” ketuk “Langganan”.",
          "Lihat kartu status: “Paket Pro” atau “Paket Gratis”, statusnya (“Pro aktif”, “Uji coba Pro”, “Masa tenggang”, atau “Gratis”), dan sisa harinya.",
          "Kartu “Transaksi bulan ini” menunjukkan pemakaian, mis. “32 dari 50”.",
          "Kartu “Fitur Pro” menandai fitur yang aktif (centang) dan yang terkunci (gembok).",
          "Status diperbarui otomatis saat online. Ketuk “Perbarui” untuk mengambil status terbaru sekarang.",
        ],
        points: ["Halaman ini juga terbuka dari tombol “Lihat Langganan”, “Upgrade ke Pro”, atau “Perpanjang”."],
      },
      {
        id: "perpanjang",
        title: "Berlangganan atau memperpanjang Pro",
        description: "Pembayaran Pro saat ini dilakukan manual lewat transfer, lalu dikonfirmasi admin Sissi.",
        steps: [
          "Di halaman Langganan, lihat kartu “Cara bayar”: harga bulanan/tahunan, rekening tujuan, dan petunjuk dari admin. Ketuk ikon salin untuk menyalin nomor rekening.",
          "Transfer sesuai harga paket yang dipilih.",
          "Ketuk “Chat admin via WhatsApp”. Pesan berisi nama usahamu sudah terisi; kirim beserta bukti transfer.",
          "Setelah admin mencatat pembayaran, status menjadi “Pro aktif” dan HP pemilik menerima notifikasi “Pro aktif sampai …”. Riwayatnya tampil di kartu “Riwayat pembayaran”.",
        ],
        points: [
          "Harga berlaku per usaha dengan 1 outlet termasuk.",
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
    keywords: ["langganan", "subscription", "pro", "gratis", "free", "upgrade", "perpanjang", "harga", "bayar langganan", "batas transaksi", "uji coba", "trial", "masa tenggang"],
  },

  // ───────────────────────────── MASALAH UMUM ─────────────────────────────
  {
    slug: "tanya-jawab-masalah-umum",
    category: "masalah",
    title: "Tanya jawab masalah umum",
    description: "Jawaban cepat untuk kendala yang sering terjadi di kasir.",
    audience: ["Pemilik", "Kasir", "Dapur"],
    readMinutes: 5,
    lastUpdated: UPDATED_NEW,
    overview: "Cari masalahmu di bawah. Bila belum terjawab, hubungi tim Sissi lewat “Bantuan & Panduan” di aplikasi (menu Lainnya).",
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
          "Muncul layar “Fitur Pro” → fitur itu termasuk paket Pro. Data lama tetap aman; minta pemilik memperpanjang Pro di Pengaturan › “Langganan”.",
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
          "Lupa password → “Lupa password?” di layar masuk.",
          "Karyawan lupa PIN → pemilik mengganti PIN di “Tim” › “Karyawan”.",
          "PIN terkunci karena salah berkali-kali → tunggu beberapa menit sesuai pesan di layar.",
        ],
      },
      {
        id: "perangkat",
        title: "Printer dan perangkat",
        points: [
          "Printer Bluetooth tidak ditemukan → nyalakan printer, dekatkan, pastikan tidak tersambung ke HP lain, lalu “Cari lagi”. Beri izin Perangkat sekitar bila diminta.",
          "Struk tidak tercetak → cek ada printer yang dicentang “Struk kasir”. Untuk printer jaringan, cek alamat IP dan Wi-Fi yang sama.",
          "Tulisan terakhir struk ikut tersobek, atau kertas terbuang banyak → atur “Sisa kertas di akhir” dan “Punya pemotong kertas otomatis” di pengaturan printer.",
          "Laci tidak terbuka → laci hanya terbuka untuk pembayaran tunai dan harus tersambung ke printer struk. Coba “Tes buka laci”.",
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
    keywords: ["masalah", "error", "tidak bisa", "troubleshooting", "bantuan", "faq", "kendala"],
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
