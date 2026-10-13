import type { Metadata } from "next";
import { ShiftsView } from "@/components/owner/ShiftsView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Shift & kas" };

export default function Page() {
  return <ShiftsView />;
}
