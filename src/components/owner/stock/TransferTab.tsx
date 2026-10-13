"use client";

import React, { useId, useMemo, useState } from "react";
import { ArrowLeftRight, Plus, X } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useQueryState } from "@/components/admin/filters";
import { useToast } from "@/components/admin/toast";
import { btn, cardClass, EmptyState, Field, focusRing, iconBtn, inputClass, Notice, Spinner, Switch, tdClass, thClass, useLoad } from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { parseQty } from "@/lib/owner/catalog";
import {
  asTransfer,
  commitFollow,
  commitRecord,
  CommitError,
  itemKey,
  qtyWithUnit,
  refOfRow,
  transferCreateChange,
  transferMoves,
  transferStatusChange,
  type StockTransfer,
} from "@/lib/owner/stockOps";
import type { Change, StockRow } from "@/lib/owner/types";
import { formatStamp } from "@/lib/owner/tz";
import { Sheet } from "../catalog/bits";
import { useOwner } from "../OwnerShell";
import { Select } from "../Select";
import { commitMessage, ItemCell, ItemPicker, OutletPrompt, rowName, StatusBadge, TRANSFER_STATUS } from "./parts";
import type { StockOps } from "./useStockOps";

// Transfer stok antar outlet (`TransfersScreen` aplikasi): dari outlet terpilih ke outlet lain, status Menunggu →
// Selesai (dua gerakan `transfer` per baris: −qty di asal, +qty di tujuan, `ref_id` = transfer) atau Batal.
// "Langsung pindahkan stok" (bawaan aktif) = buat lalu selesaikan sekaligus.

export function TransferTab({ ops }: { ops: StockOps }) {
  const { outletId, session } = useOwner();
  const qs = useQueryState();
  const data = ops.state.data!;
  const docId = qs.get("doc");
  const [creating, setCreating] = useState(false);
  const many = session.outlets.length > 1;
  const name = (id: string) => session.outlets.find((o) => o.id === id)?.name ?? "—";
  const list = useMemo(
    () =>
      data.transfers
        .filter((t) => !outletId || t.from_outlet_id === outletId || t.to_outlet_id === outletId)
        .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? ""))),
    [data.transfers, outletId]
  );
  const open = docId ? data.transfers.find((t) => t.id === docId) : undefined;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-text-body">Pindahkan stok produk atau bahan baku dari outlet ini ke outlet lain.</p>
        {outletId && many && (
          <button type="button" className={btn.primary} onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> Transfer baru
          </button>
        )}
      </div>
      {!outletId && many && (
        <div className="mb-4">
          <OutletPrompt action="mencatat transfer (outlet asal)" />
        </div>
      )}

      <section className={`${cardClass} overflow-hidden`}>
        {list.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight size={22} aria-hidden />} title="Belum ada transfer stok">
            {many
              ? "Pindahkan stok produk atau bahan baku dari outlet ini ke outlet lain."
              : "Transfer butuh minimal dua outlet. Tambahkan outlet kedua lewat aplikasi Sissi; setelah tersinkron, stok bisa dipindahkan ke sana."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => qs.update({ doc: t.id })} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}>
                  <ArrowLeftRight size={18} aria-hidden className="mt-0.5 shrink-0 text-text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-text-heading">
                      {!outletId ? `${name(t.from_outlet_id)} → ${name(t.to_outlet_id)}` : t.from_outlet_id === outletId ? `Ke ${name(t.to_outlet_id)}` : `Dari ${name(t.from_outlet_id)}`}
                    </span>
                    <span className="block text-[13px] text-text-muted">
                      {[`${t.lines.length} barang`, formatStamp(t.completed_at ?? String(t.created_at ?? "")), ops.lookups.staff.get(t.employee_id)].filter(Boolean).join(" · ")}
                    </span>
                    {t.note && <span className="block text-[12.5px] text-text-muted">{t.note}</span>}
                  </span>
                  <StatusBadge s={TRANSFER_STATUS[t.status]} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {open && <TransferSheet key={open.id} t={open} ops={ops} from={name(open.from_outlet_id)} to={name(open.to_outlet_id)} onClose={() => qs.update({ doc: null })} />}
      {creating && outletId && (
        <TransferForm
          fromId={outletId}
          ops={ops}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            qs.update({ doc: id });
          }}
        />
      )}
    </>
  );
}

