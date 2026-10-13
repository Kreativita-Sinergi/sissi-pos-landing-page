import type { Metadata } from "next";
import { SubscriptionView } from "@/components/owner/SubscriptionView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Langganan" };

export default function Page() {
  return <SubscriptionView />;
}
