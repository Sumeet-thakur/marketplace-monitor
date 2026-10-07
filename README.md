# Overwatch — Real-Time Marketplace Monitoring Platform

A working MVP of a real-time marketplace/listing monitoring dashboard. It continuously polls
configured data sources, normalizes listings into a common shape, detects new/changed listings,
and pushes live updates to a dashboard — all without hard-coding any API credentials.

> **Demo credentials:** the seeded admin account is `admin@example.com` / `admin123`. Change this
> after first login — see [Security considerations](#security-considerations).

---

## 1. Project architecture

```
Frontend (Next.js/React)
        │  fetch() / EventSource
        ▼
Backend (Next.js API routes)
        │
        ▼
Credential Service  ──encrypts/decrypts──▶  SQLite (Credential table, AES-256-GCM at rest)
        │  (resolved credential, in-memory only, never returned to the frontend)
        ▼
Provider Adapter (Demo / Generic / Meta / PakWheels — one common interface)
        │
        ▼
External API (or, for Demo, synthetic data — no network call)
```

The frontend **never** sees a raw API key/token/secret. It only ever receives masked values
(`************ABCD`) and status metadata. See `ARCHITECTURE.md` for the full data-flow diagram
and a line-by-line explanation of why this holds.

### A note on the stack

The brief asked for PostgreSQL + Prisma. This build uses **SQLite via Node's built-in
`node:sqlite`** instead, for one reason: the sandbox this was built in only has network access to
`registry.npmjs.org` and GitHub — it cannot reach `binaries.prisma.sh`, which is where Prisma
downloads its query engine binary from. `prisma generate` hard-fails with no internet path around
it.

`prisma/schema.prisma` is kept as the **authoritative, portable schema** — it's exactly what you'd
run `prisma migrate dev` against on Postgres. The actual runtime talks to SQLite through a thin,
typed repository layer (`lib/repositories.ts`) whose function signatures mirror what Prisma Client
calls would look like. Moving to real Prisma + Postgres is described in
[Production deployment notes](#production-deployment-notes).

---

## 2. Installation

Requires **Node.js 22+** (for the built-in `node:sqlite` module) and npm.

```bash
git clone <this-repo>
cd marketplace-monitor
npm install
```

## 3. Database setup

No external database server needed for local dev — SQLite lives at `./dev.db` and is created
automatically on first run. To seed it with an admin user, 3 example integrations, and ~34
synthetic listings:

```bash
npm run seed
```

## 4. Environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Only **infrastructure-level** secrets go in `.env` — never marketplace API credentials:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `file:./dev.db` for local SQLite. A `postgresql://...` string for production Postgres. |
| `SESSION_SECRET` | Used to sign/scope admin session cookies. |
| `ENCRYPTION_KEY` | Used to encrypt marketplace credentials at rest (AES-256-GCM). Any string works — it's hashed to a 32-byte key internally — but use a long random value in production (`openssl rand -base64 32`). |

You will **not** need to edit `.env` again when adding or rotating a marketplace API token — that
happens entirely through the Admin → Integrations UI.

## 5. Running the application

```bash
npm run dev      # development server, http://localhost:3000
# or
npm run build && npm start   # production build
```

The background polling scheduler starts automatically with the server (via
`instrumentation.ts` — see below). There is nothing else to start.

## 6. Running background workers

For this MVP, the scheduler runs **in-process** inside the Next.js server (see
`instrumentation.ts`, which Next.js calls once on server boot). You do not need a separate worker
process for the demo to work.

For a production topology where the poller should run as its own process/container (so it can be
scaled or restarted independently of the web server), there's a standalone entrypoint:

```bash
npm run worker
```

This imports the exact same `runSyncForIntegration` / `startScheduler` code — nothing about the
sync logic changes between the two topologies.

## 7. Demo mode

The **Demo Data Provider** is enabled out of the box (seeded by `npm run seed`) and generates
realistic, clearly-marked synthetic vehicle listings (`[DEMO DATA]` in the description) every 8
seconds. It implements the exact same `MarketplaceProvider` interface as a real adapter — the rest
of the platform cannot tell the difference — so the whole system (dashboard, live updates, health,
logs, sync history) can be demonstrated end-to-end with zero external credentials.

Toggle it off from **Integrations** once you're ready to connect a real source.

## 8. Adding an API integration

1. Go to **Integrations**.
2. Click **+ Add Generic API**, give it a display name, base URL, and endpoint.
3. Expand the card and fill in auth method, API key/secret/access token, headers, interval.
4. Click **Test Connection**. You'll see success/failure, HTTP status, response time, and error
   category.
5. Toggle it **Enabled**. The background scheduler picks it up automatically (within 5s) and starts
   polling at the configured interval — no restart needed.

For **Meta/Facebook** and **PakWheels**, read the comment at the top of
`lib/providers/metaProvider.ts` / `pakwheelsProvider.ts` first: neither company currently publishes
a general-purpose public listings API for third-party apps, so those adapters intentionally stay in
`Not Configured` unless you have credentials for an API you are legitimately authorized to use. No
scraping, undocumented endpoints, or session-cookie access is implemented anywhere in this project.

## 9. Changing API credentials

Open **Integrations**, expand the relevant card, type a new value into API Key / API Secret /
Access Token, and click **Save changes**. Leaving a field blank keeps the existing encrypted value
untouched (so you can rotate just one credential at a time). The very next scheduled poll — or an
immediate **Test Connection** — uses the new value. No code change, no redeploy, no `.env` edit.

## 10. Adding a new provider

1. Create `lib/providers/yourProvider.ts` implementing the `MarketplaceProvider` interface
   (`testConnection`, `fetchListings`, `normalizeListing`, `getProviderStatus`).
2. Register it in `lib/providers/registry.ts`.
3. Create an `Integration` row with `provider: "your-provider-key"` (via the API or a seed script).

The dashboard, sync engine, and scheduler never import a concrete provider — only the
`MarketplaceProvider` interface — so nothing else needs to change.

## 11. Security considerations

- **Credentials are encrypted at rest** with AES-256-GCM (`lib/crypto.ts`) and only ever decrypted
  inside a provider adapter at the moment of an outbound request (`lib/credentialService.ts` is the
  sole choke point — `getResolvedCredential` is never called from an API route or React code).
- **API responses only ever contain masked credentials** (`lib/serializers.ts` is the only function
  allowed to shape an `Integration` for a response, and it calls `getMaskedCredential`, never the
  resolving function).
- **Logs are secret-redacted** (`lib/logger.ts` regex-redacts any key matching
  `api_key|api_secret|access_token|password|authorization|secret` before writing to the `ApiLog`
  table or stdout).
- **Sessions** use httpOnly, `sameSite: lax` cookies and bcrypt-hashed passwords (cost factor 12).
- **First-login bootstrap:** if the `User` table is empty, the first successful `/api/auth/login`
  call creates the admin account with whatever email/password was submitted. **Change this
  immediately in a real deployment** — either delete and recreate the user with a strong password,
  or disable the bootstrap path in `lib/auth.ts` (`createUserIfNoneExist`) once you've created your
  real admin account.
- `429` responses trigger exponential-style backoff honoring `Retry-After` (see
  `lib/sync/syncEngine.ts`); the platform never hammers a rate-limited or failing endpoint.
- Set `ENCRYPTION_KEY` and `SESSION_SECRET` to strong random values before any real deployment —
  the checked-in `.env` values are for local development only.

## 12. Production deployment notes

- **Swap SQLite → Postgres:** in `prisma/schema.prisma`, change `provider = "sqlite"` to
  `"postgresql"`, set `DATABASE_URL` to your Postgres connection string, and run
  `npx prisma migrate dev`. Then update `lib/repositories.ts` to call `db.<model>.<method>` (a real
  `@prisma/client` singleton) instead of the current raw-SQL implementations — the function
  *signatures* in that file are already shaped like the Prisma Client calls they'd become, so
  nothing above that layer changes.
- **Separate the worker from the web server:** run `npm run worker` as its own process/container
  instead of relying on `instrumentation.ts`, and disable the in-process scheduler boot on the web
  tier. For multiple worker instances, replace the in-memory interval scheduler
  (`lib/sync/scheduler.ts`) with a durable queue (BullMQ/Redis, SQS, etc.) so instances don't
  double-poll the same integration — `runSyncForIntegration` itself is already side-effect-safe per
  call and wouldn't need to change.
- **Multi-instance live updates:** the SSE event bus (`lib/eventBus.ts`) is a single-process
  `EventEmitter`. Behind a load balancer with multiple web instances, back it with Redis pub/sub (or
  similar) instead.
- Put `ENCRYPTION_KEY` and `SESSION_SECRET` in a real secret manager, not a checked-in `.env`.

---

## Testing

```bash
npm test
```

Covers: credential encryption/decryption (round-trip, tamper-detection, masking), provider
normalization (Demo + Generic field-mapping), new-listing detection, duplicate prevention,
field-change detection with event logging, 429 rate-limit handling + backoff enforcement,
credential rotation, and polling-interval floor enforcement. All 16 tests pass against a disposable
temp SQLite database — nothing touches `dev.db`.

## Demo flow (matches the required acceptance criteria)

1. `npm run seed && npm run dev`, open `http://localhost:3000`, log in.
2. Dashboard shows listings; the **LIVE** badge in the header is green; new/updated listings from
   the Demo Provider stream in every ~8s with a toast notification — no page refresh.
3. Go to **Integrations**, disable **Demo Data Provider**.
4. Configure a real (or test) API integration: base URL, endpoint, credentials.
5. Click **Test Connection** — see success/failure, HTTP status, latency, timestamp.
6. Enable it. The scheduler picks it up within 5 seconds and starts polling at the configured
   interval.
7. New data appears on the dashboard automatically.
8. Rotate the API token from the same card, no restart — the next poll uses it immediately.
9. Open your browser's Network tab at any point: no request or response body ever contains a raw
   credential — only `************ABCD`.

See `ARCHITECTURE.md` for the full data-flow diagram.
