"use client";

import React, { useId } from "react";
import Link from "next/link";
import { ChevronRight, Info, Lock, Plus, Store, Trash2 } from "lucide-react";
import { useToast } from "@/components/admin/toast";
import {
  Badge,
  btn,
  cardClass,
  ErrorBlock,
  Field,
  focusRing,
  formatRupiah,
  iconBtn,
  inputClass,
  PageHeader,
  SkeletonList,
  Switch,
  useLoad,
} from "@/components/admin/ui";
import { newId, pullAll } from "@/lib/owner/api";
import { hasFeature, saveRecord } from "@/lib/owner/records";
import {
  type AttendanceRules,
  isHHMM,
  type Loyalty,
  mergeReceipt,
  mergeSection,
  paperLabel,
  mergeTaxes,
  mergeTiers,
  type Obj,
  ORDER_TYPE_VALUES,
  type OrderType,
  readAttendance,
  readLoyalty,
  readReceipt,
  readReceiptLogo,
  readReceiptPaper,
  readRounding,
  readServiceFee,
  readTaxes,
  readTimezone,
  readTransaction,
  type Receipt,
  type Rounding,
  type ServiceFee,
  type Tax,
  TIMEZONE_CHOICES,
  type TimezoneChoice,
  type TransactionSettings,
} from "@/lib/owner/settings";
import type { SyncRecord } from "@/lib/owner/types";
import { zoneLabel } from "@/lib/owner/tz";
import { ChipGroup, EditSection, NumberInput, Segmented, useDraft, useSaver } from "./editing";
import { PaymentMethodsSection } from "./PaymentMethodsSection";
import { ORDER_TYPES, WEEKDAYS } from "./labels";
import { useOwner } from "./OwnerShell";
import { Select } from "./Select";
import { LockedCard } from "./ui";

// Pengaturan: per outlet (`outlets` — nama/alamat, pajak, biaya layanan, pembulatan, struk, transaksi, metode
// pembayaran dengan konfirmasi password) dan per usaha (`business_settings` — loyalti, aturan absensi). Setiap bagian disimpan
// sendiri dengan seluruh field record + `base_updated_at`; kunci pengaturan yang tidak diedit tetap utuh.

type Rec = SyncRecord & { settings?: unknown; name?: string; address?: string };

const ORDER_TYPE_OPTIONS = ORDER_TYPE_VALUES.map((v) => ({ value: v, label: ORDER_TYPES[v] ?? v }));

function settingsOf(rec: Rec | null | undefined): Obj {
  const s = rec?.settings;
  return typeof s === "object" && s !== null && !Array.isArray(s) ? (s as Obj) : {};
}

