import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_TITLE = "Sissi POS · Kasir yang tetap jalan saat internet mati";
const SITE_DESCRIPTION =
  "Aplikasi kasir Android untuk kuliner, ritel, jasa, dan penyewaan. Jualan, stok, varian & HPP, QRIS, dan layar dapur dalam satu aplikasi. Tetap jalan offline, sinkron otomatis antarperangkat.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://kasir.sissi.id"
  ),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "aplikasi kasir",
    "aplikasi kasir offline",
    "POS Android",
    "kasir UMKM",
    "kasir kafe",
    "kasir QRIS",
    "layar dapur",
    "HPP resep",
    "Sissi POS",
  ],
  authors: [{ name: "Sissi" }],
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: "Sissi POS",
    images: [
      {
        url: "/images/og-sissi-2026.jpg",
        width: 1200,
        height: 630,
        alt: "Sissi POS — Internet mati, kasir tetap jalan. Layar Kasir di tablet dan Layar dapur di HP.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/images/og-sissi-2026.jpg"],
  },
  // Favicon: berkas konvensi Next di src/app (favicon.ico, icon.png, apple-icon.png).
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="id"
      className={`${geistSans.variable} ${geistMono.variable} scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
