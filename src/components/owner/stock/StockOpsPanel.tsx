"use client";

import React from "react";
import { ErrorBlock, LoadingBar, SkeletonList } from "@/components/admin/ui";
import { SyncNote } from "../ui";
import { OpnameTab } from "./OpnameTab";
import { PurchaseTab } from "./PurchaseTab";
import { SupplierTab } from "./SupplierTab";
import { TransferTab } from "./TransferTab";
import { useStockOps } from "./useStockOps";

export type OpsTab = "opname" | "po" | "transfer" | "supplier";

/** Tab operasi stok (Opname · Pembelian · Transfer · Supplier) — data dimuat sekali dan dipakai bersama antar tab. */
export function StockOpsPanel({ tab }: { tab: OpsTab }) {
  const ops = useStockOps();
  const { state, reload } = ops;
  if (!state.data) {
    if (state.status === "error") return <ErrorBlock error={state.error} onRetry={reload} />;
    return <SkeletonList rows={6} label="Memuat data stok" />;
  }
  return (
    <>
      <LoadingBar active={state.status === "loading"} />
      {state.status === "error" && (
        <div className="mb-4">
          <ErrorBlock error={state.error} onRetry={reload} />
        </div>
      )}
      {tab === "opname" && <OpnameTab ops={ops} />}
      {tab === "po" && <PurchaseTab ops={ops} />}
      {tab === "transfer" && <TransferTab ops={ops} />}
      {tab === "supplier" && <SupplierTab ops={ops} />}
      <div className="mt-4">
        <SyncNote />
      </div>
    </>
  );
}
