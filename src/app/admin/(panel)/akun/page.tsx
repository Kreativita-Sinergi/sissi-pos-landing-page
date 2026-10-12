import type { Metadata } from "next";
import { AccountView } from "@/components/admin/AccountView";

export const metadata: Metadata = { title: "Akun saya" };

export default function Page() {
  return <AccountView />;
}
