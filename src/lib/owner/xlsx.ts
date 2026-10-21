// Baca/tulis .xlsx sederhana — port `sissi-app/lib/core/share/xlsx.dart` (perilaku sama: nomor baris = nomor baris
// Excel, baris kosong dilewati, angka tanpa ekor desimal palsu, rumus = hasil tersimpan, boolean → true/false, sel angka
// berformat persen ditulis seperti tampilannya: Excel menyimpan `35%` sebagai `0.35` → "35%").
// Zip memakai `fflate` (kecil, tanpa dependensi); XML diurai dengan pola sederhana karena SpreadsheetML datar
// (row/c/v/t tidak bersarang). Modul ini dimuat dinamis (`await import("@/lib/owner/xlsx")`) hanya saat impor/unduh.
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import type { CsvRow } from "./productImport";

/** Satu lembar kerja: nama + baris (sel teks). */
export type XlsxSheet = { name: string; rows: CsvRow[] };

/** Batas isi zip yang dibongkar (cegah "zip bomb"), sama dengan aplikasi. */
const MAX_UNPACKED_BYTES = 60 * 1024 * 1024;

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export class XlsxFormatError extends Error {}

// ——— XML kecil ———

/** Elemen bernama `local` (awalan namespace apa pun): atribut mentah + isi (`null` bila `<x/>`). */
function elements(xml: string, local: string): { attrs: string; body: string | null }[] {
  const re = new RegExp(`<(?:[\\w.-]+:)?${local}(\\s[^>]*?)?(?:/>|>([\\s\\S]*?)</(?:[\\w.-]+:)?${local}\\s*>)`, "g");
  const out: { attrs: string; body: string | null }[] = [];
  for (const m of xml.matchAll(re)) out.push({ attrs: m[1] ?? "", body: m[2] ?? null });
  return out;
}

/** Nilai atribut `name` (boleh berawalan namespace, mis. `r:id`). */
function attr(attrs: string, name: string): string | null {
  const m = new RegExp(`(?:^|\\s)(?:[\\w.-]+:)?${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`).exec(attrs);
  return m ? decode(m[1] ?? m[2] ?? "") : null;
}

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (all, e: string) => {
    const k = e.toLowerCase();
    if (k === "lt") return "<";
    if (k === "gt") return ">";
    if (k === "amp") return "&";
    if (k === "quot") return '"';
    if (k === "apos") return "'";
    const code = k.startsWith("#x") ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : all;
  });
}

/** Teks sel/string bersama: gabungan `<t>` (abaikan teks fonetik `<rPh>`). */
function text(body: string | null): string {
  if (!body) return "";
  const clean = body.replace(/<(?:[\w.-]+:)?rPh[\s>][\s\S]*?<\/(?:[\w.-]+:)?rPh\s*>/g, "");
  return elements(clean, "t")
    .map((t) => decode(t.body ?? ""))
    .join("");
}

// ——— Baca ———

/**
 * Membaca semua lembar .xlsx menjadi teks sel. Angka ditulis tanpa ekor desimal palsu Excel (`15000`, `0.5`; pemisah
 * desimal `decimalSeparator`); sel angka berformat persen (`styles.xml`) → angka tampilan + "%" (`0.35` → `35%`).
 * Melempar `XlsxFormatError` bila bukan .xlsx sah.
 */
