import type { Metadata } from "next";
import { BillingConfigView } from "@/components/admin/BillingConfigView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Cara bayar & harga" };

export default function Page() {
  return <BillingConfigView />;
}
