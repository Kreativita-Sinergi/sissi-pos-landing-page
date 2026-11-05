"use client";

import React, { createContext, useContext } from "react";
import { createPortal } from "react-dom";

// Slot tombol aksi di kepala halaman (PageHeader `actions`) yang diisi komponen anak lewat portal. Dipakai bila tombol
// harus tetap dimiliki bagian yang memegang state/dialognya (mis. "PO baru" di PurchaseTab) tetapi tampil sejajar judul.
//
//   const [slot, setSlot] = useState<HTMLElement | null>(null);
//   <PageHeader actions={<HeaderActionsSlot ref={setSlot} />} />
//   <HeaderActionsProvider value={slot}>…<HeaderActions><button/></HeaderActions>…</HeaderActionsProvider>

const SlotCtx = createContext<HTMLElement | null>(null);

export const HeaderActionsProvider = SlotCtx.Provider;

/** Wadah kosong di PageHeader; `display: contents` agar tombol portal ikut tata letak flex PageHeader. */
export function HeaderActionsSlot({ ref }: { ref: React.Ref<HTMLSpanElement> }) {
  return <span ref={ref} className="contents" />;
}

/** Render anak ke slot kepala halaman (tidak tampil sampai slot terpasang). */
export function HeaderActions({ children }: { children: React.ReactNode }) {
  const slot = useContext(SlotCtx);
  return slot ? createPortal(children, slot) : null;
}
