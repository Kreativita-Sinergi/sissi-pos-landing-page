// Label Bahasa Indonesia untuk nilai kontrak Admin platform.

export const AUDIT_ACTIONS: Record<string, string> = {
  "auth.login": "Masuk",
  "auth.login_failed": "Gagal masuk",
  "auth.logout": "Keluar",
  "app_version.update": "Ubah versi aplikasi",
  "release.upload": "Unggah APK",
  "release.delete": "Hapus APK",
  "business_features.update": "Ubah fitur bisnis",
  "admin.create": "Buat admin",
  "admin.passwd": "Ganti password admin",
  "admin.disable": "Nonaktifkan admin",
  "admin.enable": "Aktifkan admin",
};

export const TARGET_TYPES: Record<string, string> = {
  admin: "Admin",
  app_version: "Versi aplikasi",
  release: "Rilis APK",
  business: "Bisnis",
};

export const LOGIN_FAIL_REASONS: Record<string, string> = {
  password: "password salah",
  inactive: "admin nonaktif",
  locked: "terkunci",
};

export const PROVIDERS: { value: "manual" | "fake" | "midtrans" | "xendit"; label: string; hint: string }[] = [
  { value: "midtrans", label: "Midtrans", hint: "QRIS & e-wallet lewat Midtrans" },
  { value: "xendit", label: "Xendit", hint: "QRIS & e-wallet lewat Xendit" },
  { value: "manual", label: "Manual", hint: "Kasir mengonfirmasi pembayaran sendiri" },
  { value: "fake", label: "Tiruan", hint: "Hanya untuk server development" },
];

export const BUSINESS_TYPES: Record<string, string> = {
  kuliner: "Kuliner",
  ritel: "Ritel",
  jasa: "Jasa",
  penyewaan: "Penyewaan",
};

export const ROLES: Record<string, string> = {
  owner: "Pemilik",
  cashier: "Kasir",
  kitchen: "Dapur",
};

export const DEVICE_MODES: Record<string, string> = {
  owner: "Pemilik",
  cashier: "Kasir",
  kitchen: "Dapur",
};

export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key;
}
