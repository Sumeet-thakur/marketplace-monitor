import { test } from "node:test";
import assert from "node:assert/strict";
import { demoProvider } from "../lib/providers/demoProvider";
import { genericProvider } from "../lib/providers/genericProvider";
import type { ProviderConfig } from "../lib/providers/types";

test("demoProvider.normalizeListing maps raw synthetic data to normalized shape", () => {
  const raw = {
    id: "demo-1",
    title: "2022 Toyota Corolla",
    price: 32000,
    currency: "AUD",
    make: "Toyota",
    model: "Corolla",
    year: 2022,
    mileage: 12000,
    location: "Sydney",
  };
  const normalized = demoProvider.normalizeListing(raw, {} as ProviderConfig);
  assert.equal(normalized.externalId, "demo-1");
  assert.equal(normalized.title, "2022 Toyota Corolla");
  assert.equal(normalized.price, 32000);
  assert.equal(normalized.make, "Toyota");
});

test("demoProvider.fetchListings returns items shaped for normalization", async () => {
  const result = await demoProvider.fetchListings({} as ProviderConfig);
  assert.ok(result.items.length > 0);
  const normalized = demoProvider.normalizeListing(result.items[0], {} as ProviderConfig);
  assert.ok(normalized.externalId.startsWith("demo-"));
  assert.ok(normalized.title.length > 0);
});

test("genericProvider.normalizeListing applies a configured field mapping", () => {
  const config: ProviderConfig = {
    integrationId: "test",
    credential: {},
    fieldMapping: {
      "results[].id": "externalId",
      "results[].title": "title",
      "results[].price": "price",
    },
  };
  const rawItem = { id: "123", title: "Toyota Corolla", price: 32000 };
  const normalized = genericProvider.normalizeListing(rawItem, config);
  assert.equal(normalized.externalId, "123");
  assert.equal(normalized.title, "Toyota Corolla");
  assert.equal(normalized.price, 32000);
});

test("genericProvider.testConnection reports not_configured when baseUrl/endpoint are missing", async () => {
  const config: ProviderConfig = { integrationId: "test", credential: {} };
  const result = await genericProvider.testConnection(config);
  assert.equal(result.success, false);
  assert.equal(result.errorCategory, "not_configured");
});
