import type { Metadata } from "next";
import { BusinessListView } from "@/components/admin/BusinessListView";

export const metadata: Metadata = { title: "Bisnis" };

export default function Page() {
  return <BusinessListView />;
}
