import type { Metadata } from "next";
import { OutletsView } from "@/components/owner/OutletsView";

export const metadata: Metadata = { title: "Outlet" };

export default function Page() {
  return <OutletsView />;
}
