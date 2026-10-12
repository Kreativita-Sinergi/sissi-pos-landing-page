// Klien Admin platform (kontrak: sissi-service/docs/api.md "Admin platform").
// Dipanggil langsung dari browser ke API (bukan lewat Vercel): cookie sesi `__Host-sissi_admin` milik
// apipos.sissi.id ikut lewat `credentials: 'include'`, header `X-Sissi-Admin: 1` wajib (CSRF).
// Mode tiruan (NEXT_PUBLIC_ADMIN_MOCK=1) memuat data contoh secara dinamis — tidak ikut terunduh saat mati.
import { API_BASE_URL, ApiError, type ApiFieldError } from "@/lib/sissiApi";
import type {
  AccountDeletion,
  AdminListItem,
  AppVersionConfig,
  AppVersionInput,
  AppVersionSaveResult,
  AuditEntry,
  AuditPage,
  AuditQuery,
  BusinessDetail,
  BusinessFacets,
  BusinessQuery,
  BusinessSummary,
  CrashDetail,
  CrashFacets,
  CrashGroup,
  CrashQuery,
  CrashStatusInput,
  CreateAdminResult,
  DeletionFacets,
  DeletionQuery,
  Features,
  FeaturesInput,
  LoginResult,
  MeResult,
  PageMeta,
  Paged,
  ReleaseList,
  Summary,
  TempPassword,
  UploadApkInput,
  UploadApkResult,
  VersionDistribution,
  AdminSubscription,
  BillingConfig,
  BillingConfigInput,
  ExtendInput,
  Metrics,
  MetricsQuery,
  OverridesInput,
  RecordPaymentInput,
  SubscriptionDetail,
  SubscriptionFacets,
  SubscriptionPaymentResult,
  SubscriptionQuery,
} from "./types";

export const ADMIN_MOCK = process.env.NEXT_PUBLIC_ADMIN_MOCK === "1";

export type UploadHandle = { promise: Promise<UploadApkResult>; abort: () => void };

export interface AdminApi {
  login(email: string, password: string): Promise<LoginResult>;
  logout(): Promise<void>;
  me(signal?: AbortSignal): Promise<MeResult>;
  summary(signal?: AbortSignal): Promise<Summary>;
  appVersion(signal?: AbortSignal): Promise<AppVersionConfig>;
  saveAppVersion(body: AppVersionInput): Promise<AppVersionSaveResult>;
  releases(signal?: AbortSignal): Promise<ReleaseList>;
  uploadApk(input: UploadApkInput, onProgress: (loaded: number, total: number) => void): UploadHandle;
  deleteRelease(file: string): Promise<void>;
  businesses(q: BusinessQuery, signal?: AbortSignal): Promise<Paged<BusinessSummary, BusinessFacets>>;
  business(id: string, signal?: AbortSignal): Promise<BusinessDetail>;
  saveFeatures(id: string, body: FeaturesInput): Promise<Features>;
  // Tahap 2
  versionDistribution(q: { active_days?: number; min_build?: number }, signal?: AbortSignal): Promise<VersionDistribution>;
  auditPage(q: AuditQuery, signal?: AbortSignal): Promise<AuditPage>;
  admins(signal?: AbortSignal): Promise<AdminListItem[]>;
  createAdmin(body: { email: string; name: string }): Promise<CreateAdminResult>;
  resetAdminPassword(id: string): Promise<TempPassword>;
  setAdminActive(id: string, active: boolean): Promise<AdminListItem>;
  changeMyPassword(body: { current_password: string; new_password: string }): Promise<LoginResult>;
  crashes(q: CrashQuery, signal?: AbortSignal): Promise<Paged<CrashGroup, CrashFacets>>;
  crash(fingerprint: string, signal?: AbortSignal): Promise<CrashDetail>;
  setCrashStatus(fingerprint: string, body: CrashStatusInput): Promise<CrashGroup>;
  accountDeletions(q: DeletionQuery, signal?: AbortSignal): Promise<Paged<AccountDeletion, DeletionFacets>>;
  // Tahap 3
  metrics(q: MetricsQuery, signal?: AbortSignal): Promise<Metrics>;
  subscriptions(q: SubscriptionQuery, signal?: AbortSignal): Promise<Paged<AdminSubscription, SubscriptionFacets>>;
  subscription(businessId: string, signal?: AbortSignal): Promise<SubscriptionDetail>;
  recordPayment(businessId: string, body: RecordPaymentInput): Promise<SubscriptionPaymentResult>;
  voidPayment(businessId: string, paymentId: string, reason: string): Promise<SubscriptionPaymentResult>;
  /** Bentuk `data` respons belum dirinci kontrak → pemanggil memuat ulang detail. */
  extendSubscription(businessId: string, body: ExtendInput): Promise<void>;
  saveOverrides(businessId: string, body: OverridesInput): Promise<void>;
  billingConfig(signal?: AbortSignal): Promise<BillingConfig>;
  saveBillingConfig(body: BillingConfigInput): Promise<BillingConfig>;
}

const ADMIN_BASE = `${API_BASE_URL}/admin`;
const TIMEOUT_MS = 20_000;

type BaseResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code?: string; details?: ApiFieldError[] };
  meta?: Meta;
};

type Meta = Partial<PageMeta> & { facets?: unknown; next_cursor?: string | null };

// Sesi habis di tengah jalan → halaman admin mengarahkan ke login (dipasang oleh AdminShell).
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

