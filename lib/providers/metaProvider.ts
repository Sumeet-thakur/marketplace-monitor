import type {
  MarketplaceProvider,
  NormalizedListing,
  ProviderConfig,
  ProviderStaticInfo,
  RawFetchResult,
  TestResult,
} from "./types";

// IMPORTANT — read before wiring up real credentials:
// Meta does not currently offer a public, general-purpose "search Facebook
// Marketplace listings" API for third-party apps. This adapter intentionally
// does NOT implement scraping, undocumented endpoints, or session-cookie
// based access — that would violate Meta's terms and this project's own
// requirements.
//
// What this adapter DOES support: if you have credentials for a Meta
// product you are officially authorized to use (e.g. the Graph API for
// content you own/manage), configure the Access Token + API Version +
// Endpoint here and this adapter will call exactly that endpoint. Until
// then, leave this integration disabled and use the Demo Provider or the
// Generic API Provider pointed at an authorized third-party listings API.

export const metaProvider: MarketplaceProvider = {
  key: "meta",

  getProviderStatus(): ProviderStaticInfo {
    return {
      key: "meta",
      label: "Meta / Facebook",
      description:
        "Pluggable adapter for officially authorized Meta Graph API access. There is no general-purpose public Marketplace listings API — do not enter scraped tokens or session cookies here.",
      minIntervalSec: 30,
      requiresRealCredentials: true,
    };
  },

  async testConnection(config: ProviderConfig): Promise<TestResult> {
    const start = Date.now();
    if (!config.credential.accessToken || !config.endpoint) {
      return {
        success: false,
        responseTimeMs: Date.now() - start,
        errorCategory: "not_configured",
        message:
          "Not configured. Enter a legitimate Access Token, API version, and endpoint for a Graph API resource you are authorized to access.",
      };
    }
    try {
      const url = `${config.baseUrl ?? "https://graph.facebook.com"}/${config.apiVersion ?? "v19.0"}/${config.endpoint}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${config.credential.accessToken}` },
      });
      const responseTimeMs = Date.now() - start;
      if (res.status === 401 || res.status === 403) {
        return { success: false, httpStatus: res.status, responseTimeMs, errorCategory: "auth", message: "Connection failed: token rejected." };
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
    if (!config.credential.accessToken || !config.endpoint) {
      return { items: [] };
    }
    const url = `${config.baseUrl ?? "https://graph.facebook.com"}/${config.apiVersion ?? "v19.0"}/${config.endpoint}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${config.credential.accessToken}` } });
    if (res.status === 429) return { items: [], rateLimited: true, httpStatus: 429 };
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { httpStatus: res.status });
    const body = await res.json();
    const items = Array.isArray(body?.data) ? body.data : [];
    return { items, httpStatus: res.status };
  },

  normalizeListing(raw: unknown): NormalizedListing {
    const r = raw as Record<string, unknown>;
    return {
      externalId: String(r.id ?? ""),
      title: String(r.name ?? r.title ?? "Untitled"),
      description: r.description as string | undefined,
      price: typeof r.price === "number" ? r.price : undefined,
      imageUrl: (r.picture as { data?: { url?: string } })?.data?.url,
      raw: r,
    };
  },
};