export function readXlsx(bytes: Uint8Array, decimalSeparator = "."): XlsxSheet[] {
  let total = 0;
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_UNPACKED_BYTES) throw new XlsxFormatError("isi xlsx terlalu besar");
        return f.name.endsWith(".xml") || f.name.endsWith(".rels");
      },
    });
  } catch (err) {
    if (err instanceof XlsxFormatError) throw err;
    throw new XlsxFormatError("bukan berkas xlsx");
  }
  const doc = (path: string): string | null => {
    const f = files[path];
    return f ? strFromU8(f) : null;
  };

  const workbook = doc("xl/workbook.xml");
  if (workbook === null) throw new XlsxFormatError("workbook tidak ada");
  const targets = new Map<string, string>();
  for (const r of elements(doc("xl/_rels/workbook.xml.rels") ?? "", "Relationship")) {
    const id = attr(r.attrs, "Id");
    const target = attr(r.attrs, "Target");
    if (!id || !target) continue;
    targets.set(id, target.startsWith("/") ? target.slice(1) : target.startsWith("xl/") ? target : `xl/${target}`);
  }
  const shared = elements(doc("xl/sharedStrings.xml") ?? "", "si").map((si) => text(si.body));
  const percent = percentStyles(doc("xl/styles.xml"));

  const sheets: XlsxSheet[] = [];
  elements(workbook, "sheet").forEach((s, i) => {
    const rid = attr(s.attrs, "id");
    const path = (rid && targets.get(rid)) || `xl/worksheets/sheet${i + 1}.xml`;
    const sheet = doc(path);
    if (sheet === null) return;
    sheets.push({ name: attr(s.attrs, "name") ?? `Sheet${i + 1}`, rows: readRows(sheet, shared, decimalSeparator, percent) });
  });
  return sheets;
}

/**
 * Indeks gaya sel (`<c s="…">`, urutan `<xf>` di `cellXfs`) yang format angkanya persen: format bawaan 9 (`0%`) /
 * 10 (`0.00%`) atau format kustom (`numFmt`) yang memuat `%` di luar teks berkutip / karakter ber-escape.
 */
export function percentStyles(styles: string | null): Set<number> {
  const out = new Set<number>();
  if (!styles) return out;
  const custom = new Set<number>();
  for (const f of elements(styles, "numFmt")) {
    const id = Number.parseInt(attr(f.attrs, "numFmtId") ?? "", 10);
    const code = (attr(f.attrs, "formatCode") ?? "").replace(/"[^"]*"/g, "").replace(/\\./g, "");
    if (Number.isFinite(id) && code.includes("%")) custom.add(id);
  }
  const xfs = elements(styles, "cellXfs")[0];
  if (!xfs?.body) return out;
  elements(xfs.body, "xf").forEach((xf, i) => {
    const id = Number.parseInt(attr(xf.attrs, "numFmtId") ?? "", 10);
    if (id === 9 || id === 10 || custom.has(id)) out.add(i);
  });
  return out;
}

function readRows(sheet: string, shared: string[], decimal: string, percent: Set<number>): CsvRow[] {
  const rows: CsvRow[] = [];
  let nextLine = 1;
  for (const row of elements(sheet, "row")) {
    const parsed = Number.parseInt(attr(row.attrs, "r") ?? "", 10);
    const line = Number.isFinite(parsed) ? parsed : nextLine;
    nextLine = line + 1;
    const cells: string[] = [];
    let nextCol = 0;
    for (const c of elements(row.body ?? "", "c")) {
      const col = column(attr(c.attrs, "r")) ?? nextCol;
      nextCol = col + 1;
      const value = cellValue(c.attrs, c.body, shared, decimal, percent);
      if (!value) continue;
      while (cells.length < col) cells.push("");
      cells[col] = value;
    }
    if (cells.every((x) => !x.trim())) continue;
    rows.push({ line, cells });
  }
  return rows;
}

/** "B12" → 1 (kolom berbasis nol); null bila tanpa referensi. */
function column(ref: string | null): number | null {
  if (!ref) return null;
  let n = 0;
  let seen = false;
  for (const ch of ref.toUpperCase()) {
    const u = ch.charCodeAt(0);
    if (u < 65 || u > 90) break;
    n = n * 26 + (u - 64);
    seen = true;
  }
  return seen ? n - 1 : null;
}

function cellValue(attrs: string, body: string | null, shared: string[], decimal: string, percent: Set<number>): string {
  const type = attr(attrs, "t");
  if (type === "inlineStr") {
    const inline = elements(body ?? "", "is")[0];
    return inline ? text(inline.body) : "";
  }
  const v = elements(body ?? "", "v")[0];
  if (!v || v.body === null) return "";
  const raw = decode(v.body);
  switch (type) {
    case "s": {
      const i = Number.parseInt(raw, 10);
      return shared[i] ?? "";
    }
    case "b":
      return raw === "1" ? "true" : "false";
    case "str":
    case "e":
      return raw;
    default: {
      const style = Number.parseInt(attr(attrs, "s") ?? "", 10);
      if (percent.has(style)) return `${xlsxPercent(raw).replace(".", decimal)}%`;
      return xlsxNumber(raw).replace(".", decimal);
    }
  }
}

