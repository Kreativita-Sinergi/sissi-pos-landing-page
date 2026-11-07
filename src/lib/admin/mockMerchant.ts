// Data contoh mode tiruan untuk informasi merchant. Angka ditentukan dari id bisnis agar stabil antar muat ulang.
import type { BusinessPerformance, BusinessSales, HeatCell, MerchantGrowth, MerchantInsights, MerchantRange, PerformanceDays } from "./merchant";
import type { BusinessDetail } from "./types";

const DAY = 86_400_000;

const hash = (s: string) => {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const pct = (v: number, p: number) => (p ? Math.round(((v - p) / p) * 1000) / 10 : null);
const kpi = (value: number, previous: number) => ({ value, previous, change_pct: pct(value, previous) });

function cellsFor(seed: number, scale: number): HeatCell[] {
  const cells: HeatCell[] = [];
  const dinner = 18 + (seed % 3);
  for (let dow = 1; dow <= 7; dow++) {
    for (let hour = 8; hour <= 22; hour++) {
      const shape = Math.exp(-((hour - 12) ** 2) / 4) * 0.7 + Math.exp(-((hour - dinner) ** 2) / 5);
      const count = Math.round(shape * (dow >= 6 ? 1.4 : 1) * scale * (0.85 + ((seed + dow * 7 + hour * 3) % 10) / 33));
      if (count > 0) cells.push({ dow, hour, count, value: count * (30000 + (seed % 20000)) });
    }
  }
  return cells;
}

const peakOf = (cells: HeatCell[]) =>
  cells.reduce<HeatCell | null>((best, c) => (!best || c.count > best.count ? c : best), null);

export function mockInsights(businesses: BusinessDetail[], range: MerchantRange): MerchantInsights {
  const now = Date.now();
  const n = range === "30d" ? 30 : 12;
  const interval = range === "30d" ? "day" : range === "12w" ? "week" : "month";
  const stepDays = range === "30d" ? 1 : range === "12w" ? 7 : 30;
  const base = range === "30d" ? 40_000_000 : range === "12w" ? 280_000_000 : 1_200_000_000;
  const points = Array.from({ length: n }, (_, i) => {
    const value = Math.round(base * (0.75 + (i / n) * 0.35 + (hash(String(i)) % 10) / 100));
    return {
      bucket: iso(now - (n - 1 - i) * stepDays * DAY),
      partial: i === n - 1,
      value,
      count: Math.round(value / 14000),
    };
  });
  const total = points.reduce((a, p) => a + p.value, 0);
  const top_growing = businesses.slice(0, 5).map((b, i) => {
    const seed = hash(b.id);
    const previous = 15_000_000 + (seed % 40_000_000);
    const value = Math.round(previous * (1.45 - i * 0.08));
    const peak = peakOf(cellsFor(seed, 30));
    return {
      id: b.id,
      name: b.name,
      type: b.type,
      value,
      previous,
      change_pct: pct(value, previous),
      count: Math.round(value / 40000),
      online: i % 2 === 0,
      peak: peak && { dow: peak.dow, hour: peak.hour, count: peak.count },
    };
  });
  return {
    generated_at: new Date(now).toISOString(),
    cached: false,
    today: {
      as_of: iso(now),
      businesses_total: businesses.length,
      businesses_active: Math.ceil(businesses.length * 0.4),
      users_active: Math.ceil(businesses.length * 1.3),
      businesses_online: Math.ceil(businesses.length * 0.15),
      devices_online: Math.ceil(businesses.length * 0.3),
      online_window_minutes: 15,
      sales_count: 3412,
      sales_value: 48_200_000,
      average_sale: 14127,
      value_same_time_yesterday: 43_000_000,
      value_change_pct: 12.1,
    },
    trend: { range, interval, total: kpi(total, Math.round(total / 1.18)), points },
    top_growing,
  };
}

export function mockPerformance(b: BusinessDetail, days: PerformanceDays, outletId?: string): BusinessPerformance {
  const now = Date.now();
  const seed = hash(outletId ?? b.id);
  const heatmap = cellsFor(seed, (days / 30) * (outletId ? 8 : 16));
  const count = heatmap.reduce((a, c) => a + c.count, 0);
  const value = heatmap.reduce((a, c) => a + c.value, 0);
  const prevCount = Math.round(count / 1.15);
  const prevValue = Math.round(value / 1.24);
  const peak = peakOf(heatmap);
  const weeklyBase = (value / Math.max(1, days)) * 7;
  return {
    range: { days, from: iso(now - (days - 1) * DAY), to: iso(now), tz: "Asia/Jakarta" },
    kpis: {
      value: kpi(value, prevValue),
      count: kpi(count, prevCount),
      average: kpi(count ? Math.round(value / count) : 0, prevCount ? Math.round(prevValue / prevCount) : 0),
    },
    activity: {
      users_active_today: Math.max(1, b.users.length - 1),
      users_total: b.users.length,
      active_days: Math.max(1, days - 2),
      devices_online: b.devices.length ? 1 : 0,
      online_window_minutes: 15,
      last_synced_at: new Date(now - 3 * 60_000).toISOString(),
    },
    heatmap,
    peak: peak && { dow: peak.dow, hour: peak.hour, count: peak.count },
    weekly: Array.from({ length: 12 }, (_, i) => ({
      week: iso(now - (11 - i) * 7 * DAY),
      partial: i === 11,
      value: Math.round(weeklyBase * (0.6 + i * 0.04)),
      count: Math.round((count / Math.max(1, days)) * 7 * (0.6 + i * 0.04)),
    })),
    top_products: MOCK_PRODUCTS,
    payment_methods: MOCK_PAYMENTS,
    outlets: b.outlets.map((o, i) => {
      const share = b.outlets.length > 1 ? (i === 0 ? 0.7 : 0.3 / (b.outlets.length - 1)) : 1;
      return {
        id: o.id,
        name: o.name,
        value: Math.round(value * share),
        previous: Math.round(prevValue * share),
        change_pct: pct(value, prevValue),
        count: Math.round(count * share),
        peak: peak && { dow: peak.dow, hour: peak.hour, count: Math.round(peak.count * share) },
      };
    }),
  };
}

const MOCK_PRODUCTS = [
  { name: "Kopi Susu", quantity: 640, value: 14_080_000 },
  { name: "Es Teh", quantity: 420, value: 2_100_000 },
  { name: "Nasi Goreng", quantity: 210, value: 5_250_000 },
];
const MOCK_PAYMENTS = [
  { method: "qris", value: 52_000_000, share: 0.6019 },
  { method: "cash", value: 30_000_000, share: 0.3473 },
  { method: "card", value: 4_400_000, share: 0.0508 },
];

export function mockSales(id: string): BusinessSales {
  const seed = hash(id);
  const previous_30d = 5_000_000 + (seed % 60_000_000);
  const value_30d = Math.round(previous_30d * (0.7 + (seed % 70) / 100));
  return {
    value_30d,
    previous_30d,
    change_pct: pct(value_30d, previous_30d),
    count_30d: Math.round(value_30d / 40000),
    online: seed % 3 === 0,
  };
}

export function mockGrowth(businesses: BusinessDetail[]): MerchantGrowth {
  const now = Date.now();
  const total = businesses.length;
  const items = businesses.slice(0, 6).map((b, i) => ({
    id: b.id,
    name: b.name,
    type: b.type,
    reason: i % 2 === 0 ? ("stopped" as const) : ("declining" as const),
    owner_name: b.owner?.name ?? null,
    owner_phone: b.owner?.phone ?? null,
    last_sale_at: new Date(now - (i + 2) * 3 * DAY).toISOString(),
    value_recent: i % 2 === 0 ? 0 : 1_200_000,
    value_previous: 6_000_000 - i * 500_000,
    change_pct: i % 2 === 0 ? null : -60,
  }));
  return {
    generated_at: new Date(now).toISOString(),
    cached: false,
    monthly: Array.from({ length: 12 }, (_, i) => ({
      month: `${iso(now - (11 - i) * 30 * DAY).slice(0, 7)}-01`,
      partial: i === 11,
      signups: 3 + i,
      transacting: Math.round(total * (0.3 + i * 0.04)),
      new_transacting: 2 + (i % 4),
    })),
    activation: { window_days: 90, signups: 40, activated: 31, rate: 0.775, median_days: 2.5 },
    at_risk: { total: items.length, items },
    by_type: ["culinary", "retail", "service", "rental"].map((type, i) => ({
      type,
      businesses: 40 - i * 10,
      transacting: 30 - i * 8,
      value: 900_000_000 - i * 250_000_000,
      previous: 760_000_000 - i * 220_000_000,
      change_pct: 18 - i * 4,
      count: 41000 - i * 12000,
      average_sale: 21950 + i * 15000,
      value_per_business: 30_000_000 - i * 5_000_000,
      peak: { dow: 6 - (i % 3), hour: 19 - i * 3, count: 900 - i * 200 },
    })),
    payment_methods: MOCK_PAYMENTS,
  };
}
