"use client";

import React, { useId, useState } from "react";
import { ArrowRight, CalendarPlus, CircleSlash, Receipt, ReceiptText, SlidersHorizontal } from "lucide-react";
import { adminApi } from "@/lib/admin/api";
import type {
  AdminPayment,
  AdminSubscription,
  BillingConfig,
  ExtendInput,
  PaymentCycle,
  RecordPaymentInput,
  SubscriptionDetail,
} from "@/lib/admin/types";
import { ApiError } from "@/lib/sissiApi";
import { ConfirmDialog, Modal } from "./ConfirmDialog";
import { jakartaDate } from "./filters";
import { AUDIT_ACTIONS, BILLING_CYCLES, labelOf, PAYMENT_METHODS } from "./labels";
import { DaysLeft, StatusBadge, UsageMeter } from "./subscriptionUi";
import { useToast } from "./toast";
import {
  Badge,
  btn,
  cardClass,
  EmptyState,
  ErrorBlock,
  errorMessage,
  Field,
  fieldErrors,
  focusRing,
  formatDate,
  formatDateTime,
  formatRupiah,
  inputClass,
  Notice,
  Section,
  Skeleton,
  Spinner,
  TimeAgo,
  useLoad,
} from "./ui";

// Tab "Langganan" di detail bisnis (tahap 3): status & periode, pemakaian, riwayat pembayaran, dan aksi admin
// (catat pembayaran, batalkan pembayaran terakhir, tambah hari, batas khusus). Setiap aksi dikonfirmasi & diaudit.

const DAY = 86_400_000;
const FALLBACK_PRICES = { monthly: 59_000, yearly: 590_000 };

type Data = { detail: SubscriptionDetail; config: BillingConfig | null };

function addMonths(ms: number, n: number) {
  const d = new Date(ms);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.getTime();
}
const dayStartWib = (d: string) => Date.parse(`${d}T00:00:00+07:00`);
const isoOf = (ms: number) => new Date(ms).toISOString();
const digits = (v: string) => v.replace(/\D/g, "");
const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16)
      );

