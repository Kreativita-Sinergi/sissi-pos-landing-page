import type { Metadata } from "next";
import { GrowthView } from "@/components/admin/GrowthView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Pertumbuhan merchant" };

export default function Page() {
  return <GrowthView />;
}
