import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Admin platform (/admin): jangan diindeks, jangan dibingkai situs lain, jangan bocorkan URL lewat Referer.
  async headers() {
    const adminHeaders = [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "same-origin" },
      { key: "Cache-Control", value: "no-store" },
    ];
    // Dasbor pemilik (/dasbor) & halaman masuknya (/masuk): sama seperti admin. /masuk memakai
    // Referrer-Policy bawaan peramban (strict-origin-when-cross-origin) karena tombol Google Identity
    // Services memeriksa origin halaman lewat Referer. Belum ada Content-Security-Policy di situs ini;
    // bila kelak ditambah, izinkan https://accounts.google.com (script, frame, connect) dan origin API.
    const ownerHeaders = adminHeaders;
    const loginHeaders = adminHeaders.map((h) =>
      h.key === "Referrer-Policy" ? { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" } : h
    );
    return [
      { source: "/admin", headers: adminHeaders },
      { source: "/admin/:path*", headers: adminHeaders },
      { source: "/dasbor", headers: ownerHeaders },
      { source: "/dasbor/:path*", headers: ownerHeaders },
      { source: "/masuk", headers: loginHeaders },
      // Undangan karyawan: kode sekali pakai ada di URL → jangan diindeks/di-cache, jangan bocor lewat Referer.
      { source: "/undangan/:path*", headers: adminHeaders.map((h) => (h.key === "Referrer-Policy" ? { ...h, value: "no-referrer" } : h)) },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
