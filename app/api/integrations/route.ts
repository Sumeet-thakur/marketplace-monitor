import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { integrationRepo } from "@/lib/repositories";
import { saveCredential } from "@/lib/credentialService";
import { serializeIntegration } from "@/lib/serializers";
import { notifyIntegrationsChanged } from "@/lib/sync/scheduler";
import { listProviderInfo } from "@/lib/providers/registry";

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const rows = integrationRepo.findAll();
  const integrations = await Promise.all(rows.map(serializeIntegration));
  return NextResponse.json({ integrations, availableProviders: listProviderInfo() });
}

export async function POST(req: Request) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const body = await req.json().catch(() => ({}));
  const provider = String(body.provider ?? "").trim();
  const displayName = String(body.displayName ?? "").trim();
  if (!provider || !displayName) {
    return NextResponse.json({ error: "provider and displayName are required." }, { status: 400 });
  }

  const created = integrationRepo.create({
    provider,
    displayName,
    enabled: false,
    baseUrl: body.baseUrl ?? null,
    endpoint: body.endpoint ?? null,
    apiVersion: body.apiVersion ?? null,
    requestIntervalSec: body.requestIntervalSec ?? 60,
    minIntervalSec: body.minIntervalSec ?? 15,
    httpMethod: body.httpMethod ?? "GET",
    authMethod: body.authMethod ?? null,
    headersJson: body.headers ? JSON.stringify(body.headers) : null,
    queryParamsJson: body.queryParams ? JSON.stringify(body.queryParams) : null,
    paginationJson: body.pagination ? JSON.stringify(body.pagination) : null,
    fieldMappingJson: body.fieldMapping ? JSON.stringify(body.fieldMapping) : null,
  });

  if (body.apiKey || body.apiSecret || body.accessToken) {
    await saveCredential(created.id, {
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      accessToken: body.accessToken,
    });
  }

  notifyIntegrationsChanged();
  return NextResponse.json(await serializeIntegration(created), { status: 201 });
}
