// Data & perhitungan tiruan tahap 3 (langganan + metrik) untuk server tiruan (mock.ts).
// Deterministik (seed tetap). Aturan status/perpanjangan/metrik meniru kontrak sissi-service/docs/api.md
// "Langganan" & "Admin platform — tahap 3" agar layar admin bisa diuji tanpa server.
import { ADMINS, hex, NOW, refOf, rng } from "./mockData";
import type {
  AdminPayment,
  AdminSubscription,
  BillingConfig,
  BillingCycle,
  BusinessDetail,
  Kpi,
  Metrics,
  MetricsBucket,
  MetricsInterval,
  PlanCounts,
  SubscriptionStatus,
} from "./types";

export const DAY = 86_400_000;
const TZ_OFFSET = 7 * 3_600_000;
const GRACE_DAYS = 3;
const FREE_TX_LIMIT = 50;
/** Snapshot harian `metrics_daily` baru ada sejak 90 hari lalu (sebelum fitur → null). */
const SNAPSHOT_DAYS = 90;

// ——— Tanggal (WIB) ———

export const jkt = (ms: number) => new Date(ms + TZ_OFFSET).toISOString().slice(0, 10);
export const dayStart = (d: string) => Date.parse(`${d}T00:00:00+07:00`);
export const addDays = (d: string, n: number) => jkt(dayStart(d) + n * DAY);
const dayDiff = (a: string, b: string) => Math.round((dayStart(a) - dayStart(b)) / DAY);
function addMonths(ms: number, n: number): number {
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.getTime();
}
function mondayOf(d: string): string {
  const dow = new Date(dayStart(d) + TZ_OFFSET).getUTCDay();
  return addDays(d, -((dow + 6) % 7));
}
function monthEnd(d: string): string {
  const [y, m] = d.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return addDays(next, -1);
}

// ——— Rekaman ———

export type PaymentRecord = AdminPayment & { prev_period_end: string | null; business_id: string };

export type SubRecord = {
  business_id: string;
  trial_ends_at: string | null;
  current_period_end: string | null;
  billing_cycle: BillingCycle | null;
  outlet_quota: number | null;
  tx_limit: number | null;
  override_note: string;
  first_paid_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  tx_this_month: number;
  payments: PaymentRecord[];
};

export type BillingState = {
  subs: Map<string, SubRecord>;
  /** Hari aktif per bisnis: offset hari dari hari ini (0 = hari ini). */
  activity: Map<string, Set<number>>;
  config: BillingConfig;
};

const t = (iso: string | null) => (iso ? Date.parse(iso) : null);
const iso = (ms: number) => new Date(ms).toISOString();

export function statusAt(trialEnds: number | null, periodEnd: number | null, at: number): SubscriptionStatus {
  if (periodEnd !== null && periodEnd > at) return "active";
  if (trialEnds !== null && trialEnds > at) return "trial";
  const base = Math.max(periodEnd ?? -Infinity, trialEnds ?? -Infinity);
  if (Number.isFinite(base) && at < base + GRACE_DAYS * DAY) return "grace";
  return "free";
}

export function effective(s: SubRecord, at = Date.now()) {
  const trial = t(s.trial_ends_at);
  const period = t(s.current_period_end);
  const status = statusAt(trial, period, at);
  const base = Math.max(period ?? -Infinity, trial ?? -Infinity);
  const graceEnds = Number.isFinite(base) ? base + GRACE_DAYS * DAY : null;
  const endsMs = status === "active" ? period : status === "trial" ? trial : status === "grace" ? graceEnds : null;
  return {
    status,
    graceEnds,
    endsMs,
    daysLeft: endsMs === null ? null : Math.max(0, Math.ceil((endsMs - at) / DAY)),
  };
}

const recorded = (s: SubRecord) => s.payments.filter((p) => p.status === "recorded");

