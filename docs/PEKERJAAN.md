# Catatan pekerjaan — sissi-pos-landing-page

> **Dokumen hidup.** Agent/kontributor membacanya di awal sesi dan memperbaruinya di akhir sesi (pola sama dengan
> `docs/PEKERJAAN.md` di `sissi-pos-app` dan `sissi-pos-service`). Isinya: apa yang sedang dikerjakan, berikutnya,
> backlog, keputusan terbuka, dan riwayat selesai. Hanya lokal di repo ini.

Terakhir diperbarui: **2026-11-11** · oleh: Claude Opus 5.5 (absen di luar jadwal & konfirmasi telat)

Repo ini berisi situs pemasaran **dan** web dasbor pemilik (`/dasbor`), web karyawan (`/karyawan`), admin (`/admin`),
pesan mandiri. Kontrak API: `../sissi-pos-service/docs/api.md`. Cabang kerja: `development` (tanpa workflow CI di repo
ini; push `development` tidak memicu deploy, push `main` ditayangkan Vercel).

## Menunggu reviu sebelum merge

_Cabang `agent/*` dari agent selain Claude yang menunggu diperiksa. Hapus entri setelah di-merge._

| Cabang | Ringkasan | Cara verifikasi | Risiko / catatan | Dibuat |
|---|---|---|---|---|
| _(kosong)_ | | | | |

## Sedang dikerjakan

- **Absen di luar jadwal & konfirmasi telat (2026-11-11, `development`, belum rilis):** web karyawan menampilkan dialog
  409 `UNSCHEDULED_CONFIRM` ("Kamu tidak punya shift hari ini. Tetap catat masuk kerja?") dan `LATE_CONFIRM` (nama shift,
  jam mulai, toleransi, menit telat + alasan opsional ≤ 200 dengan hitung karakter); kirim ulang body yang sama + flag
  (flag sebelumnya ikut, mis. `confirm_outside`) dengan Idempotency-Key baru, jadi bisa berantai lokasi → jadwal. Layar
  hari ini: `rules.unscheduled` → "Tidak ada shift hari ini" (jam kerja global tidak ditampilkan sebagai shift). Riwayat:
  tanda "Di luar jadwal" & "Alasan: …", ringkasan Hadir menyebut jumlah di luar jadwal bila > 0. Dasbor Tim › Absen:
  tanda "Di luar jadwal" & alasan telat (hari ini & catatan per karyawan). Mock: skenario `luarjadwal`, `shift`;
  e2e karyawan +3 tes (13/13). **Rilis menunggu service** dideploy (kontrak `../sissi-pos-service/docs/api.md`
  "Absen di luar jadwal & konfirmasi telat"); web aman terhadap server lama (field opsional).
  Lanjutan: rekap & gaji dasbor (`recapFor`/`computeRecap`) memakai `isUnscheduled` (cermin `unscheduled` di service
  `internal/staffweb/rules.go`; jendela ±7 hari, `default`, shift tetap dengan templat hilang) → hari tanpa catatan
  yang di luar jadwal = libur, bukan alpa, dan tidak dipotong "alpa × hari". `ShiftSchedule.defaults` (baris
  `kind: "default"`) ditambahkan untuk itu.
  Lanjutan 2: bisnis dengan ≥ 1 templat shift sah = memakai jadwal (`isUnscheduled`, urutan cermin server). Jam kerja
  belum pernah disimpan (tanpa kunci `attendance`, `AttendanceRules.has_work_hours: false`) → hari Jam kerja global
  tidak dihitung telat di `evaluateClockIn` (dialog absen manual); form tetap menampilkan bawaan, simpan selalu menulis
  `attendance` dan tidak menulis `has_work_hours`. Papan hari ini: di luar jadwal tanpa absen = "Tanpa shift hari ini".
  Pengingat `shiftsUnassigned` di Tim (semua tab kecuali Jadwal) dengan tautan ke Tim › Jadwal.
  Lanjutan 3: absen manual pemilik pada tanggal di luar jadwal + hadir → otomatis ontime + `unscheduled: true`
  (`manualFlags`: koreksi baris unscheduled yang tetap ontime mempertahankan tanda; `late_reason` lama dipertahankan
  bila tetap late). Papan "Kehadiran hari ini" & status web karyawan: lencana keadaan selalu tampil + lencana kuning
  "Telat …" di sampingnya. Durasi telat memakai satu fungsi `src/lib/duration.ts` (`25 mnt`, `13 j 4 mnt`, `2 j`) di
  dasbor (papan, catatan, dialog manual, slip) dan web karyawan (status, riwayat, ringkasan, dialog LATE_CONFIRM).
  Lanjutan 4: web karyawan menangani 409 `OFF_DAY_CONFIRM` ("Hari ini jadwalmu libur. Tetap catat masuk kerja?" →
  `confirm_off_day: true`, berantai dengan di luar area; mock skenario `libur`, e2e 14/14). Absen manual pemilik di
  hari libur yang ditetapkan pemilik (`isOwnerOffDay`: jadwal `off`, libur shift tetap, `off_days` bila Jam kerja
  tersimpan) + hadir → ontime + `unscheduled: true`; libur Minggu bawaan tanpa Jam kerja tanpa tanda.
  Lanjutan 5 (audit): tanpa Jam kerja tersimpan, hari Jam kerja global tanpa catatan = "belum ada catatan" (bukan
  alpa, tidak dipotong) dan lembur 0; gaji per jam dengan tarif lembur 0 membayar semua menit kerja dengan tarif biasa
  (tes angka: 600 mnt × Rp 20.000/jam = Rp 200.000; tarif lembur 30.000 → 160.000 + 60.000; samakan dengan
  `payroll_calc.dart` app setelah agent app commit). Form Jam kerja belum diatur: Notice + Simpan aktif (`EditSection
  unsaved`). Zona waktu kosong: "Belum dipilih (memakai WIB)". Biaya layanan: sakelar "Semua jenis pesanan", dimatikan
  wajib ≥ 1. Loyalti: "≈ N% belanja kembali ke pelanggan". Papan hari ini: kartu Hadir/Terlambat/Izin/Alpa/Belum absen.
  Web karyawan: `rules.work_hours_set: false` tanpa shift → "Jam kerja belum diatur pemilik" (mock `belumatur`).
  Belum dicek visual: pengaturan & papan Tim dasbor (mock pemilik butuh masuk).

