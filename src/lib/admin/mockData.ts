// Data contoh untuk server tiruan Admin platform (lihat mock.ts). Deterministik (seed tetap) supaya tangkapan
// layar stabil, tetapi waktu dihitung relatif terhadap saat modul dimuat agar "terakhir terlihat" tetap segar.
import type {
  AccountDeletion,
  AdminListItem,
  AdminRef,
  AppVersionConfig,
  AuditEntry,
  BusinessDetail,
  CrashEvent,
  CrashGroup,
  Features,
  PaymentProvider,
  Release,
} from "./types";

export const NOW = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;
export const PUBLIC_URL = "https://apipos.sissi.id/unduh";

export const isoAgo = (ms: number) => new Date(NOW - ms).toISOString();
export const daysAgo = (d: number) => isoAgo(d * DAY);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hex(seed: number, len = 64): string {
  const r = rng(seed);
  let out = "";
  for (let i = 0; i < len; i++) out += Math.floor(r() * 16).toString(16);
  return out;
}

const uuid = (prefix: string, n: number) =>
  `${prefix}${String(n).padStart(8 - prefix.length, "0")}-1c2d-4e5f-8a9b-${hex(n * 31 + prefix.charCodeAt(0), 12)}`;

// ——— Admin ———

export const ADMINS: AdminListItem[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    email: "feggy@sissi.id",
    name: "Feggy",
    active: true,
    must_change_password: false,
    created_at: daysAgo(120),
    created_by: null,
    last_login_at: isoAgo(2 * HOUR),
    active_sessions: 2,
    is_me: false,
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    email: "rina@sissi.id",
    name: "Rina Wulandari",
    active: true,
    must_change_password: false,
    created_at: daysAgo(90),
    created_by: null,
    last_login_at: daysAgo(1),
    active_sessions: 1,
    is_me: false,
  },
  {
    id: "a0000000-0000-4000-8000-000000000003",
    email: "dimas@sissi.id",
    name: "Dimas Pratama",
    active: true,
    must_change_password: true,
    created_at: daysAgo(1),
    created_by: { id: "a0000000-0000-4000-8000-000000000001", email: "feggy@sissi.id", name: "Feggy" },
    last_login_at: null,
    active_sessions: 0,
    is_me: false,
  },
  {
    id: "a0000000-0000-4000-8000-000000000004",
    email: "tono@sissi.id",
    name: "Tono Saputra",
    active: false,
    must_change_password: false,
    created_at: daysAgo(200),
    created_by: null,
    last_login_at: daysAgo(64),
    active_sessions: 0,
    is_me: false,
  },
];

export const refOf = (a: { id: string; email: string; name: string }): AdminRef => ({
  id: a.id,
  email: a.email,
  name: a.name,
});

// ——— Versi & rilis ———

export const VERSIONS: Record<number, string> = {
  42: "1.4.2",
  41: "1.4.1",
  40: "1.4.0",
  38: "1.3.8",
  35: "1.3.5",
  33: "1.3.3",
};

function release(version: string, build: number, days: number, size: number, sha: boolean, by: AdminRef): Release {
  const file = `sissi-pos-${version}+${build}-arm64.apk`;
  return {
    file,
    version,
    build,
    abi: "arm64",
    size_bytes: size,
    sha256: sha ? hex(build * 7919) : null,
    released_at: daysAgo(days),
    is_latest: false,
    uploaded_by: sha ? by : null,
    url: `${PUBLIC_URL}/${file}`,
  };
}

export function makeReleases(): Release[] {
  const me = refOf(ADMINS[0]);
  const rina = refOf(ADMINS[1]);
  const list = [
    release("1.4.2", 42, 3, 48_213_771, true, me),
    release("1.4.1", 41, 11, 48_002_115, true, rina),
    release("1.4.0", 40, 26, 47_690_302, false, me),
    release("1.3.5", 35, 49, 46_118_870, false, me),
  ];
  list[0].is_latest = true;
  return list;
}

