import type { Metadata } from "next";
import { VersionView } from "@/components/admin/VersionView";

export const metadata: Metadata = { title: "Versi aplikasi" };

export default function Page() {
  return <VersionView />;
}
