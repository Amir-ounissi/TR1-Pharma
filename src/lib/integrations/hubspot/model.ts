export type HubSpotObjectKey = "companies" | "products" | "deals" | "lineItems" | "meetings" | "notes";

export type HubSpotFreeUnitsMode = "separate_line" | "included_in_quantity";
export type HubSpotLinePricingMode = "unit_price_with_discount" | "net_unit_price";

export type HubSpotPropertyMap = {
  externalId?: string;
  ownerId?: string;
  origin?: string;
  name?: string;
  description?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  phone?: string;
  email?: string;
  sku?: string;
  unitPriceHt?: string;
  vatRate?: string;
  orderNumber?: string;
  orderDate?: string;
  amountHt?: string;
  taxAmount?: string;
  amountTtc?: string;
  currency?: string;
  pipeline?: string;
  stage?: string;
  quantity?: string;
  discountPercent?: string;
  productExternalId?: string;
  primaryProductExternalId?: string;
  productType?: string;
  isFreeUnit?: string;
  body?: string;
  timestamp?: string;
  startAt?: string;
  endAt?: string;
  outcome?: string;
};

export type HubSpotBrandConfiguration = {
  objects: Record<HubSpotObjectKey, string>;
  properties: {
    pharmacy: HubSpotPropertyMap;
    product: HubSpotPropertyMap;
    order: HubSpotPropertyMap;
    lineItem: HubSpotPropertyMap;
    meeting: HubSpotPropertyMap;
    note: HubSpotPropertyMap;
  };
  deal: {
    pipeline: string;
    confirmedStage: string;
  };
  order: {
    syncStatuses: string[];
    linePricingMode: HubSpotLinePricingMode;
    freeUnitsMode: HubSpotFreeUnitsMode;
    freeUnitNameSuffix?: string;
    freeUnitNamePrefix?: string;
  };
};

export type HubSpotPharmacySyncInput = {
  id: string;
  name: string;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type HubSpotProductSyncInput = {
  id: string;
  name: string;
  sku?: string | null;
  unitPriceHt?: number | null;
  vatRate?: number | null;
};

export type HubSpotOrderLineSyncInput = {
  id: string;
  productId: string;
  productExternalId: string;
  freeProductExternalId?: string | null;
  name: string;
  sku?: string | null;
  quantity: number;
  freeQuantity?: number | null;
  unitPriceHt: number;
  discountPercent?: number | null;
  vatRate?: number | null;
};

export type HubSpotOrderSyncInput = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  netAmountHt: number;
  taxAmount?: number | null;
  amountTtc?: number | null;
  currency?: string | null;
  ownerExternalId?: string | null;
  pipelineExternalId?: string | null;
  stageExternalId?: string | null;
  originValue?: string | null;
  lines: HubSpotOrderLineSyncInput[];
};

export type HubSpotMeetingSyncInput = {
  id: string;
  title: string;
  startAt: string;
  endAt?: string | null;
  outcome?: string | null;
};

export type HubSpotNoteSyncInput = {
  id: string;
  body: string;
  timestamp: string;
};

export type HubSpotMappedRecord = {
  tr1RecordId: string;
  idProperty?: string;
  properties: Record<string, string>;
};

export type HubSpotMappedOrder = {
  deal: HubSpotMappedRecord;
  lineItems: HubSpotMappedRecord[];
};

const SAFE_NAME = /^[a-zA-Z0-9_.-]{1,160}$/;

export function assertHubSpotBrandConfiguration(config: HubSpotBrandConfiguration) {
  const objectNames = Object.values(config.objects);
  if (objectNames.length !== 6 || objectNames.some((value) => !SAFE_NAME.test(value))) {
    throw new Error("Invalid HubSpot object configuration");
  }

  const maps = Object.values(config.properties);
  for (const map of maps) {
    for (const value of Object.values(map)) {
      if (value && !SAFE_NAME.test(value)) throw new Error("Invalid HubSpot property configuration");
    }
  }

  if (!config.deal.pipeline.trim() || !config.deal.confirmedStage.trim()) {
    throw new Error("HubSpot deal pipeline and confirmed stage are required");
  }
  if (config.order.syncStatuses.length === 0 || config.order.syncStatuses.some((status) => !status.trim())) {
    throw new Error("At least one order status must be configured for HubSpot sync");
  }
}
