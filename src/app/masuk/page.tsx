import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "@/components/owner/LoginView";

export const metadata: Metadata = {
  title: "Masuk dasbor | Sissi",
  description: "Masuk ke dasbor web Sissi untuk memantau penjualan, outlet, dan kas usahamu.",
  robots: { index: false, follow: true },
};

// Login dasbor pemilik (kontrak: sissi-service/docs/api.md "Dasbor pemilik (web)").
// Suspense: LoginView memakai useSearchParams (?next=) dan dirender di klien.
export default function MasukPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <LoginView />
    </Suspense>
  );
}
