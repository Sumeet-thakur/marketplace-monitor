import { NextResponse } from "next/server";
import { requireUser } from "@/lib/apiAuth";
import { integrationRepo, syncRunRepo, apiLogRepo } from "@/lib/repositories";

function timeAgo(iso: string | null): string | null {
  if (!iso) return null;
  const diffMs = Date.now() - new Date(iso).getTime();
  const s = Math.round(diffMs / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return `${h}h ago`;
}

export async function GET() {
  const { user, response } = await requireUser();
  if (!user) return response;

  const integrations = integrationRepo.findAll();

  const health = integrations.map((integration) => {
    const runs = syncRunRepo.recentForIntegration(integration.id, 500);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const runsToday = runs.filter((r) => new Date(r.startedAt) >= today);
    const requestsToday = runsToday.length;
    const errorsToday = runsToday.filter((r) => r.status === "failed" || r.status === "rate_limited").length;
    const successfulRuns = runs.filter((r) => r.status === "success" && r.durationMs != null);
    const avgResponseMs =
      successfulRuns.length > 0
        ? Math.round(successfulRuns.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) / successfulRuns.length)
        : null;

    const recentErrorLog = apiLogRepo.recent(1, "error").find((l) => l.integrationId === integration.id);

    return {
      integrationId: integration.id,
      provider: integration.provider,
      displayName: integration.displayName,
      status: integration.status,
      enabled: Boolean(integration.enabled),
      lastSuccessAt: integration.lastSuccessAt,
      lastSuccessAgo: timeAgo(integration.lastSuccessAt),
      lastFailureAt: integration.lastFailureAt,
      lastErrorMessage: integration.lastErrorMessage,
      requestsToday,
      errorsToday,
      avgResponseMs,
      recentErrorMessage: recentErrorLog?.message ?? null,
    };
  });

  return NextResponse.json({ health });
}