export function makeVersion(): AppVersionConfig {
  return {
    platform: "android",
    latest_build: 42,
    min_build: 35,
    latest_version: "1.4.2",
    store_url: "https://play.google.com/store/apps/details?id=id.sissi.pos",
    message: "Versi baru tersedia: cetak struk lebih cepat dan perbaikan sinkron.",
    apk_url: "https://apipos.sissi.id/unduh/sissi-pos-latest.apk",
    source: "db",
    updated_at: daysAgo(3),
    updated_by: refOf(ADMINS[0]),
  };
}

// ——— Bisnis ———

const NAMES: [string, string, string][] = [
  ["Kopi Senja", "culinary", "Kafe"],
  ["Warung Bu Ani", "culinary", "Warung makan"],
  ["Toko Berkah Jaya", "retail", "Toko kelontong"],
  ["Barbershop Rapi", "service", "Pangkas rambut"],
  ["Laundry Kilat", "service", "Laundry"],
  ["Sewa Kamera Bandung", "rental", "Peralatan"],
  ["Mie Ayam Pak Kumis", "culinary", "Warung makan"],
  ["Roti Hangat", "culinary", "Toko roti"],
  ["Apotek Sehat", "retail", "Apotek"],
  ["Kedai Teh Tarik", "culinary", "Kafe"],
  ["Futsal Arena 7", "rental", "Lapangan"],
  ["Bengkel Maju Motor", "service", "Bengkel"],
  ["Toko Buku Pena", "retail", "Toko buku"],
  ["Bakso Mas Joko", "culinary", "Warung makan"],
  ["Salon Cantika", "service", "Salon"],
  ["Ayam Geprek Juara", "culinary", "Restoran"],
  ["Distro Kota", "retail", "Pakaian"],
  ["Sate Madura Cak Mat", "culinary", "Warung makan"],
  ["Cuci Mobil Kinclong", "service", "Cuci kendaraan"],
  ["Rental PS Gamer", "rental", "Hiburan"],
  ["Es Kopi Nusantara", "culinary", "Kafe"],
  ["Toko Tani Subur", "retail", "Pertanian"],
  ["Pecel Lele Lamongan", "culinary", "Warung makan"],
  ["Studio Foto Kenang", "service", "Fotografi"],
  ["Martabak Bangka 88", "culinary", "Jajanan"],
  ["Toko Elektronik Terang", "retail", "Elektronik"],
  ["Kos Putri Melati", "rental", "Kos"],
  ["Soto Betawi H. Ma'ruf", "culinary", "Restoran"],
  ["Petshop Meong", "retail", "Hewan peliharaan"],
  ["Jahit Rapi Bu Sri", "service", "Penjahit"],
  ["Nasi Padang Sederhana", "culinary", "Restoran"],
  ["Minimarket Sinar", "retail", "Minimarket"],
];
const CITIES = ["Depok", "Bogor", "Malang", "Solo", "Medan", "Makassar", "Bekasi", "Semarang"];
const OWNERS = ["Andi", "Ani Lestari", "Budi Santoso", "Rudi Hartono", "Sinta", "Dewi Anggraini", "Joko", "Maya Sari"];
const STAFF = ["Kasir Pagi", "Kasir Sore", "Dapur", "Putri", "Agus", "Lina"];
const DEVICE_NAMES = ["Kasir depan", "Layar dapur", "Tablet bar", "HP pemilik", "Kasir 2"];
const DEVICE_MODES = ["main_cashier", "kitchen", "cashier", "owner", "cashier"];
const BUILD_POOL = [42, 42, 42, 42, 42, 41, 41, 41, 40, 40, 38, 35, 33, 33];

