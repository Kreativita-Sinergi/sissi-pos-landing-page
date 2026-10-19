// Android App Links & tautan undangan karyawan (kontrak: sissi-pos-service/docs/api.md
// "Akun karyawan & Ruang Karyawan › Undangan").

/** Paket aplikasi Android rilis (lihat sissi-pos-app/docs/rilis-android.md). */
export const ANDROID_PACKAGE = "id.sissi.pos";
export const ANDROID_PACKAGE_DEV = "id.sissi.pos.dev";

/** "a6991f…" atau "A6:99:1F:…" (dipisah koma) → ["A6:99:1F:…"]; selain 32 byte heksadesimal dibuang. */
export function normalizeFingerprints(raw: string | undefined): string[] {
  const out: string[] = [];
  for (const part of (raw ?? "").split(",")) {
    const hex = part.trim().replace(/:/g, "").toUpperCase();
    if (!/^[0-9A-F]{64}$/.test(hex)) continue;
    const fp = hex.match(/.{2}/g)!.join(":");
    if (!out.includes(fp)) out.push(fp);
  }
  return out;
}

export type AssetStatement = {
  relation: string[];
  target: { namespace: "android_app"; package_name: string; sha256_cert_fingerprints: string[] };
};

/** Isi `/.well-known/assetlinks.json`; paket tanpa sidik jari tidak ditulis (semua kosong → `[]`). */
export function assetLinks(env: { prod?: string; dev?: string }): AssetStatement[] {
  return [
    { name: ANDROID_PACKAGE, raw: env.prod },
    { name: ANDROID_PACKAGE_DEV, raw: env.dev },
  ].flatMap(({ name, raw }) => {
    const sha256_cert_fingerprints = normalizeFingerprints(raw);
    return sha256_cert_fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: { namespace: "android_app" as const, package_name: name, sha256_cert_fingerprints },
          },
        ]
      : [];
  });
}

// ——— Kode undangan ———

/** Crockford base32 tanpa I/L/O/U. */
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{10}$/;

/** Kode dari URL/ketikan → 10 karakter huruf besar tanpa tanda hubung/spasi; `null` bila bentuknya salah. */
export function normalizeInviteCode(input: string): string | null {
  let s = input;
  try {
    s = decodeURIComponent(input);
  } catch {
    // Biarkan apa adanya.
  }
  const code = s.replace(/[\s-]/g, "").toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** "K7M2Q9XH4T" → "K7M2Q-9XH4T" (tampilan saja). */
export function formatInviteCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

/**
 * Tautan intent Android: membuka aplikasi Sissi pada `/undangan/<kode>`; tanpa aplikasi → `fallbackUrl`
 * (halaman unduh). Dipakai tombol "Buka di aplikasi" karena App Links tidak memicu aplikasi saat pengguna sudah
 * berada di halaman yang sama di browser.
 */
export function inviteIntentUrl(code: string, host: string, fallbackUrl: string): string {
  return (
    `intent://${host}/undangan/${code}#Intent;scheme=https;package=${ANDROID_PACKAGE};` +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
  );
}
