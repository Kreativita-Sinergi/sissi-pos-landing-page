// Tes unit aturan absensi web pemilik: telat tidak dihitung = `late_counting: false` tingkat atas (2026-11-03), simpan
// tidak menimpa `shift_patterns`, dan aturan efektif jadwal per tanggal (`shift_assignments`) > shift tetap > Jam kerja
// global.
// Kontrak: sissi-pos-service/docs/api.md "Skema pengaturan bisnis" & "Aturan efektif per karyawan per tanggal".
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { hasTimezone, loyaltyReturnText, mergeAttendance, readAttendance, readShiftPatterns } = await import("../src/lib/owner/settings.ts");
const { clockOutState, dueOutAt, latestClockInDate, openPreviousAttendance, computeRecap, computePayslip, dayPlan, evaluateClockIn, isOwnerOffDay, isUnscheduled, manualFlags, payItemLabel, planLabel, recapFor, shiftsUnassigned, toAssignments, toDefaultDays } = await import("../src/lib/owner/team.ts");
const { planFor } = await import("../src/lib/owner/leavePlan.ts");

const BASE = { work_start: "08:00", work_end: "17:00", late_tolerance_min: 10, off_days: [7] };
// 2026-11-02 = Senin, 2026-11-03 = Selasa, 2026-11-08 = Minggu.
const MON = "2026-11-02";
const TUE = "2026-11-03";
const SUN = "2026-11-08";

test("toleransi: angka; null/rusak → 10; late_counting false → null (tidak dihitung)", () => {
  assert.equal(readAttendance({}).late_tolerance_min, 10);
  assert.equal(readAttendance({ attendance: {} }).late_tolerance_min, 10);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: "x" } }).late_tolerance_min, 10);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: null } }).late_tolerance_min, 10);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: 15 }, late_counting: false }).late_tolerance_min, null);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: 0 } }).late_tolerance_min, 0);
  assert.equal(readAttendance({ attendance: { late_tolerance_min: 15 } }).late_tolerance_min, 15);
});

