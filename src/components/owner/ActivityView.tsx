"use client";

import React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Ban, ChevronDown, ChevronRight, History, MonitorSmartphone, PencilLine, Percent, ShieldAlert, Undo2, Wallet } from "lucide-react";
import { ClearFiltersButton, FilterBar } from "@/components/admin/FilterMenu";
import {
  Badge,
  cardClass,
  EmptyState,
  ErrorBlock,
  focusRing,
  formatRupiah,
  LoadingBar,
  PageHeader,
  Pagination,
  SkeletonList,
  StatCard,
  useLoad,
} from "@/components/admin/ui";
import { ownerApi, pullAll } from "@/lib/owner/api";
import type { ActivityFieldChange, ActivityItem, ActivityKind, ActivityPage, ActivityQuery } from "@/lib/owner/types";
import { OUTLET_STATUS, ROLES } from "@/components/admin/labels";
import { ACTIVITY_KIND, ACTIVITY_KINDS, CHANGE_ENTITY, CHANGE_FIELD, labelOf, SETTINGS_KEY } from "./labels";
import { zonedDay, zoneLabel } from "@/lib/owner/tz";
import { useOwner } from "./OwnerShell";
import { formatDayLong, formatTime, PeriodFilter, SyncNote, usePeriod } from "./ui";

// Aktivitas (GET /owner/activity): log turunan pembatalan, pengembalian dana, diskon manual, tutup kasir,
// kas masuk/keluar, login dari perangkat baru, dan riwayat perubahan data (`change`: siapa mengubah apa, dari
// perangkat mana). Filter di URL: from, to, kind (daftar koma), page.

const PER_PAGE = 50;

type Tone = "danger" | "warning" | "success" | "brand" | "neutral";

const TONE_CLASS: Record<Tone, string> = {
  danger: "bg-danger-tint text-danger",
  warning: "bg-warning-tint text-warning",
  success: "bg-success-tint text-success",
  brand: "bg-brand-tint text-brand-ink",
  neutral: "bg-bg-muted text-text-body",
};

const KIND_ICON: Record<ActivityKind, React.ComponentType<{ size?: number; "aria-hidden"?: boolean }>> = {
  void: Ban,
  refund: Undo2,
  partial_refund: Undo2,
  manual_discount: Percent,
  discount_unapproved: ShieldAlert,
  shift_closed: Wallet,
  cash_in: ArrowDownLeft,
  cash_out: ArrowUpRight,
  new_device: MonitorSmartphone,
  change: PencilLine,
};

function toneOf(a: ActivityItem): Tone {
  switch (a.kind) {
    case "void":
    case "refund":
      return "danger";
    case "partial_refund":
      return "warning";
    case "manual_discount":
      return "warning";
    case "discount_unapproved":
      return "danger";
    case "shift_closed":
      if (a.difference === null || a.difference === 0) return "success";
      return a.difference < 0 ? "danger" : "warning";
    case "cash_in":
      return "success";
    case "cash_out":
      return "neutral";
    case "new_device":
      return "brand";
    case "change":
      if (isImportantChange(a)) return "warning";
      return a.op === "delete" ? "danger" : "neutral";
  }
}


const isKind = (v: string): v is ActivityKind => (ACTIVITY_KINDS as readonly string[]).includes(v);
const who = (name: string | null | undefined) => name?.trim() || "Seseorang";
const text = (v: string | null | undefined) => v?.trim() || "";

