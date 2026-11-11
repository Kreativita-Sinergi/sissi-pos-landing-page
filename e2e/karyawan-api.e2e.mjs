#!/usr/bin/env node
// Uji gabungan NYATA web karyawan (absen) ↔ sissi-pos-service — tanpa mode tiruan. Hanya jalan bila E2E_API_URL & E2E_DB_URL
// diset (DB dev lokal saja: data uji disiapkan lewat SQL). Prasyarat:
//   1. API: PORT=8080 STAFF_WEB_ORIGINS=http://localhost:3000 OWNER_WEB_ORIGINS=http://localhost:3000 go run ./cmd/api
//      (APP_ENV=development, data devseed: akun Pro demo.pro@contoh.sissi.id dengan karyawan Rani & Bayu).
//   2. Web: NEXT_PUBLIC_API_BASE_URL=http://localhost:8080/api/v1 npx next dev -p 3000 (STAFF/OWNER_MOCK bukan 1).
//   3. Chrome sistem (atau CHROME_PATH).
//
//   E2E_API_URL=http://localhost:8080/api/v1 E2E_DB_URL=postgres://localhost:5432/sissi_dev npm run e2e:karyawan-api
//
// Persiapan (diulang tiap run): Rani & Bayu diberi no. HP + akses akun pribadi, absen kemarin/hari ini mereka dihapus,
// sesi web dicabut. Pengaturan lokasi absen outlet dikembalikan di akhir.
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const API = (process.env.E2E_API_URL || "").replace(/\/$/, "");
const DB = process.env.E2E_DB_URL || "";
if (!API || !DB) {
  console.log("Lewati: set E2E_API_URL dan E2E_DB_URL untuk uji gabungan nyata.");
  process.exit(0);
}
if (!/@?(localhost|127\.0\.0\.1)[:/]/.test(DB)) {
  console.error("E2E_DB_URL harus DB lokal (localhost/127.0.0.1).");
  process.exit(2);
}
const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL || "demo.pro@contoh.sissi.id";
const PASSWORD = process.env.E2E_PASSWORD || "Sissi-Demo#2026";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOTS = process.env.E2E_SHOTS || "";
const TIMEOUT = Number(process.env.E2E_TIMEOUT || 20_000);
const STAFF_PW = "Absen-Web#2026x";
const PHONES = { Rani: "+6281200000101", Bayu: "+6281200000102" };
const OUTLET_LOC = { lat: -6.8915, lng: 107.6107 };
const NEAR = { latitude: -6.8913, longitude: 107.6108, accuracy: 15 }; // ±25 m
const FAR = { latitude: -6.9175, longitude: 107.6191, accuracy: 20 }; // ±3 km

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sql(q) {
  return execFileSync("psql", ["-X", "-qAt", "-v", "ON_ERROR_STOP=1", DB, "-c", q], { encoding: "utf8" }).trim();
}
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** UUID v5 (namespace URL) — id absen deterministik `sissi-attendance:<business>:<employee>:<date>`. */
function uuidv5(name) {
  const ns = Buffer.from("6ba7b8119dad11d180b400c04fd430c8", "hex");
  const h = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name)])).digest();
  h[6] = (h[6] & 0x0f) | 0x50;
  h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

