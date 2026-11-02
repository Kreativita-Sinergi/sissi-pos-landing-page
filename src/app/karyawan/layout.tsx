import type { Metadata } from "next";

// Web karyawan (absen) — kasir.sissi.id/karyawan. Tidak diindeks, tidak ada di sitemap. Sama untuk semua peran
// (kasir, dapur, staff): hanya absen & riwayat. Semua halaman = komponen klien yang memanggil API langsung
// (cookie sesi `__Host-sissi_staff` milik domain API; terpisah dari sesi pemilik /dasbor).
// Kontrak: sissi-pos-service/docs/api.md bagian "Absen karyawan lewat web".
export const metadata: Metadata = {
  title: { default: "Absen karyawan · Sissi", template: "%s · Karyawan Sissi" },
  description: "Absen masuk & pulang karyawan Sissi lewat website.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default function KaryawanLayout({ children }: { children: React.ReactNode }) {
  return children;
}
