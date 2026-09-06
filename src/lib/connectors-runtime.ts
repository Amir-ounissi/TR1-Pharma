import type {
  ConnectorConflictStrategy,
  ConnectorDirection,
  ConnectorEntityType,
  ConnectorProvider,
  ConnectorSyncDirection,
} from "@/lib/connectors";

export type ConnectorMappingRuntimeConfig = {
  connectionId: string;
  provider: ConnectorProvider;
  entityType: ConnectorEntityType;
  externalObject: string;
  direction: ConnectorDirection;
  conflictStrategy: ConnectorConflictStrategy;
  mappingProfileId: string | null;
  cursorField: string | null;
  isEnabled: boolean;
};

export type ConnectorSyncPlan = {
  connectionId: string;
  provider: ConnectorProvider;
  entityType: ConnectorEntityType;
  externalObject: string;
  direction: ConnectorSyncDirection;
  conflictStrategy: ConnectorConflictStrategy;
  mappingProfileId: string | null;
  cursorField: string | null;
};

export function expandConnectorMapping(mapping: ConnectorMappingRuntimeConfig): ConnectorSyncPlan[] {
  if (!mapping.isEnabled) return [];
  const shared = {
    connectionId: mapping.connectionId,
    provider: mapping.provider,
    entityType: mapping.entityType,
    externalObject: mapping.externalObject.trim(),
    conflictStrategy: mapping.conflictStrategy,
    mappingProfileId: mapping.mappingProfileId,
    cursorField: mapping.cursorField?.trim() || null,
  };

  if (mapping.direction === "bidirectional") {
    return [
      { ...shared, direction: "inbound" },
      { ...shared, direction: "outbound" },
    ];
  }
  return [{ ...shared, direction: mapping.direction }];
}

export function connectorSyncDedupeKey(plan: ConnectorSyncPlan) {
  return [plan.connectionId, plan.entityType, plan.externalObject.toLowerCase(), plan.direction].join(":");
}

export function canAutomaticallyResolveConnectorConflict(strategy: ConnectorConflictStrategy) {
  return strategy !== "manual";
}
