import type { Metadata } from "next";
import { ToastProvider } from "@/components/admin/toast";

// Admin platform (tim Sissi) — kasir.sissi.id/admin. Tidak ditautkan dari landing dan tidak diindeks.
// Semua halaman = komponen klien yang memanggil API langsung (cookie sesi milik apipos.sissi.id).
// Kontrak: sissi-service/docs/api.md bagian "Admin platform".
export const metadata: Metadata = {
  title: { default: "Admin · Sissi", template: "%s · Admin Sissi" },
  description: "Admin platform Sissi.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