// ——— API pemilik (Bearer) ———
let token = "";
async function api(method, path, body, headers = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json?.error ?? json?.message ?? json)}`);
  return json.data;
}
const DEVICE = randomUUID();
async function push(changes) {
  const r = await api("POST", "/sync/push", { device_id: DEVICE, changes }, { "Idempotency-Key": randomUUID() });
  for (const x of r.results) assert(x.status === "applied", `push ${x.entity} ${x.status} ${x.code} ${x.message} ${JSON.stringify(x.details ?? [])}`);
  return r.results;
}
async function pullAll(entity) {
  const out = new Map();
  let cursor = "";
  for (let i = 0; i < 100; i++) {
    const p = await api("GET", `/sync/pull/${entity}?limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
    for (const r of p.items) out.set(r.id, r);
    if (!p.has_more) break;
    cursor = p.cursor;
  }
  return [...out.values()];
}
async function attendanceRow(employeeId, date) {
  await sleep(1300); // SYNC_PULL_LAG 1 detik
  return (await pullAll("attendances")).find((a) => a.employee_id === employeeId && a.date === date && !a.deleted_at);
}
async function setGeo(outside) {
  const outlets = (await pullAll("outlets")).filter((o) => o.business_id === BIZ && !o.deleted_at);
  await push(
    outlets.map((o) => {
      const settings = { ...(o.settings ?? {}) };
      if (outside) settings.attendance_geo = { enabled: true, lat: OUTLET_LOC.lat, lng: OUTLET_LOC.lng, radius_m: 100, outside };
      else delete settings.attendance_geo;
      return {
        entity: "outlets",
        op: "upsert",
        id: o.id,
        data: { name: o.name, address: o.address, status: o.status, image_url: o.image_url, settings },
        base_updated_at: o.updated_at,
      };
    })
  );
  return outlets;
}

// ——— Persiapan data ———
const BIZ = sql(`select business_id from users where email=${lit(EMAIL)} and role='owner' and deleted_at is null`);
assert(BIZ, `pemilik ${EMAIL} tidak ada (jalankan devseed)`);
const EMP = {};
for (const name of ["Rani", "Bayu"]) {
  EMP[name] = sql(`select id from users where business_id=${lit(BIZ)} and name=${lit(name)} and role<>'owner' and deleted_at is null limit 1`);
  assert(EMP[name], `karyawan ${name} tidak ada`);
  sql(`update users set phone=${lit(PHONES[name])}, personal_access='staff_space', outlet_ids=null, is_active=true where id=${lit(EMP[name])}`);
}
const ids = Object.values(EMP).map(lit).join(",");
sql(`delete from attendances where employee_id in (${ids}) and date >= current_date - 2`);
sql(`delete from staff_sessions where user_id in (${ids})`);
token = (await api("POST", "/auth/login", { identifier: EMAIL, password: PASSWORD, remember_me: false })).tokens.access_token;
await setGeo("flag");

