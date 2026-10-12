import type { Metadata } from "next";
import { CrashDetailView } from "@/components/admin/CrashView";

export const metadata: Metadata = { title: "Detail crash" };

export default function Page() {
  return <CrashDetailView />;
}
