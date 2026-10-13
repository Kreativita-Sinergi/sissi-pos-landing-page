import type { Metadata } from "next";
import { ActivityView } from "@/components/owner/ActivityView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Aktivitas" };

export default function Page() {
  return <ActivityView />;
}
