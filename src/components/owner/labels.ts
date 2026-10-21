// Label Bahasa Indonesia untuk nilai kontrak Dasbor pemilik.
import { DEVICE_MODES, labelOf } from "@/components/admin/labels";

export { labelOf };

export const SALE_STATUS: Record<string, string> = {
  paid: "Lunas",
  unpaid: "Belum bayar (kasbon)",
  partial: "Sebagian",
  open: "Berjalan",
  void: "Dibatalkan",
  refunded: "Dikembalikan",
};

/** Label pendek untuk chip/badge. */
export const SALE_STATUS_SHORT: Record<string, string> = {
  paid: "Lunas",
  unpaid: "Kasbon",
  partial: "Sebagian",
  open: "Berjalan",
  void: "Dibatalkan",
  refunded: "Dikembalikan",
};

export const SALE_STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "brand"> = {
  paid: "success",
  unpaid: "warning",
  partial: "warning",
  open: "brand",
  void: "danger",
  refunded: "danger",
};

/** Label DP reservasi (`SaleListItem.deposit`, istilah app: "DP", "DP hangus", "DP dikembalikan"). */
export const DEPOSIT_STATE: Record<string, { short: string; long: string; tone: "success" | "warning" | "danger" | "neutral" | "brand" }> = {
  held: { short: "DP tertahan", long: "DP reservasi · tamu belum datang", tone: "brand" },
  to_process: { short: "DP perlu diproses", long: "DP perlu diproses · reservasi batal/tidak datang", tone: "warning" },
  forfeited: { short: "DP hangus", long: "DP hangus", tone: "success" },
  refunded: { short: "DP dikembalikan", long: "DP dikembalikan", tone: "danger" },
};

/** Label penanda pembayaran (`sale_payments.purpose`). */
export const PAYMENT_PURPOSE: Record<string, string> = {
  deposit: "DP reservasi",
  deposit_refund: "DP dikembalikan",
};

export const METHODS: Record<string, string> = {
  cash: "Tunai",
  qris: "QRIS",
  card: "Kartu",
  transfer: "Transfer",
  split: "Campuran",
  credit: "Kasbon",
};

export const METHOD_COLORS: Record<string, string> = {
  cash: "#17694a",
  qris: "#f1702c",
  card: "#3b6fd4",
  transfer: "#8a5cc7",
  split: "#b0b8b5",
  credit: "#e0a43a",
};

export const ORDER_TYPES: Record<string, string> = {
  dine_in: "Makan di tempat",
  takeaway: "Bawa pulang",
  take_away: "Bawa pulang",
  service: "Servis",
  rental: "Sewa",
};

export function orderTypeLabel(v: string | null | undefined): string {
  if (!v) return "Tanpa jenis";
  return ORDER_TYPES[v] ?? v;
}

export const DEVICE_MODE_LABELS: Record<string, string> = {
  ...DEVICE_MODES,
  customer_display: "Layar pelanggan",
};

export const WEEKDAYS = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
export const WEEKDAYS_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function planLabel(p: { plan: string; status: string; days_left: number | null }): { text: string; tone: "brand" | "neutral" | "warning" } {
  if (p.status === "trial") return { text: p.days_left !== null ? `Uji coba Pro · ${p.days_left} hari lagi` : "Uji coba Pro", tone: "brand" };
  if (p.status === "grace") return { text: "Pro · masa tenggang", tone: "warning" };
  if (p.plan === "pro") return { text: "Pro", tone: "brand" };
  return { text: "Gratis", tone: "neutral" };
}

export const hourLabel = (h: number) => `${String(h).padStart(2, "0")}.00`;

/** Jenis log aktivitas (`GET /owner/activity`), urutan tampil chip. */
export const ACTIVITY_KINDS = ["void", "refund", "manual_discount", "shift_closed", "cash_in", "cash_out", "new_device", "change"] as const;

export const ACTIVITY_KIND: Record<string, string> = {
  void: "Pembatalan",
  refund: "Pengembalian dana",
  manual_discount: "Diskon manual",
  shift_closed: "Tutup kasir",
  cash_in: "Kas masuk",
  cash_out: "Kas keluar",
  new_device: "Perangkat baru",
  change: "Perubahan data",
};

/** Entri `change`: nama entitas (kata benda, huruf kecil) untuk kalimat "mengubah produk X". */
export const CHANGE_ENTITY: Record<string, string> = {
  products: "produk",
  product_variants: "varian",
  categories: "kategori",
  modifier_groups: "grup modifier",
  discounts: "diskon",
  recipes: "resep",
  outlets: "outlet",
  business_settings: "pengaturan usaha",
  employees: "karyawan",
};

/** Entri `change`: nama kolom (huruf kecil, dipakai di tengah kalimat). Kunci `entity.field` mengalahkan `field`. */
export const CHANGE_FIELD: Record<string, string> = {
  name: "nama",
  price: "harga",
  cost_price: "modal",
  category_id: "kategori",
  is_active: "status",
  sku: "SKU",
  barcode: "barcode",
  unit: "satuan",
  track_stock: "lacak stok",
  min_stock: "stok minimum",
  is_taxable: "kena pajak",
  image_url: "foto",
  modifier_group_ids: "modifier",
  variant_options: "pilihan varian",
  min_select: "pilihan minimum",
  max_select: "pilihan maksimum",
  options: "opsi",
  type: "jenis",
  value: "nilai",
  scope: "berlaku untuk",
  target_ids: "target",
  min_purchase: "minimal belanja",
  starts_at: "mulai berlaku",
  ends_at: "berakhir",
  auto_apply: "otomatis",
  items: "isi resep",
  address: "alamat",
  status: "status",
  role: "peran",
  pin_hash: "PIN",
  payroll: "pengaturan gaji",
  "discounts.type": "jenis diskon",
  "discounts.value": "besar diskon",
};

/** Kunci `settings.<kunci>` (outlet & usaha) → label ramah. */
export const SETTINGS_KEY: Record<string, string> = {
  taxes: "Pajak",
  service_fee: "Biaya layanan",
  receipt: "Struk",
  rounding: "Pembulatan",
  transaction: "Aturan transaksi",
  payment_methods: "Metode pembayaran (QRIS & rekening)",
  loyalty: "Loyalti",
  attendance: "Aturan absensi",
  shift_rules: "Aturan shift",
  timezone: "Zona waktu",
  features: "Fitur (meja & dapur)",
  self_order: "Pesan & Bayar Mandiri",
  printer: "Printer",
  kitchen: "Dapur",
};
