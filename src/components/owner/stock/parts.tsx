"use client";

import React, { useId, useMemo, useState } from "react";
import { Search, Store } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { useQueryState } from "@/components/admin/filters";
import { Badge, btn, errorMessage, inputClass, Notice } from "@/components/admin/ui";
import { formatQty, norm } from "@/lib/owner/catalog";
import { CommitError, itemKey, refOfRow, type OpnameStatus, type PoStatus, type TransferStatus } from "@/lib/owner/stockOps";
import type { StockRow } from "@/lib/owner/types";
import { Check } from "../catalog/bits";
import { useOwner } from "../OwnerShell";
import { Select } from "../Select";

// Potongan bersama tab operasi stok. Label status = l10n aplikasi (app_id.arb).

export const OPNAME_STATUS: Record<OpnameStatus, { label: string; tone: "brand" | "success" | "neutral" }> = {
  counting: { label: "Menghitung", tone: "brand" },
  posted: { label: "Diposting", tone: "success" },
  canceled: { label: "Batal", tone: "neutral" },
};

export const PO_STATUS: Record<PoStatus, { label: string; tone: "neutral" | "brand" | "warning" | "success" }> = {
  draft: { label: "Draf", tone: "neutral" },
  ordered: { label: "Dipesan", tone: "brand" },
  partial: { label: "Diterima sebagian", tone: "warning" },
  received: { label: "Diterima", tone: "success" },
  canceled: { label: "Batal", tone: "neutral" },
};

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; tone: "warning" | "success" | "neutral" }> = {
  pending: { label: "Menunggu", tone: "warning" },
  completed: { label: "Selesai", tone: "success" },
  canceled: { label: "Batal", tone: "neutral" },
};

export function StatusBadge({ s }: { s: { label: string; tone: "neutral" | "brand" | "warning" | "success" } | undefined }) {
  return s ? <Badge tone={s.tone}>{s.label}</Badge> : null;
}

/** Pesan galat kiriman untuk toast. */
export function commitMessage(err: unknown): string {
  if (err instanceof CommitError) return err.message;
  return errorMessage(err);
}

/** "Semua outlet" terpilih → minta pilih outlet (mengubah `?outlet=` seperti pemilih di atas). */
export function OutletPrompt({ action }: { action: string }) {
  const { session } = useOwner();
  const qs = useQueryState();
  const id = useId();
  return (
    <Notice tone="info" icon={<Store size={16} aria-hidden />}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span id={id}>Pilih outlet untuk {action}.</span>
        <Select
          aria-labelledby={id}
          className="w-full sm:w-[240px]"
          value=""
          placeholder="Pilih outlet"
          options={session.outlets.map((o) => ({ value: o.id, label: o.name }))}
          onChange={(v) => qs.update({ outlet: v })}
        />
      </div>
    </Notice>
  );
}

/**
 * Pilih barang (produk ber-Lacak stok & bahan baku aktif di outlet) — boleh banyak sekaligus. [exclude] = kunci barang
 * yang sudah ada di dokumen.
 */
export function ItemPicker({
  open,
  rows,
  exclude,
  onClose,
  onPick,
  title = "Tambah barang",
}: {
  open: boolean;
  rows: StockRow[];
  exclude: Set<string>;
  onClose: () => void;
  onPick: (rows: StockRow[]) => void;
  title?: string;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<"" | "product" | "raw_material">("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const sid = useId();
  const list = useMemo(() => {
    const needle = norm(q);
    return rows
      .filter((r) => !exclude.has(itemKey(refOfRow(r))))
      .filter((r) => !kind || r.kind === kind)
      .filter((r) => !needle || [r.name, r.variant_name, r.category].some((x) => x && norm(x).includes(needle)))
      .sort((a, b) => a.name.localeCompare(b.name, "id") || (a.variant_name ?? "").localeCompare(b.variant_name ?? "", "id"));
  }, [rows, exclude, q, kind]);

  function close() {
    setPicked(new Set());
    setQ("");
    onClose();
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={close}>
            Batal
          </button>
          <button
            type="button"
            className={btn.primary}
            disabled={!picked.size}
            onClick={() => {
              onPick(rows.filter((r) => picked.has(itemKey(refOfRow(r)))));
              close();
            }}
          >
            Tambah{picked.size ? ` (${picked.size})` : ""}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-muted" />
          <input id={sid} className={`${inputClass} pl-9`} placeholder="Cari nama, SKU, atau barcode" aria-label="Cari barang" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="flex gap-1 rounded-[10px] bg-bg-muted p-1" role="radiogroup" aria-label="Jenis barang">
          {(
            [
              ["", "Semua"],
              ["product", "Produk"],
              ["raw_material", "Bahan baku"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={kind === v}
              onClick={() => setKind(v)}
              className={`min-h-8 flex-1 rounded-[8px] px-2 text-[13px] font-semibold ${kind === v ? "bg-white text-text-heading shadow-sm" : "text-text-muted"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="max-h-[50vh] overflow-y-auto rounded-[10px] border border-border-subtle">
          {list.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13.5px] text-text-muted">
              {rows.length ? "Tidak ada barang yang cocok." : "Belum ada barang yang dilacak stoknya atau bahan baku."}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {list.map((r) => {
                const key = itemKey(refOfRow(r));
                return (
                  <li key={key} className="px-3 py-1.5">
                    <Check
                      checked={picked.has(key)}
                      onChange={(v) =>
                        setPicked((s) => {
                          const n = new Set(s);
                          if (v) n.add(key);
                          else n.delete(key);
                          return n;
                        })
                      }
                      label={
                        <span className="block">
                          <span className="font-semibold text-text-heading">
                            {r.name}
                            {r.variant_name && <span className="font-normal"> · {r.variant_name}</span>}
                          </span>
                          <span className="block text-[12.5px] text-text-muted">
                            {r.kind === "raw_material" ? "Bahan baku" : "Produk"} · Stok: {formatQty(r.qty)} {r.unit}
                          </span>
                        </span>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

/** Nama barang dari baris /owner/stock (format aplikasi `Produk · Varian`). */
export const rowName = (r: StockRow) => (r.variant_name ? `${r.name} · ${r.variant_name}` : r.name);

/** Isi sel tabel nama barang + jenis. */
export function ItemCell({ name, sub }: { name: string; sub?: React.ReactNode }) {
  return (
    <>
      <span className="block font-semibold text-text-heading">{name}</span>
      {sub && <span className="block text-[12.5px] text-text-muted">{sub}</span>}
    </>
  );
}
