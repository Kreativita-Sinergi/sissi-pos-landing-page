// Menyusun jadwal shift dari dasbor pemilik (Tim › Jadwal) — setara app (api.md "Jadwal shift per karyawan" &
// "Kelola data › Jadwal shift per karyawan"):
//  - shift tetap mingguan = `business_settings.shift_patterns` (kunci tingkat atas) — cermin `shift_pattern_sheet.dart`;
//  - pengecualian per tanggal = entitas `shift_assignments` (id deterministik) — cermin `shift_schedule_repository.dart`.
// Aturan efektif (urutan sumber) tetap di `dayPlan` (team.ts).

import { pushChanges } from "./api";
import { recordData } from "./records";
import type { AttendanceRules, Obj, ShiftTemplateLite } from "./settings";
import { dayPlan, isoWeekday, outcome, parseClockMinutes, shiftAssignmentIdFor, type ShiftSchedule, type TeamOutcome } from "./team";
import type { Change, SyncRecord } from "./types";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

// ——— Tanggal & label hari ———

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
export const WEEKDAY_SHORT = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
export const WEEKDAY_LONG = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function addDays(day: string, n: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Senin minggu `day` (`mondayOf` app). */
export const mondayOf = (day: string) => addDays(day, 1 - isoWeekday(day));

/** Tujuh tanggal Senin…Minggu mulai `monday`. */
export const weekOf = (monday: string) => WEEKDAYS.map((_, i) => addDays(monday, i));

const dayNum = (day: string) => Number(day.slice(8, 10));
const monthOfDay = (day: string) => MONTH_SHORT[Number(day.slice(5, 7)) - 1];

/** "2–8 Nov 2026" / "30 Nov – 6 Des 2026" / "29 Des 2026 – 4 Jan 2027". */
export function weekLabel(monday: string): string {
  const sun = addDays(monday, 6);
  const [y1, y2] = [monday.slice(0, 4), sun.slice(0, 4)];
  if (y1 !== y2) return `${dayNum(monday)} ${monthOfDay(monday)} ${y1} – ${dayNum(sun)} ${monthOfDay(sun)} ${y2}`;
  if (monday.slice(5, 7) !== sun.slice(5, 7)) return `${dayNum(monday)} ${monthOfDay(monday)} – ${dayNum(sun)} ${monthOfDay(sun)} ${y2}`;
  return `${dayNum(monday)}–${dayNum(sun)} ${monthOfDay(sun)} ${y2}`;
}

/** "Sen 2" (kepala kolom). */
export const dayShortLabel = (day: string) => `${WEEKDAY_SHORT[isoWeekday(day) - 1]} ${dayNum(day)}`;
/** "Senin, 2 Nov" (judul lembar sel). */
export const dayLongLabel = (day: string) => `${WEEKDAY_LONG[isoWeekday(day) - 1]}, ${dayNum(day)} ${monthOfDay(day)}`;

// ——— Shift tetap (`shift_patterns`) ———

/** Hari ISO ("1".."7") → id templat. Hari tanpa kunci / daftar kosong = libur. */
export type PatternWeek = Record<string, string[]>;

const hhmm = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/**
 * Shift sah hari itu (urut jam mulai) + rentang gabungan (mulai paling awal → selesai paling akhir; selesai ≤ mulai =
 * esok hari). `null` bila tidak ada id templat yang masih ada.
 */
export function patternSpan(ids: string[], templates: ShiftTemplateLite[]): { names: string; start: string; end: string } | null {
  const byId = new Map(templates.map((t) => [t.id, t]));
  const spans = ids.flatMap((id) => {
    const t = byId.get(id);
    const s = t ? parseClockMinutes(t.start) : null;
    const e = t ? parseClockMinutes(t.end) : null;
    return t && s !== null && e !== null ? [{ name: t.name, s, e: e <= s ? e + 1440 : e }] : [];
  });
  if (spans.length === 0) return null;
  spans.sort((a, b) => a.s - b.s);
  return {
    names: spans.map((x) => x.name).join(" + "),
    start: hhmm(Math.min(...spans.map((x) => x.s))),
    end: hhmm(Math.max(...spans.map((x) => x.e))),
  };
}

/** "Pagi + Sore · 07:00–23:00" — `shiftPatternDayLabel`; `null` bila semua templat sudah dihapus. */
export function patternDayLabel(ids: string[], templates: ShiftTemplateLite[]): string | null {
  const s = patternSpan(ids, templates);
  return s ? `${s.names} · ${s.start}–${s.end}` : null;
}

/** Pasang shift terpilih (urut daftar shift) di hari-hari terpilih — `_apply` app. */
export function applyPattern(week: PatternWeek, templates: ShiftTemplateLite[], pick: string[], days: number[]): PatternWeek {
  if (pick.length === 0 || days.length === 0) return week;
  const ordered = templates.filter((t) => pick.includes(t.id)).map((t) => t.id);
  const next = { ...week };
  for (const d of days) next[String(d)] = [...ordered];
  return next;
}

/** "Jadikan libur" satu hari. */
export function makeOff(week: PatternWeek, day: number): PatternWeek {
  const next = { ...week };
  delete next[String(day)];
  return next;
}

export const isAllOff = (week: PatternWeek) => WEEKDAYS.every((d) => (week[String(d)] ?? []).length === 0);

/**
 * Pengaturan bisnis baru dengan shift tetap satu karyawan diganti (`week`) atau dihapus (`null` = ikut Jam kerja).
 * Kunci karyawan lain dan kunci pengaturan lain dipertahankan apa adanya (pola `mergeAttendance`).
 */
export function mergeShiftPatterns(settings: unknown, employeeId: string, week: PatternWeek | null): Obj {
  const s: Obj = isObj(settings) ? { ...settings } : {};
  const all: Obj = isObj(s.shift_patterns) ? { ...s.shift_patterns } : {};
  if (week === null) delete all[employeeId];
  else {
    const clean: Record<string, string[]> = {};
    for (const d of WEEKDAYS) {
      const ids = (week[String(d)] ?? []).filter((x) => typeof x === "string" && x);
      if (ids.length > 0) clean[String(d)] = [...ids];
    }
    all[employeeId] = clean;
  }
  return { ...s, shift_patterns: all };
}

/** Simpan shift tetap satu karyawan (`business_settings`, id = id usaha). */
export async function saveShiftPatterns(
  rec: SyncRecord | null,
  businessId: string,
  employeeId: string,
  week: PatternWeek | null
): Promise<TeamOutcome> {
  const data = { ...recordData(rec), settings: mergeShiftPatterns(rec?.settings, employeeId, week) };
  const id = rec?.id ?? businessId;
  const [r] = await pushChanges([
    rec ? { entity: "business_settings", op: "upsert", id, data, base_updated_at: rec.updated_at } : { entity: "business_settings", op: "upsert", id, data },
  ]);
  return outcome(r);
}

// ——— Pengecualian per tanggal (`shift_assignments`) ———

/** Pilihan satu sel: shift dari daftar, Libur, atau "Ikut shift tetap/Jam kerja" (`kind: "default"`). */
export type ShiftChoice = { kind: "shift"; template: ShiftTemplateLite } | { kind: "off" } | { kind: "default" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Field data record: jam & nama = salinan templat; `template_id` hanya bila berbentuk UUID (kolom server UUID). */
export function assignmentData(employeeId: string, date: string, choice: ShiftChoice): Record<string, unknown> {
  if (choice.kind === "shift") {
    const t = choice.template;
    return {
      employee_id: employeeId,
      date,
      kind: "shift",
      template_id: UUID_RE.test(t.id) ? t.id.toLowerCase() : null,
      name: t.name.trim().slice(0, 30),
      start: t.start,
      end: t.end,
    };
  }
  return { employee_id: employeeId, date, kind: choice.kind, template_id: null, name: "", start: "", end: "" };
}

/** Baris jadwal (belum dihapus) karyawan pada tanggal itu. */
export function findAssignment(records: SyncRecord[], employeeId: string, date: string): SyncRecord | null {
  return (
    records.find((r) => !r.deleted_at && r.employee_id === employeeId && typeof r.date === "string" && r.date.slice(0, 10) === date) ?? null
  );
}

/** Isi sama (tidak perlu ditulis ulang) — `sameAs` app. Tanpa baris = sama dengan `default`. */
export function sameChoice(rec: SyncRecord | null, choice: ShiftChoice): boolean {
  const kind = rec ? rec.kind : "default";
  if (choice.kind === "shift") {
    return kind === "shift" && rec?.name === choice.template.name && rec?.start === choice.template.start && rec?.end === choice.template.end;
  }
  if (choice.kind === "off") return kind === "off";
  return kind !== "shift" && kind !== "off";
}

/** Perubahan `/owner/changes` untuk satu sel; `null` bila isinya tidak berubah. */
export async function assignmentChange(
  businessId: string,
  employeeId: string,
  date: string,
  choice: ShiftChoice,
  existing: SyncRecord | null
): Promise<Change | null> {
  if (sameChoice(existing, choice)) return null;
  const id = existing?.id ?? (await shiftAssignmentIdFor(businessId, employeeId, date));
  const data = assignmentData(employeeId, date, choice);
  return existing
    ? { entity: "shift_assignments", op: "upsert", id, data, base_updated_at: existing.updated_at }
    : { entity: "shift_assignments", op: "upsert", id, data };
}

/** Simpan satu sel jadwal; `null` bila tidak ada yang berubah. */
export async function saveShiftAssignment(
  businessId: string,
  employeeId: string,
  date: string,
  choice: ShiftChoice,
  existing: SyncRecord | null
): Promise<TeamOutcome | null> {
  const ch = await assignmentChange(businessId, employeeId, date, choice, existing);
  if (!ch) return null;
  const [r] = await pushChanges([ch]);
  return outcome(r);
}

// ——— Tampilan sel ———

/** `exception` oranye (pengecualian tanggal), `pattern` hitam (shift tetap), `off` libur shift tetap, `global` abu. */
export type CellTone = "exception" | "pattern" | "off" | "global";
export type CellView = { title: string; sub: string | null; tone: CellTone };

/** Isi sel jadwal — cermin `_CellText` app. */
export function cellView(rules: AttendanceRules, day: string, shifts: ShiftSchedule, employeeId: string): CellView {
  const plan = dayPlan(rules, day, shifts, employeeId);
  const range = `${hhmm(plan.start)}–${hhmm(plan.end)}`;
  if (plan.source === "assignment") {
    return plan.off ? { title: "Libur", sub: null, tone: "exception" } : { title: plan.name || "Shift", sub: range, tone: "exception" };
  }
  if (plan.source === "pattern") {
    if (plan.off) return { title: "Libur", sub: null, tone: "off" };
    const ids = shifts.patterns[employeeId]?.[String(isoWeekday(day))] ?? [];
    return { title: patternSpan(ids, shifts.templates)?.names ?? "Shift", sub: range, tone: "pattern" };
  }
  return { title: "Jam kerja", sub: plan.off ? "Libur" : range, tone: "global" };
}

/**
 * Keterangan pilihan "kosongkan" di lembar sel: ikut shift tetap bila karyawan punya shift tetap, selain itu Jam
 * kerja (cermin `_pickCell` app).
 */
export function fallbackOption(rules: AttendanceRules, day: string, shifts: ShiftSchedule, employeeId: string): { label: string; hint: string } {
  const withoutException: ShiftSchedule = { ...shifts, assignments: {} };
  const plan = dayPlan(rules, day, withoutException, employeeId);
  const range = `${hhmm(plan.start)}–${hhmm(plan.end)}`;
  if (plan.source === "pattern") {
    const ids = shifts.patterns[employeeId]?.[String(isoWeekday(day))] ?? [];
    return { label: "Ikut shift tetap", hint: plan.off ? "Libur" : (patternDayLabel(ids, shifts.templates) ?? range) };
  }
  const hasPattern = !!shifts.patterns[employeeId];
  return {
    label: hasPattern ? "Ikut shift tetap" : "Ikut jam kerja",
    hint: plan.off ? "Libur mingguan (jam kerja)" : `Jam kerja ${range}`,
  };
}
