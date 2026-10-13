import type { Metadata } from "next";
import { CrashListView } from "@/components/admin/CrashView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Crash" };

export default function Page() {
  return <CrashListView />;
}
