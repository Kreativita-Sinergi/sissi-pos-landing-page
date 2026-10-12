// Server tiruan Admin platform untuk mencoba /admin tanpa sissi-service.
// Hanya dimuat bila NEXT_PUBLIC_ADMIN_MOCK=1 (lihat api.ts). Data hidup di memori tab; sesi di localStorage.
//
// Login contoh: email apa saja + password apa saja (≥ 1 karakter), kecuali:
//   password "salah"        → 401 INVALID_CREDENTIALS
//   email memuat "kunci"    → 429 terkunci 15 menit
// Unggah APK: nama berkas memuat "rusak" → 422 INVALID_APK; versi+build yang sudah ada → 409 RELEASE_EXISTS.
import { ApiError } from "@/lib/sissiApi";
import type { AdminApi } from "./api";
import type {
  Admin,
  AppVersionConfig,
  AuditEntry,
  BusinessDetail,
  Features,
  PaymentProvider,
  Release,
} from "./types";

const SESSION_KEY = "sissi-admin-mock:session";
const PUBLIC_URL = "https://apipos.sissi.id/unduh";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ME: Admin = {
  id: "a0000000-0000-4000-8000-000000000001",
  email: "feggy@sissi.id",
  name: "Feggy",
  last_login_at: "2026-10-11T09:12:00Z",
};
const RINA = { id: "a0000000-0000-4000-8000-000000000002", email: "rina@sissi.id", name: "Rina" };
const meRef = { id: ME.id, email: ME.email, name: ME.name };

const iso = (daysAgo: number, hour = 9) => {
  const d = new Date(Date.UTC(2026, 9, 12, hour, 0, 0) - daysAgo * 86_400_000);
  return d.toISOString().replace(".000Z", "Z");
};

function hex(seed: number): string {
  let s = seed >>> 0;
  let out = "";
  for (let i = 0; i < 64; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    out += ((s >>> 16) & 15).toString(16);
  }
  return out;
}

function release(version: string, build: number, daysAgo: number, size: number, sha: boolean, by = meRef): Release {
  const file = `sissi-pos-${version}+${build}-arm64.apk`;
  return {
    file,
    version,
    build,
    abi: "arm64",
    size_bytes: size,
    sha256: sha ? hex(build * 7919) : null,
    released_at: iso(daysAgo, 8),
    is_latest: false,
    uploaded_by: sha ? by : null,
    url: `${PUBLIC_URL}/${file}`,
  };
}

const NAMES = [
  ["Kopi Senja", "kuliner", "Kafe"],
  ["Warung Bu Ani", "kuliner", "Warung makan"],
  ["Toko Berkah Jaya", "ritel", "Toko kelontong"],
  ["Barbershop Rapi", "jasa", "Pangkas rambut"],
  ["Laundry Kilat", "jasa", "Laundry"],
  ["Sewa Kamera Bandung", "penyewaan", "Peralatan"],
  ["Mie Ayam Pak Kumis", "kuliner", "Warung makan"],
  ["Roti Hangat", "kuliner", "Toko roti"],
  ["Apotek Sehat", "ritel", "Apotek"],
  ["Kedai Teh Tarik", "kuliner", "Kafe"],
  ["Futsal Arena 7", "penyewaan", "Lapangan"],
  ["Bengkel Maju Motor", "jasa", "Bengkel"],
  ["Toko Buku Pena", "ritel", "Toko buku"],
  ["Bakso Mas Joko", "kuliner", "Warung makan"],
  ["Salon Cantika", "jasa", "Salon"],
  ["Ayam Geprek Juara", "kuliner", "Restoran"],
  ["Distro Kota", "ritel", "Pakaian"],
  ["Sate Madura Cak Mat", "kuliner", "Warung makan"],
  ["Cuci Mobil Kinclong", "jasa", "Cuci kendaraan"],
  ["Rental PS Gamer", "penyewaan", "Hiburan"],
  ["Es Kopi Nusantara", "kuliner", "Kafe"],
  ["Toko Tani Subur", "ritel", "Pertanian"],
  ["Pecel Lele Lamongan", "kuliner", "Warung makan"],
  ["Studio Foto Kenang", "jasa", "Fotografi"],
  ["Martabak Bangka 88", "kuliner", "Jajanan"],
  ["Toko Elektronik Terang", "ritel", "Elektronik"],
  ["Kos Putri Melati", "penyewaan", "Kos"],
  ["Soto Betawi H. Ma'ruf", "kuliner", "Restoran"],
  ["Petshop Meong", "ritel", "Hewan peliharaan"],
  ["Jahit Rapi Bu Sri", "jasa", "Penjahit"],
  ["Nasi Padang Sederhana", "kuliner", "Restoran"],
  ["Minimarket Sinar", "ritel", "Minimarket"],
] as const;

