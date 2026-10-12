// Klien kecil untuk Sissi POS API (base response: { success, message, data, error, meta }).
// Dipanggil langsung dari browser agar pembatas laju per IP di server tetap akurat;
// origin situs ini harus ada di CORS_ORIGINS / PUBLIC_CORS_ORIGINS sissi-service.
export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://apipos.sissi.id/api/v1"
).replace(/\/+$/, "");

const REQUEST_TIMEOUT_MS = 15_000;

export type ApiFieldError = { field: string; message: string };

type BaseResponse<T> = {
  success: boolean;
  message?: string;
  data?: T;
  error?: { code?: string; details?: ApiFieldError[] };
};

// Kode galat kontrak yang ditangani khusus oleh klien web, plus kode sisi klien.
export type ApiErrorCode =
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "SELF_ORDER_CLOSED"
  | "PRICE_CHANGED"
  | "OUT_OF_STOCK"
  | "TOO_MANY_PENDING"
  | "ORDER_NOT_PAYABLE"
  | "ORDER_NOT_CANCELABLE"
  | "PAYMENT_UNAVAILABLE"
  // Sisi klien:
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "ABORTED"
  | "BAD_RESPONSE"
  | (string & {});

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // Kode error dari server, atau NETWORK_ERROR / TIMEOUT / ABORTED / BAD_RESPONSE dari sisi klien.
    readonly code: ApiErrorCode,
    readonly details: ApiFieldError[] = [],
    readonly retryAfter: number | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Galat koneksi (bukan jawaban server) — aman diulang dengan Idempotency-Key yang sama. */
  get isNetwork(): boolean {
    return this.code === "NETWORK_ERROR" || this.code === "TIMEOUT";
  }
}

export type RequestOptions = {
  /** Header tambahan, mis. `X-Order-Key` dan `Idempotency-Key`. */
  headers?: Record<string, string>;
  /** Sinyal batal dari pemanggil (mis. saat komponen dilepas); digabung dengan batas waktu. */
  signal?: AbortSignal;
  timeoutMs?: number;
};

function combineSignals(timeoutMs: number, external?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) return timeout;
  if (typeof AbortSignal.any === "function") return AbortSignal.any([timeout, external]);
  // Peramban lama: gabungkan manual.
  const ctrl = new AbortController();
  const forward = (s: AbortSignal) => () => ctrl.abort(s.reason);
  timeout.addEventListener("abort", forward(timeout), { once: true });
  external.addEventListener("abort", forward(external), { once: true });
  return ctrl.signal;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds);
  // Bentuk tanggal HTTP.
  const date = Date.parse(value);
  if (Number.isNaN(date)) return null;
  const diff = Math.ceil((date - Date.now()) / 1000);
  return diff > 0 ? diff : null;
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  body: unknown,
  opts: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (method === "POST") headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
      signal: combineSignals(opts.timeoutMs ?? REQUEST_TIMEOUT_MS, opts.signal),
    });
  } catch (err) {
    if (opts.signal?.aborted) {
      throw new ApiError("Permintaan dibatalkan.", 0, "ABORTED");
    }
    const timeout = err instanceof DOMException && err.name === "TimeoutError";
    throw new ApiError(
      timeout ? "Server tidak merespons. Coba lagi sebentar lagi." : "Tidak dapat terhubung ke server.",
      0,
      timeout ? "TIMEOUT" : "NETWORK_ERROR"
    );
  }

  let json: BaseResponse<T> | null = null;
  try {
    json = (await res.json()) as BaseResponse<T>;
  } catch {
    // Bukan JSON (mis. halaman error dari proxy); ditangani di bawah.
  }

  if (res.ok && json?.success) {
    return json.data as T;
  }

  const fallbackCode =
    res.status === 404
      ? "NOT_FOUND"
      : res.status === 429
        ? "RATE_LIMITED"
        : res.status === 503
          ? "SERVICE_UNAVAILABLE"
          : "BAD_RESPONSE";
  throw new ApiError(
    json?.message || "Terjadi kesalahan. Coba lagi sebentar lagi.",
    res.status,
    json?.error?.code || fallbackCode,
    json?.error?.details ?? [],
    parseRetryAfter(res.headers.get("Retry-After"))
  );
}

export function getJson<T>(path: string, opts?: RequestOptions): Promise<T> {
  return request<T>("GET", path, undefined, opts);
}

export function postJson<T>(path: string, body: unknown, opts?: RequestOptions): Promise<T> {
  return request<T>("POST", path, body, opts);
}
