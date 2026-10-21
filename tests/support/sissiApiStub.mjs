// Pengganti `src/lib/sissiApi.ts` untuk tes unit (berkas aslinya memakai parameter property TS yang tidak didukung
// type stripping Node). Tes unit tidak memanggil jaringan.
export const API_BASE_URL = "http://localhost/api/v1";
export class ApiError extends Error {
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
export function getJson() {
  throw new Error("jaringan tidak tersedia di tes unit");
}
export const postJson = getJson;
