// Tes unit penyusun jadwal shift web pemilik (Tim › Jadwal): gabung `shift_patterns` tanpa menimpa kunci lain, id
// deterministik `shift_assignments` (= app `shiftAssignmentIdFor`), dan payload pengecualian per tanggal.
// Kontrak: sissi-pos-service/docs/api.md "Jadwal shift per karyawan" & "Kelola data › Jadwal shift per karyawan".
// Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const S = await import("../src/lib/owner/shiftSchedule.ts");
const { readShiftPatterns } = await import("../src/lib/owner/settings.ts");
const { mergeRecord, shiftAssignmentIdFor, toAssignments } = await import("../src/lib/owner/team.ts");

const BIZ = "11111111-1111-4111-8111-111111111111";
const EMP = "22222222-2222-4222-8222-222222222222";
const PAGI = { id: "aaaaaaaa-0000-4000-8000-000000000001", name: "Pagi", start: "07:00", end: "15:00" };
const SORE = { id: "aaaaaaaa-0000-4000-8000-000000000002", name: "Sore", start: "15:00", end: "23:00" };
const MALAM = { id: "malam", name: "Malam", start: "22:00", end: "06:00" };
const TEMPLATES = [PAGI, SORE, MALAM];
const BASE = { work_start: "08:00", work_end: "17:00", late_tolerance_min: 10, off_days: [7] };

test("id deterministik = UUIDv5(URL, sissi-shift-assignment:biz:emp:date) — sama dengan app & server", async () => {
  // Acuan: Python uuid.uuid5(uuid.NAMESPACE_URL, ...) (sama dengan Go uuid.NewSHA1 & Dart Uuid().v5).
  assert.equal(await shiftAssignmentIdFor(BIZ, EMP, "2026-11-04"), "ee40b19f-9811-5621-9771-dfa5f1434dc7");
  assert.notEqual(await shiftAssignmentIdFor(BIZ, EMP, "2026-11-05"), "ee40b19f-9811-5621-9771-dfa5f1434dc7");
});

test("gabung shift_patterns: hanya kunci karyawan ini diganti; karyawan lain & pengaturan lain utuh", () => {
  const stored = {
    timezone: "Asia/Jakarta",
    attendance: { work_start: "08:00" },
    late_counting: false,
    shift_rules: { templates: TEMPLATES, max_hours: 14 },
    shift_patterns: { other: { 1: ["x"], 9: ["kunci lama"] }, [EMP]: { 1: [PAGI.id] } },
  };
  const next = S.mergeShiftPatterns(stored, EMP, { 2: [PAGI.id, SORE.id], 3: [], 5: [SORE.id] });
  assert.deepEqual(next.shift_patterns[EMP], { 2: [PAGI.id, SORE.id], 5: [SORE.id] }); // hari kosong dibuang (= libur)
  assert.deepEqual(next.shift_patterns.other, stored.shift_patterns.other);
  for (const k of ["timezone", "attendance", "late_counting", "shift_rules"]) assert.deepEqual(next[k], stored[k]);
  assert.deepEqual(stored.shift_patterns[EMP], { 1: [PAGI.id] }, "masukan tidak diubah");

  // Hapus shift tetap → kunci karyawan dibuang, lainnya tetap.
  const removed = S.mergeShiftPatterns(stored, EMP, null);
  assert.equal(EMP in removed.shift_patterns, false);
  assert.deepEqual(removed.shift_patterns.other, stored.shift_patterns.other);
  // Tanpa pengaturan sama sekali.
  assert.deepEqual(S.mergeShiftPatterns(undefined, EMP, { 1: [PAGI.id] }), { shift_patterns: { [EMP]: { 1: [PAGI.id] } } });
  // Semua hari libur tetap disimpan sebagai kunci kosong (≠ ikut Jam kerja).
  assert.deepEqual(S.mergeShiftPatterns({}, EMP, {}).shift_patterns[EMP], {});
});

