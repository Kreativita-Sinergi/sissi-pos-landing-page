#!/usr/bin/env node
// Tes e2e web karyawan (absen) dalam MODE TIRUAN — tanpa API. Prasyarat: server dev menyala dengan
// NEXT_PUBLIC_STAFF_MOCK=1 (dan NEXT_PUBLIC_OWNER_MOCK=1 untuk tes undangan), Chrome sistem (atau CHROME_PATH).
//
//   NEXT_PUBLIC_STAFF_MOCK=1 NEXT_PUBLIC_OWNER_MOCK=1 npx next dev -p 3100
//   E2E_BASE_URL=http://localhost:3100 npm run e2e:karyawan
//   E2E_SHOTS=/tmp/shots npm run e2e:karyawan     # simpan tangkapan layar 360px & desktop
//
// Skenario tiruan dipilih dari teks no. HP/email (lihat src/lib/staff/mock.ts).
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const SHOTS = process.env.E2E_SHOTS || "";
const TIMEOUT = Number(process.env.E2E_TIMEOUT || 15_000);
const NEAR = { latitude: -6.2298, longitude: 106.8296, accuracy: 15 }; // ±10 m dari outlet tiruan
const FAR = { latitude: -6.9175, longitude: 107.6191, accuracy: 20 }; // Bandung

const tests = [];
const test = (name, fn) => tests.push({ name, fn });
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const profile = mkdtempSync(join(tmpdir(), "sissi-e2e-staff-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: profile, args: ["--no-first-run"] });
const ctx = browser.defaultBrowserContext();
await ctx.overridePermissions(BASE, ["geolocation"]);

async function fresh(width = 360, height = 780) {
  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.setViewport({ width, height, deviceScaleFactor: 1 });
  await page.goto(`${BASE}/karyawan/masuk`, { waitUntil: "networkidle2" });
  await page.evaluate(() => localStorage.clear());
  return page;
}

async function text(page) {
  return page.evaluate(() => document.body.innerText);
}

async function waitText(page, needle) {
  await page.waitForFunction((n) => document.body.innerText.includes(n), {}, needle);
}

async function login(page, identifier, password = "rahasia123") {
  await page.goto(`${BASE}/karyawan/masuk`, { waitUntil: "networkidle2" });
  await page.type("#identifier", identifier);
  await page.type("#password", password);
  await page.click("button[type=submit]");
}

async function noOverflow(page, label) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  assert(sw <= cw, `${label}: meluber horizontal (${sw} > ${cw})`);
}

async function shot(page, name) {
  if (!SHOTS) return;
  mkdirSync(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });
}

async function clickButton(page, label) {
  const handle = await page.waitForFunction(
    (l) => [...document.querySelectorAll("button")].find((b) => b.innerText.trim().includes(l) && !b.disabled),
    {},
    label
  );
  await handle.asElement().click();
}

test("tanpa sesi → /karyawan/masuk; halaman noindex", async () => {
  const page = await fresh();
  await page.goto(`${BASE}/karyawan/riwayat`, { waitUntil: "networkidle2" });
  await page.waitForFunction(() => location.pathname === "/karyawan/masuk");
  assert(page.url().includes("next=%2Fkaryawan%2Friwayat"), `next hilang: ${page.url()}`);
  const robots = await page.$eval('meta[name="robots"]', (m) => m.content);
  assert(/noindex/.test(robots), `robots: ${robots}`);
  await noOverflow(page, "masuk 360");
  await shot(page, "masuk-360");
  await page.close();
});

test("akun pemilik (STAFF_ONLY) → /masuk dengan pesan", async () => {
  const page = await fresh();
  await login(page, "pemilik@contoh.id");
  await page.waitForFunction(() => location.pathname === "/masuk");
  await waitText(page, "Ini akun pemilik usaha");
  await waitText(page, "Masuk sebagai karyawan");
  await page.close();
});

test("EMPLOYEE_LOGIN_DISABLED → pesan jelas", async () => {
  const page = await fresh();
  await login(page, "0812nonaktif");
  await waitText(page, "Akunmu belum diizinkan masuk");
  await page.close();
});

