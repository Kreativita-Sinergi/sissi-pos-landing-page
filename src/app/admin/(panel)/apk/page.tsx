import type { Metadata } from "next";
import { ApkView } from "@/components/admin/ApkView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "APK" };

export default function Page() {
  return <ApkView />;
}
