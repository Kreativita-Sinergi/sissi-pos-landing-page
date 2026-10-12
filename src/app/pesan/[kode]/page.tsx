import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SelfOrderApp, SelfOrderLoading } from "@/components/self-order/SelfOrderApp";

// Halaman Pesan & Bayar Mandiri (QR): pelanggan memindai QR meja/outlet → /pesan/<kode>.
// Kontrak: sissi-service/docs/api.md "Pesan & Bayar Mandiri (QR)". Halaman klien penuh — data diambil
// dari browser agar batas laju per IP di server akurat.

export const metadata: Metadata = {
  title: "Pesan menu · Sissi",
  description: "Pesan langsung dari meja.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function PesanPage({ params }: { params: Promise<{ kode: string }> }) {
  // Gerbang fitur: tanpa NEXT_PUBLIC_SELF_ORDER=1 rute ini tidak ada.
  if (process.env.NEXT_PUBLIC_SELF_ORDER !== "1") notFound();

  return (
    <Suspense fallback={<SelfOrderLoading />}>
      <SelfOrderApp params={params} />
    </Suspense>
  );
}
