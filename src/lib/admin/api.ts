// Klien Admin platform (kontrak: sissi-service/docs/api.md "Admin platform").
// Dipanggil langsung dari browser ke API (bukan lewat Vercel): cookie sesi `__Host-sissi_admin` milik
// apipos.sissi.id ikut lewat `credentials: 'include'`, header `X-Sissi-Admin: 1` wajib (CSRF).
// Mode tiruan (NEXT_PUBLIC_ADMIN_MOCK=1) memuat data contoh secara dinamis — tidak ikut terunduh saat mati.
import { API_BASE_URL, ApiError, type ApiFieldError } from "@/lib/sissiApi";
import type {
  AppVersionConfig,
  AppVersionInput,
  AppVersionSaveResult,
  AuditEntry,
  AuditQuery,
  BusinessDetail,
  BusinessSummary,
  Features,
  FeaturesInput,
  LoginResult,
  MeResult,
  PageMeta,
  Paged,
  ReleaseList,
  Summary,
  UploadApkInput,
  UploadApkResult,
} from "./types";

export const ADMIN_MOCK = process.env.NEXT_PUBLIC_ADMIN_MOCK === "1";

export type UploadHandle = { promise: Promise<UploadApkResult>; abort: () => void };

export interface AdminApi {
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  me(signal?: AbortSignal): Promise<MeResult>;
  summary(signal?: AbortSignal): Promise<Summary>;
  audit(q: AuditQuery, signal?: AbortSignal): Promise<Paged<AuditEntry>>;
  appVersion(signal?: AbortSignal): Promise<AppVersionConfig>;
  saveAppVersion(body: AppVersionInput): Promise<AppVersionSaveResult>;
  releases(signal?: AbortSignal): Promise<ReleaseList>;
  uploadApk(input: UploadApkInput, onProgress: (loaded: number, total: number) => void): UploadHandle;
  deleteRelease(file: string): Promise<void>;
  businesses(q: { q?: string; page?: number; per_page?: number }, signal?: AbortSignal): Promise<Paged<BusinessSummary>>;
  business(id: string, signal?: AbortSignal): Promise<BusinessDetail>;
  saveFeatures(id: string, body: FeaturesInput): Promise<Features>;
}

const ADMIN_BASE = `${API_BASE_URL}/admin`;
const TIMEOUT_MS = 20_000;

type BaseResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code?: string; details?: ApiFieldError[] };
  meta?: Partial<PageMeta>;
};

// Sesi habis di tengah jalan → halaman admin mengarahkan ke login (dipasang oleh AdminShell).
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
  if (status === 413) return "FILE_TOO_LARGE";
  if (status === 429) return "RATE_LIMITED";
  if (status === 503) return "SERVICE_UNAVAILABLE";
  return "BAD_RESPONSE";
}

function toError(status: number, json: BaseResponse<unknown> | null, retryAfter: string | null): ApiError {
  return new ApiError(
    json?.message || "Terjadi kesalahan. Coba lagi sebentar lagi.",
    status,
    json?.error?.code || fallbackCode(status),
    json?.error?.details ?? [],
    retryAfterOf(retryAfter)
  );
}

