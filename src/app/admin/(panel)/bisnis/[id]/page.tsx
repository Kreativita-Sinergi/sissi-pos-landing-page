import type { Metadata } from "next";
import { BusinessDetailView } from "@/components/admin/BusinessDetailView";

export const metadata: Metadata = { title: "Detail bisnis" };

export default function Page() {
  return <BusinessDetailView />;
}
