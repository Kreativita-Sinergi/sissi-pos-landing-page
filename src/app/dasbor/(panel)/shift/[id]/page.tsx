import type { Metadata } from "next";
import { ShiftDetailView } from "@/components/owner/ShiftsView";

export const metadata: Metadata = { title: "Detail shift" };

export default function Page() {
  return <ShiftDetailView />;
}
