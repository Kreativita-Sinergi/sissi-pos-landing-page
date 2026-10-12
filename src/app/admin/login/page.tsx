import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginView } from "@/components/admin/LoginView";

export const metadata: Metadata = { title: "Masuk" };

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <LoginView />
    </Suspense>
  );
}
