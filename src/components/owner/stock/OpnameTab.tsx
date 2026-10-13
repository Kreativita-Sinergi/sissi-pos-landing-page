"use client";

import React, { useMemo, useState } from "react";
import { ClipboardCheck, ClipboardList, Layers, Package, Plus, Wheat } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { useQueryState } from "@/components/admin/filters";
import { useToast } from "@/components/admin/toast";
import { btn, cardClass, EmptyState, ErrorBlock, focusRing, formatRupiah, inputClass, Notice, Spinner, tdClass, thClass, useLoad } from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { formatQty, norm, parseQty } from "@/lib/owner/catalog";
import {
  commitFollow,
  commitRecord,
  CommitError,
  itemKey,
  opnameCountChange,
  opnameDiff,
  opnameMoves,
  opnameStartChange,
  opnameStatusChange,
  opnameSummary,
  refOfRow,
  signedQty,
  signedRupiah,
  stockMap,
  type ItemRef,
  type Opname,
} from "@/lib/owner/stockOps";
import type { Change, StockRow } from "@/lib/owner/types";
import { formatStamp } from "@/lib/owner/tz";
import { Sheet } from "../catalog/bits";
import { useOwner } from "../OwnerShell";
import { commitMessage, ItemCell, ItemPicker, OPNAME_STATUS, OutletPrompt, StatusBadge } from "./parts";
import type { StockOps } from "./useStockOps";

// Stok opname (`OpnamesScreen` + `OpnameScreen` aplikasi): mulai hitung (lingkup Semua barang/Produk/Bahan baku) →
// isi jumlah fisik (stok sistem dibekukan saat baris dihitung) → Posting = status `posted` + gerakan `opname` sebesar
// hitung − sistem tiap baris yang dihitung (`ref_id` = opname). Satu sesi "Menghitung" per outlet (tombol jadi
// "Lanjutkan opname").

