// Server tiruan Admin platform untuk mencoba /admin tanpa sissi-service.
// Hanya dimuat bila NEXT_PUBLIC_ADMIN_MOCK=1 (lihat api.ts). Data hidup di memori tab; sesi di localStorage.
// Bentuk JSON mengikuti kontrak sissi-service/docs/api.md "Admin platform" (tahap 1 + 2).
//
// Login contoh: email apa saja + password apa saja, kecuali:
//   password "salah"                     → 401 INVALID_CREDENTIALS
//   email memuat "kunci"                 → 429 terkunci 15 menit
//   email memuat "baru" / dimas@sissi.id → login dengan password sementara (wajib ganti → /admin/ganti-password)
//   tono@sissi.id                        → admin nonaktif (401)
// Ganti password: password saat ini "salah" → 422. Tambah admin: email "ada@sissi.id" atau yang sudah ada → 409
// ADMIN_EXISTS; email memuat "batas" → 429. Unggah APK: nama berkas memuat "rusak" → 422 INVALID_APK.
import { ApiError } from "@/lib/sissiApi";
import type { AdminApi } from "./api";
import {
  ADMINS,
  hex,
  makeAudit,
  makeBusinesses,
  makeCrashes,
  makeDeletions,
  makeEvents,
  makeReleases,
  makeVersion,
  PUBLIC_URL,
  refOf,
  tempPassword,
  VERSIONS,
  type CrashRecord,
} from "./mockData";
import {
  addMonths,
  computeMetrics,
  currentPlans,
  DAY as DAY_MS,
  effective,
  jkt,
  makeBillingState,
  publicPayment,
  revenueThisMonth,
  toAdminSubscription,
  type BillingState,
  type PaymentRecord,
  type SubRecord,
} from "./mockBilling";
import type {
  AccountDeletion,
  Admin,
  AdminListItem,
  AppVersionConfig,
  AuditEntry,
  BusinessDetail,
  BusinessSummary,
  CrashGroup,
  Release,
} from "./types";

const SESSION_KEY = "sissi-admin-mock:session";
const DAY = 86_400_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type State = {
  version: AppVersionConfig;
  releases: Release[];
  businesses: BusinessDetail[];
  audit: AuditEntry[];
  admins: AdminListItem[];
  crashes: CrashRecord[];
  deletions: AccountDeletion[];
  billing: BillingState;
};

function initialState(): State {
  const releases = makeReleases();
  const businesses = makeBusinesses();
  const deletions = makeDeletions(businesses);
  const crashes = makeCrashes(businesses);
  const audit = makeAudit(businesses, releases, crashes);
  const billing = makeBillingState(businesses);
  seedBillingAudit(billing, audit);
  return {
    version: makeVersion(),
    releases,
    businesses,
    audit,
    admins: ADMINS.map((a) => ({ ...a })),
    crashes,
    deletions,
    billing,
  };
}

/** Entri audit untuk pembayaran contoh 45 hari terakhir (agar tab Langganan & Audit tidak kosong). */
function seedBillingAudit(billing: BillingState, audit: AuditEntry[]) {
  const since = Date.now() - 45 * DAY;
  for (const s of billing.subs.values()) {
    for (const p of s.payments) {
      if (Date.parse(p.created_at) < since) continue;
      audit.push({
        id: `s${p.id.slice(1, 8)}-0000-4000-8000-${p.id.slice(-12)}`,
        admin: p.recorded_by,
        action: "subscription.payment",
        target_type: "business",
        target_id: s.business_id,
        detail: { payment_id: p.id, amount: p.amount, cycle: p.cycle },
        created_at: p.created_at,
      });
      if (p.status === "void" && p.voided_at) {
        audit.push({
          id: `v${p.id.slice(1, 8)}-0000-4000-8000-${p.id.slice(-12)}`,
          admin: p.voided_by,
          action: "subscription.payment_void",
          target_type: "business",
          target_id: s.business_id,
          detail: { payment_id: p.id, reason: p.void_reason },
          created_at: p.voided_at,
        });
      }
    }
  }
  audit.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

let state: State | null = null;
const db = () => (state ??= initialState());

type Session = { id: string; email: string; mcp: boolean };

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    if (raw === "1") return { id: ADMINS[0].id, email: ADMINS[0].email, mcp: false }; // format tahap 1
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}
function writeSession(s: Session | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Penyimpanan diblokir — sesi tiruan hanya hidup selama halaman.
  }
}

function meRecord(): AdminListItem {
  const s = readSession();
  return db().admins.find((a) => a.id === s?.id) ?? db().admins[0];
}

function asAdmin(a: AdminListItem, s: Session | null): Admin {
  return {
    id: a.id,
    email: s?.email ?? a.email,
    name: a.name,
    last_login_at: a.last_login_at,
    must_change_password: s?.mcp ?? false,
  };
}

function log(action: string, target_type: string, target_id: string, detail: Record<string, unknown>) {
  db().audit.unshift({
    id: crypto.randomUUID?.() ?? String(Date.now()),
    admin: refOf(meRecord()),
    action,
    target_type,
    target_id,
    detail,
    created_at: new Date().toISOString(),
  });
}

const invalid = (field: string, message: string) =>
  new ApiError("Data tidak valid.", 422, "VALIDATION_ERROR", [{ field, message }]);

const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** `YYYY-MM-DD` (WIB) atau RFC3339 → ms; `end` = akhir hari untuk tanggal. */
function parseDay(v: string | undefined, end: boolean): number | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return Date.parse(`${v}T${end ? "23:59:59.999" : "00:00:00"}+07:00`);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function page<T>(rows: T[], p = 1, per = 20) {
  const perPage = Math.min(Math.max(1, per), 100);
  return { items: rows.slice((p - 1) * perPage, p * perPage), meta: { page: p, per_page: perPage, total: rows.length } };
}

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();

