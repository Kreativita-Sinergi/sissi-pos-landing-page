import type { Metadata } from "next";
import { AccountView } from "@/components/admin/AccountView";

// Segmen dirender klien setelah sesi diperiksa (lihat layout grup (panel)) → di luar validasi instant navigation.
export const instant = false;

export const metadata: Metadata = { title: "Akun saya" };

export default function Page() {
  return <AccountView />;
}
