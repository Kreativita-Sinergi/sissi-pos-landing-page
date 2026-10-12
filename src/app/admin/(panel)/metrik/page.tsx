import type { Metadata } from "next";
import { MetricsView } from "@/components/admin/MetricsView";

export const metadata: Metadata = { title: "Metrik" };

export default function Page() {
  return <MetricsView />;
}
