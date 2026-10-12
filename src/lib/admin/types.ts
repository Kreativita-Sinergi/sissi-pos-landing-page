// Tipe Admin platform — persis kontrak sissi-service/docs/api.md bagian "Admin platform".

export type AdminRef = { id: string; email: string; name: string };

export type Admin = AdminRef & { last_login_at: string | null; must_change_password?: boolean };

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
  // Tahap 2 (aditif — server lama tidak mengirim).
  crashes_24h?: { events: number; groups: number; new_groups: number };
  crash_groups_open?: number;
  deletions?: { scheduled: number; due_7d: number };
  devices_below_min_build?: number;
  // Tahap 3 (aditif).
  businesses_active_30d?: number;
  subscriptions?: PlanCounts;
  revenue_this_month?: number;
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

export type BusinessType = "culinary" | "retail" | "service" | "rental";

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
  // Tahap 3 (aditif).
  subscription?: BusinessSubscriptionBrief;
};

export type BusinessSubscriptionBrief = {
  plan: PlanId;
  status: SubscriptionStatus;
  ends_at: string | null;
  billing_cycle: BillingCycle | null;
};

export type DeviceApp = { build: number; version: string | null; platform: string; seen_at: string };

export type BusinessDetail = Omit<BusinessSummary, "owner" | "deletion"> & {
  owner:
    | { id: string; name: string; email: string; phone: string; email_verified?: boolean; last_login_at?: string | null }
    | null;
  employees_count?: number;
  deletion: {
    id?: string;
    requested_at?: string;
    purge_after: string;
    source?: "web" | "app";
    reason?: string;
  } | null;
  outlets: { id: string; name: string; status: string; created_at: string; devices_count?: number }[];
  devices: {
    id: string;
    name: string;
    mode: string;
    outlet_id: string | null;
    last_seen_at: string | null;
    app?: DeviceApp | null;
  }[];
  users: {
    id: string;
    name: string;
    email: string | null;
    phone?: string | null;
    role: string;
    is_active?: boolean;
    created_at: string;
  }[];
  stats?: { sales_30d: number; crashes_30d: number };
  audit?: AuditEntry[];
};

export type BusinessFacets = {
  type: Partial<Record<string, number>>;
  active: Partial<Record<"7d" | "30d" | "inactive", number>>;
  feature: Partial<Record<"self_order" | "online_payment", number>>;
  deletion: Partial<Record<"scheduled", number>>;
  plan_status?: Partial<Record<SubscriptionStatus, number>>;
};

export type BusinessSort = "created" | "last_active" | "devices" | "name";
export type SortOrder = "asc" | "desc";

export type BusinessQuery = {
  q?: string;
  type?: string[];
  active?: string;
  feature?: string[];
  created_from?: string;
  created_to?: string;
  deletion?: string;
  plan_status?: string[];
  sort?: string;
  order?: string;
  page?: number;
  per_page?: number;
};

export type PageMeta = { page: number; per_page: number; total: number };

export type Paged<T, F = undefined> = { items: T[]; meta: PageMeta; facets?: F | null };

// ——— Sebaran versi (tahap 2) ———

export type BuildBucket = {
  build: number;
  version: string | null;
  devices: number;
  businesses: number;
  last_seen_at: string;
  below_min: boolean;
};

export type VersionImpact = { min_build: number; devices: number; businesses: number; businesses_all_devices: number };

export type VersionDistribution = {
  platform: "android" | "ios";
  active_days: number;
  generated_at: string;
  min_build: number;
  latest_build: number;
  totals: { devices: number; businesses: number; unknown_build_devices: number };
  builds: BuildBucket[];
  impact: VersionImpact | null;
};

// ——— Audit (tahap 2: kursor) ———

