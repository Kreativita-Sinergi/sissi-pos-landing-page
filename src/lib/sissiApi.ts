// Klien kecil untuk Sissi POS API (base response: { success, message, data, error, meta }).
// Dipanggil langsung dari browser agar pembatas laju per IP di server tetap akurat;
// origin situs ini harus ada di CORS_ORIGINS sissi-service.
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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    // Kode error dari server, atau NETWORK_ERROR / TIMEOUT / BAD_RESPONSE dari sisi klien.
    readonly code: string,
    readonly details: ApiFieldError[] = [],
    readonly retryAfter: number | null = null
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
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

  const retryAfter = Number(res.headers.get("Retry-After"));
  throw new ApiError(
    json?.message || "Terjadi kesalahan. Coba lagi sebentar lagi.",
    res.status,
    json?.error?.code || (res.status === 404 ? "NOT_FOUND" : "BAD_RESPONSE"),
    json?.error?.details ?? [],
    Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : null
  );
}
