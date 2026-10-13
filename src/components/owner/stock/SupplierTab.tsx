"use client";

import React, { useId, useMemo, useState } from "react";
import { MessageCircle, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { SearchBox, useQueryState } from "@/components/admin/filters";
import { useToast } from "@/components/admin/toast";
import { btn, cardClass, EmptyState, Field, iconBtn, inputClass, Notice, Spinner } from "@/components/admin/ui";
import { deleteChange, norm, resultFieldErrors } from "@/lib/owner/catalog";
import { commitRecord, CommitError, supplierData, waNumber, type Supplier, type SupplierDraft } from "@/lib/owner/stockOps";
import { newId } from "@/lib/owner/api";
import type { WritableEntity } from "@/lib/owner/types";
import { commitMessage } from "./parts";
import type { StockOps } from "./useStockOps";

// Supplier (`SuppliersScreen` aplikasi): daftar kontak pemasok untuk PO — tambah, ubah, hapus (PO lama tetap tersimpan),
// chat WhatsApp. Berlaku untuk seluruh usaha (bukan per outlet).

const SUPPLIERS = "suppliers" as WritableEntity;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SupplierTab({ ops }: { ops: StockOps }) {
  const qs = useQueryState();
  const toast = useToast();
  const q = qs.get("q");
  const data = ops.state.data!;
  const [editing, setEditing] = useState<{ s: Supplier | null } | null>(null);
  const [removing, setRemoving] = useState<Supplier | null>(null);
  const [busy, setBusy] = useState(false);
  const poCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of data.pos) if (p.supplier_id) m.set(p.supplier_id, (m.get(p.supplier_id) ?? 0) + 1);
    return m;
  }, [data.pos]);
  const list = useMemo(() => {
    const needle = norm(q);
    return [...data.suppliers]
      .filter((s) => !needle || norm(`${s.name} ${s.phone ?? ""} ${s.email ?? ""}`).includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }));
  }, [data.suppliers, q]);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      ops.put("suppliers", await commitRecord(deleteChange(SUPPLIERS, removing)));
      setRemoving(null);
    } catch (err) {
      if (err instanceof CommitError && err.result?.status === "conflict" && err.result.record) ops.put("suppliers", err.result.record);
      toast.error(commitMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SearchBox id="supplier-search" label="Cari supplier" placeholder="Cari supplier" value={q} onSearch={(v) => qs.update({ q: v || null }, "replace")} className="sm:w-[300px]" />
        <button type="button" className={btn.primary} onClick={() => setEditing({ s: null })}>
          <Plus size={16} aria-hidden /> Supplier baru
        </button>
      </div>
      <section className={`${cardClass} overflow-hidden`}>
        {list.length === 0 ? (
          <EmptyState icon={<Truck size={22} aria-hidden />} title={data.suppliers.length ? "Tidak ada yang cocok" : "Belum ada supplier"}>
            {data.suppliers.length ? "Ubah kata kunci." : "Simpan kontak pemasok agar pesanan pembelian bisa dikirim lewat WhatsApp."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map((s) => {
              const wa = waNumber(s.phone);
              return (
                <li key={s.id} className="flex items-start gap-3 px-4 py-3 sm:px-5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-text-heading">{s.name}</span>
                    <span className="block text-[13px] text-text-muted">
                      {[s.phone, s.email, poCount.get(s.id) ? `${poCount.get(s.id)} PO` : null].filter(Boolean).join(" · ") || "—"}
                    </span>
                    {s.address && <span className="block text-[12.5px] text-text-muted">{s.address}</span>}
                    {s.notes && <span className="block text-[12.5px] text-text-muted italic">{s.notes}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}?text=${encodeURIComponent(`Halo ${s.name}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={iconBtn}
                        aria-label={`Chat WhatsApp ${s.name}`}
                        title="Chat WhatsApp"
                      >
                        <MessageCircle size={16} aria-hidden />
                      </a>
                    )}
                    <button type="button" className={iconBtn} aria-label={`Ubah ${s.name}`} title="Ubah supplier" onClick={() => setEditing({ s })}>
                      <Pencil size={16} aria-hidden />
                    </button>
                    <button type="button" className={`${iconBtn} hover:text-danger`} aria-label={`Hapus ${s.name}`} title="Hapus" onClick={() => setRemoving(s)}>
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {editing && <SupplierForm key={editing.s?.id ?? "new"} supplier={editing.s} ops={ops} onClose={() => setEditing(null)} />}
      <ConfirmDialog open={!!removing} title="Hapus supplier?" confirmLabel="Hapus" tone="danger" busy={busy} onConfirm={remove} onClose={() => setRemoving(null)}>
        {removing?.name} dihapus dari daftar. PO lama tetap tersimpan.
      </ConfirmDialog>
    </>
  );
}

function SupplierForm({ supplier, ops, onClose }: { supplier: Supplier | null; ops: StockOps; onClose: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<SupplierDraft>({
    name: supplier?.name ?? "",
    phone: supplier?.phone ?? "",
    email: supplier?.email ?? "",
    address: supplier?.address ?? "",
    notes: supplier?.notes ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const ids = { name: useId(), phone: useId(), email: useId(), address: useId(), notes: useId() };
  const set = (k: keyof SupplierDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));

  async function save() {
    const e: Record<string, string> = {};
    if (!d.name.trim()) e.name = "Wajib diisi";
    if (d.email.trim() && !EMAIL.test(d.email.trim())) e.email = "Format email tidak valid";
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const data = supplierData(d);
      const rec = await commitRecord(
        supplier ? { entity: SUPPLIERS, op: "upsert", id: supplier.id, data, base_updated_at: supplier.updated_at } : { entity: SUPPLIERS, op: "upsert", id: newId(), data }
      );
      ops.put("suppliers", rec);
      toast.success(`Supplier ${data.name} disimpan`);
      onClose();
    } catch (err) {
      if (err instanceof CommitError && err.result) {
        if (err.result.status === "conflict" && err.result.record) ops.put("suppliers", err.result.record);
        const fe = resultFieldErrors(err.result);
        if (Object.keys(fe).some((k) => k !== "_")) setErrors(fe);
      }
      setErrors((x) => ({ ...x, _: commitMessage(err) }));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title={supplier ? "Ubah supplier" : "Supplier baru"}
      onClose={() => !busy && onClose()}
      dismissible={!busy}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose} disabled={busy}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={save} disabled={busy}>
            {busy && <Spinner />} Simpan
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {errors._ && (
          <Notice tone="danger" role="alert">
            {errors._}
          </Notice>
        )}
        <Field id={ids.name} label="Nama supplier" error={errors.name}>
          <input id={ids.name} className={inputClass} maxLength={80} placeholder="Mis. Toko Makmur" value={d.name} onChange={set("name")} aria-invalid={!!errors.name || undefined} autoFocus />
        </Field>
        <Field id={ids.phone} label="No. HP / WhatsApp" error={errors.phone}>
          <input id={ids.phone} className={inputClass} type="tel" maxLength={20} placeholder="08xx" value={d.phone} onChange={set("phone")} />
        </Field>
        <Field id={ids.email} label="Email (opsional)" error={errors.email}>
          <input id={ids.email} className={inputClass} type="email" maxLength={120} value={d.email} onChange={set("email")} aria-invalid={!!errors.email || undefined} />
        </Field>
        <Field id={ids.address} label="Alamat (opsional)" error={errors.address}>
          <input id={ids.address} className={inputClass} maxLength={200} value={d.address} onChange={set("address")} />
        </Field>
        <Field id={ids.notes} label="Catatan (opsional)" error={errors.notes}>
          <textarea id={ids.notes} className={`${inputClass} min-h-20 py-2`} maxLength={500} placeholder="Mis. kirim tiap Senin, minimal order 10 kg" value={d.notes} onChange={set("notes")} />
        </Field>
      </div>
    </Modal>
  );
}
