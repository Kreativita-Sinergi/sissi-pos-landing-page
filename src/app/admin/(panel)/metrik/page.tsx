import type { Metadata } from "next";
import { MetricsView } from "@/components/admin/MetricsView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Metrik" };

export default function Page() {
  return <MetricsView />;
}