test("absen masuk lalu pulang (lokasi dekat)", async () => {
  const page = await fresh();
  await page.setGeolocation(NEAR);
  await login(page, "081234567890");
  await page.waitForFunction(() => location.pathname === "/karyawan");
  await waitText(page, "Absen Masuk");
  await noOverflow(page, "absen 360");
  await shot(page, "absen-belum-360");
  await clickButton(page, "Absen Masuk");
  await waitText(page, "Absen masuk tercatat");
  await waitText(page, "Absen Pulang");
  const t = await text(page);
  assert(t.includes("Website"), "label via Website tidak tampil");
  await clickButton(page, "Absen Pulang");
  await waitText(page, "Absen hari ini selesai");
  await shot(page, "absen-selesai-360");
  await page.close();
});

test("aturan Tolak + lokasi jauh → OUTSIDE_AREA dengan jarak", async () => {
  const page = await fresh();
  await page.setGeolocation(FAR);
  await login(page, "tolak@contoh.id");
  await page.waitForFunction(() => location.pathname === "/karyawan");
  await waitText(page, "hanya menerima absen di lokasi");
  await clickButton(page, "Absen Masuk");
  await waitText(page, "Di luar area outlet");
  assert(/km dari outlet/.test(await text(page)), "jarak tidak tampil");
  await shot(page, "absen-tolak-360");
  await page.close();
});

test("paket Gratis → terkunci, tombol mati", async () => {
  const page = await fresh();
  await login(page, "gratis@contoh.id");
  await waitText(page, "Fitur ini butuh Sissi Pro — hubungi pemilik");
  const enabled = await page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /Absen (Masuk|Pulang)/.test(b.innerText) && !b.disabled));
  assert(!enabled, "tombol absen masih aktif");
  await page.close();
});

test("galat jaringan sekali → diulang otomatis dengan kunci sama", async () => {
  const page = await fresh();
  await page.setGeolocation(NEAR);
  await login(page, "putus@contoh.id");
  await page.waitForFunction(() => location.pathname === "/karyawan");
  await clickButton(page, "Absen Masuk");
  await waitText(page, "Absen masuk tercatat");
  await page.close();
});

test("sudah masuk telat + multi-outlet; riwayat 13 pilihan bulan tanpa meluber", async () => {
  const page = await fresh();
  await login(page, "cabang-telat@contoh.id");
  await waitText(page, "Telat 17 menit");
  assert(await page.$("select#outlet"), "pemilih outlet tidak ada");
  await shot(page, "absen-telat-cabang-360");
  await page.goto(`${BASE}/karyawan/riwayat`, { waitUntil: "networkidle2" });
  await waitText(page, "Hadir");
  const n = await page.$$eval("#bulan option", (o) => o.length);
  assert(n === 13, `pilihan bulan ${n}`);
  await noOverflow(page, "riwayat 360");
  await shot(page, "riwayat-360");
  await page.setViewport({ width: 1280, height: 900 });
  await shot(page, "riwayat-desktop");
  await page.goto(`${BASE}/karyawan`, { waitUntil: "networkidle2" });
  await waitText(page, "Absen Pulang");
  await shot(page, "absen-desktop");
  await page.close();
});

test("undangan → Aktifkan lewat website → /karyawan", async () => {
  const page = await fresh();
  await page.goto(`${BASE}/undangan/ABCDEFGHJK`, { waitUntil: "networkidle2" });
  await clickButton(page, "Aktifkan lewat website");
  await page.type("#web-password", "kopi-senja-2026");
  await page.type("#web-confirm", "kopi-senja-2026");
  await noOverflow(page, "undangan 360");
  await shot(page, "undangan-360");
  await clickButton(page, "Simpan & masuk");
  await page.waitForFunction(() => location.pathname === "/karyawan");
  await waitText(page, "Absen Masuk");
  await page.close();
});

let failed = 0;
for (const t of tests) {
  try {
    await t.fn();
    console.log(`ok   ${t.name}`);
  } catch (err) {
    failed++;
    console.log(`GAGAL ${t.name}\n     ${err.message}`);
  }
}
await browser.close();
rmSync(profile, { recursive: true, force: true });
console.log(`\n${tests.length - failed}/${tests.length} lulus`);
process.exit(failed ? 1 : 0);
