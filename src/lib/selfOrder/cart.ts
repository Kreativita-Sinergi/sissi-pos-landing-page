// Keranjang pelanggan: hanya menyimpan ID + jumlah + catatan; harga selalu dibaca ulang dari menu terbaru.
import type { CreateOrderItem, Menu, MenuProduct, MenuVariant } from "./types";
import type { PricedLine } from "./pricing";

export const MAX_LINES = 30;
export const MAX_QTY = 50;
export const NOTE_MAX = 200;
export const NAME_MAX = 40;

export type CartModifier = { groupId: string; optionId: string };

export type CartLine = {
  key: string;
  productId: string;
  variantId: string | null;
  quantity: number;
  note: string;
  modifiers: CartModifier[];
  // Cuplikan untuk ditampilkan bila produk hilang dari menu.
  name: string;
  variantName: string | null;
};

export type LineIssue = "missing" | "sold_out" | null;

export type ResolvedLine = CartLine &
  PricedLine & {
    modifierNames: string[];
    issue: LineIssue;
  };

export function lineKey(productId: string, variantId: string | null, modifiers: CartModifier[], note: string): string {
  const mods = modifiers
    .map((m) => `${m.groupId}:${m.optionId}`)
    .sort()
    .join(",");
  return [productId, variantId ?? "-", mods, note.trim()].join("|");
}

export function availableVariants(product: MenuProduct): MenuVariant[] {
  return [...product.variants].sort((a, b) => a.sort_order - b.sort_order);
}

/** Produk habis: ditandai habis, atau semua variannya habis. */
export function isProductSoldOut(product: MenuProduct): boolean {
  if (product.sold_out) return true;
  return product.variants.length > 0 && product.variants.every((v) => v.sold_out);
}

/** Harga tampil di kartu: harga produk, atau harga varian termurah yang tersedia. */
export function displayPrice(product: MenuProduct): { price: number; from: boolean } {
  if (product.variants.length === 0) return { price: product.price, from: false };
  const pool = product.variants.filter((v) => !v.sold_out);
  const prices = (pool.length ? pool : product.variants).map((v) => v.price);
  const min = Math.min(...prices);
  return { price: min, from: prices.some((p) => p !== min) };
}

export function resolveLine(line: CartLine, menu: Menu): ResolvedLine {
  const product = menu.products.find((p) => p.id === line.productId);
  const base: ResolvedLine = {
    ...line,
    unitPrice: 0,
    modifiersTotal: 0,
    quantity: line.quantity,
    isTaxable: true,
    modifierNames: [],
    issue: "missing",
  };
  if (!product) return base;

  let unitPrice = product.price;
  let variantName: string | null = null;
  let issue: LineIssue = product.sold_out ? "sold_out" : null;
  if (product.variants.length > 0) {
    const variant = product.variants.find((v) => v.id === line.variantId);
    if (!variant) return { ...base, name: product.name };
    unitPrice = variant.price;
    variantName = variant.name;
    if (variant.sold_out) issue = "sold_out";
  } else if (line.variantId) {
    return { ...base, name: product.name };
  }

  let modifiersTotal = 0;
  const modifierNames: string[] = [];
  for (const m of line.modifiers) {
    const group = product.modifier_groups.find((g) => g.id === m.groupId);
    const option = group?.options.find((o) => o.id === m.optionId);
    if (!option) return { ...base, name: product.name, variantName };
    modifiersTotal += option.price;
    modifierNames.push(option.name);
  }

  return {
    ...line,
    name: product.name,
    variantName,
    unitPrice,
    modifiersTotal,
    isTaxable: product.is_taxable,
    modifierNames,
    issue,
  };
}

export function toOrderItems(lines: CartLine[]): CreateOrderItem[] {
  return lines.map((l) => ({
    product_id: l.productId,
    variant_id: l.variantId,
    quantity: l.quantity,
    note: l.note.trim(),
    modifiers: l.modifiers.map((m) => ({ group_id: m.groupId, option_id: m.optionId })),
  }));
}

/** Tambah baris; baris identik (produk, varian, modifier, catatan sama) digabung. */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((l) => l.key === line.key);
  if (existing) {
    return lines.map((l) =>
      l.key === line.key ? { ...l, quantity: Math.min(MAX_QTY, l.quantity + line.quantity) } : l
    );
  }
  if (lines.length >= MAX_LINES) return lines;
  return [...lines, line];
}

export function setQuantity(lines: CartLine[], key: string, quantity: number): CartLine[] {
  if (quantity <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l));
}

export function countItems(lines: CartLine[]): number {
  return lines.reduce((s, l) => s + l.quantity, 0);
}
