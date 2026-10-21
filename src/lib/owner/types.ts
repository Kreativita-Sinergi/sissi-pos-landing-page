// Tipe kontrak Dasbor pemilik (web) — sissi-service/docs/api.md "Dasbor pemilik (web)".
// Semua uang = rupiah bulat; waktu = RFC3339 UTC; tanggal = `YYYY-MM-DD` di zona usaha (`business.timezone`).

import type { OwnerTimezone } from "./tz";

export type BusinessType = "culinary" | "retail" | "service" | "rental";

export type OwnerUser = { id: string; name: string; email: string };

export type OwnerBusiness = {
  id: string;
  name: string;
  type: BusinessType;
  category: string;
  /** Zona waktu usaha (`business_settings.settings.timezone`); server mengisi WIB bila kosong. */
  timezone: OwnerTimezone;
};

/** GET /owner/staff — semua pengguna bisnis untuk filter (termasuk nonaktif/terhapus). */
export type StaffRole = "owner" | "cashier" | "kitchen" | "staff";
/** Hasil `POST /employees/{id}/invite` (api.md "Akun karyawan & Ruang Karyawan"); kode tidak bisa dibaca ulang. */
export type EmployeeInvite = {
  code: string;
  url: string;
  purpose: "invite" | "reset_password";
  expires_at: string;
};

export type StaffMember = { id: string; name: string; role: StaffRole; is_active: boolean; deleted: boolean };

export type OwnerOutlet = { id: string; name: string; address: string | null; status: "open" | "closed" };

export type OwnerPlan = {
  plan: "free" | "pro";
  status: "active" | "trial" | "grace" | "free";
  enforced: boolean;
  features: string[];
  ends_at: string | null;
  days_left: number | null;
  tx_limit: number | null;
  tx_this_month: number;
};

export type OwnerSession = {
  user: OwnerUser;
  business: OwnerBusiness;
  outlets: OwnerOutlet[];
  subscription: OwnerPlan;
  /** `confirmed_until` = batas konfirmasi ulang untuk aksi sensitif (null/kosong = perlu konfirmasi). */
  session: { expires_at: string; idle_expires_at: string; confirmed_until?: string | null };
};

export type Totals = {
  revenue: number;
  transactions: number;
  average: number;
  items_sold: number;
  gross_profit: number | null;
};

export type ProductSales = {
  key: string;
  name: string;
  variant_name: string | null;
  is_custom: boolean;
  quantity: number;
  revenue: number;
};

export type SaleStatus = "paid" | "unpaid" | "partial" | "open" | "void" | "refunded";
/** Metode transaksi (filter & `payment_method`). */
export type SaleMethod = "cash" | "qris" | "card" | "transfer" | "split" | "credit";
/** Metode satu pembayaran (`sale_payments`). */
export type PaymentMethod = "cash" | "qris" | "card" | "transfer";

export type SaleListItem = {
  id: string;
  receipt_no: string;
  paid_at: string;
  outlet_id: string;
  outlet_name: string;
  cashier_id: string;
  cashier_name: string;
  customer_name: string | null;
  table_name: string | null;
  order_type: string | null;
  status: SaleStatus | (string & {});
  payment_method: SaleMethod | (string & {});
  total: number;
  paid_total: number;
  items_count: number;
};

export type ShiftListItem = {
  id: string;
  outlet_id: string;
  outlet_name: string;
  device_name: string | null;
  cashier_id: string;
  cashier_name: string;
  status: "open" | "closed";
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  expected_cash: number;
  closing_cash: number | null;
  difference: number | null;
  sales_count: number;
  sales_total: number;
  cash_in: number;
  cash_out: number;
  /** Kas seharusnya menurut data di server (kas awal + tunai shift + kas masuk − kas keluar). */
  expected_cash_server: number;
  /** Shift tertutup yang `expected_cash`-nya (dicatat perangkat) ≠ hitungan server. */
  expected_mismatch: boolean;
};

export type OwnerDevice = {
  id: string;
  name: string;
  mode: string;
  outlet_id: string | null;
  outlet_name: string | null;
  last_seen_at: string | null;
  app_version: string | null;
};

export type Summary = {
  date: string;
  generated_at: string;
  today: Totals;
  yesterday: Totals;
  yesterday_same_time: Totals;
  last_week_same_day: Totals;
  hourly: { hour: number; revenue: number; count: number }[];
  cancelled: { count: number; amount: number };
  open_orders: { count: number; total: number };
  credit: { outstanding: number; count: number };
  top_products: ProductSales[] | null;
  recent_sales: SaleListItem[];
  open_shifts: ShiftListItem[];
  devices: OwnerDevice[];
  locked: string[];
};

