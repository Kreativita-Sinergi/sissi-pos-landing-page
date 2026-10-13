import type { Metadata } from "next";
import { StockView } from "@/components/owner/catalog/StockView";

export const metadata: Metadata = { title: "Stok" };

export default function Page() {
  return <StockView />;
}
