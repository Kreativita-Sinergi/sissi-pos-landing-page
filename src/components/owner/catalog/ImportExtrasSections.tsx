"use client";

import React, { useState } from "react";
import { Badge, formatRupiah, inputClass } from "@/components/admin/ui";
import { formatQty, parseQty } from "@/lib/owner/catalog";
import {
  costPerUnit,
  groupValid,
  looksPerKiloOrLiter,
  MATERIAL_ISSUE_TEXT,
  materialKey,
  noteText,
  SHEET_KIND_LABEL,
  suggestedPack,
  type ImportAnalysis,
  type ImportMaterial,
  type SheetKind,
} from "@/lib/owner/productImport";

// Bagian pratinjau impor Excel (sama dengan `import_extras_cards.dart` aplikasi): isi berkas, bahan baku (+ isi kemasan
// harga beli), pilihan ekstra, dan baris lembar tambahan yang dilewati.

const PREVIEW = 6;

function Collapsible<T>({ items, render }: { items: T[]; render: (item: T, i: number) => React.ReactNode }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <>
      <ul className="divide-y divide-border-subtle rounded-[12px] border border-border-subtle">{shown.map(render)}</ul>
      {items.length > PREVIEW && (
        <button type="button" className="mt-1.5 text-[13px] font-semibold text-brand-ink hover:underline" onClick={() => setAll((v) => !v)}>
          {all ? "Tampilkan lebih sedikit" : `Lihat semua (${items.length.toLocaleString("id-ID")})`}
        </button>
      )}
    </>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2">
      <p className="text-[14px] font-semibold text-text-heading">{title}</p>
      {hint && <p className="text-[12.5px] text-text-muted">{hint}</p>}
    </div>
  );
}

/** Ringkasan isi berkas Excel: jumlah per jenis + lembar yang dibaca/diabaikan. */
export function ImportContents({ a }: { a: ImportAnalysis }) {
  const x = a.file.extras;
  const rows = a.file.rows;
  const counts = [
    `${rows.length.toLocaleString("id-ID")} produk`,
    rows.reduce((n, r) => n + r.variants.length, 0) ? `${rows.reduce((n, r) => n + r.variants.length, 0).toLocaleString("id-ID")} varian` : null,
    x.materials.length ? `${x.materials.length.toLocaleString("id-ID")} bahan baku` : null,
    rows.filter((r) => r.recipe.length).length ? `${rows.filter((r) => r.recipe.length).length.toLocaleString("id-ID")} produk beresep` : null,
    x.modifierGroups.filter(groupValid).length ? `${x.modifierGroups.filter(groupValid).length.toLocaleString("id-ID")} grup pilihan ekstra` : null,
  ].filter(Boolean);
  const sheets = (Object.entries(x.sheets) as [SheetKind, string[]][]).map(([k, names]) => `${names.join(", ")} (${SHEET_KIND_LABEL[k]})`);
  if (!x.productSheet) return null;
  return (
    <div className="rounded-[12px] bg-bg-muted px-4 py-3 text-[13.5px] text-text-body">
      <p className="font-semibold text-text-heading">Isi berkas</p>
      <p className="mt-0.5">{counts.join(" · ")}</p>
      <p className="mt-0.5 text-[12.5px] text-text-muted">Dibaca dari lembar: {sheets.join(" · ")}</p>
      {x.ignoredSheets.length > 0 && <p className="mt-0.5 text-[12.5px] text-text-muted">Lembar tidak dikenali dan diabaikan: {x.ignoredSheets.join(", ")}</p>}
    </div>
  );
}

/** Bahan baku dari berkas; bahan baru berharga beli bisa diatur isi kemasannya (harga disimpan per 1 satuan). */
export function ImportMaterials({ a, packs, onPack }: { a: ImportAnalysis; packs: Map<string, number>; onPack: (key: string, milli: number) => void }) {
  const list = a.file.extras.materials;
  if (!list.length) return null;
  const perKilo = list.filter((m) => !a.materials.has(materialKey(m)) && looksPerKiloOrLiter(m) && (packs.get(materialKey(m)) ?? suggestedPack(m)) === 1_000_000).length;
  return (
    <section>
      <SectionTitle
        title={`Bahan baku (${list.length.toLocaleString("id-ID")})`}
        hint="Bahan baru dibuat; bahan bernama sama yang sudah ada dipakai tanpa diubah. Atur isi kemasan bila harga beli bukan per 1 satuan."
      />
      {perKilo > 0 && (
        <p className="mb-2 text-[12.5px] text-warning">
          {perKilo} harga beli terlalu besar untuk per gram/ml, jadi kami anggap harga per 1 kg/liter. Ubah isi kemasannya bila salah.
        </p>
      )}
      <Collapsible items={list} render={(m) => <MaterialItem key={m.line} m={m} existing={a.materials.has(materialKey(m))} pack={packs.get(materialKey(m)) ?? suggestedPack(m)} onPack={(v) => onPack(materialKey(m), v)} />} />
    </section>
  );
}

