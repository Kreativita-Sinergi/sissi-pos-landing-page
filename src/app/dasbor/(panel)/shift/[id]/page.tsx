import type { Metadata } from "next";
import { ShiftDetailView } from "@/components/owner/ShiftsView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Detail shift" };

export default function Page() {
  return <ShiftDetailView />;
}
