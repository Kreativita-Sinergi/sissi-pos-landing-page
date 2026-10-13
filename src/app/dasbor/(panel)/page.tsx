import type { Metadata } from "next";
import { HomeView } from "@/components/owner/HomeView";

export const metadata: Metadata = { title: "Beranda" };

export default function Page() {
  return <HomeView />;
}
