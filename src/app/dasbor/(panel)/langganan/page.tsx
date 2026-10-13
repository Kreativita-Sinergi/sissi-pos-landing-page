import type { Metadata } from "next";
import { SubscriptionView } from "@/components/owner/SubscriptionView";

export const metadata: Metadata = { title: "Langganan" };

export default function Page() {
  return <SubscriptionView />;
}
