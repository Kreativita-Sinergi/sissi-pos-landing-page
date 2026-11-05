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

- _(kosong)_

## Backlog

- **P3 · Tes e2e laci menu di lebar tablet** (768–1023 px) — saat ini hanya HP (390 px) dan desktop (1366 px).
- **P3 · Kartu ringkasan Aktivitas sebagai pintasan filter** (klik kartu → filter Jenis terkait).

## Keputusan

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
