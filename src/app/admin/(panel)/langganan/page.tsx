import type { Metadata } from "next";
import { SubscriptionListView } from "@/components/admin/SubscriptionListView";

export const metadata: Metadata = { title: "Langganan" };

export default function Page() {
  return <SubscriptionListView />;
}
