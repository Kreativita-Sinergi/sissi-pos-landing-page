import type { Metadata } from "next";
import { ApkView } from "@/components/admin/ApkView";

export const metadata: Metadata = { title: "APK" };

export default function Page() {
  return <ApkView />;
}