export function makeBusinesses(): BusinessDetail[] {
  const r = rng(7);
  return Array.from({ length: 64 }, (_, i) => {
    const [base, type, category] = NAMES[i % NAMES.length];
    const name = i < NAMES.length ? base : `${base} ${CITIES[i % CITIES.length]}`;
    const id = uuid("b", i + 1);
    const ownerName = OWNERS[i % OWNERS.length];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const createdDays = 3 + Math.floor((63 - i) * 4.2 + r() * 3);
    // Pola aktivitas: ~55% aktif 7 hari, ~20% aktif 30 hari, sisanya tidak aktif / belum pernah.
    const bucket = r();
    const lastActiveDays = bucket < 0.55 ? r() * 6 : bucket < 0.75 ? 8 + r() * 20 : bucket < 0.93 ? 35 + r() * 60 : null;
    const outletsCount = 1 + (i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0);
    const devicesCount = lastActiveDays === null ? (i % 2) : 1 + Math.floor(r() * 4);
    const so = i % 3 === 0 || i % 7 === 2;
    const provider: PaymentProvider | null = so ? (i % 2 === 0 ? "midtrans" : i % 5 === 0 ? "xendit" : "manual") : null;
    const features: Features = {
      self_order: so,
      online_payment: so && (provider === "midtrans" || provider === "xendit"),
      provider,
      updated_at: so ? daysAgo(Math.min(createdDays - 1, 2 + (i % 20))) : null,
    };
    const outlets = Array.from({ length: outletsCount }, (_, k) => ({
      id: uuid(`o${k}`, i + 1),
      name: k === 0 ? "Pusat" : `Cabang ${["Timur", "Barat", "Selatan"][k - 1]}`,
      status: k === 2 && i % 2 === 0 ? "closed" : "open",
      created_at: daysAgo(Math.max(0.2, createdDays - k * 3)),
      devices_count: 0,
    }));
    const devices = Array.from({ length: devicesCount }, (_, k) => {
      const outlet = outlets[k % outlets.length];
      outlet.devices_count += 1;
      const seenDays = lastActiveDays === null ? 40 + k * 10 : lastActiveDays + k * r() * 2;
      const unknown = r() < 0.08;
      const build = BUILD_POOL[Math.floor(r() * BUILD_POOL.length)];
      return {
        id: uuid(`d${k}`, i + 1),
        name: DEVICE_NAMES[k % DEVICE_NAMES.length],
        mode: DEVICE_MODES[k % DEVICE_MODES.length],
        outlet_id: outlet.id,
        last_seen_at: lastActiveDays === null && k > 0 ? null : daysAgo(seenDays),
        app: unknown
          ? null
          : {
              build,
              version: VERSIONS[build] ?? null,
              platform: "android",
              seen_at: daysAgo(seenDays + r() * 0.04),
            },
      };
    });
    const usersCount = 1 + Math.floor(r() * 5);
    const users = Array.from({ length: usersCount }, (_, k) => ({
      id: uuid(`u${k}`, i + 1),
      name: k === 0 ? ownerName : STAFF[(i + k) % STAFF.length],
      email: k === 0 ? `${slug}@gmail.com` : k % 2 === 0 ? `staf${k}.${slug}@gmail.com` : null,
      phone: k === 0 ? `+62812${String(30000000 + i * 104729).slice(0, 8)}` : k % 2 === 1 ? null : `+62857${String(1000000 + i * 7 + k).padStart(8, "0")}`,
      role: k === 0 ? "owner" : k % 3 === 2 ? "kitchen" : "cashier",
      is_active: k === 0 || k % 4 !== 3,
      created_at: daysAgo(createdDays - k),
    }));
    const lastActive = lastActiveDays === null ? null : daysAgo(lastActiveDays);
    return {
      id,
      name,
      type,
      category,
      created_at: daysAgo(createdDays),
      owner: {
        id: users[0].id,
        name: ownerName,
        email: `${slug}@gmail.com`,
        phone: users[0].phone ?? "",
        email_verified: i % 6 !== 4,
        last_login_at: lastActive,
      },
      outlets_count: outletsCount,
      devices_count: devicesCount,
      users_count: usersCount,
      employees_count: usersCount - 1,
      last_active_at: lastActive,
      features,
      deletion: null,
      outlets,
      devices,
      users,
      stats: {
        sales_30d: lastActiveDays === null ? 0 : lastActiveDays > 30 ? 0 : Math.floor(40 + r() * 1400),
        crashes_30d: Math.floor(r() * r() * 9),
      },
      audit: [],
    };
  });
}

// ——— Antrean hapus akun ———

