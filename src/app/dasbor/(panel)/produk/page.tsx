import type { Metadata } from "next";
import { ProductsView } from "@/components/owner/catalog/ProductsView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Produk" };

export default function Page() {
  return <ProductsView />;
}