export type AuditQuery = {
  admin_id?: string;
  action?: string[];
  target_type?: string;
  target_id?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export type AuditPage = { items: AuditEntry[]; next_cursor: string | null };

// ——— Kelola admin (tahap 2) ———

export type AdminListItem = {
  id: string;
  email: string;
  name: string;
  active: boolean;
  must_change_password: boolean;
  created_at: string;
  created_by: AdminRef | null;
  last_login_at: string | null;
  active_sessions: number;
  is_me: boolean;
};

export type TempPassword = { temporary_password: string; expires_at: string };

export type CreateAdminResult = TempPassword & { admin: AdminListItem };

// ——— Crash (tahap 2) ———

export type CrashStatus = "open" | "resolved" | "ignored";

export type CrashGroup = {
  fingerprint: string;
  kind: "flutter" | "platform";
  platform: string;
  title: string;
  top_frame: string;
  status: CrashStatus;
  first_seen_at: string;
  last_seen_at: string;
  events_count: number;
  events_in_range: number;
  businesses_count: number;
  builds: { first: number | null; last: number | null };
  last_version: string | null;
  sparkline: number[];
  resolved_in_build: number | null;
  status_note: string;
  status_by: AdminRef | null;
  status_at: string | null;
};

export type CrashQuery = {
  status?: string;
  platform?: string;
  build?: string;
  from?: string;
  to?: string;
  q?: string;
  sort?: string;
  order?: string;
  page?: number;
  per_page?: number;
};

export type CrashFacets = { status: Partial<Record<CrashStatus, number>> };

export type CrashEvent = {
  id: string;
  received_at: string;
  occurred_at: string | null;
  build: number | null;
  version: string | null;
  platform: string;
  os_version: string;
  flavor: string;
  kind: string;
  business: { id: string; name: string | null } | null;
  role: string | null;
  message: string;
  stack: string;
};

export type CrashDetail = {
  group: CrashGroup;
  daily: { day: string; count: number }[];
  builds: { build: number; version: string | null; count: number; last_seen_at: string }[];
  businesses: { id: string; name: string | null; count: number }[];
  events: CrashEvent[];
};

export type CrashStatusInput = { status: CrashStatus; resolved_in_build: number | null; note: string };

// ——— Antrean hapus akun (tahap 2) ———

export type DeletionStatus = "scheduled" | "canceled" | "purged";

export type AccountDeletion = {
  id: string;
  status: DeletionStatus;
  business: { id: string; name: string } | null;
  owner: { id: string; name: string; email: string; phone: string } | null;
  source: "web" | "app";
  reason: string;
  requested_at: string;
  purge_after: string;
  canceled_at: string | null;
  purged_at: string | null;
  days_left: number | null;
};

export type DeletionQuery = { status?: string; q?: string; sort?: string; order?: string; page?: number; per_page?: number };

export type DeletionFacets = { status: Partial<Record<DeletionStatus, number>> };

// ——— Langganan & metrik (tahap 3) ———

export type PlanId = "free" | "pro";
export type SubscriptionStatus = "trial" | "active" | "grace" | "free";
export type BillingCycle = "monthly" | "yearly";
export type PaymentCycle = BillingCycle | "custom";
export type PaymentMethod = "transfer" | "qris" | "cash" | "gateway" | "other";

export type PlanCounts = Record<SubscriptionStatus, number> & { expiring_7d: number; over_limit: number };

export type AdminPayment = {
  id: string;
  cycle: PaymentCycle;
  period_start: string;
  period_end: string;
  amount: number;
  method: PaymentMethod;
  paid_at: string;
  provider: "manual" | "midtrans" | "xendit";
  provider_ref: string | null;
  note: string;
  status: "recorded" | "void";
  void_reason: string;
  recorded_by: AdminRef | null;
  voided_by: AdminRef | null;
  voided_at: string | null;
  created_at: string;
};

export type AdminSubscription = {
  business: {
    id: string;
    name: string;
    type: string;
    owner: { name: string; email: string; phone: string } | null;
  };
  plan: PlanId;
  status: SubscriptionStatus;
  trial_ends_at: string | null;
  current_period_end: string | null;
  grace_ends_at: string | null;
  ends_at: string | null;
  days_left: number | null;
  billing_cycle: BillingCycle | null;
  limits: { tx_per_month: number | null; outlets: number };
  overrides: { outlet_quota: number | null; tx_limit: number | null; note: string };
  usage: { month: string; tx_this_month: number; outlets: number; over_limit: boolean };
  first_paid_at: string | null;
  last_payment: AdminPayment | null;
  version: number;
  updated_at: string;
};

export type SubscriptionQuery = {
  status?: string[];
  expiring?: string;
  cycle?: string;
  over_limit?: string;
  q?: string;
  sort?: string;
  order?: string;
  page?: number;
  per_page?: number;
};

export type SubscriptionFacets = {
  status: Partial<Record<SubscriptionStatus, number>>;
  expiring_7d?: number;
};

export type SubscriptionDetail = {
  subscription: AdminSubscription;
  payments: AdminPayment[];
  audit: AuditEntry[];
};

export type RecordPaymentInput = {
  id: string;
  cycle: PaymentCycle;
  period_start: string | null;
  period_end: string | null;
  amount: number;
  method: Exclude<PaymentMethod, "gateway">;
  paid_at: string;
  provider_ref: string | null;
  note: string;
};

export type SubscriptionPaymentResult = { subscription: AdminSubscription; payment: AdminPayment };

export type ExtendInput = { days: number; target: "auto" | "trial" | "period"; note: string };

export type OverridesInput = { outlet_quota: number | null; tx_limit: number | null; note: string };

export type BankAccount = { bank: string; number: string; holder: string };

export type BillingConfig = {
  price_monthly: number;
  price_yearly: number;
  bank_accounts: BankAccount[];
  whatsapp: string;
  instructions: string;
  updated_by: AdminRef | null;
  updated_at: string | null;
};

export type BillingConfigInput = Omit<BillingConfig, "updated_by" | "updated_at">;

export type MetricsInterval = "day" | "week" | "month";

export type Kpi = { value: number | null; previous: number | null; change_pct: number | null };

export type MetricsBucket = {
  bucket: string;
  partial: boolean;
  signups: number;
  active: number;
  revenue: number;
  payments: number;
  trial: number | null;
  pro: number | null;
  grace: number | null;
  free: number | null;
};

export type Metrics = {
  range: { from: string; to: string; interval: MetricsInterval; tz: string };
  generated_at: string;
  cached: boolean;
  kpis: {
    signups: Kpi;
    active_businesses: Kpi;
    dau_avg: Kpi;
    pro_paying: Kpi;
    revenue: Kpi;
    mrr_estimate: Kpi;
    trial_conversion: Kpi;
  };
  series: MetricsBucket[];
  activity: { dau: number; wau: number; mau: number; stickiness: number; as_of: string };
  plans: PlanCounts;
  cohorts: { week: string; size: number; retention: (number | null)[] }[];
  revenue_monthly: { month: string; amount: number; payments: number; new: number; renewals: number }[];
  conversion: { trials_ended: number; converted: number; rate: number | null; window_days: number };
  business_types: { type: string; total: number; active: number; pro: number }[];
};

export type MetricsQuery = { from?: string; to?: string; interval?: MetricsInterval };
