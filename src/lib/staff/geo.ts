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
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    );
  });
}

export const GEO_FAILURE_TEXT: Record<GeoFailure, string> = {
  denied: "Izin lokasi ditolak",
  unavailable: "Lokasi tidak tersedia",
  timeout: "Lokasi tidak ditemukan tepat waktu",
  unsupported: "Browser tidak mendukung lokasi",
};
