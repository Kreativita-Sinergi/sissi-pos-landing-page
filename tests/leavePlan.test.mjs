// Tes unit logika persetujuan pengajuan (cermin tes app `leave_repository_test.dart` › "setujui").
// Kerangka: `node --test` bawaan Node (≥ 23.6 membaca .ts langsung dengan type stripping) — tanpa paket baru.
// Jalankan: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  APPROVED_EDIT_REASON,
  approvalChanges,
  leaveDayList,
  leaveDays,
  leaveRangeLabel,
  planFor,
  planLeaveApproval,
  skippedAny,
  weekdayOf,
} from "../src/lib/owner/leavePlan.ts";

const SUNDAY = [7];

test("libur dilewati & tanggal berjam masuk dilewati (kasus app: Sab 17 – Rab 21 Okt 2026)", () => {
  const request = { id: "l1", employee_id: "e1", outlet_id: "o2", kind: "sick", date_from: "2026-10-17", date_to: "2026-10-21" };
  const attendances = [
    // Selasa 20 Okt sudah absen masuk (PIN di perangkat toko).
    { id: "a20", employee_id: "e1", date: "2026-10-20", clock_in_at: "2026-10-20T01:00:00Z", outlet_id: "o1", updated_at: "x" },
    // Karyawan lain pada tanggal yang sama tidak berpengaruh.
    { id: "b19", employee_id: "e2", date: "2026-10-19", clock_in_at: "2026-10-19T01:00:00Z", outlet_id: "o1", updated_at: "x" },
  ];
  const plan = planFor(request, attendances, SUNDAY);
  assert.deepEqual(plan.written, ["2026-10-17", "2026-10-19", "2026-10-21"]);
  assert.deepEqual(plan.offDays, ["2026-10-18"]);
  assert.deepEqual(plan.clockedIn, ["2026-10-20"]);
  assert.equal(skippedAny(plan), true);
});

test("hari libur didahulukan dari jam masuk (urutan cek sama dengan app)", () => {
  const plan = planLeaveApproval(["2026-10-18"], () => true, () => true);
  assert.deepEqual(plan, { written: [], offDays: ["2026-10-18"], clockedIn: [] });
});

test("rentang lintas bulan & lintas tahun", () => {
  assert.deepEqual(leaveDays("2026-10-30", "2026-11-02"), ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
  assert.deepEqual(leaveDays("2026-12-31", "2027-01-01"), ["2026-12-31", "2027-01-01"]);
  // Libur Sabtu & Minggu: 31 Okt (Sab) dan 1 Nov (Min) dilewati.
  const plan = planFor(
    { id: "l", employee_id: "e1", outlet_id: null, kind: "leave", date_from: "2026-10-30", date_to: "2026-11-02" },
    [],
    [6, 7]
  );
  assert.deepEqual(plan.written, ["2026-10-30", "2026-11-02"]);
  assert.deepEqual(plan.offDays, ["2026-10-31", "2026-11-01"]);
  assert.equal(leaveRangeLabel("2026-10-30", "2026-11-02"), "30 Okt – 2 Nov 2026");
  assert.equal(leaveRangeLabel("2026-12-30", "2027-01-02"), "30 Des 2026 – 2 Jan 2027");
  assert.equal(leaveRangeLabel("2026-10-20", "2026-10-21"), "20–21 Okt 2026");
  assert.equal(leaveRangeLabel("2026-10-20", "2026-10-20"), "20 Okt 2026");
});

test("tanggal rusak / terbalik → tidak ada tanggal; hari ISO", () => {
  assert.deepEqual(leaveDays("2026-10-22", "2026-10-21"), []);
  assert.deepEqual(leaveDays("rusak", "2026-10-21"), []);
  assert.equal(weekdayOf("2026-10-18"), 7);
  assert.equal(weekdayOf("2026-10-19"), 1);
  assert.equal(leaveDayList(["2026-10-18", "2026-10-20"]), "Min 18 Okt, Sel 20 Okt");
});

test("satu kiriman: pengajuan dulu (berbasis), lalu absen manual per tanggal", async () => {
  const request = {
    id: "l1",
    employee_id: "e1",
    outlet_id: null,
    kind: "sick",
    date_from: "2026-10-17",
    date_to: "2026-10-19",
    updated_at: "2026-10-19T01:00:00.000Z",
  };
  // 19 Okt sudah ada baris tanpa jam masuk (mis. alpa manual) → ditimpa berbasis, outlet barisnya dipertahankan.
  const attendances = [{ id: "a19", employee_id: "e1", date: "2026-10-19", clock_in_at: null, outlet_id: "o9", updated_at: "u19" }];
  const plan = planFor(request, attendances, SUNDAY);
  const changes = await approvalChanges({
    request,
    plan,
    attendances,
    ownerId: "owner",
    note: "  Cepat sembuh ",
    decidedAt: "2026-10-20T03:00:00.000Z",
    fallbackOutlet: "o1",
    idFor: async (d) => `att:${d}`,
  });
  assert.equal(changes.length, 3);
  assert.deepEqual(changes[0], {
    entity: "leave_requests",
    op: "upsert",
    id: "l1",
    data: { status: "approved", decided_by: "owner", decided_at: "2026-10-20T03:00:00.000Z", decision_note: "Cepat sembuh" },
    base_updated_at: "2026-10-19T01:00:00.000Z",
  });
  const [, a17, a19] = changes;
  assert.equal(a17.id, "att:2026-10-17");
  assert.equal(a17.base_updated_at, undefined);
  assert.equal(a17.data.outlet_id, "o1");
  assert.equal(a19.id, "a19");
  assert.equal(a19.base_updated_at, "u19");
  assert.equal(a19.data.outlet_id, "o9");
  for (const a of [a17, a19]) {
    assert.equal(a.entity, "attendances");
    assert.equal(a.data.source, "manual");
    assert.equal(a.data.status, "sick");
    assert.equal(a.data.edit_reason, APPROVED_EDIT_REASON);
    assert.equal(a.data.edited_by, "owner");
    assert.equal(a.data.leave_request_id, changes[0].id);
    assert.equal(a.data.clock_in_at, null);
  }
});
