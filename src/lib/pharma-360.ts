export type Pharma360Snapshot = {
  account: {
    brand_pharmacy_id: string;
    pharmacy_id: string;
    pharmacy_name: string;
    trade_name?: string | null;
    legal_name?: string | null;
    cip_code?: string | null;
    finess_code?: string | null;
    siret?: string | null;
    phone?: string | null;
    email?: string | null;
    address_line_1?: string | null;
    postal_code?: string | null;
    city?: string | null;
    country_code?: string | null;
    group_name?: string | null;
    territory_name?: string | null;
    commercial_status?: string | null;
    priority_level?: string | null;
    potential_level?: string | null;
    agent_name?: string | null;
    next_action_type?: string | null;
    next_action_at?: string | null;
  };
  business: {
    health_status?: string | null;
    priority_score?: number | null;
    priority_reasons?: string[];
    recommendation?: string | null;
    orders_count: number;
    reorder_count: number;
    first_order_at?: string | null;
    last_order_at?: string | null;
    first_reorder_at?: string | null;
    days_to_first_reorder?: number | null;
    average_order_value: number;
    total_revenue_ht: number;
    revenue_last_30d_ht: number;
    revenue_last_90d_ht: number;
    revenue_trend?: string | null;
    revenue_trend_percent?: number | null;
    expected_reorder_at?: string | null;
    expected_reorder_delay_days?: number | null;
    expected_interval_days?: number | null;
    interval_source?: string | null;
    has_next_action: boolean;
    next_action_at?: string | null;
  };
  assortment: {
    eligible_product_count: number;
    implanted_product_count: number;
    strategic_eligible_count: number;
    strategic_implanted_count: number;
    distribution_rate: number;
    strategic_distribution_rate: number;
    products: Array<{
      product_id: string;
      name: string;
      sku?: string | null;
      ean?: string | null;
      status?: string | null;
      first_implanted_at?: string | null;
      first_ordered_at?: string | null;
      last_ordered_at?: string | null;
      total_ordered_quantity?: number | null;
      valid_order_count?: number | null;
      order_presence?: boolean | null;
    }>;
  };
  field: {
    interactions: Array<Record<string, unknown>>;
    missions: Array<Record<string, unknown>>;
    open_tasks: Array<Record<string, unknown>>;
  };
  trade: {
    enabled: boolean;
    campaigns: Array<Record<string, unknown>>;
  };
  sell_out: {
    enabled: boolean;
    validated_capture_count: number;
    units_last_90d: number;
    revenue_last_90d_ht: number;
    latest_captures: Array<Record<string, unknown>>;
  };
  opportunities: Array<{
    brand_pharmacy_id: string;
    action_type: string;
    action_label: string;
    action_score: number;
    confidence: string;
    suggested_due_at: string;
    rationale: string[];
    has_next_action: boolean;
  }>;
  capabilities: {
    trade_marketing: boolean;
    sell_out: boolean;
    next_best_action: boolean;
  };
};

export function pharma360SectionCoverage(snapshot: Pharma360Snapshot) {
  return {
    business: snapshot.business.orders_count > 0 || snapshot.business.total_revenue_ht > 0,
    assortment: snapshot.assortment.eligible_product_count > 0,
    field: snapshot.field.interactions.length > 0 || snapshot.field.missions.length > 0 || snapshot.field.open_tasks.length > 0,
    trade: snapshot.trade.enabled && snapshot.trade.campaigns.length > 0,
    sellOut: snapshot.sell_out.enabled && snapshot.sell_out.validated_capture_count > 0,
    opportunities: snapshot.opportunities.length > 0,
  };
}

export function pharma360Address(snapshot: Pharma360Snapshot) {
  return [snapshot.account.address_line_1, [snapshot.account.postal_code, snapshot.account.city].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(" · ");
}