export function OpnameTab({ ops }: { ops: StockOps }) {
  const { outletId, session } = useOwner();
  const qs = useQueryState();
  const docId = qs.get("doc");
  const data = ops.state.data!;
  const outletName = (id: string) => session.outlets.find((o) => o.id === id)?.name ?? "—";
  const list = useMemo(
    () => data.opnames.filter((o) => !outletId || o.outlet_id === outletId).sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [data.opnames, outletId]
  );
  const running = outletId ? list.find((o) => o.status === "counting") : undefined;
  const [starting, setStarting] = useState(false);
  const open = docId ? data.opnames.find((o) => o.id === docId) : undefined;

  function start() {
    if (running) qs.update({ doc: running.id });
    else setStarting(true);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] text-text-body">Hitung stok fisik di rak/gudang lalu posting — selisihnya otomatis menyesuaikan stok sistem.</p>
        {outletId && (
          <button type="button" className={btn.primary} onClick={start}>
            <ClipboardCheck size={16} aria-hidden /> {running ? "Lanjutkan opname" : "Mulai opname"}
          </button>
        )}
      </div>
      {!outletId && (
        <div className="mb-4">
          <OutletPrompt action="memulai stok opname" />
        </div>
      )}

      <section className={`${cardClass} overflow-hidden`}>
        {list.length === 0 ? (
          <EmptyState icon={<ClipboardList size={22} aria-hidden />} title="Belum ada stok opname">
            Hitung stok fisik di rak/gudang lalu posting — selisihnya otomatis menyesuaikan stok sistem.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map((o) => {
              const s = opnameSummary(o.lines, ops.lookups.unitCost);
              return (
                <li key={o.id}>
                  <button type="button" onClick={() => qs.update({ doc: o.id })} className={`flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-bg-muted/60 sm:px-5 ${focusRing}`}>
                    <ClipboardList size={18} aria-hidden className="mt-0.5 shrink-0 text-text-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold text-text-heading">{formatStamp(o.posted_at ?? o.started_at)}</span>
                      <span className="block text-[13px] text-text-muted">
                        {[
                          `${s.counted}/${s.total} dihitung`,
                          ops.lookups.staff.get(o.employee_id),
                          s.counted > 0 ? `Nilai selisih: ${signedRupiah(s.netValue)}` : null,
                          outletId ? null : outletName(o.outlet_id),
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {o.note && <span className="block text-[12.5px] text-text-muted">{o.note}</span>}
                    </span>
                    <StatusBadge s={OPNAME_STATUS[o.status]} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {starting && outletId && (
        <StartOpname
          outletId={outletId}
          ops={ops}
          onClose={() => setStarting(false)}
          onStarted={(id) => {
            setStarting(false);
            qs.update({ doc: id });
          }}
        />
      )}
      {open && <OpnameSheet key={open.id} opname={open} ops={ops} outletName={outletName(open.outlet_id)} onClose={() => qs.update({ doc: null })} />}
    </>
  );
}

type Scope = "all" | "product" | "raw_material";

function StartOpname({ outletId, ops, onClose, onStarted }: { outletId: string; ops: StockOps; onClose: () => void; onStarted: (id: string) => void }) {
  const { session } = useOwner();
  const toast = useToast();
  const stock = useLoad<StockRow[]>(async (signal) => (await ownerApi()).stock({ outlet_id: outletId }, signal), [outletId]);
  const [busy, setBusy] = useState<Scope | null>(null);
  const rows = stock.state.data;
  const products = rows?.filter((r) => r.kind === "product") ?? [];
  const materials = rows?.filter((r) => r.kind === "raw_material") ?? [];

  async function begin(scope: Scope) {
    const chosen = scope === "all" ? (rows ?? []) : scope === "product" ? products : materials;
    if (!chosen.length) return;
    setBusy(scope);
    try {
      const change = opnameStartChange({
        outlet_id: outletId,
        employee_id: session.user.id,
        items: chosen.map((r) => ({ ref: refOfRow(r), qty: r.qty })),
      });
      const rec = await commitRecord(change);
      ops.put("stock_opnames", rec);
      onStarted(change.id);
    } catch (err) {
      toast.error(commitMessage(err));
      setBusy(null);
    }
  }

  const options: { scope: Scope; label: string; count: number; icon: React.ReactNode }[] = [
    { scope: "all", label: "Semua barang", count: rows?.length ?? 0, icon: <Layers size={18} aria-hidden /> },
    ...(products.length ? [{ scope: "product" as const, label: "Produk", count: products.length, icon: <Package size={18} aria-hidden /> }] : []),
    ...(materials.length ? [{ scope: "raw_material" as const, label: "Bahan baku", count: materials.length, icon: <Wheat size={18} aria-hidden /> }] : []),
  ];

  return (
    <Modal open title={rows && !rows.length ? "Belum ada barang untuk dihitung" : "Mulai stok opname"} onClose={() => !busy && onClose()} dismissible={!busy}>
      {stock.state.status === "error" && <ErrorBlock error={stock.state.error} onRetry={stock.reload} />}
      {!rows && stock.state.status === "loading" && (
        <p className="flex items-center gap-2 text-text-muted">
          <Spinner /> Memuat barang…
        </p>
      )}
      {rows && !rows.length && (
        <p className="leading-relaxed">
          Opname menghitung bahan baku dan produk yang &quot;Lacak stok&quot;-nya aktif. Aktifkan Lacak stok di form produk (menu Produk), atau buat bahan baku di
          aplikasi.
        </p>
      )}
      {rows && rows.length > 0 && (
        <ul className="space-y-2">
          {options.map((o) => (
            <li key={o.scope}>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => begin(o.scope)}
                className={`flex w-full items-center gap-3 rounded-[12px] border border-border-subtle px-4 py-3 text-left hover:border-border-active disabled:opacity-60 ${focusRing}`}
              >
                <span className="text-brand-ink">{o.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-text-heading">{o.label}</span>
                  <span className="block text-[13px] text-text-muted">{o.count.toLocaleString("id-ID")} barang</span>
                </span>
                {busy === o.scope && <Spinner />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

type Filter = "all" | "uncounted" | "counted" | "diff";

function OpnameSheet({ opname, ops, outletName, onClose }: { opname: Opname; ops: StockOps; outletName: string; onClose: () => void }) {
  const { session } = useOwner();
  const toast = useToast();
  const counting = opname.status === "counting";
  const stock = useLoad<StockRow[]>(async (signal) => (counting ? (await ownerApi()).stock({ outlet_id: opname.outlet_id }, signal) : []), [opname.outlet_id, counting ? 1 : 0]);
  const current = useMemo(() => stockMap(stock.state.data ?? []), [stock.state.data]);
  const [edits, setEdits] = useState<Map<string, string>>(new Map());
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<"save" | "post" | "cancel" | "add" | null>(null);
  const [confirm, setConfirm] = useState<"post" | "cancel" | "discard" | null>(null);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<Change[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = ops.lookups.label;

  // Pratinjau: baris dengan isian yang belum disimpan dihitung memakai isian itu.
  const preview = useMemo(
    () =>
      opname.lines.map((l) => {
        const key = itemKey(l);
        const text = edits.get(key);
        if (text === undefined) return l;
        const v = text.trim() ? parseQty(text) : null;
        const system = current.get(key) ?? l.system_qty;
        return { ...l, system_qty: system, counted_qty: v };
      }),
    [opname.lines, edits, current]
  );
  const summary = opnameSummary(preview, ops.lookups.unitCost);
  const dirty = edits.size > 0;
  const invalid = [...edits.values()].some((t) => t.trim() && parseQty(t) === null);

  const shown = useMemo(() => {
    const needle = norm(q);
    return preview.filter((l) => {
      if (filter === "uncounted" && l.counted_qty !== null) return false;
      if (filter === "counted" && l.counted_qty === null) return false;
      if (filter === "diff" && (l.counted_qty === null || opnameDiff(l) === 0)) return false;
      return !needle || norm(label(l).name).includes(needle);
    });
  }, [preview, filter, q, label]);

  async function freshStock(): Promise<Map<string, number>> {
    return stockMap(await (await ownerApi()).stock({ outlet_id: opname.outlet_id }));
  }

  async function saveCounts(extra?: { ref: ItemRef }[]): Promise<void> {
    const counts = new Map<string, { ref: ItemRef; counted: number | null }>();
    for (const [key, text] of edits) {
      const line = opname.lines.find((l) => itemKey(l) === key);
      if (!line) continue;
      counts.set(key, { ref: line, counted: text.trim() ? parseQty(text) : null });
    }
    for (const e of extra ?? []) counts.set(itemKey(e.ref), { ref: e.ref, counted: null });
    if (!counts.size) return;
    const now = await freshStock();
    const rec = await commitRecord(opnameCountChange(opname, counts, now));
    ops.put("stock_opnames", rec);
    setEdits(new Map());
    stock.reload();
  }

  async function run(kind: "save" | "add" | "cancel" | "post", fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (err) {
      if (err instanceof CommitError && err.result?.status === "conflict" && err.result.record) ops.put("stock_opnames", err.result.record);
      if (err instanceof CommitError && err.pending) setPending(err.pending);
      setError(commitMessage(err));
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  const save = () =>
    run("save", async () => {
      await saveCounts();
      toast.success("Hasil hitung disimpan");
    });

  const addItems = (rows: StockRow[]) =>
    run("add", async () => {
      await saveCounts(rows.map((r) => ({ ref: refOfRow(r) })));
    });

  const cancel = () =>
    run("cancel", async () => {
      const rec = await commitRecord(opnameStatusChange(opname, "canceled", new Date().toISOString()));
      ops.put("stock_opnames", rec);
      toast.success("Opname dibatalkan");
    });

  // Posting: dokumen `posted` dulu, lalu gerakan `opname` (selisih baris yang dihitung) setelah applied.
  const post = () =>
    run("post", async () => {
      const at = new Date().toISOString();
      const rec = await commitRecord(opnameStatusChange(opname, "posted", at));
      ops.put("stock_opnames", rec);
      const moves = opnameMoves(opname, session.user.id, at);
      await commitFollow(moves);
      toast.success("Opname diposting, stok disesuaikan");
    });

  const retry = () =>
    run("post", async () => {
      if (!pending) return;
      await commitFollow(pending);
      setPending(null);
      toast.success("Gerakan stok terkirim");
    });

  const exclude = useMemo(() => new Set(opname.lines.map(itemKey)), [opname.lines]);
  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "Semua" },
    { id: "uncounted", label: "Belum dihitung" },
    { id: "counted", label: "Sudah dihitung" },
    { id: "diff", label: "Ada selisih" },
  ];

  return (
    <Sheet
      open
      wide
      title="Stok opname"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge s={OPNAME_STATUS[opname.status]} />
          <span>
            {outletName} · Mulai {formatStamp(opname.started_at)}
            {ops.lookups.staff.get(opname.employee_id) ? ` · ${ops.lookups.staff.get(opname.employee_id)}` : ""}
          </span>
        </span>
      }
      onClose={() => (dirty ? setConfirm("discard") : onClose())}
      busy={!!busy}
      footer={
        counting ? (
          <>
            <button type="button" className={`${btn.ghost} text-danger sm:mr-auto`} onClick={() => setConfirm("cancel")} disabled={!!busy}>
              Batalkan opname
            </button>
            {dirty && (
              <button type="button" className={btn.secondary} onClick={save} disabled={!!busy || invalid}>
                {busy === "save" && <Spinner />} Simpan hitungan ({edits.size})
              </button>
            )}
            <button
              type="button"
              className={btn.primary}
              onClick={() => setConfirm("post")}
              disabled={!!busy || dirty || summary.counted === 0}
              title={dirty ? "Simpan hitungan dulu" : summary.counted === 0 ? "Belum ada barang yang dihitung." : undefined}
            >
              <ClipboardCheck size={16} aria-hidden /> Posting
            </button>
          </>
        ) : pending ? (
          <button type="button" className={btn.primary} onClick={retry} disabled={!!busy}>
            {busy && <Spinner />} Kirim ulang gerakan stok
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
        {!counting && (
          <Notice tone="info">
            Sesi ini sudah selesai — hanya bisa dilihat.{opname.posted_at ? ` Diposting ${formatStamp(opname.posted_at)}.` : ""}
          </Notice>
        )}
        {opname.note && <p className="text-[13.5px] text-text-body">{opname.note}</p>}

        <div className="grid grid-cols-2 gap-2 rounded-[12px] bg-bg-muted p-3 text-[13.5px] sm:grid-cols-4">
          <SummaryCell label="Dihitung" value={`${summary.counted}/${summary.total}`} />
          <SummaryCell label={`Lebih (${summary.surplus} barang)`} value={signedRupiah(summary.surplusValue)} tone="success" />
          <SummaryCell label={`Kurang (${summary.shortage} barang)`} value={formatRupiah(summary.shortageValue)} tone="danger" />
          <SummaryCell label="Nilai bersih" value={signedRupiah(summary.netValue)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input className={`${inputClass} sm:max-w-[260px]`} placeholder="Cari nama, SKU, atau barcode" aria-label="Cari barang" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Saring baris">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={`min-h-9 rounded-full border px-3 text-[13px] font-semibold ${filter === f.id ? "border-brand-primary/50 bg-brand-tint text-brand-ink" : "border-border-subtle text-text-body"} ${focusRing}`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {counting && (
            <button type="button" className={`${btn.ghost} ml-auto text-brand-ink`} onClick={() => setPicking(true)} disabled={!!busy || !stock.state.data}>
              {busy === "add" ? <Spinner /> : <Plus size={16} aria-hidden />} Tambah barang
            </button>
          )}
        </div>

        <div className="overflow-x-auto rounded-[12px] border border-border-subtle">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 text-[14px]">
            <thead>
              <tr>
                <th scope="col" className={thClass}>
                  Barang
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Sistem
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Jumlah fisik
                </th>
                <th scope="col" className={`${thClass} text-right`}>
                  Selisih
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-text-muted">
                    {opname.lines.length ? "Tidak ada barang di saringan ini." : "Tidak ada barang yang cocok."}
                  </td>
                </tr>
              )}
              {shown.map((l) => {
                const key = itemKey(l);
                const lb = label(l);
                const text = edits.get(key);
                const bad = text !== undefined && !!text.trim() && parseQty(text) === null;
                // Belum dihitung: tampilkan stok sistem terkini (dibekukan saat disimpan).
                const system = l.counted_qty === null && counting ? (current.get(key) ?? l.system_qty) : l.system_qty;
                const diff = l.counted_qty === null ? null : l.counted_qty - system;
                return (
                  <tr key={key} className={text !== undefined ? "bg-brand-tint/40" : ""}>
                    <td className={`${tdClass} border-b border-border-subtle`}>
                      <ItemCell name={lb.name} sub={lb.kind} />
                    </td>
                    <td className={`${tdClass} border-b border-border-subtle text-right whitespace-nowrap tabular-nums`}>
                      {formatQty(system)} <span className="text-text-muted">{lb.unit}</span>
                    </td>
                    <td className={`${tdClass} border-b border-border-subtle text-right`}>
                      {counting ? (
                        <input
                          className={`${inputClass} ml-auto w-[120px] text-right tabular-nums`}
                          inputMode="decimal"
                          aria-label={`Jumlah fisik ${lb.name}`}
                          aria-invalid={bad || undefined}
                          placeholder="Belum dihitung"
                          value={text ?? (l.counted_qty === null ? "" : formatQty(l.counted_qty))}
                          onChange={(e) =>
                            setEdits((m) => {
                              const n = new Map(m);
                              n.set(key, e.target.value);
                              return n;
                            })
                          }
                        />
                      ) : l.counted_qty === null ? (
                        <span className="text-text-muted">Belum dihitung</span>
                      ) : (
                        <span className="tabular-nums">
                          {formatQty(l.counted_qty)} <span className="text-text-muted">{lb.unit}</span>
                        </span>
                      )}
                    </td>
                    <td className={`${tdClass} border-b border-border-subtle text-right font-semibold whitespace-nowrap tabular-nums`}>
                      {diff === null ? (
                        <span className="font-normal text-text-muted">—</span>
                      ) : diff === 0 ? (
                        <span className="font-normal text-success">Cocok</span>
                      ) : (
                        <span className={diff > 0 ? "text-success" : "text-danger"}>{signedQty(diff)}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {counting && (
          <p className="text-[12.5px] text-text-muted">
            Kosongkan jumlah fisik untuk menghapus hitungan. Stok sistem dibekukan saat hitungan disimpan; transaksi sesudahnya tetap terhitung.
          </p>
        )}
      </div>

      <ItemPicker open={picking} rows={stock.state.data ?? []} exclude={exclude} onClose={() => setPicking(false)} onPick={addItems} />

      <ConfirmDialog
        open={confirm === "post"}
        title="Posting opname?"
        confirmLabel="Posting"
        busy={busy === "post"}
        onConfirm={post}
        onClose={() => setConfirm(null)}
      >
        <p>
          {summary.counted} dari {summary.total} barang sudah dihitung. Stok sistem disesuaikan dengan hasil hitung.
        </p>
        {summary.uncounted > 0 && <p className="mt-2">{summary.uncounted} barang belum dihitung dan tidak diubah.</p>}
        <p className="mt-2">Nilai selisih: {signedRupiah(summary.netValue)}</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "cancel"}
        title="Batalkan opname?"
        confirmLabel="Batalkan opname"
        tone="danger"
        busy={busy === "cancel"}
        onConfirm={cancel}
        onClose={() => setConfirm(null)}
      >
        Hasil hitung sesi ini tidak dipakai dan stok tidak berubah.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "discard"} title="Tutup tanpa menyimpan?" confirmLabel="Tutup" tone="danger" onConfirm={onClose} onClose={() => setConfirm(null)}>
        Hasil hitung yang belum disimpan akan hilang.
      </ConfirmDialog>
    </Sheet>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="min-w-0">
      <p className="text-[12px] text-text-muted">{label}</p>
      <p className={`font-semibold tabular-nums ${tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : "text-text-heading"}`}>{value}</p>
    </div>
  );
}
