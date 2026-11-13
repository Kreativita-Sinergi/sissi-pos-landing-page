// Klien web karyawan (absen). Kontrak: sissi-pos-service/docs/api.md "Absen karyawan lewat web (2026-11-02)".
// Dipanggil langsung dari browser: cookie sesi `__Host-sissi_staff` milik domain API ikut lewat `credentials: 'include'`,
// header `X-Sissi-Staff: 1` wajib (CSRF). Origin situs ini harus ada di STAFF_WEB_ORIGINS (atau OWNER_WEB_ORIGINS →
// ADMIN_ORIGINS) sissi-pos-service. Terpisah total dari sesi pemilik (`src/lib/owner/api.ts`): cookie, prefiks,
// header, penangan 401, dan device_id sendiri.
// Mode tiruan (NEXT_PUBLIC_STAFF_MOCK=1) memuat data contoh secara dinamis — tidak ikut terunduh saat mati.
import { API_BASE_URL, ApiError, type ApiFieldError } from "@/lib/sissiApi";
import type {
  ClockInput,
  StaffAcceptInput,
  StaffAttendance,
  StaffHistory,
  StaffLoginInput,
  StaffSession,
  StaffToday,
  WaiterCreateInput,
  WaiterCustomer,
  WaiterFloor,
  WaiterItemInput,
  WaiterOrder,
} from "./types";
import type { Menu } from "@/lib/selfOrder/types";

export const STAFF_MOCK = process.env.NEXT_PUBLIC_STAFF_MOCK === "1";

export interface StaffApi {
  login(body: StaffLoginInput): Promise<StaffSession>;
  /** Aktivasi undangan/reset lewat website: buat kata sandi + sesi web (HP tidak diikat). */
  accept(code: string, body: StaffAcceptInput): Promise<StaffSession>;
  logout(): Promise<void>;
  me(signal?: AbortSignal): Promise<StaffSession>;
  today(q: { outlet_id?: string }, signal?: AbortSignal): Promise<StaffToday>;
  /** `idempotencyKey` = UUID per percobaan; dipakai ulang saat mengulang karena galat jaringan. */
  clock(body: ClockInput, idempotencyKey: string): Promise<StaffAttendance>;
  history(q: { month?: string }, signal?: AbortSignal): Promise<StaffHistory>;
  // Pelayan lewat web (api.md "Pelayan lewat web"). Rute tulis memakai Idempotency-Key per percobaan.
  waiterMenu(outletId: string, signal?: AbortSignal): Promise<Menu>;
  waiterFloor(outletId: string, signal?: AbortSignal): Promise<WaiterFloor>;
  waiterOrder(saleId: string, signal?: AbortSignal): Promise<WaiterOrder>;
  /** Cari pelanggan (≥ 2 karakter; ≤ 20 hasil, no. HP tersamar). */
  waiterCustomers(q: string, signal?: AbortSignal): Promise<WaiterCustomer[]>;
  waiterCreate(body: WaiterCreateInput, idempotencyKey: string): Promise<WaiterOrder>;
  waiterAddItems(saleId: string, items: WaiterItemInput[], idempotencyKey: string): Promise<WaiterOrder>;
  waiterBillRequest(saleId: string, idempotencyKey: string): Promise<WaiterOrder>;
}

/** Galat web karyawan. `details` selalu `[{ field, message }]` (mis. OUTSIDE_AREA `[{ field: "distance_m", message: "340" }]`). */
export class StaffApiError extends ApiError {}

const STAFF_BASE = `${API_BASE_URL}/staff`;
const TIMEOUT_MS = 20_000;

type BaseResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code?: string; details?: ApiFieldError[] };
};

let unauthorizedHandler: (() => void) | null = null;
/** Sesi habis di tengah jalan → halaman karyawan mengarahkan ke /karyawan/masuk (dipasang StaffShell). */
export function setStaffUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}
export function notifyStaffUnauthorized() {
  unauthorizedHandler?.();
}

function retryAfterOf(value: string | null): number | null {
  if (!value) return null;
  const s = Number(value);
  if (Number.isFinite(s) && s > 0) return Math.ceil(s);
  const d = Date.parse(value);
  if (Number.isNaN(d)) return null;
  const diff = Math.ceil((d - Date.now()) / 1000);
  return diff > 0 ? diff : null;
}

function fallbackCode(status: number): string {
  if (status === 401) return "UNAUTHORIZED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return "BAD_RESPONSE";
}

