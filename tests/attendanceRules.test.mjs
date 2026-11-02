// Tes unit aturan absensi web pemilik: toleransi telat `null` (= telat tidak dihitung, 2026-11-02), simpan tidak
// menimpa `null` maupun `shift_rules.patterns`, dan aturan efektif shift tetap > Jam kerja global.
// Kontrak: sissi-pos-service/docs/api.md "Skema pengaturan bisnis" & "Aturan efektif per karyawan per tanggal".
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { mergeSection, readAttendance, readShiftPatterns } = await import("../src/lib/owner/settings.ts");
const { computeRecap, dayPlan, evaluateClockIn } = await import("../src/lib/owner/team.ts");
const { planFor } = await import("../src/lib/owner/leavePlan.ts");

const BASE = { work_start: "08:00", work_end: "17:00", late_tolerance_min: 10, off_days: [7] };
// 2026-11-02 = Senin, 2026-11-03 = Selasa, 2026-11-08 = Minggu.
const MON = "2026-11-02";
const TUE = "2026-11-03";
const SUN = "2026-11-08";

test("toleransi: kunci hilang → 10, null eksplisit → null, angka tetap", () => {
  assert.equal(readAttendance({}).late_tolerance_min, 10);
  assert.equal(readAttendance({ attendance: {} }).late_tolerance_min, 10);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: "x" } }).late_tolerance_min, 10);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: null } }).late_tolerance_min, null);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: 0 } }).late_tolerance_min, 0);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: 15 } }).late_tolerance_min, 15);
});

test("simpan aturan absensi mempertahankan null, shift_rules.patterns, & kunci lain", () => {
  const stored = {
    attendance: { work_start: "09:00", work_end: "18:00", late_tolerance_min: null, off_days: [6, 7], extra: 1 },
    shift_rules: { templates: [{ id: "pagi", name: "Pagi", start: "07:00", end: "15:00" }], patterns: { e1: { 1: ["pagi"] } }, max_hours: 12 },
    timezone: "Asia/Makassar",
  };
  const draft = readAttendance(stored);
  const saved = mergeSection(stored, "attendance", { ...draft, work_end: "19:00" });
  assert.equal(saved.attendance.late_tolerance_min, null);
  assert.ok("late_tolerance_min" in saved.attendance);
  assert.equal(saved.attendance.extra, 1);
  assert.equal(saved.attendance.work_end, "19:00");
  assert.deepEqual(saved.shift_rules, stored.shift_rules);
  assert.equal(saved.timezone, "Asia/Makassar");
  // Bolak-balik JSON: null tetap null (tidak berubah jadi 10).
  assert.equal(readAttendance(JSON.parse(JSON.stringify(saved))).late_tolerance_min, null);
});

test("evaluateClockIn: toleransi null = tidak pernah telat; angka tetap seperti biasa", () => {
  const none = { ...BASE, late_tolerance_min: null };
  assert.deepEqual(evaluateClockIn(none, MON, 12 * 60), { status: "ontime", late_minutes: 0 });
  assert.deepEqual(evaluateClockIn(none, MON, 8 * 60 + 1), { status: "ontime", late_minutes: 0 });
  assert.deepEqual(evaluateClockIn(BASE, MON, 8 * 60 + 10), { status: "ontime", late_minutes: 0 });
  assert.deepEqual(evaluateClockIn(BASE, MON, 8 * 60 + 11), { status: "late", late_minutes: 11 });
  assert.deepEqual(evaluateClockIn({ ...BASE, late_tolerance_min: 0 }, MON, 8 * 60 + 1), { status: "late", late_minutes: 1 });
  assert.deepEqual(evaluateClockIn(BASE, SUN, 12 * 60), { status: "ontime", late_minutes: 0 });
});

const SETTINGS = {
  shift_rules: {
    templates: [
      { id: "pagi", name: "Pagi", start: "07:00", end: "15:00" },
      { id: "sore", name: "Sore", start: "15:00", end: "23:00" },
      { id: "malam", name: "Malam", start: "22:00", end: "06:00" },
      { id: "rusak", name: "Rusak", start: "25:00", end: "06:00" },
    ],
    patterns: { e1: { 1: ["sore", "pagi"], 2: ["malam"], 3: ["hilang"], 4: [], 7: ["pagi"] }, e2: "rusak" },
  },
};

test("dayPlan: shift tetap > Jam kerja global; libur, gabungan, lewat tengah malam, id hilang", () => {
  const shifts = readShiftPatterns(SETTINGS);
  assert.equal(shifts.templates.length, 3);
  // Tanpa shift tetap → global.
  assert.deepEqual(dayPlan(BASE, MON), { off: false, start: 480, end: 1020, source: "global" });
  assert.deepEqual(dayPlan(BASE, SUN, shifts, "e9"), { off: true, start: 480, end: 1020, source: "global" });
  assert.equal(dayPlan(BASE, MON, shifts, "e2").source, "global");
  // Senin Pagi + Sore → 07:00–23:00.
  assert.deepEqual(dayPlan(BASE, MON, shifts, "e1"), { off: false, start: 420, end: 1380, source: "pattern" });
  // Selasa Malam → selesai esok hari 06:00.
  assert.deepEqual(dayPlan(BASE, TUE, shifts, "e1"), { off: false, start: 1320, end: 1800, source: "pattern" });
  // Rabu: semua id hilang → global.
  assert.equal(dayPlan(BASE, "2026-11-04", shifts, "e1").source, "global");
  // Kamis daftar kosong & Jumat tanpa kunci → libur.
  assert.equal(dayPlan(BASE, "2026-11-05", shifts, "e1").off, true);
  assert.equal(dayPlan(BASE, "2026-11-06", shifts, "e1").off, true);
  // Minggu (libur global) tetapi shift tetap Pagi → kerja.
  assert.equal(dayPlan(BASE, SUN, shifts, "e1").off, false);
  // Telat dihitung dari jam mulai shift.
  assert.deepEqual(evaluateClockIn(BASE, MON, 7 * 60 + 20, dayPlan(BASE, MON, shifts, "e1")), { status: "late", late_minutes: 20 });
  assert.deepEqual(evaluateClockIn({ ...BASE, late_tolerance_min: null }, MON, 7 * 60 + 20, dayPlan(BASE, MON, shifts, "e1")).status, "ontime");
});

test("computeRecap & planFor memakai hari libur efektif", () => {
  const shifts = readShiftPatterns(SETTINGS);
  const planOf = (d) => dayPlan(BASE, d, shifts, "e1");
  const days = ["2026-11-05", "2026-11-06", SUN];
  const recap = computeRecap(days, [], BASE, "2026-11-30", null, planOf);
  assert.deepEqual(recap.days.map((d) => d.kind), ["off", "off", "absent"]);
  // Tanpa planOf → global: Kamis/Jumat alpa, Minggu libur.
  assert.deepEqual(computeRecap(days, [], BASE, "2026-11-30", null).days.map((d) => d.kind), ["absent", "absent", "off"]);
  const req = { id: "l1", employee_id: "e1", outlet_id: null, kind: "sick", date_from: "2026-11-05", date_to: SUN };
  const plan = planFor(req, [], (d) => planOf(d).off);
  assert.deepEqual(plan.offDays, ["2026-11-05", "2026-11-06", "2026-11-07"]);
  assert.deepEqual(plan.written, [SUN]);
});
