import type { Metadata } from "next";
import { TableView } from "@/components/staff/waiter/TableView";

export const instant = false;

export const metadata: Metadata = { title: "Rincian meja" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TableView tableId={id} />;
}
