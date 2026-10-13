import type { Metadata } from "next";
import { ProductsView } from "@/components/owner/catalog/ProductsView";

export const metadata: Metadata = { title: "Produk" };

export default function Page() {
  return <ProductsView />;
}
