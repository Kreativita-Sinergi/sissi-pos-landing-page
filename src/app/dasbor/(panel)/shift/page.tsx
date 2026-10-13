import type { Metadata } from "next";
import { ShiftsView } from "@/components/owner/ShiftsView";

export const metadata: Metadata = { title: "Shift & kas" };

export default function Page() {
  return <ShiftsView />;
}
