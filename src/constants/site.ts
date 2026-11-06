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

/** Alamat kantor yang tampil di kotak kontak halaman Tentang. */
export const OFFICE_ADDRESS_STREET = "Perum Rajawali Sakti L 12";
export const OFFICE_ADDRESS_AREA =
  "Kel. Simpang Baru, Kec. Tampan, Kota Pekanbaru, Riau 28293";
export const OFFICE_MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${OFFICE_ADDRESS_STREET}, ${OFFICE_ADDRESS_AREA}`,
)}`;

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
 * Cadangan APK di folder Google Drive bila server unduhan bermasalah. Folder "sissi-pos-apk" diisi OTOMATIS oleh
 * server (sissi-pos-service deploy/sync-apk-drive.sh) tiap rilis: hanya satu berkas `sissi-pos.apk` (terbaru).
 * Folder (bukan berkas) agar tautan tetap walau berkasnya diganti.
 */
export const APK_MIRROR_URL = "https://drive.google.com/drive/folders/1VR-GUWtYGdlssAf2MRJZmw2314qQkh3F";
