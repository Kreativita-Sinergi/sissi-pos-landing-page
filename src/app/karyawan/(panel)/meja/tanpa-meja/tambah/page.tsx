import type { Metadata } from "next";
import { AddOrderView } from "@/components/staff/waiter/AddOrderView";

// Catat pesanan tanpa meja (baru: ?o=<outlet>; tambah ke pesanan tanpa meja: &s=<sale>).
export const instant = false;

export const metadata: Metadata = { title: "Catat pesanan" };

export default function Page() {
  return <AddOrderView tableId={null} />;
}
