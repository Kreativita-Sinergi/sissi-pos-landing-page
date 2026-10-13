import type { Metadata } from "next";
import { CustomersView } from "@/components/owner/CustomersView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Pelanggan" };

export default function Page() {
  return <CustomersView />;
}
