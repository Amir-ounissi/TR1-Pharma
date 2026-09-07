export type HubSpotClientMode = "disabled" | "dry_run" | "write";

export type HubSpotRequestResult<T = unknown> = {
  mode: HubSpotClientMode;
  data: T | null;
  status: number | null;
  correlationId: string | null;
};

export class HubSpotApiError extends Error {
  readonly status: number;
  readonly correlationId: string | null;
  readonly retryable: boolean;

  constructor(message: string, status: number, correlationId: string | null) {
    super(message);
    this.name = "HubSpotApiError";
    this.status = status;
    this.correlationId = correlationId;
    this.retryable = status === 429 || status >= 500;
  }
}

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type Sleep = (milliseconds: number) => Promise<void>;

export type HubSpotClientOptions = {
  accessToken?: string | null;
  mode: HubSpotClientMode;
  baseUrl?: string;
  fetchImpl?: FetchLike;
  sleep?: Sleep;
  maxRetries?: number;
};

function defaultSleep(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(response: Response, attempt: number) {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  }
  return Math.min(250 * 2 ** attempt, 5_000);
}

async function responsePayload(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function safeProviderMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const message = (payload as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message.slice(0, 500);
  }
  return `HubSpot request failed with status ${status}`;
}

function correlationId(response: Response, payload: unknown) {
  const header = response.headers.get("x-hubspot-correlation-id") ?? response.headers.get("x-request-id");
  if (header) return header.slice(0, 200);
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>).correlationId;
    if (typeof value === "string") return value.slice(0, 200);
  }
  return null;
}

export class HubSpotClient {
  private readonly accessToken: string | null;
  private readonly mode: HubSpotClientMode;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly sleep: Sleep;
  private readonly maxRetries: number;

  constructor(options: HubSpotClientOptions) {
    this.accessToken = options.accessToken?.trim() || null;
    this.mode = options.mode;
    this.baseUrl = (options.baseUrl ?? "https://api.hubapi.com").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.maxRetries = Math.max(0, Math.min(options.maxRetries ?? 3, 6));

    if (this.mode === "write" && !this.accessToken) {
      throw new Error("HubSpot write mode requires a server-side access token");
    }
  }

  getMode() {
    return this.mode;
  }

  async read<T = unknown>(path: string): Promise<HubSpotRequestResult<T>> {
    if (this.mode === "disabled") return { mode: this.mode, data: null, status: null, correlationId: null };
    return this.request<T>("GET", path);
  }

  async createObject<T = unknown>(objectType: string, properties: Record<string, string>): Promise<HubSpotRequestResult<T>> {
    return this.write<T>("POST", `/crm/v3/objects/${encodeURIComponent(objectType)}`, { properties });
  }

  async updateObject<T = unknown>(objectType: string, objectId: string, properties: Record<string, string>): Promise<HubSpotRequestResult<T>> {
    return this.write<T>("PATCH", `/crm/v3/objects/${encodeURIComponent(objectType)}/${encodeURIComponent(objectId)}`, { properties });
  }

  async upsertBatch<T = unknown>(objectType: string, idProperty: string, records: Array<{ id: string; properties: Record<string, string> }>): Promise<HubSpotRequestResult<T>> {
    return this.write<T>("POST", `/crm/v3/objects/${encodeURIComponent(objectType)}/batch/upsert`, {
      inputs: records.map((record) => ({ idProperty, id: record.id, properties: record.properties })),
    });
  }

  async associateDefault<T = unknown>(fromObjectType: string, fromId: string, toObjectType: string, toId: string): Promise<HubSpotRequestResult<T>> {
    return this.write<T>(
      "PUT",
      `/crm/v4/objects/${encodeURIComponent(fromObjectType)}/${encodeURIComponent(fromId)}/associations/default/${encodeURIComponent(toObjectType)}/${encodeURIComponent(toId)}`,
      {},
    );
  }

  private async write<T>(method: "POST" | "PATCH" | "PUT", path: string, body: unknown): Promise<HubSpotRequestResult<T>> {
    if (this.mode !== "write") {
      return { mode: this.mode, data: null, status: null, correlationId: null };
    }
    return this.request<T>(method, path, body);
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<HubSpotRequestResult<T>> {
    if (!this.accessToken) throw new Error("HubSpot request requires a server-side access token");

    let attempt = 0;
    while (true) {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.accessToken}`,
          accept: "application/json",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
      const payload = await responsePayload(response);
      const requestCorrelationId = correlationId(response, payload);

      if (response.ok) {
        return { mode: this.mode, data: payload as T, status: response.status, correlationId: requestCorrelationId };
      }

      const error = new HubSpotApiError(safeProviderMessage(payload, response.status), response.status, requestCorrelationId);
      if (!error.retryable || attempt >= this.maxRetries) throw error;
      await this.sleep(retryDelay(response, attempt));
      attempt += 1;
    }
  }
}
