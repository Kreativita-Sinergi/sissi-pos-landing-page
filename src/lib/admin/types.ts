// Tipe Admin platform — persis kontrak sissi-service/docs/api.md bagian "Admin platform".

export type AdminRef = { id: string; email: string; name: string };

export type Admin = AdminRef & { last_login_at: string | null };

export type LoginResult = { admin: Admin; session: { expires_at: string } };

export type MeResult = { admin: Admin; session: { expires_at: string; idle_expires_at: string } };

export type AppVersionConfig = {
  platform: "android" | "ios";
  latest_build: number;
  min_build: number;
  latest_version: string;
  store_url: string;
  message: string;
  apk_url: string;
  source: "db" | "env";
  updated_at: string | null;
  updated_by: AdminRef | null;
};

export type AppVersionInput = {
  platform: "android";
  latest_build: number;
  min_build: number;
  latest_version: string;
  store_url: string;
  message: string;
  apk_url: string;
  confirm_min_raise?: boolean;
};

export type AppVersionSaveResult = { config: AppVersionConfig; warnings: string[] };

export type Release = {
  file: string;
  version: string;
  build: number;
  abi: string;
  size_bytes: number;
  sha256: string | null;
  released_at: string;
  is_latest: boolean;
  uploaded_by: AdminRef | null;
  url: string;
};

export type ReleaseList = { latest: Release | null; releases: Release[] };

export type ApkAbi = "arm64" | "armv7";

export type UploadApkInput = {
  file: File;
  version: string;
  build: number;
  abi: ApkAbi;
  sha256: string;
  make_latest: boolean;
  update_app_version: boolean;
};

export type UploadApkResult = {
  release: Release;
  app_version: AppVersionConfig | null;
  warnings?: string[];
};

export type Summary = {
  businesses_total: number;
  businesses_active_7d: number;
  devices_active_7d: number;
  app_version: AppVersionConfig;
  latest_release: Release | null;
};

export type AuditEntry = {
  id: string;
  admin: AdminRef | null;
  action: string;
  target_type: string;
  target_id: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type PaymentProvider = "manual" | "fake" | "midtrans" | "xendit";

export type Features = {
  self_order: boolean;
  online_payment: boolean;
  provider: PaymentProvider | null;
  updated_at: string | null;
};

export type FeaturesInput = Omit<Features, "updated_at">;

export type BusinessSummary = {
  id: string;
  name: string;
  type: string;
  category: string;
  created_at: string;
  owner: { id: string; name: string; email: string; phone: string } | null;
  outlets_count: number;
  devices_count: number;
  users_count: number;
  last_active_at: string | null;
  features: Features;
  deletion: { purge_after: string } | null;
};

export type BusinessDetail = BusinessSummary & {
  outlets: { id: string; name: string; status: string; created_at: string }[];
  devices: { id: string; name: string; mode: string; outlet_id: string | null; last_seen_at: string | null }[];
  users: { id: string; name: string; email: string; role: string; created_at: string }[];
};

export type PageMeta = { page: number; per_page: number; total: number };

export type Paged<T> = { items: T[]; meta: PageMeta };

export type AuditQuery = {
  page?: number;
  per_page?: number;
  action?: string;
  admin_id?: string;
  target_type?: string;
  target_id?: string;
};
