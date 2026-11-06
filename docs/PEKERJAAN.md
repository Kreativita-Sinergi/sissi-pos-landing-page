# Catatan pekerjaan — sissi-pos-landing-page

> **Dokumen hidup.** Agent/kontributor membacanya di awal sesi dan memperbaruinya di akhir sesi (pola sama dengan
> `docs/PEKERJAAN.md` di `sissi-pos-app` dan `sissi-pos-service`). Isinya: apa yang sedang dikerjakan, berikutnya,
> backlog, keputusan terbuka, dan riwayat selesai. Hanya lokal di repo ini.

Terakhir diperbarui: **2026-11-06** · oleh: Claude Opus 5.5 (dialog "Pilih cara bayar" dibangun ulang: dua panel + ringkasan)

Repo ini berisi situs pemasaran **dan** web dasbor pemilik (`/dasbor`), web karyawan (`/karyawan`), admin (`/admin`),
pesan mandiri. Kontrak API: `../sissi-pos-service/docs/api.md`. Cabang kerja: `development` (tanpa workflow CI di repo
ini; push `development` tidak memicu deploy, push `main` ditayangkan Vercel).

## Menunggu reviu sebelum merge

_Cabang `agent/*` dari agent selain Claude yang menunggu diperiksa. Hapus entri setelah di-merge._

| Cabang | Ringkasan | Cara verifikasi | Risiko / catatan | Dibuat |
|---|---|---|---|---|
| _(kosong)_ | | | | |

## Sedang dikerjakan

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
