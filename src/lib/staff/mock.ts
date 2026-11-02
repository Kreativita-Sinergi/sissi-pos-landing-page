// Mode tiruan web karyawan (NEXT_PUBLIC_STAFF_MOCK=1) — tanpa server. JANGAN dipakai di produksi.
// Skenario dipilih dari teks no. HP/email saat masuk (boleh digabung, mis. "cabang-telat"):
//   (bawaan) belum absen · aturan lokasi "Tandai"
//   telat     sudah absen masuk, terlambat 17 menit (via Website)
//   pulang    sudah masuk (PIN di perangkat toko) & pulang (Website, tanpa lokasi)
//   kemarin   absen masuk kemarin belum pulang
//   izin      hari ini tercatat izin (absen ditutup)
//   tolak     outlet ber-aturan "Tolak" (di luar radius / tanpa lokasi → OUTSIDE_AREA)
//   gratis    paket Gratis (locked)
//   cabang    dua outlet (outlet kedua ber-aturan Tolak)
//   putus     percobaan absen pertama gagal jaringan (uji ulang dengan Idempotency-Key yang sama)
//   pemilik   → STAFF_ONLY · nonaktif → EMPLOYEE_LOGIN_DISABLED · batas → RATE_LIMITED
// Kata sandi "salah" → INVALID_CREDENTIALS. Undangan: kode berawalan 0000 → INVITE_INVALID.
import { staffError, type StaffApi } from "./api";
import { zonedClock, zonedDate } from "./clock";
import type { ClockInput, StaffAttendance, StaffHistory, StaffOutlet, StaffSession, StaffToday } from "./types";

const TZ = "Asia/Jakarta";
const KEY = "sissi-staff-mock:state";
const OUTLET_LOC = { lat: -6.2297, lng: 106.8295 };

type OutletRule = { outside: "flag" | "reject"; enabled: boolean };

type MockState = {
  scenario: string;
  name: string;
  outlets: (StaffOutlet & OutletRule)[];
  rows: StaffAttendance[];
  flakyUsed: boolean;
  /** Idempotency-Key → hasil (putar ulang respons pertama, seperti server). */
  replies: Record<string, StaffAttendance>;
  remember: boolean;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const latency = () => wait(250 + Math.random() * 350);

function load(): MockState | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MockState) : null;
  } catch {
    return null;
  }
}
function save(s: MockState | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {
    // Penyimpanan diblokir — mode tiruan tetap jalan selama halaman terbuka.
  }
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Jam lokal (Asia/Jakarta, UTC+7) pada tanggal tertentu → ISO UTC. */
function at(date: string, hm: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const [h, mi] = hm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h - 7, mi)).toISOString();
}

function geoAt(distance: number, outside = false) {
  return { lat: OUTLET_LOC.lat + distance / 111_000, lng: OUTLET_LOC.lng, accuracy_m: 18, distance_m: distance, outside_area: outside, mocked: false };
}

