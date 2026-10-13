import { Suspense } from "react";
import { OwnerShell } from "@/components/owner/OwnerShell";

// Halaman yang butuh sesi pemilik. Suspense: shell & halaman memakai useSearchParams/useParams (dirender di klien).
// OwnerShell baru merender halaman setelah sesi diperiksa di browser, sehingga di server segmen halaman selalu
// "dropped" → Next 16 memperingatkan "Could not validate that a segment in your UI has instant navigation". Setiap
// page.tsx di grup ini mengekspor `instant = false` (opsi [ignore] yang direkomendasikan untuk segmen yang di-drop;
// `instant` di layout tidak menutup navigasi antar-halaman). Data dasbor memang dimuat di klien.
export default function OwnerPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <OwnerShell>{children}</OwnerShell>
    </Suspense>
  );
}
