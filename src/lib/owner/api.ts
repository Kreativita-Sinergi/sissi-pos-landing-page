// Klien Dasbor pemilik (kontrak: sissi-service/docs/api.md "Dasbor pemilik (web)").
// Dipanggil langsung dari browser ke API: cookie sesi `__Host-sissi_owner` milik domain API ikut lewat
// `credentials: 'include'`, header `X-Sissi-Owner: 1` wajib (CSRF). Origin situs ini harus ada di
// OWNER_WEB_ORIGINS (atau ADMIN_ORIGINS) sissi-service.
// Mode tiruan (NEXT_PUBLIC_OWNER_MOCK=1) memuat data contoh secara dinamis — tidak ikut terunduh saat mati.
import { API_BASE_URL, ApiError, type ApiFieldError } from "@/lib/sissiApi";
import type {
  ActivityItem,
  ActivityPage,
  ActivityQuery,
  GoogleLoginInput,
  LoginInput,
  OutletsReport,
  OwnerSession,
  PageMeta,
  RangeQuery,
  SaleDetail,
  SaleListItem,
  SalesPage,
  SalesQuery,
  SalesReport,
  ShiftDetail,
  ShiftListItem,
  ShiftsPage,
  ShiftsQuery,
  StaffMember,
  Summary,
  Change,
  ChangeResult,
  DataEntity,
  EmployeeInvite,
  PullPage,
  StockRow,
  SubscriptionDetail,
  SyncRecord,
} from "./types";

export const OWNER_MOCK = process.env.NEXT_PUBLIC_OWNER_MOCK === "1";

export interface OwnerApi {
  login(body: LoginInput): Promise<OwnerSession>;
  google(body: GoogleLoginInput): Promise<OwnerSession>;
  logout(): Promise<void>;
  me(signal?: AbortSignal): Promise<OwnerSession>;
  /**
   * Konfirmasi ulang identitas (password atau ID token Google akun yang sama) sebelum aksi sensitif — mis. mengubah
   * QRIS/rekening outlet. Berlaku ±10 menit (`confirmed_until`). Salah → 401 `INVALID_CREDENTIALS` (tanpa keluar sesi).
   */
  confirm(body: { password: string } | { id_token: string }): Promise<{ confirmed_until: string }>;
  summary(q: { outlet_id?: string }, signal?: AbortSignal): Promise<Summary>;
  salesReport(q: RangeQuery, signal?: AbortSignal): Promise<SalesReport>;
  outletsReport(q: { from?: string; to?: string }, signal?: AbortSignal): Promise<OutletsReport>;
  sales(q: SalesQuery, signal?: AbortSignal): Promise<SalesPage>;
  sale(id: string, signal?: AbortSignal): Promise<SaleDetail>;
  shifts(q: ShiftsQuery, signal?: AbortSignal): Promise<ShiftsPage>;
  shift(id: string, signal?: AbortSignal): Promise<ShiftDetail>;
  activity(q: ActivityQuery, signal?: AbortSignal): Promise<ActivityPage>;
  /** Pemilik, kasir & dapur — termasuk nonaktif/terhapus (untuk filter riwayat). */
  staff(signal?: AbortSignal): Promise<StaffMember[]>;
  // Tahap 2–3
  pull(entity: DataEntity, cursor?: string, signal?: AbortSignal): Promise<PullPage>;
  /** Satu kiriman ≤ 200 perubahan; `idempotencyKey` dipakai ulang saat mengulang kiriman yang sama. */
  changes(changes: Change[], idempotencyKey: string): Promise<{ results: ChangeResult[]; server_time: string }>;
  stock(q: { outlet_id?: string }, signal?: AbortSignal): Promise<StockRow[]>;
  subscription(signal?: AbortSignal): Promise<SubscriptionDetail>;
  /**
   * Undang karyawan login di HP pribadi / kirim tautan reset password (belum punya password → `invite` 7 hari, sudah →
   * `reset_password` 24 jam; tautan lama batal). Paket Gratis → 403 `PRO_REQUIRED`; syarat gagal → 422 (`role`,
   * `phone`, `personal_access`).
   */
  inviteEmployee(id: string): Promise<EmployeeInvite>;
  /** Batalkan undangan/tautan reset yang masih berlaku (idempoten). */
  cancelInvite(id: string): Promise<void>;
}

