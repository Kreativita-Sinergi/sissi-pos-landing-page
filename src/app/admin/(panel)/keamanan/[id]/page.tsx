import type { Metadata } from "next";
import { SecurityDetailView } from "@/components/admin/SecurityView";

export const metadata: Metadata = { title: "Laporan keamanan" };

export default function Page() {
  return <SecurityDetailView />;
}
