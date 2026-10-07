import { logEvent } from "../logger";
import { publish } from "../eventBus";
import { getProvider } from "../providers/registry";
import { getResolvedCredential } from "../credentialService";
import {
  integrationRepo,
  listingRepo,
  listingEventRepo,
  syncRunRepo,
  type IntegrationRow,
} from "../repositories";
import type { ProviderConfig } from "../providers/types";

// Simple per-integration backoff state (in-memory; resets on server restart).
// Prevents runaway retries against a rate-limited or failing provider.
const backoffUntil = new Map<string, number>();

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildProviderConfig(
  integration: IntegrationRow,
  credential: Awaited<ReturnType<typeof getResolvedCredential>>
): ProviderConfig {
  return {
    integrationId: integration.id,
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
}

/** Diff a subset of fields we consider "significant" and worth logging as an event. */
function diffFields(existing: Record<string, unknown>, incoming: Record<string, unknown>) {
  const watched = ["price", "title", "description", "mileage", "location"] as const;
  const changes: Array<{ field: string; from: unknown; to: unknown }> = [];
  for (const field of watched) {
    const from = existing[field];
    const to = incoming[field];
    if (to !== undefined && to !== null && String(from ?? "") !== String(to ?? "")) {
      changes.push({ field, from, to });
    }
  }
  return changes;
}

export async function runSyncForIntegration(integrationId: string) {
  const now = Date.now();
  const activeBackoff = backoffUntil.get(integrationId);
  if (activeBackoff && activeBackoff > now) {
    return; // still backing off from a previous 429 / failure
  }

  const integration = integrationRepo.findById(integrationId);
  if (!integration || !integration.enabled) return;

  const syncRun = syncRunRepo.create(integrationId);
  publish({ type: "sync.started", integrationId, provider: integration.provider });

  const startedAt = Date.now();
  try {
    const provider = getProvider(integration.provider);
    const credential = await getResolvedCredential(integrationId);
    const config = buildProviderConfig(integration, credential);

    await logEvent({
      level: "info",
      category: "request",
      integrationId,
      message: `Polling ${integration.provider} (${integration.displayName})`,
    });

    const result = await provider.fetchListings(config);

    if (result.rateLimited) {
      const retryAfterMs = (result.retryAfterSec ?? 30) * 1000;
      backoffUntil.set(integrationId, Date.now() + retryAfterMs);
      await logEvent({
        level: "warn",
        category: "rate_limit",
        integrationId,
        httpStatus: 429,
        message: `Rate limited. Backing off for ${Math.round(retryAfterMs / 1000)}s.`,
      });
      integrationRepo.update(integrationId, {
        status: "rate_limited",
        lastFailureAt: new Date(),
        lastErrorMessage: "Rate limited (429)",
      });
      syncRunRepo.update(syncRun.id, {
        status: "rate_limited",
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
      });
      publish({ type: "integration.status", integrationId, status: "rate_limited" });
      return;
    }

    let itemsNew = 0;
    let itemsUpdated = 0;

    for (const rawItem of result.items) {
      const normalized = provider.normalizeListing(rawItem, config);
      if (!normalized.externalId) continue;

      const existing = listingRepo.findBySourceAndExternalId(integration.provider, normalized.externalId);

      const incomingData = {
        title: normalized.title,
        description: normalized.description ?? null,
        price: normalized.price ?? null,
        currency: normalized.currency ?? null,
        make: normalized.make ?? null,
        model: normalized.model ?? null,
        year: normalized.year ?? null,
        mileage: normalized.mileage ?? null,
        location: normalized.location ?? null,
        sellerName: normalized.sellerName ?? null,
        sellerType: normalized.sellerType ?? null,
        imageUrl: normalized.imageUrl ?? null,
        listingUrl: normalized.listingUrl ?? null,
        postedAt: normalized.postedAt ? new Date(normalized.postedAt) : null,
        rawData: JSON.stringify(normalized.raw).slice(0, 20_000),
      };

      if (!existing) {
        const created = listingRepo.create(integration.provider, normalized.externalId, integrationId, "NEW", incomingData);
        listingEventRepo.create(created.id, "FIRST_DETECTED", "First detected");
        itemsNew++;
        publish({ type: "listing.new", listing: created as unknown as Record<string, unknown> });
      } else {
        const changes = diffFields(existing as unknown as Record<string, unknown>, incomingData as Record<string, unknown>);
        const nextStatus = changes.length > 0 ? "UPDATED" : existing.status === "NEW" ? "NEW" : "ACTIVE";
        const updated = listingRepo.update(existing.id, nextStatus, incomingData);
        if (changes.length > 0) {
          itemsUpdated++;
          for (const change of changes) {
            listingEventRepo.create(
              existing.id,
              change.field === "price" ? "PRICE_CHANGED" : change.field === "description" ? "DESCRIPTION_CHANGED" : "UPDATED",
              `${change.field} changed from ${String(change.from)} to ${String(change.to)}`,
              String(change.from ?? ""),
              String(change.to ?? "")
            );
          }
          publish({
            type: "listing.updated",
            listing: updated as unknown as Record<string, unknown>,
            changes: changes.map((c) => c.field),
          });
        } else {
          listingEventRepo.create(existing.id, "UPDATED", "Re-seen, no field changes");
        }
      }
    }

    integrationRepo.update(integrationId, { status: "connected", lastSuccessAt: new Date(), lastErrorMessage: null });
    syncRunRepo.update(syncRun.id, {
      status: "success",
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      itemsFetched: result.items.length,
      itemsNew,
      itemsUpdated,
    });
    await logEvent({
      level: "info",
      category: "response",
      integrationId,
      httpStatus: result.httpStatus,
      message: `Sync complete: ${result.items.length} fetched, ${itemsNew} new, ${itemsUpdated} updated.`,
    });
    publish({ type: "sync.finished", integrationId, provider: integration.provider, itemsNew, itemsUpdated });
    publish({ type: "integration.status", integrationId, status: "connected" });
    backoffUntil.delete(integrationId);
  } catch (err) {
    const httpStatus = (err as { httpStatus?: number })?.httpStatus;
    const message = err instanceof Error ? err.message : "Unknown sync error";

    integrationRepo.update(integrationId, { status: "error", lastFailureAt: new Date(), lastErrorMessage: message });
    syncRunRepo.update(syncRun.id, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      errorMessage: message,
    });
    await logEvent({
      level: "error",
      category: httpStatus === 401 || httpStatus === 403 ? "auth" : "worker",
      integrationId,
      httpStatus,
      message: `Sync failed: ${message}`,
    });
    publish({ type: "integration.status", integrationId, status: "error" });

    // brief backoff on hard failure too, to avoid hammering a broken endpoint
    backoffUntil.set(integrationId, Date.now() + 15_000);
  }
}