/** Nilai sel berformat persen (`0.35`) → angka tampilan (`35`). Bukan angka → apa adanya. */
export function xlsxPercent(raw: string): string {
  const d = raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(d)) return raw;
  return xlsxNumber(String(d * 100));
}

/** Angka Excel → teks rapi: `15000.000000000002` → `15000`, `1.5E-3` → `0.0015`. Bukan angka → apa adanya. */
export function xlsxNumber(raw: string): string {
  const d = raw.trim() ? Number(raw) : NaN;
  if (!Number.isFinite(d)) return raw;
  const rounded = Number(d.toPrecision(12));
  if (Number.isInteger(rounded) && Math.abs(rounded) < 1e15) return rounded.toFixed(0);
  const s = rounded.toFixed(6).replace(/0+$/, "");
  return s.endsWith(".") ? s.slice(0, -1) : s;
}

// ——— Tulis ———

export type XlsxCell = string | number | null | undefined;
export type XlsxSheetData = { name: string; rows: XlsxCell[][] };

/** Membuat .xlsx sederhana: tiap lembar = judul kolom (tebal, dibekukan) + baris. Angka = sel angka, lainnya teks. */
export function writeXlsx(sheets: XlsxSheetData[]): Uint8Array {
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const pkg = "http://schemas.openxmlformats.org/package/2006/relationships";
  const n = sheets.length;
  const range = (k: number) => Array.from({ length: k }, (_, i) => i + 1);
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(
      `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        range(n)
          .map((i) => `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
          .join("") +
        "</Types>"
    ),
    "_rels/.rels": strToU8(`${head}<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    "xl/workbook.xml": strToU8(
      `${head}<workbook xmlns="${main}" xmlns:r="${rel}"><sheets>` +
        sheets.map((s, i) => `<sheet name="${escape(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
        "</sheets></workbook>"
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `${head}<Relationships xmlns="${pkg}">` +
        range(n)
          .map((i) => `<Relationship Id="rId${i}" Type="${rel}/worksheet" Target="worksheets/sheet${i}.xml"/>`)
          .join("") +
        `<Relationship Id="rId${n + 1}" Type="${rel}/styles" Target="styles.xml"/></Relationships>`
    ),
    "xl/styles.xml": strToU8(
      `${head}<styleSheet xmlns="${main}">` +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs>' +
        '<cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>'
    ),
  };
  sheets.forEach((s, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows, head, main));
  });
  return zipSync(files, { level: 6 });
}

function sheetXml(rows: XlsxCell[][], head: string, main: string): string {
  const widths: number[] = [];
  for (const r of rows)
    r.forEach((v, i) => {
      const len = String(v ?? "").length;
      widths[i] = Math.max(widths[i] ?? 0, len);
    });
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(50, Math.max(10, w + 3))}" customWidth="1"/>`).join("");
  let body = "";
  rows.forEach((row, r) => {
    body += `<row r="${r + 1}">`;
    row.forEach((v, c) => {
      if (v === null || v === undefined || v === "") return;
      const ref = `${columnName(c)}${r + 1}`;
      const style = r === 0 ? ' s="1"' : "";
      body +=
        typeof v === "number" && Number.isFinite(v)
          ? `<c r="${ref}"${style}><v>${v}</v></c>`
          : `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escape(String(v))}</t></is></c>`;
    });
    body += "</row>";
  });
  return (
    `${head}<worksheet xmlns="${main}"><sheetViews><sheetView workbookViewId="0">` +
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    (cols ? `<cols>${cols}</cols>` : "") +
    `<sheetData>${body}</sheetData></worksheet>`
  );
}

/** 0 → A, 25 → Z, 26 → AA. */
function columnName(index: number): string {
  let s = "";
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** Unduh .xlsx di peramban. */
export function downloadXlsx(filename: string, sheets: XlsxSheetData[]) {
  const bytes = writeXlsx(sheets);
  const blob = new Blob([bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer], { type: XLSX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
