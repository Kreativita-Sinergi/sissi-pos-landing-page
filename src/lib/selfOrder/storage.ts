// Penyimpanan lokal per kode QR. localStorage bisa tidak tersedia (mode privat, diblokir),
// jadi setiap akses dibungkus try/catch dan halaman tetap berfungsi tanpanya.
import type { CartLine } from "./cart";

const PREFIX = "sissi-pesan:v1:";
const ORDER_TTL_MS = 24 * 60 * 60 * 1000;

/** Jam dinding saat ini (dipakai dari event handler). */
export const nowMs = (): number => Date.now();

export type StoredOrder = {
  id: string;
  access_key: string;
  group_key: string;
  order_no: string;
  saved_at: number;
};

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    if (value === null) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Diabaikan: penyimpanan penuh/diblokir.
  }
}

function isCartLine(v: unknown): v is CartLine {
  const l = v as CartLine;
  return (
    !!l &&
    typeof l.key === "string" &&
    typeof l.productId === "string" &&
    typeof l.quantity === "number" &&
    Array.isArray(l.modifiers)
  );
}

export function loadCart(code: string): CartLine[] {
  const raw = read<unknown>(`${code}:cart`);
  return Array.isArray(raw) ? raw.filter(isCartLine) : [];
}

export function saveCart(code: string, lines: CartLine[]): void {
  write(`${code}:cart`, lines.length ? lines : null);
}

export function loadOrders(code: string): StoredOrder[] {
  const raw = read<unknown>(`${code}:orders`);
  if (!Array.isArray(raw)) return [];
  const now = Date.now();
  return raw.filter(
    (o): o is StoredOrder =>
      !!o &&
      typeof o.id === "string" &&
      typeof o.access_key === "string" &&
      typeof o.group_key === "string" &&
      typeof o.saved_at === "number" &&
      now - o.saved_at < ORDER_TTL_MS
  );
}

export function saveOrders(code: string, orders: StoredOrder[]): void {
  write(`${code}:orders`, orders.length ? orders.slice(-20) : null);
}