export function makeDeletions(businesses: BusinessDetail[]): AccountDeletion[] {
  const sched = (b: BusinessDetail, requestedDays: number, reason: string, source: "web" | "app"): AccountDeletion => {
    const purge = NOW + (30 - requestedDays) * DAY;
    b.deletion = {
      id: uuid("x", businesses.indexOf(b) + 1),
      requested_at: daysAgo(requestedDays),
      purge_after: new Date(purge).toISOString(),
      source,
      reason,
    };
    return {
      id: b.deletion.id!,
      status: "scheduled",
      business: { id: b.id, name: b.name },
      owner: b.owner ? { id: b.owner.id, name: b.owner.name, email: b.owner.email, phone: b.owner.phone } : null,
      source,
      reason,
      requested_at: b.deletion.requested_at!,
      purge_after: b.deletion.purge_after,
      canceled_at: null,
      purged_at: null,
      days_left: Math.max(0, Math.ceil((purge - NOW) / DAY)),
    };
  };
  const canceled = (b: BusinessDetail, n: number): AccountDeletion => ({
    id: uuid("y", n),
    status: "canceled",
    business: { id: b.id, name: b.name },
    owner: b.owner ? { id: b.owner.id, name: b.owner.name, email: b.owner.email, phone: b.owner.phone } : null,
    source: "app",
    reason: "Salah pencet, masih dipakai.",
    requested_at: daysAgo(20 + n),
    purge_after: daysAgo(-10 + n),
    canceled_at: daysAgo(19 + n),
    purged_at: null,
    days_left: null,
  });
  const purged = (n: number): AccountDeletion => ({
    id: uuid("z", n),
    status: "purged",
    business: null,
    owner: null,
    source: n % 2 ? "web" : "app",
    reason: n % 2 ? "Usaha tutup." : "",
    requested_at: daysAgo(40 + n * 9),
    purge_after: daysAgo(10 + n * 9),
    canceled_at: null,
    purged_at: daysAgo(10 + n * 9),
    days_left: null,
  });
  return [
    sched(businesses[6], 25, "Pindah ke aplikasi lain.", "app"),
    sched(businesses[21], 4, "Usaha berhenti sementara.", "web"),
    sched(businesses[45], 12, "", "app"),
    canceled(businesses[3], 1),
    canceled(businesses[14], 2),
    purged(1),
    purged(2),
    purged(3),
  ];
}

// ——— Crash ———

type CrashSeed = {
  title: string;
  frame: string;
  kind: "flutter" | "platform";
  firstDays: number;
  weight: number;
  status?: "resolved" | "ignored";
  note?: string;
  platform?: string;
  builds: number[];
};

