// Tes unit peran Pelayan di dasbor web: `toEmployee` tidak menurunkan `waiter` menjadi kasir, label, dan catatan
// urutan rilis (aplikasi lama membuka peran tak dikenal sebagai Kasir).
// Kontrak: sissi-pos-service/docs/api.md "Peran Pelayan". Jalankan: npm test
import "./support/tsResolve.mjs";
import assert from "node:assert/strict";
import { test } from "node:test";

const { toEmployee, ROLE_LABEL, ROLE_HINT, WAITER_APP_NOTE, JOB_TITLE_PRESETS } = await import("../src/lib/owner/team.ts");

test("toEmployee: waiter tetap waiter; peran tak dikenal → cashier", () => {
  const base = { id: "e1", name: "Rina", is_active: true, personal_access: "none" };
  assert.equal(toEmployee({ ...base, role: "waiter" }).role, "waiter");
  assert.equal(toEmployee({ ...base, role: "aneh" }).role, "cashier");
});

test("label & catatan Pelayan", () => {
  assert.equal(ROLE_LABEL.waiter, "Pelayan");
  assert.match(ROLE_HINT.waiter, /Tidak menerima pembayaran/);
  assert.match(WAITER_APP_NOTE, /butuh aplikasi versi terbaru di semua perangkat/);
  assert.ok(!JOB_TITLE_PRESETS.includes("Pelayan"));
});