/** Selesaikan transfer: dokumen `completed` dulu, lalu gerakan −/+ setelah applied. */
async function completeTransfer(t: StockTransfer, employeeId: string, ops: StockOps): Promise<void> {
  const at = new Date().toISOString();
  ops.put("stock_transfers", await commitRecord(transferStatusChange(t, "completed", at)));
  await commitFollow(transferMoves(t, employeeId, at));
}

function TransferSheet({ t, ops, from, to, onClose }: { t: StockTransfer; ops: StockOps; from: string; to: string; onClose: () => void }) {
  const { session } = useOwner();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"complete" | "cancel" | null>(null);
  const [pending, setPending] = useState<Change[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof CommitError && err.result?.status === "conflict" && err.result.record) ops.put("stock_transfers", err.result.record);
      if (err instanceof CommitError && err.pending) setPending(err.pending);
      setError(commitMessage(err));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  return (
    <Sheet
      open
      title="Transfer stok"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge s={TRANSFER_STATUS[t.status]} />
          <span>
            {from} → {to}
          </span>
        </span>
      }
      onClose={onClose}
      busy={!!busy}
      footer={
        t.status === "pending" ? (
          <>
            <button type="button" className={`${btn.ghost} text-danger sm:mr-auto`} onClick={() => setConfirm("cancel")} disabled={!!busy}>
              Batalkan transfer
            </button>
            <button type="button" className={btn.primary} onClick={() => setConfirm("complete")} disabled={!!busy}>
              Selesaikan transfer
            </button>
          </>
        ) : pending ? (
          <button
            type="button"
            className={btn.primary}
            disabled={!!busy}
            onClick={() =>
              run("retry", async () => {
                await commitFollow(pending);
                setPending(null);
                toast.success("Stok dipindahkan");
              })
            }
          >
            {busy === "retry" && <Spinner />} Kirim ulang gerakan stok
          </button>
        ) : undefined
      }
    >
      <div className="space-y-4">
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <p className="text-[13.5px] text-text-muted">
          Dibuat {formatStamp(String(t.created_at ?? ""))}
          {ops.lookups.staff.get(t.employee_id) ? ` · ${ops.lookups.staff.get(t.employee_id)}` : ""}
          {t.completed_at ? ` · Selesai ${formatStamp(t.completed_at)}` : ""}
        </p>
        {t.note && <p className="text-[13.5px] text-text-body">{t.note}</p>}
        <div className="overflow-x-auto rounded-[12px] border border-border-subtle">
          <table className="w-full border-separate border-spacing-0 text-[14px]">
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  Barang
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody>
              {t.lines.map((l) => {
                const lb = ops.lookups.label(l);
                return (
                  <tr key={itemKey(l)}>
                    <td className={`${tdClass} border-b border-border-subtle`}>
                      <ItemCell name={lb.name} sub={lb.kind} />
                    </td>
                    <td className={`${tdClass} border-b border-border-subtle text-right whitespace-nowrap tabular-nums`}>{qtyWithUnit(l.qty, lb.unit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <ConfirmDialog
        open={confirm === "complete"}
        title="Selesaikan transfer?"
        confirmLabel="Selesaikan transfer"
        busy={busy === "complete"}
        onConfirm={() =>
          run("complete", async () => {
            await completeTransfer(t, session.user.id, ops);
            toast.success("Stok dipindahkan");
          })
        }
        onClose={() => setConfirm(null)}
      >
        Stok berkurang di {from} dan bertambah di {to}.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "cancel"}
        title="Batalkan transfer?"
        confirmLabel="Batalkan transfer"
        tone="danger"
        busy={busy === "cancel"}
        onConfirm={() =>
          run("cancel", async () => {
            ops.put("stock_transfers", await commitRecord(transferStatusChange(t, "canceled", new Date().toISOString())));
          })
        }
        onClose={() => setConfirm(null)}
      >
        Stok tidak dipindahkan.
      </ConfirmDialog>
    </Sheet>
  );
}

type Line = { row: StockRow; qty: string };

function TransferForm({ fromId, ops, onClose, onSaved }: { fromId: string; ops: StockOps; onClose: () => void; onSaved: (id: string) => void }) {
  const { session } = useOwner();
  const toast = useToast();
  const stock = useLoad<StockRow[]>(async (signal) => (await ownerApi()).stock({ outlet_id: fromId }, signal), [fromId]);
  const [to, setTo] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const [now, setNow] = useState(true);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<{ to?: string; items?: string; form?: string }>({});
  const tid = useId();
  const nid = useId();
  const swid = useId();
  const fromName = session.outlets.find((o) => o.id === fromId)?.name ?? "—";

  async function save() {
    const e: typeof errors = {};
    if (!to) e.to = "Pilih outlet tujuan";
    if (!lines.length) e.items = "Tambahkan minimal satu barang.";
    const parsed = lines.map((l) => ({ ...l, milli: l.qty.trim() ? parseQty(l.qty) : null }));
    if (!e.items && parsed.some((l) => !l.milli)) e.items = "Isi jumlah yang benar (mis. 2 atau 2,5)";
    // Tidak boleh memindahkan lebih dari stok outlet asal.
    const over = parsed.find((l) => l.milli && l.milli > l.row.qty);
    if (!e.items && over) e.items = `${rowName(over.row)}: Melebihi stok (${qtyWithUnit(Math.max(over.row.qty, 0), over.row.unit)})`;
    setErrors(e);
    if (e.to || e.items) return;
    setBusy(true);
    try {
      const change = transferCreateChange({
        from_outlet_id: fromId,
        to_outlet_id: to,
        lines: parsed.map((l) => ({ ...refOfRow(l.row), qty: l.milli! })),
        note,
        employee_id: session.user.id,
      });
      const rec = await commitRecord(change);
      ops.put("stock_transfers", rec);
      if (now && rec) {
        try {
          await completeTransfer(asTransfer(rec), session.user.id, ops);
        } catch (err) {
          // Transfer sudah tercatat; buka detailnya (bisa diselesaikan ulang bila masih Menunggu).
          toast.error(commitMessage(err));
          onSaved(change.id);
          return;
        }
      }
      toast.success(now ? "Stok dipindahkan" : "Transfer dicatat");
      onSaved(change.id);
    } catch (err) {
      setErrors({ form: commitMessage(err) });
      setBusy(false);
    }
  }

  const exclude = new Set(lines.map((l) => itemKey(refOfRow(l.row))));

  return (
    <Sheet
      open
      title="Transfer baru"
      subtitle={`Dari ${fromName}`}
      onClose={onClose}
      busy={busy}
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
      <div className="space-y-4">
        {errors.form && (
          <Notice tone="danger" role="alert">
            {errors.form}
          </Notice>
        )}
        <Field id={tid} label="Outlet tujuan" error={errors.to}>
          <Select
            id={tid}
            value={to}
            invalid={!!errors.to}
            placeholder="Pilih outlet tujuan"
            onChange={setTo}
            options={session.outlets.filter((o) => o.id !== fromId).map((o) => ({ value: o.id, label: o.name }))}
          />
        </Field>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">{lines.length} barang</p>
            <button type="button" className={`${btn.ghost} min-h-8 px-2 text-[13px] text-brand-ink`} onClick={() => setPicking(true)} disabled={!stock.state.data}>
              <Plus size={16} aria-hidden /> Tambah barang
            </button>
          </div>
          {errors.items && <p className="mb-2 text-[13px] text-danger">{errors.items}</p>}
          {lines.length > 0 && (
            <ul className="space-y-2">
              {lines.map((l, i) => (
                <li key={itemKey(refOfRow(l.row))} className="flex items-center gap-3 rounded-[12px] border border-border-subtle p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-text-heading">{rowName(l.row)}</p>
                    <p className="text-[12.5px] text-text-muted">Stok: {qtyWithUnit(l.row.qty, l.row.unit)}</p>
                  </div>
                  <span className="flex items-center gap-2">
                    <input
                      className={`${inputClass} w-[110px] text-right tabular-nums`}
                      inputMode="decimal"
                      aria-label={`Jumlah ${rowName(l.row)}`}
                      value={l.qty}
                      onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                    />
                    <span className="text-[13px] text-text-muted">{l.row.unit}</span>
                  </span>
                  <button type="button" className={iconBtn} aria-label={`Hapus ${rowName(l.row)}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                    <X size={16} aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <Switch id={swid} checked={now} onChange={setNow} label="Langsung pindahkan stok" description="Matikan bila barang masih di perjalanan; selesaikan saat tiba." />
        <Field id={nid} label="Catatan">
          <input id={nid} className={inputClass} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      <ItemPicker
        open={picking}
        rows={stock.state.data ?? []}
        exclude={exclude}
        onClose={() => setPicking(false)}
        onPick={(rows) => setLines((ls) => [...ls, ...rows.map((row) => ({ row, qty: "" }))])}
      />
    </Sheet>
  );
}

