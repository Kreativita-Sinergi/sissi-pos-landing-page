// Perkiraan total pesanan — cermin `internal/pricing` (sissi-service) tanpa diskon & pembulatan:
// (harga + modifier) × qty → subtotal (= dasar pajak) → biaya layanan bila jenis pesanan cocok →
// pajak eksklusif atas dasar kena pajak (+ biaya layanan bila `taxable`) → total.
// Persen dibulatkan half-up `(nilai × bp + 5000) div 10000`, sekali per komponen.
import type { MenuPricing, OrderType } from "./types";

export type PricedLine = { unitPrice: number; modifiersTotal: number; quantity: number; isTaxable: boolean };

export type Breakdown = {
  subtotal: number;
  serviceFee: number;
  taxes: { id: string; name: string; rateBp: number; amount: number }[];
  taxTotal: number;
  total: number;
};

export function percent(value: number, bp: number): number {
  if (value <= 0 || bp <= 0) return 0;
  return Math.floor((value * bp + 5000) / 10000);
}

function appliesTo(orderTypes: string[] | null | undefined, orderType: OrderType): boolean {
  return !orderTypes || orderTypes.length === 0 || orderTypes.includes(orderType);
}

export function computeBreakdown(lines: PricedLine[], pricing: MenuPricing, orderType: OrderType): Breakdown {
  let subtotal = 0;
  let taxableBase = 0;
  for (const l of lines) {
    const net = Math.max(l.unitPrice + l.modifiersTotal, 0) * Math.max(l.quantity, 0);
    subtotal += net;
    if (l.isTaxable) taxableBase += net;
  }

  const fee = pricing.service_fee;
  let serviceFee = 0;
  if (fee?.enabled && subtotal > 0 && appliesTo(fee.order_types, orderType)) {
    serviceFee = fee.type === "fixed" ? Math.max(fee.amount, 0) : percent(subtotal, fee.rate_bp);
  }

  const taxable = taxableBase + (fee?.taxable ? serviceFee : 0);
  const taxes = (pricing.taxes ?? [])
    .filter((t) => t.rate_bp > 0)
    .map((t) => ({ id: t.id, name: t.name, rateBp: t.rate_bp, amount: percent(taxable, t.rate_bp) }));
  const taxTotal = taxes.reduce((s, t) => s + t.amount, 0);

  return { subtotal, serviceFee, taxes, taxTotal, total: subtotal + serviceFee + taxTotal };
}

const rupiah = new Intl.NumberFormat("id-ID");

export function formatRupiah(value: number): string {
  return `Rp ${rupiah.format(value)}`;
}

/** 1000 → "10%", 1150 → "11,5%". */
export function formatRate(bp: number): string {
  return `${(bp / 100).toLocaleString("id-ID", { maximumFractionDigits: 2 })}%`;
}
