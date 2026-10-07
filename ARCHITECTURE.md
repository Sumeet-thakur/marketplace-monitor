# Architecture

## Data flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BROWSER                                                                  │
│  Dashboard / Listings / Integrations / Health / Logs / Sync Activity      │
│  - fetch() for CRUD                                                       │
│  - EventSource("/api/events") for live push updates                       │
│  - Only ever receives masked credentials: "************ABCD"             │
└───────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTPS (same-origin)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  NEXT.JS API ROUTES (app/api/**)                                          │
│  - requireUser() session check on every route                             │
│  - serializeIntegration() is the ONLY function allowed to shape an        │
│    Integration for a response — calls getMaskedCredential, never the      │
│    decrypting function                                                    │
└───────────────────────────────┬─────────────────────────────────────────┘
                                 │
                 ┌───────────────┴────────────────┐
                 ▼                                 ▼
┌───────────────────────────┐      ┌──────────────────────────────────────┐
│  CREDENTIAL SERVICE         │      │  SCHEDULER (lib/sync/scheduler.ts)   │
│  (lib/credentialService.ts) │      │  - one setInterval per enabled       │
│  - saveCredential()         │      │    integration                       │
│  - getMaskedCredential()    │◀─────┤  - reconciles every 5s against the   │
│    → API responses          │      │    Integration table (so enabling/  │
│  - getResolvedCredential()  │      │    editing in the UI takes effect    │
│    → provider adapters ONLY │      │    without a restart)                │
└──────────────┬──────────────┘      │  - enforces max(admin floor,        │
               │ encrypt/decrypt      │    provider floor) on every         │
               ▼                      │    interval                         │
┌───────────────────────────┐        └──────────────┬───────────────────────┘
│  lib/crypto.ts              │                       │ calls
│  AES-256-GCM                │                       ▼
│  (ENCRYPTION_KEY env var)   │        ┌──────────────────────────────────────┐
└──────────────┬──────────────┘        │  SYNC ENGINE (lib/sync/syncEngine.ts) │
               │ stores/reads           │  fetch → normalize → diff → persist   │
               ▼                        │  → log → publish(SSE event)           │
┌───────────────────────────┐          └──────────────┬───────────────────────┘
│  SQLite (dev.db)            │                          │ resolves credential,
│  Credential table:           │                          │ builds ProviderConfig
│  apiKeyEnc / apiSecretEnc /  │                          ▼
│  accessTokenEnc (encrypted)  │        ┌──────────────────────────────────────┐
│  + Integration, Listing,     │◀───────┤  PROVIDER ADAPTER                     │
│    ListingEvent, SyncRun,    │        │  (implements MarketplaceProvider)     │
│    ApiLog, User, Session     │        │  Demo | Generic | Meta | PakWheels    │
└───────────────────────────┘        └──────────────┬───────────────────────┘
                                                        │ HTTPS (real providers only)
                                                        ▼
                                       ┌──────────────────────────────────────┐
                                       │  EXTERNAL MARKETPLACE API             │
                                       │  (or: nothing, for the Demo provider) │
                                       └──────────────────────────────────────┘
```

## Why the frontend never sees a real credential

Three independent things all have to be true at once for a raw secret to reach the browser, and
none of them are:

1. `lib/credentialService.ts` has two read functions: `getMaskedCredential` (returns
   `{ apiKeyMasked: "************ABCD", configured: true }`) and `getResolvedCredential` (returns
   the real, decrypted value).
2. Every API route that returns an `Integration` goes through `lib/serializers.ts:serializeIntegration`,
   which only ever calls the masked function.
3. `getResolvedCredential` is called from exactly two places in the entire codebase: the sync
   engine (`lib/sync/syncEngine.ts`) and the test-connection route
   (`app/api/integrations/[id]/test/route.ts`) — both server-only, both discarding the resolved
   value immediately after using it to build a single outbound `fetch()` call. It is never passed
   into a `NextResponse.json(...)` call anywhere.

This was verified in practice during the build: after rotating a credential through the API, the
raw value was grepped for across every subsequent API response body and found nowhere.

## Provider architecture

```
MarketplaceProvider (interface, lib/providers/types.ts)
    ├── testConnection(config) → { success, httpStatus, responseTimeMs, errorCategory, message }
    ├── fetchListings(config, cursor?) → { items, nextCursor?, rateLimited?, retryAfterSec? }
    ├── normalizeListing(raw, config) → NormalizedListing (common shape)
    └── getProviderStatus() → { label, description, minIntervalSec, requiresRealCredentials }

Implementations (lib/providers/*.ts):
    ├── demoProvider     — synthetic data, no network call, behaves identically to a real adapter
    ├── genericProvider  — configurable REST client: URL/method/auth/headers/query/pagination/
    │                      field-mapping, all admin-configured, no hard-coded endpoints
    ├── metaProvider     — pluggable Graph API adapter; "Not Configured" until a legitimate,
    │                      authorized access token is supplied — no undocumented endpoints
    └── pakwheelsProvider — pluggable adapter for an authorized data-partnership API; same rule
```

The dashboard, sync engine, and scheduler depend only on the `MarketplaceProvider` interface via
`lib/providers/registry.ts`. Adding a new marketplace is one new file + one registry line; nothing
above that layer needs to change.

## Sync loop, per integration, per interval tick

1. Scheduler fires → `runSyncForIntegration(id)`.
2. Skip if still inside an in-memory backoff window from a previous 429/failure.
3. Resolve credential, build `ProviderConfig`, call `provider.fetchListings()`.
4. On `429`: record `SyncRun.status = "rate_limited"`, set integration status, set an in-memory
   backoff until `now + retryAfterSec` (or a default), return — no retry loop.
5. On success, for each raw item:
   - `provider.normalizeListing()` → common shape.
   - Look up existing `Listing` by `(source, externalId)` (unique constraint).
   - **Not found** → create with `status = "NEW"`, write a `FIRST_DETECTED` `ListingEvent`, publish
     `listing.new` over SSE.
   - **Found** → diff watched fields (price, title, description, mileage, location). If any
     changed: update the row, set `status = "UPDATED"`, write one `ListingEvent` per changed field
     (e.g. `PRICE_CHANGED`, "changed from $45,000 to $43,500"), publish `listing.updated`. If
     nothing changed: just bump `lastSeenAt` and log a quiet re-seen event.
6. Record the `SyncRun` outcome (counts, duration, status), update `Integration.status` /
   `lastSuccessAt` / `lastErrorMessage`, write a structured `ApiLog` entry, publish
   `sync.finished` / `integration.status` over SSE.

## Live updates

`lib/eventBus.ts` is an in-memory `EventEmitter`. `/api/events` (`app/api/events/route.ts`) is a
Server-Sent Events endpoint: on connect it subscribes to the bus and streams every event as
`data: {...}\n\n`, plus a heartbeat comment every 15s so idle connections survive proxies. The
browser holds a single `EventSource` (`components/LiveStatus.tsx`) for the whole authenticated
shell, rebroadcasts each event as a `window` `CustomEvent` so any component can react (toast list,
listing tables), and debounces a `router.refresh()` so server-rendered data (dashboard stats,
tables) updates without a full page reload.

## Known limitations of this MVP (see README § Production deployment notes)

- Single-process scheduler and event bus — fine for one instance, needs a queue/pub-sub for
  horizontal scaling.
- SQLite instead of Postgres, purely a sandbox network constraint — `schema.prisma` is the portable
  target schema, and the repository layer's function shapes already mirror what Prisma Client calls
  would look like.