function makeBusinesses(): BusinessDetail[] {
  return NAMES.map(([name, type, category], i) => {
    const id = `b${String(i + 1).padStart(7, "0")}-1c2d-4e5f-8a9b-${String(100000000000 + i * 7919).slice(0, 12)}`;
    const ownerName = ["Andi", "Ani Lestari", "Budi Santoso", "Rudi", "Sinta", "Dewi", "Joko", "Maya"][i % 8];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const devices = 1 + ((i * 3) % 4);
    const outlets = 1 + (i % 5 === 0 ? 2 : 0);
    const active = i % 4 !== 3;
    const so = i % 3 === 0;
    const provider: PaymentProvider | null = so ? (i % 2 === 0 ? "midtrans" : "manual") : null;
    const features: Features = {
      self_order: so,
      online_payment: so && provider === "midtrans",
      provider,
      updated_at: so ? iso(i + 2) : null,
    };
    const outletList = Array.from({ length: outlets }, (_, k) => ({
      id: `${id.slice(0, 8)}-o${k}`,
      name: k === 0 ? "Outlet utama" : `Cabang ${k}`,
      status: "active",
      created_at: iso(120 - i * 3 + k),
    }));
    return {
      id,
      name,
      type,
      category,
      created_at: iso(120 - i * 3),
      owner: {
        id: `${id.slice(0, 8)}-u0`,
        name: ownerName,
        email: `${slug}@gmail.com`,
        phone: `62812${String(30000000 + i * 104729).slice(0, 8)}`,
      },
      outlets_count: outlets,
      devices_count: devices,
      users_count: 1 + (i % 4),
      last_active_at: active ? iso(i % 6, 14) : i % 8 === 7 ? null : iso(20 + i),
      features,
      deletion: i === 6 ? { purge_after: iso(-24) } : null,
      outlets: outletList,
      devices: Array.from({ length: devices }, (_, k) => ({
        id: `${id.slice(0, 8)}-d${k}`,
        name: ["Kasir depan", "Layar dapur", "Tablet bar", "HP pemilik"][k % 4],
        mode: ["cashier", "kitchen", "cashier", "owner"][k % 4],
        outlet_id: outletList[0].id,
        last_seen_at: active ? iso(k, 15) : null,
      })),
      users: Array.from({ length: 1 + (i % 4) }, (_, k) => ({
        id: `${id.slice(0, 8)}-u${k}`,
        name: k === 0 ? ownerName : ["Kasir Pagi", "Kasir Sore", "Dapur"][(k - 1) % 3],
        email: k === 0 ? `${slug}@gmail.com` : `staf${k}.${slug}@gmail.com`,
        role: k === 0 ? "owner" : k === 3 ? "kitchen" : "cashier",
        created_at: iso(110 - i * 3 + k),
      })),
    };
  });
}

type State = {
  version: AppVersionConfig;
  releases: Release[];
  businesses: BusinessDetail[];
  audit: AuditEntry[];
};

