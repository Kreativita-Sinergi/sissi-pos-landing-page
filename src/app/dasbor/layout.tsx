import type { Metadata } from "next";

// Dasbor pemilik (tahap 1, hanya baca) — kasir.sissi.id/dasbor. Tidak diindeks.
// Semua halaman = komponen klien yang memanggil API langsung (cookie sesi milik domain API).
// Kontrak: sissi-service/docs/api.md bagian "Dasbor pemilik (web)".
export const metadata: Metadata = {
  title: { default: "Dasbor · Sissi", template: "%s · Dasbor Sissi" },
  description: "Dasbor pemilik usaha Sissi.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function DasborLayout({ children }: { children: React.ReactNode }) {
  return children;
}
