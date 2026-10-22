import React, { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { CircleAlert, Clock, Download } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Container } from "@/components/shared/Container";
import { formatInviteCode, inviteIntentUrl, normalizeInviteCode } from "@/lib/appLinks";
import { ApiError, getJson } from "@/lib/sissiApi";
import { InviteCode } from "./InviteCode";

// Halaman undangan karyawan: tautan `/undangan/<kode>` dari pemilik (WhatsApp). Bila aplikasi Sissi terpasang,
// Android App Links membukanya langsung di aplikasi (lihat /.well-known/assetlinks.json); halaman ini cadangan
// tanpa aplikasi: tombol buka/unduh + kode untuk diketik manual ("Punya kode undangan").
// Kontrak: sissi-pos-service/docs/api.md "Akun karyawan & Ruang Karyawan" (GET /invites/{code}, publik).

export const metadata: Metadata = {
  title: "Undangan karyawan · Sissi",
  description: "Buka undangan dari pemilik usaha di aplikasi Sissi.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

type InviteInfo = {
  purpose: "invite" | "reset_password";
  business_name: string;
  employee_name: string;
  role: "cashier" | "kitchen" | "staff" | string;
  phone_masked: string;
  expires_at: string;
};

const ROLE_LABEL: Record<string, string> = { cashier: "Kasir", kitchen: "Dapur", staff: "Karyawan", owner: "Pemilik" };

type Loaded = { kind: "ok"; info: InviteInfo } | { kind: "invalid" } | { kind: "unavailable" };

async function loadInvite(code: string): Promise<Loaded> {
  // Mode tiruan dasbor: data contoh tanpa server; kode berawalan 0000 = tidak berlaku.
  if (process.env.NEXT_PUBLIC_OWNER_MOCK === "1") {
    if (code.startsWith("0000")) return { kind: "invalid" };
    return {
      kind: "ok",
      info: {
        purpose: code.startsWith("R") ? "reset_password" : "invite",
        business_name: "Kopi Senja",
        employee_name: "Rani Amalia",
        role: "cashier",
        phone_masked: "+62 812•••789",
        expires_at: "2026-10-26T07:00:00Z",
      },
    };
  }
  try {
    return { kind: "ok", info: await getJson<InviteInfo>(`/invites/${code}`, { cache: "no-store", timeoutMs: 8_000 }) };
  } catch (err) {
    if (err instanceof ApiError && (err.code === "INVITE_INVALID" || err.code === "NOT_FOUND")) return { kind: "invalid" };
    return { kind: "unavailable" };
  }
}

function formatExpiry(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    timeZoneName: "short",
  }).format(d);
}

export default function UndanganPage({ params }: { params: Promise<{ kode: string }> }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f3f6f5]">
      <Navbar isLight />
      <main className="flex-1 pt-28 pb-20 sm:pb-24">
        <Container>
          <div className="mx-auto max-w-[560px]">
            <Suspense fallback={<InviteSkeleton />}>
              <InviteContent params={params} />
            </Suspense>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}

