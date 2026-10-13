import type { Metadata } from "next";
import { VersionView } from "@/components/admin/VersionView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Versi aplikasi" };

export default function Page() {
  return <VersionView />;
}
