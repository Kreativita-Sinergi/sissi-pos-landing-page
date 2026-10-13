"use client";

import React, { useState } from "react";
import { AlertTriangle, Check, Pencil, Printer } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useToast } from "@/components/admin/toast";
import { Badge, btn, errorMessage, formatRupiah, iconBtn, Notice } from "@/components/admin/ui";
import { Sheet } from "@/components/owner/catalog/bits";
import {
  issuePayslip,
  markPayslipPaid,
  monthLabel,
  monthOf,
  PAY_TYPE_LABEL,
  payslipLinesOf,
  payslipNumber,
  recapFacts,
  ROLE_LABEL,
  SLIP_STATUS_LABEL,
  type PayrollRow,
  type PayslipLine,
} from "@/lib/owner/team";
import { formatDateTime } from "@/lib/owner/tz";
import { Avatar, SlipBadge, type TeamCtx } from "./shared";

// Slip gaji satu karyawan untuk satu bulan — cermin `payslip_view.dart`: rincian (dari slip terbit, atau hitungan dari
// kehadiran), terbitkan (beku), tandai dibayar, cetak. Web tidak mencatat kas keluar laci (kas hanya dari perangkat).

export function PayslipSheet({
  row,
  month,
  ctx,
  businessId,
  businessName,
  onClose,
  onEditPayroll,
}: {
  row: PayrollRow | null;
  month: string;
  ctx: TeamCtx;
  businessId: string;
  businessName: string;
  onClose: () => void;
  onEditPayroll: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"issue" | "paid" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const period = monthLabel(month);

  const slip = row?.slip ?? null;
  const issued = !!slip && slip.status !== "draft";
  const lines: PayslipLine[] = !row ? [] : issued ? slip.lines : row.config ? payslipLinesOf(row.draft, row.config.type) : [];
  const gross = issued ? slip.gross : (row?.draft.gross ?? 0);
  const deductions = issued ? slip.deductions : (row?.draft.deductions ?? 0);

  const run = async (kind: "issue" | "paid") => {
    if (!row) return;
    setBusy(true);
    setError(null);
    try {
      const m = monthOf(month);
      const out =
        kind === "issue"
          ? await issuePayslip({
              businessId,
              employeeId: row.employee.id,
              start: m.start,
              end: m.end,
              lines: payslipLinesOf(row.draft, row.config!.type),
              existing: slip,
            })
          : await markPayslipPaid(slip!);
      ctx.merge("payslips", out);
      setConfirm(null);
      if (out.status === "applied") toast.success(kind === "issue" ? `Slip gaji ${row.employee.name} terbit.` : "Slip gaji ditandai sudah dibayar.");
      else setError(out.message);
    } catch (err) {
      setConfirm(null);
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const steps: [string, boolean][] = [
    ["Rekap", true],
    ["Terbit", issued],
    ["Dibayar", slip?.status === "paid"],
  ];

  const printBtn = row && issued && (
    <PrintButton row={row} lines={lines} gross={gross} deductions={deductions} period={period} businessName={businessName} />
  );
  const footer = !row ? undefined : slip?.status === "paid" ? (
    printBtn
  ) : slip?.status === "issued" ? (
    <>
      {printBtn}
      <button type="button" className={btn.primary} disabled={busy} onClick={() => setConfirm("paid")}>
        <Check size={16} aria-hidden /> Tandai sudah dibayar
      </button>
    </>
  ) : (
    <button type="button" className={btn.primary} disabled={busy || !row.configured || row.draft.net < 0} onClick={() => setConfirm("issue")}>
      Terbitkan slip
    </button>
  );

  return (
    <>
      <Sheet
        open={!!row}
        title="Slip gaji"
        subtitle={period}
        onClose={() => !busy && onClose()}
        busy={busy}
        footer={footer}
      >
        {row && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-[14px] border border-border-subtle px-4 py-3">
              <Avatar name={row.employee.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text-heading">{row.employee.name}</p>
                <p className="text-[13px] text-text-muted">
                  {ROLE_LABEL[row.employee.role]} · {period}
                </p>
              </div>
              <Badge tone="brand">{PAY_TYPE_LABEL[row.config?.type ?? "none"]}</Badge>
              {!issued && (
                <button type="button" className={iconBtn} onClick={onEditPayroll} aria-label="Atur gaji" title="Atur gaji">
                  <Pencil size={16} aria-hidden />
                </button>
              )}
            </div>

            <ol className="grid grid-cols-3 rounded-[14px] border border-border-subtle px-3 py-3" aria-label="Tahap slip">
              {steps.map(([label, done]) => (
                <li key={label} className="flex flex-col items-center gap-1 text-center">
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full border ${done ? "border-brand-deep bg-brand-deep text-white" : "border-border-active bg-white"}`}
                  >
                    {done && <Check size={14} aria-hidden />}
                  </span>
                  <span className={`text-[12.5px] ${done ? "font-semibold text-text-heading" : "text-text-muted"}`}>
                    {label}
                    <span className="sr-only">{done ? " (selesai)" : " (belum)"}</span>
                  </span>
                </li>
              ))}
            </ol>

            {row.changedAfterIssue && (
              <Notice tone="warning" icon={<AlertTriangle size={18} aria-hidden />}>
                Kehadiran berubah setelah slip terbit. Hitungan sekarang {formatRupiah(row.draft.net)}; slip yang terbit tidak berubah.
              </Notice>
            )}
            {!issued && !row.configured && <Notice tone="info">Atur gaji karyawan ini dulu (ikon pensil) sebelum menerbitkan slip.</Notice>}

            <div>
              <h3 className="mb-1.5 text-[12.5px] font-bold text-brand-ink">Kehadiran</h3>
              <div className="flex flex-wrap gap-1.5">
                {recapFacts(row.recap).map(([label, value]) => (
                  <Badge key={label}>
                    {label} {value}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-1.5 text-[12.5px] font-bold text-brand-ink">Pendapatan</h3>
              {lines
                .filter((l) => l.kind === "earning")
                .map((l, i) => (
                  <Line key={i} label={l.label} value={formatRupiah(l.amount)} />
                ))}
              <Line label="Total pendapatan" value={formatRupiah(gross)} strong />
            </div>
            {lines.some((l) => l.kind === "deduction") && (
              <div>
                <h3 className="mb-1.5 text-[12.5px] font-bold text-brand-ink">Potongan</h3>
                {lines
                  .filter((l) => l.kind === "deduction")
                  .map((l, i) => (
                    <Line key={i} label={l.label} value={`-${formatRupiah(l.amount)}`} danger />
                  ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
              <span className="font-semibold text-text-heading">Gaji diterima</span>
              <span className="text-[20px] font-bold tabular-nums text-text-heading">{formatRupiah(gross - deductions)}</span>
            </div>
            {issued && slip && (
              <p className="-mt-2 text-[12.5px] text-text-muted">
                No. slip {slip.number} · <SlipBadge status={slip.status} />
                {slip.issued_at && ` · terbit ${formatDateTime(slip.issued_at)}`}
                {slip.paid_at && ` · dibayar ${formatDateTime(slip.paid_at)}`}
              </p>
            )}
            {error && (
              <Notice tone="danger" role="alert">
                {error}
              </Notice>
            )}
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={confirm === "issue"}
        title="Terbitkan slip gaji?"
        confirmLabel="Terbitkan slip"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => run("issue")}
      >
        Slip {row?.employee.name} sebesar {formatRupiah(row?.draft.net ?? 0)} akan dibekukan. Perubahan kehadiran setelah ini tidak mengubah slip.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === "paid"}
        title="Tandai sudah dibayar"
        confirmLabel="Sudah dibayar"
        busy={busy}
        onClose={() => setConfirm(null)}
        onConfirm={() => run("paid")}
      >
        <span className="block text-[13px] text-text-muted">Gaji diterima {row?.employee.name}</span>
        <span className="block text-[20px] font-bold text-text-heading">{formatRupiah(slip?.net ?? 0)}</span>
        <span className="mt-2 block text-[13px]">
          Pembayaran dari dasbor tidak dicatat di laci kasir. Untuk membayar tunai dari laci (kas keluar shift), tandai lewat aplikasi kasir.
        </span>
        <span className="mt-1 block text-[13px]">Status dibayar tidak dapat dibatalkan.</span>
      </ConfirmDialog>
    </>
  );
}

function Line({ label, value, strong = false, danger = false }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-1 text-[14px] ${strong ? "font-semibold text-text-heading" : "text-text-body"}`}>
      <span className="min-w-0">{label}</span>
      <span className={`shrink-0 tabular-nums ${danger ? "text-danger" : ""}`}>{value}</span>
    </div>
  );
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Cetak slip (A4/thermal lewat dialog cetak browser) — isi sama dengan struk slip app (`payslip_builder.dart`). */
function PrintButton({
  row,
  lines,
  gross,
  deductions,
  period,
  businessName,
}: {
  row: PayrollRow;
  lines: PayslipLine[];
  gross: number;
  deductions: number;
  period: string;
  businessName: string;
}) {
  const print = () => {
    const number = row.slip?.number ?? payslipNumber(`${row.recap.days[0]?.day ?? ""}`, row.employee.id);
    const tr = (a: string, b: string, cls = "") => `<tr class="${cls}"><td>${esc(a)}</td><td class="r">${esc(b)}</td></tr>`;
    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Slip gaji ${esc(row.employee.name)} ${esc(period)}</title>
<style>body{font:13px/1.45 system-ui,sans-serif;color:#111;max-width:420px;margin:24px auto;padding:0 12px}h1{font-size:16px;text-align:center;margin:0}
p.c{text-align:center;margin:2px 0 12px}table{width:100%;border-collapse:collapse}td{padding:3px 0;vertical-align:top}.r{text-align:right;white-space:nowrap;padding-left:12px}
.b td{font-weight:700;border-top:1px solid #999;padding-top:6px}.h td{font-weight:700;padding-top:10px}.t td{font-size:15px;font-weight:700;border-top:2px solid #111;padding-top:8px}</style></head><body>
<h1>${esc(businessName)}</h1><p class="c"><strong>SLIP GAJI</strong><br>${esc(number)}</p><table>
${tr("Karyawan", `${row.employee.name} (${ROLE_LABEL[row.employee.role]})`)}${tr("Periode", period)}${tr("Status", SLIP_STATUS_LABEL[row.slip?.status ?? "draft"])}
<tr class="h"><td colspan="2">Kehadiran</td></tr>${recapFacts(row.recap).map(([a, b]) => tr(a, b)).join("")}
<tr class="h"><td colspan="2">Pendapatan</td></tr>${lines.filter((l) => l.kind === "earning").map((l) => tr(l.label, formatRupiah(l.amount))).join("")}
${tr("Total pendapatan", formatRupiah(gross), "b")}
${lines.some((l) => l.kind === "deduction") ? `<tr class="h"><td colspan="2">Potongan</td></tr>${lines.filter((l) => l.kind === "deduction").map((l) => tr(l.label, `-${formatRupiah(l.amount)}`)).join("")}${tr("Total potongan", `-${formatRupiah(deductions)}`, "b")}` : ""}
${tr("Gaji diterima", formatRupiah(gross - deductions), "t")}</table></body></html>`;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    frame.srcdoc = html;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.appendChild(frame);
  };
  return (
    <button type="button" className={btn.secondary} onClick={print}>
      <Printer size={16} aria-hidden /> Cetak
    </button>
  );
}
