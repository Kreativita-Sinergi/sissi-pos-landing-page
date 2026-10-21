// Server tiruan Dasbor pemilik untuk mencoba /masuk & /dasbor tanpa sissi-service.
// Hanya dimuat bila NEXT_PUBLIC_OWNER_MOCK=1 (lihat api.ts). Data dibangkitkan deterministik per hari
// (usaha kuliner "Kopi Senja", 2 outlet, 90 hari transaksi + kasbon, void, shift); sesi di localStorage.
// Angka laporan dihitung dari transaksi mentah mengikuti "Definisi angka" di kontrak.
//
// Login contoh (password apa saja, minimal 1 karakter), kecuali:
//   password "salah"            → 401 INVALID_CREDENTIALS
//   identifier memuat "kasir"   → 403 OWNER_ONLY
//   identifier memuat "verif"   → 403 EMAIL_NOT_VERIFIED
//   identifier memuat "kunci"   → 429 RATE_LIMITED (Retry-After 60)
//   identifier memuat "gratis"  → paket Gratis (enforced, tanpa `insights` → bagian terkunci)
//   identifier memuat "uji"     → Pro uji coba (sisa 12 hari)
//   lainnya                     → Pro aktif
// Masuk dengan Google (tiruan) → Pro aktif.
import { ApiError } from "@/lib/sissiApi";
import type { OwnerApi } from "./api";
import type { StaffMember, SyncRecord } from "./types";
import { normalizeZone } from "./tz";
import type {
  ActivityFieldChange,
  ActivityItem,
  OutletRow,
  OwnerDevice,
  OwnerOutlet,
  OwnerPlan,
  OwnerSession,
  PaymentMethod,
  ProductSales,
  SaleDetail,
  SaleItem,
  SaleListItem,
  SalesReport,
  ShiftDetail,
  ShiftListItem,
  Totals,
} from "./types";

const SESSION_KEY = "sissi-owner-mock:session";
const HOUR = 3_600_000;
const DAY = 86_400_000;
const WIB = 7 * HOUR;
const HISTORY_DAYS = 90;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ——— Tanggal WIB ———

const wibDay = (ms: number) => new Date(ms + WIB).toISOString().slice(0, 10);
const wibHour = (ms: number) => new Date(ms + WIB).getUTCHours();
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const dayStart = (day: string) => Date.parse(`${day}T00:00:00+07:00`);
const weekdayMon0 = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
const spanDays = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY) + 1;
const isDay = (v: string | undefined) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

// ——— Acak deterministik ———

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T,>(arr: T[]) => arr[Math.floor(next() * arr.length)],
    weighted: <T,>(items: [T, number][]) => {
      const total = items.reduce((a, [, w]) => a + w, 0);
      let r = next() * total;
      for (const [v, w] of items) {
        r -= w;
        if (r <= 0) return v;
      }
      return items[items.length - 1][0];
    },
  };
}

