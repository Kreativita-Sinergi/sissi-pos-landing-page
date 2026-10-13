// Skema pengaturan outlet (`outlets.settings`) & bisnis (`business_settings.settings`) yang diedit web.
// Kontrak: sissi-service/docs/api.md "Skema pengaturan bisnis" & "Skema pengaturan outlet".
// Semua kunci opsional: web mengisi nilai bawaan saat membaca (toleran terhadap data lama/rusak) dan saat
// menyimpan menggabungkan bagian yang diedit di atas objek tersimpan, sehingga kunci yang tidak dikenal tetap utuh.
// Persen = basis poin (1000 = 10%); uang = rupiah bulat.

export type Obj = Record<string, unknown>;

export const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const obj = (v: unknown): Obj => (isObj(v) ? v : {});
const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
const int = (v: unknown, d: number, min = 0, max = Number.MAX_SAFE_INTEGER) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : d;
const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);

export const ORDER_TYPE_VALUES = ["dine_in", "takeaway", "service", "rental"] as const;
export type OrderType = (typeof ORDER_TYPE_VALUES)[number];
const orderTypes = (v: unknown): OrderType[] =>
  Array.isArray(v) ? ORDER_TYPE_VALUES.filter((t) => v.includes(t)) : [];

// ——— Outlet ———

export type Tax = { id: string; name: string; rate_bp: number; enabled: boolean };
export type ServiceFee = {
  enabled: boolean;
  type: "percent" | "fixed";
  rate_bp: number;
  amount: number;
  order_types: OrderType[];
  taxable: boolean;
};
export type Rounding = { enabled: boolean; unit: 100 | 500 | 1000 };
export type Receipt = {
  header: string;
  footer: string;
  instagram: string;
  paper_mm: 58 | 80;
  show_logo: boolean;
  show_tax_rate: boolean;
};
export type TransactionSettings = {
  /** null = bawaan menurut jenis usaha. */
  order_types: OrderType[] | null;
  queue_number: boolean;
  allow_credit: boolean;
  pin_for_void: boolean;
  blind_close: boolean;
  require_customer_name: boolean;
};

export function readTaxes(settings: unknown): Tax[] {
  const list = obj(settings).taxes;
  if (!Array.isArray(list)) return [];
  return list.filter(isObj).map((t) => ({
    id: str(t.id),
    name: str(t.name),
    rate_bp: int(t.rate_bp, 0, 0, 10000),
    enabled: bool(t.enabled, true),
  }));
}

export function readServiceFee(settings: unknown): ServiceFee {
  const s = obj(obj(settings).service_fee);
  return {
    enabled: bool(s.enabled, false),
    type: s.type === "fixed" ? "fixed" : "percent",
    rate_bp: int(s.rate_bp, 500, 0, 10000),
    amount: int(s.amount, 0, 0, 1_000_000_000),
    order_types: orderTypes(s.order_types),
    taxable: bool(s.taxable, true),
  };
}

export function readRounding(settings: unknown): Rounding {
  const s = obj(obj(settings).rounding);
  const unit = s.unit === 500 || s.unit === 1000 ? s.unit : 100;
  return { enabled: bool(s.enabled, false), unit };
}

export function readReceipt(settings: unknown): Receipt {
  const s = obj(obj(settings).receipt);
  return {
    header: str(s.header),
    footer: str(s.footer),
    instagram: str(s.instagram),
    paper_mm: s.paper_mm === 80 ? 80 : 58,
    show_logo: bool(s.show_logo, true),
    show_tax_rate: bool(s.show_tax_rate, true),
  };
}

export function readTransaction(settings: unknown): TransactionSettings {
  const s = obj(obj(settings).transaction);
  return {
    order_types: Array.isArray(s.order_types) ? orderTypes(s.order_types) : null,
    queue_number: bool(s.queue_number, false),
    allow_credit: bool(s.allow_credit, false),
    pin_for_void: bool(s.pin_for_void, true),
    blind_close: bool(s.blind_close, false),
    require_customer_name: bool(s.require_customer_name, false),
  };
}

export type BankAccount = { id: string; bank: string; number: string; holder: string };
export type QrisSettings = { enabled: boolean; merchant_name: string; payload: string; image_url: string | null };
export type PaymentMethods = {
  qris: QrisSettings;
  transfer: { enabled: boolean; accounts: BankAccount[] };
  card: { enabled: boolean };
};

/** Batas rekening tujuan per outlet. */
export const MAX_BANK_ACCOUNTS = 10;

/**
 * Metode pembayaran outlet (`settings.payment_methods`): QRIS statis, transfer (+ rekening), kartu. Tunai selalu aktif
 * (tidak disimpan). Bawaan sama dengan app (`outlet_settings.dart`): semua aktif, isian kosong.
 */
export function readPaymentMethods(settings: unknown): PaymentMethods {
  const pm = obj(obj(settings).payment_methods);
  const q = obj(pm.qris);
  const t = obj(pm.transfer);
  const c = obj(pm.card);
  const img = str(q.image_url).trim();
  return {
    qris: { enabled: bool(q.enabled, true), merchant_name: str(q.merchant_name), payload: str(q.payload), image_url: img || null },
    transfer: {
      enabled: bool(t.enabled, true),
      accounts: (Array.isArray(t.accounts) ? t.accounts : [])
        .filter(isObj)
        .map((a, i) => ({ id: str(a.id) || `idx-${i}`, bank: str(a.bank), number: str(a.number), holder: str(a.holder) })),
    },
    card: { enabled: bool(c.enabled, true) },
  };
}

/** QRIS punya kode (teks payload atau gambar)? */
export const qrisHasCode = (q: QrisSettings) => !!q.payload.trim() || !!q.image_url;

