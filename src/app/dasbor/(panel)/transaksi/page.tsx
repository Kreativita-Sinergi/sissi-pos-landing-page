import type { Metadata } from "next";
import { SalesView } from "@/components/owner/SalesView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Transaksi" };

export default function Page() {
  return <SalesView />;
}
