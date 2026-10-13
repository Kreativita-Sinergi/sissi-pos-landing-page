import type { Metadata } from "next";
import { CrashDetailView } from "@/components/admin/CrashView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Detail crash" };

export default function Page() {
  return <CrashDetailView />;
}
