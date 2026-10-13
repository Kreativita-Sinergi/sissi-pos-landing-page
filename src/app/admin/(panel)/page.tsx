import type { Metadata } from "next";
import { SummaryView } from "@/components/admin/SummaryView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Ringkasan" };

export default function Page() {
  return <SummaryView />;
}
