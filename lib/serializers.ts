import { getMaskedCredential } from "./credentialService";
import { getProvider } from "./providers/registry";
import type { IntegrationRow } from "./repositories";

// The ONLY function allowed to shape an Integration for an API response.
// Guarantees raw secrets never appear: it calls getMaskedCredential (never
// getResolvedCredential) and only forwards known-safe Integration columns.
export async function serializeIntegration(row: IntegrationRow) {
  const credential = await getMaskedCredential(row.id);
  let providerInfo;
  try {
    providerInfo = getProvider(row.provider).getProviderStatus();
  } catch {
    providerInfo = null;
  }

  return {
    id: row.id,
    provider: row.provider,
    displayName: row.displayName,
    enabled: Boolean(row.enabled),
    demo: Boolean(row.demo),
    baseUrl: row.baseUrl,
    endpoint: row.endpoint,
    apiVersion: row.apiVersion,
    requestIntervalSec: row.requestIntervalSec,
    minIntervalSec: row.minIntervalSec,
    httpMethod: row.httpMethod,
    authMethod: row.authMethod,
    headers: safeParse(row.headersJson),
    queryParams: safeParse(row.queryParamsJson),
    pagination: safeParse(row.paginationJson),
    fieldMapping: safeParse(row.fieldMappingJson),
    status: row.status,
    lastSuccessAt: row.lastSuccessAt,
    lastFailureAt: row.lastFailureAt,
    lastErrorMessage: row.lastErrorMessage,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    credential,
    providerInfo,
  };
}

function safeParse(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
