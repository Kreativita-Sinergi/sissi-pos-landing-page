# Catatan pekerjaan — sissi-pos-landing-page

> **Dokumen hidup.** Agent/kontributor membacanya di awal sesi dan memperbaruinya di akhir sesi (pola sama dengan
> `docs/PEKERJAAN.md` di `sissi-pos-app` dan `sissi-pos-service`). Isinya: apa yang sedang dikerjakan, berikutnya,
> backlog, keputusan terbuka, dan riwayat selesai. Hanya lokal di repo ini.

Terakhir diperbarui: **2026-11-05** · oleh: Claude Opus 5.5 (navigasi & tata letak dasbor pemilik)

Repo ini berisi situs pemasaran **dan** web dasbor pemilik (`/dasbor`), web karyawan (`/karyawan`), admin (`/admin`),
pesan mandiri. Kontrak API: `../sissi-pos-service/docs/api.md`. Cabang kerja: `development` (belum ada workflow CI di
repo ini; push tidak memicu deploy).

## Menunggu reviu sebelum merge

_Cabang `agent/*` dari agent selain Claude yang menunggu diperiksa. Hapus entri setelah di-merge._

| Cabang | Ringkasan | Cara verifikasi | Risiko / catatan | Dibuat |
|---|---|---|---|---|
| _(kosong)_ | | | | |

## Sedang dikerjakan

- _(kosong)_

## Berikutnya

- **P2 · Deploy service `07ebd5c`** (`GET /files/*` mengirim `Access-Control-Allow-Origin: *`; belum di-push/deploy —
  butuh izin pemilik). Web sudah memuat logo dengan penanda query (`?cors=1`) sehingga logo di PDF jalan selama origin
  dasbor ada di `CORS_ORIGINS` server; commit service membuatnya tidak bergantung konfigurasi itu.

## Backlog

- _(kosong)_

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
