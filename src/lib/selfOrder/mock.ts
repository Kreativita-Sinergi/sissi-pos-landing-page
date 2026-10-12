// Server tiruan untuk mencoba halaman /pesan/<kode> tanpa sissi-service.
// Hanya dimuat bila NEXT_PUBLIC_SELF_ORDER_MOCK=1 (lihat api.ts). Status pesanan maju menurut waktu.
//
// Kode contoh (bagian dari kode menentukan perilaku, bisa digabung, mis. /pesan/pilih-online):
//   apa saja   → QR Meja 5, bayar di kasir          pilih…   → QR outlet, pelanggan memilih meja
//   bawa…      → tanpa meja (ambil di konter)        …online… → bayar online (QRIS tiruan, lunas ±20 dtk)
//   …nama…     → nama pemesan wajib                  …tolak…  → kasir menolak pesanan
//   …diam…     → kasir tidak merespons               …kedaluwarsa… → QR pembayaran kedaluwarsa (45 dtk)
//   …harga…    → kiriman pertama: harga berubah      …habis…  → kiriman pertama: item habis
//   salah → 404 · tutup → 403 · limit → 429
import { ApiError } from "@/lib/sissiApi";
import type { SelfOrderApi } from "./api";
import { computeBreakdown } from "./pricing";
import type {
  CreateOrderBody,
  CreateOrderResponse,
  Menu,
  MenuProduct,
  OrderStatus,
  OrderStatusResponse,
  Payment,
  PublicOrder,
  PublicTable,
} from "./types";

const STORE_KEY = "sissi-pesan-mock:v1";

type MockOrder = {
  order: PublicOrder;
  code: string;
  accessKey: string;
  groupKey: string;
  createdMs: number;
  paidMs: number | null;
  canceledMs: number | null;
  payment: Payment | null;
};

type MockState = {
  orders: Record<string, MockOrder>;
  idem: Record<string, string>; // `${code}|${key}` → JSON respons
  bumped: string[]; // kode yang harganya sudah dinaikkan
  soldOut: string[]; // `${code}|${productId}`
  counter: number;
};

let memory: MockState = { orders: {}, idem: {}, bumped: [], soldOut: [], counter: 11 };

function load(): MockState {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) memory = JSON.parse(raw) as MockState;
  } catch {
    // Pakai memori.
  }
  return memory;
}

function save(state: MockState): void {
  memory = state;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    // Diabaikan.
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms + Math.random() * 250));

function fail(status: number, code: string, message: string, details: { field: string; message: string }[] = [], retryAfter: number | null = null): never {
  throw new ApiError(message, status, code, details, retryAfter);
}

