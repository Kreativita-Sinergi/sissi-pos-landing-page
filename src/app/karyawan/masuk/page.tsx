import type { Metadata } from "next";
import { Suspense } from "react";
import { StaffLoginView } from "@/components/staff/StaffLoginView";

export const metadata: Metadata = { title: "Masuk karyawan" };

// Suspense: StaffLoginView memakai useSearchParams (?next=) dan dirender di klien.
export default function KaryawanMasukPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <StaffLoginView />
    </Suspense>
  );
}