// Sesi dengan password sementara (403 PASSWORD_CHANGE_REQUIRED) → halaman ganti password.
let passwordChangeHandler: (() => void) | null = null;
export function setPasswordChangeHandler(fn: (() => void) | null) {
  passwordChangeHandler = fn;
}
export function notifyPasswordChangeRequired() {
  passwordChangeHandler?.();
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
): Promise<{ data: T; meta?: Meta }> {
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
  if (res.status === 403 && error.code === "PASSWORD_CHANGE_REQUIRED") passwordChangeHandler?.();
  throw error;
}

function paged<T, F = undefined>(r: { data: T[]; meta?: Meta }, page: number, perPage: number): Paged<T, F> {
  const items = r.data ?? [];
  return {
    items,
    meta: {
      page: r.meta?.page ?? page,
      per_page: r.meta?.per_page ?? perPage,
      total: r.meta?.total ?? items.length,
    },
    facets: (r.meta?.facets as F | null | undefined) ?? null,
  };
}

function qs(params: Record<string, string | number | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      if (v.length) sp.set(k, v.join(","));
    } else if (v !== undefined && v !== "") sp.set(k, String(v));
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
    const r = await call<BusinessSummary[]>(
      "GET",
      `/businesses${qs({ ...q, page, per_page: perPage })}`,
      { signal }
    );
    return paged<BusinessSummary, BusinessFacets>(r, page, perPage);
  },
  business: async (id, signal) => (await call<BusinessDetail>("GET", `/businesses/${enc(id)}`, { signal })).data,
  saveFeatures: async (id, body) =>
    (await call<Features>("PUT", `/businesses/${enc(id)}/features`, { body })).data,
  versionDistribution: async (q, signal) =>
    (
      await call<VersionDistribution>(
        "GET",
        `/app-versions/distribution${qs({ platform: "android", active_days: q.active_days, min_build: q.min_build })}`,
        { signal }
      )
    ).data,
  auditPage: async (q, signal) => {
    const r = await call<AuditEntry[]>("GET", `/audit${qs({ ...q, limit: q.limit ?? 50 })}`, { signal });
    return { items: r.data ?? [], next_cursor: r.meta?.next_cursor ?? null };
  },
  admins: async (signal) => (await call<AdminListItem[]>("GET", "/admins", { signal })).data ?? [],
  createAdmin: async (body) => (await call<CreateAdminResult>("POST", "/admins", { body })).data,
  resetAdminPassword: async (id) =>
    (await call<TempPassword>("POST", `/admins/${enc(id)}/reset-password`, { body: {} })).data,
  setAdminActive: async (id, active) =>
    (await call<AdminListItem>("POST", `/admins/${enc(id)}/${active ? "enable" : "disable"}`, { body: {} })).data,
  changeMyPassword: async (body) => (await call<LoginResult>("POST", "/me/password", { body })).data,
  crashes: async (q, signal) => {
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 25;
    const r = await call<CrashGroup[]>("GET", `/crashes${qs({ ...q, page, per_page: perPage })}`, { signal });
    return paged<CrashGroup, CrashFacets>(r, page, perPage);
  },
  crash: async (fp, signal) => (await call<CrashDetail>("GET", `/crashes/${enc(fp)}`, { signal })).data,
  setCrashStatus: async (fp, body) => (await call<CrashGroup>("PUT", `/crashes/${enc(fp)}/status`, { body })).data,
  accountDeletions: async (q, signal) => {
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 25;
    const r = await call<AccountDeletion[]>("GET", `/account-deletions${qs({ ...q, page, per_page: perPage })}`, {
      signal,
    });
    return paged<AccountDeletion, DeletionFacets>(r, page, perPage);
  },
  metrics: async (q, signal) => (await call<Metrics>("GET", `/metrics${qs({ ...q })}`, { signal })).data,
  subscriptions: async (q, signal) => {
    const page = q.page ?? 1;
    const perPage = q.per_page ?? 25;
    const r = await call<AdminSubscription[]>("GET", `/subscriptions${qs({ ...q, page, per_page: perPage })}`, {
      signal,
    });
    return paged<AdminSubscription, SubscriptionFacets>(r, page, perPage);
  },
  subscription: async (id, signal) =>
    (await call<SubscriptionDetail>("GET", `/businesses/${enc(id)}/subscription`, { signal })).data,
  recordPayment: async (id, body) =>
    (await call<SubscriptionPaymentResult>("POST", `/businesses/${enc(id)}/subscription/payments`, { body })).data,
  voidPayment: async (id, pid, reason) =>
    (
      await call<SubscriptionPaymentResult>("POST", `/businesses/${enc(id)}/subscription/payments/${enc(pid)}/void`, {
        body: { reason },
      })
    ).data,
  extendSubscription: async (id, body) => {
    await call<unknown>("POST", `/businesses/${enc(id)}/subscription/extend`, { body });
  },
  saveOverrides: async (id, body) => {
    await call<unknown>("PUT", `/businesses/${enc(id)}/subscription/overrides`, { body });
  },
  billingConfig: async (signal) => (await call<BillingConfig>("GET", "/billing-config", { signal })).data,
  saveBillingConfig: async (body) => (await call<BillingConfig>("PUT", "/billing-config", { body })).data,
};

let mockApi: Promise<AdminApi> | null = null;

export function adminApi(): Promise<AdminApi> {
  if (!ADMIN_MOCK) return Promise.resolve(httpApi);
  mockApi ??= import("./mock").then((m) =>
    m.createMockApi(
      () => unauthorizedHandler?.(),
      () => passwordChangeHandler?.()
    )
  );
  return mockApi;
}
