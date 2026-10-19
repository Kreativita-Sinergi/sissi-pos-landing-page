"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

/** Kode undangan besar + tombol salin (tanda hubung ikut tersalin; aplikasi mengabaikannya). */
export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <output
        aria-label="Kode"
        className="min-w-0 rounded-[12px] border border-[#e4e9e7] bg-[#f3f6f5] px-4 py-3 font-mono text-[22px] font-bold tracking-[0.12em] break-all text-[#292e31] select-all sm:text-[26px]"
      >
        {code}
      </output>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          } catch {
            // Clipboard ditolak — kode tetap bisa dipilih manual (select-all).
          }
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e4e9e7] bg-white px-4 text-[15px] font-semibold text-[#292e31] hover:bg-[#f3f6f5] focus:ring-2 focus:ring-[#f1702c] focus:ring-offset-2 focus:outline-none"
      >
        {copied ? <Check size={18} aria-hidden className="text-[#12805c]" /> : <Copy size={18} aria-hidden />}
        <span aria-live="polite">{copied ? "Tersalin" : "Salin kode"}</span>
      </button>
    </div>
  );
}
