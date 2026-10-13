"use client";

import React, { useId, useMemo, useState } from "react";
import { Ban, MessageCircle, PackageCheck, Pencil, Plus, Send, ShoppingCart, Trash2, X } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { SearchBox, useQueryState } from "@/components/admin/filters";
import { useToast } from "@/components/admin/toast";
import { btn, cardClass, EmptyState, Field, focusRing, formatRupiah, iconBtn, inputClass, Notice, Spinner, Tabs, tdClass, thClass, useLoad } from "@/components/admin/ui";
import { ownerApi, pullAll } from "@/lib/owner/api";
import { dayToIso, formatQty, isoToDay, norm, parseQty } from "@/lib/owner/catalog";
import {
  asPo,
  commitFollow,
  commitRecord,
  CommitError,
  itemKey,
  poClosed,
  poCreateChange,
  poDeleteChange,
  poLineTotal,
  poOpen,
  poRemaining,
  poStatusChange,
  poTotal,
  poUpdateChange,
  qtyWithUnit,
  receivePlan,
  refOfRow,
  stockMap,
  waNumber,
  type ItemRef,
  type PoLine,
  type PurchaseOrder,
  type RawMaterialRec,
} from "@/lib/owner/stockOps";
import type { Change, StockRow } from "@/lib/owner/types";
import { formatDate, formatStamp } from "@/lib/owner/tz";
import { MoneyInput, Sheet } from "../catalog/bits";
import { useOwner } from "../OwnerShell";
import { Select } from "../Select";
import { commitMessage, ItemCell, ItemPicker, OutletPrompt, PO_STATUS, StatusBadge } from "./parts";
import type { Lookups, StockOps } from "./useStockOps";

// Pembelian / PO (`PurchasesScreen`, `PurchaseOrderFormScreen`, `PurchaseOrderView` aplikasi): draf → dipesan → terima
// (boleh sebagian; gerakan `in` ber-`ref_id` = PO & `unit_cost`, catatan = nomor PO, rata-rata bergerak `avg_cost`
// bahan baku, `qty_received` & status partial/received). Batalkan untuk PO berjalan; hapus hanya draf/batal.

type Tab = "active" | "done";