function initialState(): State {
  const releases = [
    release("1.4.2", 42, 3, 48_213_771, true),
    release("1.4.1", 41, 11, 48_002_115, true, RINA),
    release("1.4.0", 40, 26, 47_690_302, false),
    release("1.3.5", 35, 49, 46_118_870, false),
  ];
  releases[0].is_latest = true;
  const version: AppVersionConfig = {
    platform: "android",
    latest_build: 42,
    min_build: 35,
    latest_version: "1.4.2",
    store_url: "https://play.google.com/store/apps/details?id=id.sissi.pos",
    message: "Versi baru tersedia: cetak struk lebih cepat dan perbaikan sinkron.",
    apk_url: "https://apipos.sissi.id/unduh/sissi-pos-latest.apk",
    source: "db",
    updated_at: iso(3, 8),
    updated_by: meRef,
  };
  const businesses = makeBusinesses();
  const actions: [string, string, string, Record<string, unknown>][] = [
    ["release.upload", "release", releases[0].file, { file: releases[0].file, size: releases[0].size_bytes, sha256: releases[0].sha256, make_latest: true }],
    ["app_version.update", "app_version", "android", { before: { latest_build: 41, min_build: 35, source: "db" }, after: { latest_build: 42, min_build: 35 } }],
    ["business_features.update", "business", businesses[0].id, { before: { self_order: false, online_payment: false, provider: null }, after: { self_order: true, online_payment: true, provider: "midtrans" } }],
    ["auth.login", "admin", ME.id, {}],
    ["auth.login_failed", "admin", RINA.id, { reason: "password" }],
    ["release.delete", "release", "sissi-pos-1.3.4+34-arm64.apk", { file: "sissi-pos-1.3.4+34-arm64.apk" }],
    ["auth.logout", "admin", RINA.id, {}],
    ["admin.create", "admin", RINA.id, { via: "cli" }],
  ];
  const audit: AuditEntry[] = [];
  for (let i = 0; i < 64; i++) {
    const [action, target_type, target_id, detail] = actions[i % actions.length];
    const who = action === "admin.create" ? null : i % 3 === 1 ? RINA : meRef;
    const at = new Date(Date.UTC(2026, 9, 12, 8, 30) - i * 5.5 * 3_600_000).toISOString().replace(".000Z", "Z");
    audit.push({ id: `e${String(i).padStart(7, "0")}-0000-4000-8000-000000000000`, admin: who, action, target_type, target_id, detail, created_at: at });
  }
  return { version, releases, businesses, audit };
}

let state: State | null = null;
const db = () => (state ??= initialState());

