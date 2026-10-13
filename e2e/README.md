# Tes e2e dasbor pemilik

Tes lewat browser sungguhan (puppeteer-core + Chrome yang sudah terpasang, **tanpa** mengunduh browser) untuk
menangkap bug yang lolos uji curl: CORS/preflight, cookie sesi lintas port, dialog `<dialog>`, alur klik & keyboard.

```bash
npm run e2e
```

## Prasyarat

1. **API lokal** `sissi-service` menyala di `http://localhost:8000` (`go run ./cmd/api`) dengan origin web
   (`http://localhost:3000`) terdaftar di `OWNER_WEB_ORIGINS`/`ADMIN_ORIGINS`.
2. **Data demo** dari devseed (akun Pro `demo.pro@contoh.sissi.id` / `Sissi-Demo#2026`, dua outlet, kategori).
3. **Web** menyala di `http://localhost:3000` (`npm run dev`) dengan `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`
   dan `NEXT_PUBLIC_OWNER_MOCK` bukan `1`. Tes tidak menyalakan server sendiri.
4. **Google Chrome** di `/Applications/Google Chrome.app/…` (macOS) atau atur `CHROME_PATH`.

## Variabel lingkungan

| Variabel | Bawaan | Arti |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | URL web |
| `E2E_API_URL` | `http://localhost:8000/api/v1` | URL API (verifikasi & pembersihan data) |
| `E2E_EMAIL` / `E2E_PASSWORD` | akun demo Pro | Akun pemilik |
| `CHROME_PATH` | Chrome sistem macOS | Lokasi biner Chrome/Chromium |
| `E2E_HEADFUL=1` | (headless) | Tampilkan jendela browser |
| `E2E_ONLY=teks` | — | Jalankan hanya tes yang namanya memuat teks ini (+ tes login) |
| `E2E_TIMEOUT` | `15000` | Batas tunggu per langkah (ms) |

## Perilaku

- Browser memakai **profil sementara** di direktori tmp (dihapus setelah selesai). Akibatnya setiap run tercatat
  sebagai "login dari perangkat/browser baru" di Aktivitas — wajar.
- Data yang dibuat bernama berawalan `E2E ` dan **dihapus** di akhir tiap tes; sisa run gagal sebelumnya dibersihkan
  di awal & akhir run. Pengaturan struk dikembalikan ke nilai semula.
- API membatasi **600 request/menit per pengguna untuk baca (60/menit untuk simpan)** (browser + tes). Runner menghitung request dan menunggu bila
  kuota menipis, jadi satu run butuh ±1,5–2 menit. Login dibatasi 10/menit — jangan menjalankan berulang-ulang
  dalam satu menit.
- Tes gagal → pesan, request gagal/429, galat konsol, dan tangkapan layar (path dicetak). Exit code 1 bila ada yang
  gagal, 2 bila tidak bisa masuk ke API.

## Daftar tes

login salah/benar · konfirmasi keluar (Batal) · Beranda KPI · Laporan + ganti periode (pilihan tunggal tanpa ruang
kosong) · produk satu-harga: buat → ubah harga → entri "Perubahan data" di Aktivitas → hapus · dialog Tambah produk
tetap terbuka saat pemilih file dibatalkan · dropdown kategori via keyboard (Esc hanya menutup daftar) · unggah foto
produk (PNG dibangkitkan) · pelanggan tambah/ubah/hapus · pengaturan struk simpan & kembalikan · Aktivitas + filter
Perubahan data · keluar sungguhan.
