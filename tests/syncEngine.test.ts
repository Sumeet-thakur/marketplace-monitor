import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";

// Point the app at a throwaway SQLite file BEFORE importing any module that
// touches lib/db.ts, so tests never write to the real dev.db.
const tmpDbPath = path.join(os.tmpdir(), `overwatch-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
process.env.DATABASE_URL = `file:${tmpDbPath}`;
process.env.ENCRYPTION_KEY = "test-encryption-key-for-unit-tests";

const { integrationRepo, listingRepo, listingEventRepo, syncRunRepo } = await import("../lib/repositories");
const { runSyncForIntegration } = await import("../lib/sync/syncEngine");
const { providerRegistry } = await import("../lib/providers/registry");
const { saveCredential, getMaskedCredential, getResolvedCredential } = await import("../lib/credentialService");
const { computeEffectiveIntervalSec } = await import("../lib/sync/scheduler");
import type { MarketplaceProvider, RawFetchResult } from "../lib/providers/types";

test.after(() => {
  fs.rmSync(tmpDbPath, { force: true });
  fs.rmSync(`${tmpDbPath}-wal`, { force: true });
  fs.rmSync(`${tmpDbPath}-shm`, { force: true });
});

// A controllable fake provider so tests can dictate exactly what "the API"
// returns on each poll, without any real network call.
let nextFetchResult: RawFetchResult = { items: [] };
const fakeProvider: MarketplaceProvider = {
  key: "test-fake",
  getProviderStatus: () => ({
    key: "test-fake",
    label: "Test Fake Provider",
    description: "",
    minIntervalSec: 1,
    requiresRealCredentials: false,
  }),
  testConnection: async () => ({ success: true, responseTimeMs: 1, message: "ok" }),
  fetchListings: async () => nextFetchResult,
  normalizeListing: (raw) => {
    const r = raw as Record<string, unknown>;
    return {
      externalId: String(r.id),
      title: String(r.title),
      price: r.price as number | undefined,
      raw: r,
    };
  },
};
providerRegistry["test-fake"] = fakeProvider;

function makeIntegration() {
  const integration = integrationRepo.create({
    provider: "test-fake",
    displayName: `Test Fake ${Math.random()}`,
    enabled: true,
    requestIntervalSec: 60,
    minIntervalSec: 1,
  });
  return integration;
}

test("first sync creates a new listing marked NEW with a FIRST_DETECTED event", async () => {
  const integration = makeIntegration();
  nextFetchResult = { items: [{ id: "ext-1", title: "Toyota Corolla", price: 30000 }] };

  await runSyncForIntegration(integration.id);

  const listing = listingRepo.findBySourceAndExternalId("test-fake", "ext-1");
  assert.ok(listing);
  assert.equal(listing!.status, "NEW");
  const events = listingEventRepo.findByListingId(listing!.id);
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "FIRST_DETECTED");
});

test("re-seeing an unchanged listing does not create a duplicate row", async () => {
  const integration = makeIntegration();
  nextFetchResult = { items: [{ id: "ext-dup", title: "Honda Civic", price: 25000 }] };
  await runSyncForIntegration(integration.id);
  await runSyncForIntegration(integration.id);

  const { rows } = listingRepo.find({ search: "Honda Civic" });
  const matches = rows.filter((r) => r.externalId === "ext-dup");
  assert.equal(matches.length, 1, "should not create a duplicate row for the same source+externalId");
});

test("a changed field on an existing listing produces an UPDATED status and a PRICE_CHANGED event", async () => {
  const integration = makeIntegration();
  nextFetchResult = { items: [{ id: "ext-price", title: "Ford Ranger", price: 45000 }] };
  await runSyncForIntegration(integration.id);

  nextFetchResult = { items: [{ id: "ext-price", title: "Ford Ranger", price: 43500 }] };
  await runSyncForIntegration(integration.id);

  const listing = listingRepo.findBySourceAndExternalId("test-fake", "ext-price");
  assert.ok(listing);
  assert.equal(listing!.price, 43500);
  assert.equal(listing!.status, "UPDATED");

  const events = listingEventRepo.findByListingId(listing!.id);
  const priceEvent = events.find((e) => e.type === "PRICE_CHANGED");
  assert.ok(priceEvent, "expected a PRICE_CHANGED event");
  assert.equal(priceEvent!.fromValue, "45000");
  assert.equal(priceEvent!.toValue, "43500");
});

test("a 429 response marks the integration rate_limited and records the SyncRun without creating listings", async () => {
  const integration = makeIntegration();
  nextFetchResult = { items: [], rateLimited: true, retryAfterSec: 1, httpStatus: 429 };

  await runSyncForIntegration(integration.id);

  const updated = integrationRepo.findById(integration.id);
  assert.equal(updated!.status, "rate_limited");

  const runs = syncRunRepo.recentForIntegration(integration.id, 5);
  assert.equal(runs[0].status, "rate_limited");
});

test("a 429 triggers backoff: an immediate second poll is skipped", async () => {
  const integration = makeIntegration();
  nextFetchResult = { items: [], rateLimited: true, retryAfterSec: 30, httpStatus: 429 };
  await runSyncForIntegration(integration.id);

  const runsAfterFirst = syncRunRepo.recentForIntegration(integration.id, 10).length;

  // Immediately try again — should be skipped due to in-memory backoff, so
  // no new SyncRun row is created.
  nextFetchResult = { items: [{ id: "should-not-appear", title: "x", price: 1 }] };
  await runSyncForIntegration(integration.id);

  const runsAfterSecond = syncRunRepo.recentForIntegration(integration.id, 10).length;
  assert.equal(runsAfterSecond, runsAfterFirst, "backoff should prevent a second run from starting");
  assert.equal(listingRepo.findBySourceAndExternalId("test-fake", "should-not-appear"), undefined);
});

test("credential replacement: rotating a credential updates what resolves, and never exposes the raw value in the masked view", async () => {
  const integration = makeIntegration();
  await saveCredential(integration.id, { apiKey: "first-key-AAAA" });

  let masked = await getMaskedCredential(integration.id);
  assert.equal(masked.apiKeyMasked, "************AAAA");
  assert.equal((await getResolvedCredential(integration.id)).apiKey, "first-key-AAAA");

  // Rotate without redeploying/restarting anything — just call saveCredential again.
  await saveCredential(integration.id, { apiKey: "second-key-BBBB" });

  masked = await getMaskedCredential(integration.id);
  assert.equal(masked.apiKeyMasked, "************BBBB");
  assert.equal((await getResolvedCredential(integration.id)).apiKey, "second-key-BBBB");

  // Masked view must never contain the raw secret.
  assert.ok(!JSON.stringify(masked).includes("first-key-AAAA"));
  assert.ok(!JSON.stringify(masked).includes("second-key-BBBB"));
});

test("polling interval enforcement: effective interval never goes below the provider's safety floor", () => {
  // Admin tries to set 2s, but provider requires a minimum of 30s.
  assert.equal(computeEffectiveIntervalSec(2, 0, 30), 30);
  // Admin's own configured floor is stricter than the provider's.
  assert.equal(computeEffectiveIntervalSec(10, 20, 5), 20);
  // Admin requests something already above both floors — respected as-is.
  assert.equal(computeEffectiveIntervalSec(120, 10, 10), 120);
});
