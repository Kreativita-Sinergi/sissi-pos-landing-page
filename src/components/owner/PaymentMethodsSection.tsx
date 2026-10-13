"use client";

import React, { useId, useRef, useState } from "react";
import { AlertTriangle, ImageUp, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { btn, Field, iconBtn, inputClass, Notice, Spinner, Switch } from "@/components/admin/ui";
import { QrCode } from "@/components/self-order/QrCode";
import { newId } from "@/lib/owner/api";
import { checkQris, qrisProblemText, readQrFromImage } from "@/lib/owner/qris";
import { saveRecord } from "@/lib/owner/records";
import {
  type BankAccount,
  MAX_BANK_ACCOUNTS,
  mergePaymentMethods,
  type Obj,
  type PaymentMethods,
  qrisHasCode,
  type QrisSettings,
  readPaymentMethods,
} from "@/lib/owner/settings";
import type { SyncRecord } from "@/lib/owner/types";
import { PHOTO_ACCEPT, uploadProductPhoto } from "@/lib/owner/upload";
import { useSensitiveAction } from "./ConfirmIdentityDialog";
import { EditSection, useDraft, useSaver } from "./editing";

// Pengaturan › Metode pembayaran (outlet): tunai (selalu), QRIS statis, kartu, transfer + rekening tujuan. Label &
// validasi mengikuti app (payment_methods_section.dart, qris_settings_fields.dart, bank_account_dialog.dart).
// QRIS & rekening menentukan ke mana uang pelanggan dibayar, jadi server meminta konfirmasi password (≤ 10 menit)
// sebelum menerima perubahan `settings.payment_methods` (422 `CONFIRM_REQUIRED:` → dialog → kirim ulang otomatis);
// perubahannya tercatat di Aktivitas › Perubahan data.

type Rec = SyncRecord & { settings?: unknown };

function settingsOf(rec: Rec): Obj {
  const s = rec.settings;
  return typeof s === "object" && s !== null && !Array.isArray(s) ? (s as Obj) : {};
}

const MONEY_NOTE = (
  <Notice tone="warning" icon={<AlertTriangle size={17} aria-hidden />} title="Ini mengubah tujuan uang pelanggan">
    <p className="text-[13.5px]">
      Pelanggan membayar ke QRIS & rekening di sini. Periksa nama merchant dan nomor rekening dengan teliti. Menyimpan meminta konfirmasi password, dan setiap
      perubahan tercatat di Aktivitas (Perubahan data).
    </p>
  </Notice>
);

/** Galat per isian (pesan app). */
function problems(d: PaymentMethods) {
  const payload = d.qris.payload.trim();
  const check = payload ? checkQris(payload) : null;
  const url = (d.qris.image_url ?? "").trim();
  let urlErr: string | undefined;
  if (url) {
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol) || !u.host) urlErr = "Tautan harus diawali http:// atau https://.";
    } catch {
      urlErr = "Tautan harus diawali http:// atau https://.";
    }
    if (!urlErr && url.length > 500) urlErr = "Maksimal 500 karakter.";
  }
  const qris = {
    merchant: d.qris.merchant_name.trim().length > 80 ? "Maksimal 80 karakter." : undefined,
    payload: payload.length > 1000 ? "Maksimal 1000 karakter." : check && check.problem ? qrisProblemText(check.problem, true) : undefined,
    url: urlErr,
  };
  const req = (v: string, max: number) => (!v.trim() ? "Wajib diisi." : v.trim().length > max ? `Maksimal ${max} karakter.` : undefined);
  const accounts = d.transfer.accounts.map((a) => ({
    bank: req(a.bank, 40),
    number: !a.number.trim() ? "Wajib diisi." : !/^\d+$/.test(a.number.trim()) ? "Hanya angka." : a.number.trim().length > 30 ? "Maksimal 30 karakter." : undefined,
    holder: req(a.holder, 80),
  }));
  const ok = !qris.merchant && !qris.payload && !qris.url && accounts.every((a) => !a.bank && !a.number && !a.holder);
  return { qris, accounts, ok };
}

