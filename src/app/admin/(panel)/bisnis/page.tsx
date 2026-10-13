import type { Metadata } from "next";
import { BusinessListView } from "@/components/admin/BusinessListView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Bisnis" };

export default function Page() {
  return <BusinessListView />;
}
