"use client";

import React, { useState } from "react";
import { ListPlus, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, cardClass, EmptyState, errorMessage, Field, formatRupiah, iconBtn, inputClass, Notice, Spinner } from "@/components/admin/ui";
import { newId } from "@/lib/owner/api";
import {
  CONFLICT_MESSAGE,
  createChange,
  deleteChange,
  editChange,
  fieldLabel,
  LIMITS,
  norm,
  resultFieldErrors,
  type ModifierGroup,
  type ModifierOption,
} from "@/lib/owner/catalog";
import { recipeCost, recipeItemsOf, type CostMode, type RawMaterial, type RecipeItem } from "@/lib/owner/productForm";
import type { Change } from "@/lib/owner/types";
import { MoneyInput, reportOutcome, Sheet } from "./bits";
import { CostModeSwitch, MarginLine, RecipeEditor, type CreateMaterial } from "./formParts";
import type { CatalogData, CommitOutcome } from "./useCatalog";

// Grup modifier — sama dengan aplikasi (`modifier_group_sheet.dart`): nama, Opsional/Wajib (min_select 0/1),
// maksimal pilihan 1–20 (disimpan ≤ jumlah opsi), opsi (nama + harga tambahan + HPP). Opsi kosong dilewati, nama
// opsi tidak boleh kembar (tanpa beda huruf). HPP opsi = lembar `modifier_cost_sheet.dart`: Modal manual (modal per
// satuan, resep dibuang) atau Resep (`options[].recipe`, `cost_price` null = pakai HPP resep). Kunci opsi lain yang
// tidak dikenal web ikut dikirim apa adanya. Bahan baku/resep gagal dimuat → resep opsi dipertahankan apa adanya.

type OptRow = { id: string; name: string; price: number | null; cost: number | null; recipe: RecipeItem[]; orig?: ModifierOption };

/** Dukungan resep untuk HPP opsi (bahan baku dari /owner/data/raw_materials). null = tidak tersedia. */
export type RecipeSupport = { materials: RawMaterial[]; createMaterial: CreateMaterial; showRecipe: boolean } | null;

