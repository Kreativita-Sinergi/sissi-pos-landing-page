"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Clock,
  Loader2,
} from "lucide-react";
import { ApiError, getJson, postJson } from "@/lib/sissiApi";

type ApprovalKind = "void" | "refund" | "partial_refund";
type ApprovalStatus =
  "pending" | "approved" | "rejected" | "canceled" | "expired";

type ApprovalLink = {
  business_name: string;
  outlet_name: string;
  cashier_name: string;
  receipt_no: string;
  kind: ApprovalKind | string;
  amount: number;
  reason: string;
  lines: { name: string; quantity: number }[];
  requested_at: string;
  expires_at: string;
  status: ApprovalStatus;
  decided_by_name: string | null;
};

const KIND_LABEL: Record<string, string> = {
  void: "Batalkan transaksi",
  refund: "Refund semua",
  partial_refund: "Refund sebagian",
  order_reduce: "Kurangi pesanan",
  order_cancel: "Batalkan pesanan",
};

type State =
  | { kind: "loading" }
  | { kind: "invalid" }
  | { kind: "unavailable" }
  | { kind: "ok"; data: ApprovalLink };

const MOCK: ApprovalLink = {
  business_name: "Kopi Senja",
  outlet_name: "Kopi Senja Kemang",
  cashier_name: "Andi Kasir",
  receipt_no: "KS-0042",
  kind: "partial_refund",
  amount: 44000,
  reason: "Pelanggan komplain, minuman tumpah",
  lines: [{ name: "Kopi susu gula aren", quantity: 2 }],
  requested_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
  status: "pending",
  decided_by_name: null,
};

async function fetchLink(token: string, mock: boolean): Promise<State> {
  if (mock)
    return token.startsWith("0000")
      ? { kind: "invalid" }
      : { kind: "ok", data: MOCK };
  try {
    const data = await getJson<ApprovalLink>(
      `/approval-links/${encodeURIComponent(token)}`,
      {
        cache: "no-store",
        timeoutMs: 8_000,
      },
    );
    return { kind: "ok", data };
  } catch (err) {
    return err instanceof ApiError && err.code === "NOT_FOUND"
      ? { kind: "invalid" }
      : { kind: "unavailable" };
  }
}

function rupiah(n: number): string {
  return "Rp " + new Intl.NumberFormat("id-ID").format(n);
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
    timeZoneName: "short",
  }).format(d);
}