function readSession(): boolean {
  try {
    return localStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}
function writeSession(on: boolean) {
  try {
    if (on) localStorage.setItem(SESSION_KEY, "1");
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Penyimpanan diblokir — sesi tiruan hanya hidup selama halaman.
  }
}

function log(action: string, target_type: string, target_id: string, detail: Record<string, unknown>) {
  db().audit.unshift({
    id: crypto.randomUUID?.() ?? String(Date.now()),
    admin: meRef,
    action,
    target_type,
    target_id,
    detail,
    created_at: new Date().toISOString(),
  });
}

const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function createMockApi(onUnauthorized: () => void): AdminApi {
  async function guard() {
    await sleep(250);
    if (!readSession()) {
      onUnauthorized();
      throw new ApiError("Sesi berakhir. Silakan masuk lagi.", 401, "UNAUTHORIZED");
    }
  }
  const session = () => ({
    expires_at: new Date(Date.now() + 12 * 3_600_000).toISOString(),
    idle_expires_at: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  });

  return {
    async login(email, password) {
      await sleep(500);
      if (email.toLowerCase().includes("kunci")) {
        throw new ApiError("Terlalu banyak percobaan masuk.", 429, "RATE_LIMITED", [], 900);
      }
      if (password === "salah" || !password) {
        throw new ApiError("Email atau password salah.", 401, "INVALID_CREDENTIALS");
      }
      writeSession(true);
      log("auth.login", "admin", ME.id, {});
      return { admin: { ...ME, email: email.trim().toLowerCase() || ME.email }, session: session() };
    },
    async logout() {
      await sleep(200);
      writeSession(false);
    },
    async me() {
      await sleep(250);
      if (!readSession()) throw new ApiError("Belum masuk.", 401, "UNAUTHORIZED");
      return { admin: ME, session: session() };
    },
    async summary() {
      await guard();
      const s = db();
      return {
        businesses_total: s.businesses.length,
        businesses_active_7d: s.businesses.filter((b) => b.last_active_at && Date.parse(b.last_active_at) > Date.parse(iso(7))).length,
        devices_active_7d: 61,
        app_version: s.version,
        latest_release: s.releases.find((r) => r.is_latest) ?? null,
      };
    },
    async audit(q) {
      await guard();
      const page = q.page ?? 1;
      const perPage = Math.min(q.per_page ?? 50, 100);
      const rows = db().audit.filter(
        (e) =>
          (!q.action || e.action === q.action) &&
          (!q.target_type || e.target_type === q.target_type) &&
          (!q.target_id || e.target_id === q.target_id) &&
          (!q.admin_id || e.admin?.id === q.admin_id)
      );
      return { items: rows.slice((page - 1) * perPage, page * perPage), meta: { page, per_page: perPage, total: rows.length } };
    },
    async appVersion() {
      await guard();
      return db().version;
    },
    async saveAppVersion(body) {
      await guard();
      const s = db();
      const details: { field: string; message: string }[] = [];
      if (!VERSION_RE.test(body.latest_version)) details.push({ field: "latest_version", message: "Format harus x.y.z." });
      if (body.min_build > body.latest_build) details.push({ field: "min_build", message: "Tidak boleh lebih besar dari build terbaru." });
      if (!body.store_url.startsWith("https://")) details.push({ field: "store_url", message: "Harus diawali https://." });
      if (body.apk_url && !body.apk_url.startsWith("https://")) details.push({ field: "apk_url", message: "Harus diawali https://." });
      if (details.length) throw new ApiError("Data tidak valid.", 422, "VALIDATION_ERROR", details);
      if (body.min_build > s.version.min_build && !body.confirm_min_raise) {
        throw new ApiError(
          `Build di bawah ${body.min_build} akan berhenti sinkron sampai diperbarui.`,
          409,
          "CONFIRMATION_REQUIRED"
        );
      }
      const warnings: string[] = [];
      const top = Math.max(0, ...s.releases.map((r) => r.build));
      if (body.latest_build > top) warnings.push("APK build ini belum diunggah.");
      if (body.latest_build < s.version.latest_build) warnings.push("Build terbaru diturunkan.");
      if (body.min_build > 0 && body.min_build === body.latest_build) warnings.push("Semua pengguna versi lama dipaksa memperbarui sekaligus.");
      const before = s.version;
      s.version = {
        ...before,
        latest_build: body.latest_build,
        min_build: body.min_build,
        latest_version: body.latest_version,
        store_url: body.store_url,
        message: body.message,
        apk_url: body.apk_url,
        source: "db",
        updated_at: new Date().toISOString(),
        updated_by: meRef,
      };
      log("app_version.update", "app_version", "android", { before: { latest_build: before.latest_build, min_build: before.min_build }, after: { latest_build: body.latest_build, min_build: body.min_build } });
      return { config: s.version, warnings };
    },
    async releases() {
      await guard();
      const s = db();
      const releases = [...s.releases].sort((a, b) => b.released_at.localeCompare(a.released_at));
      return { latest: releases.find((r) => r.is_latest) ?? null, releases };
    },
    uploadApk(input, onProgress) {
      let aborted = false;
      let rejectFn: ((e: unknown) => void) | null = null;
      const promise = new Promise<Awaited<ReturnType<AdminApi["uploadApk"]>["promise"]>>((resolve, reject) => {
        rejectFn = reject;
        (async () => {
          await guard();
          const total = input.file.size || 48_000_000;
          for (let i = 1; i <= 20; i++) {
            await sleep(120);
            if (aborted) return;
            onProgress(Math.round((total * i) / 20), total);
          }
          await sleep(400);
          const s = db();
          const file = `sissi-pos-${input.version}+${input.build}-${input.abi}.apk`;
          if (input.file.name.includes("rusak")) {
            throw new ApiError("Berkas bukan APK yang sah.", 422, "INVALID_APK", [
              { field: "file", message: "APK tidak bertanda tangan." },
            ]);
          }
          if (s.releases.some((r) => r.file === file)) {
            throw new ApiError("Versi ini sudah pernah diunggah.", 409, "RELEASE_EXISTS");
          }
          const r: Release = {
            file,
            version: input.version,
            build: input.build,
            abi: input.abi,
            size_bytes: total,
            sha256: input.sha256 || hex(input.build * 131),
            released_at: new Date().toISOString(),
            is_latest: input.make_latest,
            uploaded_by: meRef,
            url: `${PUBLIC_URL}/${file}`,
          };
          if (input.make_latest) s.releases.forEach((x) => (x.is_latest = false));
          s.releases.unshift(r);
          // Terbaru + 3 lama.
          const keep = [...s.releases].sort((a, b) => b.released_at.localeCompare(a.released_at)).slice(0, 4);
          s.releases = keep.some((x) => x.is_latest) ? keep : [...keep, ...s.releases.filter((x) => x.is_latest)];
          log("release.upload", "release", file, { file, size: total, sha256: r.sha256, make_latest: input.make_latest });
          let app_version: AppVersionConfig | null = null;
          if (input.update_app_version) {
            s.version = { ...s.version, latest_build: input.build, latest_version: input.version, updated_at: r.released_at, updated_by: meRef, source: "db" };
            app_version = s.version;
          }
          resolve({ release: r, app_version });
        })().catch(reject);
      });
      return {
        promise,
        abort: () => {
          aborted = true;
          rejectFn?.(new ApiError("Unggahan dibatalkan.", 0, "ABORTED"));
        },
      };
    },
    async deleteRelease(file) {
      await guard();
      const s = db();
      const r = s.releases.find((x) => x.file === file);
      if (!r) throw new ApiError("Berkas tidak ditemukan.", 404, "NOT_FOUND");
      if (r.is_latest) throw new ApiError("Versi ini sedang menjadi unduhan terbaru.", 409, "RELEASE_IN_USE");
      s.releases = s.releases.filter((x) => x.file !== file);
      log("release.delete", "release", file, { file });
    },
    async businesses(q) {
      await guard();
      const page = q.page ?? 1;
      const perPage = Math.min(q.per_page ?? 20, 100);
      const needle = (q.q ?? "").trim().toLowerCase();
      const rows = db()
        .businesses.filter(
          (b) =>
            !needle ||
            b.id === needle ||
            b.name.toLowerCase().includes(needle) ||
            b.owner?.email.toLowerCase().includes(needle) ||
            b.owner?.name.toLowerCase().includes(needle) ||
            b.owner?.phone.includes(needle.replace(/^0/, "62"))
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const items = rows.slice((page - 1) * perPage, page * perPage).map((b) => {
        const { outlets, devices, users, ...summary } = b;
        void outlets;
        void devices;
        void users;
        return summary;
      });
      return { items, meta: { page, per_page: perPage, total: rows.length } };
    },
    async business(id) {
      await guard();
      const b = db().businesses.find((x) => x.id === id);
      if (!b) throw new ApiError("Bisnis tidak ditemukan.", 404, "NOT_FOUND");
      return b;
    },
    async saveFeatures(id, body) {
      await guard();
      const b = db().businesses.find((x) => x.id === id);
      if (!b) throw new ApiError("Bisnis tidak ditemukan.", 404, "NOT_FOUND");
      if (body.online_payment && (!body.self_order || !body.provider)) {
        throw new ApiError("Data tidak valid.", 422, "VALIDATION_ERROR", [
          { field: "online_payment", message: "Bayar online butuh Pesan QR aktif dan provider." },
        ]);
      }
      const before = { self_order: b.features.self_order, online_payment: b.features.online_payment, provider: b.features.provider };
      b.features = { ...body, updated_at: new Date().toISOString() };
      log("business_features.update", "business", id, { before, after: body });
      return b.features;
    },
  };
}
