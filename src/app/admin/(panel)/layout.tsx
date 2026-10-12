import { Suspense } from "react";
import { AdminShell } from "@/components/admin/AdminShell";

// Halaman yang butuh sesi admin. Suspense: halaman memakai useSearchParams/useParams (dirender di klien).
export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
