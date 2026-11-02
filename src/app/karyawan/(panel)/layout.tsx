import { Suspense } from "react";
import { StaffShell } from "@/components/staff/StaffShell";

// Halaman yang butuh sesi karyawan. Pola sama dengan dasbor/(panel): shell memeriksa sesi di browser, jadi setiap
// page.tsx di grup ini mengekspor `instant = false` (segmen dirender klien).
export default function StaffPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <StaffShell>{children}</StaffShell>
    </Suspense>
  );
}
