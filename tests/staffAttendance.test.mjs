// Tes unit web karyawan (absen): label "via" (tabel kontrak api.md "Absen karyawan lewat web"), pemetaan galat,
// jam server, bulan riwayat, tombol berikutnya, dan pengaman `next`. Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { missingLocation, viaLabel, viaSummary, viaText } = await import("../src/lib/attendanceVia.ts");
const { acceptErrorMessage, clockErrorMessage, detailNumber, detailText, formatDistance, isNetworkError, lateAsk, lateAskText, loginErrorMessage } = await import("../src/lib/staff/errors.ts");
const { clockOffset, formatDateLong, formatTime, monthOptions, nextStep, safeStaffNext, zonedClock, zonedDate } = await import("../src/lib/staff/clock.ts");

const IN = "2026-11-02T01:05:00Z";
const OUT = "2026-11-02T10:02:00Z";
const GEO = { lat: -6.2, lng: 106.8, accuracy_m: 12, distance_m: 20, outside_area: false, mocked: false };

test("viaLabel per jam mengikuti tabel kontrak; null → dari source baris", () => {
  assert.equal(viaLabel("self", "pin"), "Perangkat toko (PIN)");
  assert.equal(viaLabel("pin", "app"), "Aplikasi HP");
  assert.equal(viaLabel("pin", "web"), "Website");
  assert.equal(viaLabel("self", "manual"), "Dicatat pemilik");
  assert.equal(viaLabel("pin", null), "Perangkat toko (PIN)");
  assert.equal(viaLabel("self", null), "Aplikasi HP");
  assert.equal(viaLabel("manual", undefined), "Dicatat pemilik");
});

test("baris source pin yang pulangnya lewat website → keduanya ditampilkan, pulang tanpa lokasi", () => {
  const row = { source: "pin", clock_in_at: IN, clock_out_at: OUT, clock_in_via: "pin", clock_out_via: "web", clock_in_geo: null, clock_out_geo: null };
  assert.deepEqual(viaSummary(row), { label: "Masuk: Perangkat toko (PIN) · Pulang: Website", noLocation: true });
  // Dengan geo saat pulang → tanpa tanda (masuk PIN memang tanpa geo).
  assert.equal(viaSummary({ ...row, clock_out_geo: GEO }).noLocation, false);
});

test("masuk web & pulang app → keduanya; jalur sama → satu label; tanpa jam → null", () => {
  const row = { source: "self", clock_in_at: IN, clock_out_at: OUT, clock_in_via: "web", clock_out_via: "app", clock_in_geo: GEO, clock_out_geo: GEO };
  assert.deepEqual(viaSummary(row), { label: "Masuk: Website · Pulang: Aplikasi HP", noLocation: false });
  assert.equal(viaText({ ...row, clock_out_via: "web" }), "Website");
  assert.equal(viaText({ source: "pin", clock_in_at: IN, clock_out_at: null }), "Perangkat toko (PIN)");
  // Baris lama tanpa via, satu jalur dari source.
  assert.equal(viaText({ source: "manual", clock_in_at: IN, clock_out_at: OUT }), "Dicatat pemilik");
  assert.equal(viaSummary({ source: "manual", clock_in_at: null, clock_out_at: null }), null);
});

test("'tanpa lokasi' hanya untuk jam app/web (atau self lama) dengan geo null", () => {
  assert.equal(viaText({ source: "self", clock_in_at: IN, clock_out_at: null, clock_in_via: "web", clock_in_geo: null }), "Website · tanpa lokasi");
  assert.equal(missingLocation("self", null, null), true); // self lama
  assert.equal(missingLocation("pin", "app", null), true);
  assert.equal(missingLocation("self", "app", GEO), false);
  assert.equal(missingLocation("self", "pin", null), false);
  assert.equal(missingLocation("self", "manual", null), false);
  assert.equal(missingLocation("pin", null, null), false);
  assert.equal(missingLocation("manual", null, null), false);
  // Koreksi pemilik mengganti jam masuk → manual, tanpa tanda.
  assert.equal(viaSummary({ source: "self", clock_in_at: IN, clock_out_at: null, clock_in_via: "manual", clock_in_geo: null }).noLocation, false);
});

test("OUTSIDE_AREA menampilkan jarak bila ada; tanpa lokasi → minta izin lokasi", () => {
  const withDist = clockErrorMessage({ code: "OUTSIDE_AREA", details: [{ field: "distance_m", message: "1450" }] }, { action: "in", sentGeo: true });
  assert.match(withDist.text, /1,5 km/);
  const noGeo = clockErrorMessage({ code: "OUTSIDE_AREA", details: [{ field: "geo", message: "Wajib diisi" }] }, { action: "in", sentGeo: false });
  assert.match(noGeo.text, /Izinkan akses lokasi/);
  // Server menerima geo tetapi menandai field geo (mis. outlet tanpa lokasi) → tetap pesan lokasi.
  assert.equal(clockErrorMessage({ code: "OUTSIDE_AREA", details: [{ field: "geo", message: "x" }] }, { action: "out", sentGeo: true }).title, "Lokasi dibutuhkan");
  assert.equal(formatDistance(230), "230 m");
});

