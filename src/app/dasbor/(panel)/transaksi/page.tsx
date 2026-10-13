import type { Metadata } from "next";
import { SalesView } from "@/components/owner/SalesView";

export const metadata: Metadata = { title: "Transaksi" };

export default function Page() {
  return <SalesView />;
}
