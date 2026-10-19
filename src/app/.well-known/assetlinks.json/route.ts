import { assetLinks } from "@/lib/appLinks";

// Android App Links: aplikasi Sissi membuka tautan undangan karyawan (`/undangan/<kode>`) langsung.
// Sidik jari SHA-256 sertifikat (kunci unggah + kunci Play App Signing) dibaca dari env saat build:
//   ANDROID_APP_LINKS_SHA256      → paket `id.sissi.pos` (daftar dipisah koma)
//   ANDROID_APP_LINKS_SHA256_DEV  → paket `id.sissi.pos.dev` (opsional)
// Env kosong → `[]` (App Links nonaktif; tautan tetap membuka halaman web undangan). Ubah env → deploy ulang.

export function GET() {
  const body = assetLinks({ prod: process.env.ANDROID_APP_LINKS_SHA256, dev: process.env.ANDROID_APP_LINKS_SHA256_DEV });
  return Response.json(body, {
    headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
  });
}
