import type { Metadata } from "next";
import { TableView } from "@/components/staff/waiter/TableView";

// Pesanan tanpa meja (api.md "Pelayan lewat web" › `untabled`).
export const instant = false;

export const metadata: Metadata = { title: "Pesanan tanpa meja" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TableView saleId={id} />;
}
