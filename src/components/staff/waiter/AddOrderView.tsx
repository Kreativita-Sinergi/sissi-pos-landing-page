"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { Spinner } from "@/components/admin/ui";
import { useStaff } from "@/components/staff/StaffShell";
import { CartBar } from "@/components/self-order/CartSheet";
import { ItemSheet } from "@/components/self-order/ItemSheet";
import { MenuView } from "@/components/self-order/MenuView";
import { Sheet } from "@/components/self-order/Sheet";
import { Frame, Stepper, focusRing, primaryButton } from "@/components/self-order/ui";
import { addLine, countItems, MAX_QTY, resolveLine, setQuantity, toOrderItems, type CartLine } from "@/lib/selfOrder/cart";
import { computeBreakdown, formatRupiah } from "@/lib/selfOrder/pricing";
import type { Menu, MenuProduct } from "@/lib/selfOrder/types";
import { newKey, staffApi, StaffApiError } from "@/lib/staff/api";
import type { WaiterCustomer } from "@/lib/staff/types";
import { OrderFor } from "./OrderFor";
import { pickOutlet, waiterEnabled, waiterErrorText } from "./shared";
import { NO_TABLE } from "./TableView";

// Tambah pesanan pelayan (/karyawan/meja/[id]/tambah): menu & lembar item sama dengan halaman pesan QR, keranjang
// disimpan per meja (localStorage) agar tidak hilang saat koneksi putus. Kirim → POST /staff/waiter/orders (meja
// kosong) atau …/orders/{id}/items (pesanan berjalan). Label tombol mengikuti aplikasi: "Kirim pesanan" /
// "Kirim tambahan (n item)".

const cartKey = (table: string) => `sissi-staff:waiter-cart:${table}`;

