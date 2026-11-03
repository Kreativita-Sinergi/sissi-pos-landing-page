// Tes unit absen manual web: shift malam (selesai ≤ mulai) dengan jam masuk lewat tengah malam = esok hari (D+1),
// telat dihitung dari jam mulai shift, jam pulang relatif jam masuk; dan keterangan kartu "Kehadiran hari ini" per
// karyawan (bukan Jam kerja global saja).
// Cermin app: `manual_attendance_sheet.dart` `_inAt`/`_outAt`, `attendance.dart` `evaluateClockIn(day:)`,
// `attendance_today.dart` `_ClockCard`.
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { readShiftPatterns } = await import("../src/lib/owner/settings.ts");
const { dayPlan, evaluateClockIn, manualClockMinutes, todayHoursLabel, zonedAt } = await import("../src/lib/owner/team.ts");

const BASE = { work_start: "08:00", work_end: "17:00", late_tolerance_min: 10, off_days: [7] };
// 2026-11-02 = Senin, 2026-11-03 = Selasa, 2026-11-08 = Minggu.
const MON = "2026-11-02";
const TUE = "2026-11-03";
const SUN = "2026-11-08";

const SHIFTS = readShiftPatterns({
  shift_rules: {
    templates: [
      { id: "pagi", name: "Pagi", start: "07:00", end: "15:00" },
      { id: "malam", name: "Malam", start: "22:00", end: "06:00" },
    ],
  },
  shift_patterns: { e1: { 2: ["malam"] }, e2: { 2: ["pagi"] }, e3: { 2: ["malam"] } },
});

test("absen manual shift malam: masuk 00:30 = D+1, telat 150 menit dari 22:00", () => {
  const plan = dayPlan(BASE, TUE, SHIFTS, "e1");
  assert.deepEqual(plan, { off: false, start: 1320, end: 1800, source: "pattern" });
  const at = manualClockMinutes(plan, 30, null);
  assert.deepEqual(at, { inAt: 1470, outAt: null });
  assert.deepEqual(evaluateClockIn(BASE, TUE, at.inAt, plan), { status: "late", late_minutes: 150 });
  // Timestamp = D+1 00:30 lokal (selisih tepat 1 hari dari D 00:30); `date` tetap D.
  assert.equal(zonedAt(TUE, at.inAt) - zonedAt(TUE, 30), 86_400_000);
  assert.equal(zonedAt(TUE, at.inAt), zonedAt("2026-11-04", 30));
});

test("absen manual shift malam: jam pulang relatif jam masuk", () => {
  const plan = dayPlan(BASE, TUE, SHIFTS, "e1");
  // Masuk 22:05 (D) tepat waktu; pulang 06:00 → D+1.
  assert.deepEqual(manualClockMinutes(plan, 22 * 60 + 5, 360), { inAt: 1325, outAt: 1800 });
  assert.deepEqual(evaluateClockIn(BASE, TUE, 1325, plan), { status: "ontime", late_minutes: 0 });
  // Masuk 00:30 (D+1), pulang 06:00 → D+1 06:00.
  assert.deepEqual(manualClockMinutes(plan, 30, 360), { inAt: 1470, outAt: 1800 });
  // Jam masuk ≥ jam selesai shift (mis. 07:00) → tetap hari D.
  assert.equal(manualClockMinutes(plan, 7 * 60, null).inAt, 420);
  // Pulang sebelum jam masuk walau digeser sehari → tetap lebih kecil (ditolak formulir).
  const early = manualClockMinutes(plan, 30, 20);
  assert.ok(early.outAt < early.inAt);
});

test("absen manual shift siang & hari libur: jam masuk tidak digeser", () => {
  const day = dayPlan(BASE, MON);
  assert.deepEqual(manualClockMinutes(day, 30, null), { inAt: 30, outAt: null });
  // Pulang lebih awal dari masuk = esok hari (relatif jam masuk).
  assert.deepEqual(manualClockMinutes(day, 8 * 60, 7 * 60), { inAt: 480, outAt: 1860 });
  assert.deepEqual(manualClockMinutes(day, 8 * 60, 17 * 60), { inAt: 480, outAt: 1020 });
  const off = dayPlan(BASE, SUN);
  assert.equal(off.off, true);
  assert.equal(manualClockMinutes({ ...off, start: 1320, end: 1800 }, 30, null).inAt, 30);
});

const emp = (id, role = "cashier", is_active = true) => ({ id, role, is_active });

test("kartu Kehadiran hari ini: libur hanya bila tidak ada yang bekerja; jam sama / beda per shift", () => {
  // Tanpa karyawan → Jam kerja global.
  assert.equal(todayHoursLabel(BASE, MON, SHIFTS, []), "Jam kerja 08:00–17:00");
  assert.equal(todayHoursLabel(BASE, SUN, SHIFTS, []), "Hari libur");
  // Pemilik & nonaktif tidak dihitung.
  assert.equal(todayHoursLabel(BASE, SUN, SHIFTS, [emp("o", "owner"), emp("x", "cashier", false)]), "Hari libur");
  // Semua shift malam → jam yang sama.
  assert.equal(todayHoursLabel(BASE, TUE, SHIFTS, [emp("e1"), emp("e3")]), "Jam kerja 22:00–06:00");
  // Malam + pagi → beda per shift.
  assert.equal(todayHoursLabel(BASE, TUE, SHIFTS, [emp("e1"), emp("e2")]), "Jam kerja beda per shift");
  // Senin: e1–e3 libur menurut shift tetap, e9 ikut global → kerja (bukan "Hari libur").
  assert.equal(todayHoursLabel(BASE, MON, SHIFTS, [emp("e1"), emp("e9")]), "Jam kerja 08:00–17:00");
  assert.equal(todayHoursLabel(BASE, MON, SHIFTS, [emp("e1"), emp("e2")]), "Hari libur");
  // Minggu libur global, tetapi ada jadwal tanggal itu → kerja.
  const withAssign = { ...SHIFTS, assignments: { e9: { [SUN]: { kind: "shift", name: "Lembur", start: "10:00", end: "14:00" } } } };
  assert.equal(todayHoursLabel(BASE, SUN, withAssign, [emp("e9"), emp("e1")]), "Jam kerja 10:00–14:00");
});
