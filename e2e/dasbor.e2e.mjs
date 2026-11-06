#!/usr/bin/env node
// Tes e2e dasbor pemilik lewat browser sungguhan (puppeteer-core + Chrome sistem). Menangkap bug yang lolos curl:
// CORS/preflight, cookie lintas port, dialog <dialog>, alur klik & keyboard. Prasyarat & cara jalan: e2e/README.md.
//
//   npm run e2e                     # semua tes, headless
//   E2E_HEADFUL=1 npm run e2e       # tampilkan browser
//   E2E_ONLY=produk npm run e2e     # hanya tes yang namanya memuat "produk" (tes login tetap jalan bila perlu)
//
// Setiap tes membersihkan data yang dibuatnya (nama berawalan "E2E "). Sisa dari run gagal sebelumnya dihapus di awal.

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import puppeteer from "puppeteer-core";

const BASE = (process.env.E2E_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const API = (process.env.E2E_API_URL || "http://localhost:8000/api/v1").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL || "demo.pro@contoh.sissi.id";
const PASSWORD = process.env.E2E_PASSWORD || "Sissi-Demo#2026";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const HEADFUL = process.env.E2E_HEADFUL === "1";
const ONLY = (process.env.E2E_ONLY || "").toLowerCase();
const TIMEOUT = Number(process.env.E2E_TIMEOUT || 15_000);
const RUN = Date.now().toString(36).slice(-5);
/** Awalan nama data tes — dipakai untuk pembersihan sisa run sebelumnya. */
const PREFIX = "E2E ";

// ——— Runner sederhana ———

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

class AssertionError extends Error {}
function assert(cond, msg) {
  if (!cond) throw new AssertionError(msg);
}
function eq(actual, expected, msg) {
  if (actual !== expected) throw new AssertionError(`${msg}: diharapkan ${JSON.stringify(expected)}, didapat ${JSON.stringify(actual)}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ——— Anggaran batas laju ———
// API dasbor membatasi 600 request/menit (baca) per pengguna (gabungan browser + klien tes ini). Setiap request ke API
// dicatat; sebelum tiap tes kita menunggu sampai sisa kuota cukup agar tes tidak gagal karena 429.
const RATE_LIMIT = 600;
const RATE_WINDOW = 60_000;
const apiHits = [];
let apiTotal = 0;
const hit = () => {
  apiTotal++;
  apiHits.push(Date.now());
};
const recentHits = () => {
  const since = Date.now() - RATE_WINDOW;
  while (apiHits.length && apiHits[0] < since) apiHits.shift();
  return apiHits.length;
};
/** Tunggu sampai minimal `need` request tersisa di jendela satu menit. */
async function rateBudget(need) {
  let waited = 0;
  while (recentHits() > RATE_LIMIT - need) {
    const wait = apiHits[0] + RATE_WINDOW - Date.now() + 250;
    waited += wait;
    await sleep(Math.max(250, wait));
  }
  return waited;
}

// ——— Klien API (verifikasi & pembersihan, di luar browser) ———

const api = {
  cookie: "",
  async call(method, path, body) {
    const headers = { Accept: "application/json", "X-Sissi-Owner": "1", Origin: BASE };
    if (this.cookie) headers.Cookie = this.cookie;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (method === "POST" && path === "/owner/changes") headers["Idempotency-Key"] = randomUUID();
    let res;
    for (let attempt = 0; ; attempt++) {
      hit();
      res = await fetch(`${API}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      if (res.status !== 429 || attempt >= 3) break;
      await sleep((Number(res.headers.get("Retry-After")) || 5) * 1000);
    }
    const set = res.headers.getSetCookie?.() ?? [];
    if (set.length) this.cookie = set.map((c) => c.split(";")[0]).join("; ");
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) throw new Error(`API ${method} ${path} → ${res.status} ${json?.error?.code ?? ""} ${json?.message ?? ""}`);
    return json;
  },
  async login() {
    await this.call("POST", "/owner/auth/login", { identifier: EMAIL, password: PASSWORD });
  },
  /** Semua record satu entitas (termasuk tombstone). */
  async pull(entity) {
    const out = new Map();
    let cursor = "";
    for (let i = 0; i < 50; i++) {
      const r = await this.call("GET", `/owner/data/${entity}?limit=1000${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      for (const rec of r.data.items) out.set(rec.id, rec);
      if (!r.data.has_more || r.data.cursor === cursor) break;
      cursor = r.data.cursor;
    }
    return [...out.values()];
  },
  async live(entity) {
    return (await this.pull(entity)).filter((r) => !r.deleted_at);
  },
  async remove(entity, ids) {
    if (!ids.length) return;
    const changes = ids.map((id) => ({ entity, op: "delete", id }));
    await this.call("POST", "/owner/changes", { changes });
  },
  async upsert(entity, id, data, base_updated_at) {
    const r = await this.call("POST", "/owner/changes", { changes: [{ entity, op: "upsert", id, data, base_updated_at }] });
    const res = r.data.results[0];
    if (res.status !== "applied") throw new Error(`upsert ${entity} ${res.status} ${JSON.stringify(res.error ?? "")}`);
    return res.record;
  },
  async activity(qs) {
    return (await this.call("GET", `/owner/activity?${qs}`)).data;
  },
  async get(path) {
    return (await this.call("GET", path)).data;
  },
  /** Konfirmasi ulang sesi klien tes (aksi sensitif, mis. mengembalikan QRIS). Batas server 10/15 menit. */
  async confirm() {
    await this.call("POST", "/owner/auth/confirm", { password: PASSWORD });
  },
};

// ——— Bantuan browser ———

let browser;
let page;
const consoleErrors = [];
const failedRequests = [];

async function newPage() {
  const p = await browser.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  p.setDefaultTimeout(TIMEOUT);
  p.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  p.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));
  p.on("request", (r) => {
    if (r.url().startsWith(API) && r.method() !== "OPTIONS") hit();
  });
  p.on("response", (r) => {
    if (r.url().startsWith(API) && r.status() === 429) failedRequests.push(`429 ${r.request().method()} ${r.url()}`);
  });
  p.on("requestfailed", (r) => {
    // Batal karena navigasi/abort controller bukan bug.
    const why = r.failure()?.errorText ?? "";
    if (!/ERR_ABORTED/.test(why)) failedRequests.push(`${r.method()} ${r.url()} — ${why}`);
  });
  return p;
}

/** Buka path dasbor dan tunggu jaringan tenang. */
async function go(path) {
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle2" });
}

/** Tunggu teks muncul di halaman (mengabaikan elemen tersembunyi). */
async function waitText(text, { timeout = TIMEOUT, root = "body" } = {}) {
  await page.waitForFunction(
    (t, r) => {
      const el = document.querySelector(r);
      return !!el && el.innerText.includes(t);
    },
    { timeout },
    text,
    root
  );
}

async function waitNoText(text, { timeout = TIMEOUT, root = "body" } = {}) {
  await page.waitForFunction(
    (t, r) => {
      const el = document.querySelector(r);
      return !el || !el.innerText.includes(t);
    },
    { timeout },
    text,
    root
  );
}

const hasText = (text, root = "body") => page.evaluate((t, r) => !!document.querySelector(r)?.innerText.includes(t), text, root);

/** Klik elemen (button/a/[role]) terlihat yang teks/aria-label-nya cocok persis (atau memuat bila `partial`). */
async function click(text, { within = "body", partial = false, selector = "button, a, [role=button], [role=tab], [role=option], [role=menuitem], [role=radio], label" } = {}) {
  const handle = await page.waitForFunction(
    (t, w, sel, part) => {
      const root = w === "dialog" ? [...document.querySelectorAll("dialog[open]")].pop() : document.querySelector(w);
      if (!root) return null;
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
      };
      const match = (el) => {
        const names = [norm(el.innerText), norm(el.getAttribute("aria-label")), norm(el.getAttribute("title"))];
        return names.some((n) => (part ? n.includes(t) : n === t));
      };
      return [...root.querySelectorAll(sel)].find((el) => visible(el) && !el.disabled && match(el)) ?? null;
    },
    { timeout: TIMEOUT },
    text,
    within,
    selector,
    partial
  );
  const el = handle.asElement();
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click();
  return el;
}

/** Isi input berdasarkan teks <label> (Field) — mengganti isi lama. */
async function fill(label, value, { within = "body" } = {}) {
  const handle = await page.waitForFunction(
    (l, w) => {
      const root = w === "dialog" ? [...document.querySelectorAll("dialog[open]")].pop() : document.querySelector(w);
      if (!root) return null;
      const norm = (s) => (s || "").replace(/\s+/g, " ").trim();
      for (const lab of root.querySelectorAll("label")) {
        const own = norm([...lab.childNodes].map((n) => n.textContent).join(" "));
        if (own !== l && !own.startsWith(`${l} `) && norm(lab.innerText) !== l) continue;
        const input = lab.htmlFor ? document.getElementById(lab.htmlFor) : lab.querySelector("input, textarea");
        if (input && (input.tagName === "INPUT" || input.tagName === "TEXTAREA")) return input;
      }
      const byAria = root.querySelector(`input[aria-label="${l}"], textarea[aria-label="${l}"]`);
      return byAria ?? null;
    },
    { timeout: TIMEOUT },
    label,
    within
  );
  const el = handle.asElement();
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click({ count: 3 });
  await el.evaluate((e) => {
    // Kosongkan lewat setter asli agar React menerima perubahan.
    const proto = e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(e, "");
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await el.type(String(value));
  return el;
}

const dialogTitle = () => page.evaluate(() => [...document.querySelectorAll("dialog[open]")].pop()?.querySelector("h2")?.innerText.trim() ?? null);
async function waitDialog(title) {
  await page.waitForFunction((t) => [...document.querySelectorAll("dialog[open]")].some((d) => d.querySelector("h2")?.innerText.trim() === t), { timeout: TIMEOUT }, title);
}
async function waitDialogClosed(title) {
  await page.waitForFunction((t) => ![...document.querySelectorAll("dialog[open]")].some((d) => d.querySelector("h2")?.innerText.trim() === t), { timeout: TIMEOUT }, title);
}

async function login() {
  await go("/masuk");
  await fill("Email atau nomor HP", EMAIL);
  await fill("Kata sandi", PASSWORD);
  await click("Masuk", { selector: "button[type=submit]" });
  await page.waitForFunction(() => location.pathname === "/dasbor", { timeout: TIMEOUT });
}

async function ensureLoggedIn() {
  await go("/dasbor");
  if (new URL(page.url()).pathname.startsWith("/masuk")) await login();
  await page.waitForFunction(() => location.pathname.startsWith("/dasbor"), { timeout: TIMEOUT });
}

/** PNG RGB polos `w × h` (tanpa dependensi). */
function makePng(w, h, [r, g, b]) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const x of buf) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) raw.set([r, g, b], y * (w * 3 + 1) + 1 + x * 3);
  }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ——— Tes ———

test("login: kata sandi salah menampilkan pesan", async () => {
  await page.deleteCookie(...(await page.cookies("http://localhost:8000")));
  await go("/masuk");
  await fill("Email atau nomor HP", EMAIL);
  await fill("Kata sandi", "salah-sekali-123");
  await click("Masuk", { selector: "button[type=submit]" });
  await page.waitForSelector("[role=alert]", { visible: true });
  const msg = await page.$eval("[role=alert]", (e) => e.innerText.trim());
  assert(msg.length > 0, "pesan galat kosong");
  assert(new URL(page.url()).pathname === "/masuk", "tetap di /masuk");
});

test("login: benar masuk ke Beranda", async () => {
  await login();
  await waitText("Beranda");
});

test("keluar: Batal tetap di dasbor", async () => {
  await ensureLoggedIn();
  await click("Keluar", { selector: "aside button" });
  await waitDialog("Keluar dari dasbor?");
  await click("Batal", { within: "dialog" });
  await waitDialogClosed("Keluar dari dasbor?");
  assert(new URL(page.url()).pathname === "/dasbor", "masih di /dasbor");
  // Sesi masih berlaku.
  await page.reload({ waitUntil: "networkidle2" });
  assert(new URL(page.url()).pathname === "/dasbor", "sesi tetap ada setelah muat ulang");
});

/** Isi input berdasarkan selector CSS — mengganti isi lama. */
async function fillSel(selector, value) {
  const el = await page.waitForSelector(selector, { visible: true });
  await el.evaluate((e) => e.scrollIntoView({ block: "center" }));
  await el.click({ count: 3 });
  await el.evaluate((e) => {
    const proto = e.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(e, "");
    e.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await el.type(String(value));
  return el;
}

/** Tunggu sampai `fn()` (async) mengembalikan nilai truthy; galat bila waktu habis. */
async function poll(fn, msg, timeout = TIMEOUT) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    last = await fn();
    if (last) return last;
    await sleep(1000);
  }
  throw new AssertionError(`${msg} (waktu habis)`);
}

const productByName = async (name) => (await api.pull("products")).filter((p) => p.name === name).sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))[0] ?? null;

async function openNewProduct() {
  await go("/dasbor/produk");
  await click("Tambah produk", { within: "main" });
  await waitDialog("Tambah produk");
  // Draf tersisa dari run lain → mulai baru.
  if (await hasText("Lanjutkan draf?", "dialog[open]")) await click("Mulai baru", { within: "dialog" });
  await page.waitForSelector("#pe-name", { visible: true });
}

/** Tutup panel produk; isian baru yang belum disimpan → "Buang". */
async function closeProductEditor(title = "Tambah produk") {
  await click("Batal", { within: "dialog" });
  const asked = await page
    .waitForFunction(() => [...document.querySelectorAll("dialog[open] h2")].some((h) => h.innerText.trim() === "Simpan sebagai draf?"), { timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (asked) await click("Buang", { within: "dialog" });
  await waitDialogClosed(title);
}

async function openProduct(name) {
  await go(`/dasbor/produk?q=${encodeURIComponent(name)}`);
  await click(name, { within: "main", partial: true, selector: "tbody button, [role=row] button, main ul button, main table button" });
  await waitDialog("Ubah produk");
  await page.waitForSelector("#pe-price", { visible: true });
}

async function saveProductEditor(title) {
  await click("Simpan", { within: "dialog", selector: "button[type=button]" });
  await waitDialogClosed(title);
}

/** Tombol submit dari form yang memuat elemen `selector`. */
async function submitFormOf(selector) {
  await page.$eval(selector, (e) => {
    const b = e.closest("form")?.querySelector("button[type=submit]");
    if (!b) throw new Error("form tanpa tombol submit");
    b.scrollIntoView({ block: "center" });
    b.click();
  });
}

test("beranda memuat KPI", async () => {
  await ensureLoggedIn();
  await go("/dasbor");
  await waitText("Penjualan hari ini");
  await waitText("Transaksi");
  const kpi = await page.evaluate(() => /Penjualan hari ini\s+Rp[\d.]+/.test(document.querySelector("main").innerText));
  assert(kpi, "nilai penjualan hari ini (Rp…) tidak tampil");
  assert(!(await hasText("Coba lagi", "main")), "ada blok galat di Beranda");
});

test("laporan memuat & ganti periode (filter tunggal tanpa ruang kosong)", async () => {
  await go("/dasbor/laporan");
  await waitText("Penjualan · 7 hari terakhir");
  await click("Periode: 7 hari terakhir", { within: "main" });
  await page.waitForSelector("[role=listbox][aria-label=Periode] [role=option]", { visible: true });
  // Pilihan tunggal: tidak ada kotak centang kosong di kiri label.
  const gaps = await page.$$eval("[role=listbox][aria-label=Periode] [role=option]", (els) =>
    els.map((li) => {
      const label = [...li.children].find((c) => c.tagName === "SPAN" && c.innerText.trim());
      return label ? Math.round(label.getBoundingClientRect().left - li.getBoundingClientRect().left) : -1;
    })
  );
  assert(gaps.every((g) => g >= 0 && g <= 14), `label pilihan periode bergeser (ruang kosong di kiri): ${gaps.join(",")}`);
  await click("30 hari terakhir", { selector: "[role=option]" });
  await waitText("Penjualan · 30 hari terakhir");
  assert(new URL(page.url()).searchParams.get("from"), "periode tersimpan di URL (?from=)");
  assert(!(await hasText("Coba lagi", "main")), "ada blok galat di Laporan");
});

test("produk: buat satu-harga → ubah harga → riwayat di Aktivitas → hapus", async () => {
  const name = `${PREFIX}Kopi ${RUN}`;
  try {
    await openNewProduct();
    await fillSel("#pe-name", name);
    await fillSel("#pe-price", "12000");
    await saveProductEditor("Tambah produk");
    const created = await poll(async () => {
      const p = await productByName(name);
      return p && !p.deleted_at ? p : null;
    }, "produk baru tidak tersimpan di server");
    eq(created.price, 12000, "harga produk baru");

    await openProduct(name);
    await fillSel("#pe-price", "13000");
    await saveProductEditor("Ubah produk");
    await poll(async () => (await productByName(name))?.price === 13000, "harga baru tidak tersimpan di server");

    // Riwayat perubahan (change) di Aktivitas.
    await go("/dasbor/aktivitas?kind=change");
    await waitText(`mengubah harga ${name} Rp12.000 → Rp13.000`);
    await waitText(`menambah produk ${name}`);
    assert(await hasText("Dasbor web", "main"), "perangkat \"Dasbor web\" tampil");

    await openProduct(name);
    await click("Hapus", { within: "dialog" });
    await waitDialog("Hapus produk?");
    await click("Hapus", { within: "dialog" });
    await waitDialogClosed("Ubah produk");
    await poll(async () => !!(await productByName(name))?.deleted_at, "produk tidak terhapus di server");
  } finally {
    const left = (await api.live("products")).filter((p) => p.name === name);
    await api.remove("products", left.map((p) => p.id));
  }
});

test("produk: dialog Tambah produk tetap terbuka saat pemilih file dibatalkan", async () => {
  await openNewProduct();
  const [chooser] = await Promise.all([page.waitForFileChooser(), click("Pilih foto", { within: "dialog" })]);
  await chooser.cancel();
  // Chrome mengirim event `cancel` (bubbles) dari <input type=file>; pastikan juga lewat event sintetis.
  await page.$eval("dialog[open] input[type=file]", (e) => e.dispatchEvent(new Event("cancel", { bubbles: true })));
  await sleep(500);
  eq(await dialogTitle(), "Tambah produk", "dialog teratas");
  await closeProductEditor();
});

test("produk: dropdown kategori bisa dipilih dengan keyboard", async () => {
  await openNewProduct();
  const before = await page.$eval("#pe-cat", (e) => e.innerText.trim());
  await page.focus("#pe-cat");
  await page.keyboard.press("ArrowDown");
  await page.waitForSelector("#pe-cat[aria-expanded=true]");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.waitForSelector("#pe-cat[aria-expanded=false]");
  const after = await page.$eval("#pe-cat", (e) => e.innerText.trim());
  assert(after !== before, `pilihan kategori tidak berubah (${before})`);
  eq(await page.evaluate(() => document.activeElement?.id), "pe-cat", "fokus kembali ke tombol dropdown");
  // Esc menutup daftar saja, bukan panel.
  await page.keyboard.press("ArrowDown");
  await page.waitForSelector("#pe-cat[aria-expanded=true]");
  await page.keyboard.press("Escape");
  await page.waitForSelector("#pe-cat[aria-expanded=false]");
  await sleep(300);
  eq(await dialogTitle(), "Tambah produk", "panel tetap terbuka setelah Esc di dropdown");
  await closeProductEditor();
});

test("produk: unggah foto (PNG kecil) tersimpan", async () => {
  const name = `${PREFIX}Foto ${RUN}`;
  try {
    await openNewProduct();
    await fillSel("#pe-name", name);
    await fillSel("#pe-price", "5000");
    const [chooser] = await Promise.all([page.waitForFileChooser(), click("Pilih foto", { within: "dialog" })]);
    await chooser.accept([globalThis.__pngPath]);
    await page.waitForFunction(() => !!document.querySelector('dialog[open] [aria-label="Ganti foto produk"]'), { timeout: 30_000 });
    await saveProductEditor("Tambah produk");
    const p = await poll(async () => {
      const r = await productByName(name);
      return r && !r.deleted_at ? r : null;
    }, "produk berfoto tidak tersimpan");
    assert(typeof p.image_url === "string" && p.image_url.length > 0, "image_url kosong");
    const img = await fetch(p.image_url);
    assert(img.ok, `foto tidak bisa diunduh (${img.status})`);
  } finally {
    const left = (await api.live("products")).filter((p) => p.name === name);
    await api.remove("products", left.map((p) => p.id));
  }
});

test("produk: sub-menu sidebar, judul tab browser, & tambah kategori lewat dialog", async () => {
  const name = `${PREFIX}Kategori ${RUN}`;
  const subActive = () => page.evaluate(() => document.querySelector('aside a[aria-current="page"]')?.innerText.trim() ?? null);
  try {
    await go("/dasbor/produk");
    // Desktop (1366 px): bagian tampil sebagai sub-menu sidebar; Tabs di halaman disembunyikan.
    eq(await subActive(), "Produk", "sub-menu aktif bawaan");
    assert(await page.$eval('main [role="tablist"]', (el) => el.offsetParent === null), "Tabs halaman masih tampil di desktop");

    await click("Kategori", { within: "aside", selector: "a" });
    await page.waitForFunction(() => new URL(location.href).searchParams.get("tab") === "kategori");
    await page.waitForFunction(() => document.querySelector("main h1")?.innerText.trim() === "Kategori");
    eq(await subActive(), "Kategori", "sub-menu aktif setelah diklik");
    await poll(async () => (await page.title()) === "Kategori · Produk · Dasbor Sissi", `judul tab browser tidak mengikuti sub-menu (${await page.title()})`);

    // Induk = tombol buka/tutup.
    await click("Produk", { within: "aside", selector: "button" });
    await page.waitForFunction(() => !document.querySelector('aside a[aria-current="page"]'));
    await click("Produk", { within: "aside", selector: "button" });
    await page.waitForFunction(() => !!document.querySelector('aside a[aria-current="page"]'));

    await click("Tambah kategori", { within: "main" });
    await waitDialog("Tambah kategori");
    await fill("Nama kategori", name, { within: "dialog" });
    await click("Tambah kategori", { within: "dialog", selector: "button[type=submit]" });
    await waitDialogClosed("Tambah kategori");
    await waitText(name, { root: "main" });
    await poll(async () => (await api.live("categories")).some((c) => c.name === name), "kategori baru tidak tersimpan");

    // Urutkan: turunkan satu posisi → sort_order = indeks baru (sama dengan reorderCategories aplikasi).
    const order = () => page.$$eval("main ul > li p.truncate", (els) => els.map((e) => e.innerText.trim()));
    const at = (await order()).indexOf(name);
    assert(at >= 0, "kategori baru tidak ada di daftar");
    if (at < (await order()).length - 1) {
      await click(`Turunkan ${name}`, { within: "main" });
      await page.waitForFunction((n, i) => [...document.querySelectorAll("main ul > li p.truncate")].map((e) => e.innerText.trim()).indexOf(n) === i, {}, name, at + 1);
      await poll(async () => (await api.live("categories")).find((c) => c.name === name)?.sort_order === at + 1, "urutan kategori tidak tersimpan");
    }

    // Judul sub-bagian tidak tertahan setelah pindah halaman.
    await click("Pelanggan", { within: "aside", selector: "a" });
    await page.waitForFunction(() => location.pathname === "/dasbor/pelanggan");
    await poll(async () => (await page.title()) === "Pelanggan · Dasbor Sissi", `judul tab tertahan setelah pindah halaman (${await page.title()})`);
  } finally {
    const left = (await api.live("categories")).filter((c) => c.name === name);
    await api.remove("categories", left.map((c) => c.id));
  }
});

test("pelanggan: tambah → ubah → hapus", async () => {
  const name = `${PREFIX}Pelanggan ${RUN}`;
  const byName = async () => (await api.pull("customers")).find((c) => c.name === name) ?? null;
  try {
    await go("/dasbor/pelanggan");
    await click("Tambah pelanggan", { within: "main" });
    await page.waitForSelector("dialog[open]");
    await fill("Nama", name, { within: "dialog" });
    await fill("Nomor HP (opsional)", `0812${String(Date.now()).slice(-8)}`, { within: "dialog" });
    await click("Tambah", { within: "dialog", selector: "button[type=submit]" });
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await waitText(name, { root: "main" });
    await poll(async () => (await byName())?.deleted_at === null, "pelanggan baru tidak tersimpan");

    await click(`Ubah ${name}`, { within: "main" });
    await page.waitForSelector("dialog[open]");
    await fill("Catatan (opsional)", "Diubah oleh tes e2e", { within: "dialog" });
    await click("Simpan", { within: "dialog", selector: "button[type=submit]" });
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await poll(async () => (await byName())?.notes === "Diubah oleh tes e2e", "catatan pelanggan tidak tersimpan");

    await click(`Hapus ${name}`, { within: "main" });
    await page.waitForSelector("dialog[open]");
    await click("Hapus", { within: "dialog", partial: true, selector: "button.bg-danger, dialog[open] button:last-of-type" });
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await poll(async () => !!(await byName())?.deleted_at, "pelanggan tidak terhapus");
    await waitNoText(name, { root: "main" });
  } finally {
    const left = (await api.live("customers")).filter((c) => c.name === name);
    await api.remove("customers", left.map((c) => c.id));
  }
});

test("pengaturan: sub-menu menampilkan satu kelompok & draf tetap ada saat pindah sub-menu", async () => {
  const outlet = (await api.live("outlets")).sort((a, b) => (a.name < b.name ? -1 : 1))[0];
  const sel = 'textarea[id$="-footer"]';
  const visible = (q) => page.$eval(q, (el) => el.offsetParent !== null).catch(() => false);
  await go(`/dasbor/pengaturan?outlet=${outlet.id}`);
  await page.waitForSelector(sel, { visible: true });
  assert(!(await visible("#pajak")), "kelompok Pajak tampil di sub-menu Outlet & struk");
  const before = await page.$eval(sel, (e) => e.value);
  const draft = `${before} draf-e2e-${RUN}`;
  await fillSel(sel, draft);

  await click("Pajak & biaya", { within: "aside", selector: "a" });
  await page.waitForSelector("#pajak", { visible: true });
  assert(!(await visible(sel)), "kelompok Outlet & struk masih tampil di sub-menu Pajak & biaya");
  await poll(async () => (await page.title()) === "Pajak & biaya · Pengaturan · Dasbor Sissi", `judul tab browser (${await page.title()})`);

  await click("Outlet & struk", { within: "aside", selector: "a" });
  await page.waitForSelector(sel, { visible: true });
  eq(await page.$eval(sel, (e) => e.value), draft, "draf yang belum disimpan hilang setelah pindah sub-menu");
  // Buang draf (tanpa menyimpan) agar navigasi berikutnya tidak tertahan peringatan beforeunload.
  await click("Batalkan", { within: "#struk" });
  await poll(async () => (await page.$eval(sel, (e) => e.value)) === before, "Batalkan tidak mengembalikan teks bawah struk");
});

test("navigasi tablet: laci menu di lebar 820 px", async () => {
  await page.setViewport({ width: 820, height: 1180 });
  try {
    await go("/dasbor");
    assert(!(await page.$eval("aside", (el) => el.offsetParent !== null)), "sidebar desktop tampil di tablet");
    await click("Buka menu");
    await page.waitForSelector("dialog[open] nav");
    await click("Tim", { within: "dialog", selector: "button" });
    await click("Jadwal", { within: "dialog", selector: "a" });
    await page.waitForFunction(() => location.pathname === "/dasbor/tim" && new URL(location.href).searchParams.get("tab") === "jadwal");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.waitForFunction(() => document.querySelector("main h1")?.innerText.trim() === "Jadwal");
    // Esc menutup laci.
    await click("Buka menu");
    await page.waitForSelector("dialog[open] nav");
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
  } finally {
    await page.setViewport({ width: 1366, height: 900 });
  }
});

test("navigasi HP: laci menu membuka sub-menu dan tertutup setelah memilih", async () => {
  await page.setViewport({ width: 390, height: 844 });
  try {
    await go("/dasbor/produk");
    assert(!(await page.$eval("aside", (el) => el.offsetParent !== null)), "sidebar desktop tampil di HP");
    await click("Buka menu");
    await page.waitForSelector("dialog[open] nav");
    await click("Stok", { within: "dialog", selector: "button" });
    await click("Opname", { within: "dialog", selector: "a" });
    await page.waitForFunction(() => location.pathname === "/dasbor/stok" && new URL(location.href).searchParams.get("tab") === "opname");
    await page.waitForFunction(() => !document.querySelector("dialog[open]"));
    await page.waitForFunction(() => document.querySelector("main h1")?.innerText.trim() === "Opname");
    eq(await page.$eval("header p", (el) => el.innerText.trim()), "Stok", "label halaman di kepala HP");
    // Di HP, Tabs halaman tetap tampil.
    assert(await page.$eval('main [role="tablist"]', (el) => el.offsetParent !== null), "Tabs halaman tidak tampil di HP");
  } finally {
    await page.setViewport({ width: 1366, height: 900 });
  }
});

test("pengaturan: simpan teks bawah struk lalu kembalikan", async () => {
  const outlets = await api.live("outlets");
  const outlet = outlets.sort((a, b) => (a.name < b.name ? -1 : 1))[0];
  const original = outlet.settings?.receipt?.footer ?? "";
  const marker = `Terima kasih (e2e ${RUN})`;
  const footerOf = async () => (await api.live("outlets")).find((o) => o.id === outlet.id)?.settings?.receipt?.footer ?? "";
  const sel = 'textarea[id$="-footer"]';
  try {
    await go(`/dasbor/pengaturan?outlet=${outlet.id}`);
    await fillSel(sel, marker);
    await submitFormOf(sel);
    await poll(async () => (await footerOf()) === marker, "teks bawah struk tidak tersimpan");
    // Kembalikan lewat UI (muat ulang dulu agar base_updated_at terbaru).
    await go(`/dasbor/pengaturan?outlet=${outlet.id}`);
    eq(await page.$eval(sel, (e) => e.value), marker, "nilai tersimpan tampil setelah muat ulang");
    if (original) await fillSel(sel, original);
    else {
      await fillSel(sel, "x");
      await page.$eval(sel, (e) => e.focus());
      await page.keyboard.press("Backspace");
    }
    await submitFormOf(sel);
    await poll(async () => (await footerOf()) === original, "teks bawah struk tidak kembali ke semula");
  } finally {
    if ((await footerOf()) !== original) {
      const cur = (await api.live("outlets")).find((o) => o.id === outlet.id);
      const settings = { ...cur.settings, receipt: { ...(cur.settings?.receipt ?? {}), footer: original } };
      await api.upsert("outlets", cur.id, { settings }, cur.updated_at);
    }
  }
});

test("pengaturan: unggah logo struk dari web, tersimpan, ikut di PDF, lalu kembalikan", async () => {
  const outlet = (await api.live("outlets")).sort((a, b) => (a.name < b.name ? -1 : 1))[0];
  const original = { logo_url: outlet.settings?.receipt?.logo_url ?? "", logo_style: outlet.settings?.receipt?.logo_style ?? "auto" };
  const logoOf = async () => (await api.live("outlets")).find((o) => o.id === outlet.id)?.settings?.receipt ?? {};
  try {
    await go(`/dasbor/pengaturan?outlet=${outlet.id}`);
    const input = await page.waitForSelector("#struk input[type=file]");
    await input.uploadFile(globalThis.__pngPath);
    await page.waitForFunction((old) => {
      const img = document.querySelector('#struk img[alt="Logo struk"]');
      return img && img.getAttribute("src") && img.getAttribute("src") !== old;
    }, {}, original.logo_url);
    await click("Garis tegas", { within: "#struk" });
    await submitFormOf("#struk input[type=file]");
    await poll(async () => {
      const r = await logoOf();
      return /\/files\/[^/]+\/[^/]+\.png$/.test(r.logo_url ?? "") && r.logo_url !== original.logo_url && r.logo_style === "threshold";
    }, "logo struk tidak tersimpan");


    // PDF dibuat server (logo struk outlet terpilih ikut di kepala): web hanya mengunduh hasilnya.
    const dir = globalThis.__downloads;
    for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true });
    const cdp = await page.createCDPSession();
    await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
    await go(`/dasbor/transaksi?outlet=${outlet.id}`);
    await click("Ekspor", { within: "main" });
    await waitDialog("Ekspor transaksi");
    const req = page.waitForRequest((r) => r.url().includes("/owner/reports/sales.pdf"), { timeout: 15000 });
    await click("Unduh PDF", { within: "dialog", partial: true });
    eq(new URL((await req).url()).searchParams.get("outlet_id"), outlet.id, "PDF diminta dengan outlet terpilih");
    await waitDialogClosed("Ekspor transaksi");
    let file;
    await poll(async () => (file = readdirSync(dir).find((f) => f.endsWith(".pdf") && !f.endsWith(".crdownload"))) !== undefined, "PDF tidak terunduh");
    const logoPdf = readFileSync(join(dir, file));
    if (process.env.E2E_PDF_OUT) writeFileSync(process.env.E2E_PDF_OUT, logoPdf);
    eq(logoPdf.subarray(0, 5).toString(), "%PDF-", "berkas PDF valid");
  } finally {
    const cur = (await api.live("outlets")).find((o) => o.id === outlet.id);
    const r = cur.settings?.receipt ?? {};
    if ((r.logo_url ?? "") !== original.logo_url || (r.logo_style ?? "auto") !== original.logo_style) {
      const settings = { ...cur.settings, receipt: { ...r, ...original } };
      await api.upsert("outlets", cur.id, { settings }, cur.updated_at);
    }
    // Pull sinkron menahan record yang baru berubah beberapa detik (jeda commit di syncapi); tunggu sampai outlet ini
    // terlihat lagi agar tes berikutnya (yang menarik outlets) tidak kehilangan record.
    await poll(async () => (await api.live("outlets")).some((o) => o.id === outlet.id), "outlet belum terlihat lagi di pull");
  }
});

test("aktivitas memuat ringkasan & filter Jenis: Perubahan data", async () => {
  await go("/dasbor/aktivitas");
  await waitText("Perubahan data", { root: "main" });
  await page.waitForFunction(() => !document.querySelector('[aria-label="Memuat ringkasan"]'));
  assert(!(await hasText("Coba lagi", "main")), "ada blok galat di Aktivitas");
  await click("Jenis", { within: "main", partial: true, selector: "button" });
  await click("Perubahan data", { partial: true, selector: "[role=option]" });
  await click("Selesai");
  await page.waitForFunction(() => new URL(location.href).searchParams.get("kind") === "change");
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'));
  const kinds = await page.$$eval("main li[data-kind]", (els) => [...new Set(els.map((e) => e.dataset.kind))]);
  assert(kinds.every((k) => k === "change"), `hanya entri perubahan data (${kinds.join(",")})`);
});

test("aktivitas: kartu ringkasan menjadi pintasan filter Jenis", async () => {
  const day = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(d);
  const from = day(new Date(Date.now() - 29 * 86_400_000));
  await go(`/dasbor/aktivitas?from=${from}&to=${day(new Date())}`);
  await page.waitForFunction(() => !document.querySelector('[aria-label="Memuat ringkasan"]'));
  await click("Kas masuk / keluar", { within: "main", partial: true, selector: "a" });
  await page.waitForFunction(() => new URL(location.href).searchParams.get("kind") === "cash_in,cash_out");
  eq(await page.evaluate(() => new URL(location.href).searchParams.get("from")), from, "periode tetap setelah klik kartu");
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'));
  const kinds = await page.$$eval("main li[data-kind]", (els) => [...new Set(els.map((e) => e.dataset.kind))]);
  assert(kinds.every((k) => k === "cash_in" || k === "cash_out"), `hanya entri kas (${kinds.join(",")})`);
  await waitText("Jenis:", { root: "main" });
  assert(!(await hasText("Jenis: Semua", "main")), "filter Jenis tidak ikut berubah");
});

// ——— Nomor 14: outlet, QRIS (konfirmasi password), batal transaksi, kas shift ———

test("outlet: kuota penuh → tombol Tambah outlet nonaktif dengan penjelasan", async () => {
  await ensureLoggedIn();
  const sub = await api.get("/owner/subscription");
  await go("/dasbor/outlet");
  await waitText("Kelola outlet");
  await waitText(`dari ${sub.limits.outlets} outlet terpakai`);
  const full = sub.usage.outlets >= sub.limits.outlets;
  const disabled = await page.evaluate(() => {
    const b = [...document.querySelectorAll("main button")].find((x) => x.innerText.trim() === "Tambah outlet");
    return b ? b.disabled : null;
  });
  eq(disabled, full, "tombol Tambah outlet nonaktif bila kuota penuh");
  if (full) {
    await waitText("Kuota outlet penuh");
    assert(await page.$('main a[href="/dasbor/langganan"]'), "tautan ke Langganan");
  }
});

test("pengaturan: ubah nama merchant QRIS lewat konfirmasi kata sandi, lalu kembalikan", async () => {
  await ensureLoggedIn();
  const me = await api.get("/owner/auth/me");
  const outletId = me.outlets[0].id;
  const before = (await api.pull("outlets")).find((o) => o.id === outletId);
  const name = `E2E QRIS ${RUN}`;
  try {
    await go(`/dasbor/pengaturan?tab=transaksi&outlet=${outletId}`);
    await page.waitForSelector("#pembayaran", { visible: true });
    await waitText("Ini mengubah tujuan uang pelanggan", { root: "#pembayaran" });
    if (!(await page.$("#pembayaran input[id$='-merchant']"))) await click("QRIS", { within: "#pembayaran", selector: "label" });
    await fillSel("#pembayaran input[id$='-merchant']", name);
    await click("Simpan", { within: "#pembayaran", selector: "button[type=submit]" });
    // Sesi browser baru belum dikonfirmasi → server 422 CONFIRM_REQUIRED → dialog.
    await waitDialog("Konfirmasi kata sandi");
    await fill("Kata sandi", "salah-sekali-123", { within: "dialog" });
    await click("Konfirmasi", { within: "dialog" });
    await waitText("Kata sandi salah", { root: "dialog[open]" });
    await fill("Kata sandi", PASSWORD, { within: "dialog" });
    await click("Konfirmasi", { within: "dialog" });
    await waitDialogClosed("Konfirmasi kata sandi");
    await waitText("Metode pembayaran disimpan.");
    const saved = await poll(async () => {
      const o = (await api.pull("outlets")).find((x) => x.id === outletId);
      return o?.settings?.payment_methods?.qris?.merchant_name === name ? o : null;
    }, "nama merchant tersimpan di server");
    assert(saved.updated_at !== before.updated_at, "record outlet berubah");
  } finally {
    // Kembalikan record outlet persis seperti semula (klien tes perlu konfirmasi sendiri).
    const cur = (await api.pull("outlets")).find((o) => o.id === outletId);
    if (cur && JSON.stringify(cur.settings) !== JSON.stringify(before.settings)) {
      await api.confirm();
      const system = new Set(["id", "business_id", "created_at", "updated_at", "deleted_at"]);
      const data = Object.fromEntries(Object.entries(before).filter(([k]) => !system.has(k)));
      await api.upsert("outlets", outletId, data, cur.updated_at);
    }
  }
});

test("transaksi: ekspor PDF lewat dialog (diunduh dari server dengan filter aktif)", async () => {
  const dir = globalThis.__downloads;
  for (const f of readdirSync(dir)) rmSync(join(dir, f), { force: true });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: dir });
  await go("/dasbor/transaksi");
  await click("Ekspor", { within: "main" });
  await waitDialog("Ekspor transaksi");
  await waitText("transaksi", { root: "dialog[open]" });
  const req = page.waitForRequest((r) => r.url().includes("/owner/reports/sales.pdf"), { timeout: 15000 });
  await click("Unduh PDF", { within: "dialog", partial: true });
  const u = new URL((await req).url());
  assert(u.searchParams.get("from") && u.searchParams.get("to"), "PDF diminta dengan periode aktif");
  assert(!u.searchParams.has("page") && !u.searchParams.has("per_page"), "tanpa page/per_page");
  await waitDialogClosed("Ekspor transaksi");
  let file = null;
  await poll(async () => {
    file = readdirSync(dir).find((f) => f.endsWith(".pdf") && !f.endsWith(".crdownload"));
    return !!file && existsSync(join(dir, file));
  }, "berkas PDF tidak terunduh");
  assert(/-transaksi-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.pdf$/.test(file), `nama berkas: ${file}`);
  const buf = readFileSync(join(dir, file));
  eq(buf.subarray(0, 5).toString(), "%PDF-", "berkas PDF valid");
  assert(buf.length > 1000, "PDF tidak kosong");
  // Simpan salinan untuk diperiksa manual: E2E_PDF_OUT=/jalur/laporan.pdf npm run e2e
  if (process.env.E2E_PDF_OUT) writeFileSync(process.env.E2E_PDF_OUT, buf);
});

test("transaksi: batalkan (void) transaksi lunas dari detail", async () => {
  await ensureLoggedIn();
  // Data demo diisi ulang sesi utama; pembatalan ini memang tidak bisa diurungkan.
  const list = await api.get("/owner/sales?status=paid&per_page=20");
  const sale = list.find((s) => s.payment_method === "qris") ?? list.find((s) => s.payment_method === "cash") ?? list[0];
  assert(sale, "ada transaksi lunas untuk diuji — data demo mungkin basi (>7 hari): jalankan `go run ./cmd/devseed --reset` di sissi-pos-service");
  await go(`/dasbor/transaksi/${sale.id}`);
  await click("Batalkan transaksi", { within: "main" });
  await waitDialog(`Batalkan transaksi · ${sale.receipt_no}`);
  await click("Lanjut", { within: "dialog" });
  await waitText("Alasan wajib diisi.", { root: "dialog[open]" });
  await click("Salah input", { within: "dialog" });
  await click("Lanjut", { within: "dialog" });
  await waitText("Pembatalan tidak bisa diurungkan", { root: "dialog[open]" });
  await click("Batalkan & kembalikan", { within: "dialog", partial: true });
  await waitDialogClosed(`Batalkan transaksi · ${sale.receipt_no}`);
  await waitText("Transaksi dibatalkan");
  const after = await api.get(`/owner/sales/${sale.id}`);
  eq(after.status, "void", "status transaksi");
  eq(after.void_reason, "Salah input", "alasan");
  const net = after.payments.reduce((a, p) => a + p.amount, 0);
  eq(net, 0, "jumlah bersih pembayaran setelah pengembalian");
  assert(after.payments.some((p) => p.amount < 0 && p.method === sale.payment_method), "pengembalian negatif lewat metode asal");
  const acts = await api.activity("kind=void&per_page=100");
  assert(acts.some((a) => a.ref_id === sale.id), "pembatalan muncul di Aktivitas");
});

test("shift: catat kas keluar pada shift yang sedang buka", async () => {
  await ensureLoggedIn();
  const open = await api.get("/owner/shifts?status=open&per_page=5");
  assert(open.length, "ada shift buka di data demo — data demo mungkin basi (>7 hari): jalankan `go run ./cmd/devseed --reset` di sissi-pos-service");
  const shift = open[0];
  const note = `E2E ${RUN}`;
  await go(`/dasbor/shift/${shift.id}`);
  await click("Kas keluar", { within: "main" });
  await waitDialog("Catat kas masuk/keluar");
  await waitText("pastikan kasir mengetahuinya", { root: "dialog[open]" });
  await fill("Nominal", "1000", { within: "dialog" });
  await click("Operasional", { within: "dialog" });
  await fill("Catatan", note, { within: "dialog" });
  await click("Catat kas keluar", { within: "dialog" });
  await waitDialogClosed("Catat kas masuk/keluar");
  await waitText("Kas keluar dicatat.");
  await waitText(`Operasional · ${note}`);
  const detail = await api.get(`/owner/shifts/${shift.id}`);
  const mv = detail.cash_movements.find((m) => m.reason === `Operasional · ${note}`);
  assert(mv && mv.type === "out" && mv.amount === 1000, "kas keluar tersimpan di server");
  eq(detail.cash_out, shift.cash_out + 1000, "kas keluar shift bertambah");
});

test("shift: daftar menandai hitungan server berbeda (bila ada)", async () => {
  await ensureLoggedIn();
  const rows = await api.get("/owner/shifts?per_page=100&status=closed");
  assert(rows.length, "ada shift tutup di data demo — data demo mungkin basi (>7 hari): jalankan `go run ./cmd/devseed --reset` di sissi-pos-service");
  const bad = rows.find((r) => r.expected_mismatch);
  await go("/dasbor/shift?status=closed");
  await page.waitForSelector("main table");
  eq(await hasText("Hitungan server berbeda", "main"), !!bad && rows.indexOf(bad) < 25, "badge selisih hitungan server");
});

// ——— Langganan: dialog bayar Duitku ———
// API lokal belum tentu memuat endpoint pembayaran, dan Duitku tidak boleh disentuh tes: hanya
// /owner/subscription/payment-methods dan /owner/subscription/checkouts* yang di-stub lewat intersepsi request
// puppeteer; login dan semua endpoint lain tetap ke API sungguhan.

const CORS = { "Access-Control-Allow-Origin": BASE, "Access-Control-Allow-Credentials": "true", Vary: "Origin" };
const okJson = (data, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify({ success: true, message: "OK", data }) });
const errJson = (status, code, message) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify({ success: false, message, error: { code } }) });
const QR = "00020101021226670016COM.NOBUBANK.WWW01189360050300000879140214123456789012340303UMI51440014ID.CO.QRIS.WWW0215ID20232345678900303UMI5204581253033605405590005802ID5910Sissi Test6007Jakarta61051234062070703A0163041234";
const METHODS = {
  cycle: "monthly",
  price: 59000,
  methods: [
    { code: "SP", name: "QRIS", kind: "qris", image: "https://images.duitku.com/hotlink-ok/SP.PNG", fee: 0, total: 59000 },
    { code: "BC", name: "BCA Virtual Account", kind: "va", image: "https://images.duitku.com/hotlink-ok/BCA.SVG", fee: 5000, total: 64000 },
    { code: "M2", name: "Mandiri Virtual Account", kind: "va", image: "https://images.duitku.com/hotlink-ok/BROKEN.PNG", fee: 3000, total: 62000 },
    { code: "I1", name: "BNI Virtual Account", kind: "va", image: "https://images.duitku.com/hotlink-ok/I1.PNG", fee: 3000, total: 62000 },
    { code: "BR", name: "BRI Virtual Account", kind: "va", image: "https://images.duitku.com/hotlink-ok/BR.PNG", fee: 3000, total: 62000 },
    { code: "B1", name: "CIMB Niaga Virtual Account", kind: "va", image: "https://images.duitku.com/hotlink-ok/B1.PNG", fee: 3000, total: 62000 },
    { code: "BT", name: "Permata Virtual Account", kind: "va", image: "", fee: 3000, total: 62000 },
    { code: "OV", name: "OVO", kind: "ewallet", image: "https://images.duitku.com/hotlink-ok/OV.PNG", fee: 1500, total: 60500 },
  ],
};
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
const SVG_STUB = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="20"><rect width="40" height="20" fill="#06c"/></svg>';
const checkout = (over = {}) => ({
  id: "ck-e2e-1",
  cycle: "monthly",
  method: "SP",
  kind: "qris",
  status: "pending",
  price: 59000,
  service_fee: 0,
  total: 59000,
  qr_string: QR,
  pay_code: null,
  payment_url: null,
  expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
  period_end: null,
  ...over,
});

/** Pasang stub pembayaran di `page`. `h` = { methods(), create(body), get(id), subscription?(real) }; kembalikan fungsi pelepas. */
async function stubPayments(h) {
  await page.setRequestInterception(true);
  const log = { created: [], reads: 0 };
  const onReq = async (req) => {
    if (req.isInterceptResolutionHandled()) return;
    const u = new URL(req.url());
    // Logo Duitku: jangan keluar jaringan. BROKEN → 404 (menguji onError), .SVG → svg, sisanya PNG 1px.
    if (u.hostname === "images.duitku.com") {
      if (u.pathname.includes("BROKEN")) return req.respond({ status: 404, body: "" });
      if (u.pathname.toUpperCase().endsWith(".SVG")) return req.respond({ status: 200, contentType: "image/svg+xml", body: SVG_STUB });
      return req.respond({ status: 200, contentType: "image/png", body: PNG_1PX });
    }
    const isApi = req.url().startsWith(API);
    const path = isApi ? u.pathname.replace(/^.*\/owner/, "") : "";
    const isPay = path === "/subscription/payment-methods" || path.startsWith("/subscription/checkouts");
    const isSub = path === "/subscription" && h.subscription;
    if (!isPay && !isSub) return req.continue();
    if (req.method() === "OPTIONS") {
      return req.respond({
        status: 204,
        headers: { ...CORS, "Access-Control-Allow-Headers": "content-type, x-sissi-owner, idempotency-key", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" },
      });
    }
    try {
      if (isSub) return req.respond(okJson(await h.subscription()));
      if (path === "/subscription/payment-methods") return req.respond(await h.methods());
      if (path === "/subscription/checkouts" && req.method() === "POST") {
        const body = JSON.parse(req.postData() || "{}");
        log.created.push(body);
        return req.respond(await h.create(body));
      }
      const id = decodeURIComponent(path.split("/").pop());
      log.reads++;
      return req.respond(await h.get(id));
    } catch (e) {
      return req.respond(errJson(500, "INTERNAL", String(e)));
    }
  };
  page.on("request", onReq);
  return {
    log,
    async off() {
      page.off("request", onReq);
      await page.setRequestInterception(false);
    },
  };
}

const dlgText = () => page.evaluate(() => [...document.querySelectorAll("dialog[open]")].pop()?.innerText ?? "");
async function waitDlg(text, timeout = TIMEOUT) {
  await waitText(text, { root: "dialog[open]", timeout });
}
const rp = (n) => `Rp${n.toLocaleString("id-ID")}`;
/** Buka halaman, pilih paket Bulanan (bawaan Tahunan), tekan "Bayar Rp…" → dialog pilih metode. */
async function openPayDialog() {
  await go("/dasbor/langganan");
  await waitText("Bayar Rp", { root: "main" });
  await click("Bulanan", { within: "main", selector: "label" , partial: true});
  await click("Bayar Rp", { within: "main", partial: true });
  await waitDialog("Pilih cara bayar");
}
const rowCount = () => page.evaluate(() => document.querySelectorAll("main table tbody tr").length);

test("langganan: kartu bayar tanpa transfer", async () => {
  await ensureLoggedIn();
  await go("/dasbor/langganan");
  await waitText("Bayar Rp", { root: "main" });
  for (const t of ["Bayar sekarang", "Konfirmasi lewat WhatsApp", "Transfer ke", "Harga belum termasuk PPN", "dicatat tim Sissi"]) {
    assert(!(await hasText(t, "main")), `teks lama masih ada: ${t}`);
  }
});

test("langganan: QRIS tanpa biaya", async () => {
  await ensureLoggedIn();
  const stub = await stubPayments({ methods: () => okJson(METHODS), create: () => okJson(checkout(), 201), get: () => okJson(checkout()) });
  try {
    await openPayDialog();
    await waitDlg("Virtual Account");
    await click("QRIS", { within: "dialog", partial: true });
    await waitDlg("Total Rp59.000");
    await page.waitForSelector("dialog[open] svg[role=img]", { visible: true });
    assert(!(await hasText("Biaya layanan", "dialog[open]")), "QRIS tidak boleh menampilkan biaya");
    assert(/\b\d{1,2}:\d{2}\b/.test(await dlgText()), "hitung mundur tidak tampil");
    assert(stub.log.created[0].method === "SP" && stub.log.created[0].cycle === "monthly" && !("amount" in stub.log.created[0]), "badan POST salah");
  } finally {
    await stub.off();
  }
});

test("langganan: VA dengan biaya", async () => {
  await ensureLoggedIn();
  const va = checkout({ id: "ck-e2e-va", method: "BC", kind: "va", service_fee: 5000, total: 64000, qr_string: null, pay_code: "8001234567890123" });
  const stub = await stubPayments({ methods: () => okJson(METHODS), create: () => okJson(va, 201), get: () => okJson(va) });
  try {
    await openPayDialog();
    await click("BCA", { within: "dialog", partial: true });
    await waitDlg("8001234567890123");
    const t = await dlgText();
    for (const x of ["Rp59.000", "Rp5.000", "Rp64.000"]) assert(t.includes(x), `rincian tanpa ${x}`);
    await click("Salin nomor virtual account", { within: "dialog" });
  } finally {
    await stub.off();
  }
});

test("langganan: lunas", async () => {
  await ensureLoggedIn();
  let paid = false;
  const q = () => checkout({ id: "ck-e2e-paid", ...(paid ? { status: "paid", period_end: "2026-12-06" } : {}) });
  const real = await api.get("/owner/subscription");
  const stub = await stubPayments({
    methods: () => okJson(METHODS),
    create: () => okJson(q(), 201),
    get: () => okJson(q()),
    // Riwayat ikut berubah setelah lunas (API lokal tidak tahu pembayaran stub).
    subscription: () => ({
      ...real,
      billing: real.billing && {
        ...real.billing,
        payments: paid
          ? [{ id: "pay-e2e", paid_at: new Date().toISOString(), amount: 59000, service_fee: 5000, cycle: "monthly", period_start: "2026-11-06", period_end: "2026-12-06", method: "gateway", status: "recorded" }, ...real.billing.payments]
          : real.billing.payments,
      },
    }),
  });
  try {
    await openPayDialog();
    const before = await rowCount();
    await click("QRIS", { within: "dialog", partial: true });
    await waitDlg("Total Rp59.000");
    paid = true; // polling berikutnya (≤ 4 dtk) membaca paid
    await waitDlg("Pembayaran diterima", 12_000);
    await poll(async () => (await rowCount()) === before + 1, "riwayat tidak bertambah");
    assert(await hasText("+ biaya Rp5.000", "main"), "riwayat tanpa biaya layanan");
    await click("Selesai", { within: "dialog" });
  } finally {
    await stub.off();
  }
});

test("langganan: kedaluwarsa", async () => {
  await ensureLoggedIn();
  const expires_at = new Date(Date.now() + 3_000).toISOString();
  const q = () => checkout({ id: "ck-e2e-exp", expires_at });
  const stub = await stubPayments({ methods: () => okJson(METHODS), create: () => okJson(q(), 201), get: () => okJson(q()) });
  try {
    await openPayDialog();
    await click("QRIS", { within: "dialog", partial: true });
    await waitDlg("Buat QR baru", 10_000);
    await sleep(1_500); // satu pembacaan terakhir saat hitung mundur habis
    const reads = stub.log.reads;
    await sleep(9_000); // > 2 interval polling
    assert(stub.log.reads === reads, "polling belum berhenti setelah kedaluwarsa");
  } finally {
    await stub.off();
  }
});

test("langganan: gateway gagal", async () => {
  await ensureLoggedIn();
  let fail = true;
  const stub = await stubPayments({
    methods: () => okJson(METHODS),
    create: () => (fail ? errJson(502, "PAYMENT_GATEWAY_ERROR", "Penyedia pembayaran sedang bermasalah.") : okJson(checkout(), 201)),
    get: () => okJson(checkout()),
  });
  try {
    await openPayDialog();
    await click("QRIS", { within: "dialog", partial: true });
    await waitDlg("Coba lagi");
    assert((await dialogTitle()) === "Pilih cara bayar", "dialog tertutup saat gateway gagal");
    fail = false;
    await click("Coba lagi", { within: "dialog" });
    await waitDlg("Total Rp59.000");
  } finally {
    await stub.off();
  }
});

test("langganan: fitur mati", async () => {
  await ensureLoggedIn();
  const stub = await stubPayments({ methods: () => errJson(503, "PAYMENT_UNAVAILABLE", "x"), create: () => errJson(503, "PAYMENT_UNAVAILABLE", "x"), get: () => errJson(503, "PAYMENT_UNAVAILABLE", "x") });
  try {
    await openPayDialog();
    await waitDlg("Pembayaran online belum tersedia, hubungi tim Sissi");
  } finally {
    await stub.off();
  }
});

test("langganan: kembali dari e-wallet", async () => {
  await ensureLoggedIn();
  const ck = checkout({ id: "ck-e2e-ret", method: "OV", kind: "ewallet", service_fee: 1500, total: 60500, qr_string: null, payment_url: "https://example.invalid/pay" });
  const stub = await stubPayments({ methods: () => okJson(METHODS), create: () => okJson(ck, 201), get: (id) => (id === "ck-e2e-ret" ? okJson(ck) : errJson(404, "CHECKOUT_NOT_FOUND", "Tidak ada")) });
  try {
    await go("/dasbor/langganan?checkout=ck-e2e-ret");
    await waitDialog("Lanjut ke e-wallet");
    await waitDlg("Rp60.500");
    await page.waitForFunction(() => !location.search, { timeout: TIMEOUT });
    // Id tak dikenal diabaikan diam-diam.
    await go("/dasbor/langganan?checkout=tidak-ada");
    await waitText("Bayar Rp", { root: "main" });
    await sleep(800);
    assert(!(await page.$("dialog[open]")), "dialog terbuka untuk checkout 404");
    await page.waitForFunction(() => !location.search, { timeout: TIMEOUT });
  } finally {
    await stub.off();
  }
});

test("langganan: kartu paket berupa radio, Tahunan bawaan, tombol mengikuti pilihan", async () => {
  await ensureLoggedIn();
  const real = await api.get("/owner/subscription");
  const pr = real.billing?.prices;
  assert(pr, "demo tanpa harga billing");
  await go("/dasbor/langganan");
  await waitText("Bayar Rp", { root: "main" });
  const radios = () => page.$$eval('main input[type=radio][name=pay-cycle]', (els) => els.map((e) => ({ v: e.value, c: e.checked })));
  const r0 = await radios();
  eq(r0.length, 2, "jumlah radio paket");
  const wantDefault = real.status === "active" && real.billing_cycle === "monthly" ? "monthly" : "yearly";
  eq(r0.find((r) => r.c)?.v, wantDefault, "paket bawaan");
  const btnText = () => page.evaluate(() => [...document.querySelectorAll("main button")].find((b) => b.innerText.startsWith("Bayar Rp"))?.innerText.trim());
  eq(await btnText(), `Bayar ${rp(wantDefault === "yearly" ? pr.yearly : pr.monthly)}`, "teks tombol bawaan");
  assert(await hasText("Paling hemat", "main"), "label Paling hemat");
  const saving = pr.monthly * 12 - pr.yearly;
  if (saving > 0) assert(await hasText(`Hemat ${rp(saving)}`, "main"), "label hemat");
  eq(await hasText("2 bulan gratis", "main"), saving === 2 * pr.monthly, "2 bulan gratis hanya bila hemat tepat dua bulan");
  // Keyboard: fokus ke radio terpilih, panah mengubah pilihan.
  await page.focus(`main input[type=radio][value=${wantDefault}]`);
  await page.keyboard.press(wantDefault === "yearly" ? "ArrowUp" : "ArrowDown");
  const other = wantDefault === "yearly" ? "monthly" : "yearly";
  eq((await radios()).find((r) => r.c)?.v, other, "panah mengganti paket");
  eq(await btnText(), `Bayar ${rp(other === "yearly" ? pr.yearly : pr.monthly)}`, "teks tombol mengikuti pilihan");
});

test("langganan: logo metode, ikon cadangan, QRIS generik, Bank lainnya", async () => {
  await ensureLoggedIn();
  const stub = await stubPayments({ methods: () => okJson(METHODS), create: () => okJson(checkout(), 201), get: () => okJson(checkout()) });
  try {
    await openPayDialog();
    await waitDlg("Virtual Account");
    const row = (name) =>
      page.evaluateHandle((n) => [...document.querySelectorAll("dialog[open] ul button")].find((b) => b.innerText.includes(n)) ?? null, name);
    const info = async (name) => {
      const h = await row(name);
      return h.evaluate((b) => (b ? { img: b.querySelectorAll("img").length, svg: b.querySelectorAll("svg").length, text: b.innerText } : null));
    };
    // BCA: logo dimuat (naturalWidth > 0), alt kosong, referrerpolicy.
    await page.waitForFunction(() => { const i = document.querySelector('dialog[open] img[src$="BCA.SVG"]'); return i && i.complete && i.naturalWidth > 0; }, { timeout: TIMEOUT });
    const attrs = await page.$eval('dialog[open] img[src$="BCA.SVG"]', (i) => ({ alt: i.getAttribute("alt"), rp: i.referrerPolicy, lazy: i.loading }));
    eq(JSON.stringify(attrs), JSON.stringify({ alt: "", rp: "no-referrer", lazy: "lazy" }), "atribut img logo");
    // Mandiri: gambar rusak → jatuh ke ikon.
    await page.waitForFunction(() => { const b = [...document.querySelectorAll("dialog[open] ul button")].find((x) => x.innerText.includes("Mandiri")); return b && b.querySelectorAll("img").length === 0 && b.querySelectorAll("svg").length > 0; }, { timeout: TIMEOUT });
    // QRIS: ikon generik, tidak ada img penyedia walau API memberi image.
    const q = await info("Disarankan");
    assert(q && q.img === 0 && q.svg > 0, `baris QRIS harus ikon generik: ${JSON.stringify(q)}`);
    assert(q.text.includes("tanpa biaya"), "QRIS tanpa biaya");
    // Bank lainnya: tertutup → BNI belum ada; buka → ada dan terjangkau keyboard.
    assert(!(await info("BNI")), "BNI tidak boleh ada sebelum dibuka");
    const toggle = '[aria-controls="pay-va-more"]';
    eq(await page.$eval(`dialog[open] ${toggle}`, (b) => b.getAttribute("aria-expanded")), "false", "aria-expanded awal");
    await click("Bank lainnya", { within: "dialog", partial: true });
    eq(await page.$eval(`dialog[open] ${toggle}`, (b) => b.getAttribute("aria-expanded")), "true", "aria-expanded setelah dibuka");
    assert(await info("BNI"), "BNI muncul setelah dibuka");
    await page.focus("dialog[open] #pay-va-more button");
    eq(await page.evaluate(() => document.activeElement?.closest("#pay-va-more") !== null), true, "baris tersembunyi bisa difokus");
    await click("Bank lainnya", { within: "dialog", partial: true });
    eq(await page.$eval(`dialog[open] ${toggle}`, (b) => b.getAttribute("aria-expanded")), "false", "aria-expanded setelah ditutup");
  } finally {
    await stub.off();
  }
});

test("langganan: POST e-wallet selesai setelah dialog ditutup tidak mengalihkan halaman", async () => {
  await ensureLoggedIn();
  const ck = checkout({ id: "ck-e2e-late", method: "OV", kind: "ewallet", service_fee: 1500, total: 60500, qr_string: null, payment_url: "https://example.invalid/pay" });
  const stub = await stubPayments({
    methods: () => okJson(METHODS),
    create: async () => {
      await sleep(2_000);
      return okJson(ck, 201);
    },
    get: () => okJson(ck),
  });
  try {
    await openPayDialog();
    await click("OVO", { within: "dialog", partial: true });
    await click("Batal", { within: "dialog" });
    await waitDialogClosed("Pilih cara bayar");
    await poll(async () => stub.log.created.length === 1, "POST belum terkirim");
    await sleep(3_500);
    assert(page.url().startsWith(`${BASE}/dasbor/langganan`), `halaman dialihkan: ${page.url()}`);
  } finally {
    await stub.off();
  }
});

test("langganan: galat selain 404 saat kembali dari e-wallet tampil", async () => {
  await ensureLoggedIn();
  const stub = await stubPayments({ methods: () => okJson(METHODS), create: () => okJson(checkout(), 201), get: () => errJson(500, "INTERNAL", "Terjadi gangguan.") });
  try {
    await go("/dasbor/langganan?checkout=ck-e2e-500");
    await waitDialog("Status pembayaran");
    await waitDlg("Coba lagi");
    await sleep(1_000);
    assert(await page.$("dialog[open]"), "dialog galat hilang");
    assert((await dlgText()).includes("Coba lagi"), "galat harus tetap tampil");
  } finally {
    await stub.off();
  }
});

test("keluar: konfirmasi Keluar kembali ke halaman masuk", async () => {
  await ensureLoggedIn();
  await click("Keluar", { selector: "aside button" });
  await waitDialog("Keluar dari dasbor?");
  await click("Keluar", { within: "dialog" });
  await page.waitForFunction(() => location.pathname === "/masuk", { timeout: TIMEOUT });
  // Sesi benar-benar berakhir: /dasbor mengarah kembali ke /masuk.
  await go("/dasbor");
  await page.waitForFunction(() => location.pathname === "/masuk", { timeout: TIMEOUT });
});

// ——— Main ———

async function cleanupLeftovers() {
  for (const entity of ["products", "customers", "categories"]) {
    const rows = (await api.live(entity)).filter((r) => typeof r.name === "string" && r.name.startsWith(PREFIX));
    if (rows.length) {
      console.log(`  (membersihkan ${rows.length} ${entity} sisa run sebelumnya)`);
      await api.remove(entity, rows.map((r) => r.id));
    }
  }
}

async function main() {
  const profile = mkdtempSync(join(tmpdir(), "sissi-e2e-"));
  const fixtures = mkdtempSync(join(tmpdir(), "sissi-e2e-files-"));
  const png = join(fixtures, "foto-e2e.png");
  writeFileSync(png, makePng(64, 64, [240, 120, 40]));
  globalThis.__pngPath = png;
  globalThis.__downloads = mkdtempSync(join(fixtures, "unduhan-"));

  try {
    await api.login();
  } catch (e) {
    console.error(`Tidak bisa masuk ke API ${API} sebagai ${EMAIL}: ${e.message}\nLihat e2e/README.md (prasyarat).`);
    process.exit(2);
  }
  await cleanupLeftovers();

  browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: !HEADFUL,
    userDataDir: profile,
    args: ["--no-first-run", "--no-default-browser-check", "--disable-features=Translate", "--lang=id-ID"],
  });
  page = await newPage();

  const selected = tests.filter((t) => !ONLY || t.name.toLowerCase().includes(ONLY) || t.name.startsWith("login: benar"));
  let pass = 0;
  const failures = [];
  const t0 = Date.now();
  for (const t of selected) {
    const waited = await rateBudget(t.budget ?? 60);
    if (waited > 1000) console.log(`  … menunggu ${(waited / 1000).toFixed(0)} dtk (batas laju API ${RATE_LIMIT}/menit)`);
    const start = Date.now();
    const hits0 = apiTotal;
    consoleErrors.length = 0;
    failedRequests.length = 0;
    try {
      await t.fn();
      pass++;
      console.log(`  ✓ ${t.name} (${Date.now() - start} ms, ${apiTotal - hits0} request API)`);
    } catch (e) {
      failures.push(t.name);
      console.log(`  ✗ ${t.name} (${Date.now() - start} ms)\n      ${String(e?.message ?? e).split("\n").join("\n      ")}`);
      if (failedRequests.length) console.log(`      request gagal: ${failedRequests.slice(0, 5).join(" | ")}`);
      if (consoleErrors.length) console.log(`      console: ${consoleErrors.slice(0, 5).join(" | ")}`);
      const shot = join(fixtures, `gagal-${failures.length}.png`);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
      console.log(`      tangkapan layar: ${shot}`);
      // Pulihkan: tutup dialog yang masih terbuka.
      await page.keyboard.press("Escape").catch(() => {});
    }
  }
  await browser.close();
  rmSync(profile, { recursive: true, force: true });
  try {
    await cleanupLeftovers();
  } catch {
    // abaikan
  }
  console.log(`\n${pass} lulus, ${failures.length} gagal dari ${selected.length} tes (${((Date.now() - t0) / 1000).toFixed(1)} dtk, run ${RUN})`);
  if (failures.length) {
    console.log(`Gagal: ${failures.join("; ")}\nBerkas tangkapan layar: ${fixtures}`);
    process.exit(1);
  }
  rmSync(fixtures, { recursive: true, force: true });
}

main().catch(async (e) => {
  console.error(e);
  await browser?.close().catch(() => {});
  process.exit(1);
});