test("OUTSIDE_AREA_CONFIRM membawa jarak & batas untuk dialog", () => {
  const err = { code: "OUTSIDE_AREA_CONFIRM", details: [{ field: "distance_m", message: "340" }, { field: "radius_m", message: "100" }] };
  assert.equal(detailNumber(err, "distance_m"), 340);
  assert.equal(detailNumber(err, "radius_m"), 100);
  assert.equal(detailNumber({ code: "OUTSIDE_AREA_CONFIRM", details: [] }, "distance_m"), null);
  assert.equal(detailNumber({ code: "X", details: [{ field: "distance_m", message: "abc" }] }, "distance_m"), null);
});

test("kode galat absen → pesan Bahasa Indonesia", () => {
  const ctx = { action: "out", sentGeo: true };
  assert.equal(clockErrorMessage({ code: "ALREADY_CLOCKED" }, ctx).title, "Sudah absen pulang");
  assert.equal(clockErrorMessage({ code: "ALREADY_CLOCKED" }, { action: "in", sentGeo: false }).title, "Sudah absen masuk");
  assert.match(clockErrorMessage({ code: "NOT_CLOCKED_IN" }, ctx).text, /Absen masuk dulu/);
  assert.match(clockErrorMessage({ code: "ATTENDANCE_DAY_CLOSED" }, ctx).text, /izin, sakit, cuti, atau alpa/);
  assert.equal(clockErrorMessage({ code: "PRO_REQUIRED" }, ctx).title, "Fitur ini butuh Sissi Pro");
  assert.match(clockErrorMessage({ code: "FORBIDDEN" }, ctx).text, /outlet/);
  assert.match(clockErrorMessage({ code: "VALIDATION_ERROR", details: [{ field: "geo.lat", message: "x" }] }, ctx).text, /lokasi/);
  assert.match(clockErrorMessage({ code: "RATE_LIMITED", retryAfter: 90 }, ctx).text, /2 menit/);
  assert.match(clockErrorMessage({ code: "NETWORK_ERROR" }, ctx).text, /internet/);
  assert.equal(isNetworkError({ code: "TIMEOUT" }), true);
  assert.equal(isNetworkError({ code: "OUTSIDE_AREA" }), false);
});

test("galat login & aktivasi", () => {
  assert.match(loginErrorMessage({ code: "INVALID_CREDENTIALS" }).text, /salah/);
  assert.match(loginErrorMessage({ code: "EMPLOYEE_LOGIN_DISABLED" }).title, /belum diizinkan/);
  assert.equal(loginErrorMessage({ code: "STAFF_ONLY" }).title, "Ini akun pemilik");
  assert.equal(acceptErrorMessage({ code: "INVITE_INVALID" }).title, "Undangan tidak berlaku");
  assert.equal(acceptErrorMessage({ code: "VALIDATION_ERROR", details: [{ field: "password", message: "Minimal 8 karakter" }] }).text, "Minimal 8 karakter");
  assert.equal(loginErrorMessage("bukan galat").text, "Terjadi kesalahan. Coba lagi sebentar lagi.");
});

test("jam server: selisih memakai titik tengah permintaan; tampil di zona usaha", () => {
  const t0 = Date.parse("2026-11-02T01:00:00Z");
  // Server 90 detik lebih cepat; permintaan 400 ms.
  assert.equal(clockOffset("2026-11-02T01:01:30.200Z", t0, t0 + 400), 90_000);
  assert.equal(clockOffset("bukan tanggal", t0, t0), 0);
  assert.deepEqual(zonedClock(Date.parse("2026-11-02T01:05:09Z"), "Asia/Jakarta"), { hm: "08:05", s: "09" });
  assert.equal(formatTime(IN, "Asia/Makassar"), "09:05");
  assert.equal(formatTime(null, "Asia/Jakarta"), "—");
  assert.equal(zonedDate(Date.parse("2026-11-01T18:30:00Z"), "Asia/Jakarta"), "2026-11-02");
  assert.equal(formatDateLong("2026-11-02"), "Senin, 2 November 2026");
});

test("pilihan bulan: bulan ini + 12 sebelumnya, lintas tahun", () => {
  const m = monthOptions("2026-02");
  assert.equal(m.length, 13);
  assert.deepEqual(m.slice(0, 3), ["2026-02", "2026-01", "2025-12"]);
  assert.equal(m[12], "2025-02");
});