export type SalesReport = {
  from: string;
  to: string;
  days: number;
  hourly: boolean;
  revenue: number;
  transactions: number;
  average: number;
  discounts: number;
  tax: number;
  service_fee: number;
  rounding: number;
  net_items: number;
  cost: number;
  net_items_with_cost: number;
  items_without_cost: number;
  items_sold: number;
  gross_profit: number | null;
  previous: { from: string; to: string; revenue: number; transactions: number };
  growth_percent: number | null;
  credit: { outstanding: number; count: number };
  cancelled: { count: number; amount: number };
  per_method: { method: PaymentMethod | (string & {}); amount: number }[];
  buckets: { start: string; revenue: number; count: number }[];
  cashiers: { cashier_id: string; name: string; count: number; revenue: number; average: number; cancelled: number }[];
  order_types: { order_type: string | null; count: number; revenue: number }[];
  products: ProductSales[] | null;
  products_total: number | null;
  per_hour: number[] | null;
  per_weekday: number[] | null;
  peak_hour: number | null;
  peak_weekday: number | null;
  locked: string[];
};

export type OutletRow = {
  outlet_id: string;
  name: string;
  status: "open" | "closed" | (string & {});
  revenue: number;
  transactions: number;
  average: number;
  gross_profit: number | null;
  cancelled_count: number;
  credit_outstanding: number;
  share_percent: number;
};

export type OutletsReport = {
  from: string;
  to: string;
  outlets: OutletRow[];
  total: {
    revenue: number;
    transactions: number;
    average: number;
    gross_profit: number | null;
    cancelled_count: number;
    credit_outstanding: number;
  };
};

export type SaleItem = {
  name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  modifiers: { name: string; price: number }[];
  discount: number;
  subtotal: number;
  note: string | null;
  cost_price: number | null;
  is_custom: boolean;
};

export type SalePayment = {
  id: string;
  method: PaymentMethod | (string & {});
  amount: number;
  received: number | null;
  change: number | null;
  paid_at: string;
  cashier_name: string | null;
};

export type SaleDetail = SaleListItem & {
  /** Belum dikirim server (2026-10-13); dipakai sebagai `base_updated_at` pembatalan bila ada. */
  updated_at?: string;
  subtotal: number;
  discount_total: number;
  service_fee: number;
  tax_total: number;
  rounding: number;
  amount_paid: number;
  change_amount: number;
  notes: string | null;
  void_reason: string | null;
  approved_by_name: string | null;
  settled_at: string | null;
  due_at: string | null;
  queue_no: number | null;
  customer: { id: string; name: string; phone: string | null } | null;
  items: SaleItem[];
  discounts: { name: string; amount: number }[];
  taxes: { name: string; rate_bp: number; amount: number }[];
  payments: SalePayment[];
};

export type ShiftDetail = ShiftListItem & {
  notes: string | null;
  per_method: { method: PaymentMethod | (string & {}); amount: number }[];
  cash_movements: {
    id: string;
    type: "in" | "out";
    amount: number;
    reason: string | null;
    cashier_name: string | null;
    created_at: string;
  }[];
  cancelled: { count: number; amount: number };
};

export type SalesSort = "newest" | "oldest" | "total_desc";

export type RangeQuery = { from?: string; to?: string; outlet_id?: string };

export type SalesQuery = RangeQuery & {
  status?: string[];
  method?: string[];
  cashier_id?: string;
  q?: string;
  sort?: SalesSort;
  page?: number;
  per_page?: number;
};

export type ShiftsQuery = RangeQuery & {
  status?: "open" | "closed" | "";
  page?: number;
  per_page?: number;
};

export type PageMeta = { page: number; per_page: number; total: number };

export type SalesPage = {
  items: SaleListItem[];
  meta: PageMeta;
  summary: { count: number; total: number };
};

export type ShiftsPage = { items: ShiftListItem[]; meta: PageMeta };

/** Jenis entri log aktivitas (`GET /owner/activity`). */
export type ActivityKind = "void" | "refund" | "manual_discount" | "shift_closed" | "cash_in" | "cash_out" | "new_device" | "change";

/** Satu kolom yang berubah pada entri `change` (nilai JSON apa adanya; kolom rahasia → before/after `null`). */
export type ActivityFieldChange = { field: string; before: unknown; after: unknown };

/**
 * Satu entri log aktivitas turunan. Kolom yang tidak relevan untuk jenisnya = `null`.
 * `ref_id`: id transaksi (void/refund/manual_discount), id shift (shift_closed/cash_in/cash_out), atau id record
 * yang berubah (change).
 */
export type ActivityItem = {
  kind: ActivityKind;
  at: string;
  outlet_id: string | null;
  outlet_name: string | null;
  actor: string | null;
  /** Yang menyetujui (void/refund). */
  approver: string | null;
  ref_id: string | null;
  receipt_no: string | null;
  amount: number | null;
  /** Alasan / nama diskon / catatan kasir (bisa string kosong). */
  note: string | null;
  expected: number | null;
  counted: number | null;
  difference: number | null;
  /** `change`: tabel yang berubah (`products`, `outlets`, `business_settings`, …); `note` = nama record. */
  entity?: string | null;
  op?: "create" | "update" | "delete" | null;
  /** `change`: create = hanya kolom terisi; delete = `[]`. Pengaturan per kunci: `settings.<kunci>`. */
  changes?: ActivityFieldChange[] | null;
  /** `change`: nama perangkat atau `"Dasbor web"`. */
  device?: string | null;
};

