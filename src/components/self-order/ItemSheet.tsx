"use client";

import React, { useMemo, useRef, useState } from "react";
import { Check } from "lucide-react";
import { MAX_QTY, NOTE_MAX, lineKey, type CartLine, type CartModifier } from "@/lib/selfOrder/cart";
import { formatRupiah } from "@/lib/selfOrder/pricing";
import type { MenuProduct, MenuVariant, ModifierGroup } from "@/lib/selfOrder/types";
import { Sheet } from "./Sheet";
import { Stepper, inputClass, primaryButton } from "./ui";

type Dim = { name: string; values: string[] };

// Produk tanpa `variant_options` tetapi punya varian → satu dimensi "Pilihan" berisi nama varian.
function dimensionsOf(product: MenuProduct): { dims: Dim[]; valueOf: (v: MenuVariant, dim: string) => string } {
  if (product.variant_options.length > 0) {
    return { dims: product.variant_options, valueOf: (v, dim) => v.options[dim] };
  }
  const sorted = [...product.variants].sort((a, b) => a.sort_order - b.sort_order);
  return { dims: [{ name: "Pilihan", values: sorted.map((v) => v.name) }], valueOf: (v) => v.name };
}

function initialSelection(product: MenuProduct, dims: Dim[], valueOf: (v: MenuVariant, d: string) => string) {
  const sorted = [...product.variants].sort((a, b) => a.sort_order - b.sort_order);
  const first = sorted.find((v) => !v.sold_out);
  const sel: Record<string, string> = {};
  if (first) for (const d of dims) sel[d.name] = valueOf(first, d.name);
  return sel;
}

function maxOf(group: ModifierGroup): number {
  return group.max_select > 0 ? group.max_select : group.options.length;
}

function groupRule(group: ModifierGroup): string {
  const max = maxOf(group);
  if (group.min_select > 0) {
    if (group.min_select === max) return `Wajib · pilih ${max}`;
    return `Wajib · pilih ${group.min_select}–${max}`;
  }
  return max === 1 ? "Opsional · pilih 1" : `Opsional · maks. ${max}`;
}

export function ItemSheet({
  product,
  inCart,
  onAdd,
  onClose,
}: {
  product: MenuProduct | null;
  inCart: number;
  onAdd: (line: CartLine) => void;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={!!product}
      onClose={onClose}
      title={product?.name ?? ""}
      subtitle={product?.description || undefined}
    >
      {product && <ItemForm key={product.id} product={product} inCart={inCart} onAdd={onAdd} />}
    </Sheet>
  );
}

