// Kontrak hapus akun lewat web (tanpa memasang aplikasi), sesuai kebijakan Google Play.
// Endpoint mengikuti pola OTP di sissi-service (`/auth/password/forgot` → verifikasi kode).
export const ACCOUNT_DELETION_ENDPOINTS = {
  // Body: { identifier } → data: Otp. Respons identik untuk akun yang ada/tidak ada.
  request: "/account/deletion/request",
  // Body: { identifier, code, reason? } → data: { purge_after }.
  confirm: "/account/deletion/confirm",
} as const;

// Masa tunggu sebelum data dihapus permanen; selama masa ini pemilik bisa membatalkan dengan masuk kembali.
export const ACCOUNT_DELETION_GRACE_DAYS = 30;

export const ACCOUNT_DELETION_REASON_MAX = 300;

// Jalur cadangan bila layanan hapus akun sedang tidak tersedia.
export const PRIVACY_EMAIL = "sissikreatifteknologi@gmail.com";
