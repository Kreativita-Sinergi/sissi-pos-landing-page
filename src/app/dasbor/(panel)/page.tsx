import type { Metadata } from "next";
import { HomeView } from "@/components/owner/HomeView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Beranda" };

export default function Page() {
  return <HomeView />;
}