test("tombol berikutnya", () => {
  const date = "2026-11-02";
  const base = { id: "a", outlet_id: "o", outlet_name: "O", status: "ontime", late_minutes: 0, source: "self", clock_in_via: null, clock_out_via: null, clock_in_geo: null, clock_out_geo: null, note: "" };
  assert.deepEqual(nextStep({ date, attendance: null }), { kind: "in" });
  assert.deepEqual(nextStep({ date, attendance: { ...base, date, clock_in_at: IN, clock_out_at: null } }), { kind: "out", carried: false });
  assert.deepEqual(nextStep({ date, attendance: { ...base, date, clock_in_at: IN, clock_out_at: OUT } }), { kind: "done" });
  assert.deepEqual(nextStep({ date, attendance: { ...base, date: "2026-11-01", clock_in_at: IN, clock_out_at: null } }), { kind: "out", carried: true });
  assert.deepEqual(nextStep({ date, attendance: { ...base, date: "2026-11-01", clock_in_at: IN, clock_out_at: OUT } }), { kind: "in" });
  assert.deepEqual(nextStep({ date, attendance: { ...base, date, status: "sick", clock_in_at: null, clock_out_at: null } }), { kind: "closed", status: "sick" });
});

test("next hanya di bawah /karyawan (cegah open redirect)", () => {
  assert.equal(safeStaffNext("/karyawan/riwayat"), "/karyawan/riwayat");
  assert.equal(safeStaffNext("//evil.com"), "/karyawan");
  assert.equal(safeStaffNext("/dasbor"), "/karyawan");
  assert.equal(safeStaffNext("/karyawan/masuk"), "/karyawan");
  assert.equal(safeStaffNext("/karyawanx"), "/karyawan");
  assert.equal(safeStaffNext(null), "/karyawan");
});

test("LATE_CONFIRM: isi dialog dari details (nama shift, jam mulai, toleransi, menit telat)", () => {
  const err = {
    code: "LATE_CONFIRM",
    details: [
      { field: "late_minutes", message: "25" },
      { field: "shift_name", message: "Pagi" },
      { field: "shift_start", message: "08:00" },
      { field: "late_tolerance_min", message: "10" },
    ],
  };
  const a = lateAsk(err);
  assert.deepEqual(a, { minutes: 25, shiftName: "Pagi", shiftStart: "08:00", tolerance: 10 });
  assert.equal(lateAskText(a), "Shift Pagi mulai 08:00 (toleransi 10 menit). Kamu telat 25 mnt.");
  // details kosong (server lama/rusak) → tetap kalimat yang masuk akal.
  assert.equal(lateAskText(lateAsk({ code: "LATE_CONFIRM", details: [] })), "Kamu terlambat.");
  assert.match(clockErrorMessage(err, { action: "in", sentGeo: true }).text, /telat 25 mnt/);
});

test("UNSCHEDULED_CONFIRM: work_start dibaca sebagai teks; pesan cadangan menyebut tidak ada shift", () => {
  const err = { code: "UNSCHEDULED_CONFIRM", details: [{ field: "work_start", message: "08:00" }] };
  assert.equal(detailText(err, "work_start"), "08:00");
  assert.equal(detailText(err, "shift_name"), null);
  assert.match(clockErrorMessage(err, { action: "in", sentGeo: true }).title, /Tidak ada shift/);
});

test("VALIDATION_ERROR late_reason → pesan batas 200 karakter", () => {
  const m = clockErrorMessage({ code: "VALIDATION_ERROR", details: [{ field: "late_reason", message: "x" }] }, { action: "in", sentGeo: true });
  assert.match(m.text, /200 karakter/);
});

test("durationLabel bersama: < 60 → mnt; ≥ 60 → j + mnt; menit 0 → j saja; dialog telat ikut", async () => {
  const { durationLabel } = await import("../src/lib/duration.ts");
  assert.equal(durationLabel(25), "25 mnt");
  assert.equal(durationLabel(0), "0 mnt");
  assert.equal(durationLabel(59), "59 mnt");
  assert.equal(durationLabel(60), "1 j");
  assert.equal(durationLabel(120), "2 j");
  assert.equal(durationLabel(784), "13 j 4 mnt");
  assert.equal(durationLabel(-5), "0 mnt");
  assert.equal(lateAskText({ minutes: 784, shiftName: "Pagi", shiftStart: "07:00", tolerance: 10 }), "Shift Pagi mulai 07:00 (toleransi 10 menit). Kamu telat 13 j 4 mnt.");
});

test("OFF_DAY_CONFIRM: pesan cadangan hari libur", () => {
  const m = clockErrorMessage({ code: "OFF_DAY_CONFIRM" }, { action: "in", sentGeo: true });
  assert.equal(m.title, "Hari ini jadwalmu libur");
});
