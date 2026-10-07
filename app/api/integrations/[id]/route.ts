import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { integrationRepo } from "@/lib/repositories";
import { saveCredential, deleteCredential } from "@/lib/credentialService";
import { serializeIntegration } from "@/lib/serializers";
import { notifyIntegrationsChanged } from "@/lib/sync/scheduler";
import { logEvent } from "@/lib/logger";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await params;
  const row = integrationRepo.findById(id);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(await serializeIntegration(row));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await params;
  const existing = integrationRepo.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));

  const updated = integrationRepo.update(id, {
    displayName: body.displayName,
    enabled: body.enabled,
    baseUrl: body.baseUrl,
    endpoint: body.endpoint,
    apiVersion: body.apiVersion,
    requestIntervalSec: body.requestIntervalSec,
    minIntervalSec: body.minIntervalSec,
    httpMethod: body.httpMethod,
    authMethod: body.authMethod,
    headersJson: body.headers !== undefined ? JSON.stringify(body.headers) : undefined,
    queryParamsJson: body.queryParams !== undefined ? JSON.stringify(body.queryParams) : undefined,
    paginationJson: body.pagination !== undefined ? JSON.stringify(body.pagination) : undefined,
    fieldMappingJson: body.fieldMapping !== undefined ? JSON.stringify(body.fieldMapping) : undefined,
  });

  // Credential rotation: this is the "change the token from Settings, no
  // redeploy needed" path. The next scheduled poll (or a manual Test
  // Connection) picks up the new value immediately because the provider
  // adapter always resolves credentials fresh from the DB at request time.
  if (body.apiKey !== undefined || body.apiSecret !== undefined || body.accessToken !== undefined) {
    await saveCredential(id, {
      apiKey: body.apiKey,
      apiSecret: body.apiSecret,
      accessToken: body.accessToken,
    });
    await logEvent({
      level: "info",
      category: "auth",
      integrationId: id,
      message: "Credentials updated via Admin UI.",
    });
  }

  notifyIntegrationsChanged();
  return NextResponse.json(await serializeIntegration(updated));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await params;
  await deleteCredential(id);
  integrationRepo.delete(id);
  notifyIntegrationsChanged();
  return NextResponse.json({ ok: true });
}
