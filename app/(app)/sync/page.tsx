import { syncRunRepo } from "@/lib/repositories";
import StatusBadge from "@/components/StatusBadge";
import { formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SyncActivityPage() {
  const runs = syncRunRepo.recentAll(100);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Sync Activity</h1>
        <p className="text-sm text-text-muted mt-0.5">Full history of background polling runs.</p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-dim border-b border-border-soft">
              <th className="px-4 py-2.5 font-normal">Source</th>
              <th className="px-4 py-2.5 font-normal">Started</th>
              <th className="px-4 py-2.5 font-normal">Status</th>
              <th className="px-4 py-2.5 font-normal">Fetched</th>
              <th className="px-4 py-2.5 font-normal">New</th>
              <th className="px-4 py-2.5 font-normal">Updated</th>
              <th className="px-4 py-2.5 font-normal">Duration</th>
              <th className="px-4 py-2.5 font-normal">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {runs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-text-muted">
                  No sync runs yet.
                </td>
              </tr>
            )}
            {runs.map((run) => (
              <tr key={run.id}>
                <td className="px-4 py-2 font-mono text-xs">{run.displayName}</td>
                <td className="px-4 py-2 text-text-muted text-xs">{formatDateTime(run.startedAt)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-2 font-mono">{run.itemsFetched}</td>
                <td className="px-4 py-2 font-mono text-signal-live">{run.itemsNew}</td>
                <td className="px-4 py-2 font-mono text-signal-info">{run.itemsUpdated}</td>
                <td className="px-4 py-2 font-mono text-text-muted">{run.durationMs ? `${run.durationMs}ms` : "—"}</td>
                <td className="px-4 py-2 text-signal-error text-xs truncate max-w-xs">{run.errorMessage ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