function haversine(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function row(p: Partial<StaffAttendance> & Pick<StaffAttendance, "date" | "outlet_id" | "outlet_name">): StaffAttendance {
  return {
    id: `mock-${p.date}`,
    clock_in_at: null,
    clock_out_at: null,
    status: "ontime",
    late_minutes: 0,
    source: "self",
    clock_in_via: null,
    clock_out_via: null,
    clock_in_geo: null,
    clock_out_geo: null,
    note: "",
    ...p,
  };
}

function fresh(identifier: string, remember: boolean): MockState {
  const s = identifier.toLowerCase();
  const has = (w: string) => s.includes(w);
  const today = zonedDate(Date.now(), TZ);
  const outlets: MockState["outlets"] = [{ id: "o-1", name: "Kopi Senja Kemang", enabled: true, outside: has("tolak") ? "reject" : "flag" }];
  if (has("cabang")) outlets.push({ id: "o-2", name: "Kopi Senja Dago", enabled: true, outside: "reject" });
  const o = outlets[0];
  const rows: StaffAttendance[] = [];
  if (has("telat"))
    rows.push(row({ date: today, outlet_id: o.id, outlet_name: o.name, clock_in_at: at(today, "08:17"), status: "late", late_minutes: 17, clock_in_via: "web", clock_in_geo: geoAt(32) }));
  else if (has("pulang"))
    rows.push(
      row({
        date: today,
        outlet_id: o.id,
        outlet_name: o.name,
        clock_in_at: at(today, "07:56"),
        clock_out_at: at(today, "17:04"),
        source: "pin",
        clock_in_via: "pin",
        clock_out_via: "web",
        clock_in_geo: null,
        clock_out_geo: null,
      })
    );
  else if (has("kemarin")) {
    const y = addDays(today, -1);
    rows.push(row({ date: y, outlet_id: o.id, outlet_name: o.name, clock_in_at: at(y, "13:02"), clock_in_via: "web", clock_in_geo: geoAt(20) }));
  } else if (has("izin")) rows.push(row({ date: today, outlet_id: o.id, outlet_name: o.name, status: "permit", source: "manual", note: "Urusan keluarga" }));
  return {
    scenario: s,
    name: has("budi") ? "Budi Santoso" : "Rani Amalia",
    outlets,
    rows,
    flakyUsed: false,
    replies: {},
    remember,
  };
}

function session(s: MockState): StaffSession {
  const now = Date.now();
  const life = s.remember ? 30 * 864e5 : 12 * 36e5;
  return {
    user: { id: "u-staff-1", name: s.name, role: s.scenario.includes("dapur") ? "kitchen" : "cashier", job_title: s.scenario.includes("dapur") ? "Barista" : null },
    business: { id: "b-1", name: "Kopi Senja", timezone: TZ },
    outlets: s.outlets.map(({ id, name }) => ({ id, name })),
    locked: s.scenario.includes("gratis"),
    session: { expires_at: new Date(now + life).toISOString(), idle_expires_at: new Date(now + (s.remember ? 7 * 864e5 : 2 * 36e5)).toISOString() },
  };
}

/** Baris absen yang relevan hari ini: baris hari ini, atau baris kemarin yang masih terbuka (< 20 jam). */
function current(s: MockState, today: string): StaffAttendance | null {
  const t = s.rows.find((r) => r.date === today);
  if (t) return t;
  const y = s.rows.find((r) => r.date === addDays(today, -1) && r.clock_in_at && !r.clock_out_at);
  if (y && Date.now() - Date.parse(y.clock_in_at!) < 20 * 36e5) return y;
  return null;
}

export function createStaffMockApi(onUnauthorized: () => void): StaffApi {
  let state = load();

  function need(): MockState {
    if (!state) {
      onUnauthorized();
      throw staffError("Sesi berakhir. Silakan masuk lagi.", 401, "UNAUTHORIZED");
    }
    return state;
  }

  function outletOf(s: MockState, id: string | undefined) {
    if (!id) return null;
    const o = s.outlets.find((x) => x.id === id);
    if (!o) throw staffError("Kamu tidak punya akses ke outlet ini.", 403, "FORBIDDEN");
    return o;
  }

  return {
    async login(body) {
      await latency();
      const id = body.identifier.toLowerCase();
      if (id.includes("batas")) throw staffError("Terlalu banyak percobaan.", 429, "RATE_LIMITED", null, 30);
      if (body.password === "salah") throw staffError("Email/nomor HP atau password salah", 401, "INVALID_CREDENTIALS");
      if (id.includes("pemilik")) throw staffError("Akun pemilik masuk lewat dasbor.", 403, "STAFF_ONLY");
      if (id.includes("nonaktif")) throw staffError("Akunmu belum diizinkan masuk dari HP. Hubungi pemilik.", 403, "EMPLOYEE_LOGIN_DISABLED");
      state = fresh(id, body.remember_me);
      save(state);
      return session(state);
    },
    async accept(code, body) {
      await latency();
      if (code.startsWith("0000")) throw staffError("Undangan tidak berlaku", 404, "INVITE_INVALID");
      if (body.password.length < 8)
        throw staffError("Input tidak valid", 422, "VALIDATION_ERROR", [{ field: "password", message: "Minimal 8 karakter" }]);
      if (/^(password|12345678|sissi123)/i.test(body.password))
        throw staffError("Input tidak valid", 422, "VALIDATION_ERROR", [{ field: "password", message: "Kata sandi terlalu umum" }]);
      state = fresh("", body.remember_me ?? false);
      save(state);
      return session(state);
    },
    async logout() {
      await latency();
      state = null;
      save(null);
    },
    async me() {
      await wait(150);
      if (!state) throw staffError("Belum masuk", 401, "UNAUTHORIZED");
      return session(state);
    },
    async today(q) {
      await latency();
      const s = need();
      const now = Date.now();
      const date = zonedDate(now, TZ);
      const a = current(s, date);
      const o = outletOf(s, q.outlet_id) ?? s.outlets.find((x) => x.id === a?.outlet_id) ?? s.outlets[0];
      const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
      const result: StaffToday = {
        now: new Date(now).toISOString(),
        date,
        outlet_id: o.id,
        rules: { work_start: "08:00", work_end: "17:00", late_tolerance_min: 10, off_day: weekday === 0 },
        geo: { enabled: o.enabled, radius_m: 100, outside: o.outside, has_location: true },
        attendance: a,
        locked: s.scenario.includes("gratis"),
      };
      return result;
    },
    async clock(body: ClockInput, key: string) {
      await latency();
      const s = need();
      if (s.replies[key]) return s.replies[key];
      if (s.scenario.includes("putus") && !s.flakyUsed) {
        s.flakyUsed = true;
        save(s);
        await wait(600);
        throw staffError("Tidak dapat terhubung ke server.", 0, "NETWORK_ERROR");
      }
      if (s.scenario.includes("gratis")) throw staffError("Fitur ini butuh Sissi Pro", 403, "PRO_REQUIRED");
      const o = outletOf(s, body.outlet_id)!;
      const now = Date.now();
      const date = zonedDate(now, TZ);
      const a = current(s, date);
      let geo = null;
      if (body.geo) {
        const d = haversine(body.geo, OUTLET_LOC);
        geo = { ...body.geo, distance_m: d, outside_area: d > 100, mocked: false };
      }
      if (o.enabled && o.outside === "reject" && (!geo || geo.outside_area))
        throw staffError("Di luar area outlet", 422, "OUTSIDE_AREA", geo ? { distance_m: geo.distance_m } : {});

      let out: StaffAttendance;
      if (body.action === "in") {
        if (a && a.date === date && (a.status === "permit" || a.status === "sick" || a.status === "leave" || a.status === "absent") && !a.clock_in_at)
          throw staffError("Hari ini sudah tercatat izin/sakit/cuti/alpa", 422, "ATTENDANCE_DAY_CLOSED");
        if (a && a.date === date && a.clock_in_at) throw staffError("Sudah absen masuk", 409, "ALREADY_CLOCKED", { attendance: a });
        const { hm } = zonedClock(now, TZ);
        const [h, m] = hm.split(":").map(Number);
        const diff = h * 60 + m - 8 * 60;
        const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
        const late = weekday !== 0 && diff > 10;
        out = row({
          date,
          outlet_id: o.id,
          outlet_name: o.name,
          clock_in_at: new Date(now).toISOString(),
          status: late ? "late" : "ontime",
          late_minutes: late ? Math.min(diff, 1440) : 0,
          clock_in_via: "web",
          clock_in_geo: geo,
        });
        s.rows = [...s.rows.filter((r) => r.date !== date), out];
      } else {
        if (!a || !a.clock_in_at) {
          if (a && a.date === date && a.status !== "ontime" && a.status !== "late")
            throw staffError("Hari ini sudah tercatat izin/sakit/cuti/alpa", 422, "ATTENDANCE_DAY_CLOSED");
          throw staffError("Belum absen masuk", 422, "NOT_CLOCKED_IN");
        }
        if (a.clock_out_at) throw staffError("Sudah absen pulang", 409, "ALREADY_CLOCKED", { attendance: a });
        out = { ...a, clock_out_at: new Date(now).toISOString(), clock_out_via: "web", clock_out_geo: geo };
        s.rows = s.rows.map((r) => (r.id === a.id ? out : r));
      }
      s.replies[key] = out;
      save(s);
      return out;
    },
    async history(q) {
      await latency();
      const s = need();
      const today = zonedDate(Date.now(), TZ);
      const month = q.month ?? today.slice(0, 7);
      const [cy, cm] = today.slice(0, 7).split("-").map(Number);
      const [y, m] = month.split("-").map(Number);
      const back = (cy - y) * 12 + (cm - m);
      if (!y || !m || back < 0 || back > 12)
        throw staffError("Input tidak valid", 422, "VALIDATION_ERROR", [{ field: "month", message: "Maksimal 12 bulan ke belakang" }]);
      const items: StaffAttendance[] = [];
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const outlets = s.outlets;
      for (let d = 1; d <= days; d++) {
        const date = `${month}-${String(d).padStart(2, "0")}`;
        if (date >= today) break;
        if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) continue;
        const seed = (d * 7 + m * 13 + y) % 17;
        const o = outlets[seed % outlets.length];
        const base = { date, outlet_id: o.id, outlet_name: o.name, id: `mock-${date}` };
        if (seed === 3) {
          items.push(row({ ...base, status: "sick", source: "manual", note: "Demam" }));
          continue;
        }
        if (seed === 11) {
          items.push(row({ ...base, status: "absent", source: "manual" }));
          continue;
        }
        const late = seed % 5 === 1 ? 5 + seed : 0;
        const inAt = at(date, late ? `08:${String(10 + late).padStart(2, "0")}` : "07:5" + (seed % 10));
        const outAt = at(date, `17:0${seed % 10}`);
        const kind = seed % 4;
        items.push(
          row({
            ...base,
            clock_in_at: inAt,
            clock_out_at: outAt,
            status: late ? "late" : "ontime",
            late_minutes: late ? 10 + late : 0,
            // 0: PIN (pulang kadang lewat website) · 1: website/aplikasi · 2: aplikasi · 3: koreksi pemilik / baris lama.
            source: kind === 0 ? "pin" : kind === 3 && seed % 2 ? "manual" : "self",
            clock_in_via: kind === 0 ? "pin" : kind === 1 ? "web" : kind === 2 ? "app" : seed % 2 ? "manual" : null,
            clock_out_via: kind === 0 ? (seed % 2 ? "web" : "pin") : kind === 1 ? (seed % 2 ? "app" : "web") : kind === 2 ? "app" : seed % 2 ? "manual" : null,
            clock_in_geo: kind === 0 || (kind === 1 && seed % 3 === 0) ? null : geoAt(15 + seed),
            clock_out_geo: kind === 0 && !(seed % 2) ? null : geoAt(20 + seed),
            note: seed === 9 ? "Tukar shift dengan Budi" : "",
          })
        );
      }
      for (const r of s.rows) if (r.date.startsWith(month) && !items.some((i) => i.date === r.date)) items.push(r);
      items.sort((a, b) => (a.date < b.date ? 1 : -1));
      const count = (st: string) => items.filter((i) => i.status === st).length;
      const result: StaffHistory = {
        month,
        items,
        summary: {
          present: count("ontime") + count("late"),
          ontime: count("ontime"),
          late: count("late"),
          late_minutes: items.reduce((a, i) => a + (i.status === "late" ? i.late_minutes : 0), 0),
          permit: count("permit"),
          sick: count("sick"),
          leave: count("leave"),
          absent: count("absent"),
        },
      };
      return result;
    },
  };
}