export function ApprovalDecision({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mock = process.env.NEXT_PUBLIC_OWNER_MOCK === "1";

  const load = useCallback(() => {
    void fetchLink(token, mock).then(setState);
  }, [mock, token]);

  useEffect(() => {
    let alive = true;
    void fetchLink(token, mock).then((next) => {
      if (alive) setState(next);
    });
    return () => {
      alive = false;
    };
  }, [mock, token]);

  async function decide(decision: "approve" | "reject") {
    if (state.kind !== "ok") return;
    setBusy(decision);
    setError(null);
    try {
      const data = mock
        ? {
            ...state.data,
            status: (decision === "approve"
              ? "approved"
              : "rejected") as ApprovalStatus,
            decided_by_name: "Rani",
          }
        : await postJson<ApprovalLink>(
            `/approval-links/${encodeURIComponent(token)}/decision`,
            { decision },
          );
      setState({ kind: "ok", data });
    } catch (err) {
      if (err instanceof ApiError && err.code === "APPROVAL_CLOSED") {
        load();
      } else {
        setError(
          err instanceof ApiError && err.isNetwork
            ? "Koneksi terputus. Periksa internet lalu coba lagi."
            : "Keputusan belum terkirim. Coba lagi sebentar lagi.",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  if (state.kind === "loading") {
    return (
      <div
        role="status"
        aria-label="Memuat permintaan"
        className="animate-pulse"
      >
        <div className="mb-3 h-3 w-32 rounded bg-[#e4e9e7]" />
        <div className="mb-8 h-9 w-4/5 rounded bg-[#e4e9e7]" />
        <div className="h-72 rounded-[16px] border border-[#e4e9e7] bg-white" />
      </div>
    );
  }
  if (state.kind === "invalid") {
    return (
      <Notice
        tone="warn"
        title="Tautan tidak berlaku"
        body="Tautan persetujuan ini salah atau sudah tidak dapat dipakai. Minta kasir mengirim permintaan baru dari aplikasi."
      />
    );
  }
  if (state.kind === "unavailable") {
    return (
      <Notice
        tone="warn"
        title="Belum bisa dimuat"
        body="Rincian permintaan belum bisa dimuat. Periksa koneksi internet, lalu muat ulang halaman ini."
        action={{ label: "Coba lagi", onClick: load }}
      />
    );
  }

  const d = state.data;
  const pending = d.status === "pending";
  return (
    <>
      <div className="mb-6">
        <span className="mb-2 block font-mono text-[12px] font-medium tracking-wider text-[#f1702c] uppercase">
          Persetujuan pemilik
        </span>
        <h1 className="text-[28px] leading-tight font-semibold tracking-tight text-[#292e31] sm:text-[34px]">
          {d.cashier_name || "Kasir"} meminta persetujuanmu
        </h1>
        <p className="mt-3 text-base leading-relaxed text-[#525866] sm:text-[17px]">
          {d.business_name}
          {d.outlet_name && d.outlet_name !== d.business_name
            ? ` · ${d.outlet_name}`
            : ""}
        </p>
      </div>

      <div className="rounded-[16px] border border-[#e4e9e7] bg-white p-6 shadow-2xs sm:p-8">
        <p className="text-[14px] font-semibold text-[#525866]">
          {KIND_LABEL[d.kind] ?? d.kind}
        </p>
        <p className="mt-1 text-[32px] leading-tight font-bold tracking-tight whitespace-nowrap text-[#292e31]">
          {rupiah(d.amount)}
        </p>
        <p className="mt-2 font-mono text-[13px] font-semibold break-all text-[#525866]">
          Struk {d.receipt_no}
        </p>

        <dl className="mt-6 flex flex-col gap-3 border-t border-[#e4e9e7] pt-5 text-[15px]">
          <Row label="Alasan" value={d.reason} />
          <Row label="Kasir" value={d.cashier_name || "—"} />
          <Row label="Diminta" value={timeLabel(d.requested_at)} />
        </dl>

        {d.lines.length > 0 && (
          <div className="mt-5 rounded-[12px] bg-[#f3f6f5] px-4 py-3">
            <p className="mb-1.5 text-[13px] font-semibold text-[#525866]">
              Barang yang dikembalikan
            </p>
            <ul className="flex flex-col gap-1 text-[15px] text-[#292e31]">
              {d.lines.map((l, i) => (
                <li key={i}>
                  <span className="font-semibold">{l.quantity}×</span> {l.name}
                </li>
              ))}
            </ul>
          </div>
        )}

        {pending ? (
          <>
            {error && (
              <p className="mt-5 flex items-start gap-2 rounded-[12px] border border-[#f5c2c2] bg-[#fdf0f0] px-3.5 py-3 text-[14px] text-[#a12a2a]">
                <CircleAlert
                  size={18}
                  aria-hidden
                  className="mt-0.5 shrink-0"
                />
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void decide("reject")}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-[#e4e9e7] bg-white px-5 text-base font-semibold text-[#a12a2a] transition-colors hover:bg-[#fdf0f0] focus:ring-2 focus:ring-[#f1702c] focus:ring-offset-2 focus:outline-none disabled:opacity-60"
              >
                {busy === "reject" ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden />
                ) : (
                  <CircleX size={18} aria-hidden />
                )}
                Tolak
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void decide("approve")}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#f1702c] px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-[#ff7a45] focus:ring-2 focus:ring-[#f1702c] focus:ring-offset-2 focus:outline-none disabled:opacity-60"
              >
                {busy === "approve" ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden />
                ) : (
                  <CircleCheck size={18} aria-hidden />
                )}
                Setujui
              </button>
            </div>
            <p className="mt-4 flex items-center gap-1.5 text-[13.5px] text-[#525866]">
              <Clock size={15} aria-hidden className="shrink-0" /> Berlaku
              sampai {timeLabel(d.expires_at)}. Kasir menunggu jawabanmu di
              aplikasi.
            </p>
          </>
        ) : (
          <Result status={d.status} by={d.decided_by_name} />
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 text-[#525866]">{label}</dt>
      <dd className="min-w-0 flex-1 font-medium break-words text-[#292e31]">
        {value}
      </dd>
    </div>
  );
}

function Result({ status, by }: { status: ApprovalStatus; by: string | null }) {
  const view = {
    approved: {
      icon: <CircleCheck size={20} aria-hidden />,
      cls: "border-[#bfe5cf] bg-[#effaf3] text-[#1d7a46]",
      text: `Disetujui${by ? ` oleh ${by}` : ""}. Aplikasi kasir melanjutkan otomatis.`,
    },
    rejected: {
      icon: <CircleX size={20} aria-hidden />,
      cls: "border-[#f5c2c2] bg-[#fdf0f0] text-[#a12a2a]",
      text: `Ditolak${by ? ` oleh ${by}` : ""}. Kasir sudah diberi tahu di aplikasi.`,
    },
    canceled: {
      icon: <CircleAlert size={20} aria-hidden />,
      cls: "border-[#e4e9e7] bg-[#f3f6f5] text-[#525866]",
      text: "Kasir sudah membatalkan permintaan ini.",
    },
    expired: {
      icon: <Clock size={20} aria-hidden />,
      cls: "border-[#f5c97a] bg-[#fff8eb] text-[#8a5a00]",
      text: "Waktu persetujuan sudah habis. Minta kasir mengirim permintaan baru bila masih perlu.",
    },
    pending: { icon: null, cls: "", text: "" },
  }[status];
  return (
    <p
      role="status"
      className={`mt-6 flex items-start gap-2.5 rounded-[12px] border px-4 py-3.5 text-[15px] font-medium ${view.cls}`}
    >
      <span className="mt-0.5 shrink-0">{view.icon}</span>
      {view.text}
    </p>
  );
}

function Notice({
  tone,
  title,
  body,
  action,
}: {
  tone: "warn";
  title: string;
  body: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      className="rounded-[16px] border border-[#e4e9e7] bg-white p-6 text-center shadow-2xs sm:p-10"
      data-tone={tone}
    >
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fef1eb] text-[#f1702c]">
        <CircleAlert size={24} aria-hidden />
      </span>
      <h1 className="mb-2 text-[24px] font-semibold tracking-tight text-[#292e31]">
        {title}
      </h1>
      <p className="mx-auto max-w-[420px] text-[15px] leading-relaxed text-[#525866]">
        {body}
      </p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-[#e4e9e7] bg-white px-5 text-[15px] font-semibold text-[#292e31] hover:bg-[#f3f6f5] focus:ring-2 focus:ring-[#f1702c] focus:ring-offset-2 focus:outline-none"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
