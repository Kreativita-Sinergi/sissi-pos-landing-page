import type { Metadata } from "next";
import { AddOrderView } from "@/components/staff/waiter/AddOrderView";

export const instant = false;

export const metadata: Metadata = { title: "Catat pesanan" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AddOrderView tableId={id} />;
}
