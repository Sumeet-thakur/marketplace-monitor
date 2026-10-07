import type {
  MarketplaceProvider,
  NormalizedListing,
  ProviderConfig,
  ProviderStaticInfo,
  RawFetchResult,
  TestResult,
} from "./types";

// PakWheels does not publish a general-purpose public listings API for
// third-party developers as of this writing. This adapter is a pluggable
// placeholder: if you obtain an authorized data-partnership API (from
// PakWheels directly, or an approved third-party auto-listings data
// provider), configure Base URL / Endpoint / API Key / Secret here and this
// adapter calls exactly that endpoint. No scraping or undocumented access
// is implemented. Until real credentials are supplied this integration
// reports "Not Configured".

export const pakwheelsProvider: MarketplaceProvider = {
  key: "pakwheels",

  getProviderStatus(): ProviderStaticInfo {
    return {
      key: "pakwheels",
      label: "PakWheels (or approved data provider)",
      description:
        "Pluggable adapter for an authorized PakWheels or third-party auto-listings data API. Requires legitimate API key/secret from an approved provider.",
      minIntervalSec: 30,
      requiresRealCredentials: true,
    };
  },

  async testConnection(config: ProviderConfig): Promise<TestResult> {
    const start = Date.now();
    if (!config.credential.apiKey || !config.baseUrl || !config.endpoint) {
      return {
        success: false,
        responseTimeMs: Date.now() - start,
        errorCategory: "not_configured",
        message: "Not configured. Enter a legitimate API key and endpoint from an authorized data provider.",
      };
    }
    try {
      const url = `${config.baseUrl.replace(/\/+$/, "")}/${config.endpoint.replace(/^\/+/, "")}`;
      const res = await fetch(url, {
        headers: {
          "X-API-Key": config.credential.apiKey,
          ...(config.credential.apiSecret ? { "X-API-Secret": config.credential.apiSecret } : {}),
        },
      });
      const responseTimeMs = Date.now() - start;
      if (res.status === 401 || res.status === 403) {
        return { success: false, httpStatus: res.status, responseTimeMs, errorCategory: "auth", message: "Connection failed: credentials rejected." };
      }
      if (!res.ok) {
        return { success: false, httpStatus: res.status, responseTimeMs, errorCategory: "unknown", message: `Connection failed: HTTP ${res.status}.` };
      }
      return { success: true, httpStatus: res.status, responseTimeMs, message: "Connection successful." };
    } catch (err) {
      return {
        success: false,
        responseTimeMs: Date.now() - start,
        errorCategory: "network",
        message: `Connection failed: ${err instanceof Error ? err.message : "network error"}.`,
      };
    }
  },

  async fetchListings(config: ProviderConfig): Promise<RawFetchResult> {
    if (!config.credential.apiKey || !config.baseUrl || !config.endpoint) return { items: [] };
    const url = `${config.baseUrl.replace(/\/+$/, "")}/${config.endpoint.replace(/^\/+/, "")}`;
    const res = await fetch(url, {
      headers: {
        "X-API-Key": config.credential.apiKey,
        ...(config.credential.apiSecret ? { "X-API-Secret": config.credential.apiSecret } : {}),
      },
    });
    if (res.status === 429) return { items: [], rateLimited: true, httpStatus: 429 };
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { httpStatus: res.status });
    const body = await res.json();
    const items = Array.isArray(body?.results) ? body.results : Array.isArray(body) ? body : [];
    return { items, httpStatus: res.status };
  },

  normalizeListing(raw: unknown): NormalizedListing {
    const r = raw as Record<string, unknown>;
    return {
      externalId: String(r.id ?? ""),
      title: String(r.title ?? "Untitled"),
      price: typeof r.price === "number" ? r.price : undefined,
      make: r.make as string | undefined,
      model: r.model as string | undefined,
      year: r.year as number | undefined,
      mileage: r.mileage as number | undefined,
      location: r.city as string | undefined,
      listingUrl: r.url as string | undefined,
      imageUrl: r.image as string | undefined,
      raw: r,
    };
  },
};
