"use client";

import React, { useEffect, useId, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, CalendarClock, Check, ChevronDown, HandCoins, Headset, Info, Lock, QrCode, Receipt, Sparkles, UserCheck, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Meter } from "@/components/admin/charts";
import { BILLING_CYCLES, PAYMENT_METHODS } from "@/components/admin/labels";
import {
  Badge,
  btn,
  ErrorBlock,
  formatDate,
  formatRupiah,
  LoadingBar,
  PageHeader,
  Section,
  SkeletonList,
  tdClass,
  thClass,
  useLoad,
} from "@/components/admin/ui";
import { PRICING_FEATURES } from "@/constants/pricing";
import { ownerApi } from "@/lib/owner/api";
import type { PayCycle, SubscriptionDetail } from "@/lib/owner/types";
import { useOwner } from "./OwnerShell";
import { PayDialog } from "./PayDialog";
import { labelOf } from "./labels";

// Langganan (GET /owner/subscription): status paket, pemakaian, fitur Pro, harga, bayar online lewat Duitku
// (dialog PayDialog), dan riwayat pembayaran. `?checkout=<id>` = kembali dari e-wallet → dialog menampilkan statusnya.

const STATUS: Record<SubscriptionDetail["status"], { text: string; tone: "brand" | "warning" | "neutral" | "success" }> = {
  active: { text: "Pro aktif", tone: "success" },
  trial: { text: "Uji coba Pro", tone: "brand" },
  grace: { text: "Masa tenggang", tone: "warning" },
  free: { text: "Gratis", tone: "neutral" },
};

type SubscriptionPaymentRow = NonNullable<SubscriptionDetail["billing"]>["payments"][number];

const methodLabel = (m: string) => (m === "gateway" ? "Pembayaran online" : labelOf(PAYMENT_METHODS, m));

const PAYMENT_STATUS: Record<string, string> = { recorded: "Tercatat", void: "Dibatalkan" };

// Contoh cara bayar di kartu utama. GoPay bukan kanal sendiri: dibayar lewat QRIS.
const PAY_LOGOS = ["qris", "bca", "gopay", "indomaret"].map((n) => `/logos/pembayaran/${n}.svg`);

export function SubscriptionView() {
  const router = useRouter();
  const pathname = usePathname();
  const { refreshSession } = useOwner();
  const { state, reload } = useLoad<SubscriptionDetail>(async (signal) => (await ownerApi()).subscription(signal), []);
  const [picked, setPicked] = useState<PayCycle | null>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [returnId, setReturnId] = useState<string | undefined>();
  const s = state.data;
  // Bawaan Tahunan; pelanggan aktif yang sedang bulanan/6 bulan diarahkan ke siklusnya (6 Bulan hanya bila server mengirim harganya).
  const cur = s?.status === "active" ? s.billing_cycle : null;
  const cycle: PayCycle = picked ?? (cur === "monthly" || (cur === "semiannual" && s?.billing?.prices.semiannual !== undefined) ? cur : "yearly");

  // Kembali dari e-wallet: buka dialog dengan status checkout itu, lalu buang query agar muat ulang tidak membukanya lagi.
  useEffect(() => {
    const t = setTimeout(() => {
      const id = new URLSearchParams(window.location.search).get("checkout");
      if (!id) return;
      setReturnId(id);
      setPayOpen(true);
      router.replace(pathname);
    }, 0);
    return () => clearTimeout(t);
  }, [router, pathname]);

  function closePay() {
    setPayOpen(false);
    setReturnId(undefined);
  }

  return (
    <>
      <PageHeader title="Langganan" description="Paket dan pembayaran usaha Anda." />

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!s && state.status === "loading" && <SkeletonList rows={4} label="Memuat langganan" />}
      {s && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <PayCard s={s} cycle={cycle} setCycle={setPicked} onPay={() => setPayOpen(true)} />
              <HistorySection payments={s.billing?.payments ?? []} />
            </div>
            <div className="flex min-w-0 flex-col gap-4">
              <UsageCard s={s} />
              <FeaturesCard pro={s.plan === "pro"} />
            </div>
          </div>
        </>
      )}
      <PayDialog cycle={cycle} open={payOpen} onClose={closePay} onPaid={() => {
          reload();
          // Lencana paket di sidebar membaca sesi: muat ulang tanpa memuat ulang halaman.
          refreshSession().catch(() => {});
        }} initialCheckoutId={returnId} />
    </>
  );
}

