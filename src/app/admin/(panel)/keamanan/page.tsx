import type { Metadata } from "next";
import { SecurityListView } from "@/components/admin/SecurityView";

export const metadata: Metadata = { title: "Keamanan" };

export default function Page() {
  return <SecurityListView />;
}
