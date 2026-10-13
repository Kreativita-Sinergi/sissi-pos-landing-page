// Unggah foto produk/varian dari dasbor pemilik: POST {API}/owner/uploads/images (multipart `file`, JPEG/PNG/WebP
// ≤ 2 MB dicek dari isi, `data = { url }`, 201). Kontrak: sissi-service/docs/api.md "Dasbor pemilik (web)".
// Sama dengan aplikasi (`product_photo_field.dart`): foto diperkecil maks. 800×800 dan dikompres JPEG kualitas 80
// sebelum diunggah; URL hasil baru tersimpan ke `image_url` saat form produk disimpan (lewat /owner/changes).
// Penanganan galat/timeout/401 meniru `api.ts` (tanpa mengubahnya).
import { API_BASE_URL, ApiError, type ApiFieldError } from "@/lib/sissiApi";
import { OWNER_MOCK, ownerApi } from "./api";

export const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
/** Sisi terpanjang foto setelah diperkecil (aplikasi: `maxWidth/maxHeight: 800`). */
export const PHOTO_MAX_SIDE = 800;
const PHOTO_QUALITY = 0.8;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
export const PHOTO_ACCEPT = ACCEPTED.join(",");
const TIMEOUT_MS = 60_000;

/** Memperkecil & mengompres foto di browser → JPEG ≤ 800 px (latar putih untuk PNG transparan). */
export async function compressPhoto(file: File): Promise<Blob> {
  if (!ACCEPTED.includes(file.type)) throw new ApiError("Pilih foto JPG, PNG, atau WebP.", 0, "VALIDATION_ERROR");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ApiError("Foto tidak bisa dibaca. Pilih berkas JPG, PNG, atau WebP lain.", 0, "VALIDATION_ERROR");
  }
  const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ApiError("Browser tidak bisa memproses foto.", 0, "BAD_RESPONSE");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", PHOTO_QUALITY));
  if (!blob) throw new ApiError("Browser tidak bisa memproses foto.", 0, "BAD_RESPONSE");
  if (blob.size > PHOTO_MAX_BYTES) throw new ApiError("Foto terlalu besar (maks. 2 MB).", 0, "VALIDATION_ERROR");
  return blob;
}

type UploadResponse = {
  success: boolean;
  message?: string;
  data?: { url?: string };
  error?: { code?: string; details?: ApiFieldError[] };
};

function fallbackCode(status: number): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 413) return "VALIDATION_ERROR";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return "BAD_RESPONSE";
}

function retryAfterOf(value: string | null): number | null {
  const s = Number(value);
  return value && Number.isFinite(s) && s > 0 ? Math.ceil(s) : null;
}

/** Sesi habis: picu pengalihan ke /masuk lewat panggilan biasa `api.ts` (handler 401 tidak diekspor). */
function signalUnauthorized() {
  ownerApi()
    .then((api) => api.subscription())
    .catch(() => {});
}

/** Mode tiruan: URL data lokal (tidak diunggah). */
function asDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new ApiError("Foto tidak bisa dibaca.", 0, "BAD_RESPONSE"));
    r.readAsDataURL(blob);
  });
}

/** Kompres lalu unggah foto; mengembalikan URL publiknya. */
export async function uploadProductPhoto(file: File, signal?: AbortSignal): Promise<string> {
  const blob = await compressPhoto(file);
  if (OWNER_MOCK) return asDataUrl(blob);

  const form = new FormData();
  const base = file.name.replace(/\.[^.]*$/, "").slice(0, 60) || "foto";
  form.append("file", blob, `${base}.jpg`);
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const sig = signal && typeof AbortSignal.any === "function" ? AbortSignal.any([timeout, signal]) : timeout;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/owner/uploads/images`, {
      method: "POST",
      headers: { Accept: "application/json", "X-Sissi-Owner": "1" },
      body: form,
      credentials: "include",
      cache: "no-store",
      signal: sig,
    });
  } catch (err) {
    if (signal?.aborted) throw new ApiError("Permintaan dibatalkan.", 0, "ABORTED");
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    throw new ApiError(
      isTimeout ? "Unggah foto terlalu lama. Periksa koneksi lalu coba lagi." : "Unggah foto perlu koneksi internet. Periksa koneksi lalu coba lagi.",
      0,
      isTimeout ? "TIMEOUT" : "NETWORK_ERROR"
    );
  }

  let json: UploadResponse | null = null;
  try {
    json = (await res.json()) as UploadResponse;
  } catch {
    // Bukan JSON (mis. halaman galat proxy).
  }
  if (res.ok && json?.success && json.data?.url) return json.data.url;

  if (res.status === 401) signalUnauthorized();
  throw new ApiError(
    res.status === 413 ? "Foto terlalu besar (maks. 2 MB)." : json?.message || "Foto gagal diunggah. Coba lagi sebentar lagi.",
    res.status,
    json?.error?.code || fallbackCode(res.status),
    json?.error?.details ?? [],
    retryAfterOf(res.headers.get("Retry-After"))
  );
}

/**
 * Hapus foto unggahan lama (best effort): POST {API}/owner/uploads/images/delete `{ url }`. Dipanggil setelah foto
 * produk/varian diganti/dihapus dan perubahan record sudah `applied`. Server menolak bila foto masih dirujuk record
 * mana pun (409 FILE_IN_USE) atau bukan unggahan bisnis ini (422) — semua galat diabaikan. Mode tiruan & URL data
 * lokal dilewati.
 */
export async function deleteUploadedPhoto(url: string | null | undefined): Promise<void> {
  if (!url || OWNER_MOCK || url.startsWith("data:")) return;
  try {
    await fetch(`${API_BASE_URL}/owner/uploads/images/delete`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Sissi-Owner": "1" },
      body: JSON.stringify({ url }),
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Best effort: foto yatim dibersihkan lain kali.
  }
}

/** Hapus beberapa foto lama (unik, berurutan agar tidak memicu batas laju). */
export async function deleteUploadedPhotos(urls: (string | null | undefined)[]): Promise<void> {
  for (const u of new Set(urls.filter((x): x is string => !!x))) await deleteUploadedPhoto(u);
}
