import type { Metadata } from "next";
import { StockView } from "@/components/owner/catalog/StockView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Stok" };

export default function Page() {
  return <StockView />;
}