test("Terapkan: urut daftar shift, Setiap hari, Jadikan libur, label gabungan", () => {
  let week = S.applyPattern({}, TEMPLATES, [SORE.id, PAGI.id], [1, 3]);
  assert.deepEqual(week, { 1: [PAGI.id, SORE.id], 3: [PAGI.id, SORE.id] });
  week = S.applyPattern(week, TEMPLATES, [MALAM.id], [...S.WEEKDAYS]);
  assert.equal(Object.keys(week).length, 7);
  assert.deepEqual(S.applyPattern(week, TEMPLATES, [], [1]), week, "tanpa shift → tidak berubah");
  week = S.makeOff(week, 7);
  assert.equal("7" in week, false);
  assert.equal(S.isAllOff({ 1: [] }), true);
  assert.equal(S.patternDayLabel([SORE.id, PAGI.id], TEMPLATES), "Pagi + Sore · 07:00–23:00");
  assert.equal(S.patternDayLabel([PAGI.id, MALAM.id], TEMPLATES), "Pagi + Malam · 07:00–06:00");
  assert.equal(S.patternDayLabel(["hilang"], TEMPLATES), null);
});

test("payload pengecualian: shift = salinan jam templat; off/default kosong; template_id UUID saja", () => {
  assert.deepEqual(S.assignmentData(EMP, "2026-11-04", { kind: "shift", template: PAGI }), {
    employee_id: EMP, date: "2026-11-04", kind: "shift", template_id: PAGI.id, name: "Pagi", start: "07:00", end: "15:00",
  });
  // Id templat bukan UUID (kolom server UUID) → null; jam tetap disalin.
  assert.equal(S.assignmentData(EMP, "2026-11-04", { kind: "shift", template: MALAM }).template_id, null);
  for (const kind of ["off", "default"]) {
    assert.deepEqual(S.assignmentData(EMP, "2026-11-04", { kind }), {
      employee_id: EMP, date: "2026-11-04", kind, template_id: null, name: "", start: "", end: "",
    });
  }
});

test("perubahan sel: baru tanpa base (id deterministik), ubah dengan base_updated_at, sama → tidak dikirim", async () => {
  const id = await shiftAssignmentIdFor(BIZ, EMP, "2026-11-04");
  const fresh = await S.assignmentChange(BIZ, EMP, "2026-11-04", { kind: "off" }, null);
  assert.deepEqual(fresh, { entity: "shift_assignments", op: "upsert", id, data: S.assignmentData(EMP, "2026-11-04", { kind: "off" }) });
  assert.equal(await S.assignmentChange(BIZ, EMP, "2026-11-04", { kind: "default" }, null), null, "kosong → kosong");

  const row = { id, employee_id: EMP, date: "2026-11-04", kind: "shift", template_id: PAGI.id, name: "Pagi", start: "07:00", end: "15:00", updated_at: "2026-11-03T01:02:03.456Z", deleted_at: null };
  assert.equal(await S.assignmentChange(BIZ, EMP, "2026-11-04", { kind: "shift", template: PAGI }, row), null);
  const toDefault = await S.assignmentChange(BIZ, EMP, "2026-11-04", { kind: "default" }, row);
  assert.equal(toDefault.base_updated_at, row.updated_at);
  assert.equal(toDefault.data.kind, "default");
  // Jam templat berubah sejak dijadwalkan → dikirim ulang dengan jam baru.
  const moved = await S.assignmentChange(BIZ, EMP, "2026-11-04", { kind: "shift", template: { ...PAGI, start: "08:00" } }, row);
  assert.equal(moved.data.start, "08:00");

  assert.equal(S.findAssignment([row], EMP, "2026-11-04"), row);
  assert.equal(S.findAssignment([{ ...row, deleted_at: "2026-11-03T00:00:00Z" }], EMP, "2026-11-04"), null);
});

