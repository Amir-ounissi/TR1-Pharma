import type {
  HubSpotBrandConfiguration,
  HubSpotMappedOrder,
  HubSpotMappedRecord,
  HubSpotMeetingSyncInput,
  HubSpotNoteSyncInput,
  HubSpotOrderLineSyncInput,
  HubSpotOrderSyncInput,
  HubSpotPharmacySyncInput,
  HubSpotProductSyncInput,
  HubSpotPropertyMap,
} from "./model";

function set(properties: Record<string, string>, property: string | undefined, value: unknown) {
  if (!property || value === null || value === undefined || value === "") return;
  properties[property] = String(value);
}

function decimal(value: number) {
  if (!Number.isFinite(value)) throw new Error("HubSpot numeric payload contains a non-finite value");
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function percentage(value: number | null | undefined) {
  if (value === null || value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Invalid discount percentage");
  return value;
}

function externalRecord(id: string, map: HubSpotPropertyMap, properties: Record<string, string>): HubSpotMappedRecord {
  if (!id.trim()) throw new Error("TR1 record ID is required for HubSpot sync");
  if (map.externalId) properties[map.externalId] = id;
  return { tr1RecordId: id, idProperty: map.externalId, properties };
}

function requiredProductExternalId(line: HubSpotOrderLineSyncInput) {
  const value = line.productExternalId?.trim();
  if (!value) throw new Error(`HubSpot product mapping missing for TR1 product ${line.productId}`);
  return value;
}

export function mapPharmacyToHubSpot(input: HubSpotPharmacySyncInput, config: HubSpotBrandConfiguration): HubSpotMappedRecord {
  const map = config.properties.pharmacy;
  const properties: Record<string, string> = {};
  set(properties, map.name, input.name);
  set(properties, map.address, input.address);
  set(properties, map.postalCode, input.postalCode);
  set(properties, map.city, input.city);
  set(properties, map.phone, input.phone);
  set(properties, map.email, input.email);
  return externalRecord(input.id, map, properties);
}

export function mapProductToHubSpot(input: HubSpotProductSyncInput, config: HubSpotBrandConfiguration): HubSpotMappedRecord {
  const map = config.properties.product;
  const properties: Record<string, string> = {};
  set(properties, map.name, input.name);
  set(properties, map.sku, input.sku);
  if (input.unitPriceHt !== null && input.unitPriceHt !== undefined) set(properties, map.unitPriceHt, decimal(input.unitPriceHt));
  if (input.vatRate !== null && input.vatRate !== undefined) set(properties, map.vatRate, decimal(input.vatRate));
  return externalRecord(input.id, map, properties);
}

function mapPaidLine(line: HubSpotOrderLineSyncInput, config: HubSpotBrandConfiguration): HubSpotMappedRecord {
  const map = config.properties.lineItem;
  const properties: Record<string, string> = {};
  const discount = percentage(line.discountPercent);
  const productExternalId = requiredProductExternalId(line);
  let unitPrice = line.unitPriceHt;

  if (config.order.linePricingMode === "net_unit_price" && discount !== null) {
    unitPrice = unitPrice * (1 - discount / 100);
  }

  set(properties, map.name, line.name);
  set(properties, map.sku, line.sku);
  set(properties, map.productExternalId, productExternalId);
  set(properties, map.quantity, line.quantity);
  set(properties, map.unitPriceHt, decimal(unitPrice));
  set(properties, map.vatRate, line.vatRate === null || line.vatRate === undefined ? null : decimal(line.vatRate));

  if (config.order.linePricingMode === "unit_price_with_discount") {
    set(properties, map.discountPercent, discount === null ? null : decimal(discount));
  }
  set(properties, map.isFreeUnit, "false");
  return externalRecord(line.id, map, properties);
}

function mapFreeLine(line: HubSpotOrderLineSyncInput, freeQuantity: number, config: HubSpotBrandConfiguration): HubSpotMappedRecord {
  const map = config.properties.lineItem;
  const properties: Record<string, string> = {};
  const productExternalId = requiredProductExternalId(line);
  const prefix = config.order.freeUnitNamePrefix?.trim();
  const suffix = config.order.freeUnitNameSuffix?.trim() || "UG";
  const name = prefix ? `${prefix} ${line.name}` : `${line.name} · ${suffix}`;

  set(properties, map.name, name);
  set(properties, map.primaryProductExternalId, productExternalId);
  set(properties, map.productType, "UG");
  set(properties, map.description, "UG");
  set(properties, map.quantity, freeQuantity);
  set(properties, map.unitPriceHt, "0");
  set(properties, map.vatRate, line.vatRate === null || line.vatRate === undefined ? null : decimal(line.vatRate));
  set(properties, map.isFreeUnit, "true");
  return externalRecord(`${line.id}:free`, map, properties);
}

export function mapOrderToHubSpot(input: HubSpotOrderSyncInput, config: HubSpotBrandConfiguration): HubSpotMappedOrder {
  if (!config.order.syncStatuses.includes(input.status)) {
    throw new Error(`Order status ${input.status} is not configured for HubSpot sync`);
  }

  const orderMap = config.properties.order;
  const dealProperties: Record<string, string> = {};
  set(dealProperties, orderMap.name, input.orderNumber);
  set(dealProperties, orderMap.orderNumber, input.orderNumber);
  set(dealProperties, orderMap.orderDate, input.orderDate);
  set(dealProperties, orderMap.amountHt, decimal(input.netAmountHt));
  if (input.taxAmount !== null && input.taxAmount !== undefined) set(dealProperties, orderMap.taxAmount, decimal(input.taxAmount));
  if (input.amountTtc !== null && input.amountTtc !== undefined) set(dealProperties, orderMap.amountTtc, decimal(input.amountTtc));
  set(dealProperties, orderMap.currency, input.currency);
  set(dealProperties, orderMap.ownerId, input.ownerExternalId);
  set(dealProperties, orderMap.origin, input.originValue);
  set(dealProperties, orderMap.pipeline, input.pipelineExternalId ?? config.deal.pipeline);
  set(dealProperties, orderMap.stage, input.stageExternalId ?? config.deal.confirmedStage);

  const lineItems: HubSpotMappedRecord[] = [];
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 0) throw new Error("Invalid paid line quantity");
    const freeQuantity = line.freeQuantity ?? 0;
    if (!Number.isInteger(freeQuantity) || freeQuantity < 0) throw new Error("Invalid free line quantity");

    if (config.order.freeUnitsMode === "included_in_quantity") {
      lineItems.push(mapPaidLine({ ...line, quantity: line.quantity + freeQuantity, freeQuantity: 0 }, config));
    } else {
      if (line.quantity > 0) lineItems.push(mapPaidLine(line, config));
      if (freeQuantity > 0) lineItems.push(mapFreeLine(line, freeQuantity, config));
    }
  }

  return {
    deal: externalRecord(input.id, orderMap, dealProperties),
    lineItems,
  };
}

export function mapMeetingToHubSpot(input: HubSpotMeetingSyncInput, config: HubSpotBrandConfiguration): HubSpotMappedRecord {
  const map = config.properties.meeting;
  const properties: Record<string, string> = {};
  set(properties, map.name, input.title);
  set(properties, map.startAt ?? map.timestamp, input.startAt);
  if (map.startAt && map.timestamp && map.startAt !== map.timestamp) {
    set(properties, map.timestamp, input.startAt);
  }
  set(properties, map.endAt, input.endAt);
  set(properties, map.outcome, input.outcome);
  return externalRecord(input.id, map, properties);
}

export function mapNoteToHubSpot(input: HubSpotNoteSyncInput, config: HubSpotBrandConfiguration): HubSpotMappedRecord {
  const map = config.properties.note;
  const properties: Record<string, string> = {};
  set(properties, map.body, input.body);
  set(properties, map.timestamp, input.timestamp);
  return externalRecord(input.id, map, properties);
}
