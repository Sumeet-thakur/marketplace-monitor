import type {
  MarketplaceProvider,
  NormalizedListing,
  ProviderConfig,
  ProviderStaticInfo,
  RawFetchResult,
  TestResult,
} from "./types";

// Generic REST provider: lets an admin connect any officially-permitted
// JSON REST API by configuring URL, auth, headers, query params, a simple
// pagination strategy, and a field-mapping ("results[].id -> externalId").
// No undocumented endpoints, no auth bypass, no scraping — this only ever
// makes the exact request the admin configured, with the credentials they
// legitimately provided.

function buildAuthHeaders(config: ProviderConfig): Record<string, string> {
  const headers: Record<string, string> = { ...(config.headers ?? {}) };
  const { authMethod, credential } = config;

  if (authMethod === "bearer" && credential.accessToken) {
    headers["Authorization"] = `Bearer ${credential.accessToken}`;
  } else if (authMethod === "api_key_header" && credential.apiKey) {
    headers["X-API-Key"] = credential.apiKey;
  } else if (authMethod === "basic" && credential.apiKey && credential.apiSecret) {
    const token = Buffer.from(`${credential.apiKey}:${credential.apiSecret}`).toString("base64");
    headers["Authorization"] = `Basic ${token}`;
  }
  return headers;
}

function buildUrl(config: ProviderConfig, cursor?: string | null): string {
  const base = (config.baseUrl ?? "").replace(/\/+$/, "");
  const endpoint = (config.endpoint ?? "").replace(/^\/+/, "");
  const url = new URL(`${base}/${endpoint}`);

  for (const [k, v] of Object.entries(config.queryParams ?? {})) {
    url.searchParams.set(k, v);
  }
  if (config.authMethod === "api_key_query" && config.credential.apiKey) {
    url.searchParams.set("api_key", config.credential.apiKey);
  }
  if (cursor && config.pagination?.cursorParam) {
    url.searchParams.set(String(config.pagination.cursorParam), cursor);
  }
  return url.toString();
}

/** Resolve a dotted/bracketed path like "results[].id" or "data.items" against a raw object. */
function getByPath(obj: unknown, path: string): unknown {
  const parts = path.replace(/\[\]/g, "").split(".").filter(Boolean);
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function getListPath(config: ProviderConfig): string {
  const mapping = config.fieldMapping ?? {};
  const anyKey = Object.values(mapping)[0] ?? "results[].id";
  // e.g. "results[].id" -> "results"
  const idx = anyKey.indexOf("[]");
  return idx >= 0 ? anyKey.slice(0, idx) : "";
}

export const genericProvider: MarketplaceProvider = {
  key: "generic",

  getProviderStatus(): ProviderStaticInfo {
    return {
      key: "generic",
      label: "Generic API Provider",
      description:
        "Connect any officially permitted REST JSON API by configuring URL, authentication, and a field mapping — no code changes required.",
      minIntervalSec: 10,
      requiresRealCredentials: true,
    };
  },

  async testConnection(config: ProviderConfig): Promise<TestResult> {
    const start = Date.now();
    if (!config.baseUrl || !config.endpoint) {
      return {
        success: false,
        responseTimeMs: Date.now() - start,
        errorCategory: "not_configured",
        message: "Base URL and endpoint must be configured before testing the connection.",
      };
    }
    try {
      const res = await fetch(buildUrl(config), {
        method: config.httpMethod ?? "GET",
        headers: buildAuthHeaders(config),
      });
      const responseTimeMs = Date.now() - start;
      if (res.status === 429) {
        return {
          success: false,
          httpStatus: 429,
          responseTimeMs,
          errorCategory: "rate_limit",
          message: "Connection failed: rate limited (HTTP 429).",
        };
      }
      if (res.status === 401 || res.status === 403) {
        return {
          success: false,
          httpStatus: res.status,
          responseTimeMs,
          errorCategory: "auth",
          message: "Connection failed: authentication rejected by the provider.",
        };
      }
      if (!res.ok) {
        return {
          success: false,
          httpStatus: res.status,
          responseTimeMs,
          errorCategory: res.status >= 500 ? "server" : "unknown",
          message: `Connection failed: provider returned HTTP ${res.status}.`,
        };
      }
      return {
        success: true,
        httpStatus: res.status,
        responseTimeMs,
        message: "Connection successful.",
      };
    } catch (err) {
      return {
        success: false,
        responseTimeMs: Date.now() - start,
        errorCategory: "network",
        message: `Connection failed: ${err instanceof Error ? err.message : "network error"}.`,
      };
    }
  },

  async fetchListings(config: ProviderConfig, cursor?: string | null): Promise<RawFetchResult> {
    const res = await fetch(buildUrl(config, cursor), {
      method: config.httpMethod ?? "GET",
      headers: buildAuthHeaders(config),
    });

    if (res.status === 429) {
      const retryAfterHeader = res.headers.get("Retry-After");
      return {
        items: [],
        rateLimited: true,
        retryAfterSec: retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined,
        httpStatus: 429,
      };
    }
    if (!res.ok) {
      throw Object.assign(new Error(`Provider returned HTTP ${res.status}`), {
        httpStatus: res.status,
      });
    }

    const body = await res.json();
    const listPath = getListPath(config);
    const list = listPath ? getByPath(body, listPath) : body;
    const items = Array.isArray(list) ? list : [];

    let nextCursor: string | null = null;
    if (config.pagination?.nextCursorPath) {
      const nc = getByPath(body, String(config.pagination.nextCursorPath));
      nextCursor = typeof nc === "string" ? nc : null;
    }

    return { items, nextCursor, httpStatus: res.status };
  },

  normalizeListing(raw: unknown, config: ProviderConfig): NormalizedListing {
    const mapping = config.fieldMapping ?? {
      "results[].id": "externalId",
      "results[].title": "title",
      "results[].price": "price",
    };
    const out: Record<string, unknown> = { raw };
    for (const [sourcePath, targetField] of Object.entries(mapping)) {
      // sourcePath here is relative to a single item, so strip the leading list prefix.
      const relative = sourcePath.replace(/^[^.]*\[\]\.?/, "");
      const value = relative ? getByPath(raw, relative) : raw;
      out[targetField] = value;
    }
    return {
      externalId: String(out.externalId ?? ""),
      title: String(out.title ?? "Untitled listing"),
      description: out.description as string | undefined,
      price: out.price !== undefined ? Number(out.price) : undefined,
      currency: out.currency as string | undefined,
      make: out.make as string | undefined,
      model: out.model as string | undefined,
      year: out.year !== undefined ? Number(out.year) : undefined,
      mileage: out.mileage !== undefined ? Number(out.mileage) : undefined,
      location: out.location as string | undefined,
      sellerName: out.sellerName as string | undefined,
      sellerType: out.sellerType as string | undefined,
      imageUrl: out.imageUrl as string | undefined,
      listingUrl: out.listingUrl as string | undefined,
      postedAt: out.postedAt as string | undefined,
      raw,
    };
  },
};