export function toAdminSubscription(s: SubRecord, b: BusinessDetail): AdminSubscription {
  const e = effective(s);
  const plan = e.status === "free" ? "free" : "pro";
  const txLimit = plan === "free" ? (s.tx_limit ?? FREE_TX_LIMIT) : null;
  const outlets = b.outlets.filter((o) => o.status !== "closed").length;
  const last = [...s.payments].sort((a, c) => c.paid_at.localeCompare(a.paid_at))[0] ?? null;
  const { prev_period_end: _p, business_id: _b, ...lastPublic } = last ?? ({} as PaymentRecord);
  void _p;
  void _b;
  return {
    business: {
      id: b.id,
      name: b.name,
      type: b.type,
      owner: b.owner ? { name: b.owner.name, email: b.owner.email, phone: b.owner.phone } : null,
    },
    plan,
    status: e.status,
    trial_ends_at: s.trial_ends_at,
    current_period_end: s.current_period_end,
    grace_ends_at: e.graceEnds === null ? null : iso(e.graceEnds),
    ends_at: e.endsMs === null ? null : iso(e.endsMs),
    days_left: e.daysLeft,
    billing_cycle: s.billing_cycle,
    limits: { tx_per_month: txLimit, outlets: s.outlet_quota ?? 1 },
    overrides: { outlet_quota: s.outlet_quota, tx_limit: s.tx_limit, note: s.override_note },
    usage: {
      month: jkt(Date.now()).slice(0, 7),
      tx_this_month: s.tx_this_month,
      outlets,
      over_limit: plan === "free" && s.tx_this_month > (txLimit ?? Infinity),
    },
    first_paid_at: s.first_paid_at,
    last_payment: last ? (lastPublic as AdminPayment) : null,
    version: s.version,
    updated_at: s.updated_at,
  };
}

export function publicPayment(p: PaymentRecord): AdminPayment {
  const { prev_period_end: _p, business_id: _b, ...rest } = p;
  void _p;
  void _b;
  return rest;
}

// ——— Pembuatan data ———

export const PRICE_MONTHLY = 59_000;
export const PRICE_YEARLY = 590_000;

export function makeBillingConfig(): BillingConfig {
  return {
    price_monthly: PRICE_MONTHLY,
    price_yearly: PRICE_YEARLY,
    bank_accounts: [
      { bank: "BCA", number: "8730 123 456", holder: "PT Sissi Teknologi Nusantara" },
      { bank: "Mandiri", number: "131-00-1234567-8", holder: "PT Sissi Teknologi Nusantara" },
    ],
    whatsapp: "+6281122334455",
    instructions:
      "1. Transfer sesuai nominal paket ke salah satu rekening di atas.\n2. Kirim bukti transfer lewat WhatsApp beserta nama usaha dan email pemilik.\n3. Pro aktif paling lambat 1×24 jam setelah pembayaran kami cek.",
    updated_by: refOf(ADMINS[0]),
    updated_at: iso(NOW - 6 * DAY),
  };
}

