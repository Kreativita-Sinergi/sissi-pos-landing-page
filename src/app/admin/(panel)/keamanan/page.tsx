import type { Metadata } from "next";
import { SecurityListView } from "@/components/admin/SecurityView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Keamanan" };

export default function Page() {
  return <SecurityListView />;
}
