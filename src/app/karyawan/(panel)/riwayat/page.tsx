import type { Metadata } from "next";
import { HistoryView } from "@/components/staff/HistoryView";

export const instant = false;

export const metadata: Metadata = { title: "Riwayat kehadiran" };

export default function Page() {
  return <HistoryView />;
}