- **Admin · data perangkat & galat tertangani (#49, 2026-11-09, `development`, belum rilis):** detail bisnis menampilkan
  baris perangkat (merek model · OS · layar, mis. "Xiaomi Redmi Pad SE · Android 14 (SDK 34) · 800×1280 @1.5"; kosong
  untuk app lama = tidak tampil). Crash: badge **Tertangani** + level (Info netral / Peringatan kuning / Error merah) dan
  `context` untuk `kind=handled`; kejadian menampilkan perangkat; filter baru **Jenis** (`kind`) dan **Level** (`level`)
  di URL; bawaan tetap semua jenis (perilaku lama). Kontrak: service `954faa2`, `9cd8e2e`.

- **Admin · susunan menu samping (2026-11-07):** grup kini Merchant, Pendapatan, Aplikasi, Tim & keamanan; Ringkasan dan Metrik tanpa judul grup. Alamat halaman tidak berubah.

- **Admin · informasi merchant (2026-11-07, DIRILIS ke `main` sebagai `6cf93fd`, cherry-pick khusus admin: 18 commit lain di `development` termasuk dialog bayar Duitku sengaja belum ikut):** Ringkasan menampilkan `MerchantOverview` (aktif hari ini,
  sedang aktif, nilai & jumlah transaksi, grafik 30 hari/12 minggu/12 bulan, merchant bertumbuh tercepat); detail bisnis
  punya tab **Performa** (`BusinessPerformanceTab`: KPI, peta jam ramai, tren 12 minggu, per outlet, saring periode & outlet).
  Halaman baru `/admin/pertumbuhan` (`GrowthView`: merchant bertransaksi, aktivasi, merchant berisiko, per jenis, metode bayar);
  merchant berisiko juga di Ringkasan; daftar bisnis punya kolom nilai & pertumbuhan, dan semua saringan (termasuk akun uji) masuk satu panel Filter + label filter aktif;
  tab Performa punya produk & metode bayar; sakelar akun uji di tab Fitur. Ringkasan dikelompokkan Merchant/Langganan/Aplikasi,
  kartu "Total bisnis" dihapus (angkanya ada di kartu Bisnis aktif hari ini). Pertumbuhan memakai pola kelompok yang sama:
  Perlu dihubungi, Perkembangan, Perbandingan. Tab Performa: peta jam mengikuti jam yang ada transaksinya, "Per outlet" hanya
  bila outlet > 1, tata letak dua kolom (analisis kiri, metode bayar & produk kanan). Kontrak: `../sissi-pos-service/docs/api.md` "Admin platform — informasi merchant".

- **Langganan · kartu Pemakaian (2026-11-06):** outlet ditulis `1 dari 1 outlet` dengan keterangan kuota; bilah hanya saat melebihi kuota; catatan `enforced` tidak lagi ditampilkan ke pemilik.

- **Langganan · cek status & desain ulang dialog bayar (2026-11-06):** langkah menunggu memakai tata letak dua panel yang
  sama dengan "Pilih cara bayar" (satu kolom di ponsel, QR langsung terlihat): kiri cara bayar (QRIS dengan logo, atau
  nomor VA/kode besar dengan tombol Salin) + langkah bernomor; kanan status "Menunggu pembayaran", pil sisa waktu (VA dan
  ritel: "Berlaku sampai <tanggal jam>"), ringkasan Paket/Harga/Biaya layanan/Total, dan tombol **Cek status pembayaran**
  (`POST .../refresh`). Setelah hasil masih pending: catatan tenang dan hitung mundur "Cek lagi dalam N dtk" dari
  `next_refresh_at` (dibatasi 31 dtk dari saat diterima agar jam klien yang meleset tidak mengunci tombol). 429/502 tampil
  ramah. Langkah sukses: centang beranimasi (hanya bila gerak diizinkan) dan kartu rincian. Setelah lunas, lencana paket
  di sidebar diperbarui lewat `refreshSession` yang sudah ada (tanpa muat ulang). Mock: refresh pertama pending, kedua lunas.
  e2e `langganan:` ditambah empat tes.

- **Langganan · tata letak (2026-11-06):** `/dasbor/langganan` dua kolom: kartu bayar + riwayat di kiri, pemakaian + fitur di kanan; pilih outlet disembunyikan di halaman ini. Pembayaran ujung ke ujung tetap belum teruji.

- **Langganan · logo metode (2026-11-06):** logo QRIS, Indomaret, dan Alfamart disimpan di `public/logos/pembayaran/` (sumber Wikimedia Commons: `QRIS_Logo.svg` CC0, `Indomaret.svg`, `Alfamart.svg`, `Gopay_logo_(2019).svg`; BCA dari Duitku) karena logo gabungan Duitku terlalu kecil terbaca; metode lain tetap dari `images.duitku.com`. Logo adalah merek dagang pemiliknya: pastikan ketentuan pemakaian logo QRIS ke Duitku sebelum produksi.

- **P1 · Dialog bayar langganan online (Duitku) di `/dasbor` — terimplementasi, BELUM E2E, belum dirilis (2026-11-06).**
  `PayDialog` + mock/tes browser dengan stub selesai (commit `f31737c..3ca0ad4`). Belum dijalankan terhadap API Duitku
  sungguhan (sandbox maupun produksi). Rilis menunggu service (`../sissi-pos-service/docs/PEKERJAAN.md`) dideploy dan E2E
  selesai. Backlog di bawah.

## Berikutnya

- **P1 · Rilis web ke produksi** (`development` → `main`; Vercel menayangkan otomatis dari `main`, tidak perlu CI
  deploy sendiri). **Urutan wajib:** service dideploy dulu — web kini mengunduh PDF Transaksi dari
  `GET /owner/reports/sales.pdf` (`60215c0`) dan halaman `/setujui/[token]` memanggil `/approval-links/*`; keduanya
  baru ada di service `development`. Butuh izin pemilik.

## Backlog

- **P1 · Duitku langganan, sebelum rilis:** jalankan E2E aplikasi di sandbox, termasuk QRIS `SP` dengan pindai
  sungguhan memakai APK staging Shopee; ulangi E2E dan bukti `amount` callback dengan kredensial produksi.
- **P2 · Duitku, kepastian di luar kode:** konfirmasi ke Duitku atau konsultan bahwa membebankan biaya layanan ke
  pelanggan pada metode non-QRIS diperbolehkan (PBI 23/6/PBI/2021 Pasal 52; teks resmi belum dibaca); cek pengaturan
  portal untuk `BT A1 DA LA JP` (biaya 0 sehingga disembunyikan); teks PPN masih ada di `/harga`, `HargaSection`,
  panduan, dan app, kewajiban PPN dikonfirmasi ke akuntan; app Flutter masih menampilkan pembayaran manual;
  `resultCode` dan `reference` callback tidak ditandatangani Duitku, pengerasan diputuskan sebelum produksi; belum ada
  alert untuk log error rekonsiliasi berhenti (sisi service).
- **P3 · Temuan minor dialog yang ditunda** (teks kedaluwarsa, pengalihan e-wallet setelah dialog ditutup, galat non-404
  `?checkout=`, dan siklus `backToPick` sudah diperbaiki 2026-11-06): selisih jam klien vs `expires_at`; cakupan e2e
  `amount_mismatch`/`failed`/paid telat belum ada; `mock.ts` memakai `this.paymentMethods` dan import inline,
  `PAYMENT_STATUS` hanya `recorded|void`.

- **P3 · Pastikan kecamatan alamat kantor:** situs menulis "Kec. Tampan" sesuai pemilik, tetapi satu sumber tak resmi
  menempatkan Simpang Baru di Kec. Binawidya setelah pemekaran. Perda Pekanbaru No. 2/2020 belum terbaca. Kode pos
  28293 juga dari sumber tak resmi. Nilai ada di `OFFICE_ADDRESS_AREA` (`src/constants/site.ts`). Titik tautan Google
  Maps (pencarian teks alamat) juga perlu dicek pemilik.

## Keputusan

- **Ekspor Transaksi** (pemilik 2026-11-05): tombol "Ekspor" → dialog; ekspor **mengikuti filter halaman** (tanpa
  pemilih periode terpisah). PDF = jsPDF 4.2.1 + jspdf-autotable 5.0.9 (dimuat hanya saat ekspor). Ringkasan PDF dari
  `GET /owner/reports/sales` bila tanpa filter tambahan (= halaman Laporan); dengan filter metode/status/kasir/cari
  dihitung dari transaksi yang cocok (`summaryFromRows`, rumus sama; tanpa rincian diskon/pajak). PDF **tanpa daftar
  per transaksi** (pemilik 2026-11-05: PDF = laporan ringkas, daftar → CSV maks. 5.000 baris).
- **PDF = laporan yang menjelaskan** (pemilik 2026-11-05): "Kesimpulan periode ini" & "Saran" dibuat dengan **aturan
  tetap** di `src/lib/owner/salesInsights.ts` (bukan AI; tiap kalimat bisa ditelusuri ke angka di laporan, diuji di
  `tests/salesPdf.test.mjs`). Data penting tetap ditampilkan (produk terlaris, pola hari & jam, outlet, kasir, metode,
  jenis pesanan, rincian penjualan, per hari). Rata-rata per hari mengecualikan hari ini yang masih berjalan; produk
  "jarang laku" hanya produk menu (bukan item cepat) yang terjual ≤ 10% dari produk terlaris. Produk & jam/hari ramai
  ikut kunci paket `insights` (Gratis → catatan di PDF).

- **Sub-bagian halaman = sub-menu sidebar** (desktop ≥1024 px), satu sumber di `src/components/owner/sections.ts`
  (Produk, Stok, Tim, Pengaturan). Di HP/tablet bagian yang sama tampil sebagai `Tabs` di halaman. Angka di tab
  (jumlah produk, pengajuan menunggu) sengaja tidak ada di sidebar — disetujui pemilik 2026-11-05.
- **Judul tab browser per sub-bagian** lewat `useSectionTitle` (MutationObserver), bukan
  `generateMetadata({ searchParams })`: dengan `cacheComponents: true` itu memaksa halaman dirender per permintaan.
- **Pengaturan:** semua kelompok tetap ter-mount (disembunyikan) agar draf yang belum disimpan tidak hilang saat pindah
  sub-menu. Navigasi ke halaman lain tetap membuang draf (perilaku lama; hanya `beforeunload` yang dijaga).
- **Tombol tambah** tiap halaman/sub-bagian ada di kepala halaman (`PageHeader`, sejajar judul di desktop).
- **Urutan kategori** dari web = `reorderCategories` aplikasi (indeks → `sort_order`, hanya baris berubah).

## Selesai

- 2026-11-08 · Admin → Bisnis → Performa: pilihan periode **Hari ini** (`periode=1`); teks pembanding "vs kemarin" /
  "Dibanding kemarin di jam yang sama". tsc + lint bersih; belum dicek visual.
- 2026-11-08 · Uji coba Pro 30 → 14 hari (server `00066`): halaman harga, `HargaSection`, CTA, FAQ perbandingan,
  panduan, Syarat & Ketentuan §3 (versi 1.1, berlaku November 2026), admin (label status, info daftar langganan, aksi
  audit `subscription.trial_shortened` + filter), mock billing. lint + tsc bersih.
- **2026-11-06 · Dialog "Pilih cara bayar" dibangun ulang.** Desktop (`lg`+): dialog lebar 880px, kiri semua metode tanpa lipatan (QRIS penuh di atas; Virtual Account, E-wallet, Gerai ritel dua kolom; baris datar logo ±48x28 + nama + biaya + radio), kanan "Ringkasan" (Paket, Harga, Biaya layanan atau "Gratis", Total, tombol "Bayar Rp…") yang mengikuti pilihan. Tanpa gulir di 1360x768 dan 1360x900 dengan 15 metode (dialog 560px). Ponsel: satu kolom, daftar menggulir di dalam dialog, ringkasan + tombol tertempel di bawah, halaman di belakang terkunci. Perilaku: memilih hanya memilih (radio sungguhan, satu grup, panah keyboard); checkout dibuat saat "Bayar" ditekan; QRIS terpilih bawaan, pilihan yang hilang jatuh ke QRIS/pertama. "Bank lainnya", `VaList`, `VA_FIRST`, `VA_FOLD_MIN` dihapus. `Modal` dapat prop opsional `wide` (lebar + tinggi dibatasi layar + kunci gulir halaman); pemanggil lain tidak berubah. e2e `langganan` 19 lulus.

- **2026-11-06 · Paket Pro 6 Bulan (`semiannual`, Rp309.000 disetujui pemilik; bisa diubah lewat `billing_config`).** Dasbor:
  tiga kartu Bulanan / 6 Bulan / Tahunan (tiga kolom dari `sm`, bertumpuk di ponsel; helper "RpX/bulan" dan "Hemat RpX" dihitung
  dari harga API; server lama tanpa `prices.semiannual` jadi dua kartu), pelanggan aktif 6 bulan terpilih otomatis, dialog "Pro 6 Bulan".
  Admin: kolom harga 6 bulan di "Cara bayar & harga", siklus 6 Bulan di catat pembayaran & filter, MRR dibagi 6. Publik: `/harga` dan
  `HargaSection` menampilkan 6 Bulan (Rp309rb, setara Rp51,5rb/bulan, hemat Rp45rb); teks PPN tidak berubah. e2e `langganan` 15 lulus.

- **2026-11-06 · Alamat di kontak `/tentang`** (Claude Opus 5.5): kotak "Alamat" selebar dua kolom di bawah WhatsApp &
  Email; nama perumahan tebal, wilayah abu-abu, tautan "Buka di Google Maps" (`OFFICE_*` di `src/constants/site.ts`).
- **2026-11-05 · Reviu `826043f` `/setujui/[token]`** (Claude Opus 5.5): GET hanya membaca, keputusan lewat POST
  (aman dari pemindai tautan email), `noindex` + `no-referrer`. Ditambah header `/setujui/:path*` di `next.config.ts`
  (`X-Frame-Options: DENY`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`) seperti `/undangan`. Catatan:
  waktu ditampilkan dalam WIB (kontrak tidak mengirim zona outlet).
- **2026-11-05 · Logo di kepala PDF** (Claude Opus 5.5): penyebab gagal = respons logo di cache browser (dari `<img>`
  biasa, tanpa header CORS, cache setahun) dipakai ulang untuk permintaan CORS. Web: penanda query `?cors=1`; service:
  `07ebd5c` `Access-Control-Allow-Origin: *` di `/files/*`. e2e logo kini juga memeriksa gambar di PDF.
- **2026-11-05 · Unggah logo struk dari web** (Claude Opus 5.5): Pengaturan › Outlet & struk › Struk: unggah/ganti/hapus
  logo (PNG tetap PNG, ≤ 800 px; `POST /owner/uploads/images`), pilihan cara cetak (`logo_style`), "Pakai logo ini di
  semua outlet", berkas lama dihapus best effort. Tes unit 3 + e2e unggah→simpan→kembalikan. Catatan tes: pull sync
  menahan record yang baru berubah beberapa detik — tes yang memulihkan record lewat API menunggu record terlihat lagi.
- **2026-11-05 · PDF Laporan Penjualan: tren & kerapian** (Claude Opus 5.5): catatan sinkron + "hari ini masih
  berjalan" di kepala; laporan periode sebelumnya (permintaan ke-2) → tren produk/kasir & kolom "vs lalu"; rata-rata
  per transaksi vs periode lalu; varian digabung di kesimpulan; kesimpulan dikelompokkan per tema; logo struk outlet di
  kepala (belum diuji visual — data demo tanpa logo; gagal muat → tanpa logo). Tes unit 10.
- **2026-11-05 · PDF Laporan Penjualan berisi analisis** (Claude Opus 5.5): kesimpulan & saran otomatis, produk
  terlaris, grafik batang hari & jam, perbandingan outlet, jenis pesanan. Tes unit 8 + e2e isi PDF.
- **2026-11-05 · Ekspor PDF Transaksi** (Claude Opus 5.5): `src/lib/owner/salesPdf.ts` (ringkasan, rincian uang, per
  metode bayar, per kasir, per hari/jam, nomor halaman; daftar per transaksi lewat CSV),
  `SalesExport.tsx` (dialog PDF/CSV). Tes: `tests/salesPdf.test.mjs` (5), e2e unduh PDF (berkas valid + isi).

- **2026-11-05 · Backlog P3 dasbor** (Claude Opus 5.5): kartu ringkasan Aktivitas kini tautan ke filter Jenis terkait
  (periode & outlet tetap); tes e2e laci menu di lebar tablet 820 px (termasuk Esc menutup laci).

- **2026-11-05 · Navigasi & tata letak dasbor pemilik** (Claude Opus 5.5; cabang `development`, di-push):
  - `7df73fd` sub-menu sidebar (Produk, Stok, Tim) yang bisa dibuka-tutup; judul/deskripsi/judul tab browser ikut
    sub-bagian; `PageHeader` dua kolom; tombol tambah katalog seragam di kepala; tambah kategori lewat dialog; label
    Impor/Ekspor dipendekkan; ajakan di tampilan kosong.
  - `23f6db7` sub-menu Pengaturan (5 kelompok), laci menu HP menggantikan menu geser 12 item, `PushNote` seragam.
  - `08be06e` Aktivitas: filter "Jenis" pilihan ganda menggantikan 10 chip.
  - `7d96734` urutkan kategori dari web (Naikkan/Turunkan).
  - Verifikasi: `tsc`, `eslint`, `npm test` (65/65), e2e 21/21 setelah data demo diisi ulang.
- **2026-11-05 · Data demo basi** — seed lokal bertanggal 2026-10-13, sehingga 3 tes e2e transaksi/shift gagal (data
  di luar periode 7 hari; Pro demo kedaluwarsa). Diisi ulang dengan `devseed --reset`; README e2e & pesan galat tes kini
  menyebut langkah ini.
