const resource = process.env.TR1_MCP_SMOKE_URL ||
  "https://tr1-chatgpt-mcp-staging.vercel.app/api/connectors/chatgpt/mcp";
const endpoint = new URL(resource);
if (endpoint.protocol !== "https:" || endpoint.pathname !== "/api/connectors/chatgpt/mcp") {
  throw new Error("Unsafe smoke-test URL");
}

async function get(url, expectedStatus) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000), redirect: "manual" });
  if (response.status !== expectedStatus) {
    throw new Error(`GET ${url} expected ${expectedStatus}, got ${response.status}: ${(await response.text()).slice(0,180)}`);
  }
  return response;
}
async function rpc(method, params, expectedStatus = 200) {
  const response = await fetch(resource, {
    method: "POST",
    signal: AbortSignal.timeout(12000),
    headers: { "content-type": "application/json", Accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 7, method, params }),
  });
  if (response.status !== expectedStatus) {
    throw new Error(`MCP ${method} expected ${expectedStatus}, got ${response.status}: ${(await response.text()).slice(0,180)}`);
  }
  return { response, body: await response.json() };
}

const discovery = await get(new URL("/.well-known/oauth-protected-resource", resource), 200);
const metadata = await discovery.json();
if (metadata.resource !== resource ||
    !metadata.authorization_servers?.includes("https://ehptapmuzckazyxmnmnm.supabase.co/auth/v1")) {
  throw new Error("Staging OAuth protected-resource metadata does not match the expected issuer/resource.");
}
console.log("PASS OAuth protected-resource discovery");

const initialize = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "tr1-staging-smoke", version: "1.0.0" },
});
if (initialize.body?.result?.serverInfo?.name !== "tr1-pharma") {
  throw new Error("Invalid MCP initialization result");
}
console.log("PASS MCP initialize");

const listed = await rpc("tools/list", {});
const expectedRead = ["list_tr1_brands", "search_tr1_pharmacies", "get_tr1_pharmacy_summary",
  "list_tr1_catalog", "get_tr1_agenda"];
const expectedWrite = ["create_tr1_planned_visit", "create_tr1_order_draft"];
const tools = listed.body?.result?.tools ?? [];
const advertised = tools.map((tool) => tool.name);
const expected = [...expectedRead, ...expectedWrite];
if (advertised.length !== expected.length ||
    new Set(advertised).size !== expected.length ||
    expected.some((name) => !advertised.includes(name))) {
  throw new Error(`Expected exactly seven MCP tools, received ${JSON.stringify(advertised)}`);
}
for (const tool of tools) {
  const readOnly = expectedRead.includes(tool.name);
  if (tool.annotations?.readOnlyHint !== readOnly ||
      tool.annotations?.destructiveHint !== false ||
      !tool.securitySchemes?.some((scheme) => scheme.type === "oauth2") ||
      tool.inputSchema?.additionalProperties !== false) {
    throw new Error(`Tool metadata or authorization not safe: ${tool.name}`);
  }
}
console.log("PASS five OAuth read tools and two OAuth write tools with correct annotations");

const forbidden = await rpc("tools/call", {
  name: "list_tr1_brands",
  arguments: {},
}, 401);
if (!forbidden.response.headers.get("www-authenticate")?.includes("resource_metadata")) {
  throw new Error("Missing OAuth WWW-Authenticate resource metadata challenge");
}
if (forbidden.body?.error?.code !== -32001) {
  throw new Error("Unauthenticated MCP call failed without an auth error");
}
console.log("PASS unauthenticated business access denied (401 + OAuth challenge)");

// No business user token is provided. Both writes must fail before reaching
// commercial data. The verification never creates an order or a visit.
for (const name of expectedWrite) {
  const denied = await rpc("tools/call", { name, arguments: { confirmed: true } }, 401);
  if (denied.body?.error?.code !== -32001) {
    throw new Error(`Unauthenticated write tool unexpectedly succeeded: ${name}`);
  }
}
console.log("PASS both unauthenticated write tools rejected (401)");

await get(resource, 405);
console.log("PASS no read-data over GET");

await get(new URL("/.well-known/oauth-protected-resource/api/connectors/chatgpt/mcp", resource), 200);
console.log("PASS path-scoped OAuth metadata");
// OAuth Server is a separately administered Supabase Cloud feature.
// Its absence is a staging setup blocker, not a failure of the isolated MCP transport.
const issuerDiscovery = "https://ehptapmuzckazyxmnmnm.supabase.co/.well-known/oauth-authorization-server/auth/v1";
try {
  const authResponse = await fetch(issuerDiscovery, { signal: AbortSignal.timeout(12000), redirect: "manual" });
  if (authResponse.ok) {
    const authMetadata = await authResponse.json();
    const methods = authMetadata.code_challenge_methods_supported ?? [];
    if (authMetadata.issuer === "https://ehptapmuzckazyxmnmnm.supabase.co/auth/v1" &&
        authMetadata.authorization_endpoint && authMetadata.token_endpoint &&
        methods.includes("S256")) {
      console.log("SUPABASE_OAUTH_DISCOVERY=READY (Authorization Code + PKCE S256 advertised)");
    } else {
      console.log("SUPABASE_OAUTH_DISCOVERY=INCOMPLETE (inspect issuer and PKCE metadata)");
    }
  } else {
    console.log(`SUPABASE_OAUTH_DISCOVERY=NOT_READY (HTTP ${authResponse.status}; enable Cloud OAuth 2.1 Server on staging)`);
  }
} catch (error) {
  console.log(`SUPABASE_OAUTH_DISCOVERY=UNVERIFIED (${error instanceof Error ? error.name : "network error"})`);
}
console.log("TR1 MCP staging smoke complete — NO business user token and NO customer data accessed.");