const CRASHES: CrashSeed[] = [
  { title: "Null check operator used on a null value", frame: "package:sissi_app/features/sales/screens/checkout_screen.dart:212", kind: "flutter", firstDays: 12, weight: 9, builds: [41, 42] },
  { title: "Bad state: No element", frame: "package:sissi_app/features/menu/controllers/menu_controller.dart:88", kind: "flutter", firstDays: 40, weight: 5, builds: [38, 40, 41, 42] },
  { title: "SqliteException(2067): UNIQUE constraint failed: outbox.id", frame: "package:sissi_app/core/sync/outbox_repository.dart:141", kind: "flutter", firstDays: 6, weight: 7, note: "Kambuh di build 42", builds: [41, 42] },
  { title: "PlatformException(PRINTER_DISCONNECTED, Bluetooth socket closed, null, null)", frame: "package:sissi_app/features/printer/data/bt_printer.dart:64", kind: "platform", firstDays: 30, weight: 6, builds: [35, 38, 40, 41, 42] },
  { title: "RangeError (index): Invalid value: Not in inclusive range 0..#: #", frame: "package:sissi_app/features/cart/widgets/cart_list.dart:57", kind: "flutter", firstDays: 0.4, weight: 4, builds: [42] },
  { title: "DioException [connection timeout]: The request connection took longer than #", frame: "package:sissi_app/core/network/retry_interceptor.dart:33", kind: "flutter", firstDays: 55, weight: 8, status: "ignored", note: "Jaringan pengguna; ditangani retry.", builds: [33, 35, 38, 40, 41, 42] },
  { title: "type 'Null' is not a subtype of type 'String' in type cast", frame: "package:sissi_app/features/reports/models/report_row.dart:22", kind: "flutter", firstDays: 18, weight: 3, status: "resolved", note: "Diperbaiki parsing laporan.", builds: [40, 41] },
  { title: "FileSystemException: Cannot open file, path = '[path]' (OS Error: No space left on device)", frame: "package:sissi_app/core/db/backup_service.dart:90", kind: "platform", firstDays: 9, weight: 2, builds: [41, 42] },
  { title: "setState() called after dispose(): _KitchenBoardState#", frame: "package:sissi_app/features/kitchen/screens/kitchen_board.dart:301", kind: "flutter", firstDays: 21, weight: 4, builds: [40, 41, 42] },
  { title: "Looking up a deactivated widget's ancestor is unsafe.", frame: "package:sissi_app/shared/dialogs/confirm_sheet.dart:45", kind: "flutter", firstDays: 14, weight: 2, builds: [41, 42] },
  { title: "FormatException: Invalid radix-10 number (at character #)", frame: "package:sissi_app/features/products/widgets/price_field.dart:73", kind: "flutter", firstDays: 33, weight: 1, status: "resolved", note: "", builds: [38, 40] },
  { title: "java.lang.IllegalStateException: Reply already submitted", frame: "", kind: "platform", firstDays: 3, weight: 2, builds: [42] },
  { title: "Stack Overflow", frame: "package:sissi_app/features/stock/controllers/stock_tree.dart:118", kind: "flutter", firstDays: 25, weight: 1, status: "ignored", note: "Data uji internal.", builds: [40] },
  { title: "HandshakeException: Handshake error in client (OS Error: CERTIFICATE_VERIFY_FAILED)", frame: "package:sissi_app/core/network/api_client.dart:51", kind: "flutter", firstDays: 48, weight: 2, builds: [33, 35] },
  { title: "Unhandled Exception: MissingPluginException(No implementation found for method scan on channel barcode)", frame: "package:sissi_app/features/products/screens/scan_screen.dart:39", kind: "flutter", firstDays: 7, weight: 3, platform: "ios", builds: [42] },
  { title: "LateInitializationError: Field '_session@#' has not been initialized.", frame: "package:sissi_app/features/auth/controllers/session_controller.dart:27", kind: "flutter", firstDays: 1.5, weight: 5, builds: [42] },
  { title: "Concurrent modification during iteration: Instance(length:#) of '_GrowableList'", frame: "package:sissi_app/features/sales/controllers/split_bill.dart:160", kind: "flutter", firstDays: 60, weight: 1, status: "resolved", note: "", builds: [35, 38] },
];

export type CrashRecord = {
  group: CrashGroup;
  /** 90 hari, indeks 0 = 89 hari lalu, terakhir = hari ini. */
  daily90: number[];
  /** build → jumlah (90 hari). */
  perBuild: Record<number, number>;
  businesses: { id: string; name: string | null; count: number }[];
  events: CrashEvent[] | null;
};