function ItemForm({
  product,
  inCart,
  onAdd,
}: {
  product: MenuProduct;
  inCart: number;
  onAdd: (line: CartLine) => void;
}) {
  const { dims, valueOf } = useMemo(() => dimensionsOf(product), [product]);
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    initialSelection(product, dims, valueOf)
  );
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const groupRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});

  const hasVariants = product.variants.length > 0;
  const available = product.variants.filter((v) => !v.sold_out);
  const variant = hasVariants
    ? (product.variants.find((v) => dims.every((d) => valueOf(v, d.name) === selection[d.name])) ?? null)
    : null;

  // ok = tersedia dengan pilihan lain saat ini; conflict = ada, tetapi mengganti pilihan lain; none = habis/tidak ada.
  const valueState = (dim: string, value: string): "ok" | "conflict" | "none" => {
    const withValue = available.filter((v) => valueOf(v, dim) === value);
    if (withValue.length === 0) return "none";
    const compatible = withValue.some((v) =>
      dims.every((d) => d.name === dim || !selection[d.name] || valueOf(v, d.name) === selection[d.name])
    );
    return compatible ? "ok" : "conflict";
  };

  const choose = (dim: string, value: string) => {
    const next = { ...selection, [dim]: value };
    const exact = available.find((v) => dims.every((d) => valueOf(v, d.name) === next[d.name]));
    if (exact || dims.length === 1) {
      setSelection(next);
      return;
    }
    // Kombinasi tidak tersedia: ambil varian tersedia dengan nilai ini yang paling mirip pilihan sebelumnya.
    const candidates = available.filter((v) => valueOf(v, dim) === value);
    const score = (v: MenuVariant) => dims.filter((d) => valueOf(v, d.name) === selection[d.name]).length;
    const best = candidates.sort((a, b) => score(b) - score(a))[0];
    if (best) setSelection(Object.fromEntries(dims.map((d) => [d.name, valueOf(best, d.name)])));
  };

  const toggle = (group: ModifierGroup, optionId: string) => {
    const current = picks[group.id] ?? [];
    const max = maxOf(group);
    let next: string[];
    if (current.includes(optionId)) {
      next = current.filter((id) => id !== optionId);
    } else if (max === 1) {
      next = [optionId];
    } else if (current.length < max) {
      next = [...current, optionId];
    } else {
      return;
    }
    setPicks({ ...picks, [group.id]: next });
  };

  const unmet = product.modifier_groups.filter((g) => (picks[g.id]?.length ?? 0) < g.min_select);
  const unitPrice = variant?.price ?? product.price;
  const modifiersTotal = product.modifier_groups.reduce(
    (sum, g) =>
      sum + (picks[g.id] ?? []).reduce((s, id) => s + (g.options.find((o) => o.id === id)?.price ?? 0), 0),
    0
  );
  const lineTotal = (unitPrice + modifiersTotal) * quantity;
  const variantBlocked = hasVariants && (!variant || variant.sold_out);
  const soldOut = product.sold_out || (hasVariants && available.length === 0);

  const submit = () => {
    if (soldOut || variantBlocked) return;
    if (unmet.length > 0) {
      setShowErrors(true);
      const el = groupRefs.current[unmet[0].id];
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true });
      return;
    }
    // Urutan modifier mengikuti urutan grup & opsi di menu.
    const modifiers: CartModifier[] = product.modifier_groups.flatMap((g) =>
      g.options.filter((o) => picks[g.id]?.includes(o.id)).map((o) => ({ groupId: g.id, optionId: o.id }))
    );
    onAdd({
      key: lineKey(product.id, variant?.id ?? null, modifiers, note),
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity,
      note: note.trim(),
      modifiers,
      name: product.name,
      variantName: variant?.name ?? null,
    });
  };

  return (
    <div className="flex flex-col gap-6 pb-1">
      {product.image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- gambar dari API (domain bebas), tanpa optimasi.
        <img
          src={variant?.image_url || product.image_url}
          alt=""
          className="aspect-[4/3] w-full rounded-[14px] bg-bg-muted object-cover"
        />
      )}

      {hasVariants &&
        dims.map((dim) => (
          <fieldset key={dim.name}>
            <legend className="mb-2.5 flex w-full items-baseline justify-between gap-3">
              <span className="text-[17px] font-semibold">{dim.name}</span>
              <span className="text-[13px] font-medium text-text-muted">Wajib · pilih 1</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {dim.values.map((value) => {
                const state = valueState(dim.name, value);
                const selected = selection[dim.name] === value;
                const price =
                  dims.length === 1
                    ? product.variants.find((v) => valueOf(v, dim.name) === value)?.price
                    : undefined;
                return (
                  <label
                    key={value}
                    className={`relative inline-flex min-h-[48px] cursor-pointer items-center gap-2 rounded-[12px] border-2 px-4 text-[16px] font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-primary ${
                      selected
                        ? "border-brand-primary bg-brand-tint text-text-heading"
                        : state === "none"
                          ? "cursor-not-allowed border-border-subtle bg-bg-muted text-text-muted line-through"
                          : state === "conflict"
                            ? "border-dashed border-border-active bg-white text-text-body"
                            : "border-border-subtle bg-white text-text-heading"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`dim-${dim.name}`}
                      value={value}
                      checked={selected}
                      disabled={state === "none"}
                      onChange={() => choose(dim.name, value)}
                      aria-describedby={state === "conflict" ? `hint-${dim.name}` : undefined}
                    />
                    {selected && <Check size={16} aria-hidden className="text-brand-dark" />}
                    <span>{value}</span>
                    {price !== undefined && state !== "none" && (
                      <span className="text-[14px] text-text-body">{formatRupiah(price)}</span>
                    )}
                    {state === "none" && <span className="text-[13px] no-underline">· Habis</span>}
                  </label>
                );
              })}
            </div>
            {dims.length > 1 && dim.values.some((v) => valueState(dim.name, v) === "conflict") && (
              <p id={`hint-${dim.name}`} className="mt-2 text-[13px] text-text-muted">
                Pilihan bergaris putus mengganti pilihan lain yang tidak tersedia bersamanya.
              </p>
            )}
          </fieldset>
        ))}

      {product.modifier_groups.map((group) => {
        const max = maxOf(group);
        const chosen = picks[group.id] ?? [];
        const error = showErrors && chosen.length < group.min_select;
        const single = max === 1;
        return (
          <fieldset
            key={group.id}
            ref={(el) => {
              groupRefs.current[group.id] = el;
            }}
            aria-describedby={error ? `err-${group.id}` : undefined}
            aria-invalid={error || undefined}
          >
            <legend className="mb-2.5 flex w-full items-baseline justify-between gap-3">
              <span className="text-[17px] font-semibold">{group.name}</span>
              <span
                className={`shrink-0 text-[13px] font-medium ${
                  error ? "text-danger" : group.min_select > 0 ? "text-text-heading" : "text-text-muted"
                }`}
              >
                {groupRule(group)}
              </span>
            </legend>
            <div
              className={`overflow-hidden rounded-[14px] border ${error ? "border-danger" : "border-border-subtle"}`}
            >
              {group.options.map((option, i) => {
                const checked = chosen.includes(option.id);
                const full = !single && !checked && chosen.length >= max;
                return (
                  <label
                    key={option.id}
                    className={`flex min-h-[52px] cursor-pointer items-center gap-3 px-4 has-[:focus-visible]:bg-brand-tint ${
                      i > 0 ? "border-t border-border-subtle" : ""
                    } ${full ? "cursor-not-allowed text-text-muted" : ""}`}
                  >
                    <input
                      type={single ? "radio" : "checkbox"}
                      name={`mod-${group.id}`}
                      checked={checked}
                      disabled={full}
                      onChange={() => toggle(group, option.id)}
                      onClick={(e) => {
                        // Radio opsional bisa dikosongkan dengan mengetuk lagi.
                        if (single && checked && group.min_select === 0) {
                          e.preventDefault();
                          toggle(group, option.id);
                        }
                      }}
                      className="h-5 w-5 shrink-0 accent-brand-primary"
                    />
                    <span className="flex-1 text-[16px]">{option.name}</span>
                    {option.price > 0 && (
                      <span className="text-[15px] tabular-nums text-text-body">+{formatRupiah(option.price)}</span>
                    )}
                  </label>
                );
              })}
            </div>
            {error && (
              <p id={`err-${group.id}`} className="mt-2 text-[14px] font-medium text-danger">
                {group.min_select === 1
                  ? `Pilih ${group.name.toLowerCase()} dulu.`
                  : `Pilih minimal ${group.min_select} ${group.name.toLowerCase()}.`}
              </p>
            )}
            {!single && chosen.length >= max && (
              <p className="mt-2 text-[13px] text-text-muted">Sudah maksimal {max} pilihan.</p>
            )}
          </fieldset>
        );
      })}

      <div>
        <label htmlFor={`note-${product.id}`} className="mb-2 block text-[17px] font-semibold">
          Catatan <span className="font-normal text-text-muted">(opsional)</span>
        </label>
        <textarea
          id={`note-${product.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
          maxLength={NOTE_MAX}
          rows={2}
          placeholder="Contoh: es sedikit, tidak pedas"
          className={`${inputClass} resize-none py-3`}
        />
      </div>

      <div className="sticky bottom-0 -mx-5 -mb-4 flex flex-col gap-3 border-t border-border-subtle bg-white px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
        {variantBlocked && !soldOut && (
          <p role="status" className="text-[14px] font-medium text-danger">
            Kombinasi ini sedang habis. Pilih yang lain.
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-text-body">
            Jumlah{inCart > 0 && <span className="text-text-muted"> · {inCart} di keranjang</span>}
          </span>
          <Stepper value={quantity} max={MAX_QTY} onChange={setQuantity} label={product.name} size="lg" />
        </div>
        <button
          type="button"
          className={primaryButton}
          onClick={submit}
          disabled={soldOut || variantBlocked}
          aria-disabled={unmet.length > 0 || undefined}
        >
          {soldOut ? (
            "Habis"
          ) : (
            <>
              <span>Tambah ke keranjang</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{formatRupiah(lineTotal)}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

