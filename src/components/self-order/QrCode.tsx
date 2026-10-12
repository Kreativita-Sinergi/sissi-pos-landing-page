"use client";

import React, { useEffect, useState } from "react";

// QR dirender sebagai satu <path> SVG. Pustaka (qrcode-generator, ±20 KB) dimuat hanya saat dibutuhkan.
export function QrCode({ value, label, size = 248 }: { value: string; label: string; size?: number }) {
  const [qr, setQr] = useState<{ value: string; count: number; path: string } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    import("qrcode-generator")
      .then(({ default: qrcode }) => {
        const code = qrcode(0, "M");
        code.addData(value);
        code.make();
        const count = code.getModuleCount();
        let path = "";
        for (let r = 0; r < count; r++) {
          for (let c = 0; c < count; c++) {
            if (code.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
          }
        }
        if (alive) setQr({ value, count, path });
      })
      .catch(() => {
        if (alive) setFailed(value);
      });
    return () => {
      alive = false;
    };
  }, [value]);

  const ready = qr && qr.value === value;
  const quiet = 4;

  return (
    <div
      className="flex items-center justify-center rounded-[16px] border border-border-subtle bg-white p-3"
      style={{ width: size, height: size }}
    >
      {ready ? (
        <svg
          role="img"
          aria-label={label}
          viewBox={`${-quiet} ${-quiet} ${qr.count + quiet * 2} ${qr.count + quiet * 2}`}
          width="100%"
          height="100%"
          shapeRendering="crispEdges"
        >
          <rect x={-quiet} y={-quiet} width={qr.count + quiet * 2} height={qr.count + quiet * 2} fill="#ffffff" />
          <path d={qr.path} fill="#000000" />
        </svg>
      ) : failed === value ? (
        <p className="px-4 text-center text-[14px] text-text-body">QR gagal dimuat. Muat ulang halaman.</p>
      ) : (
        <div className="h-full w-full animate-pulse rounded-[8px] bg-bg-muted" aria-hidden />
      )}
    </div>
  );
}