export function makeCrashes(businesses: BusinessDetail[]): CrashRecord[] {
  return CRASHES.map((c, i) => {
    const r = rng(100 + i);
    const daily90 = Array.from({ length: 90 }, (_, d) => {
      const age = 89 - d;
      if (age > c.firstDays) return 0;
      if (c.status === "resolved" && age < 5 + (i % 4)) return 0;
      const wave = 1 + Math.sin((d + i * 3) / 3.1) * 0.6;
      const recentBoost = c.note?.startsWith("Kambuh") && age < 3 ? 3 : 1;
      return Math.max(0, Math.round(c.weight * wave * recentBoost * (0.4 + r() * 1.2) - 1));
    });
    if (c.firstDays < 1) daily90[89] = Math.max(daily90[89], 6);
    const total = daily90.reduce((a, b) => a + b, 0) || 1;
    // Build terbaru mendapat porsi terbesar; tiap build minimal 1.
    const perBuild: Record<number, number> = {};
    const weights = c.builds.map((_, k) => (k + 1) * (0.6 + r()));
    const sumW = weights.reduce((a, b) => a + b, 0);
    c.builds.forEach((b, k) => (perBuild[b] = Math.max(1, Math.round((total * weights[k]) / sumW))));
    const lastActiveAge = daily90.length - 1 - [...daily90].reverse().findIndex((v) => v > 0);
    const lastSeenDays = daily90.some((v) => v > 0) ? 89 - lastActiveAge + r() * 0.5 : c.firstDays;
    const bizCount = Math.min(10, 1 + Math.floor(total / 6));
    const bizz = Array.from({ length: bizCount }, (_, k) => {
      const b = businesses[(i * 7 + k * 5) % businesses.length];
      return { id: b.id, name: k === bizCount - 1 && i % 5 === 0 ? null : b.name, count: Math.max(1, Math.round(total / (k + 2))) };
    });
    const status = c.status ?? "open";
    const builds = Object.keys(perBuild).map(Number).sort((a, b) => a - b);
    const group: CrashGroup = {
      fingerprint: hex(500 + i, 32),
      kind: c.kind,
      platform: c.platform ?? "android",
      title: c.title,
      top_frame: c.frame,
      status,
      first_seen_at: daysAgo(c.firstDays),
      last_seen_at: daysAgo(Math.min(lastSeenDays, c.firstDays)),
      events_count: total,
      events_in_range: 0,
      businesses_count: bizCount,
      builds: { first: builds[0] ?? null, last: builds[builds.length - 1] ?? null },
      last_version: VERSIONS[builds[builds.length - 1]] ?? null,
      sparkline: daily90.slice(76),
      resolved_in_build: status === "resolved" ? 41 + (i % 2) : null,
      status_note: c.note ?? "",
      status_by: status === "open" ? null : refOf(ADMINS[i % 2]),
      status_at: status === "open" ? null : daysAgo(4 + (i % 3)),
    };
    return { group, daily90, perBuild, businesses: bizz, events: null };
  });
}

const ROLES = ["owner", "cashier", "cashier", "kitchen", null];
const OS = ["Android 13 (SDK 33)", "Android 14 (SDK 34)", "Android 11 (SDK 30)", "Android 12 (SDK 31)"];

