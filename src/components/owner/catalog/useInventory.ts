"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLoad } from "@/components/admin/ui";
import { pullAll } from "@/lib/owner/api";
import { recipeItemsOf, type RawMaterial, type Recipe } from "@/lib/owner/productForm";
import type { ChangeResult, DataEntity, SyncRecord } from "@/lib/owner/types";

// Resep & bahan baku untuk form produk (GET /owner/data/recipes & raw_materials; tombstone dibuang). Hasil kiriman
// /owner/changes ber-entitas `recipes`/`raw_materials` diterapkan ke salinan lokal lewat `apply`.

export type InventoryData = { recipes: Recipe[]; materials: RawMaterial[] };

const asRecipe = (r: SyncRecord): Recipe => ({ ...(r as Recipe), items: recipeItemsOf(r.items) });

export function useInventory() {
  const { state, reload, setData } = useLoad<InventoryData>(async (signal) => {
    const [recipes, materials] = await Promise.all([pullAll("recipes" as DataEntity, signal), pullAll<RawMaterial>("raw_materials", signal)]);
    return { recipes: recipes.map(asRecipe), materials };
  }, []);

  const ref = useRef<InventoryData | undefined>(state.data);
  useEffect(() => {
    ref.current = state.data;
  }, [state.data]);

  /** Terapkan `record` hasil server untuk resep & bahan baku. */
  const apply = useCallback(
    (results: ChangeResult[]) => {
      const base = ref.current;
      if (!base) return;
      const recipes = new Map(base.recipes.map((r) => [r.id, r]));
      const materials = new Map(base.materials.map((m) => [m.id, m]));
      let touched = false;
      for (const r of results) {
        if (!r.record || (r.entity !== "recipes" && r.entity !== "raw_materials")) continue;
        touched = true;
        const list = (r.entity === "recipes" ? recipes : materials) as Map<string, SyncRecord>;
        if (r.record.deleted_at) list.delete(r.id);
        else list.set(r.id, r.entity === "recipes" ? asRecipe(r.record) : r.record);
      }
      if (!touched) return;
      const next = { recipes: [...recipes.values()], materials: [...materials.values()] };
      ref.current = next;
      setData(next);
    },
    [setData]
  );

  return { state, reload, apply };
}

export type Inventory = ReturnType<typeof useInventory>;
