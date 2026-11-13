// Mode tiruan web pelayan (NEXT_PUBLIC_STAFF_MOCK=1): denah & open bill disimpan di localStorage, harga dihitung
// dengan perkiraan yang sama dengan halaman pesan (tanpa diskon/pembulatan). Hanya untuk melihat tampilan.
import { resolveLine, type CartLine } from "@/lib/selfOrder/cart";
import { sampleWaiterMenu } from "@/lib/selfOrder/mock";
import { computeBreakdown } from "@/lib/selfOrder/pricing";
import { staffError } from "./api";
import type { WaiterFloor, WaiterItemInput, WaiterOrder } from "./types";

const KEY = "sissi-staff-waiter-mock:v1";
const TABLES = [
  { id: "t-1", name: "Meja 1", area_id: "a-1" },
  { id: "t-2", name: "Meja 2", area_id: "a-1" },
  { id: "t-3", name: "Meja 3", area_id: "a-1" },
  { id: "t-4", name: "Meja 4", area_id: "a-2" },
  { id: "t-5", name: "Meja 5", area_id: "a-2" },
  { id: "t-6", name: "Meja 6", area_id: "a-2" },
];

type State = { orders: WaiterOrder[]; seq: number };

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // abaikan
  }
  return { orders: [], seq: 0 };
}

function save(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // abaikan
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function priced(order: WaiterOrder, items: WaiterItemInput[], who: string): WaiterOrder {
  const menu = sampleWaiterMenu();
  const now = new Date().toISOString();
  const added = items.map((i, n) => {
    const line: CartLine = {
      key: `${Date.now()}-${n}`,
      productId: i.product_id,
      variantId: i.variant_id,
      quantity: i.quantity,
      note: i.note,
      modifiers: i.modifiers.map((m) => ({ groupId: m.group_id, optionId: m.option_id })),
      name: "",
      variantName: null,
    };
    const r = resolveLine(line, menu);
    if (r.issue) throw staffError("Ada item yang habis atau tidak lagi tersedia", 409, "OUT_OF_STOCK");
    return {
      line_id: `w:${crypto.randomUUID()}`,
      product_id: i.product_id,
      name: r.name,
      variant_name: r.variantName,
      quantity: i.quantity,
      unit_price: r.unitPrice,
      modifiers: r.modifierNames.map((name, k) => ({ name, price: k === 0 ? r.modifiersTotal : 0 })),
      note: i.note,
      discount: 0,
      _mods: r.modifiersTotal,
      _taxable: r.isTaxable,
    };
  });
  const all = [
    ...order.items.map((i) => ({ ...i, _mods: i.modifiers.reduce((s, m) => s + m.price, 0), _taxable: true })),
    ...added,
  ];
  const b = computeBreakdown(
    all.map((i) => ({ unitPrice: i.unit_price, modifiersTotal: i._mods, quantity: i.quantity, isTaxable: i._taxable })),
    menu.pricing,
    "dine_in"
  );
  const round = order.rounds.length + 1;
  return {
    ...order,
    items: all.map((i) => ({
      line_id: i.line_id,
      product_id: i.product_id,
      name: i.name,
      variant_name: i.variant_name,
      quantity: i.quantity,
      unit_price: i.unit_price,
      modifiers: i.modifiers,
      note: i.note,
      discount: 0,
    })),
    subtotal: b.subtotal,
    service_fee: b.serviceFee,
    tax_total: b.taxTotal,
    total: b.total,
    rounds: [
      ...order.rounds,
      {
        id: crypto.randomUUID(),
        round,
        ordered_at: now,
        created_by_name: who,
        items: added.map((i) => ({
          name: i.name,
          variant_name: i.variant_name,
          modifiers: i.modifiers.map((m) => m.name),
          note: i.note,
          quantity: i.quantity,
          status: "waiting",
        })),
      },
    ],
    updated_at: now,
  };
}

export function waiterMockApi(who: () => string) {
  return {
    async waiterMenu() {
      await wait(250);
      return sampleWaiterMenu();
    },
    async waiterFloor(outletId: string): Promise<WaiterFloor> {
      await wait(250);
      const s = load();
      return {
        server_time: new Date().toISOString(),
        outlet: { id: outletId, name: "Kopi Senja Kemang" },
        kitchen: true,
        areas: [
          { id: "a-1", name: "Dalam" },
          { id: "a-2", name: "Teras" },
        ],
        tables: TABLES.map((t) => ({
          ...t,
          orders: s.orders
            .filter((o) => o.table_id === t.id && o.status === "open")
            .map((o) => ({
              id: o.id,
              receipt_no: o.receipt_no,
              total: o.total,
              item_count: o.items.reduce((n, i) => n + i.quantity, 0),
              customer_name: o.customer_name,
              created_at: o.created_at,
              updated_at: o.updated_at,
              bill_requested: o.bill_requested,
            })),
        })),
      };
    },
    async waiterOrder(saleId: string): Promise<WaiterOrder> {
      await wait(200);
      const o = load().orders.find((x) => x.id === saleId);
      if (!o) throw staffError("Pesanan tidak ditemukan", 404, "NOT_FOUND");
      return o;
    },
    async waiterCreate(body: { outlet_id: string; table_id: string; items: WaiterItemInput[] }): Promise<WaiterOrder> {
      await wait(400);
      const s = load();
      const busy = s.orders.find((o) => o.table_id === body.table_id && o.status === "open");
      if (busy)
        throw staffError("Meja ini sudah punya pesanan berjalan", 409, "TABLE_OCCUPIED", [{ field: "sale_id", message: busy.id }]);
      const t = TABLES.find((x) => x.id === body.table_id);
      const now = new Date().toISOString();
      s.seq += 1;
      const empty: WaiterOrder = {
        id: crypto.randomUUID(),
        outlet_id: body.outlet_id,
        table_id: body.table_id,
        table_name: t?.name ?? null,
        receipt_no: `INV-261113-W1A2-${String(s.seq).padStart(3, "0")}`,
        status: "open",
        customer_name: "",
        notes: "",
        items: [],
        subtotal: 0,
        discount_total: 0,
        service_fee: 0,
        tax_total: 0,
        rounding: 0,
        total: 0,
        rounds: [],
        bill_requested: false,
        bill_requested_at: null,
        bill_printed_at: null,
        created_at: now,
        updated_at: now,
      };
      const o = priced(empty, body.items, who());
      s.orders.push(o);
      save(s);
      return o;
    },
    async waiterAddItems(saleId: string, items: WaiterItemInput[]): Promise<WaiterOrder> {
      await wait(400);
      const s = load();
      const i = s.orders.findIndex((x) => x.id === saleId);
      if (i < 0) throw staffError("Pesanan tidak ditemukan", 404, "NOT_FOUND");
      if (s.orders[i].status !== "open")
        throw staffError("Pesanan sudah ditagih kasir; tambah pesanan lewat kasir", 409, "ORDER_CLOSED");
      s.orders[i] = priced(s.orders[i], items, who());
      save(s);
      return s.orders[i];
    },
    async waiterBillRequest(saleId: string): Promise<WaiterOrder> {
      await wait(300);
      const s = load();
      const i = s.orders.findIndex((x) => x.id === saleId);
      if (i < 0) throw staffError("Pesanan tidak ditemukan", 404, "NOT_FOUND");
      const now = new Date().toISOString();
      s.orders[i] = { ...s.orders[i], bill_requested: true, bill_requested_at: now, updated_at: now };
      save(s);
      return s.orders[i];
    },
  };
}