export function makeBillingState(businesses: BusinessDetail[]): BillingState {
  const r = rng(2026);
  const subs = new Map<string, SubRecord>();
  const activity = new Map<string, Set<number>>();
  const dom = Number(jkt(NOW).slice(8, 10));
  let voidAdded = false;

  businesses.forEach((b, i) => {
    const created = Date.parse(b.created_at);
    const today = jkt(NOW);
    const createdOff = dayDiff(today, jkt(created));
    const lastOff = b.last_active_at ? dayDiff(today, jkt(Date.parse(b.last_active_at))) : null;
    const engaged = lastOff !== null && lastOff <= 30;
    const trialEnds = created + 30 * DAY;

    // Pembayaran: bisnis yang aktif lebih mungkin membayar; perpanjangan menyambung tanpa hari hilang.
    const payments: PaymentRecord[] = [];
    let period: number | null = null;
    const payer = engaged && r() < 0.62;
    if (payer) {
      let paid = trialEnds + (r() * 7 - 4) * DAY;
      if (paid > NOW) paid = r() < 0.4 ? NOW - r() * 3 * DAY : Infinity;
      const yearly = r() < 0.16;
      let n = 0;
      while (paid <= NOW) {
        const start: number = Math.max(paid, period ?? 0);
        const end = addMonths(start, yearly ? 12 : 1);
        const discount = !yearly && r() < 0.1;
        const by = refOf(ADMINS[n % 3 === 2 ? 1 : 0]);
        payments.push({
          id: `p${String(i).padStart(3, "0")}${String(n).padStart(4, "0")}-5a6b-4c7d-8e9f-${hex(i * 97 + n, 12)}`,
          business_id: b.id,
          cycle: yearly ? "yearly" : "monthly",
          period_start: iso(start),
          period_end: iso(end),
          prev_period_end: period === null ? null : iso(period),
          amount: yearly ? PRICE_YEARLY : discount ? 49_000 : PRICE_MONTHLY,
          method: r() < 0.7 ? "transfer" : r() < 0.7 ? "qris" : "cash",
          paid_at: iso(paid),
          provider: "manual",
          provider_ref: null,
          note: discount ? "Diskon komunitas UMKM" : n === 0 && r() < 0.3 ? "Bukti transfer via WA" : "",
          status: "recorded",
          void_reason: "",
          recorded_by: by,
          voided_by: null,
          voided_at: null,
          created_at: iso(Math.min(NOW, paid + 2 * 3_600_000)),
        });
        period = Math.max(period ?? 0, end);
        n++;
        if (r() < 0.09) break; // berhenti berlangganan
        if (end > NOW - 3 * DAY && end <= NOW) break; // belum memperpanjang → masa tenggang
        paid = end - (r() * 4 - 1) * DAY;
      }
      if (!voidAdded && payments.length > 2) {
        voidAdded = true;
        const p = payments[payments.length - 2];
        payments.push({
          ...p,
          id: `p${String(i).padStart(3, "0")}9999-5a6b-4c7d-8e9f-${hex(i * 31, 12)}`,
          note: "",
          status: "void",
          void_reason: "Tercatat dua kali (bukti transfer sama)",
          voided_by: refOf(ADMINS[1]),
          voided_at: iso(Date.parse(p.created_at) + 3_600_000),
          created_at: iso(Date.parse(p.created_at) + 600_000),
        });
      }
    }
    const firstPaid = payments.find((p) => p.status === "recorded")?.paid_at ?? null;
    const lastRecorded = [...payments].reverse().find((p) => p.status === "recorded");
    const multiOutlet = b.outlets_count > 1;
    const sales = b.stats?.sales_30d ?? 0;
    subs.set(b.id, {
      business_id: b.id,
      trial_ends_at: iso(trialEnds),
      current_period_end: period === null ? null : iso(period),
      billing_cycle: lastRecorded && lastRecorded.cycle !== "custom" ? lastRecorded.cycle : null,
      outlet_quota: multiOutlet ? b.outlets_count : null,
      tx_limit: i === 9 ? 100 : null,
      override_note: multiOutlet ? "Grandfather peluncuran: outlet yang sudah ada" : i === 9 ? "Mitra komunitas, batas khusus 3 bulan" : "",
      first_paid_at: firstPaid,
      version: 1 + payments.length,
      created_at: b.created_at,
      updated_at: lastRecorded?.created_at ?? b.created_at,
      // Gratis biasanya kecil; sebagian kecil melewati batas 50.
      tx_this_month: Math.round(((payer ? sales : sales / 14) * dom) / 30),
      payments,
    });

    // Hari aktif: pembayar lebih rajin; berhenti setelah hari aktif terakhir.
    const days = new Set<number>();
    const eRate = payer ? 0.7 + r() * 0.25 : 0.3 + r() * 0.45;
    const until = lastOff ?? Math.max(0, createdOff - 2);
    for (let off = createdOff; off >= until; off--) {
      const weekendDip = new Date(dayStart(addDays(today, -off)) + TZ_OFFSET).getUTCDay() === 0 ? 0.7 : 1;
      if (off === createdOff || off === lastOff || r() < eRate * weekendDip) days.add(off);
    }
    activity.set(b.id, days);
  });

  return { subs, activity, config: makeBillingConfig() };
}

// ——— Metrik ———

type MetricsInput = { from?: string; to?: string; interval?: string };
export type MetricsError = { field: string; message: string };

const LIMITS: Record<MetricsInterval, number> = { day: 92, week: 53 * 7, month: 36 * 31 };

function pct(value: number | null, previous: number | null): number | null {
  if (value === null || previous === null || previous === 0) return null;
  return Math.round(((value - previous) / previous) * 1000) / 10;
}
const kpi = (value: number | null, previous: number | null): Kpi => ({ value, previous, change_pct: pct(value, previous) });

