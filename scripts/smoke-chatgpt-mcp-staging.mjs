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
const expected = ["list_tr1_brands", "search_tr1_pharmacies", "get_tr1_pharmacy_summary"];
const advertised = listed.body?.result?.tools?.map((tool) => tool.name) ?? [];
for (const name of expected) {
  if (!advertised.includes(name)) throw new Error(`Missing read-only MCP tool ${name}`);
}
if (listed.body.result.tools.some((tool) => tool.annotations?.readOnlyHint !== true)) {
  throw new Error("Non-read-only tool exposed in staging");
}
console.log("PASS three read-only tools exposed");

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

await get(resource, 405);
console.log("PASS no read-data over GET");

await get(new URL("/.well-known/oauth-protected-resource/api/connectors/chatgpt/mcp", resource), 200);
console.log("PASS path-scoped OAuth metadata");
console.log("TR1 MCP staging smoke complete — NO business user token and NO customer data accessed.");
