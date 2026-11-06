"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, Info, Minus, Receipt } from "lucide-react";
import { Meter } from "@/components/admin/charts";
import { BILLING_CYCLES, PAYMENT_METHODS } from "@/components/admin/labels";
import {
  Badge,
  btn,
  EmptyState,
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
import type { PayCycle, PayMethod, SubscriptionDetail } from "@/lib/owner/types";
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

const PAYMENT_STATUS: Record<string, string> = { recorded: "Tercatat", void: "Dibatalkan" };

const LOGO_CODES = ["BC", "M2", "OV", "DA", "IR", "I1"];

/** Logo metode dari daftar metode (tanpa QRIS, yang memakai ikon generik). Gagal/fitur mati → kosong. */
function useMethodLogos(): string[] {
  const [logos, setLogos] = useState<string[]>([]);
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const l = await (await ownerApi()).paymentMethods("yearly", ctrl.signal);
        if (ctrl.signal.aborted) return;
        const by = (m: PayMethod) => (LOGO_CODES.indexOf(m.code) + 1 || 99);
        const imgs = l.methods
          .filter((m) => m.kind !== "qris" && m.image)
          .sort((x, y) => by(x) - by(y))
          .map((m) => m.image);
        setLogos([...new Set(imgs)].slice(0, 4));
      } catch {
        // Logo hanya hiasan: galat/fitur mati tidak menampilkan apa pun.
      }
    })();
    return () => ctrl.abort();
  }, []);
  return logos;
}

