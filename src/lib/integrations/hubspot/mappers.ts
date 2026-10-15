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

function taxRateGroupId(vatRate: number | null | undefined, config: HubSpotBrandConfiguration) {
  if (vatRate === null || vatRate === undefined) return null;
  if (!Number.isFinite(vatRate) || vatRate < 0) throw new Error("Invalid VAT rate");
  const groupId = config.order.taxRateGroupIds?.[decimal(vatRate)] ?? null;
  if (config.properties.lineItem.taxRateGroupId && !groupId) {
    throw new Error(`HubSpot tax rate group missing for VAT ${decimal(vatRate)}%`);
  }
  return groupId;
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

function requiredFreeProductExternalId(line: HubSpotOrderLineSyncInput) {
  const value = line.freeProductExternalId?.trim();
  if (!value) throw new Error(`HubSpot UG product mapping missing for TR1 product ${line.productId}`);
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
  set(properties, map.taxRateGroupId, taxRateGroupId(line.vatRate, config));

  if (config.order.linePricingMode === "unit_price_with_discount") {
    set(properties, map.discountPercent, discount === null ? null : decimal(discount));
  }
  set(properties, map.isFreeUnit, "false");
  return externalRecord(line.id, map, properties);
}

function mapFreeLine(
  line: HubSpotOrderLineSyncInput, freeQuantity: number,
  config: HubSpotBrandConfiguration, reason?: string, source?: "commercial_terms" | "manual",
): HubSpotMappedRecord {
  const map = config.properties.lineItem;
  const properties: Record<string, string> = {};
  const productExternalId = requiredProductExternalId(line);
  const freeProductExternalId = requiredFreeProductExternalId(line);
  const prefix = config.order.freeUnitNamePrefix?.trim();
  const suffix = config.order.freeUnitNameSuffix?.trim() || "UG";
  const fallbackName = prefix ? `${prefix} ${line.name}` : `${line.name} · ${suffix}`;
  const name = line.freeProductName?.trim() || fallbackName;

  set(properties, map.name, name);
  set(properties, map.productExternalId, freeProductExternalId);
  set(properties, map.primaryProductExternalId, productExternalId);
  set(properties, map.productType, "UG");
  set(properties, map.description, "UG");
  set(properties, map.quantity, freeQuantity);
  set(properties, map.unitPriceHt, "0");
  set(properties, map.vatRate, line.vatRate === null || line.vatRate === undefined ? null : decimal(line.vatRate));
  set(properties, map.taxRateGroupId, taxRateGroupId(line.vatRate, config));
  // HubSpot's enum is singular "conditions commerciale client", while
  // TR1 stores the plural label. Preserve exceptional reasons per source.
  const mappedReason = source === "commercial_terms" ||
    reason === "conditions commerciales client"
    ? "conditions commerciale client"
    : (reason?.trim() || config.order.freeUnitReasonValue);
  set(properties, map.freeUnitReason, mappedReason);
  set(properties, map.isFreeUnit, "true");
  return externalRecord(`${line.id}:free${source ? `:${source}` : ""}`, map, properties);
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
  set(dealProperties, orderMap.orderType, input.orderTypeValue);
  if (input.blackFridayTrade) {
    if (input.blackFridayTrade.campaign !== "black_friday_2026" ||
        input.orderTypeValue !== "Réassort") {
      throw new Error("Unsupported Black Friday HubSpot preorder metadata");
    }
    set(dealProperties, orderMap.preorderType, "Précommande Opération Trade");
    set(dealProperties, orderMap.conversionReason, "Black Friday 2026");
  }
  set(dealProperties, orderMap.amountHt, decimal(input.netAmountHt));
  if (input.taxAmount !== null && input.taxAmount !== undefined) set(dealProperties, orderMap.taxAmount, decimal(input.taxAmount));
  if (input.amountTtc !== null && input.amountTtc !== undefined) set(dealProperties, orderMap.amountTtc, decimal(input.amountTtc));
  set(dealProperties, orderMap.currency, input.currency);
  set(dealProperties, orderMap.ownerId, input.ownerExternalId);
  set(dealProperties, orderMap.orderTakenBy, input.orderTakenByExternalId);
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
      if (freeQuantity > 0) {
        const allocations = line.freeUnitAllocations;
        if (!allocations?.length) {
          // Historical orders without classified allocations preserve their
          // existing HubSpot identity and default commercial reason.
          lineItems.push(mapFreeLine(line, freeQuantity, config));
        } else {
          const quantitySum = allocations.reduce((sum, a) => {
            if (!Number.isInteger(a.quantity) || a.quantity <= 0 ||
                !a.classification?.trim() ||
                !["commercial_terms", "manual"].includes(a.source)) {
              throw new Error("Invalid classified UG allocation");
            }
            return sum + a.quantity;
          }, 0);
          if (quantitySum !== freeQuantity ||
              new Set(allocations.map((a) => a.source)).size !== allocations.length) {
            throw new Error("UG classification/quantity mismatch; refusing HubSpot sync");
          }
          const split = allocations.length > 1;
          for (const allocation of [...allocations].sort((a, b) => a.source.localeCompare(b.source))) {
            lineItems.push(mapFreeLine(line, allocation.quantity, config,
              allocation.classification, split ? allocation.source : undefined));
          }
        }
      }
    }
  }

  // Campaign gifts are not UG, must never change the invoiced amount, and
  // are first-class HubSpot product lines with stable identities for retries.
  if (input.blackFridayTrade) {
    const promo = input.blackFridayTrade;
    if (!Number.isInteger(promo.giftAntiStressQuantity) ||
        !Number.isInteger(promo.giftDreamQuantity) ||
        promo.giftAntiStressQuantity <= 0 ||
        promo.giftAntiStressQuantity !== promo.giftDreamQuantity ||
        !/^\\d+$/.test(promo.giftAntiStressProductExternalId) ||
        !/^\\d+$/.test(promo.giftDreamProductExternalId)) {
      throw new Error("Invalid Black Friday gift allocation");
    }
    const map = config.properties.lineItem;
    const giftRows = [
      { key: "as", name: "Cadeau sell-out Black Friday 26 - Sachet Anti-Stress x20",
        externalId: promo.giftAntiStressProductExternalId, quantity: promo.giftAntiStressQuantity },
      { key: "dream", name: "Cadeau sell-out Black Friday 26 - Sachet Dream x20",
        externalId: promo.giftDreamProductExternalId, quantity: promo.giftDreamQuantity },
    ];
    for (const gift of giftRows) {
      const p: Record<string, string> = {};
      set(p, map.name, gift.name);
      set(p, map.productExternalId, gift.externalId);
      set(p, map.productType, "Autre");
      set(p, map.quantity, gift.quantity);
      set(p, map.unitPriceHt, "0");
      set(p, map.taxRateGroupId, taxRateGroupId(5.5, config));
      set(p, map.description, "Black Friday 2026 — cadeau consommateur : un sachet par boîte, UG comprises. Offre du 16/11 au 12/12.");
      lineItems.push(externalRecord(`${input.id}:bf26:${gift.key}`, map, p));
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
  set(properties, map.ownerId, input.ownerExternalId);
  set(properties, map.activityType, input.activityType);
  set(properties, map.body, input.body);
  set(properties, map.internalNotes, input.internalNotes);
  if (input.attachmentExternalIds?.length) set(properties, map.attachmentIds, input.attachmentExternalIds.join(";"));
  return externalRecord(input.id, map, properties);
}

export function mapNoteToHubSpot(input: HubSpotNoteSyncInput, config: HubSpotBrandConfiguration): HubSpotMappedRecord {
  const map = config.properties.note;
  const properties: Record<string, string> = {};
  set(properties, map.body, input.body);
  set(properties, map.timestamp, input.timestamp);
  if (input.attachmentExternalIds?.length) set(properties, map.attachmentIds, input.attachmentExternalIds.join(";"));
  return externalRecord(input.id, map, properties);
}