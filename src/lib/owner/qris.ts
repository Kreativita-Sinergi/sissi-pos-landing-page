// Pemeriksaan kode QRIS statis — cermin `sissi-app/lib/core/utils/qris.dart` (checkQris): diawali `000201`, struktur
// TLV EMVCo utuh, diakhiri tag 63 dengan CRC16-CCITT-FALSE yang cocok, memuat akun merchant (tag 26–51), bertanda
// QRIS (`ID.CO.QRIS` atau negara `ID`), dan bukan QRIS dinamis (tag 01 = "12").

export type EmvField = { tag: string; value: string };

const TWO_DIGITS = /^\d\d$/;

/** Urai TLV EMVCo; `null` bila struktur rusak. */
export function parseEmvTlv(data: string): EmvField[] | null {
  const out: EmvField[] = [];
  let i = 0;
  while (i < data.length) {
    if (i + 4 > data.length) return null;
    const tag = data.slice(i, i + 2);
    const len = data.slice(i + 2, i + 4);
    if (!TWO_DIGITS.test(tag) || !TWO_DIGITS.test(len)) return null;
    const end = i + 4 + Number(len);
    if (end > data.length) return null;
    out.push({ tag, value: data.slice(i + 4, end) });
    i = end;
  }
  return out;
}

/** CRC16-CCITT-FALSE (poly 0x1021, awal 0xFFFF) atas byte UTF-8 → 4 hex huruf besar. */
export function qrisCrc16(data: string): string {
  let crc = 0xffff;
  for (const b of new TextEncoder().encode(data)) {
    crc ^= b << 8;
    for (let k = 0; k < 8; k++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export type QrisInfo = { payload: string; merchantName: string; city: string; nmid: string | null };
export type QrisCheck = { info: QrisInfo; problem: null } | { info: null; problem: "invalid" | "dynamic" };

export function checkQris(raw: string): QrisCheck {
  const invalid: QrisCheck = { info: null, problem: "invalid" };
  const t = raw.trim();
  if (!t.startsWith("000201") || t.length < 16) return invalid;
  const body = t.slice(0, -4);
  if (!body.endsWith("6304")) return invalid;
  if (qrisCrc16(body) !== t.slice(-4).toUpperCase()) return invalid;
  const fields = parseEmvTlv(t);
  if (!fields || fields[fields.length - 1]?.tag !== "63") return invalid;
  const top = (tag: string) => fields.find((f) => f.tag === tag)?.value;
  const accounts = new Map<string, EmvField[]>();
  for (const f of fields) {
    const id = Number(f.tag);
    if (id < 26 || id > 51) continue;
    const sub = parseEmvTlv(f.value);
    const domain = sub?.find((s) => s.tag === "00")?.value ?? "";
    if (sub && domain) accounts.set(f.tag, sub);
  }
  const marked = t.toUpperCase().includes("ID.CO.QRIS") || top("58") === "ID";
  if (!accounts.size || !marked) return invalid;
  if (top("01") === "12") return { info: null, problem: "dynamic" };
  const nmid = accounts.get("51")?.find((s) => s.tag === "02")?.value.trim();
  return {
    info: { payload: t, merchantName: (top("59") ?? "").trim(), city: (top("60") ?? "").trim(), nmid: nmid ? nmid : null },
    problem: null,
  };
}

/** Pesan app (app_id.arb) untuk masalah QRIS. `typed` = teks diketik, bukan dibaca dari gambar. */
export function qrisProblemText(problem: "invalid" | "dynamic", typed = false): string {
  if (problem === "dynamic") {
    return "Ini QRIS dinamis (sekali pakai untuk satu transaksi). Pakai QRIS statis toko, yaitu QRIS yang sama untuk setiap pembeli, biasanya berupa stiker atau cetakan.";
  }
  return typed
    ? "Kode ini bukan QRIS yang valid. Periksa lagi teksnya, atau unggah gambar QRIS."
    : "Gambar tidak berisi QRIS yang valid. Pakai foto/screenshot QRIS dari bank atau aplikasi pembayaran.";
}

type Detector = { detect(source: ImageBitmapSource): Promise<{ rawValue: string }[]> };
type DetectorCtor = new (opts: { formats: string[] }) => Detector;

/**
 * Baca teks QR dari gambar memakai BarcodeDetector bawaan browser (Chrome/Edge/Android). `null` bila browser tidak
 * mendukung (pemilik bisa menempel teks kode secara manual) atau tidak ada QR di gambar.
 */
export async function readQrFromImage(file: Blob): Promise<{ supported: boolean; text: string | null }> {
  const Ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector;
  if (!Ctor) return { supported: false, text: null };
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const found = await new Ctor({ formats: ["qr_code"] }).detect(bitmap);
      return { supported: true, text: found[0]?.rawValue ?? null };
    } finally {
      bitmap.close();
    }
  } catch {
    return { supported: true, text: null };
  }
}