test("simpan: tidak dihitung → late_counting false + angka tetap; shift_patterns & kunci lain dipertahankan", () => {
  const stored = {
    attendance: { work_start: "09:00", work_end: "18:00", late_tolerance_min: 15, off_days: [6, 7], extra: 1 },
    shift_rules: { templates: [{ id: "pagi", name: "Pagi", start: "07:00", end: "15:00" }], max_hours: 12 },
    shift_patterns: { e1: { 1: ["pagi"] } },
    late_counting: false,
    timezone: "Asia/Makassar",
  };
  const draft = readAttendance(stored);
  assert.equal(draft.late_tolerance_min, null);
  const saved = mergeAttendance(stored, { ...draft, work_end: "19:00" });
  assert.equal(saved.attendance.late_tolerance_min, 15);
  assert.equal(saved.late_counting, false);
  assert.equal(saved.attendance.extra, 1);
  assert.equal(saved.attendance.work_end, "19:00");
  assert.deepEqual(saved.shift_rules, stored.shift_rules);
  assert.deepEqual(saved.shift_patterns, stored.shift_patterns);
  assert.equal(saved.timezone, "Asia/Makassar");
  assert.equal(readAttendance(JSON.parse(JSON.stringify(saved))).late_tolerance_min, null);
  // Diisi lagi → dihitung.
  const again = mergeAttendance(saved, { ...draft, late_tolerance_min: 5 });
  assert.equal(again.late_counting, true);
  assert.equal(again.attendance.late_tolerance_min, 5);
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
  },
  shift_patterns: { e1: { 1: ["sore", "pagi"], 2: ["malam"], 3: ["hilang"], 4: [], 7: ["pagi"] }, e2: "rusak" },
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

// Record `shift_assignments` mentah (bentuk pull `/owner/data/shift_assignments`).
const ASSIGN_ROWS = [
  { id: "a1", employee_id: "e1", date: MON, kind: "off", name: "", start: "", end: "", deleted_at: null }, // shift tetap → libur
  { id: "a2", employee_id: "e1", date: "2026-11-05", kind: "shift", name: "Malam", start: "22:00", end: "06:00", deleted_at: null },
  { id: "a3", employee_id: "e1", date: TUE, kind: "default", name: "", start: "", end: "", deleted_at: null }, // ikut shift tetap
  { id: "a4", employee_id: "e1", date: "2026-11-06", kind: "shift", name: "X", start: "", end: "", deleted_at: null }, // jam rusak
  { id: "a5", employee_id: "e1", date: "2026-11-07", kind: "off", name: "", start: "", end: "", deleted_at: "2026-11-01T00:00:00Z" },
  { id: "a6", employee_id: "e9", date: SUN, kind: "shift", name: "Pagi", start: "08:30", end: "16:00", deleted_at: null },
];

test("dayPlan: jadwal per tanggal > shift tetap > Jam kerja; default, jam rusak, & tombstone diabaikan", () => {
  const assignments = toAssignments(ASSIGN_ROWS);
  assert.deepEqual(Object.keys(assignments.e1).sort(), [MON, "2026-11-05", "2026-11-06"]);
  const shifts = { ...readShiftPatterns(SETTINGS), assignments };
  // Senin: shift tetap Pagi + Sore, tetapi dijadwalkan Libur.
  assert.deepEqual(dayPlan(BASE, MON, shifts, "e1"), { off: true, start: 480, end: 1020, source: "assignment" });
  // Selasa `default` → shift tetap Malam.
  assert.equal(dayPlan(BASE, TUE, shifts, "e1").source, "pattern");
  // Kamis: shift tetap libur, tetapi dijadwalkan Malam 22:00–06:00 (selesai esok hari).
  assert.deepEqual(dayPlan(BASE, "2026-11-05", shifts, "e1"), { off: false, start: 1320, end: 1800, source: "assignment", name: "Malam" });
  // Jumat: jam jadwal rusak → shift tetap (tanpa kunci = libur), seperti app.
  assert.deepEqual(dayPlan(BASE, "2026-11-06", shifts, "e1").source, "pattern");
  // Sabtu: tombstone → shift tetap.
  assert.equal(dayPlan(BASE, "2026-11-07", shifts, "e1").source, "pattern");
  // Minggu (libur global), tanpa shift tetap, tetapi dijadwalkan → kerja 08:30; telat dihitung dari 08:30.
  const sun = dayPlan(BASE, SUN, shifts, "e9");
  assert.deepEqual(sun, { off: false, start: 510, end: 960, source: "assignment", name: "Pagi" });
  assert.deepEqual(evaluateClockIn(BASE, SUN, 8 * 60 + 45, sun), { status: "late", late_minutes: 15 });
  assert.deepEqual(evaluateClockIn(BASE, MON, 12 * 60, dayPlan(BASE, MON, shifts, "e1")), { status: "ontime", late_minutes: 0 });
  // Label Tim.
  assert.equal(planLabel(dayPlan(BASE, MON, shifts, "e1")), "Libur");
  assert.equal(planLabel(dayPlan(BASE, "2026-11-05", shifts, "e1")), "Shift Malam 22:00–06:00");
  assert.equal(planLabel(dayPlan(BASE, TUE, shifts, "e1")), "Shift 22:00–06:00");
  assert.equal(planLabel(dayPlan(BASE, MON, shifts, "e9")), null);
  assert.equal(planLabel(dayPlan(BASE, "2026-11-07", shifts, "e9")), null);
});

test("recapFor & planFor menghormati jadwal per tanggal", () => {
  const shifts = { ...readShiftPatterns(SETTINGS), assignments: toAssignments(ASSIGN_ROWS) };
  const e1 = { id: "e1", created_at: "2026-10-01T00:00:00Z" };
  const data = { attendances: [], rules: BASE, shifts };
  const kinds = new Map(recapFor(e1, "2026-11", data, "2026-11-30").days.map((d) => [d.day, d.kind]));
  assert.equal(kinds.get(MON), "off"); // dijadwalkan libur → bukan alpa
  assert.equal(kinds.get("2026-11-05"), "absent"); // dijadwalkan kerja tanpa absen → alpa
  assert.equal(kinds.get(TUE), "absent"); // default → shift tetap Malam
  const req = { id: "l2", employee_id: "e1", outlet_id: null, kind: "leave", date_from: MON, date_to: "2026-11-05" };
  const plan = planFor(req, [], (d) => dayPlan(BASE, d, shifts, "e1").off);
  // Senin dijadwalkan libur → dilewati; Rabu (id shift tetap hilang → Jam kerja) & Kamis (dijadwalkan) ditulis.
  assert.deepEqual(plan.offDays, [MON]);
  assert.deepEqual(plan.written, [TUE, "2026-11-04", "2026-11-05"]);
});

// ——— Di luar jadwal (2026-11-11): hari tanpa catatan yang di luar jadwal = libur, bukan alpa ———

const UNSCHED_ROWS = [
  // e3 tanpa shift tetap: dijadwalkan shift Senin 2/11 & libur Jumat 13/11; Selasa 10/11 "Ikut jam kerja" (default).
  { id: "u1", employee_id: "e3", date: MON, kind: "shift", name: "Pagi", start: "08:00", end: "16:00", deleted_at: null },
  { id: "u2", employee_id: "e3", date: "2026-11-13", kind: "off", name: "", start: "", end: "", deleted_at: null },
  { id: "u3", employee_id: "e3", date: "2026-11-10", kind: "default", name: "", start: "", end: "", deleted_at: null },
  // Tombstone tidak menandai "memakai jadwal".
  { id: "u4", employee_id: "e4", date: MON, kind: "shift", name: "Pagi", start: "08:00", end: "16:00", deleted_at: "2026-11-01T00:00:00Z" },
];
// Tanpa templat (jendela ±7 hari yang menentukan); `withTemplates` = SETTINGS (templat + shift tetap e1).
const unschedShifts = (withTemplates = false) => ({
  ...(withTemplates ? readShiftPatterns(SETTINGS) : { templates: [], patterns: {} }),
  assignments: toAssignments(UNSCHED_ROWS),
  defaults: toDefaultDays(UNSCHED_ROWS),
});

test("isUnscheduled cermin server: jendela ±7 hari, default, shift tetap (id hilang), libur pola", () => {
  const sh = unschedShifts();
  assert.equal(isUnscheduled(TUE, sh, "e3"), true); // 3/11: shift 2/11 dalam 7 hari, tanpa baris
  assert.equal(isUnscheduled(MON, sh, "e3"), false); // dijadwalkan shift
  assert.equal(isUnscheduled("2026-11-10", sh, "e3"), false); // default = pilihan sengaja pemilik
  assert.equal(isUnscheduled("2026-11-20", sh, "e3"), true); // 13/11 (off) dalam 7 hari
  assert.equal(isUnscheduled("2026-11-21", sh, "e3"), false); // > 7 hari dari jadwal mana pun
  assert.equal(isUnscheduled("2026-10-26", sh, "e3"), true); // tepi periode: jadwal 2/11 bulan berikutnya ikut dibaca
  assert.equal(isUnscheduled(TUE, sh, "e4"), false); // hanya tombstone
  assert.equal(isUnscheduled(TUE, sh, "e9"), false); // tanpa jadwal sama sekali
  const st = unschedShifts(true);
  assert.equal(isUnscheduled("2026-11-04", st, "e1"), true); // shift tetap Rabu: semua templat hilang
  assert.equal(isUnscheduled("2026-11-05", st, "e1"), false); // shift tetap Kamis kosong = libur, bukan di luar jadwal
  assert.equal(isUnscheduled(MON, st, "e1"), false); // shift tetap berlaku
});

test("recap & gaji: di luar jadwal bukan alpa; ber-shift tanpa absen tetap alpa; tanpa jadwal tetap alpa", () => {
  const data = { attendances: [], rules: BASE, shifts: unschedShifts() };
  const kinds = (id) => new Map(recapFor({ id, created_at: "2026-10-01T00:00:00Z" }, "2026-11", data, "2026-11-30").days.map((d) => [d.day, d.kind]));
  const e3 = kinds("e3");
  assert.equal(e3.get(TUE), "off"); // di luar jadwal
  assert.equal(e3.get(MON), "absent"); // ber-shift tanpa absen
  assert.equal(e3.get("2026-11-10"), "absent"); // default → Jam kerja global, hari kerja
  const e9 = kinds("e9");
  assert.equal(e9.get(TUE), "absent"); // tanpa jadwal → aturan lama
  // Potongan "alpa × hari" mengikuti rekap.
  const recap = recapFor({ id: "e3", created_at: "2026-10-01T00:00:00Z" }, "2026-11", data, "2026-11-30");
  const absent = recap.days.filter((d) => d.kind === "absent").length;
  const slip = computePayslip({ type: "monthly", amount: 10_000_000, late_per_minute: 0, absent_per_day: 1000, allowance_per_day: 0, overtime_per_hour: 0 }, recap);
  const item = slip.items.find((i) => i.type === "absent");
  assert.equal(item?.quantity ?? 0, absent);
  assert.ok(!recap.days.some((d) => d.day === TUE && d.kind === "absent"));
});

test("isUnscheduled: bisnis dengan templat shift sah = memakai jadwal; urutan baris tanggal → pola → templat → ±7 hari", () => {
  const st = unschedShifts(true);
  assert.equal(isUnscheduled(TUE, st, "e9"), true); // tanpa pola & penugasan, tetapi templat ada
  assert.equal(isUnscheduled("2026-11-21", st, "e3"), true); // di luar jendela ±7, tetap karena templat
  assert.equal(isUnscheduled("2026-11-10", st, "e3"), false); // baris default menang
  assert.equal(isUnscheduled(MON, st, "e3"), false); // baris shift menang
  assert.equal(isUnscheduled("2026-11-05", st, "e1"), false); // pola libur menang atas templat
  // Templat rusak (jam tidak sah) dibuang `readShiftPatterns` → tidak dihitung.
  const broken = { ...readShiftPatterns({ shift_rules: { templates: [{ id: "x", name: "X", start: "25:00", end: "06:00" }] } }), assignments: {}, defaults: {} };
  assert.equal(isUnscheduled(TUE, broken, "e9"), false);
});

test("Jam kerja belum pernah disimpan → hari Jam kerja global tidak telat; shift tetap telat; simpan menulis attendance", () => {
  const unset = readAttendance({});
  assert.equal(unset.has_work_hours, false);
  assert.equal(unset.work_start, "08:00"); // nilai form tetap bawaan
  assert.equal(unset.late_tolerance_min, 10);
  assert.deepEqual(evaluateClockIn(unset, MON, 9 * 60), { status: "ontime", late_minutes: 0 });
  const shift = dayPlan(unset, MON, readShiftPatterns(SETTINGS), "e1"); // shift tetap Pagi + Sore (07:00)
  assert.equal(shift.source, "pattern");
  assert.deepEqual(evaluateClockIn(unset, MON, 7 * 60 + 25, shift), { status: "late", late_minutes: 25 });
  const set = readAttendance({ attendance: { work_start: "08:00" } });
  assert.equal(set.has_work_hours, true);
  assert.deepEqual(evaluateClockIn(set, MON, 9 * 60), { status: "late", late_minutes: 60 });
  const saved = mergeAttendance({}, unset);
  assert.ok(saved.attendance && typeof saved.attendance === "object");
  assert.equal("has_work_hours" in saved.attendance, false);
  assert.equal(readAttendance(saved).has_work_hours, true);
});

test("pengingat: templat ada, tanpa pola, tanpa penugasan shift di [hari ini−7, hari ini+14]", () => {
  const today = "2026-11-11";
  const tpl = readShiftPatterns({ shift_rules: { templates: [{ id: "p", name: "Pagi", start: "07:00", end: "15:00" }] } });
  const withRow = (date, kind = "shift") => ({ ...tpl, assignments: { e1: { [date]: { kind, name: "", start: "07:00", end: "15:00" } } } });
  assert.equal(shiftsUnassigned({ ...tpl, assignments: {} }, today), true);
  assert.equal(shiftsUnassigned(withRow("2026-11-04"), today), false); // −7
  assert.equal(shiftsUnassigned(withRow("2026-11-25"), today), false); // +14
  assert.equal(shiftsUnassigned(withRow("2026-11-03"), today), true); // −8: di luar rentang
  assert.equal(shiftsUnassigned(withRow("2026-11-26"), today), true); // +15
  assert.equal(shiftsUnassigned(withRow("2026-11-12", "off"), today), true); // libur bukan penugasan shift
  assert.equal(shiftsUnassigned({ ...tpl, patterns: { e1: { 1: ["p"] } }, assignments: {} }, today), false); // ada pola
  assert.equal(shiftsUnassigned({ templates: [], patterns: {}, assignments: {} }, today), false); // tanpa templat
});

test("absen manual: di luar jadwal → ontime + unscheduled; status lain false; koreksi mempertahankan tanda & alasan", () => {
  // evaluateClockIn dengan tanda di luar jadwal: tidak pernah telat.
  assert.deepEqual(evaluateClockIn(BASE, MON, 13 * 60, dayPlan(BASE, MON), true), { status: "ontime", late_minutes: 0 });
  assert.deepEqual(manualFlags("ontime", true, null), { unscheduled: true, late_reason: "" });
  assert.deepEqual(manualFlags("late", true, null), { unscheduled: false, late_reason: "" });
  assert.deepEqual(manualFlags("sick", true, null), { unscheduled: false, late_reason: "" });
  // Koreksi baris yang sudah di luar jadwal & tetap ontime → tetap true (walau tanggal kini berjadwal).
  assert.deepEqual(manualFlags("ontime", false, { status: "ontime", unscheduled: true, late_reason: "" }), { unscheduled: true, late_reason: "" });
  assert.deepEqual(manualFlags("permit", false, { status: "ontime", unscheduled: true, late_reason: "" }), { unscheduled: false, late_reason: "" });
  // Alasan telat baris lama: dipertahankan bila tetap late, dikosongkan bila tidak.
  const lateRow = { status: "late", unscheduled: false, late_reason: "Ban bocor" };
  assert.equal(manualFlags("late", false, lateRow).late_reason, "Ban bocor");
  assert.equal(manualFlags("ontime", false, lateRow).late_reason, "");
  assert.equal(manualFlags("ontime", false, lateRow).unscheduled, false);
  // Format durasi bersama di slip.
  assert.equal(payItemLabel({ type: "late", amount: 0, quantity: 784, rate: 0 }, "monthly"), "Terlambat · 13 j 4 mnt");
});

test("absen manual di hari libur pemilik → bertanda di luar jadwal; libur Minggu bawaan tanpa Jam kerja → tanpa tanda", () => {
  const shifts = { ...readShiftPatterns(SETTINGS), assignments: toAssignments(ASSIGN_ROWS) };
  const unset = readAttendance({});
  const set = readAttendance({ attendance: { work_start: "08:00", off_days: [7] } });
  assert.equal(isOwnerOffDay(dayPlan(unset, MON, shifts, "e1"), unset), true); // jadwal off
  assert.equal(isOwnerOffDay(dayPlan(unset, "2026-11-05", readShiftPatterns(SETTINGS), "e1"), unset), true); // libur di shift tetap
  assert.equal(isOwnerOffDay(dayPlan(set, SUN, null, "e9"), set), true); // off_days Jam kerja tersimpan
  assert.equal(isOwnerOffDay(dayPlan(unset, SUN, null, "e9"), unset), false); // Minggu bawaan
  assert.equal(isOwnerOffDay(dayPlan(set, TUE, null, "e9"), set), false); // hari kerja
  // Hasil simpan: ontime + unscheduled.
  assert.deepEqual(manualFlags("ontime", true, null), { unscheduled: true, late_reason: "" });
});

// ——— Jam kerja belum disimpan: alpa & lembur (koreksi audit 2026-11-11) ———

const at = (day, hm) => {
  const [y, m, d] = day.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 7, mi)).toISOString(); // WIB
};
const row = (day, inHm, outHm) => ({ date: day, status: "ontime", late_minutes: 0, clock_in_at: at(day, inHm), clock_out_at: at(day, outHm) });