function randomKey(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const uuid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ---------- Data contoh: kafe ----------

const CAT = { kopi: "c-kopi", nonKopi: "c-nonkopi", makanan: "c-makanan" };

const TABLES: PublicTable[] = [
  { id: "t-1", name: "Meja 1", area_name: "Dalam" },
  { id: "t-2", name: "Meja 2", area_name: "Dalam" },
  { id: "t-3", name: "Meja 3", area_name: "Dalam" },
  { id: "t-4", name: "Meja 4", area_name: "Teras" },
  { id: "t-5", name: "Meja 5", area_name: "Teras" },
  { id: "t-6", name: "Meja 6", area_name: "Teras" },
];

const topping = {
  id: "g-topping",
  name: "Topping",
  min_select: 0,
  max_select: 2,
  options: [
    { id: "boba", name: "Boba", price: 5000 },
    { id: "cincau", name: "Cincau", price: 4000 },
    { id: "keju", name: "Keju krim", price: 6000 },
  ],
};

const gula = {
  id: "g-gula",
  name: "Gula",
  min_select: 1,
  max_select: 1,
  options: [
    { id: "normal", name: "Normal", price: 0 },
    { id: "less", name: "Sedikit", price: 0 },
    { id: "none", name: "Tanpa gula", price: 0 },
  ],
};

function products(bump: number, soldOut: (id: string) => boolean): MenuProduct[] {
  const list: MenuProduct[] = [
    {
      id: "p-kopisusu",
      category_id: CAT.kopi,
      name: "Kopi Susu Senja",
      description: "Espresso, susu segar, dan gula aren. Andalan kami.",
      price: 18000 + bump,
      image_url: null,
      is_taxable: true,
      sold_out: false,
      variant_options: [
        { name: "Ukuran", values: ["Reguler", "Besar"] },
        { name: "Suhu", values: ["Panas", "Es"] },
      ],
      variants: [
        { id: "v-ks-rp", name: "Reguler · Panas", price: 18000 + bump, options: { Ukuran: "Reguler", Suhu: "Panas" }, image_url: null, sort_order: 0, sold_out: false },
        { id: "v-ks-re", name: "Reguler · Es", price: 20000 + bump, options: { Ukuran: "Reguler", Suhu: "Es" }, image_url: null, sort_order: 1, sold_out: false },
        { id: "v-ks-bp", name: "Besar · Panas", price: 23000 + bump, options: { Ukuran: "Besar", Suhu: "Panas" }, image_url: null, sort_order: 2, sold_out: true },
        { id: "v-ks-be", name: "Besar · Es", price: 25000 + bump, options: { Ukuran: "Besar", Suhu: "Es" }, image_url: null, sort_order: 3, sold_out: false },
      ],
      modifier_groups: [gula, topping],
    },
    {
      id: "p-americano",
      category_id: CAT.kopi,
      name: "Americano",
      description: "",
      price: 18000,
      image_url: null,
      is_taxable: true,
      sold_out: false,
      variant_options: [{ name: "Suhu", values: ["Panas", "Es"] }],
      variants: [
        { id: "v-am-p", name: "Panas", price: 18000, options: { Suhu: "Panas" }, image_url: null, sort_order: 0, sold_out: false },
        { id: "v-am-e", name: "Es", price: 20000, options: { Suhu: "Es" }, image_url: null, sort_order: 1, sold_out: false },
      ],
      modifier_groups: [gula],
    },
    {
      id: "p-matcha",
      category_id: CAT.nonKopi,
      name: "Matcha Latte",
      description: "Matcha Jepang dengan susu segar.",
      price: 28000,
      image_url: null,
      is_taxable: true,
      sold_out: false,
      variant_options: [],
      variants: [],
      modifier_groups: [topping],
    },
    {
      id: "p-tehtarik",
      category_id: CAT.nonKopi,
      name: "Teh Tarik",
      description: "",
      price: 15000,
      image_url: null,
      is_taxable: true,
      sold_out: true,
      variant_options: [],
      variants: [],
      modifier_groups: [],
    },
    {
      id: "p-air",
      category_id: CAT.nonKopi,
      name: "Air Mineral",
      description: "Botol 600 ml.",
      price: 6000,
      image_url: null,
      is_taxable: false,
      sold_out: false,
      variant_options: [],
      variants: [],
      modifier_groups: [],
    },
    {
      id: "p-rotibakar",
      category_id: CAT.makanan,
      name: "Roti Bakar Cokelat",
      description: "Roti tebal, mentega, cokelat leleh.",
      price: 22000,
      image_url: null,
      is_taxable: true,
      sold_out: false,
      variant_options: [],
      variants: [],
      modifier_groups: [
        { id: "g-tambah", name: "Tambahan", min_select: 0, max_select: 3, options: [
          { id: "keju", name: "Keju parut", price: 5000 },
          { id: "pisang", name: "Pisang", price: 4000 },
          { id: "susu", name: "Susu kental manis", price: 3000 },
        ] },
      ],
    },
    {
      id: "p-kentang",
      category_id: CAT.makanan,
      name: "Kentang Goreng",
      description: "Dengan saus sambal dan mayones.",
      price: 20000,
      image_url: null,
      is_taxable: true,
      sold_out: false,
      variant_options: [],
      variants: [],
      modifier_groups: [],
    },
  ];
  return list.map((p) => (soldOut(p.id) ? { ...p, sold_out: true } : p));
}

function buildMenu(code: string, state: MockState): Menu {
  const choose = code.startsWith("pilih");
  const off = code.startsWith("bawa");
  const bump = state.bumped.includes(code) ? 2000 : 0;
  return {
    outlet: { id: "o-1", name: "Kopi Senja", address: "Jl. Cikini Raya 12, Jakarta", image_url: null, business_name: "Kopi Senja" },
    table: choose || off ? null : TABLES[4],
    mode: {
      table_select: choose ? "choose" : off ? "off" : "per_table",
      order_types: ["dine_in", "takeaway"],
      payment: code.includes("online") ? "online" : "cashier",
      allow_additional_orders: true,
      require_customer_name: code.includes("nama"),
    },
    tables: choose ? TABLES : null,
    pricing: {
      taxes: [{ id: "tax-pb1", name: "PB1", rate_bp: 1000 }],
      service_fee: { enabled: true, type: "percent", rate_bp: 500, amount: 0, order_types: ["dine_in"], taxable: true },
    },
    categories: [
      { id: CAT.kopi, name: "Kopi", sort_order: 0 },
      { id: CAT.nonKopi, name: "Non-kopi", sort_order: 1 },
      { id: CAT.makanan, name: "Makanan", sort_order: 2 },
    ],
    products: products(bump, (id) => state.soldOut.includes(`${code}|${id}`)),
    menu_version: `mock-${bump}-${state.soldOut.length}`,
  };
}

function guard(code: string) {
  if (code === "salah") fail(404, "NOT_FOUND", "Data tidak ditemukan");
  if (code === "tutup") fail(403, "SELF_ORDER_CLOSED", "Pesan mandiri sedang tidak menerima pesanan");
  if (code === "limit") fail(429, "RATE_LIMITED", "Terlalu banyak permintaan", [], 20);
}

// ---------- Status menurut waktu ----------

const SEC = 1000;

function statusLabel(status: OrderStatus, hasTable: boolean): string {
  switch (status) {
    case "awaiting_payment": return "Menunggu pembayaran";
    case "pending": return "Menunggu dibayar di kasir";
    case "accepted": return "Pesanan diterima";
    case "preparing": return "Sedang disiapkan";
    case "ready": return hasTable ? "Siap diantar" : "Siap, silakan ambil";
    case "completed": return "Selesai";
    case "rejected": return "Pesanan ditolak";
    case "canceled": return "Dibatalkan";
    case "expired": return "Kedaluwarsa";
  }
}

function iso(ms: number | null): string | null {
  return ms === null ? null : new Date(ms).toISOString();
}

function evolve(m: MockOrder, now: number): MockOrder {
  const o = { ...m.order };
  let payment = m.payment ? { ...m.payment } : null;
  const final = (s: OrderStatus) => ["completed", "rejected", "canceled", "expired"].includes(s);

  if (m.canceledMs !== null) {
    o.status = "canceled";
  } else if (o.pay_mode === "online") {
    if (m.paidMs === null && payment && !m.code.includes("kedaluwarsa") && now >= m.createdMs + 20 * SEC && now < Date.parse(payment.expires_at)) {
      m = { ...m, paidMs: now };
    }
    if (m.paidMs !== null) {
      if (payment) payment = { ...payment, status: "paid", paid_at: iso(m.paidMs) };
      const t = now - m.paidMs;
      o.accepted_at = iso(m.paidMs);
      o.status = t < 10 * SEC ? "accepted" : t < 30 * SEC ? "preparing" : t < 180 * SEC ? "ready" : "completed";
    } else {
      const exp = payment ? Date.parse(payment.expires_at) : m.createdMs + 120 * SEC;
      if (payment && now >= exp) payment = { ...payment, status: "expired" };
      o.status = now >= exp + 60 * SEC ? "expired" : "awaiting_payment";
    }
  } else {
    const t = now - m.createdMs;
    if (m.code.includes("tolak") && t >= 10 * SEC) {
      o.status = "rejected";
      o.reject_reason = "Maaf, bahan untuk pesanan ini sedang habis.";
    } else if (m.code.includes("diam") || t < 8 * SEC) {
      o.status = o.expires_at && now >= Date.parse(o.expires_at) ? "expired" : "pending";
    } else {
      o.accepted_at = iso(m.createdMs + 8 * SEC);
      o.status = t < 16 * SEC ? "accepted" : t < 35 * SEC ? "preparing" : t < 180 * SEC ? "ready" : "completed";
    }
  }
  if (o.status === "ready" || o.status === "completed") o.ready_at ??= new Date(now).toISOString();
  if (o.status === "completed") o.completed_at ??= new Date(now).toISOString();
  o.status_label = statusLabel(o.status, !!o.table);
  if (final(o.status) && o.expires_at) o.expires_at = o.status === "expired" ? o.expires_at : null;
  return { ...m, order: o, payment };
}

function fakeQris(amount: number): string {
  const amt = String(amount);
  return `00020101021226670016ID.CO.SISSI.WWW011893600000000000000002150000000000000000303UMI51440014ID.CO.QRIS.WWW0215ID10000000000000303UMI5204581253033605404${amt.length.toString().padStart(2, "0")}${amt}5802ID5910KOPI SENJA6007JAKARTA6304ABCD`;
}

function newPayment(m: MockOrder, now: number): Payment {
  const ttl = m.code.includes("kedaluwarsa") ? 45 * SEC : 120 * SEC;
  return {
    id: uuid(),
    provider: "fake",
    status: "pending",
    amount: m.order.total,
    qr_string: fakeQris(m.order.total),
    checkout_url: null,
    expires_at: new Date(now + ttl).toISOString(),
    paid_at: null,
  };
}

function findOrder(state: MockState, id: string, key: string): MockOrder {
  const m = state.orders[id];
  if (!m || m.accessKey !== key) fail(404, "NOT_FOUND", "Data tidak ditemukan");
  return m;
}

function groupOf(state: MockState, groupId: string): MockOrder[] {
  return Object.values(state.orders)
    .filter((x) => x.order.group_id === groupId)
    .sort((a, b) => a.order.round - b.order.round);
}

function canAdd(rounds: MockOrder[]): boolean {
  return rounds.some((r) => ["accepted", "preparing", "ready", "pending"].includes(r.order.status));
}

function refresh(state: MockState, now: number): MockState {
  const orders: Record<string, MockOrder> = {};
  for (const [id, m] of Object.entries(state.orders)) orders[id] = evolve(m, now);
  return { ...state, orders };
}

// ---------- API tiruan ----------

export const mockApi: SelfOrderApi = {
  async getMenu(code) {
    await delay(350);
    guard(code);
    return buildMenu(code, load());
  },

  async createOrder(code, body: CreateOrderBody, idempotencyKey) {
    await delay(700);
    guard(code);
    let state = refresh(load(), Date.now());
    const idemKey = `${code}|${idempotencyKey}`;
    if (state.idem[idemKey]) return JSON.parse(state.idem[idemKey]) as CreateOrderResponse;

    if (code.includes("harga") && !state.bumped.includes(code)) {
      state = { ...state, bumped: [...state.bumped, code] };
      save(state);
    }
    if (code.includes("habis") && !state.soldOut.some((s) => s.startsWith(`${code}|`))) {
      const first = body.items[0];
      state = { ...state, soldOut: [...state.soldOut, `${code}|${first.product_id}`] };
      save(state);
      const name = buildMenu(code, state).products.find((p) => p.id === first.product_id)?.name ?? "Item";
      fail(409, "OUT_OF_STOCK", "Item habis", [{ field: "items[0]", message: `${name} habis` }]);
    }

    const menu = buildMenu(code, state);
    const details: { field: string; message: string }[] = [];
    if (menu.mode.require_customer_name && !body.customer_name.trim()) {
      details.push({ field: "customer_name", message: "Nama pemesan wajib diisi" });
    }
    if (menu.mode.table_select === "choose" && body.order_type === "dine_in" && !body.table_id && !body.group_key) {
      details.push({ field: "table_id", message: "Pilih meja" });
    }

    let group: MockOrder[] = [];
    if (body.group_key) {
      group = Object.values(state.orders).filter((x) => x.code === code && x.groupKey === body.group_key);
      group = group.length ? groupOf(state, group[0].order.group_id) : [];
      if (!group.length || !canAdd(group)) {
        details.push({ field: "group_key", message: "Pesanan sebelumnya sudah selesai" });
      }
    }
    if (details.length) fail(422, "VALIDATION_ERROR", "Data tidak valid", details);

    const items = body.items.map((it) => {
      const p = menu.products.find((x) => x.id === it.product_id);
      const v = p?.variants.find((x) => x.id === it.variant_id) ?? null;
      if (!p || p.sold_out || v?.sold_out) fail(409, "OUT_OF_STOCK", "Item habis", [{ field: "items[0]", message: `${p?.name ?? "Item"} habis` }]);
      const mods = it.modifiers.map((m) => p.modifier_groups.find((g) => g.id === m.group_id)?.options.find((o) => o.id === m.option_id)).filter((x) => !!x);
      return {
        name: p.name,
        variant_name: v?.name ?? null,
        quantity: it.quantity,
        unit_price: v?.price ?? p.price,
        modifiers: mods.map((m) => ({ name: m.name, price: m.price })),
        note: it.note,
        is_taxable: p.is_taxable,
      };
    });

    const first = group[0]?.order;
    const orderType = first?.order_type ?? body.order_type;
    const b = computeBreakdown(
      items.map((i) => ({ unitPrice: i.unit_price, modifiersTotal: i.modifiers.reduce((s, m) => s + m.price, 0), quantity: i.quantity, isTaxable: i.is_taxable })),
      menu.pricing,
      orderType
    );
    if (b.total !== body.expected_total) {
      fail(409, "PRICE_CHANGED", "Total berubah", [{ field: "expected_total", message: `Total terbaru Rp ${b.total.toLocaleString("id-ID")}` }]);
    }

    const now = Date.now();
    const online = menu.mode.payment === "online";
    const table =
      first?.table ??
      (menu.mode.table_select === "per_table" ? menu.table : menu.mode.table_select === "choose" && orderType === "dine_in" ? TABLES.find((t) => t.id === body.table_id) ?? null : null);
    const counter = first ? state.counter : state.counter + 1;
    const order: PublicOrder = {
      id: uuid(),
      order_no: first?.order_no ?? `A${counter}`,
      round: first ? group.length + 1 : 1,
      group_id: first?.group_id ?? uuid(),
      status: online ? "awaiting_payment" : "pending",
      status_label: "",
      pay_mode: online ? "online" : "cashier",
      order_type: orderType,
      table,
      customer_name: body.customer_name.trim(),
      note: body.note.trim(),
      items: items.map((i) => ({ name: i.name, variant_name: i.variant_name, quantity: i.quantity, unit_price: i.unit_price, modifiers: i.modifiers, note: i.note })),
      subtotal: b.subtotal,
      service_fee: b.serviceFee,
      taxes: b.taxes.map((t) => ({ name: t.name, rate_bp: t.rateBp, amount: t.amount })),
      tax_total: b.taxTotal,
      total: b.total,
      reject_reason: "",
      expires_at: new Date(now + 15 * 60 * SEC).toISOString(),
      created_at: new Date(now).toISOString(),
      accepted_at: null,
      ready_at: null,
      completed_at: null,
    };
    let mo: MockOrder = {
      order,
      code,
      accessKey: randomKey(),
      groupKey: group[0]?.groupKey ?? randomKey(),
      createdMs: now,
      paidMs: null,
      canceledMs: null,
      payment: null,
    };
    if (online) {
      mo.payment = newPayment(mo, now);
      mo.order.expires_at = mo.payment.expires_at;
    }
    mo = evolve(mo, now);
    const res: CreateOrderResponse = { order: mo.order, access_key: mo.accessKey, group_key: mo.groupKey, payment: mo.payment };
    save({ ...state, counter, orders: { ...state.orders, [order.id]: mo }, idem: { ...state.idem, [idemKey]: JSON.stringify(res) } });
    return res;
  },

  async getOrder(id, key) {
    await delay(250);
    const state = refresh(load(), Date.now());
    save(state);
    const m = findOrder(state, id, key);
    const rounds = groupOf(state, m.order.group_id);
    const final = ["completed", "rejected", "canceled", "expired"].includes(m.order.status);
    const res: OrderStatusResponse = {
      order: m.order,
      payment: m.payment,
      group: {
        id: m.order.group_id,
        can_add: canAdd(rounds),
        rounds: rounds.map((r) => ({ id: r.order.id, round: r.order.round, status: r.order.status, status_label: r.order.status_label, total: r.order.total })),
      },
      poll_after_s: final ? null : 5,
    };
    return res;
  },

  async createPayment(id, key) {
    await delay(500);
    const now = Date.now();
    const state = refresh(load(), now);
    let m = findOrder(state, id, key);
    if (m.order.status !== "awaiting_payment") fail(409, "ORDER_NOT_PAYABLE", "Pesanan tidak sedang menunggu pembayaran");
    if (!m.payment || m.payment.status !== "pending") {
      const payment = newPayment(m, now);
      m = { ...m, payment, order: { ...m.order, expires_at: payment.expires_at } };
      save({ ...state, orders: { ...state.orders, [id]: m } });
    }
    return { order: m.order, payment: m.payment as Payment };
  },

  async cancelOrder(id, key) {
    await delay(400);
    const now = Date.now();
    const state = refresh(load(), now);
    const m = findOrder(state, id, key);
    if (m.order.status !== "awaiting_payment" && m.order.status !== "pending") {
      fail(409, "ORDER_NOT_CANCELABLE", "Pesanan sudah diproses");
    }
    const next = evolve({ ...m, canceledMs: now, payment: m.payment ? { ...m.payment, status: "canceled" } : null }, now);
    save({ ...state, orders: { ...state.orders, [id]: next } });
    return { order: next.order };
  },
};
