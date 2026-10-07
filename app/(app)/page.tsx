import Link from "next/link";
import { listingRepo, integrationRepo, syncRunRepo } from "@/lib/repositories";
import StatCard from "@/components/StatCard";
import StatusBadge from "@/components/StatusBadge";
import { formatPrice, formatMileage, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const stats = listingRepo.stats();
  const integrations = integrationRepo.findAll();
  const activeSources = integrations.filter((i) => i.enabled).length;
  const { rows: recent } = listingRepo.find({ sort: "newest", limit: 12 });
  const recentRuns = syncRunRepo.recentAll(5);
  const errorsToday = recentRuns.filter((r) => r.status === "failed" || r.status === "rate_limited").length;

  const lastSync = integrations
    .filter((i) => i.lastSuccessAt)
    .sort((a, b) => new Date(b.lastSuccessAt!).getTime() - new Date(a.lastSuccessAt!).getTime())[0];

  const apiHealthy = integrations.filter((i) => i.enabled && i.status === "connected").length;
  const apiTotal = integrations.filter((i) => i.enabled).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-text-muted mt-0.5">Real-time overview of monitored marketplace listings.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <StatCard label="Total Listings" value={stats.total.toLocaleString()} />
        <StatCard label="New Listings" value={stats.newCount.toLocaleString()} accent="live" />
        <StatCard label="Listings Today" value={stats.today.toLocaleString()} accent="info" />
        <StatCard label="Active Sources" value={`${activeSources}`} sub={`of ${integrations.length} configured`} />
        <StatCard
          label="API Health"
          value={apiTotal ? `${apiHealthy}/${apiTotal}` : "—"}
          accent={apiTotal && apiHealthy === apiTotal ? "live" : apiHealthy > 0 ? "warn" : "neutral"}
        />
        <StatCard label="Last Sync" value={lastSync ? timeAgo(lastSync.lastSuccessAt) : "—"} />
        <StatCard label="Errors" value={`${errorsToday}`} accent={errorsToday > 0 ? "error" : "neutral"} sub="last 5 runs" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-soft flex items-center justify-between">
            <h2 className="text-sm font-medium">Recently detected listings</h2>
            <Link href="/listings" className="text-xs text-signal-info hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-border-soft">
            {recent.length === 0 && (
              <div className="p-6 text-sm text-text-muted text-center">
                No listings yet. Enable an integration to start monitoring.
              </div>
            )}
            {recent.map((listing) => (
              <Link
                key={listing.id}
                href={`/listings/${listing.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2 transition-colors"
              >
                <img
                  src={listing.imageUrl ?? "https://placehold.co/64x48/161d28/5c6779?text=%20"}
                  alt=""
                  className="h-10 w-14 object-cover rounded-md bg-surface-2 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{listing.title}</div>
                  <div className="text-xs text-text-dim">
                    {listing.source} · {listing.location ?? "Unknown location"} · {timeAgo(listing.firstSeenAt)}
                  </div>
                </div>
                <div className="text-sm font-mono shrink-0">{formatPrice(listing.price, listing.currency)}</div>
                <div className="shrink-0">
                  <StatusBadge status={listing.status} />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border-soft flex items-center justify-between">
            <h2 className="text-sm font-medium">Sources</h2>
            <Link href="/integrations" className="text-xs text-signal-info hover:underline">
              Manage →
            </Link>
          </div>
          <div className="divide-y divide-border-soft">
            {integrations.map((i) => (
              <div key={i.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-sm truncate">{i.displayName}</div>
                  <div className="text-xs text-text-dim">every {i.requestIntervalSec}s</div>
                </div>
                <StatusBadge status={i.enabled ? i.status : "not_configured"} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border-soft flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent sync activity</h2>
          <Link href="/sync" className="text-xs text-signal-info hover:underline">
            View all →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-dim">
              <th className="px-4 py-2 font-normal">Source</th>
              <th className="px-4 py-2 font-normal">Started</th>
              <th className="px-4 py-2 font-normal">Status</th>
              <th className="px-4 py-2 font-normal">Fetched</th>
              <th className="px-4 py-2 font-normal">New</th>
              <th className="px-4 py-2 font-normal">Updated</th>
              <th className="px-4 py-2 font-normal">Duration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft">
            {recentRuns.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-text-muted">
                  No sync runs yet.
                </td>
              </tr>
            )}
            {recentRuns.map((run) => (
              <tr key={run.id}>
                <td className="px-4 py-2 font-mono text-xs">{run.displayName}</td>
                <td className="px-4 py-2 text-text-muted text-xs">{timeAgo(run.startedAt)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-2 font-mono">{run.itemsFetched}</td>
                <td className="px-4 py-2 font-mono text-signal-live">{run.itemsNew}</td>
                <td className="px-4 py-2 font-mono text-signal-info">{run.itemsUpdated}</td>
                <td className="px-4 py-2 font-mono text-text-muted">{run.durationMs ? `${run.durationMs}ms` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
