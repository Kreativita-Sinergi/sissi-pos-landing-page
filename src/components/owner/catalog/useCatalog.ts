"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLoad } from "@/components/admin/ui";
import { pullAll, pushChanges } from "@/lib/owner/api";
import { summarize, type Category, type Discount, type ModifierGroup, type Product, type ResultSummary, type Variant } from "@/lib/owner/catalog";
import type { Change, ChangeResult, SyncRecord } from "@/lib/owner/types";

// Data katalog di klien: tarik semua entitas katalog (buang tombstone), lalu setiap kiriman perubahan
// memperbarui salinan lokal dari `record` hasil server (applied/conflict/rejected membawa baris terbaru).

export type CatalogData = {
  categories: Category[];
  products: Product[];
  variants: Variant[];
  groups: ModifierGroup[];
  discounts: Discount[];
};

type Key = keyof CatalogData;

const KEY_OF: Record<string, Key> = {
  categories: "categories",
  products: "products",
  product_variants: "variants",
  modifier_groups: "groups",
  discounts: "discounts",
};

const ENTITY_OF: Record<Key, "categories" | "products" | "product_variants" | "modifier_groups" | "discounts"> = {
  categories: "categories",
  products: "products",
  variants: "product_variants",
  groups: "modifier_groups",
  discounts: "discounts",
};

/** Salinan data baru setelah hasil kiriman diterapkan (murni). */
export function applyResults(data: CatalogData, results: ChangeResult[]): CatalogData {
  const lists: Record<Key, Map<string, SyncRecord>> = {
    categories: new Map(data.categories.map((r) => [r.id, r])),
    products: new Map(data.products.map((r) => [r.id, r])),
    variants: new Map(data.variants.map((r) => [r.id, r])),
    groups: new Map(data.groups.map((r) => [r.id, r])),
    discounts: new Map(data.discounts.map((r) => [r.id, r])),
  };
  const deletedProducts = new Set<string>();
  for (const r of results) {
    const key = KEY_OF[r.entity];
    if (!key || !r.record) continue;
    if (r.record.deleted_at) {
      lists[key].delete(r.id);
      if (key === "products") deletedProducts.add(r.id);
    } else lists[key].set(r.id, r.record);
  }
  // Server ikut menghapus varian produk yang dihapus.
  if (deletedProducts.size) for (const [id, v] of lists.variants) if (deletedProducts.has(String(v.product_id))) lists.variants.delete(id);
  return {
    categories: [...lists.categories.values()] as Category[],
    products: [...lists.products.values()] as Product[],
    variants: [...lists.variants.values()] as Variant[],
    groups: [...lists.groups.values()] as ModifierGroup[],
    discounts: [...lists.discounts.values()] as Discount[],
  };
}

export type CommitOutcome = { results: ChangeResult[]; next: CatalogData; summary: ResultSummary };

export function useCatalog() {
  const { state, reload, setData } = useLoad<CatalogData>(async (signal) => {
    const [categories, products, variants, groups, discounts] = await Promise.all([
      pullAll<Category>("categories", signal),
      pullAll<Product>("products", signal),
      pullAll<Variant>("product_variants", signal),
      pullAll<ModifierGroup>("modifier_groups", signal),
      pullAll<Discount>("discounts", signal),
    ]);
    return { categories, products, variants, groups, discounts };
  }, []);

  const ref = useRef<CatalogData | undefined>(state.data);
  useEffect(() => {
    ref.current = state.data;
  }, [state.data]);

  /** Kirim perubahan (dipecah per 200) lalu terapkan hasilnya ke data lokal. Galat jaringan → muat ulang semua. */
  const commit = useCallback(
    async (changes: Change[], onProgress?: (done: number) => void): Promise<CommitOutcome> => {
      try {
        const results = await pushChanges(changes, onProgress);
        const base = ref.current ?? { categories: [], products: [], variants: [], groups: [], discounts: [] };
        const next = applyResults(base, results);
        ref.current = next;
        setData(next);
        return { results, next, summary: summarize(results) };
      } catch (err) {
        // Sebagian kiriman mungkin sudah diterapkan → samakan dengan server.
        reload();
        throw err;
      }
    },
    [reload, setData]
  );

  /** Tarik ulang sebagian entitas (mis. produk setelah kategori dihapus: server mengosongkan category_id). */
  const refresh = useCallback(
    async (keys: Key[]) => {
      const fresh = await Promise.all(keys.map((k) => pullAll(ENTITY_OF[k])));
      const base = ref.current;
      if (!base) return;
      const next = { ...base };
      keys.forEach((k, i) => {
        (next as Record<Key, SyncRecord[]>)[k] = fresh[i];
      });
      ref.current = next;
      setData(next);
    },
    [setData]
  );

  return { state, reload, commit, refresh };
}

export type Catalog = ReturnType<typeof useCatalog>;