export function computeMetrics(
  businesses: BusinessDetail[],
  st: BillingState,
  q: MetricsInput
): Metrics | MetricsError {
  const today = jkt(Date.now());
  const interval = (q.interval || "day") as MetricsInterval;
  if (!["day", "week", "month"].includes(interval)) return { field: "interval", message: "day, week, atau month." };
  const to = q.to || today;
  const from = q.from || addDays(to, -29);
  if (from > to) return { field: "from", message: "Tanggal awal setelah tanggal akhir." };
  const len = dayDiff(to, from) + 1;
  if (len > LIMITS[interval]) return { field: "to", message: "Rentang terlalu panjang untuk interval ini." };

  const offOf = (d: string) => dayDiff(today, d);
  const isActive = (id: string, d: string) => st.activity.get(id)?.has(offOf(d)) ?? false;
  const endOf = (d: string) => Math.min(dayStart(d) + DAY - 1, Date.now());
  const recordedPays = [...st.subs.values()].flatMap((s) => s.payments.filter((p) => p.status === "recorded"));

  const statusOfAt = (s: SubRecord, at: number): SubscriptionStatus => {
    let period: number | null = null;
    for (const p of s.payments) {
      if (p.status !== "recorded" || Date.parse(p.paid_at) > at) continue;
      period = Math.max(period ?? 0, Date.parse(p.period_end));
    }
    return statusAt(t(s.trial_ends_at), period, at);
  };
  const countsAt = (at: number) => {
    const c = { trial: 0, active: 0, grace: 0, free: 0 };
    for (const b of businesses) {
      if (Date.parse(b.created_at) > at) continue;
      const s = st.subs.get(b.id);
      if (s) c[statusOfAt(s, at)]++;
    }
    return c;
  };
  const days = (a: string, b: string) => {
    const out: string[] = [];
    for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
    return out;
  };
  const activeIn = (a: string, b: string) => {
    const ds = days(a, b);
    return businesses.filter((x) => ds.some((d) => isActive(x.id, d))).length;
  };
  const signupsIn = (a: string, b: string) =>
    businesses.filter((x) => {
      const d = jkt(Date.parse(x.created_at));
      return d >= a && d <= b;
    }).length;
  const revenueIn = (a: string, b: string) => {
    const lo = dayStart(a);
    const hi = dayStart(b) + DAY;
    const ps = recordedPays.filter((p) => Date.parse(p.paid_at) >= lo && Date.parse(p.paid_at) < hi);
    return { amount: ps.reduce((s, p) => s + p.amount, 0), count: ps.length };
  };
  const mrrAt = (at: number) => {
    let sum = 0;
    for (const s of st.subs.values()) {
      if (statusOfAt(s, at) !== "active") continue;
      const last = s.payments
        .filter((p) => p.status === "recorded" && Date.parse(p.paid_at) <= at)
        .sort((a, b) => b.paid_at.localeCompare(a.paid_at))[0];
      if (!last) continue;
      if (last.cycle === "monthly") sum += last.amount;
      else if (last.cycle === "yearly") sum += last.amount / 12;
      else sum += (last.amount * 30) / Math.max(1, (Date.parse(last.period_end) - Date.parse(last.period_start)) / DAY);
    }
    return Math.round(sum);
  };
  const dauAvg = (a: string, b: string) => {
    const ds = days(a, b);
    const total = ds.reduce((acc, d) => acc + businesses.filter((x) => isActive(x.id, d)).length, 0);
    return Math.round((total / ds.length) * 10) / 10;
  };
  const conversionIn = (a: string, b: string) => {
    const lo = dayStart(a);
    const hi = dayStart(b) + DAY;
    let ended = 0;
    let converted = 0;
    for (const s of st.subs.values()) {
      const te = t(s.trial_ends_at);
      if (te === null || te < lo || te >= hi || te > Date.now()) continue;
      ended++;
      if (s.payments.some((p) => p.status === "recorded" && Date.parse(p.paid_at) <= te + 14 * DAY)) converted++;
    }
    return { ended, converted, rate: ended ? Math.round((converted / ended) * 100) / 100 : null };
  };

  const prevTo = addDays(from, -1);
  const prevFrom = addDays(from, -len);

  // Seri per ember.
  const bucketOf = (d: string) => (interval === "day" ? d : interval === "week" ? mondayOf(d) : `${d.slice(0, 8)}01`);
  const bucketEnd = (start: string) => (interval === "day" ? start : interval === "week" ? addDays(start, 6) : monthEnd(start));
  const snapshotFrom = addDays(today, -(SNAPSHOT_DAYS - 1));
  const series: MetricsBucket[] = [];
  for (let start = bucketOf(from); start <= to; start = addDays(bucketEnd(start), 1)) {
    const end = bucketEnd(start);
    const a = start < from ? from : start;
    const b = end > to ? to : end;
    const rev = revenueIn(a, b);
    const snap = b >= snapshotFrom ? countsAt(endOf(b)) : null;
    series.push({
      bucket: start,
      partial: start < from || end > to || end > today,
      signups: signupsIn(a, b),
      active: activeIn(a, b),
      revenue: rev.amount,
      payments: rev.count,
      trial: snap?.trial ?? null,
      pro: snap?.active ?? null,
      grace: snap?.grace ?? null,
      free: snap?.free ?? null,
    });
  }

  // Kohort minggu daftar.
  const cohortFrom = interval === "day" ? (from < addDays(to, -83) ? from : addDays(to, -83)) : from;
  const weeks = new Map<string, string[]>();
  for (const b of businesses) {
    const d = jkt(Date.parse(b.created_at));
    if (d < cohortFrom || d > to) continue;
    const w = mondayOf(d);
    weeks.set(w, [...(weeks.get(w) ?? []), b.id]);
  }
  const cohorts = [...weeks.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([week, ids]) => ({
      week,
      size: ids.length,
      retention: Array.from({ length: 9 }, (_, k) => {
        const ws = addDays(week, k * 7);
        if (ws > today) return null;
        const we = addDays(ws, 6) > today ? today : addDays(ws, 6);
        const ds = days(ws, we);
        const n = ids.filter((id) => ds.some((d) => isActive(id, d))).length;
        return Math.round((n / ids.length) * 100) / 100;
      }),
    }));

  // Pendapatan 12 bulan terakhir.
  const firstPay = new Map<string, string>();
  for (const s of st.subs.values()) {
    const f = s.payments.filter((p) => p.status === "recorded").sort((a, b) => a.paid_at.localeCompare(b.paid_at))[0];
    if (f) firstPay.set(s.business_id, f.id);
  }
  const revenue_monthly = Array.from({ length: 12 }, (_, k) => {
    const [y, m] = to.split("-").map(Number);
    const idx = y * 12 + (m - 1) - (11 - k);
    const month = `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
    const ps = recordedPays.filter((p) => jkt(Date.parse(p.paid_at)).startsWith(month));
    const fresh = ps.filter((p) => firstPay.get(p.business_id) === p.id).length;
    return { month, amount: ps.reduce((s, p) => s + p.amount, 0), payments: ps.length, new: fresh, renewals: ps.length - fresh };
  });

  const nowCounts = currentPlans(businesses, st);
  const conv = conversionIn(from, to);
  const convPrev = conversionIn(prevFrom, prevTo);
  const revNow = revenueIn(from, to).amount;
  const revPrev = revenueIn(prevFrom, prevTo).amount;
  const dau = businesses.filter((x) => isActive(x.id, to)).length;
  const mau = activeIn(addDays(to, -29), to);

  return {
    range: { from, to, interval, tz: "Asia/Jakarta" },
    generated_at: new Date().toISOString(),
    cached: false,
    kpis: {
      signups: kpi(signupsIn(from, to), signupsIn(prevFrom, prevTo)),
      active_businesses: kpi(activeIn(from, to), activeIn(prevFrom, prevTo)),
      dau_avg: kpi(dauAvg(from, to), dauAvg(prevFrom, prevTo)),
      pro_paying: kpi(countsAt(endOf(to)).active, countsAt(endOf(prevTo)).active),
      revenue: kpi(revNow, revPrev),
      mrr_estimate: kpi(mrrAt(endOf(to)), mrrAt(endOf(prevTo))),
      trial_conversion: kpi(conv.rate, convPrev.rate),
    },
    series,
    activity: {
      dau,
      wau: activeIn(addDays(to, -6), to),
      mau,
      stickiness: mau ? Math.round((dau / mau) * 100) / 100 : 0,
      as_of: to,
    },
    plans: nowCounts,
    cohorts,
    revenue_monthly,
    conversion: { trials_ended: conv.ended, converted: conv.converted, rate: conv.rate, window_days: 14 },
    business_types: ["culinary", "retail", "service", "rental"].map((type) => {
      const list = businesses.filter((b) => b.type === type);
      return {
        type,
        total: list.length,
        active: list.filter((b) => [...(st.activity.get(b.id) ?? [])].some((o) => o <= 29)).length,
        pro: list.filter((b) => {
          const s = st.subs.get(b.id);
          return s && effective(s).status === "active";
        }).length,
      };
    }),
  };
}

export function currentPlans(businesses: BusinessDetail[], st: BillingState): PlanCounts {
  const c: PlanCounts = { trial: 0, active: 0, grace: 0, free: 0, expiring_7d: 0, over_limit: 0 };
  for (const b of businesses) {
    const s = st.subs.get(b.id);
    if (!s) continue;
    const e = effective(s);
    c[e.status]++;
    if ((e.status === "trial" || e.status === "active") && e.endsMs !== null && e.endsMs - Date.now() <= 7 * DAY) c.expiring_7d++;
    if (toAdminSubscription(s, b).usage.over_limit) c.over_limit++;
  }
  return c;
}

export function revenueThisMonth(st: BillingState): number {
  const month = jkt(Date.now()).slice(0, 7);
  let sum = 0;
  for (const s of st.subs.values())
    for (const p of s.payments) if (p.status === "recorded" && jkt(Date.parse(p.paid_at)).startsWith(month)) sum += p.amount;
  return sum;
}

export { recorded as recordedPayments, addMonths };
