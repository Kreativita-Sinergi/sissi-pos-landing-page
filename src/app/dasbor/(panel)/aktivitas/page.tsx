import type { Metadata } from "next";
import { ActivityView } from "@/components/owner/ActivityView";

export const metadata: Metadata = { title: "Aktivitas" };

export default function Page() {
  return <ActivityView />;
}
