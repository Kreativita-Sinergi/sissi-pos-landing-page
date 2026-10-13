import type { Metadata } from "next";
import { BusinessDetailView } from "@/components/admin/BusinessDetailView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Detail bisnis" };

export default function Page() {
  return <BusinessDetailView />;
}
