import { integrationRepo, syncRunRepo, apiLogRepo } from "@/lib/repositories";
import StatusBadge from "@/components/StatusBadge";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  const integrations = integrationRepo.findAll();

  const health = integrations.map((integration) => {
    const runs = syncRunRepo.recentForIntegration(integration.id, 500);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const runsToday = runs.filter((r) => new Date(r.startedAt) >= todayStart);
    const errorsToday = runsToday.filter((r) => r.status === "failed" || r.status === "rate_limited").length;
    const successfulRuns = runs.filter((r) => r.status === "success" && r.durationMs != null);
    const avgResponseMs =
      successfulRuns.length > 0
        ? Math.round(successfulRuns.reduce((sum, r) => sum + (r.durationMs ?? 0), 0) / successfulRuns.length)
        : null;
    const recentError = apiLogRepo.recent(50, "error").find((l) => l.integrationId === integration.id);

    return { integration, requestsToday: runsToday.length, errorsToday, avgResponseMs, recentError };
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">API Health</h1>
        <p className="text-sm text-text-muted mt-0.5">Request volume, error rate, and latency per source.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {health.map(({ integration, requestsToday, errorsToday, avgResponseMs, recentError }) => (
          <div key={integration.id} className="bg-surface border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{integration.displayName}</div>
                <div className="text-[10px] uppercase tracking-wider text-text-dim font-mono">{integration.provider}</div>
              </div>
              <StatusBadge status={integration.enabled ? integration.status : "not_configured"} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Requests today" value={requestsToday.toLocaleString()} />
              <MiniStat label="Errors today" value={errorsToday.toLocaleString()} accent={errorsToday > 0 ? "error" : undefined} />
              <MiniStat label="Avg response" value={avgResponseMs != null ? `${avgResponseMs}ms` : "—"} />
              <MiniStat label="Last success" value={timeAgo(integration.lastSuccessAt)} />
            </div>

            {recentError && (
              <div className="text-xs text-signal-error bg-signal-error/10 border border-signal-error/25 rounded-lg px-2.5 py-1.5 truncate">
                {recentError.message}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: "error" }) {
  return (
    <div className="bg-surface-2 border border-border-soft rounded-lg px-2.5 py-1.5">
      <div className="text-[10px] text-text-dim">{label}</div>
      <div className={`font-mono text-sm ${accent === "error" ? "text-signal-error" : ""}`}>{value}</div>
    </div>
  );
}