function summaryOf(b: BusinessDetail): BusinessSummary {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    category: b.category,
    created_at: b.created_at,
    owner: b.owner ? { id: b.owner.id, name: b.owner.name, email: b.owner.email, phone: b.owner.phone } : null,
    outlets_count: b.outlets_count,
    devices_count: b.devices_count,
    users_count: b.users_count,
    last_active_at: b.last_active_at,
    features: b.features,
    deletion: b.deletion ? { purge_after: b.deletion.purge_after } : null,
    subscription: briefOf(b),
  };
}

function briefOf(b: BusinessDetail): BusinessSummary["subscription"] {
  const s = db().billing.subs.get(b.id);
  if (!s) return undefined;
  const a = toAdminSubscription(s, b);
  return { plan: a.plan, status: a.status, ends_at: a.ends_at, billing_cycle: a.billing_cycle };
}

function subOf(id: string): { b: BusinessDetail; s: SubRecord } {
  const b = db().businesses.find((x) => x.id === id);
  const s = b && db().billing.subs.get(id);
  if (!b || !s) throw new ApiError("Bisnis tidak ditemukan.", 404, "NOT_FOUND");
  return { b, s };
}

function snapshot(s: SubRecord) {
  const e = effective(s);
  return { current_period_end: s.current_period_end, trial_ends_at: s.trial_ends_at, status: e.status };
}

function touch(s: SubRecord) {
  s.version += 1;
  s.updated_at = new Date().toISOString();
}

/** Tanggal `YYYY-MM-DD` (WIB) atau RFC3339 → ms; null bila tidak sah. */
function parseWhen(v: string | null | undefined): number | null {
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v === jkt(Date.now()) ? Date.now() : Date.parse(`${v}T09:00:00+07:00`);
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
}

function activeWithin(b: BusinessDetail, days: number) {
  return !!b.last_active_at && Date.parse(b.last_active_at) > Date.now() - days * DAY;
}

/** Perangkat aktif dalam `days` hari dengan info build. */
function activeDevices(days: number) {
  const since = Date.now() - days * DAY;
  const out: { business: string; build: number; seen: string }[] = [];
  let unknown = 0;
  for (const b of db().businesses) {
    for (const d of b.devices) {
      if (d.app && Date.parse(d.app.seen_at) > since) out.push({ business: b.id, build: d.app.build, seen: d.app.seen_at });
      else if (!d.app && d.last_seen_at && Date.parse(d.last_seen_at) > since) unknown++;
    }
  }
  return { devices: out, unknown };
}

