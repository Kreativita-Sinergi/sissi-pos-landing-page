import type { Metadata } from "next";
import { DeletionsView } from "@/components/admin/DeletionsView";

export const metadata: Metadata = { title: "Antrean hapus akun" };

export default function Page() {
  return <DeletionsView />;
}
