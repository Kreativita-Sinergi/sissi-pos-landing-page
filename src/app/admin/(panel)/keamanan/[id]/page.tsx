import type { Metadata } from "next";
import { SecurityDetailView } from "@/components/admin/SecurityView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Laporan keamanan" };

export default function Page() {
  return <SecurityDetailView />;
}
