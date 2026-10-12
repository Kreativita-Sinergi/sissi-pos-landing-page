"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { APK_LATEST_JSON_URL, APK_LATEST_URL } from "@/constants/site";

/** Isi `latest.json` (dibuat `sissi-app/tool/build_apk.sh`). */
type ApkInfo = {
  version: string;
  build: number;
  sizeBytes: number;
  sha256: string;
  releasedAt: string;
};

function parseInfo(raw: unknown): ApkInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (
    typeof r.version !== "string" ||
    typeof r.build !== "number" ||
    typeof r.size_bytes !== "number" ||
    typeof r.sha256 !== "string" ||
    !/^[0-9a-fA-F]{64}$/.test(r.sha256)
  ) {
    return null;
  }
  return {
    version: r.version,
    build: r.build,
    sizeBytes: r.size_bytes,
    sha256: r.sha256.toLowerCase(),
    releasedAt: typeof r.released_at === "string" ? r.released_at : "",
  };
}

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString("id-ID", { maximumFractionDigits: 1 })} MB`;
}

function formatDate(iso: string): string | null {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  });
}

/**
 * Tombol unduh + data versi yang dibaca saat runtime. Bila latest.json gagal dimuat,
 * tombol tetap tampil tanpa angka.
 */
export function ApkRelease() {
  const [info, setInfo] = useState<ApkInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(APK_LATEST_JSON_URL, { cache: "no-store", signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setInfo(parseInfo(json)))
      .catch(() => {
        // Diam: tombol unduh tetap berfungsi tanpa data versi.
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copySha = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.sha256);
      setCopied(true);
    } catch {
      // Clipboard ditolak browser: kode tetap bisa diseleksi manual.
    }
  };

  const date = info ? formatDate(info.releasedAt) : null;

  return (
    <div>
      <a
        href={APK_LATEST_URL}
        className="h-[52px] w-full sm:w-auto px-6 rounded-[10px] bg-[#292e31] hover:bg-[#1b2022] text-white font-semibold text-[16px] inline-flex items-center justify-center gap-2.5 transition-colors"
      >
        <Download className="w-5 h-5" aria-hidden />
        <span>Unduh APK</span>
      </a>

      {info && (
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
          <dt className="text-[#7d8986]">Versi</dt>
          <dd className="text-[#292e31] font-medium">
            {info.version}{" "}
            <span className="text-[#7d8986] font-normal">(build {info.build})</span>
          </dd>
          <dt className="text-[#7d8986]">Ukuran</dt>
          <dd className="text-[#292e31]">{formatSize(info.sizeBytes)}</dd>
          {date && (
            <>
              <dt className="text-[#7d8986]">Rilis</dt>
              <dd className="text-[#292e31]">{date}</dd>
            </>
          )}
          <dt className="text-[#7d8986] pt-1">SHA-256</dt>
          <dd className="min-w-0">
            <div className="flex items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-[13px] leading-relaxed text-[#525866] bg-[#f3f6f5] rounded-[6px] px-2.5 py-1.5">
                {info.sha256}
              </code>
              <button
                type="button"
                onClick={copySha}
                aria-label="Salin kode SHA-256"
                className="shrink-0 h-[34px] px-3 rounded-[6px] border border-[#e4e9e7] hover:bg-[#f3f6f5] text-[13px] font-medium text-[#292e31] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-[#be5823]" aria-hidden />
                ) : (
                  <Copy className="w-4 h-4" aria-hidden />
                )}
                <span aria-live="polite">{copied ? "Tersalin" : "Salin"}</span>
              </button>
            </div>
          </dd>
        </dl>
      )}
    </div>
  );
}
