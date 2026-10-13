"use client";

import React, { useState } from "react";
import { Check, CreditCard, Info, MessageCircle, Minus, Receipt } from "lucide-react";
import { Meter } from "@/components/admin/charts";
import { BILLING_CYCLES, PAYMENT_METHODS } from "@/components/admin/labels";
import {
  Badge,
  btn,
  CopyButton,
  EmptyState,
  ErrorBlock,
  formatDate,
  formatRupiah,
  LoadingBar,
  Notice,
  PageHeader,
  Section,
  SkeletonList,
  tdClass,
  thClass,
  useLoad,
} from "@/components/admin/ui";
import { PRICING_FEATURES } from "@/constants/pricing";
import { ownerApi } from "@/lib/owner/api";
import type { SubscriptionDetail } from "@/lib/owner/types";
import { labelOf } from "./labels";
import { useOwner } from "./OwnerShell";
import { Segmented } from "./editing";

// Langganan (GET /owner/subscription): status paket, pemakaian, fitur Pro, harga, cara bayar manual
// (transfer + WhatsApp, dicatat admin), dan riwayat pembayaran. Tidak ada checkout di web.

const STATUS: Record<SubscriptionDetail["status"], { text: string; tone: "brand" | "warning" | "neutral" | "success" }> = {
  active: { text: "Pro aktif", tone: "success" },
  trial: { text: "Uji coba Pro", tone: "brand" },
  grace: { text: "Masa tenggang", tone: "warning" },
  free: { text: "Gratis", tone: "neutral" },
};

const PAYMENT_STATUS: Record<string, string> = { recorded: "Tercatat", void: "Dibatalkan" };

function statusLine(s: SubscriptionDetail): string {
  const until = s.ends_at ? formatDate(s.ends_at) : null;
  const left = s.days_left !== null ? `${s.days_left.toLocaleString("id-ID")} hari lagi` : null;
  switch (s.status) {
    case "active":
      return `Pro dibayar sampai ${until ?? "—"}${left ? ` (${left})` : ""}.`;
    case "trial":
      return `Uji coba Pro gratis berakhir ${until ?? "—"}${left ? ` (${left})` : ""}. Bayar sebelum berakhir agar fitur Pro tetap aktif.`;
    case "grace":
      return `Masa Pro sudah habis. Fitur Pro masih terbuka sampai ${until ?? "—"}${left ? ` (${left})` : ""} — setelah itu usaha kembali ke paket Gratis.`;
    default:
      return "Paket Gratis: 50 transaksi per bulan dan fitur dasar. Data tidak pernah dihapus saat turun paket.";
  }
}

