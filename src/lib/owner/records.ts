// Menulis data usaha dari dasbor lewat POST /owner/changes (mesin sync yang sama dengan aplikasi).
// Data juga diubah aplikasi kasir yang bisa offline, jadi setiap edit:
//  - mengirim SELURUH field data record (kunci yang tidak dikenal web tetap utuh),
//  - memakai `base_updated_at` = `updated_at` record yang diedit (server menang bila lebih baru → `conflict`).
import { ApiError } from "@/lib/sissiApi";
import { pushChanges } from "./api";
import type { ChangeResult, OwnerPlan, SyncRecord, WritableEntity } from "./types";

/** Kolom sistem yang tidak dikirim balik ke server. */
const SYSTEM_KEYS = new Set(["id", "business_id", "created_at", "updated_at", "deleted_at"]);

/** Field data record (tanpa kolom sistem) untuk dikirim ulang utuh. */
export function recordData(rec: SyncRecord | null | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!rec) return out;
  for (const [k, v] of Object.entries(rec)) if (!SYSTEM_KEYS.has(k)) out[k] = v;
  return out;
}

export const CONFLICT_MESSAGE = "Data ini baru diubah di perangkat lain — sudah dimuat ulang.";

export type SaveOutcome =
  | { status: "applied"; record: SyncRecord | null }
  | { status: "conflict"; record: SyncRecord | null; message: string }
  | { status: "rejected"; record: SyncRecord | null; message: string; details: { field: string; message: string }[] };

function outcomeOf(r: ChangeResult | undefined): SaveOutcome {
  if (!r) return { status: "rejected", record: null, message: "Server tidak mengembalikan hasil.", details: [] };
  if (r.status === "applied") return { status: "applied", record: r.record ?? null };
  if (r.status === "conflict") return { status: "conflict", record: r.record ?? null, message: CONFLICT_MESSAGE };
  return {
    status: "rejected",
    record: r.record ?? null,
    message: r.message || "Perubahan ditolak server.",
    details: r.details ?? [],
  };
}

/**
 * Simpan satu record. `base` = record yang sedang diedit (null = record baru, tanpa `base_updated_at`).
 * `patch` digabung di atas seluruh field data `base`. Galat jaringan / 422 permintaan dilempar sebagai ApiError.
 */
export async function saveRecord(
  entity: WritableEntity,
  id: string,
  base: SyncRecord | null,
  patch: Record<string, unknown>
): Promise<SaveOutcome> {
  const data = { ...recordData(base), ...patch };
  const [r] = await pushChanges([
    base ? { entity, op: "upsert", id, data, base_updated_at: base.updated_at } : { entity, op: "upsert", id, data },
  ]);
  return outcomeOf(r);
}

/** Hapus (soft delete) satu record. */
export async function deleteRecord(entity: WritableEntity, base: SyncRecord): Promise<SaveOutcome> {
  const [r] = await pushChanges([{ entity, op: "delete", id: base.id, base_updated_at: base.updated_at }]);
  return outcomeOf(r);
}

/** Pesan galat per kolom dari hasil `rejected` (field → pesan). */
export function detailMap(details: { field: string; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const d of details) if (d.field && !out[d.field]) out[d.field] = d.message;
  return out;
}

/**
 * Kunci fitur Pro tersedia? Terkunci hanya bila langganan ditegakkan (`enforced`) dan kunci tidak ada di `features`
 * (api.md "Dasbor pemilik › Paket di web").
 */
export function hasFeature(plan: Pick<OwnerPlan, "enforced" | "features">, key: string): boolean {
  return !plan.enforced || plan.features.includes(key);
}

/** Pesan galat simpan: untuk 422 permintaan (mis. metode pembayaran outlet berubah) pakai pesan per kolom dari server. */
export function saveErrorText(err: unknown, fallback: (e: unknown) => string): string {
  if (err instanceof ApiError && err.details.length) {
    const msgs = [...new Set(err.details.map((d) => d.message).filter(Boolean))];
    if (msgs.length) return msgs.join(" ");
  }
  return fallback(err);
}
