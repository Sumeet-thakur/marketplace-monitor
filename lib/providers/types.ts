import type { ResolvedCredential } from "../credentialService";

export interface NormalizedListing {
  externalId: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  make?: string;
  model?: string;
  year?: number;
  mileage?: number;
  location?: string;
  sellerName?: string;
  sellerType?: string;
  imageUrl?: string;
  listingUrl?: string;
  postedAt?: string; // ISO date
  raw: unknown;
}

export interface TestResult {
  success: boolean;
  httpStatus?: number;
  responseTimeMs: number;
  errorCategory?: "auth" | "network" | "rate_limit" | "server" | "not_configured" | "unknown";
  message: string;
}

export interface RawFetchResult {
  items: unknown[];
  nextCursor?: string | null;
  rateLimited?: boolean;
  retryAfterSec?: number;
  httpStatus?: number;
}

/** Non-secret configuration passed to a provider, resolved from the Integration row. */
export interface ProviderConfig {
  integrationId: string;
  baseUrl?: string | null;
  endpoint?: string | null;
  apiVersion?: string | null;
  httpMethod?: string | null;
  authMethod?: string | null;
  headers?: Record<string, string>;
  queryParams?: Record<string, string>;
  pagination?: Record<string, unknown>;
  fieldMapping?: Record<string, string>;
  credential: ResolvedCredential;
}

export interface ProviderStaticInfo {
  key: string;
  label: string;
  description: string;
  minIntervalSec: number;
  requiresRealCredentials: boolean;
}

export interface MarketplaceProvider {
  key: string;
  getProviderStatus(): ProviderStaticInfo;
  testConnection(config: ProviderConfig): Promise<TestResult>;
  fetchListings(config: ProviderConfig, cursor?: string | null): Promise<RawFetchResult>;
  normalizeListing(raw: unknown, config: ProviderConfig): NormalizedListing;
}