export function SettingsView() {
  const { session, outletId } = useOwner();
  const effectiveId = outletId ?? (session.outlets.length === 1 ? session.outlets[0].id : undefined);

  const outlets = useLoad<Rec[]>((signal) => pullAll<Rec>("outlets", signal), []);
  const biz = useLoad<Rec | null>(
    async (signal) => (await pullAll<Rec>("business_settings", signal)).find((r) => r.id === session.business.id) ?? null,
    [session.business.id]
  );
  const rec = effectiveId ? outlets.state.data?.find((o) => o.id === effectiveId) ?? null : null;
  const setOutlet = (r: SyncRecord) => {
    const list = outlets.state.data ?? [];
    outlets.setData(list.some((o) => o.id === r.id) ? list.map((o) => (o.id === r.id ? (r as Rec) : o)) : [...list, r as Rec]);
  };
  const credit = hasFeature(session.subscription, "credit");
  const staff = hasFeature(session.subscription, "staff");

  const toc = [
    ...(effectiveId
      ? [
          ["outlet", "Outlet"],
          ["pajak", "Pajak"],
          ["biaya-layanan", "Biaya layanan"],
          ["pembulatan", "Pembulatan"],
          ["struk", "Struk"],
          ["transaksi", "Transaksi"],
          ["pembayaran", "Pembayaran"],
        ]
      : []),
    ["zona-waktu", "Zona waktu"],
    ["loyalti", "Loyalti"],
    ["absensi", "Absensi"],
  ];

  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Perubahan terkirim ke semua perangkat kasir saat sinkron. Aplikasi yang sedang offline memakai pengaturan lama sampai tersambung."
      />

      <nav aria-label="Bagian pengaturan" className="-mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {toc.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className={`inline-flex min-h-8 shrink-0 items-center rounded-full border border-border-subtle bg-white px-3 text-[13px] font-medium text-text-body hover:border-border-active hover:text-text-heading ${focusRing}`}
          >
            {label}
          </a>
        ))}
      </nav>

      <h2 className="mb-3 text-[17px] font-bold text-text-heading">Pengaturan outlet</h2>
      {!effectiveId ? (
        <OutletChooser />
      ) : outlets.state.status === "error" && !outlets.state.data ? (
        <ErrorBlock error={outlets.state.error} onRetry={outlets.reload} />
      ) : !outlets.state.data ? (
        <SkeletonList rows={4} label="Memuat pengaturan outlet" />
      ) : !rec ? (
        <ErrorBlock error={new Error("Outlet tidak ditemukan")} onRetry={outlets.reload} />
      ) : (
        <div className="flex flex-col gap-5">
          <OutletInfoSection rec={rec} onRecord={setOutlet} />
          <TaxesSection rec={rec} onRecord={setOutlet} />
          <ServiceFeeSection rec={rec} onRecord={setOutlet} />
          <RoundingSection rec={rec} onRecord={setOutlet} />
          <ReceiptSection rec={rec} onRecord={setOutlet} businessName={session.business.name} />
          <TransactionSection rec={rec} onRecord={setOutlet} credit={credit} />
          <PaymentMethodsSection rec={rec} onRecord={setOutlet} />
        </div>
      )}

      <h2 className="mt-8 mb-1 text-[17px] font-bold text-text-heading">Pengaturan usaha</h2>
      <p className="mb-3 text-[13.5px] text-text-body">Berlaku untuk semua outlet {session.business.name}.</p>
      {biz.state.status === "error" && biz.state.data === undefined ? (
        <ErrorBlock error={biz.state.error} onRetry={biz.reload} />
      ) : biz.state.data === undefined ? (
        <SkeletonList rows={3} label="Memuat pengaturan usaha" />
      ) : (
        <div className="flex flex-col gap-5">
          <TimezoneSection rec={biz.state.data} businessId={session.business.id} onRecord={(r) => biz.setData(r as Rec)} />
          <LoyaltySection rec={biz.state.data} businessId={session.business.id} onRecord={(r) => biz.setData(r as Rec)} />
          {staff ? (
            <AttendanceSection rec={biz.state.data} businessId={session.business.id} onRecord={(r) => biz.setData(r as Rec)} />
          ) : (
            <div id="absensi" className="scroll-mt-20">
              <LockedCard title="Aturan absensi">Atur jam kerja, toleransi terlambat, dan hari libur untuk absensi & gaji karyawan dengan paket Pro.</LockedCard>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function OutletChooser() {
  const { session } = useOwner();
  return (
    <section className={`${cardClass} p-4 sm:p-5`} id="outlet">
      <p className="flex items-start gap-2 text-[14px] text-text-body">
        <Info size={16} aria-hidden className="mt-0.5 shrink-0 text-text-muted" />
        Pengaturan pajak, struk, dan transaksi berlaku per outlet. Pilih outlet yang ingin diatur:
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {session.outlets.map((o) => (
          <li key={o.id}>
            <Link
              href={`/dasbor/pengaturan?outlet=${encodeURIComponent(o.id)}`}
              className={`flex min-h-12 items-center gap-3 rounded-[12px] border border-border-subtle px-3.5 py-2.5 hover:border-border-active ${focusRing}`}
            >
              <Store size={18} aria-hidden className="shrink-0 text-text-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-text-heading">{o.name}</span>
                {o.address && <span className="block truncate text-[12.5px] text-text-muted">{o.address}</span>}
              </span>
              {o.status === "closed" && <Badge>Tutup</Badge>}
              <ChevronRight size={16} aria-hidden className="text-text-muted" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

type OutletProps = { rec: Rec; onRecord: (r: SyncRecord) => void };

// ——— Outlet: nama & alamat ———

function OutletInfoSection({ rec, onRecord }: OutletProps) {
  const uid = useId();
  const base = { name: String(rec.name ?? ""), address: String(rec.address ?? "") };
  const { draft, setDraft, dirty, reset } = useDraft(base);
  const saver = useSaver(onRecord);
  const nameErr = draft.name.trim().length < 1 ? "Nama outlet wajib diisi." : draft.name.trim().length > 80 ? "Maksimal 80 huruf." : undefined;
  const addrErr = draft.address.trim().length > 200 ? "Maksimal 200 huruf." : undefined;
  return (
    <EditSection
      id="outlet"
      title="Outlet"
      description={<>Nama & alamat tampil di struk dan aplikasi. Tambah atau hapus outlet di halaman <Link href="/dasbor/outlet" className="font-semibold text-brand-ink underline">Outlet</Link>.</>}
      dirty={dirty}
      saving={saver.saving}
      canSave={!nameErr && !addrErr}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={() =>
        saver.run(
          () => saveRecord("outlets", rec.id, rec, { name: draft.name.trim(), address: draft.address.trim() }),
          "Nama & alamat outlet disimpan.",
          (r) => setDraft({ name: String(r.name ?? ""), address: String(r.address ?? "") })
        )
      }
    >
      <Field id={`${uid}-name`} label="Nama outlet" error={nameErr}>
        <input
          id={`${uid}-name`}
          className={inputClass}
          value={draft.name}
          maxLength={80}
          aria-invalid={!!nameErr || undefined}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </Field>
      <Field id={`${uid}-address`} label="Alamat" error={addrErr}>
        <textarea
          id={`${uid}-address`}
          className={`${inputClass} min-h-[72px] py-2`}
          value={draft.address}
          maxLength={200}
          aria-invalid={!!addrErr || undefined}
          onChange={(e) => setDraft({ ...draft, address: e.target.value })}
        />
      </Field>
    </EditSection>
  );
}

// ——— Outlet: pajak ———

function TaxesSection({ rec, onRecord }: OutletProps) {
  const uid = useId();
  const settings = settingsOf(rec);
  const base = readTaxes(settings);
  const { draft, setDraft, dirty, reset } = useDraft<Tax[]>(base);
  const saver = useSaver(onRecord);
  const savedIds = new Set(base.map((t) => t.id));
  const errs = draft.map((t) => ({
    name: !t.name.trim() ? "Nama wajib diisi." : t.name.trim().length > 40 ? "Maksimal 40 huruf." : undefined,
    rate: !Number.isFinite(t.rate_bp) || t.rate_bp < 0 || t.rate_bp > 10000 ? "Tarif 0–100%." : undefined,
  }));
  const valid = errs.every((e) => !e.name && !e.rate);
  const update = (i: number, patch: Partial<Tax>) => setDraft(draft.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <EditSection
      id="pajak"
      title="Pajak"
      description="Pajak dihitung dari subtotal setelah diskon untuk produk yang dikenai pajak. Contoh: PB1 10%, PPN 11%."
      dirty={dirty}
      saving={saver.saving}
      canSave={valid}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={() =>
        saver.run(
          () => {
            const taxes = draft.map((t) => ({ ...t, name: t.name.trim() }));
            return saveRecord("outlets", rec.id, rec, { settings: { ...settings, taxes: mergeTaxes(settings, taxes) } });
          },
          "Pengaturan pajak disimpan.",
          (r) => setDraft(readTaxes(settingsOf(r as Rec)))
        )
      }
    >
      {draft.length === 0 ? (
        <p className="text-[14px] text-text-muted">Belum ada pajak. Transaksi tidak dikenai pajak.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {draft.map((t, i) => (
            <li key={t.id} className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 rounded-[12px] border border-border-subtle p-3 sm:grid-cols-[1fr_140px_auto_auto] sm:items-end">
              <Field id={`${uid}-tax-${i}-name`} label="Nama pajak" error={errs[i].name} className="col-span-2 sm:col-span-1">
                <input
                  id={`${uid}-tax-${i}-name`}
                  className={inputClass}
                  value={t.name}
                  maxLength={40}
                  placeholder="PB1"
                  aria-invalid={!!errs[i].name || undefined}
                  onChange={(e) => update(i, { name: e.target.value })}
                />
              </Field>
              <Field id={`${uid}-tax-${i}-rate`} label="Tarif" error={errs[i].rate}>
                <NumberInput id={`${uid}-tax-${i}-rate`} kind="percent" suffix="%" value={t.rate_bp} invalid={!!errs[i].rate} onChange={(v) => update(i, { rate_bp: v })} />
              </Field>
              <div className="flex min-h-10 items-center gap-2 sm:pb-0">
                <Switch id={`${uid}-tax-${i}-on`} label="Aktif" checked={t.enabled} onChange={(v) => update(i, { enabled: v })} />
              </div>
              <div className="flex min-h-10 items-center justify-end">
                {!savedIds.has(t.id) ? (
                  <button type="button" className={`${iconBtn} hover:text-danger`} onClick={() => setDraft(draft.filter((_, j) => j !== i))} aria-label={`Buang pajak baru ${t.name || ""}`.trim()} title="Buang">
                    <Trash2 size={16} aria-hidden />
                  </button>
                ) : (
                  <span className="w-9" aria-hidden />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={btn.secondary}
          disabled={draft.length >= 10}
          onClick={() => setDraft([...draft, { id: newId(), name: "", rate_bp: 1000, enabled: true }])}
        >
          <Plus size={16} aria-hidden /> Tambah pajak
        </button>
        <p className="text-[12.5px] text-text-muted">Pajak lama tidak dihapus agar riwayat tetap jelas — nonaktifkan bila tidak dipakai.</p>
      </div>
    </EditSection>
  );
}

// ——— Outlet: biaya layanan ———

function ServiceFeeSection({ rec, onRecord }: OutletProps) {
  const uid = useId();
  const settings = settingsOf(rec);
  const base = readServiceFee(settings);
  const { draft, setDraft, dirty, reset } = useDraft<ServiceFee>(base);
  const saver = useSaver(onRecord);
  const rateErr = draft.type === "percent" && (!Number.isFinite(draft.rate_bp) || draft.rate_bp > 10000) ? "Tarif 0–100%." : undefined;
  const amountErr = draft.type === "fixed" && (!Number.isFinite(draft.amount) || draft.amount > 1_000_000_000) ? "Nominal tidak sah." : undefined;
  return (
    <EditSection
      id="biaya-layanan"
      title="Biaya layanan"
      description="Ditambahkan ke tagihan setelah diskon, sebelum pajak."
      dirty={dirty}
      saving={saver.saving}
      canSave={!rateErr && !amountErr}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={() =>
        saver.run(
          () => saveRecord("outlets", rec.id, rec, { settings: mergeSection(settings, "service_fee", draft) }),
          "Biaya layanan disimpan.",
          (r) => setDraft(readServiceFee(settingsOf(r as Rec)))
        )
      }
    >
      <Switch id={`${uid}-on`} label="Kenakan biaya layanan" checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
      {draft.enabled && (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Jenis</p>
              <Segmented
                label="Jenis biaya layanan"
                value={draft.type}
                onChange={(v) => setDraft({ ...draft, type: v })}
                options={[
                  { value: "percent", label: "Persen" },
                  { value: "fixed", label: "Nominal" },
                ]}
              />
            </div>
            {draft.type === "percent" ? (
              <Field id={`${uid}-rate`} label="Tarif" error={rateErr} className="w-[160px]">
                <NumberInput id={`${uid}-rate`} kind="percent" suffix="%" value={draft.rate_bp} invalid={!!rateErr} onChange={(v) => setDraft({ ...draft, rate_bp: v })} />
              </Field>
            ) : (
              <Field id={`${uid}-amount`} label="Nominal per transaksi" error={amountErr} className="w-[200px]">
                <NumberInput id={`${uid}-amount`} prefix="Rp" value={draft.amount} invalid={!!amountErr} onChange={(v) => setDraft({ ...draft, amount: v })} />
              </Field>
            )}
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Berlaku untuk jenis pesanan</p>
            <ChipGroup label="Jenis pesanan biaya layanan" options={ORDER_TYPE_OPTIONS} selected={draft.order_types} onChange={(v) => setDraft({ ...draft, order_types: sortTypes(v) })} />
            <p className="mt-1.5 text-[12.5px] text-text-muted">{draft.order_types.length === 0 ? "Tidak ada yang dipilih = semua jenis pesanan." : "Hanya jenis yang dipilih."}</p>
          </div>
          <Switch
            id={`${uid}-taxable`}
            label="Biaya layanan dikenai pajak"
            description="Pajak dihitung dari subtotal + biaya layanan."
            checked={draft.taxable}
            onChange={(v) => setDraft({ ...draft, taxable: v })}
          />
        </>
      )}
    </EditSection>
  );
}

function sortTypes(v: OrderType[]): OrderType[] {
  return ORDER_TYPE_VALUES.filter((t) => v.includes(t));
}

// ——— Outlet: pembulatan ———

function RoundingSection({ rec, onRecord }: OutletProps) {
  const uid = useId();
  const settings = settingsOf(rec);
  const { draft, setDraft, dirty, reset } = useDraft<Rounding>(readRounding(settings));
  const saver = useSaver(onRecord);
  return (
    <EditSection
      id="pembulatan"
      title="Pembulatan"
      description="Total dibulatkan ke atas hanya saat pembayaran tunai melunasi seluruh tagihan."
      dirty={dirty}
      saving={saver.saving}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={() =>
        saver.run(
          () => saveRecord("outlets", rec.id, rec, { settings: mergeSection(settings, "rounding", draft) }),
          "Pembulatan disimpan.",
          (r) => setDraft(readRounding(settingsOf(r as Rec)))
        )
      }
    >
      <Switch id={`${uid}-on`} label="Bulatkan total tunai" checked={draft.enabled} onChange={(v) => setDraft({ ...draft, enabled: v })} />
      {draft.enabled && (
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Kelipatan</p>
          <Segmented
            label="Kelipatan pembulatan"
            value={draft.unit}
            onChange={(v) => setDraft({ ...draft, unit: v })}
            options={[
              { value: 100, label: "Rp100" },
              { value: 500, label: "Rp500" },
              { value: 1000, label: "Rp1.000" },
            ]}
          />
          <p className="mt-1.5 text-[12.5px] text-text-muted">
            Contoh: {formatRupiah(23_420)} → {formatRupiah(Math.ceil(23_420 / draft.unit) * draft.unit)}
          </p>
        </div>
      )}
    </EditSection>
  );
}

// ——— Outlet: struk ———

function ReceiptSection({ rec, onRecord, businessName }: OutletProps & { businessName: string }) {
  const uid = useId();
  const settings = settingsOf(rec);
  const { draft, setDraft, dirty, reset } = useDraft<Receipt>(readReceipt(settings));
  const saver = useSaver(onRecord);
  const set = <K extends keyof Receipt>(k: K, v: Receipt[K]) => setDraft({ ...draft, [k]: v });
  const logoUrl = readReceiptLogo(settings);
  // Preset dari aplikasi (huruf kecil / kertas kecil / Lainnya) hanya ditampilkan bila ukurannya belum diubah di sini.
  const savedPaper = readReceiptPaper(settings);
  const appPaper = savedPaper && draft.paper_mm === readReceipt(settings).paper_mm ? savedPaper : null;
  return (
    <EditSection
      id="struk"
      title="Struk"
      description="Tampilan struk cetak & digital dari perangkat kasir outlet ini."
      dirty={dirty}
      saving={saver.saving}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={() =>
        saver.run(
          () =>
            saveRecord("outlets", rec.id, rec, {
              settings: mergeReceipt(settings, draft),
            }),
          "Pengaturan struk disimpan.",
          (r) => setDraft(readReceipt(settingsOf(r as Rec)))
        )
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_auto]">
        <div className="flex min-w-0 flex-col gap-4">
          <Field id={`${uid}-header`} label="Teks atas (opsional)" hint="Mis. slogan, jam buka, atau nomor WhatsApp.">
            <textarea id={`${uid}-header`} className={`${inputClass} min-h-[64px] py-2`} value={draft.header} maxLength={200} onChange={(e) => set("header", e.target.value)} />
          </Field>
          <Field id={`${uid}-footer`} label="Teks bawah (opsional)" hint="Mis. ucapan terima kasih atau kebijakan penukaran.">
            <textarea id={`${uid}-footer`} className={`${inputClass} min-h-[64px] py-2`} value={draft.footer} maxLength={200} onChange={(e) => set("footer", e.target.value)} />
          </Field>
          <Field id={`${uid}-ig`} label="Instagram (opsional)">
            <div className="relative sm:max-w-[280px]">
              <span aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[14px] text-text-muted">
                @
              </span>
              <input
                id={`${uid}-ig`}
                className={`${inputClass} pl-7`}
                value={draft.instagram.replace(/^@+/, "")}
                maxLength={60}
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => set("instagram", e.target.value.replace(/^@+/, ""))}
              />
            </div>
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Ukuran kertas</p>
            <Segmented
              label="Ukuran kertas"
              value={draft.paper_mm}
              onChange={(v) => set("paper_mm", v)}
              options={[
                { value: 58, label: "58 mm" },
                { value: 80, label: "80 mm" },
              ]}
            />
            <p className="mt-1.5 text-[12.5px] text-text-muted">
              {appPaper && appPaper.preset !== "58" && appPaper.preset !== "80" ? `Dipilih di aplikasi: ${paperLabel(appPaper)}. ` : ""}
              Ukuran bawaan outlet; kertas tiap printer diatur di aplikasi.
            </p>
          </div>
          <Switch
            id={`${uid}-logo`}
            label="Tampilkan logo"
            description={logoUrl ? "Logo toko dicetak hitam-putih di atas struk. Ganti logo dari aplikasi (Pengaturan › Struk)." : "Belum ada logo. Unggah logo dari aplikasi (Pengaturan › Struk)."}
            checked={draft.show_logo}
            onChange={(v) => set("show_logo", v)}
          />
          <Switch id={`${uid}-rate`} label="Tampilkan tarif pajak" description="Mis. “PB1 10%” alih-alih “PB1”." checked={draft.show_tax_rate} onChange={(v) => set("show_tax_rate", v)} />
        </div>
        <ReceiptPreview receipt={draft} logoUrl={logoUrl} outletName={String(rec.name ?? "")} address={String(rec.address ?? "")} businessName={businessName} taxes={readTaxes(settings)} />
      </div>
    </EditSection>
  );
}

function Row({ l, r, bold }: { l: string; r: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? "font-bold" : ""}`}>
      <span className="min-w-0 break-words">{l}</span>
      <span className="shrink-0 tabular-nums">{r}</span>
    </div>
  );
}

function ReceiptPreview({
  receipt,
  logoUrl,
  outletName,
  address,
  businessName,
  taxes,
}: {
  receipt: Receipt;
  logoUrl: string;
  outletName: string;
  address: string;
  businessName: string;
  taxes: Tax[];
}) {
  const items = [
    { name: "Kopi susu", qty: 2, price: 18_000 },
    { name: "Roti bakar", qty: 1, price: 15_000 },
  ];
  const subtotal = items.reduce((a, i) => a + i.qty * i.price, 0);
  const active = taxes.filter((t) => t.enabled && Number.isFinite(t.rate_bp));
  const taxLines = active.map((t) => ({ label: receipt.show_tax_rate ? `${t.name} ${(t.rate_bp / 100).toLocaleString("id-ID")}%` : t.name, amount: Math.round((subtotal * t.rate_bp) / 10000) }));
  const total = subtotal + taxLines.reduce((a, t) => a + t.amount, 0);
  const rp = (n: number) => n.toLocaleString("id-ID");
  return (
    <figure className="mx-auto lg:mx-0">
      <figcaption className="mb-1.5 text-center text-[12px] font-semibold uppercase tracking-wide text-text-muted lg:text-left">Pratinjau</figcaption>
      <div
        aria-hidden
        className={`rounded-[6px] border border-border-subtle bg-[#fffdf8] px-3 py-3 font-mono text-[11px] leading-[1.45] text-[#2b2620] shadow-[0_6px_18px_-8px_rgba(16,24,40,0.25)] ${
          receipt.paper_mm === 80 ? "w-[268px]" : "w-[204px]"
        }`}
      >
        <div className="text-center">
          {receipt.show_logo && logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- berkas unggahan API (domain bebas), tanpa optimasi.
            <img src={logoUrl} alt="" className="mx-auto mb-1 max-h-[64px] max-w-full object-contain grayscale contrast-200" />
          )}
          <div className="font-bold">{outletName || businessName}</div>
          {address && <div className="break-words">{address}</div>}
          {receipt.header && <div className="mt-1 whitespace-pre-line break-words">{receipt.header}</div>}
        </div>
        <div className="my-1.5 border-t border-dashed border-[#2b2620]/50" />
        {items.map((i) => (
          <div key={i.name}>
            <div>{i.name}</div>
            <Row l={`  ${i.qty} x ${rp(i.price)}`} r={rp(i.qty * i.price)} />
          </div>
        ))}
        <div className="my-1.5 border-t border-dashed border-[#2b2620]/50" />
        <Row l="Subtotal" r={rp(subtotal)} />
        {taxLines.map((t) => (
          <Row key={t.label} l={t.label} r={rp(t.amount)} />
        ))}
        <Row l="TOTAL" r={rp(total)} bold />
        <div className="my-1.5 border-t border-dashed border-[#2b2620]/50" />
        <div className="text-center">
          {receipt.footer && <div className="whitespace-pre-line break-words">{receipt.footer}</div>}
          {receipt.instagram && <div>IG @{receipt.instagram.replace(/^@+/, "")}</div>}
        </div>
      </div>
    </figure>
  );
}

// ——— Outlet: transaksi ———

function TransactionSection({ rec, onRecord, credit }: OutletProps & { credit: boolean }) {
  const uid = useId();
  const settings = settingsOf(rec);
  const { draft, setDraft, dirty, reset } = useDraft<TransactionSettings>(readTransaction(settings));
  const saver = useSaver(onRecord);
  const set = <K extends keyof TransactionSettings>(k: K, v: TransactionSettings[K]) => setDraft({ ...draft, [k]: v });
  const typesErr = draft.order_types !== null && draft.order_types.length === 0 ? "Pilih minimal satu jenis pesanan." : undefined;
  return (
    <EditSection
      id="transaksi"
      title="Transaksi"
      description="Aturan di layar kasir outlet ini."
      dirty={dirty}
      saving={saver.saving}
      canSave={!typesErr}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={() =>
        saver.run(
          () => saveRecord("outlets", rec.id, rec, { settings: mergeSection(settings, "transaction", draft) }),
          "Pengaturan transaksi disimpan.",
          (r) => setDraft(readTransaction(settingsOf(r as Rec)))
        )
      }
    >
      <div>
        <Switch
          id={`${uid}-types-default`}
          label="Jenis pesanan bawaan"
          description="Ikuti bawaan jenis usaha. Matikan untuk memilih sendiri jenis pesanan yang muncul di kasir."
          checked={draft.order_types === null}
          onChange={(v) => set("order_types", v ? null : ["dine_in", "takeaway"])}
        />
        {draft.order_types !== null && (
          <div className="mt-3">
            <ChipGroup label="Jenis pesanan" options={ORDER_TYPE_OPTIONS} selected={draft.order_types} onChange={(v) => set("order_types", sortTypes(v))} />
            {typesErr && (
              <p className="mt-1.5 text-[13px] text-danger" role="alert">
                {typesErr}
              </p>
            )}
          </div>
        )}
      </div>
      <Switch id={`${uid}-queue`} label="Nomor antrean" description="Cetak nomor antrean di struk & layar dapur." checked={draft.queue_number} onChange={(v) => set("queue_number", v)} />
      <div>
        <Switch
          id={`${uid}-credit`}
          label="Izinkan kasbon"
          description={credit ? "Kasir boleh menyimpan transaksi belum lunas atas nama pelanggan." : "Fitur Pro."}
          checked={draft.allow_credit}
          disabled={!credit}
          onChange={(v) => set("allow_credit", v)}
        />
        {!credit && (
          <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-text-muted">
            <Lock size={13} aria-hidden /> Kasbon tersedia di paket Pro.
          </p>
        )}
      </div>
      <Switch id={`${uid}-pin`} label="PIN pemilik untuk membatalkan" description="Void & refund oleh kasir butuh PIN pemilik." checked={draft.pin_for_void} onChange={(v) => set("pin_for_void", v)} />
      <Switch
        id={`${uid}-blind`}
        label="Tutup kasir tanpa melihat kas seharusnya"
        description="Kasir menghitung uang laci tanpa melihat angka sistem (tutup buta)."
        checked={draft.blind_close}
        onChange={(v) => set("blind_close", v)}
      />
      <Switch
        id={`${uid}-name`}
        label="Wajib nama pelanggan"
        description="Kasir harus mengisi nama pelanggan sebelum membayar."
        checked={draft.require_customer_name}
        onChange={(v) => set("require_customer_name", v)}
      />
    </EditSection>
  );
}

// ——— Outlet: metode pembayaran (hanya baca) ———

// ——— Usaha: loyalti ———

type BizProps = { rec: Rec | null; businessId: string; onRecord: (r: SyncRecord) => void };

function saveBusiness(rec: Rec | null, businessId: string, settings: Obj) {
  return saveRecord("business_settings", businessId, rec, { settings });
}

function LoyaltySection({ rec, businessId, onRecord }: BizProps) {
  const uid = useId();
  const settings = settingsOf(rec);
  const { draft, setDraft, dirty, reset } = useDraft<Loyalty>(readLoyalty(settings));
  const saver = useSaver(onRecord);
  const set = <K extends keyof Loyalty>(k: K, v: Loyalty[K]) => setDraft({ ...draft, [k]: v });
  const intErr = (v: number, max = 1_000_000_000) => (!Number.isFinite(v) || v < 0 || v > max ? "Angka tidak sah." : undefined);
  const e = { ppt: intErr(draft.points_per_thousand, 1_000_000), min: intErr(draft.min_redeem), value: intErr(draft.point_value) };
  const tierErrs = draft.tiers.map((t) => ({
    name: !t.name.trim() ? "Nama wajib diisi." : t.name.trim().length > 30 ? "Maksimal 30 huruf." : undefined,
    min: intErr(t.min_points),
    disc: !Number.isFinite(t.discount_bp) || t.discount_bp > 10000 ? "0–100%." : undefined,
  }));
  const valid = !e.ppt && !e.min && !e.value && tierErrs.every((t) => !t.name && !t.min && !t.disc);
  const updateTier = (i: number, patch: Partial<Loyalty["tiers"][number]>) => set("tiers", draft.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <EditSection
      id="loyalti"
      title="Loyalti member"
      description="Member mengumpulkan poin dari transaksi lunas dan menukarnya sebagai potongan."
      dirty={dirty}
      saving={saver.saving}
      canSave={valid}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={() =>
        saver.run(
          () => {
            const tiers = [...draft.tiers].map((t) => ({ ...t, name: t.name.trim() })).sort((a, b) => a.min_points - b.min_points);
            return saveBusiness(rec, businessId, mergeSection(settings, "loyalty", { ...draft, tiers: mergeTiers(settings, tiers) }));
          },
          "Pengaturan loyalti disimpan.",
          (r) => setDraft(readLoyalty(settingsOf(r as Rec)))
        )
      }
    >
      <Switch id={`${uid}-on`} label="Aktifkan poin loyalti" checked={draft.enabled} onChange={(v) => set("enabled", v)} />
      {draft.enabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id={`${uid}-ppt`} label="Poin per Rp1.000" error={e.ppt} hint="Poin = ⌊total ÷ 1.000⌋ × angka ini.">
              <NumberInput id={`${uid}-ppt`} value={draft.points_per_thousand} invalid={!!e.ppt} suffix="poin" onChange={(v) => set("points_per_thousand", v)} />
            </Field>
            <Field id={`${uid}-min`} label="Minimal tukar" error={e.min}>
              <NumberInput id={`${uid}-min`} value={draft.min_redeem} invalid={!!e.min} suffix="poin" onChange={(v) => set("min_redeem", v)} />
            </Field>
            <Field id={`${uid}-value`} label="Nilai 1 poin" error={e.value}>
              <NumberInput id={`${uid}-value`} value={draft.point_value} invalid={!!e.value} prefix="Rp" onChange={(v) => set("point_value", v)} />
            </Field>
          </div>
          {Number.isFinite(draft.points_per_thousand) && Number.isFinite(draft.point_value) && (
            <p className="text-[12.5px] text-text-muted">
              Contoh: belanja {formatRupiah(50_000)} → {(50 * draft.points_per_thousand).toLocaleString("id-ID")} poin (senilai{" "}
              {formatRupiah(50 * draft.points_per_thousand * draft.point_value)}).
            </p>
          )}

          <div>
            <p className="text-[13px] font-semibold text-text-heading">Tingkat member</p>
            <p className="mb-2 text-[12.5px] text-text-muted">Diskon otomatis menurut poin seumur hidup. Kosongkan bila tidak dipakai.</p>
            {draft.tiers.length > 0 && (
              <ul className="mb-3 flex flex-col gap-3">
                {draft.tiers.map((t, i) => (
                  <li key={t.id} className="grid grid-cols-2 items-end gap-3 rounded-[12px] border border-border-subtle p-3 sm:grid-cols-[1fr_160px_130px_auto]">
                    <Field id={`${uid}-tier-${i}-name`} label="Nama" error={tierErrs[i].name} className="col-span-2 sm:col-span-1">
                      <input
                        id={`${uid}-tier-${i}-name`}
                        className={inputClass}
                        value={t.name}
                        maxLength={30}
                        placeholder="Silver"
                        aria-invalid={!!tierErrs[i].name || undefined}
                        onChange={(ev) => updateTier(i, { name: ev.target.value })}
                      />
                    </Field>
                    <Field id={`${uid}-tier-${i}-min`} label="Mulai dari" error={tierErrs[i].min}>
                      <NumberInput id={`${uid}-tier-${i}-min`} value={t.min_points} suffix="poin" invalid={!!tierErrs[i].min} onChange={(v) => updateTier(i, { min_points: v })} />
                    </Field>
                    <Field id={`${uid}-tier-${i}-disc`} label="Diskon" error={tierErrs[i].disc}>
                      <NumberInput id={`${uid}-tier-${i}-disc`} kind="percent" suffix="%" value={t.discount_bp} invalid={!!tierErrs[i].disc} onChange={(v) => updateTier(i, { discount_bp: v })} />
                    </Field>
                    <button
                      type="button"
                      className={`${iconBtn} mb-0.5 hover:text-danger`}
                      onClick={() => set("tiers", draft.tiers.filter((_, j) => j !== i))}
                      aria-label={`Hapus tingkat ${t.name}`.trim()}
                      title="Hapus tingkat"
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className={btn.secondary}
              disabled={draft.tiers.length >= 10}
              onClick={() => set("tiers", [...draft.tiers, { id: newId(), name: "", min_points: 500, discount_bp: 500 }])}
            >
              <Plus size={16} aria-hidden /> Tambah tingkat
            </button>
          </div>
        </>
      )}
    </EditSection>
  );
}

// ——— Usaha: zona waktu ———

const TIMEZONE_INFO: Record<TimezoneChoice, { label: string; regions: string }> = {
  "Asia/Jakarta": { label: "WIB — Waktu Indonesia Barat (UTC+7)", regions: "Sumatera, Jawa, Kalimantan Barat & Tengah" },
  "Asia/Makassar": { label: "WITA — Waktu Indonesia Tengah (UTC+8)", regions: "Bali, NTB, NTT, Kalimantan Selatan/Timur/Utara, Sulawesi" },
  "Asia/Jayapura": { label: "WIT — Waktu Indonesia Timur (UTC+9)", regions: "Maluku, Maluku Utara, Papua" },
};
const TIMEZONE_OPTIONS = TIMEZONE_CHOICES.map((v) => ({ value: v, label: TIMEZONE_INFO[v].label, description: TIMEZONE_INFO[v].regions }));

/**
 * Zona waktu usaha (`settings.timezone`): dipakai server & dasbor untuk menentukan hari/jam laporan. Setelah disimpan,
 * sesi dimuat ulang agar `business.timezone` dan seluruh dasbor ikut berubah.
 */
function TimezoneSection({ rec, businessId, onRecord }: BizProps) {
  const uid = useId();
  const { refreshSession } = useOwner();
  const toast = useToast();
  const settings = settingsOf(rec);
  const { draft, setDraft, dirty, reset } = useDraft<TimezoneChoice>(readTimezone(settings));
  const saver = useSaver(onRecord);
  return (
    <EditSection
      id="zona-waktu"
      title="Zona waktu"
      description="Menentukan batas hari & jam pada laporan, ringkasan hari ini, dan periode di dasbor ini."
      dirty={dirty}
      saving={saver.saving}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={async () => {
        let applied = false;
        await saver.run(
          async () => {
            const r = await saveBusiness(rec, businessId, { ...settings, timezone: draft });
            applied = r.status === "applied";
            return r;
          },
          "Zona waktu disimpan.",
          (r) => setDraft(readTimezone(settingsOf(r as Rec)))
        );
        if (!applied) return;
        try {
          await refreshSession();
        } catch {
          toast.error("Zona waktu tersimpan, tetapi dasbor belum diperbarui. Muat ulang halaman.");
        }
      }}
    >
      <Field id={`${uid}-tz`} label="Zona waktu usaha" hint={`Sekarang: ${zoneLabel()}. Aplikasi kasir tetap memakai jam perangkat — pastikan jam HP/tablet kasir di zona yang sama.`}>
        <Select id={`${uid}-tz`} className="max-w-[420px]" value={draft} onChange={setDraft} options={TIMEZONE_OPTIONS} />
      </Field>
    </EditSection>
  );
}

// ——— Usaha: aturan absensi ———

const WEEKDAY_OPTIONS = WEEKDAYS.map((label, i) => ({ value: i + 1, label }));

function AttendanceSection({ rec, businessId, onRecord }: BizProps) {
  const uid = useId();
  const settings = settingsOf(rec);
  const { draft, setDraft, dirty, reset } = useDraft<AttendanceRules>(readAttendance(settings));
  const saver = useSaver(onRecord);
  const set = <K extends keyof AttendanceRules>(k: K, v: AttendanceRules[K]) => setDraft({ ...draft, [k]: v });
  const startErr = !isHHMM(draft.work_start) ? "Jam tidak sah." : undefined;
  const endErr = !isHHMM(draft.work_end) ? "Jam tidak sah." : undefined;
  const tolErr = !Number.isFinite(draft.late_tolerance_min) || draft.late_tolerance_min > 240 ? "0–240 menit." : undefined;
  return (
    <EditSection
      id="absensi"
      title="Aturan absensi"
      description="Dipakai aplikasi untuk menandai terlambat & menghitung lembur saat karyawan absen dengan PIN."
      dirty={dirty}
      saving={saver.saving}
      canSave={!startErr && !endErr && !tolErr}
      error={saver.error}
      onReset={() => {
        reset();
        saver.clearError();
      }}
      onSave={() =>
        saver.run(
          () => saveBusiness(rec, businessId, mergeSection(settings, "attendance", { ...draft, off_days: [...draft.off_days].sort((a, b) => a - b) })),
          "Aturan absensi disimpan.",
          (r) => setDraft(readAttendance(settingsOf(r as Rec)))
        )
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id={`${uid}-start`} label="Jam masuk" error={startErr}>
          <input id={`${uid}-start`} type="time" className={`${inputClass} tabular-nums`} value={draft.work_start} aria-invalid={!!startErr || undefined} onChange={(e) => set("work_start", e.target.value)} />
        </Field>
        <Field id={`${uid}-end`} label="Jam pulang" error={endErr} hint="Menit setelah jam ini = lembur.">
          <input id={`${uid}-end`} type="time" className={`${inputClass} tabular-nums`} value={draft.work_end} aria-invalid={!!endErr || undefined} onChange={(e) => set("work_end", e.target.value)} />
        </Field>
        <Field id={`${uid}-tol`} label="Toleransi terlambat" error={tolErr}>
          <NumberInput id={`${uid}-tol`} value={draft.late_tolerance_min} suffix="mnt" invalid={!!tolErr} onChange={(v) => set("late_tolerance_min", v)} />
        </Field>
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-text-heading">Hari libur mingguan</p>
        <ChipGroup label="Hari libur mingguan" options={WEEKDAY_OPTIONS} selected={draft.off_days} onChange={(v) => set("off_days", [...v].sort((a, b) => a - b))} />
      </div>
    </EditSection>
  );
}
