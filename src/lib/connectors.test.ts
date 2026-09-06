import { describe, expect, it } from "vitest";
import {
  CONNECTOR_PROVIDERS,
  connectorCredentialLabel,
  connectorDirectionLabel,
  connectorProviderLabel,
  connectorSourceSystem,
  connectorStatusLabel,
  isConnectorProvider,
  isCredentialReference,
  isSafeConnectorConfiguration,
  normalizeConnectorBaseUrl,
  summarizeConnectorConnections,
} from "./connectors";

describe("connector domain contract", () => {
  it("exposes the supported provider families without leaking provider SDK models", () => {
    expect(Object.keys(CONNECTOR_PROVIDERS)).toEqual(["hubspot", "salesforce", "dynamics", "erp", "generic_api"]);
    expect(connectorProviderLabel("hubspot")).toBe("HubSpot");
    expect(connectorProviderLabel("salesforce")).toBe("Salesforce");
    expect(connectorProviderLabel("dynamics")).toBe("Microsoft Dynamics");
    expect(isConnectorProvider("erp")).toBe(true);
    expect(isConnectorProvider("pipedrive")).toBe(false);
  });

  it("rejects connector configuration containing credentials, including nested values", () => {
    expect(isSafeConnectorConfiguration({ object: "companies", filters: { archived: false } })).toBe(true);
    expect(isSafeConnectorConfiguration({ access_token: "secret" })).toBe(false);
    expect(isSafeConnectorConfiguration({ auth: { client_secret: "secret" } })).toBe(false);
    expect(isSafeConnectorConfiguration({ stages: [{ name: "active" }, { api_key: "secret" }] })).toBe(false);
    expect(isSafeConnectorConfiguration(null)).toBe(false);
  });

  it("normalizes base URLs and rejects unsupported protocols", () => {
    expect(normalizeConnectorBaseUrl("https://api.example.com/v1/?foo=bar#x")).toBe("https://api.example.com/v1");
    expect(normalizeConnectorBaseUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(normalizeConnectorBaseUrl("ftp://example.com")).toBeNull();
    expect(normalizeConnectorBaseUrl("not-a-url")).toBeNull();
    expect(normalizeConnectorBaseUrl(" ")).toBeNull();
  });

  it("only accepts references to externally stored credentials", () => {
    expect(isCredentialReference("oauth://hubspot/dermavita")).toBe(true);
    expect(isCredentialReference("vault://tr1/connectors/erp-1")).toBe(true);
    expect(isCredentialReference("secret://project/api-key")).toBe(true);
    expect(isCredentialReference("plain-text-token")).toBe(false);
    expect(isCredentialReference("https://example.com/token")).toBe(false);
  });

  it("creates stable provider source-system keys for Mapping Studio", () => {
    expect(connectorSourceSystem("hubspot", "Companies")).toBe("hubspot_companies");
    expect(connectorSourceSystem("dynamics", "Sales Order Lines")).toBe("dynamics_sales_order_lines");
    expect(connectorSourceSystem("generic_api", " ")).toBe("generic_api_object");
  });

  it("provides compact product labels and health summaries", () => {
    expect(connectorStatusLabel("active")).toBe("Actif");
    expect(connectorCredentialLabel("expired")).toBe("À renouveler");
    expect(connectorDirectionLabel("bidirectional")).toBe("Bidirectionnel");
    expect(summarizeConnectorConnections([
      { status: "active", credential_status: "configured" },
      { status: "ready", credential_status: "missing" },
      { status: "error", credential_status: "expired" },
    ])).toEqual({ total: 3, active: 1, ready: 1, errors: 1, credentialsToConfigure: 2 });
  });
});
