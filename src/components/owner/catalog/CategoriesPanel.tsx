"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowUp, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { btn, cardClass, EmptyState, errorMessage, Field, iconBtn, inputClass, Spinner } from "@/components/admin/ui";
import { createChange, deleteChange, editChange, LIMITS, norm, resultFieldErrors, sortCategories, type Category } from "@/lib/owner/catalog";
import type { Change } from "@/lib/owner/types";
import { reportOutcome } from "./bits";
import type { CatalogData, CommitOutcome } from "./useCatalog";

// Kategori: tambah, ganti nama, hapus, urutkan — sama dengan aplikasi (`categories_screen.dart`). Kategori baru dikirim
// hanya dengan nama (sort_order bawaan server 0, seperti aplikasi). Urutkan = `reorderCategories` aplikasi: indeks
// daftar baru menjadi `sort_order`, hanya baris yang berubah dikirim (satu commit).
// Hapus kategori di server mengosongkan category_id produknya (produk TIDAK ikut terhapus) → produk ditarik ulang.
// Tambah kategori lewat dialog kecil yang dibuka tombol "Tambah kategori" di kepala halaman (`creating` dari ProductsView).

export function CategoriesPanel({
  data,
  commit,
  refresh,
  creating,
  onCreate,
  onCreateClose,
}: {
  data: CatalogData;
  commit: (changes: Change[]) => Promise<CommitOutcome>;
  refresh: (keys: ("products" | "discounts")[]) => Promise<void>;
  /** Kunci dialog tambah yang sedang terbuka (null = tertutup). */
  creating: number | null;
  onCreate: () => void;
  onCreateClose: () => void;
}) {
  const toast = useToast();
  const list = sortCategories(data.categories);
  const [name, setName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; name: string; error?: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const counts = new Map<string, number>();
  for (const p of data.products) if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1);

  async function run(key: string, changes: Change[], ok: string) {
    setBusy(key);
    try {
      const out = await commit(changes);
      return { out, ok: reportOutcome(toast, out, ok) };
    } catch (err) {
      toast.error(errorMessage(err));
      return null;
    } finally {
      setBusy(null);
    }
  }

  function nameProblem(n: string, selfId?: string): string | null {
    if (!n) return "Wajib diisi";
    if (n.length > LIMITS.categoryName) return `Maksimal ${LIMITS.categoryName} karakter`;
    if (data.categories.some((c) => c.id !== selfId && norm(c.name) === norm(n))) return "Kategori dengan nama itu sudah ada";
    return null;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const problem = nameProblem(n);
    setAddError(problem);
    if (problem) return;
    const r = await run("add", [createChange("categories", { name: n })], `Kategori "${n}" ditambahkan.`);
    if (r?.ok) closeAdd();
    else if (r) setAddError(resultFieldErrors(r.out.results[0]).name ?? null);
  }

  function closeAdd() {
    setName("");
    setAddError(null);
    onCreateClose();
  }

  async function rename() {
    if (!editing) return;
    const cur = data.categories.find((c) => c.id === editing.id);
    const n = editing.name.trim();
    if (!cur) return setEditing(null);
    if (n === cur.name) return setEditing(null);
    const problem = nameProblem(n, cur.id);
    if (problem) return setEditing({ ...editing, error: problem });
    const r = await run(cur.id, [editChange("categories", cur, { name: n })], "Nama kategori disimpan.");
    if (r?.ok || r?.out.results[0]?.status === "conflict") setEditing(null);
    else if (r) setEditing({ ...editing, error: resultFieldErrors(r.out.results[0]).name ?? r.out.results[0]?.message });
  }

  async function move(index: number, delta: -1 | 1) {
    const next = [...list];
    const [c] = next.splice(index, 1);
    next.splice(index + delta, 0, c);
    const changes = next.flatMap((cat, i) => (cat.sort_order === i ? [] : [editChange("categories", cat, { sort_order: i })]));
    if (changes.length) await run("order", changes, "Urutan kategori disimpan.");
  }

  async function remove() {
    if (!deleting) return;
    const r = await run(`del-${deleting.id}`, [deleteChange("categories", deleting)], `Kategori "${deleting.name}" dihapus.`);
    setDeleting(null);
    if (r?.ok) {
      try {
        await refresh(["products"]);
      } catch {
        // Data produk akan tersegarkan saat halaman dimuat ulang.
      }
    }
  }

  return (
    <div className="space-y-4">
      <section className={`${cardClass} overflow-hidden`}>
        {list.length === 0 ? (
          <EmptyState
            icon={<FolderTree size={22} aria-hidden />}
            title="Belum ada kategori"
            action={
              <button type="button" className={btn.primary} onClick={onCreate}>
                <Plus size={16} aria-hidden /> Tambah kategori
              </button>
            }
          >
            Kategori membantu mengelompokkan produk di kasir.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border-subtle">
            {list.map((c, i) => {
              const isEditing = editing?.id === c.id;
              const n = counts.get(c.id) ?? 0;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 sm:px-5">
                  {isEditing ? (
                    <form
                      className="flex min-w-0 flex-1 flex-wrap items-start gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        rename();
                      }}
                    >
                      <div className="min-w-[180px] flex-1">
                        <input
                          aria-label={`Nama baru untuk ${c.name}`}
                          className={inputClass}
                          value={editing.name}
                          maxLength={LIMITS.categoryName}
                          autoFocus
                          aria-invalid={!!editing.error || undefined}
                          onChange={(e) => setEditing({ id: c.id, name: e.target.value })}
                          onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                        />
                        {editing.error && <p className="mt-1 text-[13px] text-danger">{editing.error}</p>}
                      </div>
                      <button type="submit" className={btn.primary} disabled={busy === c.id}>
                        {busy === c.id && <Spinner />} Simpan
                      </button>
                      <button type="button" className={btn.ghost} onClick={() => setEditing(null)}>
                        Batal
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold">{c.name}</p>
                        <p className="text-[12.5px] text-text-muted">{n.toLocaleString("id-ID")} produk</p>
                      </div>
                      <button
                        type="button"
                        className={iconBtn}
                        onClick={() => move(i, -1)}
                        disabled={i === 0 || !!busy}
                        aria-label={`Naikkan ${c.name}`}
                        title="Naikkan"
                      >
                        <ArrowUp size={16} aria-hidden />
                      </button>
                      <button
                        type="button"
                        className={iconBtn}
                        onClick={() => move(i, 1)}
                        disabled={i === list.length - 1 || !!busy}
                        aria-label={`Turunkan ${c.name}`}
                        title="Turunkan"
                      >
                        <ArrowDown size={16} aria-hidden />
                      </button>
                      <button type="button" className={iconBtn} onClick={() => setEditing({ id: c.id, name: c.name })} aria-label={`Ganti nama ${c.name}`} title="Ganti nama">
                        <Pencil size={16} aria-hidden />
                      </button>
                      <button type="button" className={`${iconBtn} hover:text-danger`} onClick={() => setDeleting(c)} aria-label={`Hapus ${c.name}`} title="Hapus">
                        <Trash2 size={16} aria-hidden />
                      </button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      <p className="text-[12.5px] text-text-muted">Urutan di sini sama dengan urutan tab kategori di kasir; ubah dengan tombol panah. Kategori baru diberi urutan awal (sama dengan aplikasi).</p>

      <Modal open={creating !== null} title="Tambah kategori" onClose={closeAdd} dismissible={busy !== "add"}>
        {creating !== null && (
          <form key={creating} onSubmit={add} noValidate className="flex flex-col gap-4">
            <Field id="cat-new" label="Nama kategori" hint="Mis. Minuman, Makanan, Camilan." error={addError ?? undefined}>
              <input
                id="cat-new"
                className={inputClass}
                value={name}
                maxLength={LIMITS.categoryName}
                autoFocus
                aria-invalid={!!addError || undefined}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className={btn.secondary} onClick={closeAdd} disabled={busy === "add"}>
                Batal
              </button>
              <button type="submit" className={btn.primary} disabled={busy === "add"}>
                {busy === "add" && <Spinner />} Tambah kategori
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        title={`Hapus kategori "${deleting?.name ?? ""}"?`}
        confirmLabel="Hapus kategori"
        tone="danger"
        busy={!!busy}
        onConfirm={remove}
        onClose={() => setDeleting(null)}
      >
        {deleting && (counts.get(deleting.id) ?? 0) > 0 ? (
          <p>
            {(counts.get(deleting.id) ?? 0).toLocaleString("id-ID")} produk di kategori ini akan menjadi <strong>Tanpa kategori</strong>. Produknya tidak ikut terhapus dan
            tetap bisa dijual.
          </p>
        ) : (
          <p>Kategori ini tidak berisi produk.</p>
        )}
        <p className="mt-2">Diskon yang menarget kategori ini tidak lagi berlaku untuknya.</p>
      </ConfirmDialog>
    </div>
  );
}
