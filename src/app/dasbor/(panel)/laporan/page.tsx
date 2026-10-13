import type { Metadata } from "next";
import { ReportView } from "@/components/owner/ReportView";

export const metadata: Metadata = { title: "Laporan" };

export default function Page() {
  return <ReportView />;
}