test("sel jadwal: warna sumber (pengecualian > shift tetap > Jam kerja) + opsi kosongkan", () => {
  const settings = { shift_rules: { templates: TEMPLATES }, shift_patterns: { [EMP]: { 1: [PAGI.id, SORE.id], 2: [MALAM.id] } } };
  const rows = [{ id: "r1", employee_id: EMP, date: "2026-11-04", kind: "off", name: "", start: "", end: "", updated_at: "x", deleted_at: null }];
  const shifts = { ...readShiftPatterns(settings), assignments: toAssignments(rows) };
  assert.deepEqual(S.cellView(BASE, "2026-11-02", shifts, EMP), { title: "Pagi + Sore", sub: "07:00–23:00", tone: "pattern" });
  assert.deepEqual(S.cellView(BASE, "2026-11-04", shifts, EMP), { title: "Libur", sub: null, tone: "exception" });
  assert.deepEqual(S.cellView(BASE, "2026-11-05", shifts, EMP), { title: "Libur", sub: null, tone: "off" });
  assert.deepEqual(S.cellView(BASE, "2026-11-02", shifts, "lain"), { title: "Jam kerja", sub: "08:00–17:00", tone: "global" });
  assert.deepEqual(S.cellView(BASE, "2026-11-08", shifts, "lain"), { title: "Jam kerja", sub: "Libur", tone: "global" });
  assert.deepEqual(S.fallbackOption(BASE, "2026-11-04", shifts, EMP), { label: "Ikut shift tetap", hint: "Libur" });
  assert.deepEqual(S.fallbackOption(BASE, "2026-11-02", shifts, EMP), { label: "Ikut shift tetap", hint: "Pagi + Sore · 07:00–23:00" });
  assert.deepEqual(S.fallbackOption(BASE, "2026-11-02", shifts, "lain"), { label: "Ikut jam kerja", hint: "Jam kerja 08:00–17:00" });
});

test("mergeRecord: hasil simpan jadwal & shift tetap langsung tampil", () => {
  const data = {
    employees: [], attendances: [], payslips: [], leaves: [], outlets: [], rules: BASE,
    shifts: { templates: TEMPLATES, patterns: {}, assignments: {} },
    settingsRecord: { id: BIZ, settings: {}, updated_at: "a", deleted_at: null },
    assignmentRecords: [],
  };
  const row = { id: "r1", employee_id: EMP, date: "2026-11-04", kind: "shift", name: "Pagi", start: "07:00", end: "15:00", updated_at: "b", deleted_at: null };
  const a = mergeRecord(data, "shift_assignments", row);
  assert.equal(a.shifts.assignments[EMP]["2026-11-04"].name, "Pagi");
  const b = mergeRecord(a, "shift_assignments", { ...row, kind: "default", name: "", start: "", end: "", updated_at: "c" });
  assert.equal(b.assignmentRecords.length, 1);
  assert.equal(b.shifts.assignments[EMP], undefined);
  const settings = { shift_rules: { templates: TEMPLATES }, shift_patterns: { [EMP]: { 1: [PAGI.id] } } };
  const c = mergeRecord(b, "business_settings", { id: BIZ, settings, updated_at: "d", deleted_at: null });
  assert.deepEqual(c.shifts.patterns[EMP], { 1: [PAGI.id] });
  assert.equal(c.settingsRecord.updated_at, "d");
  assert.deepEqual(c.assignmentRecords, b.assignmentRecords);
});

test("minggu: Senin, label rentang", () => {
  assert.equal(S.mondayOf("2026-11-08"), "2026-11-02");
  assert.equal(S.mondayOf("2026-11-02"), "2026-11-02");
  assert.deepEqual(S.weekOf("2026-11-02").at(-1), "2026-11-08");
  assert.equal(S.weekLabel("2026-11-02"), "2–8 Nov 2026");
  assert.equal(S.weekLabel("2026-11-30"), "30 Nov – 6 Des 2026");
  assert.equal(S.weekLabel("2026-12-28"), "28 Des 2026 – 3 Jan 2027");
  assert.equal(S.dayShortLabel("2026-11-04"), "Rab 4");
  assert.equal(S.dayLongLabel("2026-11-04"), "Rabu, 4 Nov");
});
