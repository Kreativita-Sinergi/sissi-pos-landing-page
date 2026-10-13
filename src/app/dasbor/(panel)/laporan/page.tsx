import type { Metadata } from "next";
import { ReportView } from "@/components/owner/ReportView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Laporan" };

export default function Page() {
  return <ReportView />;
}
