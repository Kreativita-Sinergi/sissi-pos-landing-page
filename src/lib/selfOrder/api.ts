// Endpoint publik Pesan & Bayar Mandiri (QR) — tanpa login. Mode mock (NEXT_PUBLIC_SELF_ORDER_MOCK=1)
// memuat data contoh secara dinamis sehingga tidak ikut terunduh saat mock mati.
import { getJson, postJson } from "@/lib/sissiApi";
import type {
  CancelResponse,
  CreateOrderBody,
  CreateOrderResponse,
  Menu,
  OrderStatusResponse,
  PaymentResponse,
} from "./types";

export interface SelfOrderApi {
  getMenu(code: string, signal?: AbortSignal): Promise<Menu>;
  createOrder(code: string, body: CreateOrderBody, idempotencyKey: string): Promise<CreateOrderResponse>;
  getOrder(id: string, accessKey: string, signal?: AbortSignal): Promise<OrderStatusResponse>;
  createPayment(id: string, accessKey: string, idempotencyKey: string): Promise<PaymentResponse>;
  cancelOrder(id: string, accessKey: string, idempotencyKey: string): Promise<CancelResponse>;
}

export const SELF_ORDER_MOCK = process.env.NEXT_PUBLIC_SELF_ORDER_MOCK === "1";

const enc = encodeURIComponent;

const httpApi: SelfOrderApi = {
  getMenu: (code, signal) => getJson<Menu>(`/public/pesan/${enc(code)}`, { signal }),
  createOrder: (code, body, idempotencyKey) =>
    postJson<CreateOrderResponse>(`/public/pesan/${enc(code)}/orders`, body, {
      headers: { "Idempotency-Key": idempotencyKey },
      timeoutMs: 20_000,
    }),
  getOrder: (id, accessKey, signal) =>
    getJson<OrderStatusResponse>(`/public/orders/${enc(id)}`, {
      headers: { "X-Order-Key": accessKey },
      signal,
    }),
  createPayment: (id, accessKey, idempotencyKey) =>
    postJson<PaymentResponse>(
      `/public/orders/${enc(id)}/payment`,
      {},
      { headers: { "X-Order-Key": accessKey, "Idempotency-Key": idempotencyKey }, timeoutMs: 20_000 }
    ),
  cancelOrder: (id, accessKey, idempotencyKey) =>
    postJson<CancelResponse>(
      `/public/orders/${enc(id)}/cancel`,
      {},
      { headers: { "X-Order-Key": accessKey, "Idempotency-Key": idempotencyKey } }
    ),
};

let mockApi: Promise<SelfOrderApi> | null = null;

export function selfOrderApi(): Promise<SelfOrderApi> {
  if (!SELF_ORDER_MOCK) return Promise.resolve(httpApi);
  mockApi ??= import("./mock").then((m) => m.mockApi);
  return mockApi;
}

export function newUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