function loadCart(table: string): CartLine[] {
  try {
    const raw = localStorage.getItem(cartKey(table));
    const v = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function saveCart(table: string, lines: CartLine[]) {
  try {
    if (lines.length) localStorage.setItem(cartKey(table), JSON.stringify(lines));
    else localStorage.removeItem(cartKey(table));
  } catch {
    // abaikan
  }
}

export function AddOrderView({ tableId }: { tableId: string | null }) {
  const { session } = useStaff();
  const params = useSearchParams();
  const router = useRouter();
  const [outlet] = useState<string | null>(() => pickOutlet(session, params.get("o")));
  const [saleId, setSaleId] = useState<string | null>(params.get("s"));
  const [tableName, setTableName] = useState<string>("");
  // Pesanan baru: meja (bisa diganti atau Tanpa meja) + pelanggan/nama tamu, seperti keranjang app.
  const [pickTable, setPickTable] = useState<string | null>(tableId);
  const [tables, setTables] = useState<{ id: string; name: string; busy: boolean }[]>([]);
  const [customer, setCustomer] = useState<WaiterCustomer | null>(null);
  const [guestName, setGuestName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  // Kunci keranjang tetap sejak layar dibuka (meja, pesanan tanpa meja, atau keranjang tanpa meja baru).
  const [cartId] = useState(() => tableId ?? (params.get("s") ? `s:${params.get("s")}` : NO_TABLE));
  const [menu, setMenu] = useState<Menu | null>(null);
  const [error, setError] = useState<unknown>(null);
  // Keranjang per meja dari localStorage (shell merender anak hanya di browser setelah sesi diperiksa).
  const [lines, setLines] = useState<CartLine[]>(() => loadCart(cartId));
  const [product, setProduct] = useState<MenuProduct | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Kunci idempotensi per isi keranjang: kirim ulang setelah galat jaringan memakai kunci yang sama.
  const keyRef = useRef<{ sig: string; key: string } | null>(null);

  useEffect(() => saveCart(cartId, lines), [cartId, lines]);

  const load = useCallback(async () => {
    if (!outlet) return;
    const api = await staffApi();
    setError(null);
    try {
      const [m, floor] = await Promise.all([api.waiterMenu(outlet), api.waiterFloor(outlet)]);
      setMenu(m);
      const t = floor.tables.find((x) => x.id === tableId);
      setTableName(t?.name ?? "");
      setTables(floor.tables.map((x) => ({ id: x.id, name: x.name, busy: x.orders.length > 0 })));
      // Meja yang ternyata sudah terisi (perangkat lain baru membuka pesanan) → tambahkan ke pesanan itu.
      if (!params.get("s") && t?.orders[0]) setSaleId(t.orders[0].id);
    } catch (err) {
      setError(err);
    }
  }, [outlet, tableId, params]);

  // Muat di luar badan efek (aturan react-hooks/set-state-in-effect); dibatalkan bila efek dibersihkan.
  useEffect(() => {
    let live = true;
    void Promise.resolve().then(() => {
      if (live) void load();
    });
    return () => {
      live = false;
    };
  }, [load]);

  const resolved = useMemo(() => (menu ? lines.map((l) => resolveLine(l, menu)) : []), [menu, lines]);
  const breakdown = useMemo(
    () => (menu ? computeBreakdown(resolved.filter((l) => !l.issue), menu.pricing, "dine_in") : null),
    [menu, resolved]
  );
  const quantities = useMemo(() => {
    const q: Record<string, number> = {};
    for (const l of lines) q[l.productId] = (q[l.productId] ?? 0) + l.quantity;
    return q;
  }, [lines]);
  const count = countItems(lines);
  const blocked = resolved.some((l) => l.issue);
  const back = (id: string | null, sale: string | null) =>
    id ? `/karyawan/meja/${id}?o=${outlet ?? ""}` : sale ? `/karyawan/meja/pesanan/${sale}?o=${outlet ?? ""}` : "/karyawan/meja";
  const backHref = back(tableId, params.get("s"));

  async function send() {
    if (!outlet || lines.length === 0 || blocked) return;
    const name = guestName.trim();
    if (!saleId && !pickTable && !customer && !name) {
      setNameError("Isi nama tamu untuk pesanan tanpa meja");
      return;
    }
    setSending(true);
    setSendError(null);
    setNameError(null);
    const items = toOrderItems(lines);
    const sig = JSON.stringify([saleId, pickTable, customer?.id, name, items]);
    if (keyRef.current?.sig !== sig) keyRef.current = { sig, key: newKey() };
    const key = keyRef.current.key;
    try {
      const api = await staffApi();
      let dest: string;
      if (saleId) {
        await api.waiterAddItems(saleId, items, key);
        dest = backHref;
      } else {
        const o = await api.waiterCreate(
          { outlet_id: outlet, table_id: pickTable, customer_id: customer?.id ?? null, customer_name: name, items },
          key
        );
        dest = back(pickTable, o.id);
      }
      setLines([]);
      saveCart(cartId, []);
      keyRef.current = null;
      router.replace(dest);
    } catch (err) {
      if (err instanceof StaffApiError && err.code === "TABLE_OCCUPIED" && err.details[0]?.message) {
        // Meja baru saja dibuka perangkat lain: keranjang tetap, kirim berikutnya menambah ke pesanan itu.
        setSaleId(err.details[0].message);
        keyRef.current = null;
        setSendError("Meja ini baru saja dibuka perangkat lain. Ketuk kirim lagi untuk menambahkan ke pesanan itu.");
      } else if (err instanceof StaffApiError && err.code === "OUT_OF_STOCK") {
        keyRef.current = null;
        setSendError("Ada item yang habis atau tidak lagi tersedia. Periksa keranjang lalu coba lagi.");
        void load();
      } else if (err instanceof StaffApiError && err.details.some((d) => d.field === "customer_name")) {
        setNameError(err.details.find((d) => d.field === "customer_name")?.message ?? "Isi nama tamu");
      } else {
        setSendError(waiterErrorText(err));
      }
    } finally {
      setSending(false);
    }
  }

  if (!waiterEnabled(session)) return <p className="p-4 text-[15px] text-text-body">Menu Meja hanya untuk Pelayan.</p>;

  const header = (
    <header className="bg-white px-4 pt-4 pb-4">
      <Link
        href={backHref}
        className={`-ml-1 inline-flex min-h-10 items-center gap-1.5 rounded-[10px] px-1 text-[14px] font-semibold text-text-body hover:text-text-heading ${focusRing}`}
      >
        <ArrowLeft size={17} aria-hidden /> Kembali
      </Link>
      <h1 className="mt-1 text-[22px] font-extrabold leading-tight tracking-tight text-text-heading">
        {saleId ? "Tambah pesanan" : "Catat pesanan"}
      </h1>
      <p className="text-[15px] text-text-body">{tableId ? tableName || "Meja" : "Tanpa meja"}</p>
    </header>
  );

  if (!menu) {
    return (
      <Frame>
        {header}
        <div className="px-4 py-10">
          {error ? (
            <div role="alert" className="rounded-[14px] border border-danger/25 bg-danger-tint px-4 py-3 text-[15px] text-danger">
              {waiterErrorText(error)}{" "}
              <button type="button" onClick={() => void load()} className={`font-semibold underline ${focusRing}`}>
                Coba lagi
              </button>
            </div>
          ) : (
            <p role="status" className="flex items-center gap-2 text-[14px] text-text-muted">
              <Spinner /> Memuat menu…
            </p>
          )}
        </div>
      </Frame>
    );
  }

  const sendLabel = saleId ? `Kirim tambahan (${count} item)` : "Kirim pesanan";

  return (
    <>
      <MenuView
        menu={menu}
        quantities={quantities}
        onOpen={setProduct}
        header={header}
        cartBar={<CartBar count={count} total={breakdown?.total ?? 0} onOpen={() => setCartOpen(true)} />}
      />
      <ItemSheet
        product={product}
        inCart={product ? (quantities[product.id] ?? 0) : 0}
        onClose={() => setProduct(null)}
        onAdd={(line) => {
          setLines((ls) => addLine(ls, line));
          setProduct(null);
        }}
      />
      <Sheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={saleId ? "Tambahan" : "Pesanan"}
        subtitle={saleId ? (tableId ? tableName : "Tanpa meja") || undefined : undefined}
        footer={
          <div className="flex flex-col gap-2">
            {sendError && (
              <div role="alert" className="rounded-[12px] border border-danger/25 bg-danger-tint px-4 py-3 text-[15px] leading-relaxed text-danger">
                {sendError}
              </div>
            )}
            <button type="button" onClick={send} disabled={sending || count === 0 || blocked} className={primaryButton}>
              {sending ? <Spinner size={18} /> : <Send size={18} aria-hidden />} {sendLabel}
            </button>
          </div>
        }
      >
        {!saleId && (
          <OrderFor
            tables={tables}
            table={pickTable}
            onTable={(id) => {
              setPickTable(id);
              setNameError(null);
            }}
            customer={customer}
            onCustomer={setCustomer}
            guestName={guestName}
            onGuestName={(v) => {
              setGuestName(v);
              setNameError(null);
            }}
            nameError={nameError}
          />
        )}
        {resolved.length === 0 ? (
          <p className="py-6 text-center text-[15px] text-text-body">Belum ada item.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-so-line">
            {resolved.map((l) => (
              <li key={l.key} className="flex items-start gap-3 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-bold leading-snug text-text-heading">
                    {l.name}
                    {l.variantName ? ` (${l.variantName})` : ""}
                  </p>
                  {l.modifierNames.length > 0 && <p className="text-[14px] text-text-body">{l.modifierNames.join(", ")}</p>}
                  {l.note && <p className="text-[14px] text-text-body italic">“{l.note}”</p>}
                  {l.issue ? (
                    <p className="mt-1 text-[14px] font-semibold text-danger">
                      {l.issue === "sold_out" ? "Sedang habis — hapus dari keranjang" : "Tidak lagi tersedia — hapus dari keranjang"}
                    </p>
                  ) : (
                    <p className="mt-1 text-[15px] font-semibold tabular-nums text-text-heading">
                      {formatRupiah((l.unitPrice + l.modifiersTotal) * l.quantity)}
                    </p>
                  )}
                </div>
                <Stepper
                  value={l.quantity}
                  max={MAX_QTY}
                  removable
                  label={l.name}
                  onChange={(q) => setLines((ls) => setQuantity(ls, l.key, q))}
                />
              </li>
            ))}
          </ul>
        )}
        {breakdown && breakdown.subtotal > 0 && (
          <dl className="mt-2 flex flex-col gap-1.5 border-t border-so-line pt-3 text-[15px]">
            <div className="flex justify-between text-text-body">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatRupiah(breakdown.subtotal)}</dd>
            </div>
            {breakdown.serviceFee > 0 && (
              <div className="flex justify-between text-text-body">
                <dt>Biaya layanan</dt>
                <dd className="tabular-nums">{formatRupiah(breakdown.serviceFee)}</dd>
              </div>
            )}
            {breakdown.taxTotal > 0 && (
              <div className="flex justify-between text-text-body">
                <dt>Pajak</dt>
                <dd className="tabular-nums">{formatRupiah(breakdown.taxTotal)}</dd>
              </div>
            )}
            <div className="flex justify-between text-[17px] font-bold text-text-heading">
              <dt>Perkiraan total</dt>
              <dd className="tabular-nums">{formatRupiah(breakdown.total)}</dd>
            </div>
          </dl>
        )}
      </Sheet>
    </>
  );
}