function uuid(seed: string): string {
  const h = (n: number) => hashStr(`${seed}:${n}`).toString(16).padStart(8, "0");
  const s = `${h(1)}${h(2)}${h(3)}${h(4)}`;
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-4${s.slice(13, 16)}-a${s.slice(17, 20)}-${s.slice(20, 32)}`;
}

// ——— Master data ———

const BUSINESS = { id: uuid("biz"), name: "Kopi Senja", type: "culinary" as const, category: "cafe" };
const USER = { id: uuid("owner"), name: "Rina Wulandari", email: "rina@kopisenja.id" };

const OUTLETS: (OwnerOutlet & { code: string; weight: number; tax: boolean; service: boolean })[] = [
  { id: uuid("o1"), name: "Kopi Senja Dago", address: "Jl. Ir. H. Juanda No. 112, Bandung", status: "open", code: "DGO", weight: 1, tax: true, service: false },
  { id: uuid("o2"), name: "Kopi Senja Braga", address: "Jl. Braga No. 48, Bandung", status: "open", code: "BRG", weight: 0.62, tax: true, service: true },
];

const CASHIERS: Record<string, { id: string; name: string }[]> = {
  [OUTLETS[0].id]: [
    { id: uuid("c1"), name: "Dewi" },
    { id: uuid("c2"), name: "Bagas" },
  ],
  [OUTLETS[1].id]: [
    { id: uuid("c3"), name: "Sari" },
    { id: uuid("c4"), name: "Yoga" },
  ],
};
const OWNER_CASHIER = { id: USER.id, name: USER.name };

type Product = { id: string; name: string; variants?: { id: string; name: string; add: number }[]; price: number; cost: number | null; weight: number };
const PRODUCTS: Product[] = [
  { id: uuid("p1"), name: "Es Kopi Susu Senja", price: 22000, cost: 8500, weight: 10, variants: [{ id: uuid("p1v1"), name: "Reguler", add: 0 }, { id: uuid("p1v2"), name: "Besar", add: 6000 }] },
  { id: uuid("p2"), name: "Americano", price: 20000, cost: 6000, weight: 6, variants: [{ id: uuid("p2v1"), name: "Panas", add: 0 }, { id: uuid("p2v2"), name: "Dingin", add: 2000 }] },
  { id: uuid("p3"), name: "Cafe Latte", price: 26000, cost: 9500, weight: 6 },
  { id: uuid("p4"), name: "Matcha Latte", price: 28000, cost: 11000, weight: 4 },
  { id: uuid("p5"), name: "Cokelat Dingin", price: 25000, cost: 9000, weight: 3 },
  { id: uuid("p6"), name: "Teh Tarik", price: 18000, cost: 5000, weight: 3 },
  { id: uuid("p7"), name: "V60 Manual Brew", price: 32000, cost: 12000, weight: 2 },
  { id: uuid("p8"), name: "Croissant Mentega", price: 24000, cost: 13000, weight: 4 },
  { id: uuid("p9"), name: "Roti Bakar Cokelat Keju", price: 22000, cost: null, weight: 4 },
  { id: uuid("p10"), name: "Pisang Goreng Madu", price: 18000, cost: null, weight: 3 },
  { id: uuid("p11"), name: "Nasi Goreng Kampung", price: 32000, cost: 14000, weight: 3 },
  { id: uuid("p12"), name: "Mie Nyemek", price: 28000, cost: 11000, weight: 2 },
  { id: uuid("p13"), name: "Air Mineral", price: 8000, cost: 3000, weight: 2 },
];
const MODIFIERS = [
  { name: "Extra shot", price: 5000, cost: 2500 },
  { name: "Susu oat", price: 8000, cost: 4500 },
  { name: "Kurangi gula", price: 0, cost: 0 },
  { name: "Sirup karamel", price: 4000, cost: 1500 },
];
const NOTES = ["Es sedikit", "Tanpa gula", "Pedas sedang", "Dibungkus terpisah", null, null, null, null];
const CUSTOMERS = [
  { id: uuid("cu1"), name: "Bu Rina Kantor Pos", phone: "+6281234567001" },
  { id: uuid("cu2"), name: "Pak Joko", phone: "+6281234567002" },
  { id: uuid("cu3"), name: "Mas Dimas (kampus)", phone: null },
  { id: uuid("cu4"), name: "Kak Laras", phone: "+6281234567004" },
];
const TABLES = ["Meja 1", "Meja 2", "Meja 3", "Meja 5", "Meja 7", "Teras 1", "Teras 2", "Sofa"];
const VOID_REASONS = ["Salah input pesanan", "Pelanggan batal", "Pesanan ganda", "Produk habis"];
const DEVICE_NAMES: Record<string, { name: string; mode: string; ago: number; version: string }[]> = {
  [OUTLETS[0].id]: [
    { name: "Tablet Kasir Dago", mode: "main_cashier", ago: 4 * 60_000, version: "1.8.2" },
    { name: "HP Dapur Dago", mode: "kitchen", ago: 11 * 60_000, version: "1.8.2" },
  ],
  [OUTLETS[1].id]: [
    { name: "Tablet Kasir Braga", mode: "cashier", ago: 27 * HOUR, version: "1.7.9" },
  ],
};

// ——— Transaksi mentah ———

type RawLine = SaleItem & { product_key: string; modCost: number };
type RawSale = Omit<SaleDetail, "items"> & { items: RawLine[]; t: number; day: string; hour: number; shift_id: string };
type RawShift = ShiftListItem & { notes: string | null; movements: ShiftDetail["cash_movements"] };

const HOUR_WEIGHTS: [number, number][] = [
  [7, 3], [8, 7], [9, 6], [10, 4], [11, 5], [12, 8], [13, 7], [14, 4], [15, 5], [16, 7], [17, 8], [18, 7], [19, 6], [20, 4], [21, 2],
];

function makeLine(r: ReturnType<typeof rng>): RawLine {
  const p = r.weighted(PRODUCTS.map((x) => [x, x.weight] as [Product, number]));
  const v = p.variants ? r.pick(p.variants) : null;
  const unit = p.price + (v?.add ?? 0);
  const mods = p.price >= 20000 && p.id !== PRODUCTS[7].id && r.next() < 0.22 ? [r.pick(MODIFIERS)] : [];
  const qty = r.weighted([[1, 8], [2, 3], [3, 1]]);
  const each = unit + mods.reduce((a, m) => a + m.price, 0);
  const gross = each * qty;
  const discount = r.next() < 0.04 ? Math.round(gross * 0.1) : 0;
  return {
    name: p.name,
    variant_name: v?.name ?? null,
    quantity: qty,
    unit_price: unit,
    modifiers: mods.map((m) => ({ name: m.name, price: m.price })),
    discount,
    subtotal: gross - discount,
    note: r.pick(NOTES),
    cost_price: p.cost === null ? null : p.cost + Math.round((v?.add ?? 0) * 0.35),
    is_custom: false,
    product_key: `${p.id}/${v?.id ?? ""}`,
    modCost: mods.reduce((a, m) => a + m.cost, 0),
  };
}

function customLine(r: ReturnType<typeof rng>): RawLine {
  const name = r.pick(["Kue titipan", "Gorengan", "Tambahan es"]);
  const price = r.pick([5000, 10000, 12000]);
  return {
    name, variant_name: null, quantity: 1, unit_price: price, modifiers: [], discount: 0, subtotal: price, note: null,
    cost_price: null, is_custom: true, product_key: `custom:${name.toLowerCase()}`, modCost: 0,
  };
}

type Db = { sales: RawSale[]; shifts: RawShift[]; generatedFor: string };

function generate(now: number): Db {
  const today = wibDay(now);
  const sales: RawSale[] = [];
  const shifts: RawShift[] = [];

  for (let back = HISTORY_DAYS - 1; back >= 0; back--) {
    const day = addDays(today, -back);
    const wd = weekdayMon0(day);
    for (const o of OUTLETS) {
      const r = rng(hashStr(`${day}:${o.id}`));
      const cashier = CASHIERS[o.id][back % 2 === 0 ? 0 : 1];
      const device = DEVICE_NAMES[o.id][0];
      const shiftId = uuid(`shift:${day}:${o.id}`);
      const opened = dayStart(day) + 7 * HOUR - r.int(0, 20) * 60_000;
      // Tren naik pelan 90 hari terakhir + akhir pekan lebih ramai.
      const trend = 0.85 + ((HISTORY_DAYS - back) / HISTORY_DAYS) * 0.3;
      const n = Math.round((wd >= 5 ? 52 : 38) * o.weight * trend * (0.8 + r.next() * 0.4));
      const daySales: RawSale[] = [];
      for (let i = 0; i < n; i++) {
        const h = r.weighted(HOUR_WEIGHTS);
        const t = dayStart(day) + h * HOUR + r.int(0, 59) * 60_000 + r.int(0, 59) * 1000;
        if (t > now) continue;
        const lines = Array.from({ length: r.weighted([[1, 5], [2, 4], [3, 2], [4, 1]]) }, () => makeLine(r));
        if (r.next() < 0.03) lines.push(customLine(r));
        const subtotal = lines.reduce((a, l) => a + l.subtotal, 0);
        const notaDisc = r.next() < 0.06 ? Math.round(subtotal * 0.1) : 0;
        const net = subtotal - notaDisc;
        const dineIn = r.next() < 0.55;
        const service = o.service && dineIn ? Math.round(net * 0.05) : 0;
        const tax = o.tax ? Math.round((net + service) * 0.1) : 0;
        const raw = net + service + tax;
        const total = Math.floor(raw / 100) * 100;
        const rounding = total - raw;
        const roll = r.next();
        let status: RawSale["status"] = "paid";
        if (roll < 0.022) status = "void";
        else if (roll < 0.027) status = "refunded";
        else if (roll < 0.042 && back > 0) status = r.next() < 0.6 ? "unpaid" : "partial";
        const method = status === "unpaid" || status === "partial"
          ? "credit"
          : r.weighted<string>([["cash", 44], ["qris", 40], ["card", 5], ["transfer", 5], ["split", 6]]);
        const customer = status === "unpaid" || status === "partial" ? r.pick(CUSTOMERS) : r.next() < 0.12 ? r.pick(CUSTOMERS) : null;
        const actor = r.next() < 0.1 ? OWNER_CASHIER : cashier;
        const iso = new Date(t).toISOString();
        const payments: SaleDetail["payments"] = [];
        const pay = (m: PaymentMethod, amount: number, at = iso) => {
          const received = m === "cash" && amount > 0 ? Math.ceil(amount / 10000) * 10000 + (r.next() < 0.3 ? 50000 : 0) : null;
          payments.push({
            id: uuid(`pay:${day}:${o.id}:${i}:${payments.length}`), method: m, amount,
            received, change: received !== null ? received - amount : null, paid_at: at, cashier_name: actor.name,
          });
        };
        if (status === "paid" || status === "refunded") {
          if (method === "split") {
            const cash = Math.round(total * 0.4 / 1000) * 1000;
            pay("cash", cash);
            pay("qris", total - cash);
          } else pay(method as PaymentMethod, total);
          if (status === "refunded") {
            const m = payments[0].method as PaymentMethod;
            payments.push({
              id: uuid(`refund:${day}:${o.id}:${i}`), method: m, amount: -total, received: null, change: null,
              paid_at: new Date(t + 25 * 60_000).toISOString(), cashier_name: actor.name,
            });
          }
        } else if (status === "partial") {
          pay("cash", Math.round(total * 0.5 / 1000) * 1000);
        }
        const paidTotal = payments.reduce((a, p) => a + p.amount, 0);
        const seq = daySales.length + 1;
        const receipt = `${o.code}-${day.slice(2).replace(/-/g, "")}-${String(seq).padStart(3, "0")}`;
        daySales.push({
          id: uuid(`sale:${day}:${o.id}:${i}`),
          receipt_no: receipt,
          paid_at: iso,
          outlet_id: o.id,
          outlet_name: o.name,
          cashier_id: actor.id,
          cashier_name: actor.name,
          customer_name: customer?.name ?? null,
          table_name: dineIn ? r.pick(TABLES) : null,
          order_type: dineIn ? "dine_in" : "takeaway",
          status,
          payment_method: method,
          total,
          paid_total: status === "refunded" ? 0 : paidTotal,
          items_count: lines.reduce((a, l) => a + l.quantity, 0),
          subtotal,
          discount_total: notaDisc,
          service_fee: service,
          tax_total: tax,
          rounding,
          amount_paid: payments.filter((p) => p.amount > 0).reduce((a, p) => a + (p.received ?? p.amount), 0),
          change_amount: payments.reduce((a, p) => a + (p.change ?? 0), 0),
          notes: r.next() < 0.05 ? "Pelanggan langganan, minta struk dikirim WA" : null,
          void_reason: status === "void" ? r.pick(VOID_REASONS) : status === "refunded" ? "Minuman tumpah, uang dikembalikan" : null,
          approved_by_name: status === "void" || status === "refunded" ? USER.name : null,
          settled_at: status === "paid" ? iso : null,
          due_at: status === "unpaid" || status === "partial" ? new Date(t + 14 * DAY).toISOString() : null,
          queue_no: r.next() < 0.6 ? seq : null,
          customer,
          items: lines,
          discounts: notaDisc ? [{ name: "Promo member 10%", amount: notaDisc }] : [],
          taxes: tax ? [{ name: "PB1", rate_bp: 1000, amount: tax }] : [],
          payments,
          t,
          day,
          hour: wibHour(t),
          shift_id: shiftId,
        });
      }

      // Pesanan berjalan (open) hari ini.
      if (back === 0) {
        const openCount = o.weight === 1 ? 3 : 1;
        for (let k = 0; k < openCount; k++) {
          const t = now - (k + 1) * 9 * 60_000;
          if (t < dayStart(day) + 7 * HOUR) break;
          const lines = [makeLine(r), makeLine(r)];
          const subtotal = lines.reduce((a, l) => a + l.subtotal, 0);
          const tax = Math.round(subtotal * 0.1);
          const total = Math.floor((subtotal + tax) / 100) * 100;
          daySales.push({
            id: uuid(`open:${day}:${o.id}:${k}`), receipt_no: `${o.code}-OPEN-${k + 1}`, paid_at: new Date(t).toISOString(),
            outlet_id: o.id, outlet_name: o.name, cashier_id: cashier.id, cashier_name: cashier.name, customer_name: null,
            table_name: TABLES[k], order_type: "dine_in", status: "open", payment_method: "cash", total, paid_total: 0,
            items_count: lines.reduce((a, l) => a + l.quantity, 0), subtotal, discount_total: 0, service_fee: 0, tax_total: tax,
            rounding: total - subtotal - tax, amount_paid: 0, change_amount: 0, notes: null, void_reason: null, approved_by_name: null,
            settled_at: null, due_at: null, queue_no: null, customer: null, items: lines, discounts: [],
            taxes: [{ name: "PB1", rate_bp: 1000, amount: tax }], payments: [], t, day, hour: wibHour(t), shift_id: shiftId,
          });
        }
        // DP reservasi tertahan (tamu belum datang): open, 0 item, bukan pesanan berjalan (api.md "DP reservasi").
        if (o.weight === 1) {
          const t = now - 50 * 60_000;
          const id = uuid(`dp:${day}:${o.id}`);
          daySales.push({
            id, receipt_no: `${o.code}-DP-1`, paid_at: new Date(t).toISOString(), outlet_id: o.id, outlet_name: o.name,
            cashier_id: cashier.id, cashier_name: cashier.name, customer_name: "Bu Rina", table_name: null, order_type: "dine_in",
            status: "open", payment_method: "qris", total: 0, paid_total: 100000, items_count: 0, reservation_id: uuid(`rsv:${day}`),
            deposit: "held", subtotal: 0, discount_total: 0, service_fee: 0, tax_total: 0, rounding: 0, amount_paid: 100000,
            change_amount: 0, notes: null, void_reason: null, approved_by_name: null, settled_at: null, due_at: null, queue_no: null,
            customer: null, items: [], discounts: [], taxes: [], t, day, hour: wibHour(t), shift_id: shiftId,
            payments: [{ id: uuid(`dp-pay:${day}`), method: "qris", amount: 100000, received: null, change: null, paid_at: new Date(t).toISOString(), cashier_name: cashier.name, purpose: "deposit" }],
          });
        }
      }
      sales.push(...daySales);

      // Shift harian per outlet (hari ini masih buka).
      if (opened > now) continue;
      const closedAt = back === 0 ? null : dayStart(day) + 22 * HOUR + r.int(0, 30) * 60_000;
      const movements: ShiftDetail["cash_movements"] = [];
      if (r.next() < 0.5) movements.push({ id: uuid(`mv:${shiftId}:1`), type: "out", amount: r.pick([25000, 40000, 60000]), reason: r.pick(["Beli es batu", "Beli gas", "Beli susu tambahan"]), cashier_name: cashier.name, created_at: new Date(opened + 3 * HOUR).toISOString() });
      if (r.next() < 0.25) movements.push({ id: uuid(`mv:${shiftId}:2`), type: "in", amount: 100000, reason: "Tambah uang kembalian", cashier_name: cashier.name, created_at: new Date(opened + 5 * HOUR).toISOString() });
      const counted = daySales.filter((s) => countedStatus(s.status));
      const cashPay = daySales.flatMap((s) => s.payments).filter((p) => p.method === "cash").reduce((a, p) => a + p.amount, 0);
      const cashIn = movements.filter((m) => m.type === "in").reduce((a, m) => a + m.amount, 0);
      const cashOut = movements.filter((m) => m.type === "out").reduce((a, m) => a + m.amount, 0);
      const opening = 300000;
      const expected = opening + cashPay + cashIn - cashOut;
      const diff = closedAt === null ? null : r.weighted<number>([[0, 14], [-5000, 2], [-20000, 1], [2000, 2], [500, 1]]);
      // Contoh tanda "Hitungan server berbeda": shift 3 hari lalu di outlet pertama tercatat perangkat 15.000 lebih tinggi.
      const deviceExpected = closedAt !== null && back === 3 && o.weight === 1 ? expected + 15000 : expected;
      // Contoh "Ditutup oleh": shift 2 hari lalu di outlet pertama ditutup kasir lain; selebihnya penutup = pembuka.
      const closer = closedAt === null ? null : back === 2 && o.weight === 1 ? CASHIERS[o.id][back % 2 === 0 ? 1 : 0].name : cashier.name;
      shifts.push({
        id: shiftId, outlet_id: o.id, outlet_name: o.name, device_name: device.name, cashier_id: cashier.id, cashier_name: cashier.name,
        closed_by_name: closer, status: closedAt === null ? "open" : "closed", opened_at: new Date(opened).toISOString(),
        closed_at: closedAt === null ? null : new Date(closedAt).toISOString(), opening_cash: opening, expected_cash: deviceExpected,
        expected_cash_server: expected, expected_mismatch: deviceExpected !== expected,
        closing_cash: diff === null ? null : deviceExpected + diff, difference: diff, sales_count: counted.length,
        sales_total: counted.reduce((a, s) => a + s.total, 0), cash_in: cashIn, cash_out: cashOut,
        notes: diff !== null && diff < -10000 ? "Selisih kurang, sudah dicek ulang laci" : null, movements,
      });
    }
  }
  sales.sort((a, b) => b.t - a.t);
  shifts.sort((a, b) => Date.parse(b.opened_at) - Date.parse(a.opened_at));
  return { sales, shifts, generatedFor: `${today}:${Math.floor(now / (5 * 60_000))}` };
}

// Perubahan dari web (pembatalan transaksi, kas masuk/keluar) disimpan terpisah lalu diterapkan di atas data bangkitan.
type SaleCancel = { status: "void" | "refunded"; reason: string; refunds: SaleDetail["payments"] };
const saleCancels = new Map<string, SaleCancel>();
const extraMovements = new Map<string, ShiftDetail["cash_movements"]>();

function applyOverlays(d: Db): Db {
  for (const s of d.sales) {
    const c = saleCancels.get(s.id);
    if (!c) continue;
    s.status = c.status;
    s.void_reason = c.reason;
    s.approved_by_name = USER.name;
    s.payments = [...s.payments, ...c.refunds];
    s.paid_total = s.payments.reduce((a, p) => a + p.amount, 0);
    if (s.reservation_id && s.items_count === 0) s.deposit = "refunded";
  }
  for (const sh of d.shifts) {
    const extra = extraMovements.get(sh.id);
    if (!extra?.length) continue;
    sh.movements = [...sh.movements, ...extra];
    const cin = extra.filter((m) => m.type === "in").reduce((a, m) => a + m.amount, 0);
    const cout = extra.filter((m) => m.type === "out").reduce((a, m) => a + m.amount, 0);
    sh.cash_in += cin;
    sh.cash_out += cout;
    sh.expected_cash += cin - cout;
    sh.expected_cash_server += cin - cout;
  }
  return d;
}

let cache: Db | null = null;
function db(): Db {
  const now = Date.now();
  const key = `${wibDay(now)}:${Math.floor(now / (5 * 60_000))}`;
  if (!cache || cache.generatedFor !== key) cache = applyOverlays(generate(now));
  return cache;
}

// ——— Perhitungan (cermin kontrak) ———

function countedStatus(s: string) {
  return s === "paid" || s === "unpaid" || s === "partial";
}
const cancelledStatus = (s: string) => s === "void" || s === "refunded";

type Agg = { revenue: number; transactions: number; items_sold: number; cost: number; nwc: number; without: number; discounts: number; tax: number; service: number; rounding: number; net: number };

function aggregate(sales: RawSale[]): Agg {
  const a: Agg = { revenue: 0, transactions: 0, items_sold: 0, cost: 0, nwc: 0, without: 0, discounts: 0, tax: 0, service: 0, rounding: 0, net: 0 };
  for (const s of sales) {
    if (!countedStatus(s.status)) continue;
    a.revenue += s.total;
    a.transactions++;
    a.discounts += s.discount_total + s.items.reduce((x, l) => x + l.discount, 0);
    a.tax += s.tax_total;
    a.service += s.service_fee;
    a.rounding += s.rounding;
    const net = s.subtotal - s.discount_total;
    a.net += net;
    let withCost = 0;
    for (const l of s.items) {
      a.items_sold += l.quantity;
      const unitCost = (l.cost_price ?? 0) + l.modCost;
      if (!l.cost_price) {
        a.without++;
        continue;
      }
      withCost += l.subtotal;
      a.cost += unitCost * l.quantity;
    }
    if (s.subtotal > 0) a.nwc += Math.round((net * withCost) / s.subtotal);
  }
  return a;
}

function grossProfit(a: Agg): number | null {
  if (a.cost === 0 && a.without > 0) return null;
  return a.nwc - a.cost;
}

function totals(sales: RawSale[]): Totals {
  const a = aggregate(sales);
  return {
    revenue: a.revenue,
    transactions: a.transactions,
    average: a.transactions ? Math.round(a.revenue / a.transactions) : 0,
    items_sold: a.items_sold,
    gross_profit: grossProfit(a),
  };
}

function products(sales: RawSale[]): ProductSales[] {
  const map = new Map<string, ProductSales>();
  for (const s of sales) {
    if (!countedStatus(s.status)) continue;
    for (const l of s.items) {
      const cur = map.get(l.product_key) ?? { key: l.product_key, name: l.name, variant_name: l.variant_name, is_custom: l.is_custom, quantity: 0, revenue: 0 };
      cur.quantity += l.quantity;
      cur.revenue += l.subtotal;
      map.set(l.product_key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue);
}

function cancelled(sales: RawSale[]) {
  const c = sales.filter((s) => cancelledStatus(s.status));
  return { count: c.length, amount: c.reduce((a, s) => a + s.total, 0) };
}

function credit(sales: RawSale[]) {
  const c = sales.filter((s) => s.status === "unpaid" || s.status === "partial");
  return { outstanding: c.reduce((a, s) => a + (s.total - s.paid_total), 0), count: c.length };
}

function listItem(s: RawSale): SaleListItem {
  return {
    id: s.id, receipt_no: s.receipt_no, paid_at: s.paid_at, outlet_id: s.outlet_id, outlet_name: s.outlet_name,
    cashier_id: s.cashier_id, cashier_name: s.cashier_name, customer_name: s.customer_name, table_name: s.table_name,
    order_type: s.order_type, status: s.status, payment_method: s.payment_method, total: s.total, paid_total: s.paid_total,
    items_count: s.items_count, reservation_id: s.reservation_id ?? null, deposit: s.deposit ?? null,
  };
}

function shiftItem(s: RawShift): ShiftListItem {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { notes, movements, ...rest } = s;
  return rest;
}

// ——— Sesi & paket ———

type MockSession = { plan: "free" | "pro" | "trial"; remember: boolean };

function readSession(): MockSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as MockSession) : null;
  } catch {
    return null;
  }
}
function writeSession(s: MockSession | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Penyimpanan diblokir — sesi tiruan hanya bertahan di memori.
  }
}

const ALL_FEATURES = ["insights", "multi_outlet", "kitchen_display", "self_order", "stock", "recipes", "staff"];

function plan(kind: MockSession["plan"]): OwnerPlan {
  if (kind === "free") {
    return {
      plan: "free", status: "free", enforced: true, features: ["kitchen_display"], ends_at: null, days_left: null,
      tx_limit: 50, tx_this_month: 37,
    };
  }
  if (kind === "trial") {
    return {
      plan: "pro", status: "trial", enforced: true, features: ALL_FEATURES,
      ends_at: new Date(Date.now() + 12 * DAY).toISOString(), days_left: 12, tx_limit: null, tx_this_month: 1284,
    };
  }
  return {
    plan: "pro", status: "active", enforced: true, features: ALL_FEATURES,
    ends_at: new Date(Date.now() + 143 * DAY).toISOString(), days_left: 143, tx_limit: null, tx_this_month: 1284,
  };
}

function sessionOf(s: MockSession): OwnerSession {
  const abs = s.remember ? 30 * DAY : 12 * HOUR;
  const idle = s.remember ? 7 * DAY : 2 * HOUR;
  // Zona usaha dari `business_settings` tiruan (data contoh sendiri tetap dibuat dalam WIB).
  const settings = mockStore.get("business_settings")?.get(BUSINESS.id)?.settings;
  const timezone = normalizeZone(typeof settings === "object" && settings !== null ? (settings as Record<string, unknown>).timezone : undefined);
  return {
    user: USER,
    business: { ...BUSINESS, timezone },
    outlets: liveOutlets().map((o) => ({ id: o.id, name: String(o.name ?? ""), address: (o.address as string | null) ?? null, status: o.status === "closed" ? "closed" : "open" })),
    subscription: plan(s.plan),
    session: {
      expires_at: new Date(Date.now() + abs).toISOString(),
      idle_expires_at: new Date(Date.now() + idle).toISOString(),
      confirmed_until: confirmedUntil > Date.now() ? new Date(confirmedUntil).toISOString() : null,
    },
  };
}

const locked = (s: MockSession) => (plan(s.plan).enforced && !plan(s.plan).features.includes("insights") ? ["insights"] : []);

function invalid(field: string, message: string) {
  return new ApiError(message, 422, "VALIDATION_ERROR", [{ field, message }]);
}

function checkOutlet(outletId: string | undefined) {
  if (outletId && !liveOutlets().some((o) => o.id === outletId)) throw invalid("outlet_id", "Outlet tidak ditemukan");
}

function range(from: string | undefined, to: string | undefined) {
  const today = wibDay(Date.now());
  const t = isDay(to) ? to! : today;
  const f = isDay(from) ? from! : addDays(t, -6);
  if ((from && !isDay(from)) || (to && !isDay(to))) throw invalid("from", "Format tanggal YYYY-MM-DD");
  if (f > t) throw invalid("from", "Tanggal awal setelah tanggal akhir");
  if (spanDays(f, t) > 92) throw invalid("to", "Rentang maksimal 92 hari");
  return { from: f, to: t };
}

const byOutlet = (outletId?: string) => (s: { outlet_id: string }) => !outletId || s.outlet_id === outletId;

// ——— API tiruan ———

export function createMockApi(onUnauthorized: () => void): OwnerApi {
  async function guard(): Promise<MockSession> {
    await sleep(200 + Math.random() * 250);
    const s = readSession();
    if (!s) {
      onUnauthorized();
      throw new ApiError("Sesi berakhir. Silakan masuk lagi.", 401, "UNAUTHORIZED");
    }
    return s;
  }

  return {
    async login(body) {
      await sleep(550);
      const id = body.identifier.trim().toLowerCase();
      if (!id) throw invalid("identifier", "Wajib diisi");
      if (id.includes("kunci")) throw new ApiError("Terlalu banyak percobaan masuk. Coba lagi nanti.", 429, "RATE_LIMITED", [], 60);
      if (!body.password || body.password === "salah") throw new ApiError("Email/nomor HP atau password salah", 401, "INVALID_CREDENTIALS");
      if (id.includes("kasir")) throw new ApiError("Dasbor web khusus pemilik usaha.", 403, "OWNER_ONLY");
      if (id.includes("verif")) throw new ApiError("Email belum terverifikasi.", 403, "EMAIL_NOT_VERIFIED");
      const s: MockSession = { plan: id.includes("gratis") ? "free" : id.includes("uji") ? "trial" : "pro", remember: !!body.remember_me };
      writeSession(s);
      return sessionOf(s);
    },
    async google(body) {
      await sleep(500);
      if (!body.id_token) throw new ApiError("Token Google tidak sah.", 401, "GOOGLE_TOKEN_INVALID");
      const s: MockSession = { plan: "pro", remember: !!body.remember_me };
      writeSession(s);
      return sessionOf(s);
    },
    async logout() {
      await sleep(200);
      writeSession(null);
    },
    async me() {
      await sleep(250);
      const s = readSession();
      if (!s) throw new ApiError("Belum masuk.", 401, "UNAUTHORIZED");
      return sessionOf(s);
    },

    async summary(q) {
      const s = await guard();
      checkOutlet(q.outlet_id);
      const now = Date.now();
      const today = wibDay(now);
      const yesterday = addDays(today, -1);
      const lastWeek = addDays(today, -7);
      const all = db().sales.filter(byOutlet(q.outlet_id));
      const ofDay = (d: string) => all.filter((x) => x.day === d);
      const todaySales = ofDay(today);
      const sinceMidnight = now - dayStart(today);
      const hourly = Array.from({ length: 24 }, (_, hour) => {
        const hs = todaySales.filter((x) => x.hour === hour && countedStatus(x.status));
        return { hour, revenue: hs.reduce((a, x) => a + x.total, 0), count: hs.length };
      });
      const lk = locked(s);
      const devices: OwnerDevice[] = OUTLETS.filter((o) => !q.outlet_id || o.id === q.outlet_id).flatMap((o) =>
        DEVICE_NAMES[o.id].map((d, i) => ({
          id: uuid(`dev:${o.id}:${i}`), name: d.name, mode: d.mode, outlet_id: o.id, outlet_name: o.name,
          last_seen_at: new Date(now - d.ago).toISOString(), app_version: d.version,
        }))
      );
      if (!q.outlet_id) {
        devices.push({ id: uuid("dev:owner"), name: "HP Rina", mode: "owner", outlet_id: null, outlet_name: null, last_seen_at: new Date(now - 2 * HOUR).toISOString(), app_version: "1.8.2" });
      }
      devices.sort((a, b) => Date.parse(b.last_seen_at ?? "0") - Date.parse(a.last_seen_at ?? "0"));
      const open = all.filter((x) => x.status === "open" && !(x.reservation_id && x.table_name === null));
      return {
        date: today,
        generated_at: new Date(now).toISOString(),
        today: totals(todaySales),
        yesterday: totals(ofDay(yesterday)),
        yesterday_same_time: totals(ofDay(yesterday).filter((x) => x.t - dayStart(yesterday) <= sinceMidnight)),
        last_week_same_day: totals(ofDay(lastWeek)),
        hourly,
        cancelled: cancelled(todaySales),
        open_orders: { count: open.length, total: open.reduce((a, x) => a + x.total, 0) },
        credit: credit(all),
        top_products: lk.includes("insights") ? null : products(todaySales).slice(0, 5),
        recent_sales: all.filter((x) => x.status !== "open").slice(0, 8).map(listItem),
        open_shifts: db().shifts.filter(byOutlet(q.outlet_id)).filter((x) => x.status === "open").map(shiftItem),
        devices,
        locked: lk,
      };
    },

    async salesReport(q) {
      const s = await guard();
      checkOutlet(q.outlet_id);
      const { from, to } = range(q.from, q.to);
      const days = spanDays(from, to);
      const all = db().sales.filter(byOutlet(q.outlet_id));
      const inRange = all.filter((x) => x.day >= from && x.day <= to);
      const counted = inRange.filter((x) => countedStatus(x.status));
      const a = aggregate(inRange);
      const pFrom = addDays(from, -days);
      const pTo = addDays(from, -1);
      const prev = totals(all.filter((x) => x.day >= pFrom && x.day <= pTo));
      const hourly = from === to;
      const buckets = hourly
        ? Array.from({ length: 24 }, (_, h) => {
            const hs = counted.filter((x) => x.hour === h);
            return { start: `${from}T${String(h).padStart(2, "0")}:00`, revenue: hs.reduce((r, x) => r + x.total, 0), count: hs.length };
          })
        : Array.from({ length: days }, (_, i) => {
            const d = addDays(from, i);
            const ds = counted.filter((x) => x.day === d);
            return { start: d, revenue: ds.reduce((r, x) => r + x.total, 0), count: ds.length };
          });
      const methods = new Map<string, number>();
      for (const sale of all) {
        for (const p of sale.payments) {
          const d = wibDay(Date.parse(p.paid_at));
          if (d >= from && d <= to) methods.set(p.method, (methods.get(p.method) ?? 0) + p.amount);
        }
      }
      const cashierMap = new Map<string, SalesReport["cashiers"][number]>();
      for (const x of inRange) {
        const c = cashierMap.get(x.cashier_id) ?? { cashier_id: x.cashier_id, name: x.cashier_name, count: 0, revenue: 0, average: 0, cancelled: 0 };
        if (countedStatus(x.status)) {
          c.count++;
          c.revenue += x.total;
        } else if (cancelledStatus(x.status)) c.cancelled++;
        cashierMap.set(x.cashier_id, c);
      }
      const cashiers = [...cashierMap.values()].map((c) => ({ ...c, average: c.count ? Math.round(c.revenue / c.count) : 0 })).sort((p, n) => n.revenue - p.revenue);
      const otMap = new Map<string | null, { order_type: string | null; count: number; revenue: number }>();
      for (const x of counted) {
        const o = otMap.get(x.order_type) ?? { order_type: x.order_type, count: 0, revenue: 0 };
        o.count++;
        o.revenue += x.total;
        otMap.set(x.order_type, o);
      }
      const lk = locked(s);
      const ins = !lk.includes("insights");
      const perHour = Array.from({ length: 24 }, (_, h) => counted.filter((x) => x.hour === h).length);
      const perWeekday = Array.from({ length: 7 }, (_, w) => counted.filter((x) => weekdayMon0(x.day) === w).length);
      const argmax = (arr: number[]) => (arr.every((v) => v === 0) ? null : arr.indexOf(Math.max(...arr)));
      const prods = products(inRange);
      return {
        from, to, days, hourly,
        revenue: a.revenue, transactions: a.transactions, average: a.transactions ? Math.round(a.revenue / a.transactions) : 0,
        discounts: a.discounts, tax: a.tax, service_fee: a.service, rounding: a.rounding, net_items: a.net, cost: a.cost,
        net_items_with_cost: a.nwc, items_without_cost: a.without, items_sold: a.items_sold, gross_profit: grossProfit(a),
        previous: { from: pFrom, to: pTo, revenue: prev.revenue, transactions: prev.transactions },
        growth_percent: prev.revenue === 0 ? null : Math.round(((a.revenue - prev.revenue) / prev.revenue) * 100),
        credit: credit(all),
        cancelled: cancelled(inRange),
        per_method: [...methods.entries()].filter(([, v]) => v !== 0).map(([method, amount]) => ({ method, amount })).sort((p, n) => n.amount - p.amount),
        buckets,
        cashiers,
        order_types: [...otMap.values()].sort((p, n) => n.revenue - p.revenue),
        products: ins ? prods.slice(0, 100) : null,
        products_total: ins ? prods.length : null,
        per_hour: ins ? perHour : null,
        per_weekday: ins ? perWeekday : null,
        peak_hour: ins ? argmax(perHour) : null,
        peak_weekday: ins ? argmax(perWeekday) : null,
        locked: lk,
      };
    },

    async outletsReport(q) {
      await guard();
      const { from, to } = range(q.from, q.to);
      const all = db().sales;
      const rows: OutletRow[] = liveOutlets().map((o) => {
        const os = all.filter((x) => x.outlet_id === o.id);
        const inRange = os.filter((x) => x.day >= from && x.day <= to);
        const t = totals(inRange);
        return {
          outlet_id: o.id, name: String(o.name ?? ""), status: o.status === "closed" ? "closed" : "open", revenue: t.revenue, transactions: t.transactions, average: t.average,
          gross_profit: t.gross_profit, cancelled_count: cancelled(inRange).count, credit_outstanding: credit(os).outstanding, share_percent: 0,
        };
      });
      const total = rows.reduce((a, r) => a + r.revenue, 0);
      rows.forEach((r) => (r.share_percent = total ? Math.round((r.revenue / total) * 1000) / 10 : 0));
      rows.sort((p, n) => n.revenue - p.revenue);
      const tx = rows.reduce((a, r) => a + r.transactions, 0);
      const gp = rows.every((r) => r.gross_profit === null) ? null : rows.reduce((a, r) => a + (r.gross_profit ?? 0), 0);
      return {
        from, to, outlets: rows,
        total: {
          revenue: total, transactions: tx, average: tx ? Math.round(total / tx) : 0, gross_profit: gp,
          cancelled_count: rows.reduce((a, r) => a + r.cancelled_count, 0), credit_outstanding: rows.reduce((a, r) => a + r.credit_outstanding, 0),
        },
      };
    },

    async sales(q) {
      await guard();
      checkOutlet(q.outlet_id);
      const { from, to } = range(q.from, q.to);
      const term = (q.q ?? "").trim().toLowerCase();
      let rows = db().sales.filter(byOutlet(q.outlet_id)).filter((x) => x.day >= from && x.day <= to);
      if (q.status?.length) rows = rows.filter((x) => q.status!.includes(x.status));
      if (q.method?.length) rows = rows.filter((x) => q.method!.includes(x.payment_method));
      if (q.cashier_id) rows = rows.filter((x) => x.cashier_id === q.cashier_id);
      if (term) rows = rows.filter((x) => x.receipt_no.toLowerCase().includes(term) || (x.customer_name ?? "").toLowerCase().includes(term));
      if (q.sort === "oldest") rows = [...rows].sort((a, b) => a.t - b.t);
      else if (q.sort === "total_desc") rows = [...rows].sort((a, b) => b.total - a.total || b.t - a.t);
      const page = Math.max(1, q.page ?? 1);
      const perPage = Math.min(100, Math.max(1, q.per_page ?? 25));
      return {
        items: rows.slice((page - 1) * perPage, page * perPage).map(listItem),
        meta: { page, per_page: perPage, total: rows.length },
        summary: { count: rows.length, total: rows.reduce((a, x) => a + x.total, 0) },
      };
    },

    async sale(id) {
      await guard();
      const s = db().sales.find((x) => x.id === id);
      if (!s) throw new ApiError("Transaksi tidak ditemukan.", 404, "NOT_FOUND");
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { t, day, hour, shift_id, items, ...rest } = s;
      return {
        ...rest,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        items: items.map(({ product_key, modCost, ...l }) => ({ ...l, cost_price: l.cost_price === null ? null : l.cost_price + modCost })),
      };
    },

    async shifts(q) {
      await guard();
      checkOutlet(q.outlet_id);
      const { from, to } = range(q.from, q.to);
      let rows = db().shifts.filter(byOutlet(q.outlet_id)).filter((x) => {
        const d = wibDay(Date.parse(x.opened_at));
        return d >= from && d <= to;
      });
      if (q.status) rows = rows.filter((x) => x.status === q.status);
      const page = Math.max(1, q.page ?? 1);
      const perPage = Math.min(100, Math.max(1, q.per_page ?? 25));
      return { items: rows.slice((page - 1) * perPage, page * perPage).map(shiftItem), meta: { page, per_page: perPage, total: rows.length } };
    },

    async shift(id) {
      await guard();
      const sh = db().shifts.find((x) => x.id === id);
      if (!sh) throw new ApiError("Shift tidak ditemukan.", 404, "NOT_FOUND");
      const ss = db().sales.filter((x) => x.shift_id === id);
      const methods = new Map<string, number>();
      for (const p of ss.flatMap((x) => x.payments)) methods.set(p.method, (methods.get(p.method) ?? 0) + p.amount);
      return {
        ...shiftItem(sh),
        notes: sh.notes,
        per_method: [...methods.entries()].filter(([, v]) => v !== 0).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
        cash_movements: sh.movements,
        cancelled: cancelled(ss),
      };
    },
    async activity(q) {
      await guard();
      checkOutlet(q.outlet_id);
      const { from, to } = range(q.from, q.to);
      const inDay = (iso: string) => {
        const d = wibDay(Date.parse(iso));
        return d >= from && d <= to;
      };
      const base = { approver: null, receipt_no: null, amount: null, note: null, expected: null, counted: null, difference: null };
      const out: ActivityItem[] = [];
      for (const x of db().sales.filter(byOutlet(q.outlet_id)).filter((x) => x.day >= from && x.day <= to)) {
        const ref = { outlet_id: x.outlet_id, outlet_name: x.outlet_name, actor: x.cashier_name, ref_id: x.id, receipt_no: x.receipt_no };
        if (x.status === "void" || x.status === "refunded") {
          out.push({ ...base, ...ref, kind: x.status === "void" ? "void" : "refund", at: x.paid_at, approver: x.approved_by_name, amount: x.total, note: x.void_reason });
        }
        if (x.discount_total > 0) out.push({ ...base, ...ref, kind: "manual_discount", at: x.paid_at, amount: x.discount_total, note: "Diskon nota 10%" });
      }
      for (const sh of db().shifts.filter(byOutlet(q.outlet_id))) {
        const ref = { outlet_id: sh.outlet_id, outlet_name: sh.outlet_name, ref_id: sh.id };
        if (sh.closed_at && inDay(sh.closed_at)) {
          out.push({ ...base, ...ref, kind: "shift_closed", at: sh.closed_at, actor: sh.cashier_name, note: sh.notes, expected: sh.expected_cash, counted: sh.closing_cash, difference: sh.difference });
        }
        for (const m of sh.movements.filter((m) => inDay(m.created_at))) {
          out.push({ ...base, ...ref, kind: m.type === "in" ? "cash_in" : "cash_out", at: m.created_at, actor: m.cashier_name, amount: m.amount, note: m.reason });
        }
      }
      // Perangkat baru hanya tampil saat semua outlet.
      const yesterday = addDays(wibDay(Date.now()), -1);
      if (!q.outlet_id && yesterday >= from && yesterday <= to) {
        out.push({ ...base, kind: "new_device", at: new Date(dayStart(yesterday) + 20 * HOUR).toISOString(), outlet_id: null, outlet_name: null, actor: USER.name, ref_id: null, note: "" });
      }
      // Riwayat perubahan data (tidak terikat outlet → tampil di semua pilihan outlet).
      const today = wibDay(Date.now());
      const d2 = addDays(today, -2);
      type MockChange = [day: string, hour: number, entity: string, op: "create" | "update" | "delete", note: string, changes: ActivityFieldChange[], actor?: string, device?: string];
      const changes: MockChange[] = [
        [today, 9.5, "products", "update", "Americano", [{ field: "price", before: 20000, after: 21000 }]],
        [today, 10, "products", "create", "Teh Tarik", [{ field: "name", before: null, after: "Teh Tarik" }, { field: "price", before: null, after: 15000 }, { field: "is_active", before: null, after: true }], "Rani", "Kasir Dago"],
        [today, 11, "outlets", "update", "Kopi Senja Dago", [{ field: "settings.payment_methods", before: { qris: { enabled: true, payload: "a" } }, after: { qris: { enabled: true, payload: "b" } } }]],
        [today, 11.25, "employees", "update", "Rani", [{ field: "pin_hash", before: null, after: null }]],
        [d2, 15, "products", "update", "Croissant", [{ field: "price", before: 18000, after: 19000 }, { field: "cost_price", before: 8000, after: 8500 }, { field: "is_active", before: true, after: false }]],
        [d2, 16, "business_settings", "update", "Pengaturan usaha", [{ field: "settings.loyalty", before: null, after: { enabled: true } }]],
        [d2, 17, "discounts", "delete", "Promo Kemerdekaan", []],
      ];
      for (const [day, h, entity, op, note, ch, actor, device] of changes) {
        if (day < from || day > to) continue;
        out.push({ ...base, kind: "change", at: new Date(dayStart(day) + h * HOUR).toISOString(), outlet_id: null, outlet_name: null, actor: actor ?? USER.name, ref_id: uuid(`chg:${entity}:${note}`), note, entity, op, changes: ch, device: device ?? "Dasbor web" });
      }
      const kinds = q.kind?.length ? new Set(q.kind) : null;
      const rows = out.filter((a) => !kinds || kinds.has(a.kind)).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
      const page = Math.max(1, q.page ?? 1);
      const perPage = Math.min(100, Math.max(1, q.per_page ?? 50));
      return { items: rows.slice((page - 1) * perPage, page * perPage), meta: { page, per_page: perPage, total: rows.length } };
    },
    async staff() {
      await guard();
      const list: StaffMember[] = [
        { ...OWNER_CASHIER, role: "owner", is_active: true, deleted: false },
        ...Object.values(CASHIERS).flat().map((c) => ({ ...c, role: "cashier" as const, is_active: true, deleted: false })),
        { id: uuid("c5"), name: "Putra", role: "cashier", is_active: false, deleted: false },
        { id: uuid("c6"), name: "Lina", role: "cashier", is_active: false, deleted: true },
        { id: uuid("k1"), name: "Dapur Dago", role: "kitchen", is_active: true, deleted: false },
        { id: uuid("staff:wulan"), name: "Wulan", role: "staff", is_active: true, deleted: false },
        { id: uuid("staff:joko"), name: "Joko", role: "staff", is_active: true, deleted: false },
      ];
      return list;
    },
    async confirm(body) {
      await guard();
      await sleep(300);
      if ("password" in body && (!body.password || body.password === "salah")) {
        throw new ApiError("Email/nomor HP atau password salah", 401, "INVALID_CREDENTIALS");
      }
      confirmedUntil = Date.now() + 10 * 60_000;
      return { confirmed_until: new Date(confirmedUntil).toISOString() };
    },
    // Tahap 2–3: penyimpanan tiruan di memori, diisi data contoh minimal (lihat `seedStore`).
    async pull(entity) {
      await guard();
      return { items: [...(store(entity).values())], cursor: "x", has_more: false, server_time: new Date().toISOString() };
    },
    async changes(changes) {
      const s = await guard();
      const now = new Date().toISOString();
      // Aturan server yang ditiru: kuota outlet, konfirmasi ulang untuk metode pembayaran (422 untuk seluruh kiriman).
      changes.forEach((c, i) => {
        if (c.entity !== "outlets" || c.op !== "upsert") return;
        const cur = store("outlets").get(c.id);
        if (!cur || cur.deleted_at) {
          const quota = s.plan === "free" ? 1 : 2;
          if (liveOutlets().length >= quota) throw invalid(`changes[${i}]`, `Kuota outlet paket ini ${quota}. Tambah kuota outlet lewat menu Langganan.`);
        }
        const before = JSON.stringify(((cur?.settings ?? {}) as Record<string, unknown>).payment_methods ?? null);
        const after = JSON.stringify(((c.data?.settings ?? {}) as Record<string, unknown>).payment_methods ?? null);
        if (before !== after && confirmedUntil <= Date.now()) {
          throw invalid(`changes[${i}]`, "CONFIRM_REQUIRED: Konfirmasi password untuk mengubah metode pembayaran (QRIS & rekening)");
        }
      });
      // Pengajuan (api.md "Kelola data › Pengajuan"): status final beku → conflict; absen di kiriman yang sama hanya
      // diterapkan bila keputusan pengajuan diterapkan.
      let leaveFailed = false;
      return {
        server_time: now,
        results: changes.map((c) => {
          const id = c.id;
          if (c.entity === "leave_requests") {
            const cur = store("leave_requests").get(id);
            if (!cur || c.op === "delete") {
              leaveFailed = true;
              return { entity: c.entity, id, status: "rejected" as const, code: "FORBIDDEN", message: "Pengajuan tidak dapat dibuat/dihapus pemilik", details: [] };
            }
            if (cur.status !== "pending" || (c.base_updated_at && cur.updated_at !== c.base_updated_at)) {
              leaveFailed = true;
              return { entity: c.entity, id, status: "conflict" as const, code: "CONFLICT", record: cur };
            }
          }
          if (c.entity === "attendances" && leaveFailed) {
            return { entity: c.entity, id, status: "rejected" as const, code: "CONFLICT", message: "Pengajuan tidak diterapkan; absen tidak ditulis", details: [] };
          }
          if (c.entity === "sales") {
            const sale = db().sales.find((x) => x.id === id);
            if (!sale) return { entity: c.entity, id, status: "rejected" as const, message: "Transaksi tidak ditemukan", details: [] };
            const d = (c.data ?? {}) as { status?: "void" | "refunded"; void_reason?: string; payments?: { id: string; method: string; amount: number; paid_at: string }[] };
            saleCancels.set(id, {
              status: d.status === "refunded" ? "refunded" : "void",
              reason: d.void_reason ?? "",
              refunds: (d.payments ?? []).map((p) => ({ id: p.id, method: p.method, amount: p.amount, received: null, change: null, paid_at: p.paid_at, cashier_name: USER.name, purpose: (p as { purpose?: "deposit_refund" }).purpose ?? null })),
            });
            cache = null;
            return { entity: c.entity, id, status: "applied" as const, record: null };
          }
          if (c.entity === "cash_movements") {
            const d = (c.data ?? {}) as { shift_id: string; type: "in" | "out"; amount: number; reason: string };
            const list = extraMovements.get(d.shift_id) ?? [];
            list.push({ id, type: d.type, amount: d.amount, reason: d.reason, cashier_name: USER.name, created_at: now });
            extraMovements.set(d.shift_id, list);
            cache = null;
            return { entity: c.entity, id, status: "applied" as const, record: null };
          }
          const table = store(c.entity);
          const cur = table.get(id);
          if (cur && c.base_updated_at && cur.updated_at !== c.base_updated_at) {
            return { entity: c.entity, id, status: "conflict" as const, record: cur };
          }
          if (c.entity === "outlets" && c.op === "delete" && cur && !cur.deleted_at && liveOutlets().length <= 1) {
            return { entity: c.entity, id, status: "rejected" as const, code: "LAST_OUTLET", message: "Minimal harus ada satu outlet", details: [], record: cur };
          }
          const rec: SyncRecord = { ...(cur ?? {}), ...(c.data ?? {}), id, updated_at: now, deleted_at: c.op === "delete" ? now : null };
          if (c.entity === "employees") {
            // Aturan peran `staff` & `job_title` (api.md "Peran `staff` & jabatan").
            const reject = (field: string, message: string) => ({ entity: c.entity, id, status: "rejected" as const, code: "VALIDATION_ERROR", message, details: [{ field, message }], record: cur });
            const d = c.data ?? {};
            if ("job_title" in d) {
              const t = typeof d.job_title === "string" ? d.job_title.trim() : "";
              if (t.length > 40) return reject("job_title", "Jabatan maksimal 40 karakter");
              rec.job_title = t || null;
            }
            if (rec.role === "staff") {
              if (d.personal_access === "full") return reject("personal_access", "Karyawan (absen saja) tidak bisa akses sesuai tugas");
              if (cur?.role !== "staff" && rec.personal_access === "full") rec.personal_access = "staff_space";
            }
          }
          if (c.entity === "employees" && c.data && "bound_device_id" in c.data) {
            if (c.data.bound_device_id !== null) {
              return { entity: c.entity, id, status: "rejected" as const, message: "bound_device_id hanya boleh null", details: [{ field: "bound_device_id", message: "Hanya boleh dilepas" }], record: cur };
            }
            rec.bound_at = null;
          }
          table.set(id, rec);
          return { entity: c.entity, id, status: "applied" as const, record: rec };
        }),
      };
    },
    async stock(q) {
      await guard();
      checkOutlet(q.outlet_id);
      return [
        { kind: "product", product_id: PRODUCTS[7].id, variant_id: null, raw_material_id: null, name: PRODUCTS[7].name, variant_name: null, category: "Makanan", unit: "pcs", qty: 14_000, min_stock: 10_000, low: false },
        { kind: "product", product_id: PRODUCTS[12].id, variant_id: null, raw_material_id: null, name: PRODUCTS[12].name, variant_name: null, category: "Minuman", unit: "botol", qty: 4_000, min_stock: 12_000, low: true },
      ];
    },
    async inviteEmployee(id) {
      const s = await guard();
      if (s.plan === "free") throw new ApiError("Undang karyawan login di HP pribadi butuh Sissi Pro.", 403, "PRO_REQUIRED");
      const e = store("employees").get(id);
      if (!e || e.deleted_at) throw new ApiError("Karyawan tidak ditemukan.", 404, "NOT_FOUND");
      if (e.is_active === false || (e.role !== "cashier" && e.role !== "kitchen" && e.role !== "staff")) throw invalid("role", "Hanya karyawan aktif (bukan pemilik) yang bisa diundang");
      if (!e.phone) throw invalid("phone", "Isi no. HP karyawan dulu — no. HP dipakai untuk masuk");
      if (e.personal_access === "none") throw invalid("personal_access", "Izinkan akses dari HP pribadi dulu");
      const reset = e.has_password === true;
      const expires = new Date(Date.now() + (reset ? DAY : 7 * DAY)).toISOString();
      const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
      const raw = Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => alphabet[b % 32]).join("");
      store("employees").set(id, { ...e, invite_expires_at: expires, updated_at: new Date().toISOString() });
      return {
        code: `${raw.slice(0, 5)}-${raw.slice(5)}`,
        url: `${window.location.origin}/undangan/${raw}`,
        purpose: reset ? "reset_password" : "invite",
        expires_at: expires,
      };
    },
    async cancelInvite(id) {
      const s = await guard();
      if (s.plan === "free") throw new ApiError("Undang karyawan login di HP pribadi butuh Sissi Pro.", 403, "PRO_REQUIRED");
      const e = store("employees").get(id);
      if (!e || e.deleted_at) throw new ApiError("Karyawan tidak ditemukan.", 404, "NOT_FOUND");
      if (e.invite_expires_at) store("employees").set(id, { ...e, invite_expires_at: null, updated_at: new Date().toISOString() });
    },
    async subscription() {
      const s = await guard();
      const p = plan(s.plan);
      const outlets = liveOutlets().length;
      const quota = s.plan === "free" ? 1 : 2;
      const now = new Date();
      return {
        plan: p.plan,
        status: p.status,
        enforced: p.enforced,
        trial_ends_at: s.plan === "trial" ? p.ends_at : null,
        current_period_end: s.plan === "pro" ? p.ends_at : null,
        grace_ends_at: null,
        ends_at: p.ends_at,
        days_left: p.days_left,
        billing_cycle: s.plan === "pro" ? "yearly" : null,
        limits: { tx_per_month: p.tx_limit, outlets: quota },
        features: p.features,
        usage: { month: wibDay(now.getTime()).slice(0, 7), tx_this_month: p.tx_this_month, outlets, over_limit: false, outlets_over: outlets > quota },
        server_time: now.toISOString(),
        billing: {
          prices: { monthly: 99_000, yearly: 990_000 },
          payment_info: {
            bank_accounts: [{ bank: "BCA", number: "1234567890", holder: "PT Contoh Sissi" }],
            whatsapp: "+6281200000000",
            instructions: "Transfer sesuai harga paket, lalu kirim bukti lewat tombol \"Chat admin via WhatsApp\".",
            updated_at: now.toISOString(),
          },
          payments:
            s.plan === "pro"
              ? [{ id: uuid("subpay1"), paid_at: new Date(now.getTime() - 222 * DAY).toISOString(), amount: 990_000, cycle: "yearly", period_start: wibDay(now.getTime() - 222 * DAY), period_end: wibDay(now.getTime() + 143 * DAY), method: "transfer", status: "active" }]
              : [],
        },
      };
    },
  };
}

// ——— Penyimpanan data kelola (tiruan) ———

let confirmedUntil = 0;

const T0 = new Date(Date.UTC(2026, 6, 1, 3)).toISOString();
const rec = (id: string, data: Record<string, unknown>): SyncRecord => ({ id, ...data, created_at: T0, updated_at: T0, deleted_at: null });

/** Data contoh minimal per entitas (bentuk record = api.md "Sync v1"); entitas lain mulai kosong. */
function seedStore(): Map<string, Map<string, SyncRecord>> {
  const m = new Map<string, Map<string, SyncRecord>>();
  const put = (entity: string, rows: SyncRecord[]) => m.set(entity, new Map(rows.map((r) => [r.id, r])));
  const catDrink = uuid("cat:minuman");
  const catFood = uuid("cat:makanan");
  const modGroup = uuid("mod:kopi");
  put("outlets", OUTLETS.map((o, i) =>
    rec(o.id, {
      name: o.name, address: o.address, status: o.status, image_url: null,
      settings: {
        taxes: o.tax ? [{ id: uuid(`tax:${o.id}`), name: "PB1", rate_bp: 1000, enabled: true }] : [],
        service_fee: { enabled: o.service, type: "percent", rate_bp: 500, amount: 0, order_types: ["dine_in"], taxable: true },
        payment_methods: {
          qris: { enabled: true, merchant_name: i === 0 ? "KOPI SENJA DAGO" : "", payload: "", image_url: null },
          transfer: { enabled: true, accounts: i === 0 ? [{ id: uuid(`acc:${o.id}`), bank: "BCA", number: "1234567890", holder: "Rina Wulandari" }] : [] },
          card: { enabled: i === 0 },
        },
      },
    })
  ));
  put("business_settings", [rec(BUSINESS.id, { settings: { timezone: "Asia/Jakarta", loyalty: { enabled: false } } })]);
  put("categories", [rec(catDrink, { name: "Minuman", sort_order: 0 }), rec(catFood, { name: "Makanan", sort_order: 1 })]);
  put("modifier_groups", [
    rec(modGroup, { name: "Tambahan kopi", min_select: 0, max_select: 2, sort_order: 0, options: MODIFIERS.map((x, i) => ({ id: uuid(`modopt:${i}`), name: x.name, price: x.price, cost_price: x.cost, recipe: [] })) }),
  ]);
  const food = new Set([PRODUCTS[7].id, PRODUCTS[8].id, PRODUCTS[9].id, PRODUCTS[10].id, PRODUCTS[11].id]);
  put("products", PRODUCTS.map((p, i) =>
    rec(p.id, {
      category_id: food.has(p.id) ? catFood : catDrink, name: p.name, description: "", price: p.price, sku: `KS-${String(i + 1).padStart(3, "0")}`,
      barcode: null, barcodes: [], image_url: null, is_active: true, cost_price: p.cost, track_stock: i === 7 || i === 12, min_stock: i === 12 ? 12_000 : i === 7 ? 10_000 : 0,
      unit: i === 12 ? "botol" : food.has(p.id) ? "porsi" : "cup", is_taxable: true, is_cookable: true,
      modifier_group_ids: p.price >= 20000 && !food.has(p.id) ? [modGroup] : [], duration_min: null,
      variant_options: p.variants ? [{ name: "Pilihan", values: p.variants.map((v) => v.name) }] : [],
    })
  ));
  put("product_variants", PRODUCTS.flatMap((p) =>
    (p.variants ?? []).map((v, k) =>
      rec(v.id, {
        product_id: p.id, name: v.name, price: p.price + v.add, sku: null, barcode: null, barcodes: [], is_active: true,
        cost_price: p.cost, min_stock: null, sort_order: k + 1, options: { Pilihan: v.name }, image_url: null,
      })
    )
  ));
  put("customers", CUSTOMERS.map((c) => rec(c.id, { name: c.name, phone: c.phone, email: null, notes: "", birthday: null, is_member: true })));
  // Akun HP pribadi (api.md "Akun karyawan & Ruang Karyawan"): Dewi terikat HP, Bagas diundang, Sari punya akun
  // (HP dilepas), Yoga belum diundang (tanpa no. HP), Dapur tidak bisa login. Karyawan (absen saja): Wulan (CS,
  // diundang ke Ruang Karyawan) & Joko (Kebersihan, tanpa HP pribadi — absennya dicatat lewat Tim › Absen).
  const account: Record<string, Record<string, unknown>> = {
    Dewi: { job_title: "Kasir senior", phone: "+6281234567789", personal_access: "full", outlet_ids: [OUTLETS[0].id], has_password: true, bound_device_id: uuid("dev:dewi"), bound_at: new Date(Date.now() - 9 * DAY).toISOString() },
    Bagas: { phone: "+6281298765432", invite_expires_at: new Date(Date.now() + 5 * DAY).toISOString() },
    Sari: { phone: "+6285711112222", has_password: true, outlet_ids: [OUTLETS[1].id] },
  };
  const base = { personal_access: "staff_space", outlet_ids: null, has_password: false, invite_expires_at: null, bound_device_id: null, bound_at: null };
  put("employees", [
    ...Object.values(CASHIERS).flat().map((c) =>
      rec(c.id, { name: c.name, role: "cashier", email: null, phone: null, payroll: null, pin_hash: null, is_active: true, ...base, ...account[c.name] })
    ),
    rec(uuid("k1"), { name: "Dapur Dago", role: "kitchen", email: null, phone: null, payroll: null, pin_hash: null, is_active: true, ...base, personal_access: "none" }),
    rec(uuid("staff:wulan"), { name: "Wulan", role: "staff", job_title: "CS", email: null, phone: "+6281355556666", payroll: null, pin_hash: null, is_active: true, ...base, invite_expires_at: new Date(Date.now() + 6 * DAY).toISOString() }),
    rec(uuid("staff:joko"), { name: "Joko", role: "staff", job_title: "Kebersihan", email: null, phone: null, payroll: null, pin_hash: null, is_active: true, ...base, personal_access: "none" }),
  ]);
  seedLeaves(put);
  return m;
}

/**
 * Pengajuan contoh: tiga menunggu (Dewi sakit — kemarin sudah absen masuk; Bagas cuti lintas hari Minggu; Sari izin
 * beralasan panjang) + disetujui/ditolak/dibatalkan. Tanggal relatif hari ini (WIB); libur bawaan = Minggu.
 */
function seedLeaves(put: (entity: string, rows: SyncRecord[]) => void) {
  const today = wibDay(Date.now());
  const wd = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Minggu
  const nextSunday = addDays(today, wd === 0 ? 7 : 7 - wd);
  const [dewi, bagas, sari, yoga] = [uuid("c1"), uuid("c2"), uuid("c3"), uuid("c4")];
  const at = (daysAgo: number, hour = 9) => new Date(Date.parse(`${addDays(today, -daysAgo)}T00:00:00Z`) - 7 * HOUR + hour * HOUR).toISOString();
  const leave = (seed: string, d: Record<string, unknown>, createdDaysAgo: number) => ({
    ...rec(uuid(`leave:${seed}`), { outlet_id: null, status: "pending", decided_by: null, decided_at: null, decision_note: "", ...d }),
    created_at: at(createdDaysAgo, 7),
    updated_at: at(createdDaysAgo, 7),
  });
  put("leave_requests", [
    leave("dewi-sakit", { employee_id: dewi, outlet_id: OUTLETS[0].id, kind: "sick", date_from: addDays(today, -1), date_to: addDays(today, 1), reason: "Demam tinggi sejak semalam, sudah ke dokter. Surat dokter menyusul." }, 0),
    leave("bagas-cuti", { employee_id: bagas, kind: "leave", date_from: addDays(nextSunday, -2), date_to: addDays(nextSunday, 1), reason: "Acara keluarga di Bandung (pernikahan kakak)." }, 1),
    leave("sari-izin", {
      employee_id: sari,
      kind: "permit",
      date_from: addDays(today, 3),
      date_to: addDays(today, 3),
      reason:
        "Mengurus perpanjangan SIM dan KTP di kantor kecamatan karena antreannya panjang sekali, jadi kemungkinan baru selesai sore hari. Kalau sempat saya kabari untuk masuk setengah hari setelahnya.",
    }, 2),
    leave("yoga-sakit", { employee_id: yoga, kind: "sick", date_from: addDays(today, -10), date_to: addDays(today, -9), reason: "Flu dan batuk.", status: "approved", decided_by: USER.id, decided_at: at(10, 10), decision_note: "Semoga cepat sembuh" }, 11),
    leave("dewi-izin", { employee_id: dewi, kind: "permit", date_from: addDays(today, -6), date_to: addDays(today, -6), reason: "Menghadiri wisuda adik.", status: "rejected", decided_by: USER.id, decided_at: at(12, 11), decision_note: "Hari itu ada pesanan besar, mohon ganti tanggal lain." }, 13),
    leave("bagas-batal", { employee_id: bagas, kind: "permit", date_from: addDays(today, -4), date_to: addDays(today, -4), reason: "Antar orang tua kontrol ke rumah sakit.", status: "cancelled" }, 6),
  ]);
  // Dewi sudah absen masuk kemarin (PIN di perangkat toko) → tanggal itu dilewati saat pengajuan sakitnya disetujui.
  const yesterday = addDays(today, -1);
  put("attendances", [
    rec(uuid(`att:${dewi}:${yesterday}`), {
      outlet_id: OUTLETS[0].id, employee_id: dewi, date: yesterday, clock_in_at: at(1, 8), clock_out_at: at(1, 12),
      status: "ontime", late_minutes: 0, note: "Pulang lebih awal, tidak enak badan", source: "pin", edited_by: null, edit_reason: "",
    }),
  ]);
}

const mockStore = seedStore();

function store(entity: string): Map<string, SyncRecord> {
  let t = mockStore.get(entity);
  if (!t) {
    t = new Map();
    mockStore.set(entity, t);
  }
  return t;
}

/** Outlet hidup (urut dibuat), sumber pemilih outlet & laporan outlet tiruan. */
function liveOutlets(): SyncRecord[] {
  return [...store("outlets").values()].filter((o) => !o.deleted_at);
}

