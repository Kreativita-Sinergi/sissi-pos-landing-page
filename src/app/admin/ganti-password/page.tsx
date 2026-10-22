import type { Metadata } from "next";
import { Suspense } from "react";
import { ForcePasswordView } from "@/components/admin/AccountView";

export const metadata: Metadata = { title: "Ganti kata sandi" };

// Di luar grup (panel): sesi dengan password sementara hanya boleh memanggil /auth/me, /auth/logout, /me/password.
export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-muted" />}>
      <ForcePasswordView />
    </Suspense>
  );
}