async function call<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  opts: { body?: unknown; signal?: AbortSignal; skipAuthRedirect?: boolean } = {}
): Promise<{ data: T; meta?: Partial<PageMeta> }> {
  const headers: Record<string, string> = { Accept: "application/json", "X-Sissi-Admin": "1" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const signal = opts.signal && typeof AbortSignal.any === "function" ? AbortSignal.any([timeout, opts.signal]) : timeout;

  let res: Response;
  try {
    res = await fetch(`${ADMIN_BASE}${path}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
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

  const error = toError(res.status, json, res.headers.get("Retry-After"));
  if (res.status === 401 && !opts.skipAuthRedirect) unauthorizedHandler?.();
  throw error;
}

function paged<T>(r: { data: T[]; meta?: Partial<PageMeta> }, page: number, perPage: number): Paged<T> {
  const items = r.data ?? [];
  return {
    items,
    meta: {
      page: r.meta?.page ?? page,
      per_page: r.meta?.per_page ?? perPage,
      total: r.meta?.total ?? items.length,
    },
  };
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function uploadXhr(input: UploadApkInput, onProgress: (loaded: number, total: number) => void): UploadHandle {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadApkResult>((resolve, reject) => {
    const form = new FormData();
    form.append("version", input.version);
    form.append("build", String(input.build));
    form.append("abi", input.abi);
    if (input.sha256) form.append("sha256", input.sha256.toLowerCase());
    form.append("make_latest", input.make_latest ? "true" : "false");
    form.append("update_app_version", input.update_app_version ? "true" : "false");
    form.append("file", input.file, input.file.name);

    xhr.open("POST", `${ADMIN_BASE}/releases/apk`);
    xhr.withCredentials = true;
    xhr.timeout = 10 * 60_000;
    xhr.setRequestHeader("X-Sissi-Admin", "1");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total);
    };
    xhr.onload = () => {
      let json: BaseResponse<UploadApkResult> | null = null;
      try {
        json = JSON.parse(xhr.responseText) as BaseResponse<UploadApkResult>;
      } catch {
        // Bukan JSON.
      }
      if (xhr.status >= 200 && xhr.status < 300 && json?.success && json.data) {
        resolve(json.data);
        return;
      }
      if (xhr.status === 401) unauthorizedHandler?.();
      reject(toError(xhr.status, json, xhr.getResponseHeader("Retry-After")));
    };
    xhr.onerror = () => reject(new ApiError("Koneksi terputus saat mengunggah.", 0, "NETWORK_ERROR"));
    xhr.ontimeout = () => reject(new ApiError("Unggahan melewati batas waktu 10 menit.", 0, "TIMEOUT"));
    xhr.onabort = () => reject(new ApiError("Unggahan dibatalkan.", 0, "ABORTED"));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

const enc = encodeURIComponent;

const httpApi: AdminApi = {
  login: async (email, password) =>
    (await call<LoginResult>("POST", "/auth/login", { body: { email, password }, skipAuthRedirect: true })).data,
  logout: async () => {
    await call<null>("POST", "/auth/logout", { body: {}, skipAuthRedirect: true });
  },
  me: async (signal) => (await call<MeResult>("GET", "/auth/me", { signal, skipAuthRedirect: true })).data,
  summary: async (signal) => (await call<Summary>("GET", "/summary", { signal })).data,
  audit: async (q, signal) => {
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 50;
    const r = await call<AuditEntry[]>(
      "GET",
      `/audit${qs({ page, per_page: perPage, action: q.action, admin_id: q.admin_id, target_type: q.target_type, target_id: q.target_id })}`,
      { signal }
    );
    return paged(r, page, perPage);
  },
  appVersion: async (signal) =>
    (await call<AppVersionConfig>("GET", "/app-version?platform=android", { signal })).data,
  saveAppVersion: async (body) => (await call<AppVersionSaveResult>("PUT", "/app-version", { body })).data,
  releases: async (signal) => (await call<ReleaseList>("GET", "/releases", { signal })).data,
  uploadApk: uploadXhr,
  deleteRelease: async (file) => {
    await call<null>("DELETE", `/releases/${enc(file)}`);
  },
  businesses: async (q, signal) => {
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 20;
    const r = await call<BusinessSummary[]>("GET", `/businesses${qs({ q: q.q, page, per_page: perPage })}`, { signal });
    return paged(r, page, perPage);
  },
  business: async (id, signal) => (await call<BusinessDetail>("GET", `/businesses/${enc(id)}`, { signal })).data,
  saveFeatures: async (id, body) =>
    (await call<Features>("PUT", `/businesses/${enc(id)}/features`, { body })).data,
};

let mockApi: Promise<AdminApi> | null = null;

export function adminApi(): Promise<AdminApi> {
  if (!ADMIN_MOCK) return Promise.resolve(httpApi);
  mockApi ??= import("./mock").then((m) => m.createMockApi(() => unauthorizedHandler?.()));
  return mockApi;
}