type Tone = "brand" | "warning" | "success" | "neutral";

const EYEBROW_TONE: Record<Tone, string> = { brand: "text-brand-ink", warning: "text-warning", success: "text-success", neutral: "text-text-muted" };

function daysText(n: number | null): string {
  if (n === null) return "";
  if (n <= 0) return "hari ini";
  return `${n.toLocaleString("id-ID")} hari lagi`;
}

/** Eyebrow, judul, dan nada kartu utama menurut status paket. */
function headlineFor(s: SubscriptionDetail): { eyebrow: string; title: string; tone: Tone; extra?: string } {
  const until = s.ends_at ? formatDate(s.ends_at) : null;
  const left = daysText(s.days_left);
  switch (s.status) {
    case "trial":
      return {
        eyebrow: left ? `Uji coba Pro berakhir ${left}` : "Uji coba Pro",
        title: "Lanjutkan Pro agar meja, kasbon, dan laporan tetap aktif",
        tone: "brand",
      };
    case "grace":
      return {
        eyebrow: left ? `Masa Pro sudah habis, masa tenggang berakhir ${left}` : "Masa Pro sudah habis",
        title: "Bayar sekarang agar fitur Pro tidak terkunci",
        tone: "warning",
        extra: `Fitur Pro masih terbuka${until ? ` sampai ${until}` : ""}, setelah itu usaha kembali ke paket Gratis.`,
      };
    case "active":
      return { eyebrow: `Pro aktif sampai ${until ?? "—"}`, title: "Perpanjang Pro", tone: "success" };
    default: {
      const lim = s.limits.tx_per_month;
      return {
        eyebrow: "Paket Gratis",
        title: lim !== null ? `Upgrade ke Pro: batas ${lim.toLocaleString("id-ID")} transaksi per bulan dicabut` : "Upgrade ke Pro untuk membuka semua fitur",
        tone: "neutral",
        extra: "Data tidak pernah dihapus saat turun paket.",
      };
    }
  }
}

function PlanCard({ value, current, onChange, name, price, unit, note, badge, tag }: {
  value: PayCycle;
  current: PayCycle;
  onChange: (c: PayCycle) => void;
  name: string;
  price: number;
  unit: string;
  note?: string;
  badge?: string;
  tag?: string;
}) {
  const on = current === value;
  return (
    <label
      className={`relative flex cursor-pointer flex-col rounded-[14px] border-[1.5px] p-3.5 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
        on ? "border-brand-primary bg-brand-tint shadow-[0_0_0_1px_var(--color-brand-primary)]" : "border-border-subtle bg-white hover:border-border-active"
      } ${badge ? "mt-2.5 sm:mt-0" : ""}`}
    >
      <input type="radio" name="pay-cycle" value={value} checked={on} onChange={() => onChange(value)} className="peer sr-only" />
      {badge && (
        <span className="absolute -top-2.5 left-3 rounded-full bg-brand-deep px-2 py-0.5 text-[11.5px] font-semibold text-white">{badge}</span>
      )}
      <span
        aria-hidden
        className={`absolute right-3 top-3 h-[18px] w-[18px] rounded-full bg-white ${on ? "border-[5px] border-brand-primary" : "border-[1.5px] border-border-active"}`}
      />
      <span className="text-[13.5px] font-semibold text-text-heading">{name}</span>
      <span className="mt-1.5 text-[20px] font-bold tracking-tight tabular-nums text-text-heading">
        {formatRupiah(price)}
        <span className="text-[12px] font-normal text-text-muted">{unit}</span>
      </span>
      {note && <span className="mt-1.5 text-[12.5px] text-text-muted">{note}</span>}
      {tag && <span className="mt-1.5 inline-block self-start rounded-[10px] bg-success-tint px-2 py-0.5 text-[11.5px] font-semibold leading-snug text-success">{tag}</span>}
    </label>
  );
}