async function InviteContent({ params }: { params: Promise<{ kode: string }> }) {
  const { kode } = await params;
  const code = normalizeInviteCode(kode);
  if (!code) return <InvalidInvite />;
  const [loaded, h] = await Promise.all([loadInvite(code), headers()]);
  if (loaded.kind === "invalid") return <InvalidInvite />;

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "kasir.sissi.id";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const android = /android/i.test(h.get("user-agent") ?? "");
  const downloadUrl = `${proto}://${host}/download`;
  const info = loaded.kind === "ok" ? loaded.info : null;
  const reset = info?.purpose === "reset_password";
  const expiry = info ? formatExpiry(info.expires_at) : null;

  return (
    <>
      <div className="mb-8">
        <span className="mb-2 block font-mono text-[12px] font-medium tracking-wider text-[#f1702c] uppercase">
          {reset ? "Atur ulang kata sandi" : "Undangan karyawan"}
        </span>
        {info ? (
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[#292e31] sm:text-[36px]">
            {reset ? "Tautan reset dari " : "Undangan dari "}
            <span className="break-words">{info.business_name}</span>
          </h1>
        ) : (
          <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[#292e31] sm:text-[36px]">
            Undangan karyawan Sissi
          </h1>
        )}
        {info && (
          <p className="mt-3 text-base leading-relaxed text-[#525866] sm:text-[17px]">
            Untuk <strong className="font-semibold text-[#292e31]">{info.employee_name}</strong> (
            {ROLE_LABEL[info.role] ?? info.role}) · {info.phone_masked}
          </p>
        )}
        {!info && (
          <p className="mt-3 flex items-start gap-2 rounded-[12px] border border-[#f5c97a] bg-[#fff8eb] px-3.5 py-3 text-[14px] leading-relaxed text-[#8a5a00]">
            <CircleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />
            Rincian undangan belum bisa dimuat. Kamu tetap bisa memakai kode di bawah di aplikasi Sissi.
          </p>
        )}
      </div>

      <div className="mb-6 rounded-[16px] border border-[#e4e9e7] bg-white p-6 shadow-2xs sm:p-8">
        <p className="mb-2 text-[14px] font-semibold text-[#292e31]">Kode {reset ? "reset" : "undangan"}</p>
        <InviteCode code={formatInviteCode(code)} />
        {expiry && (
          <p className="mt-3 flex items-center gap-1.5 text-[13.5px] text-[#525866]">
            <Clock size={15} aria-hidden className="shrink-0" /> Berlaku sampai {expiry}. Hanya bisa dipakai sekali.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {android ? (
            <a
              href={inviteIntentUrl(code, host, downloadUrl)}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-[#f1702c] px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#ff7a45] focus:ring-2 focus:ring-[#f1702c] focus:ring-offset-2 focus:outline-none"
            >
              Buka di aplikasi
            </a>
          ) : null}
          <Link
            href="/download"
            className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none ${
              android
                ? "border border-[#e4e9e7] bg-white text-[#292e31] hover:bg-[#f3f6f5] focus:ring-[#f1702c]"
                : "bg-[#f1702c] text-white shadow-sm hover:bg-[#ff7a45] focus:ring-[#f1702c]"
            }`}
          >
            <Download size={18} aria-hidden /> Unduh aplikasi
          </Link>
        </div>
        {!android && (
          <p className="mt-3 text-[13.5px] leading-relaxed text-[#525866]">
            Sissi tersedia untuk HP Android. Buka tautan ini di HP Android-mu, atau ketik kodenya di aplikasi.
          </p>
        )}
      </div>

      <div className="rounded-[16px] border border-[#e4e9e7] bg-white p-6 shadow-2xs sm:p-8">
        <h2 className="mb-5 text-[19px] font-semibold text-[#292e31]">Belum terbuka di aplikasi?</h2>
        <ol className="flex flex-col gap-4">
          {[
            <>Pasang lalu buka aplikasi <strong className="font-semibold text-[#292e31]">Sissi</strong>.</>,
            <>Ketuk <strong className="font-semibold text-[#292e31]">Punya kode undangan</strong>.</>,
            <>Ketik kode di atas, lalu {reset ? "buat kata sandi baru" : "buat kata sandi untuk akunmu"}.</>,
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#e4e9e7] bg-[#f3f6f5] font-mono text-xs font-bold text-[#292e31]">
                {i + 1}
              </span>
              <p className="text-[15px] leading-relaxed text-[#525866]">{step}</p>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-[13.5px] leading-relaxed text-[#525866]">
          Setelah itu kamu masuk dengan no. HP dan kata sandi yang kamu buat. Jangan bagikan kode ini ke orang lain.
        </p>
      </div>
    </>
  );
}

function InvalidInvite() {
  return (
    <div className="rounded-[16px] border border-[#e4e9e7] bg-white p-6 text-center shadow-2xs sm:p-10">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef1eb] text-[#f1702c]">
        <CircleAlert size={24} aria-hidden />
      </span>
      <h1 className="mb-2 text-[24px] font-semibold tracking-tight text-[#292e31]">Undangan tidak berlaku</h1>
      <p className="mx-auto max-w-[420px] text-[15px] leading-relaxed text-[#525866]">
        Minta pemilik mengirim ulang. Tautan undangan hanya bisa dipakai sekali dan ada batas waktunya.
      </p>
      <Link
        href="/download"
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#e4e9e7] bg-white px-5 text-[15px] font-semibold text-[#292e31] hover:bg-[#f3f6f5] focus:ring-2 focus:ring-[#f1702c] focus:ring-offset-2 focus:outline-none"
      >
        <Download size={18} aria-hidden /> Unduh aplikasi Sissi
      </Link>
    </div>
  );
}

function InviteSkeleton() {
  return (
    <div role="status" aria-label="Memuat undangan" className="animate-pulse">
      <div className="mb-3 h-3 w-32 rounded bg-[#e4e9e7]" />
      <div className="mb-3 h-9 w-4/5 rounded bg-[#e4e9e7]" />
      <div className="mb-8 h-5 w-3/5 rounded bg-[#e4e9e7]" />
      <div className="h-56 rounded-[16px] border border-[#e4e9e7] bg-white" />
    </div>
  );
}
