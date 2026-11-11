// Tes unit lembur tahap 2 (api.md "Lembur"): bentuk record, urutan daftar, validasi "Catat lembur", kiriman
// keputusan/catat pemilik, dan gaji dari lembur disetujui lewat recapFor. Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const P = await import("../src/lib/owner/overtimePlan.ts");
const { overtimeDecisionChange, ownerOvertimeChange } = await import("../src/lib/owner/overtime.ts");
const { computePayslip, recapFor } = await import("../src/lib/owner/team.ts");

const base = { id: "o1", updated_at: "2026-11-10T13:00:00Z", deleted_at: null, created_at: "2026-11-10T13:00:00Z", employee_id: "e1", date: "2026-11-10", minutes: 90, reason: "Stok opname", source: "employee", status: "pending" };
const NOW = "2026-11-11T05:00:00Z";

test("toOvertime menormalkan record; urutan: menunggu dulu lalu terbaru", () => {
  const r = P.toOvertime({ ...base, minutes: 90.7, outlet_id: "", decided_by: null });
  assert.equal(r.minutes, 90);
  assert.equal(r.outlet_id, null);
  assert.equal(r.decision_note, "");
  const list = [
    P.toOvertime({ ...base, id: "a", status: "approved", created_at: "2026-11-11T00:00:00Z" }),
    P.toOvertime({ ...base, id: "b", status: "pending", created_at: "2026-11-01T00:00:00Z" }),
    P.toOvertime({ ...base, id: "c", status: "pending", created_at: "2026-11-05T00:00:00Z" }),
  ].sort(P.overtimeOrder);
  assert.deepEqual(list.map((x) => x.id), ["c", "b", "a"]);
});

test("approvedOvertimeByDay: hanya approved, per karyawan, dijumlah per tanggal", () => {
  const list = [
    { ...base, id: "1", status: "approved", minutes: 60 },
    { ...base, id: "2", status: "approved", minutes: 30 },
    { ...base, id: "3", status: "pending", minutes: 120 },
    { ...base, id: "4", status: "cancelled", minutes: 120 },
    { ...base, id: "5", status: "approved", minutes: 45, employee_id: "e2" },
  ].map(P.toOvertime);
  assert.deepEqual([...P.approvedOvertimeByDay(list, "e1")], [["2026-11-10", 90]]);
});

test("validasi Catat lembur: karyawan, tanggal hari ini … −62, durasi 1–1440, alasan ≤ 300", () => {
  const today = "2026-11-11";
  const ok = { employeeId: "e1", date: today, hours: 1, minutes: 30, reason: "" };
  assert.deepEqual(P.validateOwnerOvertime(ok, today), {});
  assert.deepEqual(Object.keys(P.validateOwnerOvertime({ ...ok, employeeId: null }, today)), ["employee"]);
  assert.deepEqual(P.validateOwnerOvertime({ ...ok, date: "2026-09-10" }, today), {}); // tepat −62
  assert.ok(P.validateOwnerOvertime({ ...ok, date: "2026-09-09" }, today).date); // −63
  assert.ok(P.validateOwnerOvertime({ ...ok, date: "2026-11-12" }, today).date); // besok
  assert.ok(P.validateOwnerOvertime({ ...ok, hours: 0, minutes: 0 }, today).minutes);
  assert.deepEqual(P.validateOwnerOvertime({ ...ok, hours: 24, minutes: 0 }, today), {}); // 1440
  assert.ok(P.validateOwnerOvertime({ ...ok, hours: 24, minutes: 1 }, today).minutes);
  assert.ok(P.validateOwnerOvertime({ ...ok, minutes: 60 }, today).minutes);
  assert.ok(P.validateOwnerOvertime({ ...ok, reason: "x".repeat(301) }, today).reason);
  assert.equal(P.overtimeMinutes(1, 30), 90);
});

test("kiriman keputusan: setujui/tolak dari pending, batalkan dari approved (alasan wajib), base_updated_at", () => {
  const pending = P.toOvertime(base);
  assert.deepEqual(overtimeDecisionChange(pending, "approve", "own", " Oke ", NOW), {
    entity: "overtime_requests",
    op: "upsert",
    id: "o1",
    data: { status: "approved", decided_by: "own", decided_at: NOW, decision_note: "Oke" },
    base_updated_at: base.updated_at,
  });
  assert.equal(overtimeDecisionChange(pending, "reject", "own", "", NOW).data.status, "rejected");
  assert.equal(typeof overtimeDecisionChange(pending, "cancel", "own", "x", NOW), "string"); // belum disetujui
  const approved = P.toOvertime({ ...base, status: "approved" });
  assert.equal(overtimeDecisionChange(approved, "cancel", "own", "  ", NOW), "Tulis alasan pembatalan.");
  assert.equal(overtimeDecisionChange(approved, "cancel", "own", "Salah tanggal", NOW).data.status, "cancelled");
  assert.match(overtimeDecisionChange(pending, "approve", "own", "x".repeat(201), NOW), /200 karakter/);
});

test("kiriman Catat lembur pemilik: source owner, approved, decided_by/at", () => {
  const c = ownerOvertimeChange({ employeeId: "e1", outletId: null, date: "2026-11-10", minutes: 90, reason: " Opname ", ownerId: "own" }, "new-id", NOW);
  assert.deepEqual(c.data, { employee_id: "e1", outlet_id: null, date: "2026-11-10", minutes: 90, reason: "Opname", source: "owner", status: "approved", decided_by: "own", decided_at: NOW, decision_note: "" });
  assert.equal(c.id, "new-id");
  assert.equal("base_updated_at" in c, false);
});

test("recapFor + gaji: lembur disetujui di bulan itu saja × tarif lembur; pending/di bulan lain tidak", () => {
  const rules = { work_start: "08:00", work_end: "17:00", late_tolerance_min: 10, off_days: [7], has_work_hours: true };
  const e = { id: "e1", created_at: "2026-10-01T00:00:00Z" };
  const overtime = [
    { ...base, id: "a", status: "approved", minutes: 90, date: "2026-11-10" },
    { ...base, id: "b", status: "approved", minutes: 30, date: "2026-11-03" },
    { ...base, id: "c", status: "pending", minutes: 600, date: "2026-11-04" },
    { ...base, id: "d", status: "approved", minutes: 60, date: "2026-10-31" },
  ].map(P.toOvertime);
  const recap = recapFor(e, "2026-11", { attendances: [], rules, shifts: { templates: [], patterns: {} }, overtime }, "2026-11-30");
  assert.equal(recap.overtime_minutes, 120);
  assert.equal(recap.days.find((d) => d.day === "2026-11-10").overtime, 90);
  const daily = { type: "daily", amount: 150_000, late_per_minute: 0, absent_per_day: 0, allowance_per_day: 0, overtime_per_hour: 25_000 };
  assert.deepEqual(computePayslip(daily, recap).items.find((i) => i.type === "overtime"), { type: "overtime", amount: 50_000, quantity: 120, rate: 25_000 });
  assert.equal(computePayslip({ ...daily, overtime_per_hour: 0 }, recap).items.some((i) => i.type === "overtime"), false);
});
