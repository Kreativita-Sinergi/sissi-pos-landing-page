import type { Metadata } from "next";
import { TablesView } from "@/components/staff/waiter/TablesView";

// Menu Meja pelayan (api.md "Pelayan lewat web"). Segmen dirender klien setelah sesi diperiksa.
export const instant = false;

export const metadata: Metadata = { title: "Meja" };

export default function Page() {
  return <TablesView />;
}