// ——— Browser ———
const profile = mkdtempSync(join(tmpdir(), "sissi-e2e-staff-api-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: process.env.E2E_HEADFUL !== "1", userDataDir: profile, args: ["--no-first-run"] });
async function page(width = 390) {
  const ctx = await browser.createBrowserContext();
  await ctx.overridePermissions(BASE, ["geolocation"]);
  const p = await ctx.newPage();
  p.setDefaultTimeout(TIMEOUT);
  await p.setViewport({ width, height: 860 });
  p.on("console", (m) => m.type() === "error" && console.log(`     [konsol] ${m.text().slice(0, 200)}`));
  return p;
}
const waitText = (p, n) => p.waitForFunction((x) => document.body.innerText.includes(x), {}, n);
async function clickButton(p, label) {
  const h = await p.waitForFunction((l) => [...document.querySelectorAll("button")].find((b) => b.innerText.trim().includes(l) && !b.disabled), {}, label);
  await h.asElement().click();
}
async function shot(p, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await p.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}
async function activate(p, employeeId) {
  const inv = await api("POST", `/employees/${employeeId}/invite`, {});
  await p.goto(`${BASE}/undangan/${inv.code.replace(/-/g, "")}`, { waitUntil: "networkidle2" });
  await clickButton(p, "Aktifkan lewat website");
  await p.type("#web-password", STAFF_PW);
  await p.type("#web-confirm", STAFF_PW);
  await clickButton(p, "Simpan & masuk");
  await p.waitForFunction(() => location.pathname === "/karyawan");
}
const todayLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

const results = [];
async function step(name, fn) {
  try {
    await fn();
    results.push([name, true]);
    console.log(`ok    ${name}`);
  } catch (err) {
    results.push([name, false]);
    console.log(`GAGAL ${name}\n      ${err.message}`);
    try {
      const st = await rani.evaluate(() => `${location.pathname}${location.search} :: ${document.body.innerText.replace(/\s+/g, " ").slice(0, 300)}`);
      console.log(`      halaman karyawan: ${st}`);
      await shot(rani, `gagal-${name.slice(0, 1)}`);
    } catch {}
  }
}

const rani = await page();
let today = todayLocal();

await step("1 undangan → Aktifkan lewat website → /karyawan", async () => {
  await activate(rani, EMP.Rani);
  await waitText(rani, "Absen Masuk");
});

let uiLate = 0;
await step("2 Absen Masuk (lokasi dekat) → status tampil", async () => {
  await rani.setGeolocation(NEAR);
  await clickButton(rani, "Absen Masuk");
  await waitText(rani, "Absen masuk tercatat");
  await waitText(rani, "Absen Pulang");
  const t = await rani.evaluate(() => document.body.innerText);
  assert(t.includes("Website"), "label Website tidak tampil");
  // Format durasi bersama: "25 mnt" / "1 j 5 mnt" / "2 j".
  const m = /Telat (?:(\d+) j)? ?(?:(\d+) mnt)?/.exec(t);
  uiLate = m ? Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0) : 0;
  await shot(rani, "nyata-masuk");
});

await step("3 verifikasi API pemilik: source self, clock_in_via web, geo, status", async () => {
  const r = await attendanceRow(EMP.Rani, today);
  assert(r, "baris absen tidak ditemukan lewat /sync/pull");
  assert(r.source === "self", `source ${r.source}`);
  assert(r.clock_in_via === "web", `clock_in_via ${r.clock_in_via}`);
  assert(r.clock_in_geo && typeof r.clock_in_geo.distance_m === "number" && r.clock_in_geo.distance_m < 100, `geo ${JSON.stringify(r.clock_in_geo)}`);
  assert(r.clock_in_geo.outside_area === false, "outside_area seharusnya false");
  assert(r.status === (uiLate ? "late" : "ontime"), `status ${r.status} vs UI telat ${uiLate}`);
  assert(r.late_minutes === uiLate, `late_minutes ${r.late_minutes} vs UI ${uiLate}`);
});

await step("4 aturan Tolak: Pulang dari jauh → OUTSIDE_AREA + jarak; dari dekat → sukses (clock_out_via web)", async () => {
  await setGeo("reject");
  await rani.reload({ waitUntil: "networkidle2" });
  await waitText(rani, "hanya menerima absen di lokasi");
  await rani.setGeolocation(FAR);
  await clickButton(rani, "Absen Pulang");
  await waitText(rani, "Di luar area outlet");
  const t = await rani.evaluate(() => document.body.innerText);
  assert(/\d+(,\d)? km dari outlet|\d+ m dari outlet/.test(t), "jarak tidak tampil");
  await shot(rani, "nyata-tolak");
  await rani.setGeolocation(NEAR);
  await clickButton(rani, "Absen Pulang");
  await waitText(rani, "Absen pulang tercatat");
  await waitText(rani, "Absen hari ini selesai");
  const r = await attendanceRow(EMP.Rani, today);
  assert(r.clock_out_via === "web", `clock_out_via ${r.clock_out_via}`);
  assert(r.clock_out_geo && r.clock_out_geo.outside_area === false, `clock_out_geo ${JSON.stringify(r.clock_out_geo)}`);
});

await step("5 baris PIN (push) + pulang lewat web → via pin/web; dasbor Tim › Absen", async () => {
  today = todayLocal();
  const outlets = (await pullAll("outlets")).filter((o) => o.business_id === BIZ && !o.deleted_at);
  const id = uuidv5(`sissi-attendance:${BIZ}:${EMP.Bayu}:${today}`);
  await push([
    {
      entity: "attendances",
      op: "upsert",
      id,
      data: {
        outlet_id: outlets[0].id,
        employee_id: EMP.Bayu,
        date: today,
        clock_in_at: new Date(Date.now() - 2 * 3600_000).toISOString(),
        // clock_out_at tidak dikirim: push PIN tidak boleh mengosongkan jam (null ditolak server).
        status: "ontime",
        late_minutes: 0,
        note: "",
        source: "pin",
      },
    },
  ]);
  const bayu = await page();
  await bayu.setGeolocation(NEAR);
  await activate(bayu, EMP.Bayu);
  await waitText(bayu, "Absen Pulang");
  await waitText(bayu, "Perangkat toko (PIN)");
  await clickButton(bayu, "Absen Pulang");
  await waitText(bayu, "Absen pulang tercatat");
  await shot(bayu, "nyata-pin-web");
  const r = await attendanceRow(EMP.Bayu, today);
  assert(r.source === "pin", `source ${r.source}`);
  assert(r.clock_in_via === "pin", `clock_in_via ${r.clock_in_via}`);
  assert(r.clock_out_via === "web", `clock_out_via ${r.clock_out_via}`);
  await bayu.browserContext().close();

  const owner = await page(1280);
  await owner.goto(`${BASE}/masuk`, { waitUntil: "networkidle2" });
  await owner.type("#identifier", EMAIL);
  await owner.type("#password", PASSWORD);
  await owner.click("button[type=submit]");
  await owner.waitForFunction(() => location.pathname.startsWith("/dasbor"));
  await owner.goto(`${BASE}/dasbor/tim?tab=kehadiran`, { waitUntil: "networkidle2" });
  await waitText(owner, "Masuk: Perangkat toko (PIN) · Pulang: Website");
  await shot(owner, "nyata-dasbor-absen");
  await owner.browserContext().close();
});

await step("6 keluar & masuk ulang di /karyawan/masuk; akun pemilik → /masuk", async () => {
  if (process.env.E2E_DEBUG) {
    rani.on("request", (r) => r.url().includes("/api/") && console.log("      req", r.method(), r.url().replace(/.*v1/, "")));
    rani.on("requestfinished", (r) => r.url().includes("/api/") && console.log("      fin", r.method(), r.url().replace(/.*v1/, ""), r.response()?.status()));
    rani.on("requestfailed", (r) => r.url().includes("/api/") && console.log("      FAIL", r.method(), r.url().replace(/.*v1/, ""), r.failure()?.errorText));
  }
  await clickButton(rani, "Keluar");
  await rani.waitForFunction(() => location.pathname === "/karyawan/masuk" && !!document.querySelector("#identifier"));
  await rani.type("#identifier", "081200000101");
  await rani.type("#password", STAFF_PW);
  await rani.click("button[type=submit]");
  await rani.waitForFunction(() => location.pathname === "/karyawan");
  await waitText(rani, "Absen hari ini selesai");
  await clickButton(rani, "Keluar");
  await rani.waitForFunction(() => location.pathname === "/karyawan/masuk" && !!document.querySelector("#identifier"));
  await rani.type("#identifier", EMAIL);
  await rani.type("#password", PASSWORD);
  await rani.click("button[type=submit]");
  await rani.waitForFunction(() => location.pathname === "/masuk");
  await waitText(rani, "Ini akun pemilik usaha");
});

try {
  await setGeo(null);
} catch (err) {
  console.log(`     (gagal mengembalikan pengaturan lokasi outlet: ${err.message})`);
}
await browser.close();
rmSync(profile, { recursive: true, force: true });
const failed = results.filter((r) => !r[1]).length;
console.log(`\n${results.length - failed}/${results.length} lulus`);
process.exit(failed ? 1 : 0);
