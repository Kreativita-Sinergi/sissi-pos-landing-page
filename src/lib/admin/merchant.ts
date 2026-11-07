// Kontrak: sissi-pos-service/docs/api.md "Admin platform — informasi merchant".

export type MerchantRange = "30d" | "12w" | "12m";

export type MerchantKpi = { value: number; previous: number; change_pct: number | null };

export type SalesPeak = { dow: number; hour: number; count: number };

export type MerchantInsights = {
  generated_at: string;
  cached: boolean;
  today: {
    as_of: string;
    businesses_total: number;
    businesses_active: number;
    users_active: number;
    businesses_online: number;
    devices_online: number;
    online_window_minutes: number;
    sales_count: number;
    sales_value: number;
    average_sale: number;
    value_same_time_yesterday: number;
    value_change_pct: number | null;
  };
  trend: {
    range: MerchantRange;
    interval: "day" | "week" | "month";
    total: MerchantKpi;
    points: { bucket: string; partial: boolean; value: number; count: number }[];
  };
  top_growing: {
    id: string;
    name: string;
    type: string;
    value: number;
    previous: number;
    change_pct: number | null;
    count: number;
    online: boolean;
    peak: SalesPeak | null;
  }[];
};

export type TopProduct = { name: string; quantity: number; value: number };

export type PaymentShare = { method: string; value: number; share: number };

export type AtRiskMerchant = {
  id: string;
  name: string;
  type: string;
  reason: "stopped" | "declining";
  owner_name: string | null;
  owner_phone: string | null;
  last_sale_at: string | null;
  value_recent: number;
  value_previous: number;
  change_pct: number | null;
};

export type MerchantGrowth = {
  generated_at: string;
  cached: boolean;
  monthly: { month: string; partial: boolean; signups: number; transacting: number; new_transacting: number }[];
  activation: { window_days: number; signups: number; activated: number; rate: number | null; median_days: number | null };
  at_risk: { total: number; items: AtRiskMerchant[] };
  by_type: {
    type: string;
    businesses: number;
    transacting: number;
    value: number;
    previous: number;
    change_pct: number | null;
    count: number;
    average_sale: number;
    value_per_business: number;
    peak: SalesPeak | null;
  }[];
  payment_methods: PaymentShare[];
};

export type BusinessSales = {
  value_30d: number;
  previous_30d: number;
  change_pct: number | null;
  count_30d: number;
  online: boolean;
};

export type HeatCell = { dow: number; hour: number; count: number; value: number };

export type PerformanceDays = 7 | 30 | 90;

export type BusinessPerformance = {
  range: { days: PerformanceDays; from: string; to: string; tz: string };
  kpis: { value: MerchantKpi; count: MerchantKpi; average: MerchantKpi };
  activity: {
    users_active_today: number;
    users_total: number;
    active_days: number;
    devices_online: number;
    online_window_minutes: number;
    last_synced_at: string | null;
  };
  heatmap: HeatCell[];
  peak: SalesPeak | null;
  weekly: { week: string; partial: boolean; value: number; count: number }[];
  outlets: {
    id: string;
    name: string;
    value: number;
    previous: number;
    change_pct: number | null;
    count: number;
    peak: SalesPeak | null;
  }[];
  top_products: TopProduct[];
  payment_methods: PaymentShare[];
};

export const DAY_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

const clock = (hour: number) => `${String(hour).padStart(2, "0")}.00`;

/** `dow` 1 = Senin … 7 = Minggu → `Sab 19.00–20.00`. */
export function slotLabel(dow: number, hour: number): string {
  return `${DAY_SHORT[dow - 1]} ${clock(hour)}–${clock(hour + 1)}`;
}

export function peakLabel(peak: SalesPeak | null): string {
  return peak ? slotLabel(peak.dow, peak.hour) : "—";
}

export const HEAT_LEVELS = 5;

/** 0 = tanpa transaksi; 1…HEAT_LEVELS menurut porsi terhadap sel tertinggi. Ada transaksi selalu minimal 1. */
export function heatLevel(metric: number, count: number, max: number): number {
  if (count <= 0) return 0;
  if (metric <= 0 || max <= 0) return 1;
  return Math.min(HEAT_LEVELS, Math.max(1, Math.ceil((metric / max) * HEAT_LEVELS)));
}

/** Jam yang ditampilkan peta: dari transaksi paling awal sampai paling akhir, minimal 12 kolom agar tetap terbaca. */
export function hourRange(cells: { hour: number }[]): number[] {
  if (cells.length === 0) return [];
  let from = Math.min(...cells.map((c) => c.hour));
  let to = Math.max(...cells.map((c) => c.hour));
  while (to - from + 1 < 12) {
    if (to < 23) to++;
    if (to - from + 1 < 12 && from > 0) from--;
  }
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