/** Bangun galat dari bentuk respons (dipakai juga oleh mode tiruan agar perilakunya sama). */
export function staffError(
  message: string,
  status: number,
  code: string,
  details?: ApiFieldError[] | null,
  retryAfter: number | null = null
): StaffApiError {
  return new StaffApiError(message, status, code, Array.isArray(details) ? details : [], retryAfter);
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  opts: { body?: unknown; signal?: AbortSignal; skipAuthRedirect?: boolean; idempotencyKey?: string } = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", "X-Sissi-Staff": "1" };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  if (method === "POST") headers["Content-Type"] = "application/json";
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = opts.signal && typeof AbortSignal.any === "function" ? AbortSignal.any([timeout, opts.signal]) : timeout;

  let res: Response;
  try {
    res = await fetch(`${STAFF_BASE}${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw staffError("Permintaan dibatalkan.", 0, "ABORTED");
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    throw staffError(
      isTimeout ? "Server tidak merespons. Coba lagi sebentar lagi." : "Tidak dapat terhubung ke server.",
      0,
      isTimeout ? "TIMEOUT" : "NETWORK_ERROR"
    );
  }

  let json: BaseResponse<T> | null = null;
  try {
    json = (await res.json()) as BaseResponse<T>;
  } catch {
    // Bukan JSON (mis. halaman galat proxy).
  }
  if (res.ok && json?.success) return json.data as T;

  const error = staffError(
    json?.message || "Terjadi kesalahan. Coba lagi sebentar lagi.",
    res.status,
    json?.error?.code || fallbackCode(res.status),
    json?.error?.details ?? null,
    retryAfterOf(res.headers.get("Retry-After"))
  );
  if (res.status === 401 && !opts.skipAuthRedirect) unauthorizedHandler?.();
  throw error;
}

const enc = encodeURIComponent;

function qs(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const httpApi: StaffApi = {
  login: (body) => call<StaffSession>("POST", "/auth/login", { body, skipAuthRedirect: true }),
  accept: (code, body) => call<StaffSession>("POST", `/auth/accept/${enc(code)}`, { body, skipAuthRedirect: true }),
  logout: async () => {
    await call<null>("POST", "/auth/logout", { body: {}, skipAuthRedirect: true });
  },
  me: (signal) => call<StaffSession>("GET", "/auth/me", { signal, skipAuthRedirect: true }),
  today: (q, signal) => call<StaffToday>("GET", `/today${qs(q)}`, { signal }),
  clock: (body, idempotencyKey) => call<StaffAttendance>("POST", "/attendance/clock", { body, idempotencyKey }),
  history: (q, signal) => call<StaffHistory>("GET", `/attendance${qs(q)}`, { signal }),
  waiterMenu: (outletId, signal) => call<Menu>("GET", `/waiter/menu${qs({ outlet_id: outletId })}`, { signal }),
  waiterFloor: (outletId, signal) => call<WaiterFloor>("GET", `/waiter/floor${qs({ outlet_id: outletId })}`, { signal }),
  waiterOrder: async (saleId, signal) =>
    (await call<{ order: WaiterOrder }>("GET", `/waiter/orders/${enc(saleId)}`, { signal })).order,
  waiterCustomers: async (q, signal) =>
    (await call<{ items: WaiterCustomer[] }>("GET", `/waiter/customers${qs({ q })}`, { signal })).items,
  waiterCreate: async (body, idempotencyKey) =>
    (await call<{ order: WaiterOrder }>("POST", "/waiter/orders", { body, idempotencyKey })).order,
  waiterAddItems: async (saleId, items, idempotencyKey) =>
    (await call<{ order: WaiterOrder }>("POST", `/waiter/orders/${enc(saleId)}/items`, { body: { items }, idempotencyKey }))
      .order,
  waiterBillRequest: async (saleId, idempotencyKey) =>
    (await call<{ order: WaiterOrder }>("POST", `/waiter/orders/${enc(saleId)}/bill-request`, { body: {}, idempotencyKey }))
      .order,
};

let mockApi: Promise<StaffApi> | null = null;

export function staffApi(): Promise<StaffApi> {
  if (!STAFF_MOCK) return Promise.resolve(httpApi);
  mockApi ??= import("./mock").then((m) => m.createStaffMockApi(() => unauthorizedHandler?.()));
  return mockApi;
}

/** UUID untuk Idempotency-Key. */
export function newKey(): string {
  return crypto.randomUUID();
}

// ——— device_id (hanya untuk peringatan "login dari perangkat baru"; tidak mengikat apa pun) ———

const DEVICE_KEY = "sissi-staff:device-id";

export function staffDeviceId(): string | undefined {
  const fresh = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : undefined);
  try {
    const saved = localStorage.getItem(DEVICE_KEY);
    if (saved && /^[0-9a-f-]{36}$/i.test(saved)) return saved;
    const id = fresh();
    if (id) localStorage.setItem(DEVICE_KEY, id);
    return id;
  } catch {
    return fresh();
  }
}
