import type { Metadata } from "next";
import { AuditView } from "@/components/admin/AuditView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Audit" };

export default function Page() {
  return <AuditView />;
}
