import type { Metadata } from "next";
import { CustomersView } from "@/components/owner/CustomersView";

export const metadata: Metadata = { title: "Pelanggan" };

export default function Page() {
  return <CustomersView />;
}
