"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLoad } from "@/components/admin/ui";
import { ownerApi, pullAll } from "@/lib/owner/api";
import type { Product, Variant } from "@/lib/owner/catalog";
import {
  asOpname,
  asPo,
  asTransfer,
  itemKey,
  type ItemRef,
  type Opname,
  type PurchaseOrder,
  type RawMaterialRec,
  type StockTransfer,
  type Supplier,
} from "@/lib/owner/stockOps";
import type { DataEntity, StaffMember, SyncRecord } from "@/lib/owner/types";

// Data operasi stok (GET /owner/data/{stock_opnames,purchase_orders,stock_transfers,suppliers,raw_materials,products,
// product_variants} + /owner/staff). Dokumen ditarik sekali untuk semua outlet; tab memfilter per outlet terpilih.
// Hasil kiriman (`record` dari /owner/changes) diterapkan ke salinan lokal lewat `put`.

export type StockOpsData = {
  opnames: Opname[];
  pos: PurchaseOrder[];
  transfers: StockTransfer[];
  suppliers: Supplier[];
  materials: RawMaterialRec[];
  products: Product[];
  variants: Variant[];
  staff: StaffMember[];
};

const e = (x: string) => x as DataEntity;

export function useStockOps() {
  const { state, reload, setData } = useLoad<StockOpsData>(async (signal) => {
    const api = await ownerApi();
    const [opnames, pos, transfers, suppliers, materials, products, variants, staff] = await Promise.all([
      pullAll(e("stock_opnames"), signal),
      pullAll(e("purchase_orders"), signal),
      pullAll(e("stock_transfers"), signal),
      pullAll(e("suppliers"), signal),
      pullAll<RawMaterialRec>("raw_materials", signal),
      pullAll<Product>("products", signal),
      pullAll<Variant>("product_variants", signal),
      api.staff(signal).catch(() => [] as StaffMember[]),
    ]);
    return {
      opnames: opnames.map(asOpname),
      pos: pos.map(asPo),
      transfers: transfers.map(asTransfer),
      suppliers: suppliers as Supplier[],
      materials,
      products,
      variants,
      staff,
    };
  }, []);

  const data = state.data;
  const ref = useRef<StockOpsData | undefined>(data);
  useEffect(() => {
    ref.current = data;
  }, [data]);

  /** Terapkan record hasil server (upsert / tombstone) ke salinan lokal. */
  const put = useCallback(
    (entity: "stock_opnames" | "purchase_orders" | "stock_transfers" | "suppliers" | "raw_materials", rec: SyncRecord | null | undefined) => {
      const base = ref.current;
      if (!rec || !base) return;
      const upsert = <T extends SyncRecord>(list: T[], next: T): T[] => {
        if (rec.deleted_at) return list.filter((x) => x.id !== rec.id);
        const i = list.findIndex((x) => x.id === rec.id);
        return i < 0 ? [next, ...list] : list.map((x, j) => (j === i ? next : x));
      };
      const next = { ...base };
      if (entity === "stock_opnames") next.opnames = upsert(base.opnames, asOpname(rec));
      else if (entity === "purchase_orders") next.pos = upsert(base.pos, asPo(rec));
      else if (entity === "stock_transfers") next.transfers = upsert(base.transfers, asTransfer(rec));
      else if (entity === "suppliers") next.suppliers = upsert(base.suppliers, rec as Supplier);
      else next.materials = upsert(base.materials, rec as RawMaterialRec);
      ref.current = next;
      setData(next);
    },
    [setData]
  );

  const lookups = useMemo(() => {
    const products = new Map((data?.products ?? []).map((p) => [p.id, p]));
    const variants = new Map((data?.variants ?? []).map((v) => [v.id, v]));
    const materials = new Map((data?.materials ?? []).map((m) => [m.id, m]));
    const suppliers = new Map((data?.suppliers ?? []).map((s) => [s.id, s]));
    const staff = new Map((data?.staff ?? []).map((s) => [s.id, s.name]));
    /** Nama & satuan barang — juga untuk barang yang sudah dihapus/tidak dilacak, agar dokumen lama tetap terbaca. */
    const label = (r: ItemRef): { name: string; unit: string; kind: "Produk" | "Bahan baku" } => {
      if (r.raw_material_id) {
        const m = materials.get(r.raw_material_id);
        return { name: m?.name ?? "Barang terhapus", unit: m?.unit ?? "", kind: "Bahan baku" };
      }
      const p = r.product_id ? products.get(r.product_id) : undefined;
      const v = r.variant_id ? variants.get(r.variant_id) : undefined;
      const name = !p ? "Barang terhapus" : v ? `${p.name} · ${v.name}` : p.name;
      return { name, unit: p?.unit ?? "", kind: "Produk" };
    };
    /** Harga satuan barang: rata-rata bahan baku (bila > 0) atau modal varian/produk; null = belum diketahui. */
    const unitCost = (r: ItemRef): number | null => {
      if (r.raw_material_id) {
        const m = materials.get(r.raw_material_id);
        return m && m.avg_cost > 0 ? m.avg_cost : null;
      }
      const v = r.variant_id ? variants.get(r.variant_id) : undefined;
      const p = r.product_id ? products.get(r.product_id) : undefined;
      return v?.cost_price ?? p?.cost_price ?? null;
    };
    /** Harga beli terakhir per barang dari PO yang sudah dipesan/diterima (saran harga PO baru). */
    const lastCost = new Map<string, { supplier_id: string | null; unit_cost: number }>();
    const ordered = (data?.pos ?? []).filter((o) => o.status === "ordered" || o.status === "partial" || o.status === "received");
    ordered.sort((a, b) => (a.ordered_at ?? "").localeCompare(b.ordered_at ?? ""));
    for (const o of ordered) for (const l of o.lines) lastCost.set(itemKey(l), { supplier_id: o.supplier_id, unit_cost: l.unit_cost });
    return { products, variants, materials, suppliers, staff, label, unitCost, lastCost };
  }, [data]);

  return { state, reload, put, lookups };
}

export type StockOps = ReturnType<typeof useStockOps>;
export type Lookups = StockOps["lookups"];
