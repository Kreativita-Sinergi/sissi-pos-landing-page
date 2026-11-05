import { Suspense } from "react";
import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { ApprovalDecision } from "./ApprovalDecision";

// Persetujuan pemilik lewat email (batal/refund dari kasir): tautan `/setujui/<token>` di email pemilik → rincian
// permintaan + Setujui / Tolak, tanpa login (tautan rahasia sekali pakai, 30 menit).
// Kontrak: sissi-pos-service/docs/api.md "Persetujuan pemilik lewat email" (GET/POST /approval-links/{token}).

export const metadata: Metadata = {
  title: "Persetujuan pemilik · Sissi",
  description: "Setujui atau tolak permintaan kasir.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  referrer: "no-referrer",
};

export default function SetujuiPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f3f6f5]">
      <Navbar isLight />
      <main className="flex-1 pt-28 pb-20 sm:pb-24">
        <Container>
          <div className="mx-auto max-w-[560px]">
            <Suspense
              fallback={
                <div
                  role="status"
                  aria-label="Memuat permintaan"
                  className="h-72 animate-pulse rounded-[16px] bg-white"
                />
              }
            >
              <Decision params={params} />
            </Suspense>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

async function Decision({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ApprovalDecision token={token} />;
}