test("tanpa Jam kerja: hari Jam kerja global tanpa catatan bukan alpa; jam pulang tidak menghasilkan lembur (tahap 2)", () => {
  const unset = readAttendance({});
  const set = readAttendance({ attendance: { work_start: "08:00", work_end: "17:00", off_days: [7] } });
  const days = [MON, TUE, "2026-11-04"];
  // Tanpa catatan.
  assert.deepEqual(computeRecap(days, [], unset, "2026-11-30", null).days.map((d) => d.kind), ["upcoming", "upcoming", "upcoming"]);
  assert.deepEqual(computeRecap(days, [], set, "2026-11-30", null).days.map((d) => d.kind), ["absent", "absent", "absent"]);
  // Hari ber-shift (jadwal per tanggal) tetap alpa walau Jam kerja belum disimpan.
  const shifts = { templates: [], patterns: {}, assignments: { e1: { [MON]: { kind: "shift", name: "Pagi", start: "08:00", end: "16:00" } } } };
  const planOf = (d) => dayPlan(unset, d, shifts, "e1");
  assert.deepEqual(computeRecap([MON, TUE], [], unset, "2026-11-30", null, planOf).days.map((d) => d.kind), ["absent", "upcoming"]);
  // Tahap 2: pulang 19:00 tidak menghasilkan lembur di aturan mana pun.
  const work = [row(TUE, "08:00", "19:00")];
  assert.equal(computeRecap([TUE], work, unset, "2026-11-30", null).overtime_minutes, 0);
  assert.equal(computeRecap([TUE], work, set, "2026-11-30", null).overtime_minutes, 0);
  assert.equal(computeRecap([MON], [row(MON, "08:00", "19:00")], unset, "2026-11-30", null, planOf).overtime_minutes, 0);
  // Menit biasa: tanpa jam selesai (unset) = masuk … pulang (660); dengan jam selesai 17:00 = 540; shift 16:00 = 480.
  assert.equal(computeRecap([TUE], work, unset, "2026-11-30", null).regular_minutes, 660);
  assert.equal(computeRecap([TUE], work, set, "2026-11-30", null).regular_minutes, 540);
  assert.equal(computeRecap([MON], [row(MON, "08:00", "19:00")], unset, "2026-11-30", null, planOf).regular_minutes, 480);
  // Potongan alpa slip ikut rekap.
  const pay = { type: "monthly", amount: 3_000_000, late_per_minute: 0, absent_per_day: 50_000, allowance_per_day: 0, overtime_per_hour: 0 };
  assert.equal(computePayslip(pay, computeRecap(days, [], unset, "2026-11-30", null)).items.some((i) => i.type === "absent"), false);
  assert.equal(computePayslip(pay, computeRecap(days, [], set, "2026-11-30", null)).items.find((i) => i.type === "absent").quantity, 3);
});

