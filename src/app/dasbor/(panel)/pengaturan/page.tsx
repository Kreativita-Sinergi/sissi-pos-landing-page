import type { Metadata } from "next";
import { SettingsView } from "@/components/owner/SettingsView";

export const metadata: Metadata = { title: "Pengaturan" };

export default function Page() {
  return <SettingsView />;
}
