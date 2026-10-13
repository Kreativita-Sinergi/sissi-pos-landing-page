import type { Metadata } from "next";
import { SettingsView } from "@/components/owner/SettingsView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Pengaturan" };

export default function Page() {
  return <SettingsView />;
}