/** Kalimat utama + detail tambahan (dipisah " · "). */
function describe(a: ActivityItem): { main: React.ReactNode; extra: string[] } {
  const amount = a.amount !== null ? formatRupiah(a.amount) : null;
  const receipt = a.receipt_no ? <span className="font-semibold tabular-nums">{a.receipt_no}</span> : "tanpa nomor";
  const note = text(a.note);
  switch (a.kind) {
    case "void":
    case "refund":
      return {
        main: (
          <>
            <strong className="font-semibold">{who(a.actor)}</strong> {a.kind === "void" ? "membatalkan transaksi" : "mengembalikan dana transaksi"} {receipt}
          </>
        ),
        extra: [amount, note ? `alasan: ${note}` : null, a.approver ? `disetujui ${a.approver}` : null].filter((x): x is string => !!x),
      };
    case "partial_refund":
      return {
        main: (
          <>
            <strong className="font-semibold">{who(a.actor)}</strong> merefund sebagian barang transaksi {receipt}
          </>
        ),
        extra: [amount, note ? `alasan: ${note}` : null, a.approver ? `disetujui ${a.approver}` : null].filter((x): x is string => !!x),
      };
    case "manual_discount":
      return {
        main: (
          <>
            Diskon manual <strong className="font-semibold tabular-nums">{amount ?? "—"}</strong>
            {note ? ` (${note})` : ""} di {receipt}
          </>
        ),
        extra: a.actor ? [`oleh ${a.actor}`] : [],
      };
    case "discount_unapproved":
      return {
        main: (
          <>
            Diskon <strong className="font-semibold tabular-nums">{amount ?? "—"}</strong>
            {note ? ` (${note})` : ""} di {receipt} diberikan tanpa persetujuan pemilik
          </>
        ),
        extra: a.actor ? [`oleh ${a.actor}`] : [],
      };
    case "shift_closed": {
      const d = a.difference;
      const place = a.outlet_name ? ` ${a.outlet_name}` : "";
      const calc =
        a.expected !== null && a.counted !== null ? ` (seharusnya ${formatRupiah(a.expected)}, dihitung ${formatRupiah(a.counted)})` : "";
      return {
        main: (
          <>
            Tutup kasir{place} oleh <strong className="font-semibold">{who(a.actor)}</strong>
            {d !== null && (
              <>
                :{" "}
                <span className={`font-semibold ${d < 0 ? "text-danger" : d > 0 ? "text-warning" : "text-success"}`}>
                  {d === 0 ? "pas" : `${d < 0 ? "kurang" : "lebih"} ${formatRupiah(Math.abs(d))}`}
                </span>
                {calc}
              </>
            )}
          </>
        ),
        extra: note ? [`catatan: ${note}`] : [],
      };
    }
    case "cash_in":
    case "cash_out":
      return {
        main: (
          <>
            {a.kind === "cash_in" ? "Kas masuk" : "Kas keluar"} <strong className="font-semibold tabular-nums">{amount ?? "—"}</strong>
            {note ? ` — ${note}` : ""}
            {a.actor ? ` (${a.actor})` : ""}
          </>
        ),
        extra: [],
      };
    case "new_device":
      return {
        main: (
          <>
            <strong className="font-semibold">{who(a.actor)}</strong> masuk dari perangkat/browser baru
          </>
        ),
        extra: note ? [note] : [],
      };
    case "change":
      // Ditangani describeChange (butuh nama kategori & daftar kolom).
      return { main: null, extra: [] };
  }
}

function hrefOf(a: ActivityItem): string | null {
  if (a.kind === "change") return changeHref(a);
  if (!a.ref_id) return null;
  if (a.kind === "void" || a.kind === "refund" || a.kind === "partial_refund" || a.kind === "manual_discount" || a.kind === "discount_unapproved")
    return `/dasbor/transaksi/${a.ref_id}`;
  if (a.kind === "shift_closed" || a.kind === "cash_in" || a.kind === "cash_out") return `/dasbor/shift/${a.ref_id}`;
  return null;
}

// ——— Riwayat perubahan data (`change`) ———

/** Nama kategori per id (untuk kolom `category_id`); `null` = belum/tidak dimuat. */
type ChangeCtx = { categories: Map<string, string> | null };

const PAYMENT_FIELD = "settings.payment_methods";
/** Kolom rahasia: server hanya mencatat "berubah" tanpa nilai. */
const SECRET_FIELDS = new Set(["pin_hash", "payroll"]);
/** Uang (rupiah bulat). */
const MONEY_FIELDS = new Set(["price", "cost_price", "min_purchase"]);

const DISCOUNT_SCOPE: Record<string, string> = { cart: "seluruh nota", category: "kategori tertentu", product: "produk tertentu" };
const DISCOUNT_TYPE: Record<string, string> = { percent: "persen", fixed: "nominal" };

