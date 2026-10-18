"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import {
  APK_LATEST_JSON_URL,
  APK_LATEST_URL,
  APK_MIRROR_URL,
  MIN_ANDROID,
  PLAY_STORE_URL,
} from "@/constants/site";

/** Isi `latest.json` (dibuat `sissi-app/tool/build_apk.sh`). */
type ApkInfo = {
  version: string;
  build: number;
  sizeBytes: number;
  sha256: string;
  releasedAt: string;
};

type LoadState =
  | { status: "loading" }
  | { status: "ready"; info: ApkInfo }
  | { status: "failed" };

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

const ANDROID_REQ = `${MIN_ANDROID}+`;
const PILL =
  "h-[30px] px-3 rounded-full text-[14px] inline-flex items-center whitespace-nowrap";

/**
 * Kartu unduhan APK. Data versi dibaca saat runtime dari `latest.json`; bila gagal,
 * server unduhan (nginx yang sama dengan APK) dianggap bermasalah → tombol utama
 * beralih ke folder Google Drive cadangan, server utama tetap bisa dicoba.
 */
export function ApkRelease({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(APK_LATEST_JSON_URL, { cache: "no-store", signal: ctrl.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const info = parseInfo(json);
        setState(info ? { status: "ready", info } : { status: "failed" });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState({ status: "failed" });
      });
    return () => ctrl.abort();
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const info = state.status === "ready" ? state.info : null;
  const useMirror = state.status === "failed";

  const copySha = async () => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(info.sha256);
      setCopied(true);
    } catch {
      // Clipboard ditolak browser: kode lengkap tetap ada di atribut title.
    }
  };

  const date = info ? formatDate(info.releasedAt) : null;

  return (
    <div className="rounded-[16px] border border-border-subtle bg-white shadow-so-card overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-8 p-6 sm:p-8">
          {children}

          <div className="mt-6" aria-busy={state.status === "loading"}>
            {state.status === "loading" && (
              <div className="flex flex-wrap gap-2" aria-hidden>
                {[96, 72, 132, 104].map((w) => (
                  <span
                    key={w}
                    className="h-[30px] rounded-full bg-bg-muted animate-pulse"
                    style={{ width: w }}
                  />
                ))}
              </div>
            )}

            {state.status === "failed" && (
              <>
                <ul className="flex flex-wrap items-center gap-2" aria-label="Info rilis">
                  <li className={`${PILL} bg-bg-muted text-text-body`}>
                    {ANDROID_REQ}
                  </li>
                </ul>
                <p className="mt-4 text-[14px] text-text-body">
                  Server unduhan kami sedang bermasalah. Untuk sementara, unduh
                  dari folder Google Drive: buka foldernya, pilih berkas{" "}
                  <span className="font-mono text-[13px]">.apk</span> dengan
                  versi terbaru, lalu ketuk Unduh.
                </p>
              </>
            )}

            {info && (
              <>
                <ul className="flex flex-wrap gap-2" aria-label="Info rilis">
                  <li className={`${PILL} bg-brand-tint text-brand-ink font-semibold`}>
                    Versi {info.version}
                    <span className="ml-1 font-normal">
                      (build {info.build})
                    </span>
                  </li>
                  <li className={`${PILL} bg-bg-muted text-text-body`}>
                    {formatSize(info.sizeBytes)}
                  </li>
                  {date && (
                    <li className={`${PILL} bg-bg-muted text-text-body`}>
                      Rilis {date}
                    </li>
                  )}
                  <li className={`${PILL} bg-bg-muted text-text-body`}>
                    {ANDROID_REQ}
                  </li>
                </ul>

                <div className="mt-4 flex items-center gap-2 min-w-0">
                  <span className="shrink-0 text-[13px] text-text-muted">
                    SHA-256
                  </span>
                  <code
                    title={info.sha256}
                    className="min-w-0 truncate font-mono text-[13px] text-text-body"
                  >
                    <span aria-hidden>
                      {info.sha256.slice(0, 8)}…{info.sha256.slice(-6)}
                    </span>
                    <span className="sr-only">{info.sha256}</span>
                  </code>
                  <button
                    type="button"
                    onClick={copySha}
                    aria-label="Salin kode SHA-256 lengkap"
                    className="shrink-0 h-[30px] px-2.5 rounded-[6px] border border-border-subtle hover:bg-bg-muted text-[13px] font-medium text-text-heading inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <Check className="w-3.5 h-3.5 text-success" aria-hidden />
                    ) : (
                      <Copy className="w-3.5 h-3.5" aria-hidden />
                    )}
                    <span aria-live="polite">
                      {copied ? "Tersalin" : "Salin"}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col justify-center gap-3 px-6 pb-6 sm:px-8 sm:pb-8 lg:py-8 lg:border-l border-border-subtle lg:bg-bg-muted">
          <a
            href={useMirror ? APK_MIRROR_URL : APK_LATEST_URL}
            {...(useMirror && { target: "_blank", rel: "noopener noreferrer" })}
            className="h-[56px] w-full px-6 rounded-[12px] bg-brand-deep hover:bg-brand-deeper text-white font-semibold text-[17px] inline-flex items-center justify-center gap-2.5 transition-colors"
          >
            <Download className="w-5 h-5" aria-hidden />
            <span>{useMirror ? "Unduh dari Google Drive" : "Unduh APK"}</span>
          </a>
          <p className="text-[14px] text-text-muted text-center">
            {useMirror ? (
              <>
                Atau{" "}
                <a
                  href={APK_LATEST_URL}
                  className="text-brand-deep font-medium hover:underline"
                >
                  coba server utama
                </a>
              </>
            ) : (
              <>
                Unduhan gagal?{" "}
                <a
                  href={APK_MIRROR_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-deep font-medium hover:underline"
                >
                  Lewat Google Drive
                </a>
              </>
            )}
          </p>
          <p className="text-[14px] text-text-muted text-center">
            Ada Google Play?{" "}
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-deep font-medium hover:underline"
            >
              Pasang dari sana
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