export function SubscriptionTab({ businessId, businessName }: { businessId: string; businessName: string }) {
  const { state, reload, setData } = useLoad<Data>(async (signal) => {
    const api = await adminApi();
    const [detail, config] = await Promise.all([
      api.subscription(businessId, signal),
      api.billingConfig(signal).catch(() => null), // harga bawaan; jangan gagalkan tab
    ]);
    return { detail, config };
  }, [businessId]);
  const [dialog, setDialog] = useState<null | "pay" | "extend" | "override" | { void: AdminPayment }>(null);

  if (!state.data) {
    return state.status === "error" ? <ErrorBlock error={state.error} onRetry={reload} /> : <TabSkeleton />;
  }
  const { detail, config } = state.data;
  const s = detail.subscription;
  const prices = config ? { monthly: config.price_monthly, yearly: config.price_yearly } : FALLBACK_PRICES;
  const latestRecorded = [...detail.payments]
    .filter((p) => p.status === "recorded")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const onSubscription = (sub: AdminSubscription, payment?: AdminPayment) => {
    const payments = payment ? [payment, ...detail.payments.filter((p) => p.id !== payment.id)] : detail.payments;
    payments.sort((a, b) => b.paid_at.localeCompare(a.paid_at));
    setData({ ...state.data!, detail: { ...detail, subscription: sub, payments } });
    reload(); // audit & angka turunan dari server
  };

  return (
    <div className="flex flex-col gap-5">
      <StatusCard s={s} onPay={() => setDialog("pay")} onExtend={() => setDialog("extend")} onOverride={() => setDialog("override")} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Pemakaian bulan ini" description={monthLabel(s.usage.month)}>
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Transaksi</p>
              <UsageMeter s={s} wide />
              {s.limits.tx_per_month !== null && (
                <p className="mt-1.5 text-[12.5px] text-text-muted">
                  Batas Gratis {s.overrides.tx_limit !== null ? "khusus" : "bawaan"} {s.limits.tx_per_month.toLocaleString("id-ID")} per bulan
                  kalender. Server tidak pernah menolak sinkron — aplikasi yang menahan transaksi baru.
                </p>
              )}
            </div>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Outlet aktif</p>
              <p className="text-[14px] text-text-body">
                <strong className={`tabular-nums ${s.usage.outlets > s.limits.outlets ? "text-danger" : "text-text-heading"}`}>{s.usage.outlets}</strong>{" "}
                dari kuota {s.limits.outlets}
                {s.overrides.outlet_quota !== null && <span className="text-text-muted"> (khusus)</span>}
                {s.usage.outlets > s.limits.outlets && <span className="ml-1.5"><Badge tone="danger">melebihi kuota</Badge></span>}
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="Batas khusus"
          actions={
            <button type="button" className={`${btn.ghost} min-h-8 px-2.5 text-[13px]`} onClick={() => setDialog("override")}>
              <SlidersHorizontal size={15} aria-hidden /> Ubah
            </button>
          }
        >
          <dl className="flex flex-col divide-y divide-border-subtle text-[14px]">
            <Row label="Kuota outlet">{s.overrides.outlet_quota ?? <span className="text-text-muted">Bawaan (1)</span>}</Row>
            <Row label="Batas transaksi Gratis">
              {s.overrides.tx_limit !== null ? s.overrides.tx_limit.toLocaleString("id-ID") : <span className="text-text-muted">Bawaan (50)</span>}
            </Row>
            <Row label="Catatan">
              <span className={s.overrides.note ? "text-left" : "text-text-muted"}>{s.overrides.note || "—"}</span>
            </Row>
          </dl>
        </Section>
      </div>

      <PaymentsSection
        payments={detail.payments}
        latestId={latestRecorded?.id ?? null}
        onPay={() => setDialog("pay")}
        onVoid={(p) => setDialog({ void: p })}
      />

      <Section title="Riwayat tindakan" description="20 tindakan langganan terbaru oleh admin." bodyClass="">
        {detail.audit.length === 0 ? (
          <p className="px-5 py-5 text-[14px] text-text-muted">Belum ada tindakan admin untuk langganan ini.</p>
        ) : (
          <ol className="divide-y divide-border-subtle">
            {detail.audit.map((e) => (
              <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2.5 text-[14px] sm:px-5">
                <span className="font-semibold text-text-heading">{labelOf(AUDIT_ACTIONS, e.action)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-text-body">{auditText(e.detail)}</span>
                <span className="text-[13px] text-text-muted">
                  {e.admin?.name ?? "sistem"} · <TimeAgo value={e.created_at} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <RecordPaymentDialog
        open={dialog === "pay"}
        s={s}
        businessId={businessId}
        businessName={businessName}
        prices={prices}
        onClose={() => setDialog(null)}
        onDone={(r) => {
          setDialog(null);
          onSubscription(r.subscription, r.payment);
        }}
      />
      <ExtendDialog
        open={dialog === "extend"}
        s={s}
        businessId={businessId}
        businessName={businessName}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          reload();
        }}
      />
      <OverridesDialog
        open={dialog === "override"}
        s={s}
        businessId={businessId}
        onClose={() => setDialog(null)}
        onDone={() => {
          setDialog(null);
          reload();
        }}
      />
      <VoidDialog
        payment={dialog && typeof dialog === "object" ? dialog.void : null}
        businessId={businessId}
        onClose={() => setDialog(null)}
        onDone={(r) => {
          setDialog(null);
          onSubscription(r.subscription, r.payment);
        }}
      />
    </div>
  );
}

function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return month;
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(Date.UTC(y, m - 1, 1));
}

function auditText(d: Record<string, unknown> | null): string {
  if (!d) return "";
  const parts: string[] = [];
  if (typeof d.amount === "number") parts.push(formatRupiah(d.amount));
  if (typeof d.cycle === "string") parts.push(labelOf(BILLING_CYCLES, d.cycle).toLowerCase());
  if (typeof d.days === "number") parts.push(`+${d.days} hari`);
  if (d.target === "trial") parts.push("uji coba");
  if (d.target === "period") parts.push("periode Pro");
  if (typeof d.reason === "string" && d.reason) parts.push(`“${d.reason}”`);
  if (typeof d.note === "string" && d.note) parts.push(`“${d.note}”`);
  return parts.join(" · ");
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <dt className="shrink-0 text-text-muted">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-text-heading">{children}</dd>
    </div>
  );
}

function TabSkeleton() {
  return (
    <div role="status" aria-label="Memuat langganan" className="flex flex-col gap-5">
      <div className={`${cardClass} p-5`}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-8 w-64" />
        <Skeleton className="mt-4 h-10 w-full max-w-[420px]" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className={`${cardClass} p-5`}>
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-4 h-3 w-full" />
            <Skeleton className="mt-3 h-3 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ——— Kartu status ———

function headline(s: AdminSubscription): { title: string; sub: string } {
  const end = formatDate(s.ends_at);
  switch (s.status) {
    case "active":
      return { title: `Pro aktif sampai ${end}`, sub: `Siklus ${labelOf(BILLING_CYCLES, s.billing_cycle ?? "").toLowerCase()}` };
    case "trial":
      return { title: `Uji coba Pro sampai ${end}`, sub: s.first_paid_at ? "Pernah membayar sebelumnya" : "Belum pernah membayar" };
    case "grace":
      return { title: `Masa tenggang sampai ${end}`, sub: "Fitur Pro masih jalan. Setelah itu kembali ke Gratis — data tetap aman." };
    default:
      return { title: "Paket Gratis", sub: "50 transaksi per bulan, fitur dasar." };
  }
}

function StatusCard({
  s,
  onPay,
  onExtend,
  onOverride,
}: {
  s: AdminSubscription;
  onPay: () => void;
  onExtend: () => void;
  onOverride: () => void;
}) {
  const h = headline(s);
  return (
    <section className={`${cardClass} overflow-hidden`} aria-label="Status langganan">
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={s.status} />
            {s.status !== "free" && <DaysLeft s={s} compact />}
          </div>
          <h2 className="mt-2 text-[20px] font-bold leading-snug text-text-heading">{h.title}</h2>
          <p className="mt-0.5 text-[14px] text-text-body">{h.sub}</p>
        </div>
        <div className="flex flex-col gap-2 sm:w-auto sm:min-w-[200px]">
          <button type="button" className={btn.primary} onClick={onPay}>
            <Receipt size={16} aria-hidden /> Catat pembayaran
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={`${btn.secondary} px-3`} onClick={onExtend}>
              <CalendarPlus size={16} aria-hidden /> Tambah hari
            </button>
            <button type="button" className={`${btn.secondary} px-3`} onClick={onOverride}>
              <SlidersHorizontal size={16} aria-hidden /> Batas
            </button>
          </div>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-subtle bg-bg-muted/50 px-4 py-3 text-[13px] sm:grid-cols-4 sm:px-5">
        {[
          ["Uji coba berakhir", formatDate(s.trial_ends_at)],
          ["Periode Pro berakhir", formatDate(s.current_period_end)],
          ["Tenggang berakhir", formatDate(s.grace_ends_at)],
          ["Bayar pertama", formatDate(s.first_paid_at)],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-text-muted">{k}</dt>
            <dd className="font-semibold tabular-nums text-text-heading">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ——— Riwayat pembayaran ———

function PaymentsSection({
  payments,
  latestId,
  onPay,
  onVoid,
}: {
  payments: AdminPayment[];
  latestId: string | null;
  onPay: () => void;
  onVoid: (p: AdminPayment) => void;
}) {
  const total = payments.filter((p) => p.status === "recorded").reduce((a, p) => a + p.amount, 0);
  return (
    <Section
      title="Riwayat pembayaran"
      description={payments.length ? `${payments.filter((p) => p.status === "recorded").length} pembayaran sah · total ${formatRupiah(total)}` : undefined}
      bodyClass=""
    >
      {payments.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={22} aria-hidden />}
          title="Belum ada pembayaran"
          action={
            <button type="button" className={btn.secondary} onClick={onPay}>
              <Receipt size={16} aria-hidden /> Catat pembayaran pertama
            </button>
          }
        >
          Setelah pemilik mentransfer dan mengirim bukti, catat di sini — Pro langsung aktif.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border-subtle">
          {payments.map((p) => {
            const isVoid = p.status === "void";
            return (
              <li key={p.id} className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3 text-[14px] sm:grid-cols-[110px_minmax(0,1fr)_96px_112px] sm:items-center sm:px-5 ${isVoid ? "bg-bg-muted/40" : ""}`}>
                <div className="min-w-0">
                  <p className={`font-semibold tabular-nums ${isVoid ? "text-text-muted line-through" : "text-text-heading"}`}>{formatRupiah(p.amount)}</p>
                  <p className="text-[12.5px] text-text-muted">{formatDate(p.paid_at)}</p>
                </div>
                <div className="col-span-2 row-start-2 min-w-0 text-[13px] sm:col-span-1 sm:col-start-2 sm:row-start-1">
                  <p className="text-text-body">
                    {labelOf(BILLING_CYCLES, p.cycle)} · {formatDate(p.period_start)} – {formatDate(p.period_end)}
                  </p>
                  <p className="text-text-muted">
                    {labelOf(PAYMENT_METHODS, p.method)}
                    {p.provider_ref ? ` · ref ${p.provider_ref}` : ""}
                    {p.recorded_by ? ` · dicatat ${p.recorded_by.name}` : ""}
                  </p>
                  {p.note && <p className="mt-0.5 text-text-body">“{p.note}”</p>}
                  {isVoid && (
                    <p className="mt-0.5 text-danger">
                      Dibatalkan{p.voided_by ? ` oleh ${p.voided_by.name}` : ""}
                      {p.voided_at ? `, ${formatDateTime(p.voided_at)}` : ""}: {p.void_reason || "—"}
                    </p>
                  )}
                </div>
                <div className="hidden sm:block">{isVoid ? <Badge tone="danger">Dibatalkan</Badge> : <Badge tone="success">Sah</Badge>}</div>
                <div className="col-start-2 row-start-1 flex justify-end sm:col-start-4">
                  {p.id === latestId ? (
                    <button
                      type="button"
                      onClick={() => onVoid(p)}
                      className={`inline-flex min-h-9 items-center gap-1.5 rounded-[8px] px-2.5 text-[13px] font-semibold text-danger hover:bg-danger-tint ${focusRing}`}
                    >
                      <CircleSlash size={15} aria-hidden /> Batalkan
                    </button>
                  ) : isVoid ? (
                    <span className="sm:hidden">
                      <Badge tone="danger">Dibatalkan</Badge>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {payments.length > 0 && (
        <p className="border-t border-border-subtle px-4 py-2.5 text-[12px] text-text-muted sm:px-5">
          Hanya pembayaran sah terbaru yang bisa dibatalkan — batalkan berurutan agar tanggal tetap konsisten.
        </p>
      )}
    </Section>
  );
}

// ——— Bagian formulir ———

function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  disabled,
}: {
  name: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <label
            key={o.value}
            className={`relative flex min-h-10 cursor-pointer flex-col items-center justify-center rounded-[10px] border px-2 py-1.5 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
              on ? "border-brand-primary bg-brand-tint text-brand-ink" : "border-border-subtle bg-white text-text-heading hover:border-border-active"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input type="radio" name={name} value={o.value} checked={on} disabled={disabled} onChange={() => onChange(o.value)} className="sr-only" />
            <span className="text-[13.5px] font-semibold leading-tight">{o.label}</span>
            {o.hint && <span className={`text-[12px] leading-tight tabular-nums ${on ? "text-brand-ink/80" : "text-text-muted"}`}>{o.hint}</span>}
          </label>
        );
      })}
    </div>
  );
}

function MoneyInput({ id, value, onChange, invalid, describedBy }: { id: string; value: string; onChange: (v: string) => void; invalid?: boolean; describedBy?: string }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] font-semibold text-text-muted">Rp</span>
      <input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        className={`${inputClass} pl-9 font-semibold tabular-nums`}
        value={value ? Number(value).toLocaleString("id-ID") : ""}
        onChange={(e) => onChange(digits(e.target.value).replace(/^0+(?=\d)/, "").slice(0, 9))}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
      />
    </div>
  );
}

function Preview({ children, tone = "info" }: { children: React.ReactNode; tone?: "info" | "success" }) {
  return (
    <div className={`rounded-[12px] border px-3.5 py-3 text-[14px] leading-relaxed ${tone === "success" ? "border-success/25 bg-success-tint text-success" : "border-border-subtle bg-bg-muted text-text-body"}`}>
      {children}
    </div>
  );
}

// ——— Catat pembayaran ———

type PayForm = {
  cycle: PaymentCycle;
  startMode: "auto" | "date";
  periodStart: string;
  periodEnd: string;
  amount: string;
  method: RecordPaymentInput["method"];
  paidAt: string;
  ref: string;
  note: string;
};

function RecordPaymentDialog({
  open,
  s,
  businessId,
  businessName,
  prices,
  onClose,
  onDone,
}: {
  open: boolean;
  s: AdminSubscription;
  businessId: string;
  businessName: string;
  prices: { monthly: number; yearly: number };
  onClose: () => void;
  onDone: (r: { subscription: AdminSubscription; payment: AdminPayment }) => void;
}) {
  return open ? <RecordPaymentForm {...{ s, businessId, businessName, prices, onClose, onDone }} /> : null;
}

function RecordPaymentForm({
  s,
  businessId,
  businessName,
  prices,
  onClose,
  onDone,
}: {
  s: AdminSubscription;
  businessId: string;
  businessName: string;
  prices: { monthly: number; yearly: number };
  onClose: () => void;
  onDone: (r: { subscription: AdminSubscription; payment: AdminPayment }) => void;
}) {
  const toast = useToast();
  const uid = useId();
  // ID dibuat sekali saat dialog dibuka → kirim ulang (klik ganda/jaringan putus) tetap idempoten.
  const [paymentId] = useState(newId);
  const [now] = useState(() => Date.now());
  const today = jakartaDate(0);
  const tomorrow = jakartaDate(-1);
  const [form, setForm] = useState<PayForm>({
    cycle: s.billing_cycle ?? "monthly",
    startMode: "auto",
    periodStart: today,
    periodEnd: "",
    amount: String(s.billing_cycle === "yearly" ? prices.yearly : prices.monthly),
    method: "transfer",
    paidAt: today,
    ref: "",
    note: "",
  });
  const [amountTouched, setAmountTouched] = useState(false);
  const [step, setStep] = useState<"form" | "review">("form");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const price = form.cycle === "yearly" ? prices.yearly : form.cycle === "monthly" ? prices.monthly : null;
  const set = (patch: Partial<PayForm>) => {
    setErrors({});
    setError(null);
    setForm((f) => {
      const next = { ...f, ...patch };
      // Nominal otomatis mengikuti harga paket sampai admin mengubahnya sendiri.
      if (patch.cycle && !amountTouched) {
        next.amount = patch.cycle === "yearly" ? String(prices.yearly) : patch.cycle === "monthly" ? String(prices.monthly) : f.amount;
      }
      return next;
    });
  };

  const cpe = s.current_period_end ? Date.parse(s.current_period_end) : null;
  const startMs = form.startMode === "date" && form.periodStart ? dayStartWib(form.periodStart) : Math.max(now, cpe ?? 0);
  const endMs =
    form.cycle === "monthly"
      ? addMonths(startMs, 1)
      : form.cycle === "yearly"
        ? addMonths(startMs, 12)
        : form.periodEnd
          ? dayStartWib(form.periodEnd) + DAY - 1
          : null;
  const newEnd = endMs === null ? null : Math.max(cpe ?? 0, endMs);
  const amount = Number(form.amount || 0);
  const diff = price !== null ? amount - price : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.amount === "") e.amount = "Isi nominal (boleh 0 untuk gratis).";
    if (!form.paidAt) e.paid_at = "Isi tanggal uang diterima.";
    else if (form.paidAt > tomorrow) e.paid_at = "Tidak boleh lebih dari besok.";
    if (form.startMode === "date" && !form.periodStart) e.period_start = "Isi tanggal mulai.";
    if (form.cycle === "custom") {
      if (!form.periodEnd) e.period_end = "Isi akhir periode.";
      else if (endMs !== null && endMs <= startMs) e.period_end = "Harus setelah awal periode.";
      else if (endMs !== null && endMs - startMs > 400 * DAY) e.period_end = "Maksimal 400 hari.";
    }
    if (form.note.length > 500) e.note = "Maksimal 500 karakter.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  async function submit() {
    setBusy(true);
    setError(null);
    const body: RecordPaymentInput = {
      id: paymentId,
      cycle: form.cycle,
      period_start: form.startMode === "date" ? form.periodStart : null,
      period_end: form.cycle === "custom" ? form.periodEnd : null,
      amount,
      method: form.method,
      paid_at: form.paidAt,
      provider_ref: form.ref.trim() || null,
      note: form.note.trim(),
    };
    try {
      const r = await (await adminApi()).recordPayment(businessId, body);
      toast.success(`Pembayaran ${formatRupiah(amount)} dicatat. Pro ${businessName} aktif sampai ${formatDate(r.subscription.current_period_end)}.`);
      onDone(r);
    } catch (err) {
      const fe = fieldErrors(err);
      if (Object.keys(fe).length) {
        setErrors(fe);
        setStep("form");
      }
      setError(err instanceof ApiError && err.code === "PAYMENT_EXISTS" ? "Pembayaran ini (atau nomor referensinya) sudah tercatat. Periksa riwayat pembayaran." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const fid = (k: string) => `${uid}-${k}`;
  const desc = (k: string) => (errors[k] ? `${fid(k)}-error` : undefined);

  return (
    <Modal
      open
      title={step === "form" ? "Catat pembayaran" : "Periksa sebelum mencatat"}
      description={step === "form" ? `${businessName} · paket Pro` : undefined}
      icon={<Receipt size={20} aria-hidden className="text-brand-ink" />}
      dismissible={!busy}
      onClose={onClose}
      footer={
        step === "form" ? (
          <>
            <button type="button" className={btn.secondary} onClick={onClose}>
              Batal
            </button>
            <button type="button" className={btn.primary} onClick={() => validate() && setStep("review")}>
              Lanjut periksa <ArrowRight size={16} aria-hidden />
            </button>
          </>
        ) : (
          <>
            <button type="button" className={btn.secondary} onClick={() => setStep("form")} disabled={busy}>
              Ubah
            </button>
            <button type="button" className={btn.primary} onClick={submit} disabled={busy}>
              {busy && <Spinner />}
              Catat {formatRupiah(amount)}
            </button>
          </>
        )
      }
    >
      {error && (
        <div className="mb-3">
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        </div>
      )}
      {step === "form" ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-text-heading">
              Periode
            </p>
            <Segmented<PaymentCycle>
              name="Periode"
              value={form.cycle}
              onChange={(v) => set({ cycle: v })}
              options={[
                { value: "monthly", label: "Bulanan", hint: formatRupiah(prices.monthly) },
                { value: "yearly", label: "Tahunan", hint: formatRupiah(prices.yearly) },
                { value: "custom", label: "Khusus", hint: "pilih tanggal" },
              ]}
            />
          </div>

          <div className={`grid gap-3 ${form.cycle === "custom" || form.startMode === "date" ? "sm:grid-cols-2" : ""}`}>
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Mulai</p>
              <div className="flex flex-col gap-2">
                <Segmented<"auto" | "date">
                  name="Mulai periode"
                  value={form.startMode}
                  onChange={(v) => set({ startMode: v })}
                  options={[
                    { value: "auto", label: "Sambung otomatis" },
                    { value: "date", label: "Tanggal" },
                  ]}
                />
                {form.startMode === "auto" ? (
                  <p className="text-[12.5px] text-text-muted">
                    Mulai {formatDate(isoOf(startMs))} — {cpe && cpe > now ? "menyambung periode Pro sekarang, tanpa hari hilang" : "hari ini"}.
                  </p>
                ) : (
                  <>
                    <input
                      type="date"
                      aria-label="Tanggal mulai periode"
                      className={`${inputClass} tabular-nums`}
                      value={form.periodStart}
                      onChange={(e) => set({ periodStart: e.target.value })}
                      aria-invalid={!!errors.period_start || undefined}
                    />
                    {errors.period_start && <p className="text-[13px] text-danger">{errors.period_start}</p>}
                  </>
                )}
              </div>
            </div>
            {form.cycle === "custom" && (
              <Field id={fid("period_end")} label="Sampai" error={errors.period_end} hint="Maks. 400 hari">
                <input
                  id={fid("period_end")}
                  type="date"
                  className={`${inputClass} tabular-nums`}
                  value={form.periodEnd}
                  min={form.startMode === "date" ? form.periodStart : today}
                  onChange={(e) => set({ periodEnd: e.target.value })}
                  aria-invalid={!!errors.period_end || undefined}
                  aria-describedby={desc("period_end")}
                />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              id={fid("amount")}
              label="Nominal diterima"
              error={errors.amount}
              hint={
                price === null ? (
                  "Isi sesuai kesepakatan."
                ) : diff === 0 ? (
                  "Sesuai harga paket."
                ) : (
                  <>
                    {diff < 0 ? `Diskon ${formatRupiah(-diff)}` : `Lebih ${formatRupiah(diff)}`} dari harga.{" "}
                    <button
                      type="button"
                      className={`font-semibold text-brand-ink underline underline-offset-2 ${focusRing}`}
                      onClick={() => {
                        setAmountTouched(false);
                        set({ amount: String(price) });
                      }}
                    >
                      Pakai harga
                    </button>
                  </>
                )
              }
            >
              <MoneyInput
                id={fid("amount")}
                value={form.amount}
                invalid={!!errors.amount}
                describedBy={desc("amount")}
                onChange={(v) => {
                  setAmountTouched(true);
                  set({ amount: v });
                }}
              />
            </Field>
            <Field id={fid("paid_at")} label="Tanggal uang diterima" error={errors.paid_at}>
              <input
                id={fid("paid_at")}
                type="date"
                className={`${inputClass} tabular-nums`}
                value={form.paidAt}
                max={tomorrow}
                onChange={(e) => set({ paidAt: e.target.value })}
                aria-invalid={!!errors.paid_at || undefined}
                aria-describedby={desc("paid_at")}
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Metode</p>
            <Segmented<RecordPaymentInput["method"]>
              name="Metode pembayaran"
              value={form.method}
              onChange={(v) => set({ method: v })}
              options={[
                { value: "transfer", label: "Transfer" },
                { value: "qris", label: "QRIS" },
                { value: "cash", label: "Tunai" },
                { value: "other", label: "Lainnya" },
              ]}
            />
          </div>

          <Field id={fid("ref")} label="No. referensi (opsional)" error={errors.provider_ref} hint="Mis. nomor mutasi bank — mencegah pencatatan ganda.">
            <input
              id={fid("ref")}
              className={inputClass}
              value={form.ref}
              maxLength={120}
              autoComplete="off"
              onChange={(e) => set({ ref: e.target.value })}
              aria-invalid={!!errors.provider_ref || undefined}
            />
          </Field>
          <Field id={fid("note")} label="Catatan internal (opsional)" error={errors.note} hint={`${form.note.length}/500 · tidak terlihat oleh pemilik`}>
            <textarea
              id={fid("note")}
              rows={2}
              className={`${inputClass} py-2`}
              value={form.note}
              maxLength={500}
              onChange={(e) => set({ note: e.target.value })}
            />
          </Field>

          {newEnd !== null && (
            <Preview>
              Setelah dicatat: <strong className="text-text-heading">Pro aktif sampai {formatDate(isoOf(newEnd))}</strong>
              {s.current_period_end && cpe && cpe > now ? <> (sebelumnya {formatDate(s.current_period_end)})</> : null}.
            </Preview>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <dl className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle px-3.5 text-[14px]">
            {[
              ["Bisnis", businessName],
              ["Nominal", formatRupiah(amount) + (price !== null && diff !== 0 ? ` (harga ${formatRupiah(price)})` : "")],
              ["Periode", `${labelOf(BILLING_CYCLES, form.cycle)} · ${formatDate(isoOf(startMs))} – ${endMs ? formatDate(isoOf(endMs)) : "—"}`],
              ["Metode", labelOf(PAYMENT_METHODS, form.method)],
              ["Diterima", formatDate(`${form.paidAt}T12:00:00+07:00`)],
              ...(form.ref.trim() ? [["Referensi", form.ref.trim()]] : []),
              ...(form.note.trim() ? [["Catatan", form.note.trim()]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex items-start justify-between gap-4 py-2">
                <dt className="shrink-0 text-text-muted">{k}</dt>
                <dd className="min-w-0 break-words text-right font-medium text-text-heading">{v}</dd>
              </div>
            ))}
          </dl>
          {newEnd !== null && (
            <Preview tone="success">
              Pro <strong>{businessName}</strong> aktif sampai <strong>{formatDate(isoOf(newEnd))}</strong>. Pemilik menerima notifikasi
              “Pro aktif”. Bisa dibatalkan bila salah catat.
            </Preview>
          )}
        </div>
      )}
    </Modal>
  );
}

// ——— Batalkan pembayaran ———

function VoidDialog({
  payment,
  businessId,
  onClose,
  onDone,
}: {
  payment: AdminPayment | null;
  businessId: string;
  onClose: () => void;
  onDone: (r: { subscription: AdminSubscription; payment: AdminPayment }) => void;
}) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shownFor, setShownFor] = useState<string | null>(null);
  if ((payment?.id ?? null) !== shownFor) {
    setShownFor(payment?.id ?? null);
    setReason("");
    setError(null);
  }

  async function confirm() {
    if (!payment) return;
    setBusy(true);
    setError(null);
    try {
      const r = await (await adminApi()).voidPayment(businessId, payment.id, reason.trim());
      toast.success(`Pembayaran ${formatRupiah(payment.amount)} dibatalkan. Periode Pro dikembalikan.`);
      onDone(r);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "PAYMENT_NOT_LATEST" ? "Ada pembayaran yang lebih baru. Batalkan yang terbaru dulu (berurutan)." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      open={!!payment}
      title="Batalkan pembayaran ini?"
      confirmLabel="Batalkan pembayaran"
      cancelLabel="Jangan"
      tone="danger"
      busy={busy}
      confirmDisabled={reason.trim().length === 0}
      onConfirm={confirm}
      onClose={onClose}
    >
      {payment && (
        <div className="flex flex-col gap-3">
          <p>
            <strong className="text-text-heading">{formatRupiah(payment.amount)}</strong> · {labelOf(BILLING_CYCLES, payment.cycle).toLowerCase()} ·{" "}
            {formatDate(payment.period_start)} – {formatDate(payment.period_end)}
          </p>
          <p>
            Periode Pro dikembalikan seperti sebelum pembayaran ini. Bila jatuh di masa lalu, bisnis bisa langsung masuk masa tenggang atau Gratis.
            Catatan pembayaran tetap disimpan (status “dibatalkan”).
          </p>
          {error && (
            <Notice tone="danger" role="alert">
              {error}
            </Notice>
          )}
          <div>
            <label htmlFor="void-reason" className="mb-1.5 block text-[13px] font-semibold text-text-heading">
              Alasan (wajib)
            </label>
            <textarea
              id="void-reason"
              rows={2}
              maxLength={300}
              className={`${inputClass} py-2`}
              placeholder="Mis. salah bisnis, transfer belum masuk"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}

// ——— Tambah hari ———

function ExtendDialog({
  open,
  s,
  businessId,
  businessName,
  onClose,
  onDone,
}: {
  open: boolean;
  s: AdminSubscription;
  businessId: string;
  businessName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  return open ? <ExtendForm {...{ s, businessId, businessName, onClose, onDone }} /> : null;
}

function ExtendForm({
  s,
  businessId,
  businessName,
  onClose,
  onDone,
}: {
  s: AdminSubscription;
  businessId: string;
  businessName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [now] = useState(() => Date.now());
  const autoTarget: "trial" | "period" = s.status === "active" || (s.status === "grace" && s.first_paid_at) ? "period" : "trial";
  const [days, setDays] = useState("7");
  const [target, setTarget] = useState<ExtendInput["target"]>("auto");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const n = Number(days || 0);
  const eff = target === "auto" ? autoTarget : target;
  const baseIso = eff === "trial" ? s.trial_ends_at : s.current_period_end;
  const base = Math.max(baseIso ? Date.parse(baseIso) : 0, now);
  const valid = n >= 1 && n <= 366 && note.trim().length > 0;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await (await adminApi()).extendSubscription(businessId, { days: n, target, note: note.trim() });
      toast.success(`${businessName}: +${n} hari ${eff === "trial" ? "uji coba" : "Pro"} sampai ${formatDate(isoOf(base + n * DAY))}.`);
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Tambah hari"
      description="Hadiah, kompensasi gangguan, atau perpanjangan uji coba — tanpa pembayaran."
      icon={<CalendarPlus size={20} aria-hidden className="text-brand-ink" />}
      dismissible={!busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={submit} disabled={busy || !valid}>
            {busy && <Spinner />}
            Tambah {n > 0 ? `${n} hari` : "hari"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <Field id="ext-days" label="Jumlah hari" error={errors.days} hint="1–366 hari">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-24">
              <input
                id="ext-days"
                inputMode="numeric"
                className={`${inputClass} font-semibold tabular-nums`}
                value={days}
                onChange={(e) => setDays(digits(e.target.value).slice(0, 3))}
                aria-invalid={!!errors.days || undefined}
              />
            </div>
            {[3, 7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(String(d))}
                className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold tabular-nums ${
                  n === d ? "border-brand-primary bg-brand-tint text-brand-ink" : "border-border-subtle text-text-body hover:border-border-active"
                } ${focusRing}`}
              >
                {d} hari
              </button>
            ))}
          </div>
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Tambahkan ke</p>
          <Segmented<ExtendInput["target"]>
            name="Tambahkan ke"
            value={target}
            onChange={setTarget}
            options={[
              { value: "auto", label: "Otomatis", hint: autoTarget === "trial" ? "→ uji coba" : "→ periode Pro" },
              { value: "trial", label: "Uji coba" },
              { value: "period", label: "Periode Pro" },
            ]}
          />
          <p className="mt-1.5 text-[12.5px] text-text-muted">
            {eff === "trial"
              ? s.status === "free"
                ? "Uji coba ulang: Pro kembali aktif mulai hari ini."
                : "Memperpanjang akhir uji coba."
              : "Memperpanjang periode Pro berbayar tanpa mencatat pembayaran."}
          </p>
        </div>
        <Field id="ext-note" label="Alasan (wajib)" error={errors.note} hint={`${note.length}/300 · tercatat di audit`}>
          <textarea
            id="ext-note"
            rows={2}
            maxLength={300}
            className={`${inputClass} py-2`}
            placeholder="Mis. kompensasi server gangguan 2 hari"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {n >= 1 && n <= 366 && (
          <Preview>
            {eff === "trial" ? "Uji coba" : "Pro"} berakhir{" "}
            {baseIso && Date.parse(baseIso) > now ? <span className="line-through decoration-text-muted/60">{formatDate(baseIso)}</span> : "hari ini"} →{" "}
            <strong className="text-text-heading">{formatDate(isoOf(base + n * DAY))}</strong>
          </Preview>
        )}
      </div>
    </Modal>
  );
}

// ——— Batas khusus ———

function OverridesDialog({
  open,
  s,
  businessId,
  onClose,
  onDone,
}: {
  open: boolean;
  s: AdminSubscription;
  businessId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  return open ? <OverridesForm {...{ s, businessId, onClose, onDone }} /> : null;
}

function OverridesForm({ s, businessId, onClose, onDone }: { s: AdminSubscription; businessId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [outlets, setOutlets] = useState(s.overrides.outlet_quota === null ? "" : String(s.overrides.outlet_quota));
  const [tx, setTx] = useState(s.overrides.tx_limit === null ? "" : String(s.overrides.tx_limit));
  const [note, setNote] = useState(s.overrides.note);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const body = { outlet_quota: outlets ? Number(outlets) : null, tx_limit: tx ? Number(tx) : null, note: note.trim() };
  const dirty = body.outlet_quota !== s.overrides.outlet_quota || body.tx_limit !== s.overrides.tx_limit || body.note !== s.overrides.note;
  const localErr: Record<string, string> = {};
  if (body.outlet_quota !== null && (body.outlet_quota < 1 || body.outlet_quota > 100)) localErr.outlet_quota = "1–100, atau kosongkan untuk bawaan.";
  if (body.tx_limit !== null && (body.tx_limit < 1 || body.tx_limit > 1_000_000)) localErr.tx_limit = "1–1.000.000, atau kosongkan untuk bawaan.";
  const shown = { ...localErr, ...errors };
  const describe = (v: number | null, def: string) => (v === null ? def : v.toLocaleString("id-ID"));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await (await adminApi()).saveOverrides(businessId, body);
      toast.success("Batas khusus disimpan. Aplikasi menerima perubahan saat sinkron berikutnya.");
      onDone();
    } catch (err) {
      setConfirm(false);
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (confirm) {
    return (
      <ConfirmDialog open title="Simpan batas khusus?" confirmLabel="Simpan" busy={busy} onConfirm={save} onClose={() => setConfirm(false)}>
        <ul className="flex flex-col gap-1">
          <li>
            Kuota outlet: <span className="text-text-muted">{describe(s.overrides.outlet_quota, "bawaan (1)")}</span> →{" "}
            <strong className="text-text-heading">{describe(body.outlet_quota, "bawaan (1)")}</strong>
          </li>
          <li>
            Batas transaksi Gratis: <span className="text-text-muted">{describe(s.overrides.tx_limit, "bawaan (50)")}</span> →{" "}
            <strong className="text-text-heading">{describe(body.tx_limit, "bawaan (50)")}</strong>
          </li>
        </ul>
        <p className="mt-2 text-[13px] text-text-muted">Dicatat di audit. Batas transaksi hanya berlaku saat paket Gratis.</p>
      </ConfirmDialog>
    );
  }

  return (
    <Modal
      open
      title="Batas khusus"
      description="Kosongkan isian untuk kembali ke bawaan paket."
      icon={<SlidersHorizontal size={20} aria-hidden className="text-brand-ink" />}
      dismissible={!busy}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Batal
          </button>
          <button type="button" className={btn.primary} disabled={!dirty || Object.keys(localErr).length > 0} onClick={() => setConfirm(true)}>
            Lanjut
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="ov-outlets" label="Kuota outlet" error={shown.outlet_quota} hint={`Bawaan 1 · terpakai ${s.usage.outlets}`}>
            <input
              id="ov-outlets"
              inputMode="numeric"
              placeholder="Bawaan (1)"
              className={`${inputClass} tabular-nums`}
              value={outlets}
              onChange={(e) => setOutlets(digits(e.target.value).slice(0, 3))}
              aria-invalid={!!shown.outlet_quota || undefined}
            />
          </Field>
          <Field id="ov-tx" label="Batas transaksi Gratis" error={shown.tx_limit} hint={`Bawaan 50/bulan · bulan ini ${s.usage.tx_this_month}`}>
            <input
              id="ov-tx"
              inputMode="numeric"
              placeholder="Bawaan (50)"
              className={`${inputClass} tabular-nums`}
              value={tx ? Number(tx).toLocaleString("id-ID") : ""}
              onChange={(e) => setTx(digits(e.target.value).slice(0, 7))}
              aria-invalid={!!shown.tx_limit || undefined}
            />
          </Field>
        </div>
        <Field id="ov-note" label="Catatan" error={shown.note} hint={`${note.length}/300`}>
          <textarea
            id="ov-note"
            rows={2}
            maxLength={300}
            className={`${inputClass} py-2`}
            placeholder="Mis. mitra komunitas, outlet lama sebelum peluncuran"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
        {s.plan === "pro" && body.tx_limit !== null && (
          <p className="text-[12.5px] text-text-muted">Bisnis ini sedang Pro (tanpa batas); batas transaksi baru berlaku bila kembali ke Gratis.</p>
        )}
      </div>
    </Modal>
  );
}