function isImportantChange(a: ActivityItem): boolean {
  return a.kind === "change" && (a.changes ?? []).some((c) => c.field === PAYMENT_FIELD);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const sameJson = (x: unknown, y: unknown) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
const capital = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function fieldLabel(entity: string, field: string): string {
  if (field.startsWith("settings.")) {
    const key = field.slice("settings.".length);
    return SETTINGS_KEY[key] ?? `pengaturan ${key.replace(/_/g, " ")}`;
  }
  return CHANGE_FIELD[`${entity}.${field}`] ?? CHANGE_FIELD[field] ?? field.replace(/_/g, " ");
}

/** Bagian metode pembayaran yang berubah: "QRIS", "rekening transfer", "kartu". */
function paymentParts(c: ActivityFieldChange): string[] {
  const b = isObj(c.before) ? c.before : {};
  const af = isObj(c.after) ? c.after : {};
  const parts: string[] = [];
  if (!sameJson(b.qris, af.qris)) parts.push("QRIS");
  if (!sameJson(b.transfer, af.transfer)) parts.push("rekening transfer");
  if (!sameJson(b.card, af.card)) parts.push("kartu");
  return parts;
}

const joinId = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`);

/**
 * Nilai kolom untuk ditampilkan; `null` = tidak layak ditampilkan (objek/rahasia/foto) → cukup "diubah".
 * `changes` dipakai untuk konteks (mis. jenis diskon saat menampilkan besar diskon).
 */
function formatValue(entity: string, field: string, v: unknown, changes: ActivityFieldChange[], ctx: ChangeCtx, side: "before" | "after"): string | null {
  if (SECRET_FIELDS.has(field) || field === "image_url") return null;
  if (v === null || v === undefined || v === "") return "kosong";
  if (field === "settings.timezone" && typeof v === "string") return v;
  if (field === "settings.rounding" && isObj(v)) {
    if (v.enabled === false) return "nonaktif";
    return typeof v.unit === "number" ? `ke ${formatRupiah(v.unit)}` : "aktif";
  }
  if (field.startsWith("settings.")) return null;
  if (MONEY_FIELDS.has(field) && typeof v === "number") return formatRupiah(v);
  if (entity === "discounts" && field === "value" && typeof v === "number") {
    const t = changes.find((c) => c.field === "type");
    const type = t ? (side === "before" && t.before ? t.before : t.after) : null;
    if (type === "percent") return `${(v / 100).toLocaleString("id-ID")}%`;
    if (type === "fixed") return formatRupiah(v);
    return null;
  }
  if (entity === "discounts" && field === "type" && typeof v === "string") return labelOf(DISCOUNT_TYPE, v);
  if (entity === "discounts" && field === "scope" && typeof v === "string") return labelOf(DISCOUNT_SCOPE, v);
  if (field === "category_id" && typeof v === "string") return ctx.categories?.get(v) ?? "kategori lain";
  if (field === "is_active" && typeof v === "boolean") return v ? "aktif" : "nonaktif";
  if (typeof v === "boolean") return v ? "Ya" : "Tidak";
  if (field === "role" && typeof v === "string") return labelOf(ROLES, v);
  if (entity === "outlets" && field === "status" && typeof v === "string") return labelOf(OUTLET_STATUS, v);
  if (field === "min_stock" && typeof v === "number") return (v / 1000).toLocaleString("id-ID", { maximumFractionDigits: 3 });
  if ((field === "starts_at" || field === "ends_at") && typeof v === "string") {
    const t = Date.parse(v);
    return Number.isNaN(t) ? v : formatDayLong(zonedDay(v));
  }
  if (Array.isArray(v)) {
    if (field === "variant_options") return null;
    const unit = field === "options" ? "opsi" : field === "items" ? "bahan" : field === "modifier_group_ids" ? "grup" : "item";
    return v.length === 0 ? "kosong" : `${v.length.toLocaleString("id-ID")} ${unit}`;
  }
  if (typeof v === "number") return v.toLocaleString("id-ID");
  if (typeof v === "string") return `“${v}”`;
  return null;
}

type ChangeLine = { label: string; text: string };

/** Baris rincian per kolom: "Harga: Rp20.000 → Rp21.000" / "PIN: diubah" / (create) "Harga: Rp15.000". */
function changeLines(a: ActivityItem, ctx: ChangeCtx): ChangeLine[] {
  const entity = a.entity ?? "";
  const list = a.changes ?? [];
  return list
    // Baru: nama sudah di kalimat; larik/teks kosong (mis. modifier, pilihan varian) hanya derau.
    .filter((c) => !(a.op === "create" && (c.field === "name" || c.after === "" || (Array.isArray(c.after) && c.after.length === 0))))
    .map((c) => {
      const label = capital(fieldLabel(entity, c.field));
      if (c.field === PAYMENT_FIELD) {
        const parts = paymentParts(c);
        return { label, text: parts.length ? `${capital(joinId(parts))} diubah` : "diubah" };
      }
      const after = formatValue(entity, c.field, c.after, list, ctx, "after");
      if (a.op === "create") return { label, text: after ?? (c.field === "image_url" ? "ada" : "diisi") };
      const before = formatValue(entity, c.field, c.before, list, ctx, "before");
      if (before === null || after === null) {
        if (c.field === "image_url") return { label, text: !c.before ? "ditambahkan" : !c.after ? "dihapus" : "diganti" };
        return { label, text: "diubah" };
      }
      return { label, text: `${before} → ${after}` };
    });
}

/** Kalimat utama entri perubahan. */
function changeSentence(a: ActivityItem, ctx: ChangeCtx): { main: React.ReactNode; extra: string[]; inline: boolean } {
  const entity = a.entity ?? "";
  const noun = CHANGE_ENTITY[entity] ?? "data";
  const actor = <strong className="font-semibold">{who(a.actor)}</strong>;
  const nameText = text(a.note) || (entity === "business_settings" ? "Pengaturan usaha" : "(tanpa nama)");
  const name = <strong className="font-semibold">{nameText}</strong>;
  const list = a.changes ?? [];
  const isSettings = entity === "business_settings";
  if (a.op === "create") return { main: <>{actor} menambah {noun} {name}</>, extra: [], inline: false };
  if (a.op === "delete") return { main: <>{actor} menghapus {noun} {name}</>, extra: [], inline: false };
  if (list.length === 1) {
    const c = list[0];
    if (SECRET_FIELDS.has(c.field)) {
      return {
        main: (
          <>
            {c.field === "pin_hash" ? "PIN" : "Pengaturan gaji"} {name} diubah
          </>
        ),
        extra: a.actor ? [`oleh ${a.actor}`] : [],
        inline: true,
      };
    }
    if (c.field === PAYMENT_FIELD) {
      const parts = paymentParts(c);
      return {
        main: (
          <>
            {actor} mengubah <span className="font-semibold text-warning">{parts.length ? joinId(parts) : "metode pembayaran"}</span> {isSettings ? "usaha" : <>outlet {name}</>}
          </>
        ),
        extra: [],
        inline: true,
      };
    }
    if (c.field.startsWith("settings.")) {
      const label = fieldLabel(entity, c.field);
      const before = formatValue(entity, c.field, c.before, list, ctx, "before");
      const after = formatValue(entity, c.field, c.after, list, ctx, "after");
      return {
        main: (
          <>
            {actor} mengubah pengaturan <strong className="font-semibold">{label}</strong>
            {isSettings ? " usaha" : <> outlet {name}</>}
            {before !== null && after !== null && <span className="tabular-nums"> {before} → {after}</span>}
          </>
        ),
        extra: [],
        inline: true,
      };
    }
    if (c.field === "is_active" && typeof c.after === "boolean") {
      return { main: <>{actor} {c.after ? "mengaktifkan" : "menonaktifkan"} {noun} {name}</>, extra: [], inline: true };
    }
    if (c.field === "name" && typeof c.before === "string" && typeof c.after === "string") {
      return { main: <>{actor} mengganti nama {noun} “{c.before}” → <strong className="font-semibold">{c.after}</strong></>, extra: [], inline: true };
    }
    const label = fieldLabel(entity, c.field);
    const before = formatValue(entity, c.field, c.before, list, ctx, "before");
    const after = formatValue(entity, c.field, c.after, list, ctx, "after");
    if (before !== null && after !== null) {
      return {
        main: (
          <>
            {actor} mengubah {label} {name} <span className="font-semibold tabular-nums">{before} → {after}</span>
          </>
        ),
        extra: [],
        inline: true,
      };
    }
    const verb = c.field === "image_url" ? (!c.before ? "menambah" : !c.after ? "menghapus" : "mengganti") : "mengubah";
    return { main: <>{actor} {verb} {label} {noun} {name}</>, extra: [], inline: true };
  }
  if (isSettings) return { main: <>{actor} mengubah {name}</>, extra: [], inline: false };
  return { main: <>{actor} mengubah {noun} {name}</>, extra: [], inline: false };
}

function changeHref(a: ActivityItem): string | null {
  if (a.op === "delete") return null;
  const settings = (a.changes ?? []).some((c) => c.field.startsWith("settings."));
  switch (a.entity) {
    case "products":
      return a.note?.trim() ? `/dasbor/produk?q=${encodeURIComponent(a.note.trim().slice(0, 80))}` : "/dasbor/produk";
    case "product_variants":
    case "recipes":
      return "/dasbor/produk";
    case "categories":
      return "/dasbor/produk?tab=kategori";
    case "modifier_groups":
      return "/dasbor/produk?tab=modifier";
    case "discounts":
      return "/dasbor/produk?tab=diskon";
    case "outlets":
      return settings ? "/dasbor/pengaturan" : "/dasbor/outlet";
    case "business_settings":
      return "/dasbor/pengaturan";
    case "employees":
      return "/dasbor/tim";
    default:
      return null;
  }
}

const CHANGE_LINK_LABEL: Record<string, string> = {
  products: "Lihat produk",
  product_variants: "Lihat produk",
  recipes: "Lihat produk",
  categories: "Lihat kategori",
  modifier_groups: "Lihat modifier",
  discounts: "Lihat diskon",
  outlets: "Buka",
  business_settings: "Buka pengaturan",
  employees: "Lihat tim",
};

// ——— Ringkasan periode ———

type Summary = {
  counts: Record<ActivityKind, number>;
  /** Tutup kasir dengan selisih kurang (dari hingga 500 tutup kasir pertama). */
  short: { count: number; amount: number; closes: number };
  /** Perubahan metode pembayaran (QRIS & rekening) dari hingga 500 perubahan data pertama. */
  payment: { count: number; last: ActivityItem | null };
};

/** Ambil hingga 500 baris satu jenis (5 × 100) + total sebenarnya. */
async function loadRows(base: ActivityQuery, k: ActivityKind, signal: AbortSignal): Promise<{ rows: ActivityItem[]; total: number }> {
  const api = await ownerApi();
  const rows: ActivityItem[] = [];
  let total = 0;
  for (let p = 1; p <= 5; p++) {
    const r = await api.activity({ ...base, kind: [k], page: p, per_page: 100 }, signal);
    rows.push(...r.items);
    total = r.meta.total;
    if (r.items.length === 0 || rows.length >= total) break;
  }
  return { rows, total };
}

async function loadSummary(base: ActivityQuery, signal: AbortSignal): Promise<Summary> {
  const api = await ownerApi();
  // Jumlah per jenis dari meta.total (per_page=1); tutup kasir & perubahan data diambil penuh untuk menghitung
  // selisih kurang dan perubahan metode pembayaran.
  const others = ACTIVITY_KINDS.filter((k) => k !== "shift_closed" && k !== "change");
  // `partial_refund`/`discount_unapproved` (2026-10-21) belum dikenal server lama → 0, jangan gagalkan ringkasan.
  const totals = Promise.all(
    others.map((k) =>
      api
        .activity({ ...base, kind: [k], page: 1, per_page: 1 }, signal)
        .then((r) => [k, r.meta.total] as const)
        .catch((err: unknown) => {
          if ((k === "partial_refund" || k === "discount_unapproved") && !signal.aborted) return [k, 0] as const;
          throw err;
        })
    )
  );
  const [pairs, c, ch] = await Promise.all([totals, loadRows(base, "shift_closed", signal), loadRows(base, "change", signal)]);
  const counts = Object.fromEntries([...pairs, ["shift_closed", c.total], ["change", ch.total]]) as Record<ActivityKind, number>;
  const shortRows = c.rows.filter((r) => r.difference !== null && r.difference < 0);
  const payRows = ch.rows.filter(isImportantChange);
  return {
    counts,
    short: { count: shortRows.length, amount: shortRows.reduce((s, r) => s + Math.abs(r.difference ?? 0), 0), closes: c.total },
    payment: { count: payRows.length, last: payRows[0] ?? null },
  };
}

function SummaryCards({ s, allOutlets }: { s: Summary; allOutlets: boolean }) {
  const c = s.counts;
  const cancelled = c.void + c.refund;
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatCard
        label="Pembatalan & pengembalian"
        icon={<Ban size={14} aria-hidden />}
        value={cancelled}
        tone={cancelled > 0 ? "danger" : "neutral"}
        hint={
          <>
            {c.void.toLocaleString("id-ID")} batal · {c.refund.toLocaleString("id-ID")} dikembalikan
            {/* Refund sebagian: transaksinya tetap lunas — bukan bagian dari angka kartu. */}
            {c.partial_refund > 0 && <span className="block">+{c.partial_refund.toLocaleString("id-ID")} refund sebagian (tidak termasuk)</span>}
          </>
        }
      />
      <StatCard
        label="Selisih kas kurang"
        icon={<Wallet size={14} aria-hidden />}
        value={s.short.count > 0 ? `-${formatRupiah(s.short.amount)}` : "Tidak ada"}
        tone={s.short.count > 0 ? "danger" : "success"}
        hint={`${s.short.count.toLocaleString("id-ID")} dari ${s.short.closes.toLocaleString("id-ID")} tutup kasir`}
      />
      <StatCard
        label="Diskon manual"
        icon={<Percent size={14} aria-hidden />}
        value={c.manual_discount}
        tone={c.discount_unapproved > 0 ? "danger" : "neutral"}
        hint={
          c.discount_unapproved > 0 ? (
            <span className="font-semibold text-danger">{c.discount_unapproved.toLocaleString("id-ID")} tanpa persetujuan pemilik</span>
          ) : (
            "transaksi dengan diskon non-otomatis"
          )
        }
      />
      <StatCard
        label="Kas masuk / keluar"
        icon={<ArrowUpRight size={14} aria-hidden />}
        value={`${c.cash_in.toLocaleString("id-ID")} / ${c.cash_out.toLocaleString("id-ID")}`}
        hint={allOutlets ? `${c.new_device.toLocaleString("id-ID")} login dari perangkat baru` : "catatan kas laci"}
      />
      <StatCard
        label="Perubahan data"
        icon={s.payment.count > 0 ? <ShieldAlert size={14} aria-hidden /> : <PencilLine size={14} aria-hidden />}
        value={c.change}
        tone={s.payment.count > 0 ? "warning" : "neutral"}
        hint={
          s.payment.count > 0 ? (
            <span className="font-semibold text-warning">
              {s.payment.count.toLocaleString("id-ID")} perubahan metode pembayaran
              {s.payment.last?.actor ? ` · terakhir ${s.payment.last.actor}` : ""}
            </span>
          ) : (
            "metode pembayaran tidak berubah"
          )
        }
      />
    </div>
  );
}

// ——— Halaman ———

export function ActivityView() {
  const { outletId, session, withOutlet } = useOwner();
  const period = usePeriod("7d");
  const { from, to, preset, qs } = period;
  const kind = qs.list("kind").filter(isKind);
  const page = Math.max(1, Number(qs.get("page")) || 1);
  const allOutlets = !outletId;
  const showOutlet = allOutlets && session.outlets.length > 1;
  // Perangkat baru hanya ada saat semua outlet.
  const kindOptions = ACTIVITY_KINDS.filter((k) => allOutlets || k !== "new_device");

  const { state, reload } = useLoad<ActivityPage>(
    async (signal) => (await ownerApi()).activity({ from, to, outlet_id: outletId, kind, page, per_page: PER_PAGE }, signal),
    [from, to, outletId, kind.join(","), page]
  );
  const summary = useLoad<Summary>((signal) => loadSummary({ from, to, outlet_id: outletId }, signal), [from, to, outletId]);
  const counts = summary.state.data?.counts;

  const data = state.data;
  const categories = useCategoryNames(!!data?.items.some((a) => a.kind === "change" && (a.changes ?? []).some((c) => c.field === "category_id")));
  const ctx: ChangeCtx = { categories };
  const filtered = kind.length > 0;
  const toggle = (k: ActivityKind) => qs.update({ kind: kind.includes(k) ? kind.filter((x) => x !== k) : [...kind, k] });

  // Kelompokkan per tanggal (zona usaha) (data sudah urut terbaru).
  const groups: { day: string; items: ActivityItem[] }[] = [];
  for (const a of data?.items ?? []) {
    const day = zonedDay(a.at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(a);
    else groups.push({ day, items: [a] });
  }

  return (
    <>
      <PageHeader
        title="Aktivitas"
        description="Kejadian penting di kasir dan riwayat perubahan data: pembatalan, pengembalian dana, diskon manual, tutup kasir, kas masuk/keluar, login dari perangkat baru, serta siapa mengubah harga, produk, dan pengaturan."
      />
      <FilterBar>
        <PeriodFilter from={from} to={to} preset={preset} onChange={period.setPeriod} />
        {filtered && <ClearFiltersButton onClick={() => qs.update({ kind: null })} />}
      </FilterBar>

      {summary.state.status === "error" ? null : summary.state.data ? (
        <SummaryCards s={summary.state.data} allOutlets={allOutlets} />
      ) : (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" role="status" aria-label="Memuat ringkasan">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[92px] animate-pulse rounded-[14px] border border-border-subtle bg-white motion-reduce:animate-none" />
          ))}
        </div>
      )}

      <div role="group" aria-label="Jenis aktivitas" className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip on={!filtered} onClick={() => qs.update({ kind: null })}>
          Semua
        </Chip>
        {kindOptions.map((k) => (
          <Chip key={k} on={kind.includes(k)} onClick={() => toggle(k)}>
            {ACTIVITY_KIND[k]}
            {counts && <span className={`ml-1.5 tabular-nums ${counts[k] ? "" : "opacity-60"}`}>{counts[k].toLocaleString("id-ID")}</span>}
          </Chip>
        ))}
      </div>

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!data && state.status === "loading" && <SkeletonList rows={8} label="Memuat aktivitas" />}
      {data && (
        <>
          <LoadingBar active={state.status === "loading"} />
          {data.items.length === 0 ? (
            <section className={cardClass}>
              <EmptyState
                icon={<History size={22} aria-hidden />}
                title={filtered ? "Tidak ada aktivitas yang cocok" : "Belum ada aktivitas"}
                action={filtered ? <ClearFiltersButton onClick={() => qs.update({ kind: null })} /> : undefined}
              >
                {filtered ? "Pilih jenis lain atau perluas periode." : "Tidak ada pembatalan, diskon manual, tutup kasir, kas masuk/keluar, atau perubahan data pada periode ini."}
              </EmptyState>
            </section>
          ) : (
            <div className={`flex flex-col gap-4 transition-opacity ${state.status === "loading" ? "opacity-60" : ""}`} aria-busy={state.status === "loading"}>
              {groups.map((g) => (
                <section key={g.day} className={`${cardClass} overflow-hidden`} aria-labelledby={`hari-${g.day}`}>
                  <h2 id={`hari-${g.day}`} className="border-b border-border-subtle bg-bg-muted/50 px-4 py-2 text-[13px] font-semibold text-text-heading sm:px-5">
                    {formatDayLong(g.day)}
                  </h2>
                  <ul className="divide-y divide-border-subtle">
                    {g.items.map((a, i) => (
                      <ActivityRow key={`${a.kind}:${a.ref_id ?? ""}:${a.at}:${i}`} a={a} showOutlet={showOutlet} href={hrefOf(a)} withOutlet={withOutlet} ctx={ctx} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          {data.meta.total > data.meta.per_page && (
            <div className="mt-3">
              <Pagination page={data.meta.page} perPage={data.meta.per_page} total={data.meta.total} onPage={(p) => qs.update({ page: String(p) })} />
            </div>
          )}
          <SyncNote className="mt-4" />
        </>
      )}
    </>
  );
}

function ActivityRow({
  a,
  showOutlet,
  href,
  withOutlet,
  ctx,
}: {
  a: ActivityItem;
  showOutlet: boolean;
  href: string | null;
  withOutlet: (h: string) => string;
  ctx: ChangeCtx;
}) {
  if (a.kind === "change") return <ChangeRow a={a} href={href} withOutlet={withOutlet} ctx={ctx} />;
  const Icon = KIND_ICON[a.kind];
  const { main, extra } = describe(a);
  // Nama outlet sudah ada di kalimat tutup kasir.
  const outlet = showOutlet && a.kind !== "shift_closed" ? a.outlet_name : null;
  const meta = [`${formatTime(a.at)} ${zoneLabel()}`, ACTIVITY_KIND[a.kind], outlet, ...extra].filter(Boolean).join(" · ");
  const body = (
    <>
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[toneOf(a)]}`}>
        <Icon size={16} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] leading-snug text-text-heading">{main}</span>
        <span className="mt-0.5 block text-[12.5px] leading-snug text-text-muted">{meta}</span>
      </span>
      {href && <ChevronRight size={16} aria-hidden className="mt-2 shrink-0 text-text-muted group-hover:text-text-heading" />}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={withOutlet(href)} className={`group flex items-start gap-3 px-4 py-3 hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}>
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 sm:px-5">{body}</div>
      )}
    </li>
  );
}

/**
 * Entri perubahan data: kalimat utama, perangkat, rincian kolom (langsung tampil bila ≤ 2 kolom, selebihnya bisa
 * dibuka), dan tautan ke halaman terkait (terpisah dari tombol buka agar tidak bersarang dalam satu tautan).
 */
function ChangeRow({ a, href, withOutlet, ctx }: { a: ActivityItem; href: string | null; withOutlet: (h: string) => string; ctx: ChangeCtx }) {
  const [open, setOpen] = React.useState(false);
  const detailId = React.useId();
  const Icon = isImportantChange(a) ? ShieldAlert : KIND_ICON.change;
  const { main, extra, inline } = changeSentence(a, ctx);
  const lines = inline ? [] : changeLines(a, ctx);
  const collapsible = lines.length > 2;
  const important = isImportantChange(a);
  const meta = [`${formatTime(a.at)} ${zoneLabel()}`, ACTIVITY_KIND.change, text(a.device) || null, ...extra].filter(Boolean).join(" · ");
  return (
    <li className={`flex items-start gap-3 px-4 py-3 sm:px-5 ${important ? "bg-warning-tint/40" : ""}`} data-kind="change">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${TONE_CLASS[toneOf(a)]}`}>
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug text-text-heading">
          {main}
          {important && (
            <span className="ml-1.5 align-middle">
              <Badge tone="warning">Penting</Badge>
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-text-muted">{meta}</p>
        {lines.length > 0 && (!collapsible || open) && (
          <ul id={detailId} className="mt-1.5 flex flex-col gap-0.5 rounded-lg bg-bg-muted/60 px-3 py-2 text-[12.5px] leading-snug text-text-body">
            {lines.map((l, i) => (
              <li key={i}>
                <span className="text-text-muted">{l.label}:</span> <span className="tabular-nums">{l.text}</span>
              </li>
            ))}
          </ul>
        )}
        {collapsible && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={open ? detailId : undefined}
            onClick={() => setOpen((v) => !v)}
            className={`mt-1 inline-flex items-center gap-1 rounded text-[12.5px] font-semibold text-brand-ink hover:underline ${focusRing}`}
          >
            {open ? "Sembunyikan rincian" : a.op === "create" ? `Lihat rincian (${lines.length.toLocaleString("id-ID")} kolom)` : `Lihat ${lines.length.toLocaleString("id-ID")} perubahan`}
            <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {href && (
        <Link
          href={withOutlet(href)}
          className={`mt-1 inline-flex shrink-0 items-center gap-0.5 rounded text-[12.5px] font-semibold text-text-muted hover:text-text-heading ${focusRing}`}
        >
          <span className="hidden sm:inline">{CHANGE_LINK_LABEL[a.entity ?? ""] ?? "Buka"}</span>
          <ChevronRight size={16} aria-hidden />
          <span className="sr-only sm:hidden">{CHANGE_LINK_LABEL[a.entity ?? ""] ?? "Buka"}</span>
        </Link>
      )}
    </li>
  );
}

/** Nama kategori untuk kolom `category_id` — dimuat sekali, hanya bila ada perubahan kategori di halaman ini. */
function useCategoryNames(needed: boolean): Map<string, string> | null {
  const [names, setNames] = React.useState<Map<string, string> | null>(null);
  React.useEffect(() => {
    if (!needed || names) return;
    let alive = true;
    pullAll("categories")
      .then((rows) => {
        if (alive) setNames(new Map(rows.map((r) => [r.id, typeof r.name === "string" ? r.name : ""])));
      })
      .catch(() => {
        // Gagal → tampil "kategori lain"; dicoba lagi saat halaman dibuka ulang.
      });
    return () => {
      alive = false;
    };
  }, [needed, names]);
  return names;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-9 shrink-0 items-center rounded-full border px-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${
        on ? "border-brand-primary/50 bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-body hover:border-border-active"
      } ${focusRing}`}
    >
      {children}
    </button>
  );
}