export type ActivityQuery = RangeQuery & {
  kind?: ActivityKind[];
  page?: number;
  /** ≤ 100 (bawaan server 50). */
  per_page?: number;
};

export type ActivityPage = { items: ActivityItem[]; meta: PageMeta };

export type LoginInput = { identifier: string; password: string; remember_me?: boolean; device_id?: string };
export type GoogleLoginInput = { id_token: string; remember_me?: boolean; device_id?: string };

// ——— Tahap 2–3: kelola data lewat mesin sync (api.md "Dasbor pemilik (web) › Kelola data") ———

/** Entitas yang bisa ditarik web (`GET /owner/data/{entity}`). */
export type DataEntity =
  | "categories"
  | "products"
  | "product_variants"
  | "modifier_groups"
  | "discounts"
  | "customers"
  | "business_settings"
  | "outlets"
  | "employees"
  | "attendances"
  | "raw_materials"
  | "suppliers"
  | "recipes"
  | "stock_opnames"
  | "purchase_orders"
  | "stock_transfers"
  | "payslips"
  | "leave_requests";

/**
 * Entitas yang bisa diubah web (`POST /owner/changes`). `outlets`: tambah (dalam kuota), ubah, hapus; metode bayar
 * (QRIS & rekening) butuh konfirmasi ulang (`CONFIRM_REQUIRED:`). `sales`: hanya void/refund. `cash_movements`: baris
 * baru untuk shift yang sedang buka.
 * `stock_movements`: hanya baris baru bertipe in/out/adjust/opname/transfer. `sale_payments`: hanya pelunasan kasbon.
 */
export type WritableEntity =
  | "categories"
  | "products"
  | "product_variants"
  | "modifier_groups"
  | "discounts"
  | "customers"
  | "business_settings"
  | "outlets"
  | "recipes"
  | "raw_materials"
  | "stock_movements"
  // Pelunasan kasbon (baru, tanpa shift), operasi stok, tim.
  | "sale_payments"
  | "stock_opnames"
  | "purchase_orders"
  | "stock_transfers"
  | "suppliers"
  | "employees"
  | "attendances"
  | "payslips"
  // Nomor 14: pembatalan transaksi (void/refund) & kas masuk/keluar shift buka.
  | "sales"
  | "cash_movements"
  // Pengajuan izin/sakit/cuti: setujui/tolak (setujui = satu kiriman bersama absen manual per tanggal).
  | "leave_requests";

/** Record sync mentah: bentuk per entitas ada di api.md "Sync v1". */
export type SyncRecord = { id: string; updated_at: string; deleted_at: string | null; [key: string]: unknown };

export type PullPage = { items: SyncRecord[]; cursor: string; has_more: boolean; server_time: string };

export type Change = {
  entity: WritableEntity;
  op: "upsert" | "delete";
  id: string;
  data?: Record<string, unknown>;
  /** `updated_at` record yang sedang diedit (wajib untuk edit; kosong = record baru). */
  base_updated_at?: string;
};

export type ChangeResult = {
  entity: string;
  id: string;
  status: "applied" | "conflict" | "rejected";
  code?: string;
  message?: string;
  details?: { field: string; message: string }[];
  record?: SyncRecord | null;
};

export type StockRow = {
  kind: "product" | "raw_material";
  product_id: string | null;
  variant_id: string | null;
  raw_material_id: string | null;
  name: string;
  variant_name: string | null;
  category: string | null;
  unit: string;
  /** Mili-satuan (1 pcs = 1000). */
  qty: number;
  /** Mili-satuan. */
  min_stock: number;
  low: boolean;
};

export type SubscriptionDetail = {
  plan: "free" | "pro";
  status: "active" | "trial" | "grace" | "free";
  enforced: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  ends_at: string | null;
  days_left: number | null;
  billing_cycle: "monthly" | "yearly" | null;
  limits: { tx_per_month: number | null; outlets: number };
  features: string[];
  usage: { month: string; tx_this_month: number; outlets: number; over_limit: boolean; outlets_over: boolean };
  server_time: string;
  billing: {
    prices: { monthly: number; yearly: number };
    payment_info: {
      bank_accounts: { bank: string; number: string; holder: string }[];
      whatsapp: string;
      instructions: string;
      updated_at: string;
    };
    payments: {
      id: string;
      paid_at: string;
      amount: number;
      cycle: string;
      period_start: string;
      period_end: string;
      method: string;
      status: string;
    }[];
  } | null;
};
