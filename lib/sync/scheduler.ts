import { integrationRepo } from "../repositories";
import { runSyncForIntegration } from "./syncEngine";
import { getProvider } from "../providers/registry";
import { logEvent } from "../logger";

// In-process scheduler: one setInterval per enabled integration. This is
// appropriate for a single-instance MVP deployment. To scale out, this
// module's responsibilities (deciding "is it time to poll integration X")
// would move to a durable job queue (e.g. BullMQ/Redis) so multiple worker
// instances can coordinate without double-polling — the `runSyncForIntegration`
// function itself would not need to change.

const timers = new Map<string, NodeJS.Timeout>();
const timerIntervalMs = new Map<string, number>();
let refreshTimer: NodeJS.Timeout | null = null;
let started = false;

/**
 * Pure function computing the effective poll interval for an integration:
 * never faster than whichever is stricter — the provider's hard-coded
 * safety floor, or the admin-configured minimum. Extracted so it's unit
 * testable without spinning up real timers.
 */
export function computeEffectiveIntervalSec(
  requestIntervalSec: number,
  adminMinIntervalSec: number,
  providerMinIntervalSec: number
): number {
  const floor = Math.max(adminMinIntervalSec, providerMinIntervalSec);
  return Math.max(requestIntervalSec, floor);
}

async function reconcile() {
  const integrations = integrationRepo.findAll();
  const activeIds = new Set<string>();

  for (const integration of integrations) {
    if (!integration.enabled) continue;
    activeIds.add(integration.id);

    const provider = getProvider(integration.provider);
    const intervalSec = computeEffectiveIntervalSec(
      integration.requestIntervalSec,
      integration.minIntervalSec,
      provider.getProviderStatus().minIntervalSec
    );
    const intervalMs = intervalSec * 1000;

    const existing = timers.get(integration.id);
    const existingIntervalMs = timerIntervalMs.get(integration.id);
    if (existing && existingIntervalMs === intervalMs) continue;

    // Interval changed (or this is a new integration) — tear down and recreate.
    if (existing) clearInterval(existing);

    const timer = setInterval(() => {
      runSyncForIntegration(integration.id).catch((err) => {
        logEvent({
          level: "error",
          category: "worker",
          integrationId: integration.id,
          message: `Unhandled scheduler error: ${err instanceof Error ? err.message : String(err)}`,
        });
      });
    }, intervalMs);
    timers.set(integration.id, timer);
    timerIntervalMs.set(integration.id, intervalMs);

    // Kick off an immediate first sync so the demo feels instant.
    runSyncForIntegration(integration.id).catch(() => void 0);
  }

  // Tear down timers for integrations that were disabled/deleted.
  for (const [id, timer] of timers.entries()) {
    if (!activeIds.has(id)) {
      clearInterval(timer);
      timers.delete(id);
      timerIntervalMs.delete(id);
    }
  }
}

export function startScheduler() {
  if (started) return;
  started = true;
  reconcile().catch((err) => console.error("Scheduler initial reconcile failed", err));
  // Periodically re-check the Integration table so that enabling/disabling
  // or editing an interval in the Admin UI takes effect without a restart.
  refreshTimer = setInterval(() => {
    reconcile().catch((err) => console.error("Scheduler reconcile failed", err));
  }, 5000);
}

/** Force an immediate reconcile — called right after an admin toggles/edits an integration. */
export function notifyIntegrationsChanged() {
  reconcile().catch((err) => console.error("Scheduler reconcile failed", err));
}

export function stopScheduler() {
  for (const timer of timers.values()) clearInterval(timer);
  timers.clear();
  if (refreshTimer) clearInterval(refreshTimer);
  started = false;
}
