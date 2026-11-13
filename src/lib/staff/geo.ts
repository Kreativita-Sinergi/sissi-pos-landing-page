// Lokasi browser untuk absen web. Diminta hanya saat tombol Masuk/Pulang ditekan. Gagal/ditolak → `geo: null`
// (server yang memutuskan: aturan outlet "Tolak" → OUTSIDE_AREA). Browser tidak bisa mendeteksi lokasi palsu.
import type { ClockGeoInput } from "./types";

export type GeoFailure = "denied" | "unavailable" | "timeout" | "unsupported";
export type GeoResult = { geo: ClockGeoInput; failure: null } | { geo: null; failure: GeoFailure };

const TIMEOUT_MS = 12_000;

export function locate(timeoutMs = TIMEOUT_MS): Promise<GeoResult> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator) || !window.isSecureContext)
    return Promise.resolve({ geo: null, failure: "unsupported" });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: GeoResult) => {
      if (done) return;
      done = true;
      clearTimeout(guard);
      resolve(r);
    };
    // Cadangan: sebagian browser tidak pernah memanggil balik bila dialog izin diabaikan.
    const guard = setTimeout(() => finish({ geo: null, failure: "timeout" }), timeoutMs + 3_000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return finish({ geo: null, failure: "unavailable" });
        finish({
          geo: {
            lat: Math.round(latitude * 1e6) / 1e6,
            lng: Math.round(longitude * 1e6) / 1e6,
            // Kontrak: 0–100.000 meter.
            accuracy_m: Math.min(100_000, Math.max(0, Math.round(Number.isFinite(accuracy) ? accuracy : 100_000))),
          },
          failure: null,
        });
      },
      (err) =>
        finish({
          geo: null,
          failure: err.code === err.PERMISSION_DENIED ? "denied" : err.code === err.TIMEOUT ? "timeout" : "unavailable",
        }),
      // maximumAge 0: setelah ditolak "di luar area" karyawan mendekat lalu mencoba lagi — jangan pakai posisi lama.
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

export const GEO_FAILURE_TEXT: Record<GeoFailure, string> = {
  denied: "Izin lokasi ditolak",
  unavailable: "Lokasi tidak tersedia",
  timeout: "Lokasi tidak ditemukan tepat waktu",
  unsupported: "Browser tidak mendukung lokasi",
};

// ——— Status izin lokasi (2026-11-13) ———
// Setelah izin ditolak, situs tidak bisa meminta lagi atau membuka pengaturan browser: karyawan harus mengubahnya
// sendiri. Status dibaca lewat Permissions API (Safari ≥ 16, Chrome, Firefox) agar panduan muncul sebelum absen.

export type GeoPermission = "granted" | "denied" | "prompt" | "unknown";

async function permissionStatus(): Promise<PermissionStatus | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;
    return await navigator.permissions.query({ name: "geolocation" as PermissionName });
  } catch {
    return null;
  }
}

export async function geoPermission(): Promise<GeoPermission> {
  const s = await permissionStatus();
  return s ? (s.state as GeoPermission) : "unknown";
}

export type GeoPlatform = "ios" | "android" | "desktop";

/** Platform untuk langkah membuka izin. iPadOS terbaru ber-UA Mac → dikenali dari layar sentuh. */
export function geoPlatform(): GeoPlatform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "desktop";
}
