import type { Metadata } from "next";
import { CrashListView } from "@/components/admin/CrashView";

export const metadata: Metadata = { title: "Crash" };

export default function Page() {
  return <CrashListView />;
}