export function PurchaseTab({ ops }: { ops: StockOps }) {
  const { outletId, session } = useOwner();
  const qs = useQueryState();
  const data = ops.state.data!;
  const docId = qs.get("doc");
  const tab: Tab = qs.get("po") === "done" ? "done" : "active";
  const q = qs.get("q");
  const [form, setForm] = useState<{ po: PurchaseOrder | null } | null>(null);
  const outletName = (id: string) => session.outlets.find((o) => o.id === id)?.name ?? "—";

  const scoped = useMemo(() => data.pos.filter((p) => !outletId || p.outlet_id === outletId), [data.pos, outletId]);
  const counts = { active: scoped.filter((p) => !poClosed(p.status)).length, done: scoped.filter((p) => poClosed(p.status)).length };
  const list = useMemo(() => {
    const needle = norm(q);
    return scoped
      .filter((p) => (tab === "done" ? poClosed(p.status) : !poClosed(p.status)))
      .filter((p) => !needle || norm(p.number).includes(needle) || norm(ops.lookups.suppliers.get(p.supplier_id ?? "")?.name).includes(needle))
      .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  }, [scoped, tab, q, ops.lookups.suppliers]);
  const open = docId ? data.pos.find((p) => p.id === docId) : undefined;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[640px] text-[14px] text-text-body">
          Buat PO ke supplier, kirim lewat WhatsApp, lalu catat barang yang diterima — stok & harga rata-rata ikut diperbarui.
        </p>
        {outletId && (
          <button type="button" className={btn.primary} onClick={() => setForm({ po: null })}>
            <Plus size={16} aria-hidden /> PO baru
          </button>
        )}
      </div>
      {!outletId && (
        <div className="mb-4">
          <OutletPrompt action="membuat PO" />
        </div>
      )}

      <Tabs<Tab>
        label="Status PO"
        tabs={[
          { id: "active", label: "Berjalan", count: counts.active },
          { id: "done", label: "Selesai", count: counts.done },
        ]}
        active={tab}
        onChange={(t) => qs.update({ po: t === "done" ? "done" : null })}
      />
      <div className="mb-3">
        <SearchBox id="po-search" label="Cari nomor PO atau supplier" placeholder="Cari nomor PO atau supplier" value={q} onSearch={(v) => qs.update({ q: v || null }, "replace")} className="sm:w-[300px]" />
      </div>

      <section className={`${cardClass} overflow-hidden`}>
        {list.length === 0 ? (
          <EmptyState icon={<ShoppingCart size={22} aria-hidden />} title={scoped.length ? "Tidak ada yang cocok" : "Belum ada pesanan pembelian"}>
            {scoped.length ? "Ubah kata kunci atau tab." : "Buat PO ke supplier, kirim lewat WhatsApp, lalu catat barang yang diterima — stok & harga rata-rata ikut diperbarui."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => qs.update({ doc: p.id })} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-text-heading">{p.number}</span>
                    <span className="block text-[13px] text-text-muted">
                      {[
                        ops.lookups.suppliers.get(p.supplier_id ?? "")?.name ?? "Tanpa supplier",
                        `${p.lines.length} barang`,
                        p.ordered_at ? `Dipesan ${formatDate(p.ordered_at)}` : null,
                        outletId ? null : outletName(p.outlet_id),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge s={PO_STATUS[p.status]} />
                    <span className="text-[13px] font-semibold tabular-nums">{formatRupiah(poTotal(p.lines))}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {open && (
        <PoSheet
          key={open.id}
          po={open}
          ops={ops}
          outletName={outletName(open.outlet_id)}
          onClose={() => qs.update({ doc: null })}
          onEdit={() => setForm({ po: open })}
        />
      )}
      {form && (form.po || outletId) && (
        <PoForm
          po={form.po}
          outletId={form.po?.outlet_id ?? outletId!}
          outletName={outletName(form.po?.outlet_id ?? outletId!)}
          ops={ops}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            setForm(null);
            qs.update({ doc: id });
          }}
        />
      )}
    </>
  );
}

// ——— Detail ———

function poText(po: PurchaseOrder, store: string, lookups: Lookups): string {
  const supplier = lookups.suppliers.get(po.supplier_id ?? "");
  const out: string[] = [`Halo ${supplier?.name ?? ""}`.trim(), "", `Kami dari ${store} ingin memesan (PO ${po.number}):`];
  po.lines.forEach((l, i) => {
    const lb = lookups.label(l);
    out.push(`${i + 1}. ${lb.name} — ${qtyWithUnit(l.qty_ordered, lb.unit)}${l.unit_cost > 0 ? ` × ${formatRupiah(l.unit_cost)}` : ""}`);
  });
  const total = poTotal(po.lines);
  if (total > 0) out.push("", `Perkiraan total: ${formatRupiah(total)}`);
  if (po.expected_at) out.push(`Mohon dikirim sebelum ${formatDate(po.expected_at)}.`);
  if (po.note) out.push(po.note);
  out.push("", "Terima kasih.");
  return out.join("\n");
}

function PoSheet({ po, ops, outletName, onClose, onEdit }: { po: PurchaseOrder; ops: StockOps; outletName: string; onClose: () => void; onEdit: () => void }) {
  const { session } = useOwner();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [pending, setPending] = useState<Change[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supplier = ops.lookups.suppliers.get(po.supplier_id ?? "");
  const showReceived = po.status === "partial" || po.status === "received";

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof CommitError && err.result?.status === "conflict" && err.result.record) ops.put("purchase_orders", err.result.record);
      if (err instanceof CommitError && err.pending) setPending(err.pending);
      setError(commitMessage(err));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  const markOrdered = () =>
    run("order", async () => {
      ops.put("purchase_orders", await commitRecord(poStatusChange(po, "ordered")));
      toast.success(`PO ${po.number} disimpan`);
    });
  const cancel = () =>
    run("cancel", async () => {
      ops.put("purchase_orders", await commitRecord(poStatusChange(po, "canceled")));
    });
  const remove = () =>
    run("delete", async () => {
      ops.put("purchase_orders", await commitRecord(poDeleteChange(po)));
      onClose();
    });
  const retry = () =>
    run("retry", async () => {
      if (!pending) return;
      const results = await commitFollow(pending);
      for (const r of results) if (r.entity === "raw_materials") ops.put("raw_materials", r.record);
      setPending(null);
      toast.success("Gerakan stok terkirim");
    });

  const wa = `https://wa.me/${waNumber(supplier?.phone)}?text=${encodeURIComponent(poText(po, session.business.name, ops.lookups))}`;

  return (
    <Sheet
      open
      wide
      title={po.number}
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge s={PO_STATUS[po.status]} />
          <span>{[supplier?.name ?? "Tanpa supplier", outletName].join(" · ")}</span>
        </span>
      }
      onClose={onClose}
      busy={!!busy}
      footer={
        <>
          {(po.status === "draft" || po.status === "canceled") && (
            <button type="button" className={`${btn.ghost} text-danger sm:mr-auto`} onClick={() => setConfirm("delete")} disabled={!!busy}>
              <Trash2 size={16} aria-hidden /> Hapus
            </button>
          )}
          {poOpen(po.status) && (
            <button type="button" className={`${btn.ghost} text-danger sm:mr-auto`} onClick={() => setConfirm("cancel")} disabled={!!busy}>
              <Ban size={16} aria-hidden /> Batalkan PO
            </button>
          )}
          <a href={wa} target="_blank" rel="noopener noreferrer" className={btn.secondary}>
            <MessageCircle size={16} aria-hidden /> Kirim ke WhatsApp
          </a>
          {po.status === "draft" && (
            <>
              <button type="button" className={btn.secondary} onClick={onEdit} disabled={!!busy}>
                <Pencil size={16} aria-hidden /> Ubah
              </button>
              <button type="button" className={btn.primary} onClick={markOrdered} disabled={!!busy}>
                {busy === "order" ? <Spinner /> : <Send size={16} aria-hidden />} Tandai dipesan
              </button>
            </>
          )}
          {poOpen(po.status) && (
            <button type="button" className={btn.primary} onClick={() => setReceiving(true)} disabled={!!busy}>
              <PackageCheck size={16} aria-hidden /> Terima barang
            </button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Notice tone="danger" role="alert">
            <p>{error}</p>
            {pending && (
              <button type="button" className={`${btn.secondary} mt-2`} onClick={retry} disabled={!!busy}>
                {busy === "retry" && <Spinner />} Kirim ulang gerakan stok
              </button>
            )}
          </Notice>
        )}
        <dl className="grid grid-cols-2 gap-3 rounded-[12px] bg-bg-muted p-3 text-[13.5px] sm:grid-cols-3">
          <div>
            <dt className="text-[12px] text-text-muted">Supplier</dt>
            <dd className="font-semibold">{supplier?.name ?? "Tanpa supplier"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-text-muted">Dipesan</dt>
            <dd className="font-semibold">{po.ordered_at ? formatStamp(po.ordered_at) : "—"}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-text-muted">Perkiraan tiba</dt>
            <dd className="font-semibold">{po.expected_at ? formatDate(po.expected_at) : "Belum ditentukan"}</dd>
          </div>
        </dl>
        {po.note && <p className="text-[13.5px] text-text-body">{po.note}</p>}
        <div className="overflow-x-auto rounded-[12px] border border-border-subtle">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[14px]">
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  Barang
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Jumlah
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Harga
                </th>
                {showReceived && (
                  <th scope="col" className={`${thClass} text-right`}>
                    Diterima
                  </th>
                )}
                <th scope="col" className={`${thClass} text-right`}>
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => {
                const lb = ops.lookups.label(l);
                return (
                  <tr key={itemKey(l)}>
                    <td className={`${tdClass} border-b border-border-subtle`}>
                      <ItemCell name={lb.name} sub={lb.kind} />
                    </td>
                    <td className={`${tdClass} border-b border-border-subtle text-right whitespace-nowrap tabular-nums`}>{qtyWithUnit(l.qty_ordered, lb.unit)}</td>
                    <td className={`${tdClass} border-b border-border-subtle text-right whitespace-nowrap tabular-nums`}>{formatRupiah(l.unit_cost)}</td>
                    {showReceived && (
                      <td className={`${tdClass} border-b border-border-subtle text-right whitespace-nowrap tabular-nums ${poRemaining(l) === 0 ? "text-success" : ""}`}>
                        {formatQty(l.qty_received)}/{formatQty(l.qty_ordered)} diterima
                      </td>
                    )}
                    <td className={`${tdClass} border-b border-border-subtle text-right whitespace-nowrap tabular-nums`}>{formatRupiah(poLineTotal(l))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="flex justify-between text-[15px] font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatRupiah(poTotal(po.lines))}</span>
        </p>
      </div>

      {receiving && (
        <ReceiveModal
          po={po}
          ops={ops}
          onClose={() => setReceiving(false)}
          onPending={(p, msg) => {
            setPending(p);
            setError(msg);
          }}
        />
      )}
      <ConfirmDialog open={confirm === "cancel"} title="Batalkan PO?" confirmLabel="Batalkan PO" tone="danger" busy={busy === "cancel"} onConfirm={cancel} onClose={() => setConfirm(null)}>
        Barang yang belum diterima tidak akan dipesan lagi. Stok yang sudah diterima tetap.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "delete"} title="Hapus PO?" confirmLabel="Hapus" tone="danger" busy={busy === "delete"} onConfirm={remove} onClose={() => setConfirm(null)}>
        Draf {po.number} dihapus.
      </ConfirmDialog>
    </Sheet>
  );
}

// ——— Terima barang ———

function ReceiveModal({ po, ops, onClose, onPending }: { po: PurchaseOrder; ops: StockOps; onClose: () => void; onPending: (p: Change[], msg: string) => void }) {
  const { session } = useOwner();
  const toast = useToast();
  const lines = po.lines.filter((l) => poRemaining(l) > 0);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((l) => [itemKey(l), formatQty(poRemaining(l))])));
  const [cost, setCost] = useState<Record<string, number | null>>(() => Object.fromEntries(lines.map((l) => [itemKey(l), l.unit_cost])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const received = new Map<string, number>();
    const costs = new Map<string, number>();
    for (const l of lines) {
      const key = itemKey(l);
      const t = qty[key]?.trim() ?? "";
      const v = t ? parseQty(t) : 0;
      if (v === null) return setError("Isi jumlah yang benar (mis. 2 atau 2,5)");
      if (v > poRemaining(l)) return setError(`Melebihi sisa (${formatQty(poRemaining(l))})`);
      if (v > 0) received.set(key, v);
      const c = cost[key];
      if (c !== null && c !== undefined) costs.set(key, c);
    }
    if (!received.size) return setError("Isi jumlah barang yang diterima.");
    setBusy(true);
    setError(null);
    try {
      // Rata-rata bergerak memakai bahan baku terbaru & stok total bisnis SEBELUM barang masuk.
      const needRaw = lines.some((l) => l.raw_material_id && received.has(itemKey(l)));
      const [pulled, totals] = needRaw
        ? await Promise.all([pullAll<RawMaterialRec>("raw_materials"), (await ownerApi()).stock({})])
        : [[] as RawMaterialRec[], [] as StockRow[]];
      // Tarikan menyembunyikan tulisan ~1 detik terakhir (SYNC_PULL_LAG) → pakai salinan lokal bila lebih baru.
      const materials = new Map(pulled.map((m) => [m.id, m]));
      for (const m of ops.state.data?.materials ?? []) {
        const p = materials.get(m.id);
        if (!p || Date.parse(m.updated_at) > Date.parse(p.updated_at)) materials.set(m.id, m);
      }
      const plan = receivePlan(po, {
        received,
        costs,
        employee_id: session.user.id,
        materials,
        totals: stockMap(totals),
      });
      if (!plan) return setError("Isi jumlah barang yang diterima.");
      ops.put("purchase_orders", await commitRecord(plan.record));
      try {
        const results = await commitFollow(plan.follow);
        for (const r of results) if (r.entity === "raw_materials") ops.put("raw_materials", r.record);
      } catch (err) {
        onPending(err instanceof CommitError && err.pending ? err.pending : plan.follow, commitMessage(err));
        onClose();
        return;
      }
      toast.success("Penerimaan dicatat, stok bertambah");
      onClose();
    } catch (err) {
      if (err instanceof CommitError && err.result?.status === "conflict" && err.result.record) ops.put("purchase_orders", err.result.record);
      setError(commitMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      title="Terima barang"
      description={`${po.number} · Isi jumlah yang datang sekarang (boleh sebagian).`}
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
      <div className="space-y-4">
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <button
          type="button"
          className={`${btn.ghost} -ml-2 min-h-8 px-2 text-[13px] text-brand-ink`}
          onClick={() => setQty(Object.fromEntries(lines.map((l) => [itemKey(l), formatQty(poRemaining(l))])))}
        >
          Terima semua
        </button>
        {lines.map((l) => {
          const key = itemKey(l);
          const lb = ops.lookups.label(l);
          return (
            <div key={key} className="rounded-[12px] border border-border-subtle p-3">
              <p className="font-semibold text-text-heading">{lb.name}</p>
              <p className="mb-2 text-[12.5px] text-text-muted">Sisa {qtyWithUnit(poRemaining(l), lb.unit)}</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-[12.5px] font-semibold">
                  Jumlah
                  <span className="mt-1 flex items-center gap-2">
                    <input
                      className={`${inputClass} tabular-nums`}
                      inputMode="decimal"
                      value={qty[key] ?? ""}
                      onChange={(e) => setQty((s) => ({ ...s, [key]: e.target.value }))}
                    />
                    <span className="text-[13px] font-normal text-text-muted">{lb.unit}</span>
                  </span>
                </label>
                <label className="text-[12.5px] font-semibold">
                  Harga per {lb.unit || "satuan"}
                  <MoneyInput className="mt-1" value={cost[key] ?? null} onChange={(v) => setCost((s) => ({ ...s, [key]: v }))} label={`Harga per ${lb.unit}`} />
                </label>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ——— Form PO ———

type LineDraft = { ref: ItemRef; qty: string; cost: number | null };

function PoForm({
  po,
  outletId,
  outletName,
  ops,
  onClose,
  onSaved,
}: {
  po: PurchaseOrder | null;
  outletId: string;
  outletName: string;
  ops: StockOps;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const toast = useToast();
  const stock = useLoad<StockRow[]>(async (signal) => (await ownerApi()).stock({ outlet_id: outletId }, signal), [outletId]);
  const [supplierId, setSupplierId] = useState<string>(po?.supplier_id ?? "");
  const [expected, setExpected] = useState(isoToDay(po?.expected_at));
  const [note, setNote] = useState(po?.note ?? "");
  const [lines, setLines] = useState<LineDraft[]>(() => (po?.lines ?? []).map((l) => ({ ref: l, qty: formatQty(l.qty_ordered), cost: l.unit_cost })));
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<"draft" | "order" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sid = useId();
  const eid = useId();
  const nid = useId();
  const suppliers = [...ops.state.data!.suppliers].sort((a, b) => a.name.localeCompare(b.name, "id"));

  const parsed = lines.map((l) => ({ ...l, milli: l.qty.trim() ? parseQty(l.qty) : 0 }));
  const total = parsed.reduce((s, l) => s + (l.milli ? poLineTotal({ ...l.ref, qty_ordered: l.milli, qty_received: 0, unit_cost: l.cost ?? 0 }) : 0), 0);

  function addRows(rows: StockRow[]) {
    setLines((ls) => [
      ...ls,
      ...rows.map((r) => {
        const ref = refOfRow(r);
        const last = ops.lookups.lastCost.get(itemKey(ref));
        return { ref, qty: "", cost: last?.unit_cost ?? ops.lookups.unitCost(ref) ?? 0 };
      }),
    ]);
  }

  async function save(order: boolean) {
    if (parsed.some((l) => l.milli === null)) return setError("Isi jumlah yang benar (mis. 2 atau 2,5)");
    const clean: PoLine[] = parsed.filter((l) => (l.milli ?? 0) > 0).map((l) => ({ ...l.ref, qty_ordered: l.milli!, qty_received: 0, unit_cost: l.cost ?? 0 }));
    if (!clean.length) return setError("Tambahkan minimal satu barang.");
    setBusy(order ? "order" : "draft");
    setError(null);
    try {
      const fields = { supplier_id: supplierId || null, lines: clean, expected_at: expected ? dayToIso(expected) : null, note };
      let id: string;
      if (!po) {
        const change = poCreateChange({ outlet_id: outletId, ...fields, order });
        ops.put("purchase_orders", await commitRecord(change));
        id = change.id;
      } else {
        const rec = await commitRecord(poUpdateChange(po, fields));
        ops.put("purchase_orders", rec);
        id = po.id;
        if (order && rec && po.status === "draft") ops.put("purchase_orders", await commitRecord(poStatusChange(asPo(rec), "ordered")));
      }
      toast.success("PO disimpan");
      onSaved(id);
    } catch (err) {
      if (err instanceof CommitError && err.result?.status === "conflict" && err.result.record) ops.put("purchase_orders", err.result.record);
      setError(commitMessage(err));
      setBusy(null);
    }
  }

  const exclude = new Set(lines.map((l) => itemKey(l.ref)));

  return (
    <Sheet
      open
      wide
      title={po ? "Ubah PO" : "PO baru"}
      subtitle={po ? `${po.number} · ${outletName}` : outletName}
      onClose={onClose}
      busy={!!busy}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={() => save(false)} disabled={!!busy}>
            {busy === "draft" && <Spinner />} Simpan draf
          </button>
          <button type="button" className={btn.primary} onClick={() => save(true)} disabled={!!busy}>
            {busy === "order" && <Spinner />} Simpan & pesan
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <Notice tone="danger" role="alert">
            {error}
          </Notice>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={sid} label="Supplier">
            <Select
              id={sid}
              value={supplierId}
              onChange={setSupplierId}
              options={[{ value: "", label: "Tanpa supplier" }, ...suppliers.map((s) => ({ value: s.id, label: s.name, description: s.phone ?? undefined }))]}
            />
          </Field>
          <Field id={eid} label="Perkiraan tiba (opsional)">
            <input id={eid} type="date" className={inputClass} value={expected} onChange={(e) => setExpected(e.target.value)} />
          </Field>
        </div>
        <Field id={nid} label="Catatan (opsional)">
          <input id={nid} className={inputClass} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>

        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">{lines.length} barang</p>
            <button type="button" className={`${btn.ghost} min-h-8 px-2 text-[13px] text-brand-ink`} onClick={() => setPicking(true)} disabled={!stock.state.data}>
              <Plus size={16} aria-hidden /> Tambah barang
            </button>
          </div>
          {lines.length === 0 ? (
            <p className="rounded-[12px] border border-dashed border-border-subtle px-4 py-6 text-center text-[13.5px] text-text-muted">Tambahkan minimal satu barang.</p>
          ) : (
            <ul className="space-y-2">
              {parsed.map((l, i) => {
                const lb = ops.lookups.label(l.ref);
                return (
                  <li key={itemKey(l.ref)} className="rounded-[12px] border border-border-subtle p-3">
                    <div className="mb-2 flex items-start gap-2">
                      <p className="min-w-0 flex-1 font-semibold text-text-heading">
                        {lb.name}
                        <span className="block text-[12.5px] font-normal text-text-muted">{lb.kind}</span>
                      </p>
                      <button type="button" className={iconBtn} aria-label={`Hapus ${lb.name}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                        <X size={16} aria-hidden />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <label className="text-[12.5px] font-semibold">
                        Jumlah
                        <span className="mt-1 flex items-center gap-2">
                          <input
                            className={`${inputClass} tabular-nums`}
                            inputMode="decimal"
                            aria-invalid={l.milli === null || undefined}
                            value={l.qty}
                            onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                          />
                          <span className="text-[13px] font-normal text-text-muted">{lb.unit}</span>
                        </span>
                      </label>
                      <label className="text-[12.5px] font-semibold">
                        Harga per {lb.unit || "satuan"}
                        <MoneyInput className="mt-1" value={l.cost} onChange={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, cost: v } : x)))} label={`Harga per ${lb.unit}`} />
                      </label>
                      <p className="col-span-2 self-end text-right text-[13px] text-text-muted tabular-nums sm:col-span-1">
                        {l.milli ? formatRupiah(poLineTotal({ ...l.ref, qty_ordered: l.milli, qty_received: 0, unit_cost: l.cost ?? 0 })) : "—"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <p className="flex justify-between text-[15px] font-bold">
          <span>Total</span>
          <span className="tabular-nums">{formatRupiah(total)}</span>
        </p>
      </div>
      <ItemPicker open={picking} rows={stock.state.data ?? []} exclude={exclude} onClose={() => setPicking(false)} onPick={addRows} />
    </Sheet>
  );
}
