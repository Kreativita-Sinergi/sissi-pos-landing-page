// Label Bahasa Indonesia untuk nilai kontrak Admin platform.

export const AUDIT_ACTIONS: Record<string, string> = {
  "auth.login": "Masuk",
  "auth.login_failed": "Gagal masuk",
  "auth.logout": "Keluar",
  "app_version.update": "Ubah versi aplikasi",
  "release.upload": "Unggah APK",
  "release.delete": "Hapus APK",
  "business_features.update": "Ubah fitur bisnis",
  "business.test_mark": "Tandai akun uji",
  "admin.create": "Buat admin",
  "admin.passwd": "Ganti kata sandi",
  "admin.disable": "Nonaktifkan admin",
  "admin.enable": "Aktifkan admin",
  "admin.reset_password": "Reset kata sandi admin",
  "crash.status": "Ubah status crash",
  "subscription.payment": "Catat pembayaran",
  "subscription.payment_void": "Batalkan pembayaran",
  "subscription.extend": "Tambah hari langganan",
  "subscription.override": "Ubah batas khusus",
  "subscription.launch_trial": "Peluncuran uji coba",
  "subscription.trial_shortened": "Uji coba dipersingkat ke 14 hari",
  "billing_config.update": "Ubah cara bayar",
};

/** Kelompok aksi untuk chip filter audit (memetakan ke `action=a,b`). */
export const AUDIT_ACTION_GROUPS: { id: string; label: string; actions: string[] }[] = [
  { id: "auth", label: "Masuk & keluar", actions: ["auth.login", "auth.login_failed", "auth.logout"] },
  { id: "release", label: "Versi & APK", actions: ["app_version.update", "release.upload", "release.delete"] },
  { id: "business", label: "Fitur bisnis", actions: ["business_features.update", "business.test_mark"] },
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
      "subscription.trial_shortened",
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
  trial: "Pro gratis 14 hari",
  active: "Pro dibayar",
  grace: "Pro +3 hari setelah habis",
  free: "50 transaksi/bulan",
};

export const BILLING_CYCLES: Record<string, string> = {
  monthly: "Bulanan",
  semiannual: "6 Bulan",
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
  password: "kata sandi salah",
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
  staff: "Karyawan",
  waiter: "Pelayan",
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

export const CRASH_LEVEL: Record<string, string> = {
  info: "Info",
  warning: "Peringatan",
  error: "Error",
};

export const crashLevelTone = (l: string | undefined) => (l === "error" ? "danger" : l === "warning" ? "warning" : "neutral");

/** `800x1280@1.5` → `800×1280 @1.5`; tidak sah dikembalikan apa adanya. */
export function formatScreen(s: string | null | undefined): string {
  if (!s) return "";
  const m = /^(\d+)x(\d+)(?:@([\d.]+))?$/.exec(s.trim());
  return m ? `${m[1]}×${m[2]}${m[3] ? ` @${m[3]}` : ""}` : s;
}

/** "Xiaomi Redmi Pad SE · Android 14 (SDK 34) · 800×1280 @1.5" — bagian kosong dilewati; semua kosong → "". */
export function deviceLine(d: {
  brand?: string | null;
  model?: string | null;
  os?: string | null;
  screen?: string | null;
}): string {
  const brand = d.brand?.trim() ?? "";
  const model = d.model?.trim() ?? "";
  // Model kadang sudah diawali merek ("Samsung SM-T295") — jangan diulang.
  const name = brand && model.toLowerCase().startsWith(brand.toLowerCase()) ? model : [brand, model].filter(Boolean).join(" ");
  return [name, d.os?.trim() ?? "", formatScreen(d.screen)].filter(Boolean).join(" · ");
}