test("gaji: lembur disetujui × tarif lembur; per jam tarif lembur 0 → tarif per jam; harian/bulanan tarif 0 → tidak dibayar", () => {
  const recap = { days: [], late_minutes: 0, worked_minutes: 600, regular_minutes: 480, overtime_minutes: 120, missed_clock_out: 0 };
  const hourly = { type: "hourly", amount: 20_000, late_per_minute: 0, absent_per_day: 0, allowance_per_day: 0 };
  // regular 480 + lembur disetujui 120.
  const noOt = computePayslip({ ...hourly, overtime_per_hour: 0 }, recap);
  assert.deepEqual(noOt.items, [
    { type: "base", amount: 160_000, quantity: 480, rate: 20_000 },
    { type: "overtime", amount: 40_000, quantity: 120, rate: 20_000 },
  ]);
  const ot = computePayslip({ ...hourly, overtime_per_hour: 30_000 }, recap);
  assert.deepEqual(ot.items, [
    { type: "base", amount: 160_000, quantity: 480, rate: 20_000 },
    { type: "overtime", amount: 60_000, quantity: 120, rate: 30_000 },
  ]);
  const monthly = { type: "monthly", amount: 3_000_000, late_per_minute: 0, absent_per_day: 0, allowance_per_day: 0 };
  assert.deepEqual(computePayslip({ ...monthly, overtime_per_hour: 0 }, recap).items, [{ type: "base", amount: 3_000_000, quantity: 0, rate: 0 }]);
  assert.equal(computePayslip({ ...monthly, overtime_per_hour: 25_000 }, recap).items.find((i) => i.type === "overtime").amount, 50_000);
  assert.equal(payItemLabel({ type: "overtime", amount: 45_000, quantity: 90, rate: 30_000 }, "hourly"), "Lembur · 1 j 30 mnt × Rp 30.000/jam");
});

