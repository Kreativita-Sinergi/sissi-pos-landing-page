import type { Metadata } from "next";
import { DeletionsView } from "@/components/admin/DeletionsView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Antrean hapus akun" };

export default function Page() {
  return <DeletionsView />;
}
