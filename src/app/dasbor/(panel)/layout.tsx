import { Suspense } from "react";
import { OwnerShell } from "@/components/owner/OwnerShell";

// Halaman yang butuh sesi pemilik. Suspense: shell & halaman memakai useSearchParams/useParams (dirender di klien).
export default function OwnerPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <OwnerShell>{children}</OwnerShell>
    </Suspense>
  );
}
