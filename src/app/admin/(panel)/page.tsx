import type { Metadata } from "next";
import { SummaryView } from "@/components/admin/SummaryView";

export const metadata: Metadata = { title: "Ringkasan" };

export default function Page() {
  return <SummaryView />;
}