export function makeEvents(rec: CrashRecord, seed: number): CrashEvent[] {
  const r = rng(900 + seed);
  const g = rec.group;
  const builds = Object.keys(rec.perBuild).map(Number).sort((a, b) => b - a);
  const lastSeen = Date.parse(g.last_seen_at);
  const n = Math.min(20, Math.max(1, g.events_count));
  let t = lastSeen;
  return Array.from({ length: n }, (_, k) => {
    if (k > 0) t -= HOUR * (2 + r() * 20);
    const at = new Date(t).toISOString();
    const build = builds[Math.min(builds.length - 1, Math.floor(r() * r() * builds.length))] ?? null;
    const biz = rec.businesses[Math.floor(r() * rec.businesses.length)];
    const frame = g.top_frame || "dart:core/errors_patch.dart:51";
    return {
      id: `${hex(seed * 100 + k, 8)}-${hex(k, 4)}-4${hex(seed, 3)}-8${hex(k + 1, 3)}-${hex(seed + k, 12)}`,
      received_at: at,
      occurred_at: k % 4 === 3 ? null : new Date(Date.parse(at) - 2000 - r() * 60_000).toISOString(),
      build,
      version: build ? (VERSIONS[build] ?? null) : null,
      platform: g.platform,
      os_version: g.platform === "ios" ? "iOS 17.5" : OS[Math.floor(r() * OS.length)],
      flavor: "prod",
      kind: g.kind,
      business: biz ? { id: biz.id, name: biz.name } : null,
      role: ROLES[Math.floor(r() * ROLES.length)],
      message: g.title.replace(/#/g, String(Math.floor(r() * 90) + 3)) + (k % 3 === 0 ? " — pelanggan [email]" : ""),
      stack: [
        `#0      ${frame.replace(/:(\d+)$/, ":$1:9")}`,
        "#1      _CheckoutController.submit (package:sissi_app/features/sales/controllers/checkout_controller.dart:96:14)",
        "#2      <asynchronous suspension>",
        "#3      ProviderElementBase._notifyListeners (package:riverpod/src/framework/element.dart:504:24)",
        "#4      _rootRunUnary (dart:async/zone.dart:1422:47)",
        "#5      _CustomZone.runUnary (dart:async/zone.dart:1324:19)",
        "#6      Future._propagateToListeners.handleValueCallback (dart:async/future_impl.dart:840:45)",
        "#7      GestureRecognizer.invokeCallback (package:flutter/src/gestures/recognizer.dart:344:24)",
        "#8      TapGestureRecognizer.handleTapUp (package:flutter/src/gestures/tap.dart:652:11)",
        "#9      BaseTapGestureRecognizer._checkUp (package:flutter/src/gestures/tap.dart:309:5)",
      ].join("\n"),
    };
  });
}

// ——— Audit ———

export function makeAudit(businesses: BusinessDetail[], releases: Release[], crashes: CrashRecord[]): AuditEntry[] {
  const me = refOf(ADMINS[0]);
  const rina = refOf(ADMINS[1]);
  const r = rng(42);
  const templates: [string, string, () => string, (who: AdminRef | null) => Record<string, unknown>][] = [
    ["auth.login", "admin", () => me.id, () => ({})],
    ["business_features.update", "business", () => businesses[Math.floor(r() * 20)].id, () => ({
      before: { self_order: false, online_payment: false, provider: null },
      after: { self_order: true, online_payment: false, provider: "manual" },
    })],
    ["crash.status", "crash", () => crashes[Math.floor(r() * crashes.length)].group.fingerprint, () => ({
      before: { status: "open" },
      after: { status: "resolved", resolved_in_build: 41 },
    })],
    ["auth.login_failed", "admin", () => rina.id, () => ({ reason: "password" })],
    ["app_version.update", "app_version", () => "android", () => ({
      before: { latest_build: 41, min_build: 35, source: "db" },
      after: { latest_build: 42, min_build: 35 },
    })],
    ["release.upload", "release", () => releases[0].file, () => ({ file: releases[0].file, size: releases[0].size_bytes, make_latest: true })],
    ["auth.logout", "admin", () => rina.id, () => ({})],
    ["admin.reset_password", "admin", () => ADMINS[2].id, () => ({ via: "web" })],
    ["auth.login", "admin", () => rina.id, () => ({})],
    ["release.delete", "release", () => "sissi-pos-1.3.4+34-arm64.apk", () => ({ file: "sissi-pos-1.3.4+34-arm64.apk" })],
    ["admin.create", "admin", () => ADMINS[2].id, () => ({ via: "web", after: { email: ADMINS[2].email, name: ADMINS[2].name } })],
    ["admin.disable", "admin", () => ADMINS[3].id, () => ({ via: "web" })],
  ];
  const out: AuditEntry[] = [];
  let t = NOW - 25 * 60_000;
  for (let i = 0; i < 132; i++) {
    const [action, target_type, target, detail] = templates[i % templates.length];
    const who = action === "auth.login_failed" && i % 2 === 0 ? null : i % 3 === 1 ? rina : me;
    out.push({
      id: `e${String(i).padStart(7, "0")}-0000-4000-8000-${hex(i, 12)}`,
      admin: who,
      action,
      target_type,
      target_id: target(),
      detail: detail(who),
      created_at: new Date(t).toISOString(),
    });
    t -= HOUR * (1 + r() * 9);
  }
  // Riwayat bisnis: beberapa entri pertama menunjuk Kopi Senja agar tab Aktivitas tidak kosong.
  for (const e of out.slice(0, 40)) if (e.action === "business_features.update") e.target_id = businesses[0].id;
  return out;
}

export const TEMP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function tempPassword(): string {
  const bytes = new Uint32Array(20);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => TEMP_ALPHABET[b % TEMP_ALPHABET.length]);
  chars[3] = "ABCDEFGHJKMNPQRSTUVWXYZ"[bytes[0] % 23];
  chars[8] = "abcdefghijkmnpqrstuvwxyz"[bytes[1] % 24];
  chars[13] = "23456789"[bytes[2] % 8];
  chars[17] = "-_."[bytes[3] % 3];
  return chars.join("");
}