function startOfTodayUtc() {
  const t = new Date();
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

function crashInRange(rec: CrashRecord, from: number, to: number): number {
  const day0 = startOfTodayUtc();
  let sum = 0;
  rec.daily90.forEach((n, i) => {
    const day = day0 - (89 - i) * DAY;
    if (day + DAY > from && day <= to) sum += n;
  });
  return sum;
}

export function createMockApi(onUnauthorized: () => void, onPasswordChange: () => void): AdminApi {
  async function guard(opts: { allowMcp?: boolean } = {}) {
    await sleep(220 + Math.random() * 180);
    const s = readSession();
    if (!s) {
      onUnauthorized();
      throw new ApiError("Sesi berakhir. Silakan masuk lagi.", 401, "UNAUTHORIZED");
    }
    if (s.mcp && !opts.allowMcp) {
      onPasswordChange();
      throw new ApiError("Ganti password sementara dulu.", 403, "PASSWORD_CHANGE_REQUIRED");
    }
    return s;
  }
  const session = () => ({
    expires_at: new Date(Date.now() + 12 * 3_600_000).toISOString(),
    idle_expires_at: new Date(Date.now() + 2 * 3_600_000).toISOString(),
  });

  return {
    async login(email, password) {
      await sleep(500);
      const e = email.trim().toLowerCase();
      if (e.includes("kunci")) throw new ApiError("Terlalu banyak percobaan masuk.", 429, "RATE_LIMITED", [], 900);
      if (password === "salah" || !password) throw new ApiError("Email atau password salah.", 401, "INVALID_CREDENTIALS");
      const found = db().admins.find((a) => a.email === e);
      if (found && !found.active) throw new ApiError("Email atau password salah.", 401, "INVALID_CREDENTIALS");
      const rec = found ?? db().admins[0];
      const s: Session = { id: rec.id, email: e || rec.email, mcp: e.includes("baru") || !!found?.must_change_password };
      writeSession(s);
      rec.last_login_at = new Date().toISOString();
      log("auth.login", "admin", rec.id, {});
      return { admin: asAdmin(rec, s), session: session() };
    },
    async logout() {
      await sleep(200);
      writeSession(null);
    },
    async me() {
      await sleep(250);
      const s = readSession();
      if (!s) throw new ApiError("Belum masuk.", 401, "UNAUTHORIZED");
      return { admin: asAdmin(meRecord(), s), session: session() };
    },
    async changeMyPassword(body) {
      const s = await guard({ allowMcp: true });
      await sleep(400);
      if (body.current_password === "salah") throw invalid("current_password", "Password saat ini salah");
      if (body.new_password.length < 12) throw invalid("new_password", "Minimal 12 karakter.");
      if (body.new_password === body.current_password) throw invalid("new_password", "Harus berbeda dari password lama.");
      const rec = meRecord();
      const forced = s.mcp;
      rec.must_change_password = false;
      rec.active_sessions = 1;
      const next = { ...s, mcp: false };
      writeSession(next);
      log("admin.passwd", "admin", rec.id, { via: "web", forced });
      return { admin: asAdmin(rec, next), session: { expires_at: session().expires_at } };
    },
    async summary() {
      await guard();
      const s = db();
      const crashes24 = s.crashes.filter((c) => c.daily90[89] > 0 || c.daily90[88] > 0);
      const below = activeDevices(30).devices.filter((d) => d.build < s.version.min_build).length;
      const scheduled = s.deletions.filter((d) => d.status === "scheduled");
      return {
        businesses_total: s.businesses.length,
        businesses_active_7d: s.businesses.filter((b) => activeWithin(b, 7)).length,
        devices_active_7d: activeDevices(7).devices.length,
        app_version: s.version,
        latest_release: s.releases.find((r) => r.is_latest) ?? null,
        crashes_24h: {
          events: crashes24.reduce((a, c) => a + c.daily90[89] + Math.round(c.daily90[88] / 2), 0),
          groups: crashes24.length,
          new_groups: s.crashes.filter((c) => Date.parse(c.group.first_seen_at) > Date.now() - DAY).length,
        },
        crash_groups_open: s.crashes.filter((c) => c.group.status === "open").length,
        deletions: {
          scheduled: scheduled.length,
          due_7d: scheduled.filter((d) => Date.parse(d.purge_after) - Date.now() <= 7 * DAY).length,
        },
        devices_below_min_build: below,
        businesses_active_30d: s.businesses.filter((b) => activeWithin(b, 30)).length,
        subscriptions: currentPlans(s.businesses, s.billing),
        revenue_this_month: revenueThisMonth(s.billing),
      };
    },
    async auditPage(q) {
      await guard();
      const limit = Math.min(Math.max(1, q.limit ?? 50), 100);
      const from = parseDay(q.from, false);
      const to = parseDay(q.to, true);
      if (from !== null && to !== null && from > to) throw invalid("from", "Tanggal awal setelah tanggal akhir.");
      let rows = db().audit.filter(
        (e) =>
          (!q.action?.length || q.action.includes(e.action)) &&
          (!q.target_type || e.target_type === q.target_type) &&
          (!q.target_type || !q.target_id || e.target_id === q.target_id) &&
          (!q.admin_id || (q.admin_id === "none" ? e.admin === null : e.admin?.id === q.admin_id)) &&
          (from === null || Date.parse(e.created_at) >= from) &&
          (to === null || Date.parse(e.created_at) <= to)
      );
      if (q.cursor) {
        let decoded: string;
        try {
          decoded = atob(q.cursor.replace(/-/g, "+").replace(/_/g, "/"));
        } catch {
          throw invalid("cursor", "Kursor tidak valid.");
        }
        const [at, id] = decoded.split(",");
        rows = rows.filter((e) => e.created_at < at || (e.created_at === at && e.id < id));
      }
      const items = rows.slice(0, limit);
      const last = items[items.length - 1];
      const next_cursor =
        rows.length > limit && last
          ? btoa(`${last.created_at},${last.id}`).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
          : null;
      return { items, next_cursor };
    },
    async appVersion() {
      await guard();
      return db().version;
    },
    async versionDistribution(q) {
      await guard();
      const s = db();
      const days = q.active_days ?? 30;
      if (days < 1 || days > 90) throw invalid("active_days", "1–90.");
      const { devices, unknown } = activeDevices(days);
      const byBuild = new Map<number, { devices: number; biz: Set<string>; last: string }>();
      for (const d of devices) {
        const e = byBuild.get(d.build) ?? { devices: 0, biz: new Set<string>(), last: d.seen };
        e.devices++;
        e.biz.add(d.business);
        if (d.seen > e.last) e.last = d.seen;
        byBuild.set(d.build, e);
      }
      let impact = null;
      if (q.min_build !== undefined) {
        const m = q.min_build;
        const hit = devices.filter((d) => d.build < m);
        const hitBiz = new Set(hit.map((d) => d.business));
        let all = 0;
        for (const id of hitBiz) if (devices.filter((d) => d.business === id).every((d) => d.build < m)) all++;
        impact = { min_build: m, devices: hit.length, businesses: hitBiz.size, businesses_all_devices: all };
      }
      return {
        platform: "android",
        active_days: days,
        generated_at: new Date().toISOString(),
        min_build: s.version.min_build,
        latest_build: s.version.latest_build,
        totals: {
          devices: devices.length,
          businesses: new Set(devices.map((d) => d.business)).size,
          unknown_build_devices: unknown,
        },
        builds: [...byBuild.entries()]
          .sort((a, b) => b[0] - a[0])
          .map(([build, e]) => ({
            build,
            // Build 33 sengaja tanpa versi (klien lama tanpa X-App-Version & tanpa rilis).
            version: build === 33 ? null : (VERSIONS[build] ?? null),
            devices: e.devices,
            businesses: e.biz.size,
            last_seen_at: e.last,
            below_min: build < s.version.min_build,
          })),
        impact,
      };
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
        const hit = activeDevices(30).devices.filter((d) => d.build < body.min_build);
        throw new ApiError(
          `${hit.length} perangkat di ${new Set(hit.map((d) => d.business)).size} bisnis (aktif 30 hari) akan berhenti sinkron sampai diperbarui.`,
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
        updated_by: refOf(meRecord()),
      };
      log("app_version.update", "app_version", "android", {
        before: { latest_build: before.latest_build, min_build: before.min_build },
        after: { latest_build: body.latest_build, min_build: body.min_build },
      });
      return { config: s.version, warnings };
    },
    async releases() {
      await guard();
      const releases = [...db().releases].sort((a, b) => b.released_at.localeCompare(a.released_at));
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
          if (s.releases.some((r) => r.file === file)) throw new ApiError("Versi ini sudah pernah diunggah.", 409, "RELEASE_EXISTS");
          const r: Release = {
            file,
            version: input.version,
            build: input.build,
            abi: input.abi,
            size_bytes: total,
            sha256: input.sha256 || hex(input.build * 131),
            released_at: new Date().toISOString(),
            is_latest: input.make_latest,
            uploaded_by: refOf(meRecord()),
            url: `${PUBLIC_URL}/${file}`,
          };
          if (input.make_latest) s.releases.forEach((x) => (x.is_latest = false));
          s.releases.unshift(r);
          const keep = [...s.releases].sort((a, b) => b.released_at.localeCompare(a.released_at)).slice(0, 4);
          s.releases = keep.some((x) => x.is_latest) ? keep : [...keep, ...s.releases.filter((x) => x.is_latest)];
          log("release.upload", "release", file, { file, size: total, sha256: r.sha256, make_latest: input.make_latest });
          let app_version: AppVersionConfig | null = null;
          if (input.update_app_version) {
            s.version = {
              ...s.version,
              latest_build: input.build,
              latest_version: input.version,
              updated_at: r.released_at,
              updated_by: refOf(meRecord()),
              source: "db",
            };
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
      const needle = (q.q ?? "").trim().toLowerCase();
      const digits = needle.replace(/\D/g, "").replace(/^0/, "62");
      const matchQ = (b: BusinessDetail) =>
        !needle ||
        b.id === needle ||
        lower(b.name).includes(needle) ||
        lower(b.owner?.email).includes(needle) ||
        lower(b.owner?.name).includes(needle) ||
        (digits.length >= 4 && !!b.owner?.phone && b.owner.phone.replace(/\D/g, "").includes(digits));
      const base = db().businesses.filter(matchQ);
      const from = parseDay(q.created_from, false);
      const to = parseDay(q.created_to, true);
      if (from !== null && to !== null && from > to) throw invalid("created_from", "Tanggal awal setelah tanggal akhir.");
      const rows = base.filter((b) => {
        if (q.type?.length && !q.type.includes(b.type)) return false;
        if (q.active === "7d" && !activeWithin(b, 7)) return false;
        if (q.active === "30d" && !activeWithin(b, 30)) return false;
        if (q.active === "inactive" && activeWithin(b, 30)) return false;
        if (q.feature?.includes("self_order") && !b.features.self_order) return false;
        if (q.feature?.includes("online_payment") && !b.features.online_payment) return false;
        if (q.deletion === "scheduled" && !b.deletion) return false;
        if (q.plan_status?.length && !q.plan_status.includes(briefOf(b)?.status ?? "")) return false;
        if (from !== null && Date.parse(b.created_at) < from) return false;
        if (to !== null && Date.parse(b.created_at) > to) return false;
        return true;
      });
      const sort = q.sort || "created";
      const order = q.order || (sort === "name" ? "asc" : "desc");
      const dir = order === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name, "id") * dir;
        if (sort === "devices") return (a.devices_count - b.devices_count) * dir || a.name.localeCompare(b.name);
        if (sort === "last_active") {
          if (!a.last_active_at) return b.last_active_at ? 1 : 0;
          if (!b.last_active_at) return -1;
          return a.last_active_at.localeCompare(b.last_active_at) * dir;
        }
        return a.created_at.localeCompare(b.created_at) * dir;
      });
      const count = (f: (b: BusinessDetail) => boolean) => base.filter(f).length;
      const facets = {
        type: {
          culinary: count((b) => b.type === "culinary"),
          retail: count((b) => b.type === "retail"),
          service: count((b) => b.type === "service"),
          rental: count((b) => b.type === "rental"),
        },
        active: {
          "7d": count((b) => activeWithin(b, 7)),
          "30d": count((b) => activeWithin(b, 30)),
          inactive: count((b) => !activeWithin(b, 30)),
        },
        feature: {
          self_order: count((b) => b.features.self_order),
          online_payment: count((b) => b.features.online_payment),
        },
        deletion: { scheduled: count((b) => !!b.deletion) },
        plan_status: {
          trial: count((b) => briefOf(b)?.status === "trial"),
          active: count((b) => briefOf(b)?.status === "active"),
          grace: count((b) => briefOf(b)?.status === "grace"),
          free: count((b) => briefOf(b)?.status === "free"),
        },
      };
      return { ...page(rows.map(summaryOf), q.page, q.per_page ?? 20), facets };
    },
    async business(id) {
      await guard();
      const s = db();
      const b = s.businesses.find((x) => x.id === id);
      if (!b) throw new ApiError("Bisnis tidak ditemukan.", 404, "NOT_FOUND");
      return { ...b, subscription: briefOf(b), audit: s.audit.filter((e) => e.target_type === "business" && e.target_id === id).slice(0, 20) };
    },
    async saveFeatures(id, body) {
      await guard();
      const b = db().businesses.find((x) => x.id === id);
      if (!b) throw new ApiError("Bisnis tidak ditemukan.", 404, "NOT_FOUND");
      if (body.online_payment && (!body.self_order || !body.provider)) {
        throw invalid("online_payment", "Bayar online butuh Pesan QR aktif dan provider.");
      }
      const before = { self_order: b.features.self_order, online_payment: b.features.online_payment, provider: b.features.provider };
      b.features = { ...body, updated_at: new Date().toISOString() };
      log("business_features.update", "business", id, { before, after: body });
      return b.features;
    },

    // ——— Admin ———
    async admins() {
      const s = await guard();
      return [...db().admins]
        .map((a) => ({ ...a, is_me: a.id === s.id }))
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "id"));
    },
    async createAdmin(body) {
      const s = await guard();
      await sleep(300);
      const email = body.email.trim().toLowerCase();
      const name = body.name.trim();
      const details: { field: string; message: string }[] = [];
      if (!EMAIL_RE.test(email)) details.push({ field: "email", message: "Format email tidak valid." });
      if (name.length < 2 || name.length > 80) details.push({ field: "name", message: "Nama 2–80 karakter." });
      if (details.length) throw new ApiError("Data tidak valid.", 422, "VALIDATION_ERROR", details);
      if (email.includes("batas")) throw new ApiError("Terlalu banyak permintaan.", 429, "RATE_LIMITED", [], 1800);
      if (email === "ada@sissi.id" || db().admins.some((a) => a.email === email)) {
        throw new ApiError("Email admin sudah terdaftar.", 409, "ADMIN_EXISTS");
      }
      const me = db().admins.find((a) => a.id === s.id) ?? db().admins[0];
      const admin: AdminListItem = {
        id: crypto.randomUUID?.() ?? `a-${Date.now()}`,
        email,
        name,
        active: true,
        must_change_password: true,
        created_at: new Date().toISOString(),
        created_by: refOf(me),
        last_login_at: null,
        active_sessions: 0,
        is_me: false,
      };
      db().admins.push(admin);
      log("admin.create", "admin", admin.id, { via: "web", after: { email, name } });
      return { admin, temporary_password: tempPassword(), expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString() };
    },
    async resetAdminPassword(id) {
      const s = await guard();
      await sleep(300);
      const a = db().admins.find((x) => x.id === id);
      if (!a) throw new ApiError("Admin tidak ditemukan.", 404, "NOT_FOUND");
      if (a.id === s.id) throw new ApiError("Tidak bisa mereset password sendiri. Pakai Akun saya.", 409, "CANNOT_TARGET_SELF");
      if (!a.active) throw new ApiError("Admin nonaktif. Aktifkan dulu.", 409, "ADMIN_INACTIVE");
      a.must_change_password = true;
      a.active_sessions = 0;
      log("admin.reset_password", "admin", a.id, { via: "web" });
      return { temporary_password: tempPassword(), expires_at: new Date(Date.now() + 72 * 3_600_000).toISOString() };
    },
    async setAdminActive(id, active) {
      const s = await guard();
      await sleep(250);
      const a = db().admins.find((x) => x.id === id);
      if (!a) throw new ApiError("Admin tidak ditemukan.", 404, "NOT_FOUND");
      if (a.id === s.id) throw new ApiError("Tidak bisa menonaktifkan diri sendiri.", 409, "CANNOT_TARGET_SELF");
      if (!active && a.active && db().admins.filter((x) => x.active).length <= 1) {
        throw new ApiError("Harus tersisa minimal satu admin aktif.", 409, "LAST_ACTIVE_ADMIN");
      }
      if (a.active !== active) {
        a.active = active;
        if (!active) a.active_sessions = 0;
        log(active ? "admin.enable" : "admin.disable", "admin", a.id, { via: "web" });
      }
      return { ...a, is_me: false };
    },

    // ——— Crash ———
    async crashes(q) {
      await guard();
      const to = parseDay(q.to, true) ?? Date.now();
      const from = parseDay(q.from, false) ?? to - 14 * DAY;
      if (from > to) throw invalid("from", "Tanggal awal setelah tanggal akhir.");
      if (to - from > 91 * DAY) throw invalid("from", "Rentang maksimal 90 hari.");
      const needle = (q.q ?? "").trim().toLowerCase();
      const build = q.build ? Number(q.build) : null;
      const base = db()
        .crashes.map((c) => ({ c, inRange: crashInRange(c, from, to) }))
        .filter(
          ({ c, inRange }) =>
            (!q.platform || c.group.platform === q.platform) &&
            (build === null || (c.perBuild[build] ?? 0) > 0) &&
            (!needle ||
              lower(c.group.title).includes(needle) ||
              lower(c.group.top_frame).includes(needle) ||
              c.group.fingerprint === needle) &&
            (inRange > 0 || Date.parse(c.group.last_seen_at) >= from)
        );
      const status = q.status || "open";
      const rows = base.filter(({ c }) => status === "all" || c.group.status === status);
      const sort = q.sort || "last_seen";
      const dir = (q.order || "desc") === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        const ga = a.c.group;
        const gb = b.c.group;
        if (sort === "count") return (a.inRange - b.inRange) * dir;
        if (sort === "first_seen") return ga.first_seen_at.localeCompare(gb.first_seen_at) * dir;
        if (sort === "businesses") return (ga.businesses_count - gb.businesses_count) * dir;
        return ga.last_seen_at.localeCompare(gb.last_seen_at) * dir;
      });
      const groups: CrashGroup[] = rows.map(({ c, inRange }) => ({ ...c.group, events_in_range: inRange }));
      const facets = {
        status: {
          open: base.filter(({ c }) => c.group.status === "open").length,
          resolved: base.filter(({ c }) => c.group.status === "resolved").length,
          ignored: base.filter(({ c }) => c.group.status === "ignored").length,
        },
      };
      return { ...page(groups, q.page, q.per_page ?? 25), facets };
    },
    async crash(fp) {
      await guard();
      const crashes = db().crashes;
      const idx = crashes.findIndex((c) => c.group.fingerprint === fp);
      if (idx < 0) throw new ApiError("Crash tidak ditemukan.", 404, "NOT_FOUND");
      const rec = crashes[idx];
      rec.events ??= makeEvents(rec, idx + 1);
      const day0 = startOfTodayUtc();
      return {
        group: { ...rec.group, events_in_range: rec.group.sparkline.reduce((a, b) => a + b, 0) },
        daily: rec.daily90.slice(60).map((count, i) => ({
          day: new Date(day0 - (29 - i) * DAY).toISOString().slice(0, 10),
          count,
        })),
        builds: Object.entries(rec.perBuild)
          .map(([b, count]) => ({
            build: Number(b),
            version: VERSIONS[Number(b)] ?? null,
            count,
            last_seen_at: rec.group.last_seen_at,
          }))
          .sort((a, b) => b.build - a.build),
        businesses: rec.businesses,
        events: rec.events,
      };
    },
    async setCrashStatus(fp, body) {
      await guard();
      const rec = db().crashes.find((c) => c.group.fingerprint === fp);
      if (!rec) throw new ApiError("Crash tidak ditemukan.", 404, "NOT_FOUND");
      if (body.note.length > 300) throw invalid("note", "Maksimal 300 karakter.");
      if (body.status !== "resolved" && body.resolved_in_build !== null) {
        throw invalid("resolved_in_build", "Hanya untuk status selesai.");
      }
      const g = rec.group;
      const nextBuild = body.status === "resolved" ? (body.resolved_in_build ?? db().version.latest_build) : null;
      if (g.status === body.status && g.resolved_in_build === nextBuild) return { ...g };
      const before = { status: g.status, resolved_in_build: g.resolved_in_build };
      g.status = body.status;
      g.resolved_in_build = nextBuild;
      g.status_note = body.note;
      g.status_by = body.status === "open" ? null : refOf(meRecord());
      g.status_at = new Date().toISOString();
      log("crash.status", "crash", fp, { before, after: { status: g.status, resolved_in_build: g.resolved_in_build } });
      return { ...g };
    },

    // ——— Hapus akun ———
    async accountDeletions(q) {
      await guard();
      const needle = (q.q ?? "").trim().toLowerCase();
      const base = db().deletions.filter(
        (d) =>
          !needle ||
          lower(d.business?.name).includes(needle) ||
          lower(d.owner?.email).includes(needle) ||
          d.business?.id === needle
      );
      const status = q.status || "scheduled";
      const rows = base.filter((d) => status === "all" || d.status === status);
      const sort = q.sort || (status === "scheduled" ? "purge_after" : "requested_at");
      const dir = (q.order || (sort === "purge_after" ? "asc" : "desc")) === "asc" ? 1 : -1;
      rows.sort(
        (a, b) =>
          (sort === "purge_after" ? a.purge_after.localeCompare(b.purge_after) : a.requested_at.localeCompare(b.requested_at)) *
          dir
      );
      const facets = {
        status: {
          scheduled: base.filter((d) => d.status === "scheduled").length,
          canceled: base.filter((d) => d.status === "canceled").length,
          purged: base.filter((d) => d.status === "purged").length,
        },
      };
      return { ...page(rows, q.page, q.per_page ?? 25), facets };
    },

    // ——— Tahap 3: metrik & langganan ———
    async metrics(q) {
      await guard();
      await sleep(250); // hitungan metrik sedikit lebih lambat
      const m = computeMetrics(db().businesses, db().billing, q);
      if ("field" in m) throw invalid(m.field, m.message);
      return m;
    },
    async subscriptions(q) {
      await guard();
      const statuses = q.status?.filter((x) => x !== "all") ?? [];
      for (const v of statuses) if (!["trial", "active", "grace", "free"].includes(v)) throw invalid("status", "Nilai tidak dikenal.");
      if (q.expiring && !["7d", "30d"].includes(q.expiring)) throw invalid("expiring", "7d atau 30d.");
      const needle = (q.q ?? "").trim().toLowerCase();
      const digits = needle.replace(/\D/g, "").replace(/^0/, "62");
      const all = db().businesses.map((b) => toAdminSubscription(db().billing.subs.get(b.id)!, b));
      const base = all.filter(
        (a) =>
          !needle ||
          a.business.id === needle ||
          lower(a.business.name).includes(needle) ||
          lower(a.business.owner?.email).includes(needle) ||
          (digits.length >= 4 && !!a.business.owner?.phone && a.business.owner.phone.replace(/\D/g, "").includes(digits))
      );
      const within = (a: (typeof all)[number], days: number) =>
        ["trial", "active", "grace"].includes(a.status) && !!a.ends_at && Date.parse(a.ends_at) - Date.now() <= days * DAY_MS;
      const rows = base.filter((a) => {
        if (statuses.length && !statuses.includes(a.status)) return false;
        if (q.expiring === "7d" && !within(a, 7)) return false;
        if (q.expiring === "30d" && !within(a, 30)) return false;
        if (q.cycle && a.billing_cycle !== q.cycle) return false;
        if (q.over_limit === "true" && !a.usage.over_limit) return false;
        return true;
      });
      const sort = q.sort || "ends_at";
      const dir = (q.order || (sort === "ends_at" ? "asc" : "desc")) === "asc" ? 1 : -1;
      rows.sort((a, b) => {
        if (sort === "name") return a.business.name.localeCompare(b.business.name, "id") * dir;
        if (sort === "last_payment") {
          const x = a.last_payment?.paid_at ?? "";
          const y = b.last_payment?.paid_at ?? "";
          if (!x || !y) return x ? -1 : y ? 1 : 0;
          return x.localeCompare(y) * dir;
        }
        if (sort === "created") {
          const x = db().billing.subs.get(a.business.id)!.created_at;
          const y = db().billing.subs.get(b.business.id)!.created_at;
          return x.localeCompare(y) * dir;
        }
        if (!a.ends_at) return b.ends_at ? 1 : 0;
        if (!b.ends_at) return -1;
        return a.ends_at.localeCompare(b.ends_at) * dir;
      });
      const facets = {
        status: {
          trial: base.filter((a) => a.status === "trial").length,
          active: base.filter((a) => a.status === "active").length,
          grace: base.filter((a) => a.status === "grace").length,
          free: base.filter((a) => a.status === "free").length,
        },
        expiring_7d: base.filter((a) => within(a, 7)).length,
      };
      return { ...page(rows, q.page, q.per_page ?? 25), facets };
    },
    async subscription(id) {
      await guard();
      const { b, s } = subOf(id);
      return {
        subscription: toAdminSubscription(s, b),
        payments: [...s.payments].sort((x, y) => y.paid_at.localeCompare(x.paid_at)).slice(0, 200).map(publicPayment),
        audit: db()
          .audit.filter((e) => e.target_type === "business" && e.target_id === id && e.action.startsWith("subscription."))
          .slice(0, 20),
      };
    },
    async recordPayment(id, body) {
      await guard();
      await sleep(300);
      const { b, s } = subOf(id);
      const existing = s.payments.find((p) => p.id === body.id);
      if (existing) {
        if (existing.amount === body.amount && existing.cycle === body.cycle) {
          return { subscription: toAdminSubscription(s, b), payment: publicPayment(existing) };
        }
        throw new ApiError("Pembayaran dengan ID ini sudah ada.", 409, "PAYMENT_EXISTS");
      }
      if (body.provider_ref && [...db().billing.subs.values()].some((x) => x.payments.some((p) => p.provider_ref === body.provider_ref))) {
        throw new ApiError("Nomor referensi sudah dipakai pembayaran lain.", 409, "PAYMENT_EXISTS");
      }
      const details: { field: string; message: string }[] = [];
      if (!Number.isInteger(body.amount) || body.amount < 0 || body.amount > 100_000_000) details.push({ field: "amount", message: "Nominal 0–100.000.000." });
      const paid = parseWhen(body.paid_at);
      if (paid === null) details.push({ field: "paid_at", message: "Tanggal bayar wajib." });
      else if (paid > Date.now() + DAY_MS) details.push({ field: "paid_at", message: "Tidak boleh lebih dari besok." });
      if (body.note.length > 500) details.push({ field: "note", message: "Maksimal 500 karakter." });
      const now = Date.now();
      const cpe = s.current_period_end ? Date.parse(s.current_period_end) : null;
      const start = parseWhen(body.period_start) ?? Math.max(now, cpe ?? 0);
      let end: number;
      if (body.cycle === "monthly") end = addMonths(start, 1);
      else if (body.cycle === "yearly") end = addMonths(start, 12);
      else {
        end = parseWhen(body.period_end) ?? NaN;
        if (!Number.isFinite(end)) details.push({ field: "period_end", message: "Akhir periode wajib untuk periode khusus." });
        else if (end <= start) details.push({ field: "period_end", message: "Harus setelah awal periode." });
        else if (end - start > 400 * DAY_MS) details.push({ field: "period_end", message: "Maksimal 400 hari." });
      }
      if (details.length) throw new ApiError("Data tidak valid.", 422, "VALIDATION_ERROR", details);
      const before = snapshot(s);
      const rec: PaymentRecord = {
        id: body.id,
        business_id: id,
        cycle: body.cycle,
        period_start: new Date(start).toISOString(),
        period_end: new Date(end).toISOString(),
        prev_period_end: s.current_period_end,
        amount: body.amount,
        method: body.method,
        paid_at: new Date(paid!).toISOString(),
        provider: "manual",
        provider_ref: body.provider_ref,
        note: body.note,
        status: "recorded",
        void_reason: "",
        recorded_by: refOf(meRecord()),
        voided_by: null,
        voided_at: null,
        created_at: new Date().toISOString(),
      };
      s.payments.push(rec);
      s.current_period_end = new Date(Math.max(cpe ?? 0, end)).toISOString();
      if (body.cycle !== "custom") s.billing_cycle = body.cycle;
      s.first_paid_at ??= rec.paid_at;
      touch(s);
      log("subscription.payment", "business", id, {
        payment_id: rec.id,
        amount: rec.amount,
        cycle: rec.cycle,
        before,
        after: snapshot(s),
      });
      return { subscription: toAdminSubscription(s, b), payment: publicPayment(rec) };
    },
    async voidPayment(id, pid, reason) {
      await guard();
      await sleep(250);
      const { b, s } = subOf(id);
      const p = s.payments.find((x) => x.id === pid);
      if (!p) throw new ApiError("Pembayaran tidak ditemukan.", 404, "NOT_FOUND");
      if (p.status === "void") return { subscription: toAdminSubscription(s, b), payment: publicPayment(p) };
      const r = reason.trim();
      if (r.length < 1 || r.length > 300) throw invalid("reason", "Alasan 1–300 karakter.");
      const latest = s.payments
        .filter((x) => x.status === "recorded")
        .sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
      if (latest?.id !== p.id) {
        throw new ApiError("Hanya pembayaran sah terbaru yang bisa dibatalkan. Batalkan yang lebih baru dulu.", 409, "PAYMENT_NOT_LATEST");
      }
      const before = snapshot(s);
      p.status = "void";
      p.void_reason = r;
      p.voided_by = refOf(meRecord());
      p.voided_at = new Date().toISOString();
      s.current_period_end = p.prev_period_end;
      const prev = s.payments
        .filter((x) => x.status === "recorded" && x.cycle !== "custom")
        .sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
      s.billing_cycle = prev ? (prev.cycle as "monthly" | "yearly") : null;
      s.first_paid_at =
        s.payments.filter((x) => x.status === "recorded").sort((x, y) => x.paid_at.localeCompare(y.paid_at))[0]?.paid_at ?? null;
      touch(s);
      log("subscription.payment_void", "business", id, { payment_id: p.id, reason: r, before, after: snapshot(s) });
      return { subscription: toAdminSubscription(s, b), payment: publicPayment(p) };
    },
    async extendSubscription(id, body) {
      await guard();
      await sleep(250);
      const { s } = subOf(id);
      const details: { field: string; message: string }[] = [];
      if (!Number.isInteger(body.days) || body.days < 1 || body.days > 366) details.push({ field: "days", message: "1–366 hari." });
      const note = body.note.trim();
      if (note.length < 1 || note.length > 300) details.push({ field: "note", message: "Alasan wajib (maks. 300 karakter)." });
      if (details.length) throw new ApiError("Data tidak valid.", 422, "VALIDATION_ERROR", details);
      const e = effective(s);
      const target =
        body.target !== "auto" ? body.target : e.status === "active" || (e.status === "grace" && s.first_paid_at) ? "period" : "trial";
      const before = snapshot(s);
      const now = Date.now();
      const add = body.days * DAY_MS;
      if (target === "trial") {
        s.trial_ends_at = new Date(Math.max(s.trial_ends_at ? Date.parse(s.trial_ends_at) : 0, now) + add).toISOString();
      } else {
        s.current_period_end = new Date(Math.max(s.current_period_end ? Date.parse(s.current_period_end) : 0, now) + add).toISOString();
      }
      touch(s);
      log("subscription.extend", "business", id, { days: body.days, target, note, before, after: snapshot(s) });
    },
    async saveOverrides(id, body) {
      await guard();
      await sleep(200);
      const { s } = subOf(id);
      const details: { field: string; message: string }[] = [];
      if (body.outlet_quota !== null && (!Number.isInteger(body.outlet_quota) || body.outlet_quota < 1 || body.outlet_quota > 100))
        details.push({ field: "outlet_quota", message: "1–100 atau kosong." });
      if (body.tx_limit !== null && (!Number.isInteger(body.tx_limit) || body.tx_limit < 1 || body.tx_limit > 1_000_000))
        details.push({ field: "tx_limit", message: "1–1.000.000 atau kosong." });
      if (body.note.length > 300) details.push({ field: "note", message: "Maksimal 300 karakter." });
      if (details.length) throw new ApiError("Data tidak valid.", 422, "VALIDATION_ERROR", details);
      const before = { outlet_quota: s.outlet_quota, tx_limit: s.tx_limit, note: s.override_note };
      if (before.outlet_quota === body.outlet_quota && before.tx_limit === body.tx_limit && before.note === body.note) return;
      s.outlet_quota = body.outlet_quota;
      s.tx_limit = body.tx_limit;
      s.override_note = body.note;
      touch(s);
      log("subscription.override", "business", id, { before, after: body });
    },
    async billingConfig() {
      await guard();
      return db().billing.config;
    },
    async saveBillingConfig(body) {
      await guard();
      await sleep(300);
      const details: { field: string; message: string }[] = [];
      if (!Number.isInteger(body.price_monthly) || body.price_monthly < 0) details.push({ field: "price_monthly", message: "Harga tidak valid." });
      if (!Number.isInteger(body.price_yearly) || body.price_yearly < 0) details.push({ field: "price_yearly", message: "Harga tidak valid." });
      if (body.bank_accounts.length > 5) details.push({ field: "bank_accounts", message: "Maksimal 5 rekening." });
      body.bank_accounts.forEach((a, i) => {
        if (a.bank.trim().length < 1 || a.bank.length > 40) details.push({ field: `bank_accounts[${i}].bank`, message: "Nama bank 1–40 karakter." });
        if (!/^[\d\s-]{5,30}$/.test(a.number)) details.push({ field: `bank_accounts[${i}].number`, message: "5–30 digit (boleh spasi/-)." });
        if (a.holder.trim().length < 1 || a.holder.length > 80) details.push({ field: `bank_accounts[${i}].holder`, message: "Atas nama 1–80 karakter." });
      });
      if (body.whatsapp && !/^\+[1-9]\d{7,14}$/.test(body.whatsapp)) details.push({ field: "whatsapp", message: "Format +62…" });
      if (body.instructions.length > 2000) details.push({ field: "instructions", message: "Maksimal 2000 karakter." });
      if (details.length) throw new ApiError("Data tidak valid.", 422, "VALIDATION_ERROR", details);
      const before = db().billing.config;
      db().billing.config = { ...body, updated_by: refOf(meRecord()), updated_at: new Date().toISOString() };
      log("billing_config.update", "billing_config", "1", {
        before: { price_monthly: before.price_monthly, price_yearly: before.price_yearly, bank_accounts: before.bank_accounts.length },
        after: { price_monthly: body.price_monthly, price_yearly: body.price_yearly, bank_accounts: body.bank_accounts.length },
      });
      return db().billing.config;
    },
  };
}
