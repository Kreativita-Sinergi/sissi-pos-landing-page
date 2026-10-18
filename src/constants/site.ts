/**
 * Tautan & fakta situs yang dipakai di banyak tempat.
 * Ubah di sini saja agar seluruh halaman ikut berubah.
 */

/** Halaman aplikasi di Google Play (application ID rilis: `id.sissi.pos`). */
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=id.sissi.pos";

/** Nomor WhatsApp dukungan — sama dengan `SUPPORT_WHATSAPP` di aplikasi. */
export const SUPPORT_WHATSAPP_NUMBER = "6285161462806";
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`;
export const SUPPORT_WHATSAPP_LABEL = "+62 851-6146-2806";

/** Versi Android minimum (minSdk 24 = Android 7.0). */
export const MIN_ANDROID = "Android 7.0";

/**
 * APK langsung untuk HP tanpa Google Play (mis. Huawei). Berkas dilayani nginx situs Sissi
 * (`sissi-service/deploy/publish-apk.sh`); `latest.json` mengizinkan CORS dari kasir.sissi.id.
 */
export const APK_BASE_URL = "https://apipos.sissi.id/unduh";
export const APK_LATEST_URL = `${APK_BASE_URL}/sissi-pos-latest.apk`;
export const APK_LATEST_JSON_URL = `${APK_BASE_URL}/latest.json`;

/**
 * Cadangan APK di folder Google Drive bila server unduhan bermasalah. Folder (bukan berkas) agar
 * tautan tetap; tiap rilis cukup unggah APK baru ke folder ini dan hapus yang lama.
 */
export const APK_MIRROR_URL =
  "https://drive.google.com/drive/folders/1iJTowvSBdAr79D5UAOZCWxM5YR_CEK7B?usp=drive_link";