const OWNER_BASE = `${API_BASE_URL}/owner`;
const TIMEOUT_MS = 20_000;

type Meta = Partial<PageMeta> & { request_id?: string; summary?: { count: number; total: number } };

type BaseResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code?: string; details?: ApiFieldError[] };
  meta?: Meta;
};

// Sesi habis di tengah jalan → dasbor mengarahkan ke /masuk (dipasang oleh OwnerShell).
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
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
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return "BAD_RESPONSE";
}

async function call<T>(
  method: "GET" | "POST",
  path: string,
  opts: { body?: unknown; signal?: AbortSignal; skipAuthRedirect?: boolean; idempotencyKey?: string } = {}
): Promise<{ data: T; meta?: Meta }> {
  const headers: Record<string, string> = { Accept: "application/json", "X-Sissi-Owner": "1" };
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  if (method === "POST") headers["Content-Type"] = "application/json";
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = opts.signal && typeof AbortSignal.any === "function" ? AbortSignal.any([timeout, opts.signal]) : timeout;

  let res: Response;
  try {
    res = await fetch(`${OWNER_BASE}${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(opts.body ?? {}) : undefined,
      credentials: "include",
      cache: "no-store",
      signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw new ApiError("Permintaan dibatalkan.", 0, "ABORTED");
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    throw new ApiError(
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
  if (res.ok && json?.success) return { data: json.data as T, meta: json.meta };

  const error = new ApiError(
    json?.message || "Terjadi kesalahan. Coba lagi sebentar lagi.",
    res.status,
    json?.error?.code || fallbackCode(res.status),
    json?.error?.details ?? [],
    retryAfterOf(res.headers.get("Retry-After"))
  );
  if (res.status === 401 && !opts.skipAuthRedirect) unauthorizedHandler?.();
  throw error;
}

/** Query string dari objek; nilai kosong dibuang, larik digabung koma. */
export function qs(params: Record<string, string | number | string[] | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

const enc = encodeURIComponent;

const httpApi: OwnerApi = {
  login: async (body) => (await call<OwnerSession>("POST", "/auth/login", { body, skipAuthRedirect: true })).data,
  google: async (body) => (await call<OwnerSession>("POST", "/auth/google", { body, skipAuthRedirect: true })).data,
  logout: async () => {
    await call<null>("POST", "/auth/logout", { body: {}, skipAuthRedirect: true });
  },
  me: async (signal) => (await call<OwnerSession>("GET", "/auth/me", { signal, skipAuthRedirect: true })).data,
  // 401 INVALID_CREDENTIALS di sini = password salah (tetap di halaman); 401 lain = sesi habis → /masuk.
  confirm: async (body) => {
    try {
      return (await call<{ confirmed_until: string }>("POST", "/auth/confirm", { body, skipAuthRedirect: true })).data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && err.code !== "INVALID_CREDENTIALS") unauthorizedHandler?.();
      throw err;
    }
  },
  summary: async (q, signal) => (await call<Summary>("GET", `/summary${qs(q)}`, { signal })).data,
  salesReport: async (q, signal) => (await call<SalesReport>("GET", `/reports/sales${qs(q)}`, { signal })).data,
  outletsReport: async (q, signal) => (await call<OutletsReport>("GET", `/reports/outlets${qs(q)}`, { signal })).data,
  sales: async (q, signal) => {
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 25;
    const r = await call<SaleListItem[]>("GET", `/sales${qs({ ...q, page, per_page: perPage })}`, { signal });
    const items = r.data ?? [];
    return {
      items,
      meta: { page: r.meta?.page ?? page, per_page: r.meta?.per_page ?? perPage, total: r.meta?.total ?? items.length },
      summary: r.meta?.summary ?? { count: items.length, total: items.reduce((a, s) => a + s.total, 0) },
    };
  },
  sale: async (id, signal) => (await call<SaleDetail>("GET", `/sales/${enc(id)}`, { signal })).data,
  shifts: async (q, signal) => {
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 25;
    const r = await call<ShiftListItem[]>("GET", `/shifts${qs({ ...q, page, per_page: perPage })}`, { signal });
    const items = r.data ?? [];
    return {
      items,
      meta: { page: r.meta?.page ?? page, per_page: r.meta?.per_page ?? perPage, total: r.meta?.total ?? items.length },
    };
  },
  shift: async (id, signal) => (await call<ShiftDetail>("GET", `/shifts/${enc(id)}`, { signal })).data,
  activity: async (q, signal) => {
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 50;
    const r = await call<ActivityItem[]>("GET", `/activity${qs({ ...q, page, per_page: perPage })}`, { signal });
    const items = r.data ?? [];
    return {
      items,
      meta: { page: r.meta?.page ?? page, per_page: r.meta?.per_page ?? perPage, total: r.meta?.total ?? items.length },
    };
  },
  staff: async (signal) => (await call<StaffMember[]>("GET", "/staff", { signal })).data ?? [],
  pull: async (entity, cursor, signal) =>
    (await call<PullPage>("GET", `/data/${enc(entity)}${qs({ cursor, limit: 1000 })}`, { signal })).data,
  changes: async (changes, idempotencyKey) =>
    (await call<{ results: ChangeResult[]; server_time: string }>("POST", "/changes", { body: { changes }, idempotencyKey }))
      .data,
  stock: async (q, signal) => (await call<StockRow[]>("GET", `/stock${qs(q)}`, { signal })).data ?? [],
  subscription: async (signal) => (await call<SubscriptionDetail>("GET", "/subscription", { signal })).data,
  // Kontrak menulis `POST /employees/{id}/invite` (Bearer app); dasbor memakai padanan sesi cookie di prefiks /owner.
  inviteEmployee: async (id) =>
    (await call<EmployeeInvite>("POST", `/employees/${enc(id)}/invite`, { body: {}, idempotencyKey: newId() })).data,
  // CORS /owner hanya GET/POST → pembatalan = `POST …/invite/cancel` (padanan `DELETE /employees/{id}/invite`).
  cancelInvite: async (id) => {
    await call<null>("POST", `/employees/${enc(id)}/invite/cancel`, { body: {}, idempotencyKey: newId() });
  },
};

/** Tarik semua record satu entitas (mengikuti cursor) dan buang tombstone. */
export async function pullAll<T extends SyncRecord = SyncRecord>(entity: DataEntity, signal?: AbortSignal): Promise<T[]> {
  const api = await ownerApi();
  const byId = new Map<string, SyncRecord>();
  let cursor: string | undefined;
  for (let guard = 0; guard < 200; guard++) {
    const page = await api.pull(entity, cursor, signal);
    for (const r of page.items) byId.set(r.id, r);
    if (!page.has_more || page.cursor === cursor) break;
    cursor = page.cursor;
  }
  return [...byId.values()].filter((r) => !r.deleted_at) as T[];
}

export const CHANGES_PER_REQUEST = 200;

/** UUID untuk id record baru & Idempotency-Key. */
export function newId(): string {
  return crypto.randomUUID();
}

/**
 * Kirim perubahan (dipecah per 200). Kiriman yang gagal jaringan diulang sekali dengan Idempotency-Key yang sama
 * (aman: server memutar ulang respons pertama). `onProgress` = jumlah perubahan yang sudah diproses.
 */
export async function pushChanges(changes: Change[], onProgress?: (done: number) => void): Promise<ChangeResult[]> {
  const api = await ownerApi();
  const out: ChangeResult[] = [];
  for (let i = 0; i < changes.length; i += CHANGES_PER_REQUEST) {
    const chunk = changes.slice(i, i + CHANGES_PER_REQUEST);
    const key = newId();
    let resp;
    try {
      resp = await api.changes(chunk, key);
    } catch (err) {
      if (err instanceof ApiError && (err.code === "NETWORK_ERROR" || err.code === "TIMEOUT")) {
        resp = await api.changes(chunk, key);
      } else throw err;
    }
    out.push(...resp.results);
    onProgress?.(Math.min(i + chunk.length, changes.length));
  }
  return out;
}

let mockApi: Promise<OwnerApi> | null = null;

export function ownerApi(): Promise<OwnerApi> {
  if (!OWNER_MOCK) return Promise.resolve(httpApi);
  mockApi ??= import("./mock").then((m) => m.createMockApi(() => unauthorizedHandler?.()));
  return mockApi;
}

// ——— device_id untuk peringatan "perangkat baru" ———

const DEVICE_KEY = "sissi-owner:device-id";

/** UUID acak per browser (localStorage). Bila penyimpanan diblokir, tetap mengembalikan UUID sekali pakai. */
export function deviceId(): string | undefined {
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
