// Periode laporan dasbor (tanggal `YYYY-MM-DD` di zona usaha, `to` inklusif, maksimal 92 hari).
import { zonedToday } from "./tz";

export const MAX_DAYS = 92;

export type PeriodId = "today" | "yesterday" | "7d" | "30d" | "month" | "last_month";

export const PERIOD_LABELS: Record<PeriodId | "custom", string> = {
  today: "Hari ini",
  yesterday: "Kemarin",
  "7d": "7 hari terakhir",
  "30d": "30 hari terakhir",
  month: "Bulan ini",
  last_month: "Bulan lalu",
  custom: "Kustom",
};

export const PERIOD_ORDER: PeriodId[] = ["today", "yesterday", "7d", "30d", "month", "last_month"];

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

export function spanDays(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1;
}

export const isDay = (v: string | null | undefined): v is string =>
  !!v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export function presetRange(id: PeriodId, today = zonedToday()): { from: string; to: string } {
  switch (id) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "month":
      return { from: `${today.slice(0, 7)}-01`, to: today };
    case "last_month": {
      const firstThis = `${today.slice(0, 7)}-01`;
      const last = addDays(firstThis, -1);
      return { from: `${last.slice(0, 7)}-01`, to: last };
    }
  }
}

export function matchPreset(from: string, to: string): PeriodId | null {
  const today = zonedToday();
  for (const id of PERIOD_ORDER) {
    const r = presetRange(id, today);
    if (r.from === from && r.to === to) return id;
  }
  return null;
}

/**
 * Periode dari query `from`/`to`; tidak sah (format, terbalik, > 92 hari, masa depan) → bawaan.
 */
export function resolvePeriod(qFrom: string, qTo: string, fallback: PeriodId = "7d") {
  const today = zonedToday();
  if (isDay(qFrom) && isDay(qTo) && qFrom <= qTo && qTo <= today && spanDays(qFrom, qTo) <= MAX_DAYS) {
    return { from: qFrom, to: qTo, preset: matchPreset(qFrom, qTo), isDefault: false };
  }
  const r = presetRange(fallback, today);
  return { ...r, preset: fallback as PeriodId | null, isDefault: true };
}
