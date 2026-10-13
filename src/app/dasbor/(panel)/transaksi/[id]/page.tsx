import type { Metadata } from "next";
import { SaleDetailView } from "@/components/owner/SaleDetailView";

export const metadata: Metadata = { title: "Detail transaksi" };

export default function Page() {
  return <SaleDetailView />;
}