/**
 * Metode pembayaran diedit → objek `settings` baru. Kunci yang tidak dikenal web (di `payment_methods`, tiap metode,
 * dan tiap rekening per `id`) tetap utuh.
 */
export function mergePaymentMethods(settings: unknown, pm: PaymentMethods): Obj {
  const s = obj(settings);
  const old = obj(s.payment_methods);
  const oldT = obj(old.transfer);
  const oldAccounts = (Array.isArray(oldT.accounts) ? oldT.accounts : []).filter(isObj);
  return {
    ...s,
    payment_methods: {
      ...old,
      qris: { ...obj(old.qris), ...pm.qris, image_url: pm.qris.image_url || null },
      transfer: {
        ...oldT,
        enabled: pm.transfer.enabled,
        // Rekening lama tanpa `id` (data rusak) dikenali lewat urutan dan disimpan tanpa id buatan web.
        accounts: pm.transfer.accounts.map((a) => {
          if (a.id.startsWith("idx-")) {
            const { bank, number, holder } = a;
            return { ...(oldAccounts[Number(a.id.slice(4))] ?? {}), bank, number, holder };
          }
          return { ...(oldAccounts.find((o) => o.id === a.id) ?? {}), ...a };
        }),
      },
      card: { ...obj(old.card), ...pm.card },
    },
  };
}

/**
 * Pajak diedit → larik baru. Field pajak yang tidak dikenal web (mis. tambahan versi app baru) dipertahankan per `id`.
 */
export function mergeTaxes(settings: unknown, taxes: Tax[]): Obj[] {
  const old = Array.isArray(obj(settings).taxes) ? (obj(settings).taxes as unknown[]).filter(isObj) : [];
  return taxes.map((t) => ({ ...(old.find((o) => o.id === t.id) ?? {}), ...t }));
}

/** Gabungkan satu bagian objek (`receipt`, `rounding`, …) di atas yang tersimpan; kunci lain tetap utuh. */
export function mergeSection(settings: unknown, key: string, value: Obj): Obj {
  const s = obj(settings);
  return { ...s, [key]: { ...obj(s[key]), ...value } };
}

// ——— Bisnis ———

export type Tier = { id: string; name: string; min_points: number; discount_bp: number };
export type Loyalty = {
  enabled: boolean;
  points_per_thousand: number;
  min_redeem: number;
  point_value: number;
  tiers: Tier[];
};
export type AttendanceRules = {
  work_start: string;
  work_end: string;
  late_tolerance_min: number;
  /** 1 = Senin … 7 = Minggu. */
  off_days: number[];
};

export function readLoyalty(settings: unknown): Loyalty {
  const s = obj(obj(settings).loyalty);
  return {
    enabled: bool(s.enabled, false),
    points_per_thousand: int(s.points_per_thousand, 1, 0, 1_000_000),
    min_redeem: int(s.min_redeem, 100, 0, 1_000_000_000),
    point_value: int(s.point_value, 100, 0, 1_000_000_000),
    tiers: (Array.isArray(s.tiers) ? s.tiers : []).filter(isObj).map((t) => ({
      id: str(t.id),
      name: str(t.name),
      min_points: int(t.min_points, 0, 0, 1_000_000_000),
      discount_bp: int(t.discount_bp, 0, 0, 10000),
    })),
  };
}

export function mergeTiers(settings: unknown, tiers: Tier[]): Obj[] {
  const l = obj(obj(settings).loyalty);
  const old = Array.isArray(l.tiers) ? l.tiers.filter(isObj) : [];
  return tiers.map((t) => ({ ...(old.find((o) => o.id === t.id) ?? {}), ...t }));
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isHHMM = (v: string) => HHMM.test(v);

export function readAttendance(settings: unknown): AttendanceRules {
  const s = obj(obj(settings).attendance);
  const ws = str(s.work_start);
  const we = str(s.work_end);
  return {
    work_start: isHHMM(ws) ? ws : "08:00",
    work_end: isHHMM(we) ? we : "17:00",
    late_tolerance_min: int(s.late_tolerance_min, 10, 0, 1440),
    off_days: Array.isArray(s.off_days)
      ? [...new Set(s.off_days.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7))].sort()
      : [7],
  };
}

// ——— Zona waktu usaha ———

/** Pilihan zona di web (Pontianak = WIB, ditampilkan sebagai Jakarta). */
export const TIMEZONE_CHOICES = ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"] as const;
export type TimezoneChoice = (typeof TIMEZONE_CHOICES)[number];

/** `settings.timezone` → pilihan web; kosong/tidak dikenal/Pontianak → WIB (`Asia/Jakarta`). */
export function readTimezone(settings: unknown): TimezoneChoice {
  const v = str(obj(settings).timezone);
  return (TIMEZONE_CHOICES as readonly string[]).includes(v) ? (v as TimezoneChoice) : "Asia/Jakarta";
}

// ——— Angka ———

/** Basis poin → teks persen Indonesia: 1000 → "10", 1150 → "11,5". */
export function bpToPercentText(bp: number): string {
  return (bp / 100).toLocaleString("id-ID", { maximumFractionDigits: 2, useGrouping: false });
}

/** Teks persen ("11,5" / "11.5") → basis poin; null bila tidak sah. */
export function percentTextToBp(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const bp = Math.round(Number(t) * 100);
  return Number.isFinite(bp) ? bp : null;
}

/** Teks bilangan bulat (titik ribuan diabaikan) → angka; null bila tidak sah. */
export function intText(text: string): number | null {
  const t = text.trim().replace(/\./g, "");
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) ? n : null;
}