test("zona waktu kosong = belum dipilih; nilai balik loyalti efektif", () => {
  assert.equal(hasTimezone({}), false);
  assert.equal(hasTimezone({ timezone: "" }), false);
  assert.equal(hasTimezone({ timezone: "Asia/Makassar" }), true);
  assert.equal(loyaltyReturnText(1, 100), "≈ 10% belanja kembali ke pelanggan");
  assert.equal(loyaltyReturnText(1, 15), "≈ 1,5% belanja kembali ke pelanggan");
  assert.equal(loyaltyReturnText(2, 1), "≈ 0,2% belanja kembali ke pelanggan");
  assert.equal(loyaltyReturnText(Number.NaN, 100), null);
});

// ——— Absen pulang terlupa (tahap 1) ———

const WED = "2026-11-04";
const openRow = (day, inHm, extra = {}) => ({ employee_id: "e1", date: day, status: "ontime", late_minutes: 0, clock_in_at: at(day, inHm), clock_out_at: null, ...extra });

test("dueOutAt & clockOutState: jam selesai aturan efektif; Bekerja / Belum / Tidak absen pulang / Selesai", () => {
  const set = readAttendance({ attendance: { work_start: "08:00", work_end: "17:00", off_days: [7] } });
  const unset = readAttendance({});
  assert.equal(dueOutAt({ date: TUE }, dayPlan(set, TUE), set), Date.parse(at(TUE, "17:00")));
  assert.equal(dueOutAt({ date: TUE }, dayPlan(unset, TUE), unset), null); // Jam kerja belum disimpan
  assert.equal(dueOutAt({ date: SUN }, dayPlan(set, SUN), set), null); // libur
  const night = { templates: [], patterns: {}, assignments: { e1: { [MON]: { kind: "shift", name: "Malam", start: "22:00", end: "06:00" } } } };
  assert.equal(dueOutAt({ date: MON }, dayPlan(unset, MON, night, "e1"), unset), Date.parse(at(TUE, "06:00"))); // esok hari
  const due = Date.parse(at(TUE, "17:00"));
  const r = openRow(TUE, "08:00");
  assert.equal(clockOutState(r, due, TUE, Date.parse(at(TUE, "16:59"))), "working");
  assert.equal(clockOutState(r, due, TUE, Date.parse(at(TUE, "17:00"))), "due");
  assert.equal(clockOutState(r, null, TUE, Date.parse(at(WED, "12:00"))), "working"); // tanpa jam selesai
  assert.equal(clockOutState(r, due, WED, Date.parse(at(WED, "09:00"))), "missed");
  assert.equal(clockOutState({ ...r, clock_out_at: at(TUE, "17:05") }, due, WED), "done");
  assert.equal(clockOutState({ ...r, status: "sick", clock_in_at: null }, due, WED), null);
});

