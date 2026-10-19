# Sissi Landing Page

Website Landing Page untuk **Sissi · Kasir Pintar untuk Usaha yang Tumbuh**, dibangun berdasarkan desain Figma Desktop & Mobile v3 (`Sissi · Website Desktop · v3` dan `Sissi · Website Mobile · v3`).

---

## 🛠️ Tech Stack
- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack, TypeScript)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Font**: Geist & Geist Mono (`next/font/google`)
- **Assets**: Asli diekspor langsung dari Figma dan logo SVG resmi

---

## 📁 Struktur Direktori & Arsitektur

Kode dirancang sangat modular, rapi, dan mudah di-maintain:

```text
sissi-landing-page/
├── public/
│   ├── images/
│   │   ├── app/             # Layar ASLI aplikasi (render sissi-app build/shots, WebP lossless)
│   │   └── og-sissi.jpg     # Gambar Open Graph 1200×630
│   └── logos/               # Logo dan icon SVG resmi Sissi
├── src/
│   ├── app/
│   │   ├── globals.css      # Design token warna, tipografi & styling dasar
│   │   ├── layout.tsx       # Root layout & SEO metadata
│   │   └── page.tsx         # Halaman utama menyusun 11 section sesuai Figma
│   ├── components/
│   │   ├── shared/          # Shared Components untuk kemudahan pemeliharaan
│   │   │   ├── Button.tsx         # Tombol (primary, secondary, white, outline, ghost)
│   │   │   ├── Container.tsx      # Pembungkus lebar maksimal (responsive)
│   │   │   ├── SectionWrapper.tsx # Pembungkus section dengan background token
│   │   │   ├── SectionHeader.tsx  # Header section (Tag, Judul, Subjudul)
│   │   │   ├── Card.tsx           # Kartu putih interaktif & elevasi
│   │   │   └── Badge.tsx          # Pill badge (brand, neutral, accent)
│   │   ├── layout/          # Layout Navigasi & Footer
│   │   │   ├── Navbar.tsx         # Header responsif (Desktop & Drawer Mobile)
│   │   │   └── Footer.tsx         # Footer dengan 4 kolom navigasi & hak cipta
│   │   └── sections/        # Section modular mandiri
│   │       ├── HeroSection.tsx
│   │       ├── KeteranganSection.tsx
│   │       ├── CaraKerjaSection.tsx
│   │       ├── FiturSection.tsx
│   │       ├── SebelumSesudahSection.tsx
│   │       ├── PerangkatSection.tsx
│   │       ├── UntukUsahaSection.tsx
│   │       ├── HargaSection.tsx
│   │       ├── FaqSection.tsx
│   │       └── AjakanSection.tsx
│   └── constants/           # Data & Konten terpusat (Mudah di-update tanpa ubah UI)
│       ├── navigation.ts    # Link menu & footer
│       ├── features.ts      # Tab fitur & deskripsi
│       ├── comparison.ts    # Tabel perbandingan Sebelum vs Sesudah Sissi
│       ├── pricing.ts       # Paket harga (Bulanan/Tahunan) & matriks fitur
│       ├── faq.ts           # Daftar pertanyaan & jawaban
│       └── businessTypes.ts # 4 kategori bisnis (Kuliner, Ritel, Jasa, Sewa)
```

---

## 🚀 Menjalankan Project

### Mode Development
```bash
npm run dev
```
Buka browser di `http://localhost:3000`.

### Build untuk Produksi
```bash
npm run build
npm run start
```

### Pesan & Bayar Mandiri (QR) — `/pesan/<kode>`
Halaman pemesanan pelanggan (scan QR meja). Mati secara bawaan; nyalakan lewat env (lihat `.env.example`):

```bash
# .env.local — coba tanpa server (data contoh kafe)
NEXT_PUBLIC_SELF_ORDER=1
NEXT_PUBLIC_SELF_ORDER_MOCK=1
```
Buka `http://localhost:3000/pesan/meja5`. Kode contoh untuk mode tiruan (bisa digabung, mis. `pilih-online`):
`pilih` (pilih meja), `bawa` (tanpa meja), `online` (bayar QRIS), `nama` (nama wajib), `tolak`, `diam`
(kasir tidak merespons), `kedaluwarsa`, `harga` (harga berubah), `habis` (item habis), `salah` (404),
`tutup` (403), `limit` (429). Kontrak API: `sissi-service/docs/api.md` bagian "Pesan & Bayar Mandiri (QR)".

### Admin platform — `/admin`
Panel tim Sissi (rilis aplikasi, APK langsung, fitur per bisnis, audit) di `https://kasir.sissi.id/admin`.
Tidak ditautkan dari landing, `noindex`. Halaman memanggil API langsung dari browser (`credentials: 'include'`
+ header `X-Sissi-Admin: 1`); unggah APK langsung ke API (bukan lewat Vercel). Kontrak:
`sissi-service/docs/api.md` bagian "Admin platform".

```bash
# .env.local — coba tanpa server (data contoh)
NEXT_PUBLIC_ADMIN_MOCK=1
```
Buka `http://localhost:3000/admin/login`. Mode tiruan: email & password apa saja; password `salah` → galat,
email memuat `kunci` → terkunci 15 menit; nama APK memuat `rusak` → ditolak server.
Dengan server dev (`:8080`): `NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1` dan `ADMIN_ORIGINS`
server memuat `http://localhost:3000`.

### Undangan karyawan — `/undangan/<kode>` & `/.well-known/assetlinks.json`
Tautan undangan/reset password karyawan dari pemilik (Tim › karyawan › Undang, di app atau dasbor web). Halaman
mengambil `GET {API}/invites/{kode}` di server, `noindex`, tanpa Referer. Dengan aplikasi terpasang, Android App
Links membuka tautan langsung di aplikasi — butuh env `ANDROID_APP_LINKS_SHA256` (sidik jari SHA-256 kunci unggah
**dan** kunci Play App Signing, dipisah koma; lihat `.env.example`). Env kosong → `assetlinks.json` = `[]`.
Mode tiruan dasbor (`NEXT_PUBLIC_OWNER_MOCK=1`): kode apa saja (10 karakter) = undangan contoh, awalan `R` = reset
password, awalan `0000` = tidak berlaku. Kontrak: `sissi-pos-service/docs/api.md` "Akun karyawan & Ruang Karyawan".

### Linter
```bash
npm run lint
```

---

## 💡 Keunggulan Maintenance
1. **Centralized Data (`src/constants/`)**: Ingin mengubah harga, pertanyaan FAQ, atau teks navigasi? Cukup edit file di folder `src/constants/` tanpa perlu membongkar struktur komponen UI.
2. **Design Tokens (`globals.css`)**: Palet warna brand (`#f1702c`, `#f3f6f5`, `#292e31`, dll.) didefinisikan secara semantik di `@theme`.
3. **Shared Components (`src/components/shared/`)**: Standar tombol, header, kartu, dan pembungkus section seragam di seluruh halaman.
