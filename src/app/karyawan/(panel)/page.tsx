import type { Metadata } from "next";
import { ClockView } from "@/components/staff/ClockView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Absen" };

export default function Page() {
  return <ClockView />;
}