export function SubscriptionView() {
  const router = useRouter();
  const pathname = usePathname();
  const { state, reload } = useLoad<SubscriptionDetail>(async (signal) => (await ownerApi()).subscription(signal), []);
  const [picked, setPicked] = useState<PayCycle | null>(null);
  const logos = useMethodLogos();
  const [payOpen, setPayOpen] = useState(false);
  const [returnId, setReturnId] = useState<string | undefined>();
  const s = state.data;
  // Bawaan Tahunan; pelanggan aktif yang sedang bulanan diarahkan ke Bulanan.
  const cycle: PayCycle = picked ?? (s?.status === "active" && s.billing_cycle === "monthly" ? "monthly" : "yearly");

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
      <PageHeader title="Langganan" description="Paket usaha Anda, pemakaian bulan ini, dan cara membayar Pro." />

      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {!s && state.status === "loading" && <SkeletonList rows={4} label="Memuat langganan" />}
      {s && (
        <>
          <LoadingBar active={state.status === "loading"} />
          <div className="flex flex-col gap-5">
            <PayCard s={s} cycle={cycle} setCycle={setPicked} logos={logos} onPay={() => setPayOpen(true)} />
            <UsageRow s={s} />

            <Section title="Fitur Pro" description={s.plan === "pro" ? "Semua fitur ini aktif untuk usaha Anda." : "Buka semua fitur ini dengan Pro."}>
              <ul className="flex flex-col gap-2">
                {PRICING_FEATURES.filter((f) => f.proValue === true).map((f) => {
                  const on = s.plan === "pro" || f.freeValue === true;
                  return (
                    <li key={f.name} className="flex items-start gap-2.5 text-[14px]">
                      <span
                        className={`mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${on ? "bg-success-tint text-success" : "bg-bg-muted text-text-muted"}`}
                        aria-hidden
                      >
                        {on ? <Check size={13} strokeWidth={3} /> : <Minus size={13} strokeWidth={3} />}
                      </span>
                      <span className={on ? "text-text-heading" : "text-text-body"}>
                        {f.name}
                        <span className="sr-only">{on ? " (aktif)" : " (tidak aktif)"}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Section>

            <Section title="Riwayat pembayaran" description="Pembayaran Pro yang sudah diterima." bodyClass="">
              {!s.billing || s.billing.payments.length === 0 ? (
                <EmptyState icon={<Receipt size={22} aria-hidden />} title="Belum ada pembayaran">
                  Pembayaran Pro yang sudah diterima akan muncul di sini.
                </EmptyState>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[14px]">
                    <thead>
                      <tr>
                        <th scope="col" className={thClass}>
                          Tanggal bayar
                        </th>
                        <th scope="col" className={thClass}>
                          Periode
                        </th>
                        <th scope="col" className={thClass}>
                          Siklus · metode
                        </th>
                        <th scope="col" className={`${thClass} text-right`}>
                          Jumlah
                        </th>
                        <th scope="col" className={thClass}>
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.billing.payments.map((p) => (
                        <tr key={p.id}>
                          <td className={`${tdClass} border-b border-border-subtle tabular-nums`}>{formatDate(p.paid_at)}</td>
                          <td className={`${tdClass} border-b border-border-subtle tabular-nums text-text-body`}>
                            {formatDate(p.period_start)} – {formatDate(p.period_end)}
                          </td>
                          <td className={`${tdClass} border-b border-border-subtle text-text-body`}>
                            {labelOf(BILLING_CYCLES, p.cycle)} · {labelOf(PAYMENT_METHODS, p.method)}
                          </td>
                          <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums`}>{formatRupiah(p.amount)}
                            {(p.service_fee ?? 0) > 0 && <span className="block text-[12px] font-normal text-text-muted">+ biaya {formatRupiah(p.service_fee)}</span>}
                          </td>
                          <td className={`${tdClass} border-b border-border-subtle`}>
                            <Badge tone={p.status === "recorded" ? "success" : "neutral"}>{labelOf(PAYMENT_STATUS, p.status)}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
          </div>
        </>
      )}
      <PayDialog cycle={cycle} open={payOpen} onClose={closePay} onPaid={reload} initialCheckoutId={returnId} />
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
      {tag && <span className="mt-1.5 inline-block self-start rounded-full bg-success-tint px-2 py-0.5 text-[11.5px] font-semibold text-success">{tag}</span>}
    </label>
  );
}

function PayCard({ s, cycle, setCycle, logos, onPay }: { s: SubscriptionDetail; cycle: PayCycle; setCycle: (c: PayCycle) => void; logos: string[]; onPay: () => void }) {
  const h = headlineFor(s);
  const border = h.tone === "warning" ? "border-warning" : "border-border-subtle";
  const bg = h.tone === "warning" ? "bg-warning-tint" : "bg-white";
  const prices = s.billing?.prices;
  const price = prices ? (cycle === "monthly" ? prices.monthly : prices.yearly) : 0;
  const saving = prices ? prices.monthly * 12 - prices.yearly : 0;
  const twoFree = prices !== undefined && saving > 0 && saving === 2 * prices.monthly;
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
            <div className="grid gap-3 sm:grid-cols-2">
              <PlanCard value="monthly" current={cycle} onChange={setCycle} name="Bulanan" price={prices.monthly} unit="/bulan" note="Fleksibel, bayar tiap bulan" />
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
            {logos.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                {logos.map((u) => (
                  <MethodLogoImg key={u} src={u} />
                ))}
                <span>dan lainnya</span>
              </p>
            )}
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
    // eslint-disable-next-line @next/next/no-img-element -- logo dari images.duitku.com (host disaring server), tanpa optimasi next/image.
    <img src={src} alt="" referrerPolicy="no-referrer" loading="lazy" onError={() => setBroken(true)} className="h-[14px] max-w-[44px] object-contain" />
  );
}

function UsageRow({ s }: { s: SubscriptionDetail }) {
  const st = STATUS[s.status] ?? STATUS.free;
  const limit = s.limits.tx_per_month;
  const used = s.usage.tx_this_month;
  const ratio = limit ? used / limit : 0;
  const tone = limit ? (ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "brand") : "brand";
  const month = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s.usage.month}-01T00:00:00Z`));
  const mini = "rounded-[12px] border border-border-subtle bg-white px-3 py-2.5";
  return (
    <div>
      <div className="grid gap-2.5 sm:grid-cols-3">
        <div className={mini}>
          <p className="text-[12.5px] text-text-muted">Paket saat ini</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[15px] font-bold text-text-heading">{s.plan === "pro" ? "Pro" : "Gratis"}</span>
            <Badge tone={st.tone}>{st.text}</Badge>
            {s.billing_cycle && s.status === "active" && <Badge>{labelOf(BILLING_CYCLES, s.billing_cycle)}</Badge>}
          </p>
        </div>
        <div className={mini}>
          <p className="text-[12.5px] text-text-muted">Transaksi {month}</p>
          <p className="mt-0.5 text-[15px] font-bold tabular-nums text-text-heading">
            {used.toLocaleString("id-ID")}
            <span className="text-[13px] font-medium text-text-muted"> / {limit === null ? "tanpa batas" : limit.toLocaleString("id-ID")}</span>
          </p>
          {limit !== null && (
            <div className="mt-1.5">
              <Meter value={Math.min(used, limit)} max={limit} tone={tone} />
            </div>
          )}
        </div>
        <div className={mini}>
          <p className="text-[12.5px] text-text-muted">Outlet</p>
          <p className="mt-0.5 text-[15px] font-bold tabular-nums text-text-heading">
            {s.usage.outlets.toLocaleString("id-ID")}
            <span className="text-[13px] font-medium text-text-muted"> / {s.limits.outlets.toLocaleString("id-ID")} kuota</span>
          </p>
          <div className="mt-1.5">
            <Meter value={Math.min(s.usage.outlets, s.limits.outlets)} max={s.limits.outlets} tone={s.usage.outlets_over ? "danger" : "neutral"} />
          </div>
        </div>
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[12.5px]">
        {limit !== null && (
          <p className={ratio >= 1 ? "font-semibold text-danger" : ratio >= 0.8 ? "text-warning" : "text-text-muted"}>
            {ratio >= 1
              ? "Batas bulan ini tercapai — transaksi baru diblokir di aplikasi sampai bulan depan atau upgrade ke Pro."
              : `Sisa ${(limit - used).toLocaleString("id-ID")} transaksi bulan ini.`}
          </p>
        )}
        <p className={s.usage.outlets_over ? "text-danger" : "text-text-muted"}>
          {s.usage.outlets_over ? "Outlet aktif melebihi kuota — hanya outlet tertua yang bisa bertransaksi." : "Butuh outlet tambahan? Hubungi tim Sissi."}
        </p>
        {!s.enforced && (
          <p className="flex items-start gap-1.5 text-text-muted">
            <Info size={14} aria-hidden className="mt-0.5 shrink-0" /> Batas paket belum diberlakukan — semua fitur masih terbuka.
          </p>
        )}
      </div>
    </div>
  );
}
