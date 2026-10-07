import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { integrationRepo } from "@/lib/repositories";
import { serializeIntegration } from "@/lib/serializers";
import { notifyIntegrationsChanged } from "@/lib/sync/scheduler";
import { logEvent } from "@/lib/logger";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { id } = await params;
  const existing = integrationRepo.findById(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const enabled = typeof body.enabled === "boolean" ? body.enabled : !existing.enabled;

  const updated = integrationRepo.update(id, {
    enabled,
    status: enabled ? existing.status : "not_configured",
  });

  await logEvent({
    level: "info",
    category: "worker",
    integrationId: id,
    message: `Integration ${enabled ? "enabled" : "disabled"} via Admin UI.`,
  });

  notifyIntegrationsChanged();
  return NextResponse.json(await serializeIntegration(updated));
}
