"use client";

import React, { useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Modal } from "@/components/admin/ConfirmDialog";
import { btn, errorMessage, Notice, Spinner } from "@/components/admin/ui";
import { ownerApi } from "@/lib/owner/api";
import { csvDateTime, downloadCsv } from "@/lib/owner/csv";
import { buildSalesPdf, summaryFromReport, summaryFromRows, withOutlets } from "@/lib/owner/salesPdf";
import { zoneLabel } from "@/lib/owner/tz";
import type { SaleListItem, SalesQuery } from "@/lib/owner/types";
import { refundedTotalOf } from "@/lib/owner/saleRefunds";
import { labelOf, METHODS, orderTypeLabel, SALE_STATUS } from "./labels";

// Ekspor halaman Transaksi: tombol "Ekspor" → dialog yang menunjukkan data yang akan diekspor (mengikuti filter
// halaman: periode, outlet, metode, status, kasir, cari, urutan) lalu pilih PDF (laporan rapi) atau CSV (data mentah).
// Tidak ada pemilih periode terpisah — ubah periode di filter halaman (keputusan pemilik 2026-11-05).

export const CSV_LIMIT = 5000;

type Format = "pdf" | "csv";

export function SalesExport({
  total,
  query,
  extraFilters,
  businessName,
  outletLabel,
  periodLabel,
  compareOutlets,
  filenameBase,
}: {
  total: number;
  /** Kueri halaman tanpa page/per_page. */
  query: SalesQuery;
  /** Label filter selain periode & outlet, mis. "Metode: QRIS". Kosong → ringkasan PDF dari laporan. */
  extraFilters: string[];
  businessName: string;
  outletLabel: string;
  periodLabel: string;
  /** "Semua outlet" dengan > 1 outlet → PDF memuat perbandingan outlet. */
  compareOutlets: boolean;
  filenameBase: string;
}) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("pdf");
  const [progress, setProgress] = useState<{ done: number; of: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const busy = progress !== null;

  async function fetchRows(limit: number, signal: AbortSignal): Promise<SaleListItem[]> {
    const target = Math.min(total, limit);
    const rows: SaleListItem[] = [];
    setProgress({ done: 0, of: target });
    for (let p = 1; rows.length < target; p++) {
      const r = await (await ownerApi()).sales({ ...query, page: p, per_page: 100 }, signal);
      rows.push(...r.items);
      setProgress({ done: Math.min(rows.length, target), of: Math.min(r.meta.total, limit) });
      if (r.items.length === 0 || rows.length >= r.meta.total) break;
    }
    return rows.slice(0, limit);
  }

  async function run() {
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;
    setError(null);
    try {
      if (format === "csv") {
        const rows = await fetchRows(CSV_LIMIT, ctrl.signal);
        downloadCsv(
          `${filenameBase}.csv`,
          [`waktu_${zoneLabel().toLowerCase()}`, "no_struk", "outlet", "kasir", "pelanggan", "meja", "jenis_pesanan", "status", "metode", "total", "refund_sebagian", "dibayar", "jumlah_item"],
          rows.map((s) => [
            csvDateTime(s.paid_at),
            s.receipt_no,
            s.outlet_name,
            s.cashier_name,
            s.customer_name ?? "",
            s.table_name ?? "",
            s.order_type ? orderTypeLabel(s.order_type) : "",
            labelOf(SALE_STATUS, s.status),
            labelOf(METHODS, s.payment_method),
            s.total,
            refundedTotalOf(s),
            s.paid_total,
            s.items_count,
          ])
        );
      } else {
        // Tanpa filter tambahan: cukup laporan server (= halaman Laporan), satu permintaan.
        // Dengan filter tambahan: ringkasan dihitung dari transaksi yang cocok, jadi ambil sampai CSV_LIMIT.
        const fromReport = extraFilters.length === 0;
        const api = await ownerApi();
        const range = { from: query.from ?? "", to: query.to ?? "" };
        let rows: SaleListItem[] = [];
        let summary;
        if (fromReport) {
          setProgress({ done: 0, of: 0 });
          const [report, outlets] = await Promise.all([
            api.salesReport({ from: query.from, to: query.to, outlet_id: query.outlet_id }, ctrl.signal),
            compareOutlets ? api.outletsReport({ from: query.from, to: query.to }, ctrl.signal) : null,
          ]);
          summary = summaryFromReport(report);
          if (outlets) summary = withOutlets(summary, outlets);
        } else {
          rows = await fetchRows(CSV_LIMIT, ctrl.signal);
          summary = summaryFromRows(rows, range);
        }
        const blob = await buildSalesPdf({
          businessName,
          outletLabel,
          periodLabel,
          filters: extraFilters,
          summary,
          summarizedCount: rows.length,
          total,
          partialSummary: !fromReport && total > rows.length,
          generatedAt: new Date(),
        });
        downloadBlob(blob, `${filenameBase}.pdf`);
      }
      setOpen(false);
    } catch (err) {
      if (!ctrl.signal.aborted) setError(errorMessage(err));
    } finally {
      ctrlRef.current = null;
      setProgress(null);
    }
  }

  const close = () => {
    ctrlRef.current?.abort();
    setOpen(false);
  };
  const pct = progress?.of ? Math.round((progress.done / progress.of) * 100) : 0;
  const options: { id: Format; icon: React.ReactNode; title: string; body: string }[] = [
    {
      id: "pdf",
      icon: <FileText size={20} aria-hidden />,
      title: "PDF — laporan & analisis",
      body: "Kesimpulan & saran, produk terlaris, jam & hari ramai, kasir, outlet, metode bayar, dan rincian penjualan. Untuk daftar per transaksi, pilih CSV.",
    },
    {
      id: "csv",
      icon: <FileSpreadsheet size={20} aria-hidden />,
      title: "CSV — data mentah",
      body: `Daftar per transaksi untuk Excel/Google Sheets, maks. ${CSV_LIMIT.toLocaleString("id-ID")} baris.`,
    },
  ];

  return (
    <>
      <button type="button" className={btn.secondary} disabled={total === 0} onClick={() => setOpen(true)}>
        <Download size={16} aria-hidden /> Ekspor
      </button>
      <Modal open={open} title="Ekspor transaksi" description="Mengikuti filter yang sedang aktif di halaman ini." onClose={close} dismissible={!busy}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-[12px] bg-bg-muted px-4 py-3 text-[13.5px]">
          <dt className="text-text-muted">Periode</dt>
          <dd className="font-semibold text-text-heading">{periodLabel}</dd>
          <dt className="text-text-muted">Outlet</dt>
          <dd className="font-semibold text-text-heading">{outletLabel}</dd>
          <dt className="text-text-muted">Filter</dt>
          <dd className="text-text-heading">{extraFilters.length ? extraFilters.join(" · ") : "Tanpa filter tambahan"}</dd>
          <dt className="text-text-muted">Jumlah</dt>
          <dd className="font-semibold text-text-heading tabular-nums">{total.toLocaleString("id-ID")} transaksi</dd>
        </dl>
        <p className="mt-2 text-[12.5px] text-text-muted">Periode atau filter salah? Tutup dialog ini dan ubah filter di halaman.</p>

        <fieldset className="mt-4" disabled={busy}>
          <legend className="mb-2 text-[13px] font-semibold text-text-heading">Format</legend>
          <div className="flex flex-col gap-2">
            {options.map((o) => (
              <label
                key={o.id}
                className={`flex cursor-pointer items-start gap-3 rounded-[12px] border px-3.5 py-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-primary ${
                  format === o.id ? "border-brand-primary bg-brand-tint" : "border-border-subtle hover:border-border-active"
                }`}
              >
                <input type="radio" name="sales-export-format" value={o.id} checked={format === o.id} onChange={() => setFormat(o.id)} className="sr-only" />
                <span className={`mt-0.5 shrink-0 ${format === o.id ? "text-brand-ink" : "text-text-muted"}`}>{o.icon}</span>
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-text-heading">{o.title}</span>
                  <span className="block text-[12.5px] text-text-body">{o.body}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {format === "pdf" && extraFilters.length > 0 && (
          <p className="mt-3 text-[12.5px] text-text-muted">
            Ada filter tambahan, jadi ringkasan dihitung dari transaksi yang cocok (tanpa rincian diskon & pajak). Tanpa filter tambahan, ringkasan
            sama dengan halaman Laporan.
          </p>
        )}
        {error && (
          <div className="mt-3">
            <Notice tone="danger" role="alert">
              Ekspor gagal: {error}
            </Notice>
          </div>
        )}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          {busy ? (
            <>
              <button type="button" className={btn.ghost} onClick={() => ctrlRef.current?.abort()}>
                Batal
              </button>
              <span role="status" className="inline-flex min-h-10 items-center gap-2 text-[13.5px] tabular-nums">
                <Spinner />
                {progress.of ? `Mengambil ${progress.done.toLocaleString("id-ID")}/${progress.of.toLocaleString("id-ID")} (${pct}%)` : "Menyiapkan laporan…"}
              </span>
            </>
          ) : (
            <>
              <button type="button" className={btn.secondary} onClick={close}>
                Tutup
              </button>
              <button type="button" className={btn.primary} onClick={run}>
                <Download size={16} aria-hidden /> Unduh {format.toUpperCase()}
              </button>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
