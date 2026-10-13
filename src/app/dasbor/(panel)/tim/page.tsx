import type { Metadata } from "next";
import { TeamView } from "@/components/owner/TeamView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Tim" };

export default function Page() {
  return <TeamView />;
}