function waLink(number: string, text: string): string | null {
  const digits = number.replace(/\D/g, "");
  if (digits.length < 8) return null;
  const intl = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

export function SubscriptionView() {
  const { session } = useOwner();
  const { state, reload } = useLoad<SubscriptionDetail>(async (signal) => (await ownerApi()).subscription(signal), []);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const s = state.data;

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
            <StatusCard s={s} />

            <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
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

              {s.billing ? (
                <PaySection s={s} cycle={cycle} setCycle={setCycle} businessName={session.business.name} email={session.user.email} />
              ) : (
                <Section title="Cara bayar">
                  <p className="text-[14px] text-text-body">Informasi pembayaran belum tersedia. Hubungi tim Sissi.</p>
                </Section>
              )}
            </div>

            <Section title="Riwayat pembayaran" description="Pembayaran dicatat tim Sissi setelah transfer dikonfirmasi." bodyClass="">
              {!s.billing || s.billing.payments.length === 0 ? (
                <EmptyState icon={<Receipt size={22} aria-hidden />} title="Belum ada pembayaran">
                  Pembayaran Pro yang sudah dikonfirmasi akan muncul di sini.
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
                          <td className={`${tdClass} border-b border-border-subtle text-right font-semibold tabular-nums`}>{formatRupiah(p.amount)}</td>
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
    </>
  );
}

function StatusCard({ s }: { s: SubscriptionDetail }) {
  const st = STATUS[s.status] ?? STATUS.free;
  const limit = s.limits.tx_per_month;
  const used = s.usage.tx_this_month;
  const ratio = limit ? used / limit : 0;
  const tone = limit ? (ratio >= 1 ? "danger" : ratio >= 0.8 ? "warning" : "brand") : "brand";
  const month = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${s.usage.month}-01T00:00:00Z`));
  return (
    <Section>
      <div className="grid gap-5 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <p className="text-[13px] text-text-muted">Paket saat ini</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-[22px] font-bold tracking-tight text-text-heading">{s.plan === "pro" ? "Pro" : "Gratis"}</span>
            <Badge tone={st.tone}>{st.text}</Badge>
            {s.billing_cycle && s.status === "active" && <Badge>{labelOf(BILLING_CYCLES, s.billing_cycle)}</Badge>}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-body">{statusLine(s)}</p>
          {!s.enforced && (
            <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-text-muted">
              <Info size={14} aria-hidden className="mt-0.5 shrink-0" /> Batas paket belum diberlakukan — semua fitur masih terbuka.
            </p>
          )}
        </div>
        <div>
          <p className="text-[13px] text-text-muted">Transaksi {month}</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums text-text-heading">
            {used.toLocaleString("id-ID")}
            <span className="text-[14px] font-medium text-text-muted"> / {limit === null ? "tanpa batas" : limit.toLocaleString("id-ID")}</span>
          </p>
          {limit !== null && (
            <div className="mt-2">
              <Meter value={Math.min(used, limit)} max={limit} tone={tone} />
              <p className={`mt-1.5 text-[12.5px] ${ratio >= 1 ? "font-semibold text-danger" : ratio >= 0.8 ? "text-warning" : "text-text-muted"}`}>
                {ratio >= 1
                  ? "Batas bulan ini tercapai — transaksi baru diblokir di aplikasi sampai bulan depan atau upgrade ke Pro."
                  : `Sisa ${(limit - used).toLocaleString("id-ID")} transaksi bulan ini.`}
              </p>
            </div>
          )}
        </div>
        <div>
          <p className="text-[13px] text-text-muted">Outlet</p>
          <p className="mt-1 text-[22px] font-bold tabular-nums text-text-heading">
            {s.usage.outlets.toLocaleString("id-ID")}
            <span className="text-[14px] font-medium text-text-muted"> / {s.limits.outlets.toLocaleString("id-ID")} kuota</span>
          </p>
          <div className="mt-2">
            <Meter value={Math.min(s.usage.outlets, s.limits.outlets)} max={s.limits.outlets} tone={s.usage.outlets_over ? "danger" : "neutral"} />
          </div>
          <p className={`mt-1.5 text-[12.5px] ${s.usage.outlets_over ? "text-danger" : "text-text-muted"}`}>
            {s.usage.outlets_over ? "Outlet aktif melebihi kuota — hanya outlet tertua yang bisa bertransaksi." : "Butuh outlet tambahan? Hubungi tim Sissi."}
          </p>
        </div>
      </div>
    </Section>
  );
}

function PaySection({
  s,
  cycle,
  setCycle,
  businessName,
  email,
}: {
  s: SubscriptionDetail;
  cycle: "monthly" | "yearly";
  setCycle: (c: "monthly" | "yearly") => void;
  businessName: string;
  email: string;
}) {
  const billing = s.billing!;
  const { prices, payment_info: info } = billing;
  const price = cycle === "monthly" ? prices.monthly : prices.yearly;
  const saving = prices.monthly * 12 - prices.yearly;
  const action = s.status === "active" ? "memperpanjang" : "berlangganan";
  const message = `Halo Sissi, saya ingin ${action} paket Pro ${cycle === "monthly" ? "Bulanan" : "Tahunan"} (${formatRupiah(price)}) untuk usaha "${businessName}" (akun ${email}). Berikut bukti transfernya.`;
  const wa = info.whatsapp ? waLink(info.whatsapp, message) : null;

  return (
    <Section title="Cara bayar" description="Pembayaran manual: transfer, lalu kirim bukti lewat WhatsApp. Pro aktif setelah dikonfirmasi tim Sissi.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Siklus pembayaran"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly", label: "Bulanan" },
              { value: "yearly", label: "Tahunan" },
            ]}
          />
          <p className="text-right">
            <span className="text-[22px] font-bold tabular-nums text-text-heading">{formatRupiah(price)}</span>
            <span className="text-[13px] text-text-muted">{cycle === "monthly" ? "/bulan" : "/tahun"}</span>
            {cycle === "yearly" && saving > 0 && <span className="block text-[12.5px] text-success">Hemat {formatRupiah(saving)} per tahun</span>}
          </p>
        </div>
        <p className="-mt-2 text-[12.5px] text-text-muted">Harga belum termasuk PPN, per usaha (1 outlet termasuk).</p>

        {info.bank_accounts.length > 0 && (
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Transfer ke</p>
            <ul className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle">
              {info.bank_accounts.map((a) => (
                <li key={`${a.bank}-${a.number}`} className="flex items-center gap-3 px-3 py-2">
                  <CreditCard size={18} aria-hidden className="shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold">
                      {a.bank} · <span className="tabular-nums">{a.number}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-text-muted">a.n. {a.holder}</span>
                  </span>
                  <CopyButton value={a.number.replace(/[\s-]/g, "")} label={`Salin nomor rekening ${a.bank}`} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {info.instructions && <Notice tone="info">{<p className="whitespace-pre-line">{info.instructions}</p>}</Notice>}

        {wa ? (
          <a href={wa} target="_blank" rel="noopener noreferrer" className={`${btn.primary} self-start`}>
            <MessageCircle size={17} aria-hidden /> Konfirmasi lewat WhatsApp
          </a>
        ) : (
          <p className="text-[13px] text-text-muted">Nomor WhatsApp admin belum diatur.</p>
        )}
      </div>
    </Section>
  );
}
