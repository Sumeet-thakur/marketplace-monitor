import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { integrationRepo } from "@/lib/repositories";
import { getResolvedCredential } from "@/lib/credentialService";
import { getProvider } from "@/lib/providers/registry";
import { logEvent } from "@/lib/logger";
import type { ProviderConfig } from "@/lib/providers/types";

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await params;
  const integration = integrationRepo.findById(id);
  if (!integration) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const provider = getProvider(integration.provider);
  const credential = await getResolvedCredential(id);
  const config: ProviderConfig = {
    integrationId: id,
    baseUrl: integration.baseUrl,
    endpoint: integration.endpoint,
    apiVersion: integration.apiVersion,
    httpMethod: integration.httpMethod,
    authMethod: integration.authMethod,
    headers: parseJson(integration.headersJson, {}),
    queryParams: parseJson(integration.queryParamsJson, {}),
    pagination: parseJson(integration.paginationJson, {}),
    fieldMapping: parseJson(integration.fieldMappingJson, {}),
    credential,
  };

  const result = await provider.testConnection(config);

  integrationRepo.update(id, {
    status: result.success ? "connected" : integration.enabled ? "error" : "not_configured",
    lastSuccessAt: result.success ? new Date() : undefined,
    lastFailureAt: result.success ? undefined : new Date(),
    lastErrorMessage: result.success ? null : result.message,
  });

  await logEvent({
    level: result.success ? "info" : "warn",
    category: "auth",
    integrationId: id,
    httpStatus: result.httpStatus,
    responseTimeMs: result.responseTimeMs,
    message: `Test connection: ${result.message}`,
  });

  return NextResponse.json({
    success: result.success,
    message: result.message,
    httpStatus: result.httpStatus ?? null,
    responseTimeMs: result.responseTimeMs,
    errorCategory: result.errorCategory ?? null,
    timestamp: new Date().toISOString(),
  });
}