test("openPreviousAttendance: absen terbuka sebelumnya tanpa absen masuk sesudahnya (≤ 31 hari)", () => {
  const today = WED;
  assert.equal(openPreviousAttendance([openRow(MON, "08:00")], "e1", today)?.date, MON);
  assert.equal(openPreviousAttendance([openRow(MON, "08:00"), openRow(TUE, "08:00", { clock_out_at: at(TUE, "17:00") })], "e1", today), null);
  assert.equal(openPreviousAttendance([openRow("2026-10-01", "08:00")], "e1", today), null); // > 31 hari
  assert.equal(openPreviousAttendance([openRow(MON, "08:00")], "e2", today), null);
  assert.equal(latestClockInDate([openRow(MON, "08:00"), openRow(TUE, "08:00")], "e1"), TUE);
});

test("rekap & gaji per jam: menit biasa dibatasi jam selesai; Tidak/Belum absen pulang sampai jam selesai, 0 tanpa", () => {
  const set = readAttendance({ attendance: { work_start: "08:00", work_end: "17:00", off_days: [7] } });
  const unset = readAttendance({});
  const hourly = { type: "hourly", amount: 20_000, late_per_minute: 0, absent_per_day: 0, allowance_per_day: 0 };
  const opts = { now: Date.parse(at("2026-11-05", "12:00")) };
  // Pulang 19:00 (jam selesai 17:00): kerja 660, biasa 540; tanpa lembur disetujui = tanpa lembur.
  const late = computeRecap([TUE], [row(TUE, "08:00", "19:00")], set, "2026-11-30", null, undefined, undefined, opts);
  assert.equal(late.worked_minutes, 660);
  assert.equal(late.regular_minutes, 540);
  assert.equal(late.overtime_minutes, 0);
  assert.deepEqual(computePayslip({ ...hourly, overtime_per_hour: 30_000 }, late).items, [{ type: "base", amount: 180_000, quantity: 540, rate: 20_000 }]);
  // Lembur disetujui 90 menit di tanggal itu (di luar periode tidak dihitung).
  const withOt = computeRecap([TUE], [row(TUE, "08:00", "19:00")], set, "2026-11-30", null, undefined, undefined, {
    ...opts,
    overtimeByDay: new Map([[TUE, 90], ["2026-12-01", 60]]),
  });
  assert.equal(withOt.overtime_minutes, 90);
  assert.equal(withOt.days[0].overtime, 90);
  assert.deepEqual(computePayslip({ ...hourly, overtime_per_hour: 30_000 }, withOt).items, [
    { type: "base", amount: 180_000, quantity: 540, rate: 20_000 },
    { type: "overtime", amount: 45_000, quantity: 90, rate: 30_000 },
  ]);
  assert.deepEqual(computePayslip({ ...hourly, overtime_per_hour: 0 }, withOt).items, [
    { type: "base", amount: 180_000, quantity: 540, rate: 20_000 },
    { type: "overtime", amount: 30_000, quantity: 90, rate: 20_000 },
  ]);
  // Tidak absen pulang (masuk lagi Rabu): sampai 17:00 = 540, tanpa lembur, terhitung di rekap.
  const missed = computeRecap([TUE, WED], [openRow(TUE, "08:00"), row(WED, "08:00", "17:00")], set, "2026-11-30", null, undefined, undefined, opts);
  assert.equal(missed.missed_clock_out, 1);
  assert.equal(missed.regular_minutes, 540 + 540);
  assert.equal(missed.overtime_minutes, 0);
  // Belum absen pulang (lewat jam selesai, belum masuk lagi): 540; masih bekerja (sebelum jam selesai): 0.
  const due = computeRecap([TUE], [openRow(TUE, "08:00")], set, "2026-11-30", null, undefined, undefined, opts);
  assert.equal(due.regular_minutes, 540);
  assert.equal(due.missed_clock_out, 0);
  const working = computeRecap([TUE], [openRow(TUE, "08:00")], set, "2026-11-30", null, undefined, undefined, { now: Date.parse(at(TUE, "12:00")) });
  assert.equal(working.regular_minutes, 0);
  // Tanpa jam selesai (Jam kerja belum disimpan, tanpa shift): Tidak absen pulang → 0.
  const none = computeRecap([TUE, WED], [openRow(TUE, "08:00"), row(WED, "08:00", "17:00")], unset, "2026-11-30", null, undefined, undefined, opts);
  assert.equal(none.missed_clock_out, 1);
  assert.equal(none.regular_minutes, 540); // hanya Rabu
});