export function ModifiersPanel({
  data,
  commit,
  refresh,
  recipes = null,
}: {
  data: CatalogData;
  commit: (changes: Change[]) => Promise<CommitOutcome>;
  refresh: (keys: ("products" | "discounts")[]) => Promise<void>;
  recipes?: RecipeSupport;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<{ id: string | null; key: number } | null>(null);
  const [deleting, setDeleting] = useState<ModifierGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const groups = [...data.groups].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, "id"));
  const usage = new Map<string, number>();
  for (const p of data.products) for (const g of p.modifier_group_ids ?? []) usage.set(g, (usage.get(g) ?? 0) + 1);

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      const out = await commit([deleteChange("modifier_groups", deleting)]);
      if (reportOutcome(toast, out, `Grup "${deleting.name}" dihapus.`) && usage.get(deleting.id)) await refresh(["products"]).catch(() => {});
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] text-text-body">Pilihan tambahan saat memesan, mis. tingkat gula atau topping. Pasang ke produk lewat panel produk.</p>
        <button type="button" className={btn.primary} onClick={() => setEditing({ id: null, key: Date.now() })}>
          <Plus size={16} aria-hidden /> Tambah grup modifier
        </button>
      </div>
      {groups.length === 0 ? (
        <section className={cardClass}>
          <EmptyState icon={<ListPlus size={22} aria-hidden />} title="Belum ada grup modifier">
            Contoh: &quot;Tingkat gula&quot; dengan opsi Normal, Kurang, Tanpa gula.
          </EmptyState>
        </section>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => (
            <section key={g.id} className={`${cardClass} p-4`}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[15px] font-semibold">{g.name}</h3>
                  <p className="text-[12.5px] text-text-muted">
                    {g.min_select === 0 ? "Opsional" : "Wajib"} · {g.max_select <= 1 ? "pilih 1" : `maks ${g.max_select}`} · dipakai {(usage.get(g.id) ?? 0).toLocaleString("id-ID")} produk
                  </p>
                </div>
                <button type="button" className={iconBtn} onClick={() => setEditing({ id: g.id, key: Date.now() })} aria-label={`Ubah ${g.name}`} title="Ubah">
                  <Pencil size={16} aria-hidden />
                </button>
                <button type="button" className={`${iconBtn} hover:text-danger`} onClick={() => setDeleting(g)} aria-label={`Hapus ${g.name}`} title="Hapus">
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {g.options.map((o) => (
                  <li key={o.id} className="rounded-full bg-bg-muted px-2.5 py-1 text-[12.5px] text-text-body">
                    {o.name}
                    {o.price ? <span className="text-text-muted"> +{formatRupiah(o.price)}</span> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {editing && <GroupEditor key={editing.key} groupId={editing.id} data={data} commit={commit} recipes={recipes} onClose={() => setEditing(null)} />}

      <ConfirmDialog
        open={!!deleting}
        title={`Hapus grup "${deleting?.name ?? ""}"?`}
        confirmLabel="Hapus grup"
        tone="danger"
        busy={busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        <p>
          {deleting && usage.get(deleting.id)
            ? `Grup ini dilepas otomatis dari ${usage.get(deleting.id)?.toLocaleString("id-ID")} produk yang memakainya.`
            : "Grup ini belum dipakai produk mana pun."}{" "}
          Riwayat transaksi tetap tersimpan.
        </p>
      </ConfirmDialog>
    </div>
  );
}

function rowsOf(g: ModifierGroup | undefined): OptRow[] {
  if (!g) return [{ id: newId(), name: "", price: 0, cost: null, recipe: [] }];
  return g.options.map((o) => ({ id: o.id, name: o.name, price: o.price, cost: o.cost_price ?? null, recipe: recipeItemsOf(o.recipe), orig: o }));
}

/** Tambah/ubah grup modifier. Dipakai juga dari form produk ("Buat grup modifier baru"): [onSaved] menerima id grup. */
export function GroupEditor({
  groupId,
  data,
  commit,
  recipes = null,
  onClose,
  onSaved,
}: {
  groupId: string | null;
  data: CatalogData;
  commit: (changes: Change[]) => Promise<CommitOutcome>;
  recipes?: RecipeSupport;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const toast = useToast();
  const [id] = useState(() => groupId ?? newId());
  const original = data.groups.find((g) => g.id === id);
  const [name, setName] = useState(original?.name ?? "");
  const [required, setRequired] = useState((original?.min_select ?? 0) > 0);
  const [max, setMax] = useState(original?.max_select ?? 1);
  const [rows, setRows] = useState<OptRow[]>(() => rowsOf(original));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [costing, setCosting] = useState<string | null>(null);
  const materials = new Map((recipes?.materials ?? []).map((m) => [m.id, m]));
  // Sama dengan aplikasi: resep tampil bila usaha memakai resep, atau ada opsi yang sudah ber-resep.
  const showRecipe = !!recipes && (recipes.showRecipe || rows.some((r) => r.recipe.length > 0));

  const setRow = (rid: string, patch: Partial<OptRow>) => setRows((rs) => rs.map((r) => (r.id === rid ? { ...r, ...patch } : r)));

  function reset(g: ModifierGroup | undefined) {
    setName(g?.name ?? "");
    setRequired((g?.min_select ?? 0) > 0);
    setMax(g?.max_select ?? 1);
    setRows(rowsOf(g));
  }

  async function save() {
    const errs: Record<string, string> = {};
    const n = name.trim();
    if (!n) errs.name = "Wajib diisi";
    else if (data.groups.some((g) => g.id !== id && norm(g.name) === norm(n))) errs.name = "Nama grup sudah dipakai";
    // Opsi tanpa nama dilewati (seperti aplikasi).
    const filled = rows.filter((r) => r.name.trim());
    if (!errs.name) {
      if (!filled.length) errs.options = "Isi minimal satu opsi.";
      else if (new Set(filled.map((r) => norm(r.name))).size !== filled.length) errs.options = "Nama opsi tidak boleh kembar.";
    }
    setErrors(errs);
    setNotice(null);
    if (Object.keys(errs).length) return;

    const options = filled.map((r) => ({ ...(r.orig ?? {}), id: r.id, name: r.name.trim(), price: r.price ?? 0, cost_price: r.cost, recipe: r.recipe }));
    const fields = { name: n, min_select: required ? 1 : 0, max_select: Math.min(Math.max(1, max), filled.length), options };
    const cur = data.groups.find((g) => g.id === id);
    const change = cur ? editChange("modifier_groups", cur, fields) : createChange("modifier_groups", fields, id);
    setBusy(true);
    try {
      const out = await commit([change]);
      const r = out.results[0];
      if (r?.status === "applied") {
        toast.success(cur ? "Grup modifier disimpan." : "Grup modifier ditambahkan.");
        onSaved?.(id);
        onClose();
      } else if (r?.status === "conflict") {
        reset(out.next.groups.find((g) => g.id === id));
        setNotice(CONFLICT_MESSAGE);
      } else {
        const fe = resultFieldErrors(r);
        setErrors(fe);
        setNotice(
          Object.entries(fe)
            .map(([k, m]) => (k === "_" ? m : `${fieldLabel(k)}: ${m}`))
            .join(" · ") || "Ditolak server."
        );
      }
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const seg = (on: boolean, label: string, pick: () => void) => (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={pick}
      className={`min-h-9 flex-1 rounded-[8px] px-3 text-[14px] font-semibold ${on ? "bg-white text-text-heading shadow-sm" : "text-text-muted hover:text-text-heading"}`}
    >
      {label}
    </button>
  );

  return (
    <Sheet
      open
      busy={busy}
      title={original ? "Ubah grup modifier" : "Tambah grup modifier"}
      onClose={onClose}
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
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {notice && (
          <Notice tone="warning" role="alert">
            {notice}
          </Notice>
        )}
        <Field id="mg-name" label="Nama grup" error={errors.name}>
          <input
            id="mg-name"
            className={inputClass}
            value={name}
            placeholder="Mis. Level gula"
            maxLength={LIMITS.modifierName}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={!!errors.name || undefined}
            autoFocus={!original}
          />
        </Field>
        <div role="radiogroup" aria-label="Wajib atau opsional" className="flex gap-1 rounded-[10px] bg-bg-muted p-1">
          {seg(!required, "Opsional", () => setRequired(false))}
          {seg(required, "Wajib", () => setRequired(true))}
        </div>
        {(original?.min_select ?? 0) > 1 && (
          <p className="text-[12.5px] text-warning">Data lama mewajibkan minimal {original?.min_select} pilihan; disimpan sebagai Wajib (minimal 1) seperti aplikasi.</p>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">Maksimal pilihan</p>
            <p className="text-[12.5px] text-text-muted">Berapa opsi yang boleh dipilih sekaligus</p>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Maksimal pilihan">
            <button type="button" className={iconBtn} onClick={() => setMax((m) => Math.max(1, m - 1))} disabled={max <= 1} aria-label="Kurangi">
              <Minus size={16} aria-hidden />
            </button>
            <span className="w-8 text-center text-[15px] font-semibold tabular-nums" aria-live="polite">
              {max}
            </span>
            <button type="button" className={iconBtn} onClick={() => setMax((m) => Math.min(LIMITS.modifierMaxSelect, m + 1))} disabled={max >= LIMITS.modifierMaxSelect} aria-label="Tambah">
              <Plus size={16} aria-hidden />
            </button>
          </div>
        </div>
        {max > Math.max(1, rows.filter((r) => r.name.trim()).length) && (
          <p className="text-[12.5px] text-text-muted">Disimpan maksimal {Math.max(1, rows.filter((r) => r.name.trim()).length)} (jumlah opsi).</p>
        )}
        <fieldset>
          <legend className="mb-2 text-[14px] font-semibold">Opsi</legend>
          {errors.options && <p className="mb-2 text-[13px] text-danger">{errors.options}</p>}
          <div className="space-y-2">
            {rows.map((r, i) => {
              const e = errors[`options[${i}].name`] ?? errors[`options[${i}].price`] ?? errors[`options[${i}].cost_price`] ?? errors[`options[${i}].recipe`];
              const label = r.name || `Opsi ${i + 1}`;
              const costText =
                r.cost !== null
                  ? `HPP ${formatRupiah(r.cost)} (manual)`
                  : r.recipe.length
                    ? recipes
                      ? `HPP ${formatRupiah(recipeCost(r.recipe, materials))} (resep)`
                      : "HPP dari resep"
                    : "HPP belum diisi";
              return (
                <div key={r.id}>
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
                    <input
                      aria-label={`Opsi ${i + 1}`}
                      className={`${inputClass} col-span-3 sm:col-span-1`}
                      placeholder="Mis. Less sugar"
                      value={r.name}
                      maxLength={LIMITS.modifierName}
                      aria-invalid={!!e || undefined}
                      onChange={(ev) => setRow(r.id, { name: ev.target.value })}
                    />
                    <MoneyInput label={`Harga tambahan ${label}`} value={r.price} onChange={(v) => setRow(r.id, { price: v })} placeholder="Harga tambahan (0)" />
                    <button
                      type="button"
                      onClick={() => setCosting(r.id)}
                      aria-label={`HPP ${label}: ${costText}`}
                      className={`flex min-h-10 items-center rounded-[10px] border border-border-subtle px-3 text-left text-[12.5px] hover:border-border-active ${
                        r.cost === null && !r.recipe.length ? "text-warning" : "text-text-body"
                      }`}
                    >
                      <span className="truncate">{costText}</span>
                    </button>
                    <button
                      type="button"
                      className={`${iconBtn} self-center`}
                      onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}
                      aria-label={`Hapus opsi ${label}`}
                      disabled={rows.length <= 1}
                    >
                      <Trash2 size={16} aria-hidden />
                    </button>
                  </div>
                  {e && <p className="mt-1 text-[12.5px] text-danger">{e}</p>}
                </div>
              );
            })}
          </div>
          {rows.length < LIMITS.modifierOptions && (
            <button type="button" className={`${btn.ghost} mt-2 -ml-2`} onClick={() => setRows((rs) => [...rs, { id: newId(), name: "", price: 0, cost: null, recipe: [] }])}>
              <Plus size={16} aria-hidden /> Tambah opsi
            </button>
          )}
        </fieldset>
        <button type="submit" className="sr-only" tabIndex={-1}>
          Simpan
        </button>
      </form>
      {costing &&
        (() => {
          const r = rows.find((x) => x.id === costing);
          if (!r) return null;
          return (
            <ModifierCostSheet
              optionName={r.name.trim() || "Mis. Less sugar"}
              price={r.price ?? 0}
              costPrice={r.cost}
              recipe={r.recipe}
              showRecipe={showRecipe}
              canDropRecipe={!!recipes}
              recipes={recipes}
              onClose={() => setCosting(null)}
              onSave={(c) => {
                setRow(r.id, { cost: c.cost, recipe: c.recipe });
                setCosting(null);
              }}
            />
          );
        })()}
    </Sheet>
  );
}

/**
 * HPP satu opsi modifier (`modifier_cost_sheet.dart`): Modal manual (modal per satuan; resep dibuang) atau Resep (bahan
 * per 1 porsi; `cost_price` null). [canDropRecipe] false = bahan baku tidak termuat → resep lama dipertahankan.
 */
function ModifierCostSheet({
  optionName,
  price,
  costPrice,
  recipe,
  showRecipe,
  canDropRecipe,
  recipes,
  onClose,
  onSave,
}: {
  optionName: string;
  price: number;
  costPrice: number | null;
  recipe: RecipeItem[];
  showRecipe: boolean;
  canDropRecipe: boolean;
  recipes: RecipeSupport;
  onClose: () => void;
  onSave: (c: { cost: number | null; recipe: RecipeItem[] }) => void;
}) {
  const [mode, setMode] = useState<CostMode>(showRecipe && costPrice === null && recipe.length ? "recipe" : "manual");
  const [cost, setCost] = useState<number | null>(costPrice);
  const [items, setItems] = useState<RecipeItem[]>(recipe);
  const manual = mode === "manual";
  return (
    <Sheet
      open
      title={optionName}
      subtitle={`HPP opsi · harga tambahan ${formatRupiah(price)}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className={btn.secondary} onClick={onClose}>
            Batal
          </button>
          <button type="button" className={btn.primary} onClick={() => onSave({ cost: manual ? cost : null, recipe: manual ? (canDropRecipe ? [] : recipe) : items })}>
            Simpan
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {showRecipe && <CostModeSwitch mode={mode} onChange={setMode} />}
        {manual ? (
          <>
            <Field id="mc-cost" label="Modal per satuan">
              <MoneyInput id="mc-cost" value={cost} onChange={setCost} placeholder="Opsional" />
            </Field>
            {cost !== null && price > 0 && <MarginLine price={price} cost={cost} unit="pcs" />}
            {recipe.length > 0 && canDropRecipe && <p className="text-[12.5px] text-text-muted">Resep akan dihapus saat disimpan karena sumber HPP diganti ke Modal manual.</p>}
          </>
        ) : (
          <>
            <p className="text-[12.5px] text-text-muted">Bahan yang terpakai per 1 porsi saat opsi ini dipilih. Stok bahan berkurang otomatis saat terjual.</p>
            {recipes && (
              <RecipeEditor
                targets={[{ key: "opsi", label: optionName, price, manualCost: null }]}
                recipes={{ opsi: items }}
                onChange={(r) => setItems(r.opsi ?? [])}
                materials={recipes.materials}
                createMaterial={recipes.createMaterial}
              />
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}