function PayCard({ s, cycle, setCycle, onPay }: { s: SubscriptionDetail; cycle: PayCycle; setCycle: (c: PayCycle) => void; onPay: () => void }) {
  const h = headlineFor(s);
  const border = h.tone === "warning" ? "border-warning" : "border-border-subtle";
  const bg = h.tone === "warning" ? "bg-warning-tint" : "bg-white";
  const prices = s.billing?.prices;
  const semi = prices?.semiannual;
  const price = prices ? (cycle === "monthly" ? prices.monthly : cycle === "semiannual" && semi !== undefined ? semi : prices.yearly) : 0;
  const saving = prices ? prices.monthly * 12 - prices.yearly : 0;
  const twoFree = prices !== undefined && saving > 0 && saving === 2 * prices.monthly;
  const semiSaving = prices && semi !== undefined ? prices.monthly * 6 - semi : 0;
  return (
    <section aria-label="Bayar Pro" className={`rounded-[16px] border p-4 sm:p-5 ${border} ${bg}`}>
      <p className={`text-[12.5px] font-semibold ${EYEBROW_TONE[h.tone]}`}>{h.eyebrow}</p>
      <h2 className="mt-1 text-[20px] font-bold leading-tight tracking-tight text-text-heading sm:text-[22px]">{h.title}</h2>
      <p className="mt-1 text-[13px] text-text-muted">
        Tanpa perpanjangan otomatis. Data Anda tetap aman.{h.extra ? ` ${h.extra}` : ""}
      </p>

      {prices ? (
        <>
          <fieldset className="mt-4">
            <legend className="sr-only">Pilih paket Pro</legend>
            <div className={`grid gap-3 ${semi !== undefined ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
              <PlanCard value="monthly" current={cycle} onChange={setCycle} name="Bulanan" price={prices.monthly} unit="/bulan" note="Fleksibel, bayar tiap bulan" />
              {semi !== undefined && (
                <PlanCard
                  value="semiannual"
                  current={cycle}
                  onChange={setCycle}
                  name="6 Bulan"
                  price={semi}
                  unit="/6 bulan"
                  note={`${formatRupiah(Math.round(semi / 6))}/bulan`}
                  tag={semiSaving > 0 ? `Hemat ${formatRupiah(semiSaving)}` : undefined}
                />
              )}
              <PlanCard
                value="yearly"
                current={cycle}
                onChange={setCycle}
                name="Tahunan"
                price={prices.yearly}
                unit="/tahun"
                badge="Paling hemat"
                tag={saving > 0 ? `Hemat ${formatRupiah(saving)}${twoFree ? " · 2 bulan gratis" : ""}` : undefined}
              />
            </div>
          </fieldset>
          <button type="button" className={`${btn.primary} mt-4 w-full !min-h-12 text-[15px]`} onClick={onPay}>
            Bayar {formatRupiah(price)}
          </button>
          <div className="mt-2 text-center text-[12px] text-text-muted">
            <p>Pro langsung aktif setelah pembayaran diterima</p>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
              {PAY_LOGOS.map((u) => (
                <MethodLogoImg key={u} src={u} />
              ))}
              <span>dan lainnya</span>
            </p>
          </div>
        </>
      ) : (
        <p className="mt-4 text-[14px] text-text-body">Informasi pembayaran belum tersedia. Hubungi tim Sissi.</p>
      )}
    </section>
  );
}

function MethodLogoImg({ src }: { src: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- logo lokal di public, tanpa optimasi next/image.
    <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="h-4 max-w-[46px] object-contain" />
  );
}

/** Pemakaian: satu kartu samping berisi paket, transaksi, outlet, dan catatannya. */
function UsageCard({ s }: { s: SubscriptionDetail }) {
  const st = STATUS[s.status] ?? STATUS.free;
  const limit = s.limits.tx_per_month;
  const used = s.usage.tx_this_month;
  const ratio = limit ? used / limit : 0;
  const tone = limit ? (ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "brand") : "brand";
  const month = new Intl.DateTimeFormat("id-ID", { month: "long", timeZone: "UTC" }).format(new Date(`${s.usage.month}-01T00:00:00Z`));
  const row = "flex items-center justify-between gap-3 text-[13.5px]";
  const value = "text-right font-semibold tabular-nums text-text-heading";
  return (
    <Section title="Pemakaian">
      <div className="flex flex-col gap-3.5">
        <div className={row}>
          <span className="text-text-body">Paket</span>
          <Badge tone={st.tone}>{st.text}</Badge>
        </div>
        <div>
          <div className={row}>
            <span className="text-text-body">Transaksi {month}</span>
            <span className={value}>
              {used.toLocaleString("id-ID")} / {limit === null ? "tanpa batas" : limit.toLocaleString("id-ID")}
            </span>
          </div>
          {limit !== null && (
            <>
              <div className="mt-1.5">
                <Meter value={Math.min(used, limit)} max={limit} tone={tone} />
              </div>
              <p className={`mt-1.5 text-[12.5px] ${ratio >= 1 ? "font-semibold text-danger" : ratio >= 0.8 ? "text-warning" : "text-text-muted"}`}>
                {ratio >= 1
                  ? "Batas bulan ini tercapai — transaksi baru diblokir di aplikasi sampai bulan depan atau upgrade ke Pro."
                  : `Sisa ${(limit - used).toLocaleString("id-ID")} transaksi bulan ini.`}
              </p>
            </>
          )}
        </div>
        <div>
          <div className={row}>
            <span className="text-text-body">Outlet</span>
            <span className={value}>
              {s.usage.outlets.toLocaleString("id-ID")} / {s.limits.outlets.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="mt-1.5">
            <Meter value={Math.min(s.usage.outlets, s.limits.outlets)} max={s.limits.outlets} tone={s.usage.outlets_over ? "danger" : "neutral"} />
          </div>
          <p className={`mt-1.5 text-[12.5px] ${s.usage.outlets_over ? "text-danger" : "text-text-muted"}`}>
            {s.usage.outlets_over ? "Outlet aktif melebihi kuota — hanya outlet tertua yang bisa bertransaksi." : "Butuh outlet tambahan? Hubungi tim Sissi."}
          </p>
        </div>
        {!s.enforced && (
          <p className="flex items-start gap-1.5 border-t border-border-subtle pt-3 text-[12.5px] text-text-muted">
            <Info size={14} aria-hidden className="mt-0.5 shrink-0" /> Batas paket belum diberlakukan — semua fitur masih terbuka.
          </p>
        )}
      </div>
    </Section>
  );
}

const FEATURE_ICON: Record<string, LucideIcon> = {
  "Kasbon dengan pengingat": HandCoins,
  "Meja, pesanan berjalan & layar dapur": UtensilsCrossed,
  "Pesan & Bayar Mandiri lewat QR": QrCode,
  "Antrean servis, jadwal & sesi sewa": CalendarClock,
  "Absensi, jadwal shift & gaji": UserCheck,
  "Jam ramai & produk terlaris": BarChart3,
  "Bantuan prioritas": Headset,
};

// Tiga fitur yang ditampilkan lebih dulu bagi pemilik yang sudah Pro.
const FEATURED = ["Meja, pesanan berjalan & layar dapur", "Absensi, jadwal shift & gaji", "Jam ramai & produk terlaris"];

function FeatureItem({ name, pro }: { name: string; pro: boolean }) {
  const Icon = FEATURE_ICON[name] ?? Sparkles;
  return (
    <li className="flex items-center gap-2.5 text-[13.5px]">
      <span aria-hidden className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] ${pro ? "bg-brand-tint text-brand-deep" : "bg-bg-muted text-text-muted"}`}>
        <Icon size={15} />
      </span>
      <span className={`min-w-0 flex-1 leading-snug ${pro ? "text-text-heading" : "text-text-body"}`}>
        {name}
        <span className="sr-only">{pro ? " (aktif)" : " (tidak aktif)"}</span>
      </span>
      {!pro && <Lock size={14} aria-hidden className="shrink-0 text-text-muted" />}
    </li>
  );
}

/** Sudah Pro: ringkas, sisanya dilipat. Gratis: semua fitur Pro tampil karena itulah alasan upgrade. */
function FeaturesCard({ pro }: { pro: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const all = PRICING_FEATURES.filter((f) => f.proValue === true);
  const proOnly = all.filter((f) => f.freeValue !== true).map((f) => f.name);
  const basic = all.filter((f) => f.freeValue === true).map((f) => f.name);
  const shown = pro ? proOnly.filter((n) => FEATURED.includes(n)) : proOnly;
  const hiddenPro = pro ? proOnly.filter((n) => !FEATURED.includes(n)) : [];
  return (
    <Section title={pro ? "Fitur Pro aktif" : "Yang Anda dapat dengan Pro"}>
      <ul className="flex flex-col gap-2.5">
        {shown.map((n) => (
          <FeatureItem key={n} name={n} pro={pro} />
        ))}
      </ul>
      {open && (
        <div id={id}>
          {hiddenPro.length > 0 && (
            <ul className="mt-2.5 flex flex-col gap-2.5">
              {hiddenPro.map((n) => (
                <FeatureItem key={n} name={n} pro={pro} />
              ))}
            </ul>
          )}
          <h3 className="mt-4 text-[12.5px] font-semibold text-text-heading">Termasuk di semua paket</h3>
          <ul className="mt-2 flex flex-col gap-1.5">
            {basic.map((n) => (
              <li key={n} className="flex items-start gap-2 text-[13px] text-text-body">
                <Check size={14} strokeWidth={3} aria-hidden className="mt-[3px] shrink-0 text-success" />
                <span>
                  {n}
                  <span className="sr-only"> (aktif)</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="mt-3 inline-flex items-center gap-1 rounded-[6px] text-[13px] font-semibold text-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
      >
        {open ? "Sembunyikan" : pro ? `Lihat semua ${all.length} fitur` : "Lihat fitur semua paket"}
        <ChevronDown size={15} aria-hidden className={open ? "rotate-180" : ""} />
      </button>
    </Section>
  );
}

function PaymentAmount({ p }: { p: SubscriptionPaymentRow }) {
  return (
    <>
      {formatRupiah(p.amount)}
      {(p.service_fee ?? 0) > 0 && <span className="block text-[12px] font-normal text-text-muted">+ biaya {formatRupiah(p.service_fee)}</span>}
    </>
  );
}

/** Riwayat: tabel di layar lebar, kartu di HP supaya tidak perlu geser ke samping. */
function HistorySection({ payments }: { payments: SubscriptionPaymentRow[] }) {
  const tone = (p: SubscriptionPaymentRow) => (p.status === "recorded" ? "success" : "neutral");
  return (
    <Section title="Riwayat pembayaran" description="Pembayaran Pro yang sudah diterima." bodyClass="">
      {payments.length === 0 ? (
        <div className="flex items-center gap-3 p-4 sm:p-5">
          <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-muted text-text-muted">
            <Receipt size={18} />
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-text-heading">Belum ada pembayaran</p>
            <p className="text-[13px] text-text-muted">Pembayaran Pro yang sudah diterima akan muncul di sini.</p>
          </div>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border-subtle sm:hidden">
            {payments.map((p) => (
              <li key={p.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-text-heading">Pro {labelOf(BILLING_CYCLES, p.cycle)}</p>
                    <p className="text-[12.5px] text-text-muted">
                      {formatDate(p.paid_at)} · {methodLabel(p.method)}
                    </p>
                  </div>
                  <p className="whitespace-nowrap text-right text-[14px] font-semibold tabular-nums text-text-heading">
                    <PaymentAmount p={p} />
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <p className="text-[12.5px] tabular-nums text-text-body">
                    {formatDate(p.period_start)} – {formatDate(p.period_end)}
                  </p>
                  <Badge tone={tone(p)}>{labelOf(PAYMENT_STATUS, p.status)}</Badge>
                </div>
              </li>
            ))}
          </ul>
          <table className="hidden w-full border-separate border-spacing-0 text-[14px] sm:table">
            <thead>
              <tr>
                <th scope="col" className={thClass}>Tanggal bayar</th>
                <th scope="col" className={thClass}>Paket</th>
                <th scope="col" className={thClass}>Masa aktif</th>
                <th scope="col" className={`${thClass} text-right`}>Jumlah</th>
                <th scope="col" className={thClass}>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className={`${tdClass} border-b border-border-subtle tabular-nums`}>{formatDate(p.paid_at)}</td>
                  <td className={`${tdClass} border-b border-border-subtle text-text-body`}>
                    <span className="block font-medium text-text-heading">{labelOf(BILLING_CYCLES, p.cycle)}</span>
                    <span className="block text-[12.5px] text-text-muted">{methodLabel(p.method)}</span>
                  </td>
                  <td className={`${tdClass} border-b border-border-subtle tabular-nums text-text-body`}>
                    {formatDate(p.period_start)} – {formatDate(p.period_end)}
                  </td>
                  <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums`}>
                    <PaymentAmount p={p} />
                  </td>
                  <td className={`${tdClass} border-b border-border-subtle`}>
                    <Badge tone={tone(p)}>{labelOf(PAYMENT_STATUS, p.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Section>
  );
}