function trimmed(d: PaymentMethods): PaymentMethods {
  return {
    qris: { ...d.qris, merchant_name: d.qris.merchant_name.trim(), payload: d.qris.payload.trim(), image_url: d.qris.image_url?.trim() || null },
    transfer: { ...d.transfer, accounts: d.transfer.accounts.map((a) => ({ ...a, bank: a.bank.trim(), number: a.number.trim(), holder: a.holder.trim() })) },
    card: d.card,
  };
}

export function PaymentMethodsSection({ rec, onRecord }: { rec: Rec; onRecord: (r: SyncRecord) => void }) {
  const uid = useId();
  const settings = settingsOf(rec);
  const { draft, setDraft, dirty, reset } = useDraft<PaymentMethods>(readPaymentMethods(settings));
  const saver = useSaver(onRecord);
  const sensitive = useSensitiveAction(MONEY_NOTE);
  const p = problems(draft);
  const setQris = (q: Partial<QrisSettings>) => setDraft({ ...draft, qris: { ...draft.qris, ...q } });
  const setAccount = (i: number, patch: Partial<BankAccount>) =>
    setDraft({ ...draft, transfer: { ...draft.transfer, accounts: draft.transfer.accounts.map((a, j) => (j === i ? { ...a, ...patch } : a)) } });

  return (
    <>
      <EditSection
        id="pembayaran"
        title="Metode pembayaran"
        description="Kasir hanya melihat metode yang aktif."
        aside={
          <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-text-muted">
            <ShieldCheck size={15} aria-hidden /> Perlu konfirmasi password
          </span>
        }
        dirty={dirty}
        saving={saver.saving}
        canSave={p.ok}
        error={saver.error}
        onReset={() => {
          reset();
          saver.clearError();
        }}
        onSave={() =>
          saver.run(
            () => sensitive.run(() => saveRecord("outlets", rec.id, rec, { settings: mergePaymentMethods(settings, trimmed(draft)) })),
            "Metode pembayaran disimpan.",
            (r) => setDraft(readPaymentMethods(settingsOf(r as Rec)))
          )
        }
      >
        {MONEY_NOTE}
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-[14px] font-semibold text-text-heading">Tunai</span>
            <span className="block text-[13px] text-text-muted">Selalu aktif</span>
          </span>
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          <Switch
            id={`${uid}-qris`}
            label="QRIS"
            description={draft.qris.enabled && !qrisHasCode(draft.qris) ? "Kode QR belum diisi" : "QRIS statis · kasir mengonfirmasi pembayaran masuk"}
            checked={draft.qris.enabled}
            onChange={(v) => setQris({ enabled: v })}
          />
          {draft.qris.enabled && <QrisFields uid={uid} qris={draft.qris} errors={p.qris} onChange={setQris} />}
        </div>

        <div className="border-t border-border-subtle pt-4">
          <Switch
            id={`${uid}-card`}
            label="Kartu"
            description="Dibayar lewat mesin EDC"
            checked={draft.card.enabled}
            onChange={(v) => setDraft({ ...draft, card: { ...draft.card, enabled: v } })}
          />
        </div>

        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
          <Switch
            id={`${uid}-transfer`}
            label="Transfer"
            description="Transfer ke rekening toko"
            checked={draft.transfer.enabled}
            onChange={(v) => setDraft({ ...draft, transfer: { ...draft.transfer, enabled: v } })}
          />
          {draft.transfer.enabled && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-text-heading">Rekening tujuan</p>
              {draft.transfer.accounts.length === 0 ? (
                <p className="mb-3 text-[13.5px] text-text-muted">Belum ada rekening. Tambahkan agar kasir bisa menunjukkannya ke pelanggan.</p>
              ) : (
                <ul className="mb-3 flex flex-col gap-3">
                  {draft.transfer.accounts.map((a, i) => {
                    const e = p.accounts[i];
                    return (
                      <li key={a.id} className="grid grid-cols-[1fr_auto] items-start gap-x-3 gap-y-2 rounded-[12px] border border-border-subtle p-3 sm:grid-cols-[140px_1fr_1fr_auto] sm:items-end">
                        <Field id={`${uid}-acc-${i}-bank`} label="Bank" error={e.bank} className="col-span-2 sm:col-span-1">
                          <input
                            id={`${uid}-acc-${i}-bank`}
                            className={`${inputClass} uppercase`}
                            value={a.bank}
                            maxLength={40}
                            placeholder="Contoh: BCA"
                            aria-invalid={!!e.bank || undefined}
                            onChange={(ev) => setAccount(i, { bank: ev.target.value.toUpperCase() })}
                          />
                        </Field>
                        <Field id={`${uid}-acc-${i}-number`} label="Nomor rekening" error={e.number} className="col-span-2 sm:col-span-1">
                          <input
                            id={`${uid}-acc-${i}-number`}
                            className={`${inputClass} tabular-nums`}
                            value={a.number}
                            inputMode="numeric"
                            maxLength={30}
                            placeholder="Contoh: 1234567890"
                            aria-invalid={!!e.number || undefined}
                            onChange={(ev) => setAccount(i, { number: ev.target.value.replace(/\D/g, "") })}
                          />
                        </Field>
                        <Field id={`${uid}-acc-${i}-holder`} label="Atas nama" error={e.holder}>
                          <input
                            id={`${uid}-acc-${i}-holder`}
                            className={inputClass}
                            value={a.holder}
                            maxLength={80}
                            placeholder="Nama pemilik rekening"
                            aria-invalid={!!e.holder || undefined}
                            onChange={(ev) => setAccount(i, { holder: ev.target.value })}
                          />
                        </Field>
                        <div className="flex min-h-10 items-center justify-end self-end">
                          <button
                            type="button"
                            className={`${iconBtn} hover:text-danger`}
                            onClick={() => setDraft({ ...draft, transfer: { ...draft.transfer, accounts: draft.transfer.accounts.filter((_, j) => j !== i) } })}
                            aria-label={`Hapus rekening ${a.bank || ""} ${a.number || ""}`.replace(/\s+/g, " ").trim()}
                            title="Hapus rekening"
                          >
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={btn.secondary}
                  disabled={draft.transfer.accounts.length >= MAX_BANK_ACCOUNTS}
                  onClick={() => setDraft({ ...draft, transfer: { ...draft.transfer, accounts: [...draft.transfer.accounts, { id: newId(), bank: "", number: "", holder: "" }] } })}
                >
                  <Plus size={16} aria-hidden /> Tambah rekening
                </button>
                <p className="text-[12.5px] text-text-muted">Maksimal {MAX_BANK_ACCOUNTS} rekening.</p>
              </div>
            </div>
          )}
        </div>
      </EditSection>
      {sensitive.dialog}
    </>
  );
}

// ——— QRIS ———

function QrisFields({
  uid,
  qris,
  errors,
  onChange,
}: {
  uid: string;
  qris: QrisSettings;
  errors: { merchant?: string; payload?: string; url?: string };
  onChange: (q: Partial<QrisSettings>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const payload = qris.payload.trim();
  const valid = payload ? checkQris(payload).info : null;
  const [advanced, setAdvanced] = useState(() => (!!payload && !valid) || (!payload && !!qris.image_url));

  // Unggah gambar QRIS: kode dibaca di browser (BarcodeDetector) lalu diperiksa seperti app; gambarnya diunggah dan
  // disimpan sebagai `image_url` (cadangan bila teks kode tidak terbaca).
  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const read = await readQrFromImage(file);
      let next: Partial<QrisSettings> = {};
      if (read.text) {
        const check = checkQris(read.text);
        if (!check.info) {
          setError(qrisProblemText(check.problem));
          return;
        }
        next = { payload: check.info.payload };
        if (check.info.merchantName && !qris.merchant_name.trim()) next.merchant_name = check.info.merchantName;
        if (check.info.merchantName && qris.merchant_name.trim() && check.info.merchantName !== qris.merchant_name.trim()) {
          setInfo(`Nama di QRIS: "${check.info.merchantName}". Nama merchant yang diisi tetap dipakai — ubah bila perlu.`);
        }
      } else if (read.supported) {
        setError(qrisProblemText("invalid"));
        return;
      } else {
        setInfo("Browser ini tidak bisa membaca kode QR otomatis. Gambar tetap disimpan; agar kode bisa digambar ulang di aplikasi, tempel teks kode di \"Isi manual (lanjutan)\".");
      }
      const url = await uploadProductPhoto(file);
      onChange({ ...next, image_url: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gambar gagal diunggah.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-[12px] border border-border-subtle p-3 sm:p-4">
      {valid || qris.image_url ? (
        <div className="flex flex-wrap items-center gap-4">
          {valid ? (
            <QrCode value={valid.payload} label={`QRIS ${valid.merchantName || qris.merchant_name}`} size={132} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qris.image_url ?? ""} alt="Gambar QRIS" className="h-[132px] w-[132px] rounded-[12px] border border-border-subtle object-contain" />
          )}
          <div className="min-w-0 flex-1 text-[13.5px]">
            <p className="font-semibold text-text-heading">{valid ? "QRIS statis terbaca" : "Gambar QRIS tersimpan"}</p>
            <p className="text-text-body">{(valid?.merchantName || qris.merchant_name || "Nama merchant tidak tercantum").trim()}</p>
            {valid?.nmid && <p className="text-text-muted">NMID {valid.nmid}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className={btn.secondary} disabled={busy} onClick={() => fileRef.current?.click()}>
                {busy ? <Spinner /> : <ImageUp size={16} aria-hidden />} Ganti gambar
              </button>
              <button type="button" className={btn.ghost} disabled={busy} onClick={() => onChange({ payload: "", image_url: null })}>
                Hapus kode
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <p className="mb-2 text-[13.5px] text-text-body">Unggah foto atau screenshot QRIS toko. Kodenya dibaca otomatis, tidak perlu diketik.</p>
          <button type="button" className={btn.secondary} disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Spinner /> : <ImageUp size={16} aria-hidden />} Unggah gambar QRIS
          </button>
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Pilih gambar QRIS"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}
      {info && <Notice tone="info">{info}</Notice>}

      <Field id={`${uid}-merchant`} label="Nama merchant" hint="Sesuai yang tertera di QRIS" error={errors.merchant}>
        <input
          id={`${uid}-merchant`}
          className={inputClass}
          value={qris.merchant_name}
          maxLength={80}
          aria-invalid={!!errors.merchant || undefined}
          onChange={(e) => onChange({ merchant_name: e.target.value })}
        />
      </Field>

      <details open={advanced || !!errors.payload || !!errors.url} onToggle={(e) => setAdvanced((e.target as HTMLDetailsElement).open)}>
        <summary className="cursor-pointer text-[13px] font-semibold text-text-body">Isi manual (lanjutan)</summary>
        <div className="mt-3 flex flex-col gap-3">
          <Field id={`${uid}-payload`} label="Isi kode QRIS" hint="Tempel teks kode QR (diawali 000201…)" error={errors.payload}>
            <textarea
              id={`${uid}-payload`}
              className={`${inputClass} min-h-[72px] py-2 font-mono text-[12.5px]`}
              value={qris.payload}
              maxLength={1000}
              aria-invalid={!!errors.payload || undefined}
              onChange={(e) => {
                const text = e.target.value;
                const found = checkQris(text).info;
                onChange(found?.merchantName && !qris.merchant_name.trim() ? { payload: text, merchant_name: found.merchantName } : { payload: text });
              }}
            />
          </Field>
          <Field id={`${uid}-img`} label="Tautan gambar QR (opsional)" error={errors.url}>
            <input
              id={`${uid}-img`}
              className={inputClass}
              value={qris.image_url ?? ""}
              maxLength={500}
              placeholder="https://…"
              aria-invalid={!!errors.url || undefined}
              onChange={(e) => onChange({ image_url: e.target.value || null })}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}
