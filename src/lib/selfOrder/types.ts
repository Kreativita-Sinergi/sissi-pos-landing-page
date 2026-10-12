// Tipe kontrak "Pesan & Bayar Mandiri (QR)" — sissi-service/docs/api.md, endpoint /api/v1/public.
// Uang = rupiah bulat; persen = basis poin (1000 = 10%).

export type OrderType = "dine_in" | "takeaway";
export type TableSelect = "per_table" | "choose" | "off";
export type PayMode = "cashier" | "online";

export type PublicTable = { id: string; name: string; area_name: string | null };

export type MenuOutlet = {
  id: string;
  name: string;
  address: string;
  image_url: string | null;
  business_name: string;
};

export type MenuMode = {
  table_select: TableSelect;
  order_types: OrderType[];
  payment: PayMode;
  allow_additional_orders: boolean;
  require_customer_name: boolean;
};

export type PricingTax = { id: string; name: string; rate_bp: number };

export type PricingServiceFee = {
  enabled: boolean;
  type: "percent" | "fixed";
  rate_bp: number;
  amount: number;
  order_types: string[];
  taxable: boolean;
};

export type MenuPricing = { taxes: PricingTax[]; service_fee: PricingServiceFee };

export type MenuCategory = { id: string; name: string; sort_order: number };

export type VariantOption = { name: string; values: string[] };

export type MenuVariant = {
  id: string;
  name: string;
  price: number;
  options: Record<string, string>;
  image_url: string | null;
  sort_order: number;
  sold_out: boolean;
};

export type ModifierOption = { id: string; name: string; price: number };

export type ModifierGroup = {
  id: string;
  name: string;
  min_select: number;
  max_select: number;
  options: ModifierOption[];
};

export type MenuProduct = {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  is_taxable: boolean;
  sold_out: boolean;
  variant_options: VariantOption[];
  variants: MenuVariant[];
  modifier_groups: ModifierGroup[];
};

export type Menu = {
  outlet: MenuOutlet;
  table: PublicTable | null;
  mode: MenuMode;
  tables: PublicTable[] | null;
  pricing: MenuPricing;
  categories: MenuCategory[];
  products: MenuProduct[];
  menu_version: string;
};

export type OrderStatus =
  | "awaiting_payment"
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "completed"
  | "rejected"
  | "canceled"
  | "expired";

export const FINAL_STATUSES: readonly OrderStatus[] = ["completed", "rejected", "canceled", "expired"];

export type PublicOrderItem = {
  name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number;
  modifiers: { name: string; price: number }[];
  note: string;
};

export type PublicOrder = {
  id: string;
  order_no: string;
  round: number;
  group_id: string;
  status: OrderStatus;
  status_label: string;
  pay_mode: PayMode;
  order_type: OrderType;
  table: PublicTable | null;
  customer_name: string;
  note: string;
  items: PublicOrderItem[];
  subtotal: number;
  service_fee: number;
  taxes: { name: string; rate_bp: number; amount: number }[];
  tax_total: number;
  total: number;
  reject_reason: string;
  expires_at: string | null;
  created_at: string;
  accepted_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
};

export type PaymentStatus = "pending" | "paid" | "expired" | "failed" | "canceled" | "refunded";

export type Payment = {
  id: string;
  provider: string;
  status: PaymentStatus;
  amount: number;
  qr_string: string | null;
  checkout_url: string | null;
  expires_at: string;
  paid_at: string | null;
};

export type CreateOrderItem = {
  product_id: string;
  variant_id: string | null;
  quantity: number;
  note: string;
  modifiers: { group_id: string; option_id: string }[];
};

export type CreateOrderBody = {
  table_id: string | null;
  order_type: OrderType;
  customer_name: string;
  note: string;
  group_key: string | null;
  expected_total: number;
  items: CreateOrderItem[];
};

export type CreateOrderResponse = {
  order: PublicOrder;
  access_key: string;
  group_key: string;
  payment: Payment | null;
};

export type GroupRound = {
  id: string;
  round: number;
  status: OrderStatus;
  status_label: string;
  total: number;
};

export type OrderStatusResponse = {
  order: PublicOrder;
  payment: Payment | null;
  group: { id: string; can_add: boolean; rounds: GroupRound[] };
  poll_after_s: number | null;
};

export type PaymentResponse = { order: PublicOrder; payment: Payment };
export type CancelResponse = { order: PublicOrder };