function MaterialItem({ m, existing, pack, onPack }: { m: ImportMaterial; existing: boolean; pack: number; onPack: (milli: number) => void }) {
  const [text, setText] = useState(formatQty(pack));
  const parsed = parseQty(text);
  const invalid = parsed === null || parsed <= 0;
  const cost = m.cost ?? 0;
  return (
    <li className="px-3 py-2.5 text-[13.5px]">
      <p className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-text-heading">{m.name}</span>
        <span className="text-text-muted">· {m.unit}</span>
        {existing && <Badge tone="brand">Sudah ada, dipakai</Badge>}
      </p>
      {!existing && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-text-body">
          {m.cost === null ? (
            <span className="text-text-muted">Harga beli kosong</span>
          ) : (
            <>
              <span>{formatRupiah(cost)} per</span>
              <input
                type="text"
                inputMode="decimal"
                aria-label={`Isi kemasan ${m.name} (${m.unit})`}
                aria-invalid={invalid || undefined}
                className={`${inputClass} min-h-8 w-24 px-2 text-[13px] tabular-nums`}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  const q = parseQty(e.target.value);
                  if (q !== null && q > 0) onPack(q);
                }}
              />
              <span>{m.unit}</span>
              <span className="text-text-muted">
                → {formatRupiah(costPerUnit(m, pack))}/{m.unit}
              </span>
              {invalid && <span className="text-danger">Isi kemasan harus angka lebih dari 0.</span>}
            </>
          )}
          {m.minStock > 0 && (
            <span className="text-text-muted">
              · Stok min. {formatQty(m.minStock)} {m.unit}
            </span>
          )}
        </div>
      )}
      {m.issues.length > 0 && <p className="mt-0.5 text-[12.5px] text-warning">{m.issues.map((i) => MATERIAL_ISSUE_TEXT[i](m)).join(" · ")}</p>}
    </li>
  );
}

/** Grup pilihan ekstra dari berkas. */
export function ImportModifiers({ a }: { a: ImportAnalysis }) {
  const list = a.file.extras.modifierGroups.filter(groupValid);
  if (!list.length) return null;
  return (
    <section>
      <SectionTitle
        title={`Pilihan ekstra (${list.length.toLocaleString("id-ID")})`}
        hint="Grup baru dibuat lalu dipasang ke produknya; grup bernama sama yang sudah ada dipakai tanpa diubah."
      />
      <Collapsible
        items={list}
        render={(g) => (
          <li key={g.line} className="px-3 py-2.5 text-[13.5px]">
            <p className="flex flex-wrap items-center gap-1.5">
              <span className="font-semibold text-text-heading">{g.name}</span>
              <span className="text-text-muted">· {g.singleChoice ? "Pilih satu" : "Boleh lebih dari satu"}</span>
              {g.usedBy > 0 && <span className="text-text-muted">· dipakai {g.usedBy} produk</span>}
              {a.modifierGroups.has(g.name.toLowerCase()) && <Badge tone="brand">Sudah ada, dipakai</Badge>}
            </p>
            <p className="mt-0.5 text-[12.5px] text-text-body">{g.options.map((o) => (o.price ? `${o.name} (+${formatRupiah(o.price)})` : o.name)).join(", ")}</p>
          </li>
        )}
      />
    </section>
  );
}

/** Baris lembar tambahan yang dilewati. */
export function ImportNotes({ a }: { a: ImportAnalysis }) {
  const notes = a.file.extras.notes;
  if (!notes.length) return null;
  return (
    <section>
      <SectionTitle
        title={`Baris dilewati (${notes.length.toLocaleString("id-ID")})`}
        hint="Baris ini tidak ikut diimpor. Perbaiki di berkas bila perlu, lalu pilih ulang berkasnya."
      />
      <Collapsible
        items={notes}
        render={(n, i) => (
          <li key={i} className="px-3 py-2 text-[12.5px] text-warning">
            {noteText(n)}
          </li>
        )}
      />
    </section>
  );
}
