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
  "admin.passwd": "Ganti password",
  "admin.disable": "Nonaktifkan admin",
  "admin.enable": "Aktifkan admin",
  "admin.reset_password": "Reset password admin",
  "crash.status": "Ubah status crash",
  "subscription.payment": "Catat pembayaran",
  "subscription.payment_void": "Batalkan pembayaran",
  "subscription.extend": "Tambah hari langganan",
  "subscription.override": "Ubah batas khusus",
  "subscription.launch_trial": "Peluncuran uji coba",
  "billing_config.update": "Ubah cara bayar",
};

/** Kelompok aksi untuk chip filter audit (memetakan ke `action=a,b`). */
export const AUDIT_ACTION_GROUPS: { id: string; label: string; actions: string[] }[] = [
  { id: "auth", label: "Masuk & keluar", actions: ["auth.login", "auth.login_failed", "auth.logout"] },
  { id: "release", label: "Versi & APK", actions: ["app_version.update", "release.upload", "release.delete"] },
  { id: "business", label: "Fitur bisnis", actions: ["business_features.update"] },
  {
    id: "admin",
    label: "Kelola admin",
    actions: ["admin.create", "admin.passwd", "admin.disable", "admin.enable", "admin.reset_password"],
  },
  { id: "crash", label: "Crash", actions: ["crash.status"] },
  {
    id: "subscription",
    label: "Langganan",
    actions: [
      "subscription.payment",
      "subscription.payment_void",
      "subscription.extend",
      "subscription.override",
      "subscription.launch_trial",
      "billing_config.update",
    ],
  },
];

export const TARGET_TYPES: Record<string, string> = {
  admin: "Admin",
  app_version: "Versi aplikasi",
  release: "Rilis APK",
  business: "Bisnis",
  crash: "Crash",
  billing_config: "Cara bayar",
};

export const SUB_STATUS: Record<string, string> = {
  trial: "Uji coba",
  active: "Pro",
  grace: "Masa tenggang",
  free: "Gratis",
};

export const SUB_STATUS_HINT: Record<string, string> = {
  trial: "Pro gratis 30 hari",
  active: "Pro dibayar",
  grace: "Pro 3 hari setelah berakhir",
  free: "50 transaksi/bulan",
};

export const BILLING_CYCLES: Record<string, string> = {
  monthly: "Bulanan",
  yearly: "Tahunan",
  custom: "Periode khusus",
};

export const PAYMENT_METHODS: Record<string, string> = {
  transfer: "Transfer bank",
  qris: "QRIS",
  cash: "Tunai",
  gateway: "Payment gateway",
  other: "Lainnya",
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
  culinary: "Kuliner",
  retail: "Ritel",
  service: "Jasa",
  rental: "Penyewaan",
};

export const ROLES: Record<string, string> = {
  owner: "Pemilik",
  cashier: "Kasir",
  kitchen: "Dapur",
};

export const DEVICE_MODES: Record<string, string> = {
  owner: "Pemilik",
  cashier: "Kasir",
  main_cashier: "Kasir utama",
  kitchen: "Dapur",
};

export const CRASH_STATUS: Record<string, string> = {
  open: "Terbuka",
  resolved: "Selesai",
  ignored: "Diabaikan",
};

export const DELETION_STATUS: Record<string, string> = {
  scheduled: "Terjadwal",
  canceled: "Dibatalkan",
  purged: "Sudah dihapus",
};

export const OUTLET_STATUS: Record<string, string> = {
  open: "Buka",
  closed: "Tutup",
  active: "Aktif",
};

export function labelOf(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return "—";
  return map[key] ?? key;
}
