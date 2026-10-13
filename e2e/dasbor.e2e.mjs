#!/usr/bin/env node
// Tes e2e dasbor pemilik lewat browser sungguhan (puppeteer-core + Chrome sistem). Menangkap bug yang lolos curl:
// CORS/preflight, cookie lintas port, dialog <dialog>, alur klik & keyboard. Prasyarat & cara jalan: e2e/README.md.
//
//   npm run e2e                     # semua tes, headless
//   E2E_HEADFUL=1 npm run e2e       # tampilkan browser
//   E2E_ONLY=produk npm run e2e     # hanya tes yang namanya memuat "produk" (tes login tetap jalan bila perlu)
//
// Setiap tes membersihkan data yang dibuatnya (nama berawalan "E2E "). Sisa dari run gagal sebelumnya dihapus di awal.

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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
  await fill("Password", PASSWORD);
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

test("login: password salah menampilkan pesan", async () => {
  await page.deleteCookie(...(await page.cookies("http://localhost:8000")));
  await go("/masuk");
  await fill("Email atau nomor HP", EMAIL);
  await fill("Password", "salah-sekali-123");
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
  await waitText("Omzet hari ini");
  await waitText("Transaksi");
  const kpi = await page.evaluate(() => /Omzet hari ini\s+Rp[\d.]+/.test(document.querySelector("main").innerText));
  assert(kpi, "nilai omzet hari ini (Rp…) tidak tampil");
  assert(!(await hasText("Coba lagi", "main")), "ada blok galat di Beranda");
});

test("laporan memuat & ganti periode (filter tunggal tanpa ruang kosong)", async () => {
  await go("/dasbor/laporan");
  await waitText("Omzet · 7 hari terakhir");
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
  await waitText("Omzet · 30 hari terakhir");
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

test("aktivitas memuat ringkasan & chip Perubahan data", async () => {
  await go("/dasbor/aktivitas");
  await waitText("Perubahan data", { root: "main" });
  await page.waitForFunction(() => !document.querySelector('[aria-label="Memuat ringkasan"]'));
  assert(!(await hasText("Coba lagi", "main")), "ada blok galat di Aktivitas");
  await click("Perubahan data", { within: "[aria-label='Jenis aktivitas']", partial: true });
  await page.waitForFunction(() => new URL(location.href).searchParams.get("kind") === "change");
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]'));
  const kinds = await page.$$eval("main li[data-kind]", (els) => [...new Set(els.map((e) => e.dataset.kind))]);
  assert(kinds.every((k) => k === "change"), `hanya entri perubahan data (${kinds.join(",")})`);
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

test("pengaturan: ubah nama merchant QRIS lewat konfirmasi password, lalu kembalikan", async () => {
  await ensureLoggedIn();
  const me = await api.get("/owner/auth/me");
  const outletId = me.outlets[0].id;
  const before = (await api.pull("outlets")).find((o) => o.id === outletId);
  const name = `E2E QRIS ${RUN}`;
  try {
    await go(`/dasbor/pengaturan?outlet=${outletId}`);
    await page.waitForSelector("#pembayaran", { visible: true });
    await waitText("Ini mengubah tujuan uang pelanggan", { root: "#pembayaran" });
    if (!(await page.$("#pembayaran input[id$='-merchant']"))) await click("QRIS", { within: "#pembayaran", selector: "label" });
    await fillSel("#pembayaran input[id$='-merchant']", name);
    await click("Simpan", { within: "#pembayaran", selector: "button[type=submit]" });
    // Sesi browser baru belum dikonfirmasi → server 422 CONFIRM_REQUIRED → dialog.
    await waitDialog("Konfirmasi password");
    await fill("Password", "salah-sekali-123", { within: "dialog" });
    await click("Konfirmasi", { within: "dialog" });
    await waitText("Password salah", { root: "dialog[open]" });
    await fill("Password", PASSWORD, { within: "dialog" });
    await click("Konfirmasi", { within: "dialog" });
    await waitDialogClosed("Konfirmasi password");
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

test("transaksi: batalkan (void) transaksi lunas dari detail", async () => {
  await ensureLoggedIn();
  // Data demo diisi ulang sesi utama; pembatalan ini memang tidak bisa diurungkan.
  const list = await api.get("/owner/sales?status=paid&per_page=20");
  const sale = list.find((s) => s.payment_method === "qris") ?? list.find((s) => s.payment_method === "cash") ?? list[0];
  assert(sale, "ada transaksi lunas untuk diuji");
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
  assert(open.length, "ada shift buka di data demo");
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
  const bad = rows.find((r) => r.expected_mismatch);
  await go("/dasbor/shift?status=closed");
  await page.waitForSelector("main table");
  eq(await hasText("Hitungan server berbeda", "main"), !!bad && rows.indexOf(bad) < 25, "badge selisih hitungan server");
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
  for (const entity of ["products", "customers"]) {
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
