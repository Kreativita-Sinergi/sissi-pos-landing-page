// Ekspor CSV di klien: BOM UTF-8 (agar Excel membaca huruf dengan benar), pemisah koma, angka mentah.

import { zonedDay, zonedHHMM } from "./tz";

type Cell = string | number | null | undefined | boolean;

function cell(v: Cell): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
  // Cegah injeksi formula spreadsheet untuk teks yang diawali = + - @ (angka dibiarkan mentah).
  const safe = typeof v === "string" && /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, header: string[], rows: Cell[][]) {
  const blob = new Blob(["﻿", toCsv(header, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Waktu ISO → `YYYY-MM-DD HH:mm` di zona usaha (mudah dibaca & diurutkan di spreadsheet). */
export function csvDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const day = zonedDay(iso);
  return day ? `${day} ${zonedHHMM(iso)}` : "";
}

/** Nama berkas aman: huruf kecil, tanda hubung. */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
