import type { Metadata } from "next";
import { BillingConfigView } from "@/components/admin/BillingConfigView";

export const metadata: Metadata = { title: "Cara bayar & harga" };

export default function Page() {
  return <BillingConfigView />;
}
