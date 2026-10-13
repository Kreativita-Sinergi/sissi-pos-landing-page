import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

// Halaman yang butuh sesi admin. Suspense: halaman memakai useSearchParams/useParams (dirender di klien).
// AdminShell baru merender halaman setelah sesi diperiksa di browser, sehingga di server segmen halaman selalu
// "dropped" → Next 16 memperingatkan "Could not validate that a segment in your UI has instant navigation". Setiap
// page.tsx di grup ini mengekspor `instant = false` (opsi [ignore] yang direkomendasikan untuk segmen yang di-drop;
// `instant` di layout tidak menutup navigasi antar-halaman). Data dasbor memang dimuat di klien.
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
