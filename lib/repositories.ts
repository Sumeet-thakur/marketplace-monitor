import { sqlite, newId, nowIso } from "./db";

// -----------------------------------------------------------------------------
// Thin, typed repository functions. Every other module (credentialService,
// logger, syncEngine, scheduler, auth, API routes) calls these — nothing
// else in the app writes raw SQL. This keeps the "swap SQLite for real
// Prisma/Postgres" boundary to this one file.
// -----------------------------------------------------------------------------

export interface UserRow {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRow {
  id: string;
  userId: string;
  expiresAt: string;
  createdAt: string;
}

export interface IntegrationRow {
  id: string;
  provider: string;
  displayName: string;
  enabled: number;
  demo: number;
  baseUrl: string | null;
  endpoint: string | null;
  apiVersion: string | null;
  requestIntervalSec: number;
  minIntervalSec: number;
  httpMethod: string;
  headersJson: string | null;
  queryParamsJson: string | null;
  paginationJson: string | null;
  fieldMappingJson: string | null;
  authMethod: string | null;
  status: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CredentialRow {
  id: string;
  integrationId: string;
  apiKeyEnc: string | null;
  apiKeyLast4: string | null;
  apiSecretEnc: string | null;
  apiSecretLast4: string | null;
  accessTokenEnc: string | null;
  accessTokenLast4: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingRow {
  id: string;
  source: string;
  externalId: string;
  integrationId: string | null;
  title: string;
  description: string | null;
  price: number | null;
  currency: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  location: string | null;
  sellerName: string | null;
  sellerType: string | null;
  imageUrl: string | null;
  listingUrl: string | null;
  postedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  status: string;
  rawData: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListingEventRow {
  id: string;
  listingId: string;
  type: string;
  message: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

export interface SyncRunRow {
  id: string;
  integrationId: string;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  itemsFetched: number;
  itemsNew: number;
  itemsUpdated: number;
  errorMessage: string | null;
  durationMs: number | null;
}

export interface ApiLogRow {
  id: string;
  integrationId: string | null;
  level: string;
  category: string;
  message: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  metaJson: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------
export const userRepo = {
  create(input: { email: string; passwordHash: string; name?: string }): UserRow {
    const id = newId();
    const ts = nowIso();
    sqlite
      .prepare(
        `INSERT INTO User (id, email, passwordHash, name, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.email, input.passwordHash, input.name ?? null, ts, ts);
    return { id, email: input.email, passwordHash: input.passwordHash, name: input.name ?? null, createdAt: ts, updatedAt: ts };
  },
  findByEmail(email: string): UserRow | undefined {
    return sqlite.prepare(`SELECT * FROM User WHERE email = ?`).get(email) as UserRow | undefined;
  },
  count(): number {
    const row = sqlite.prepare(`SELECT COUNT(*) as c FROM User`).get() as { c: number };
    return row.c;
  },
};

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
export const sessionRepo = {
  create(userId: string, expiresAt: Date): SessionRow {
    const id = newId();
    const ts = nowIso();
    sqlite
      .prepare(`INSERT INTO Session (id, userId, expiresAt, createdAt) VALUES (?, ?, ?, ?)`)
      .run(id, userId, expiresAt.toISOString(), ts);
    return { id, userId, expiresAt: expiresAt.toISOString(), createdAt: ts };
  },
  findWithUser(id: string): (SessionRow & { user: UserRow }) | undefined {
    const session = sqlite.prepare(`SELECT * FROM Session WHERE id = ?`).get(id) as SessionRow | undefined;
    if (!session) return undefined;
    const user = sqlite.prepare(`SELECT * FROM User WHERE id = ?`).get(session.userId) as UserRow | undefined;
    if (!user) return undefined;
    return { ...session, user };
  },
  delete(id: string) {
    sqlite.prepare(`DELETE FROM Session WHERE id = ?`).run(id);
  },
};

// ---------------------------------------------------------------------------
// Integration
// ---------------------------------------------------------------------------
export interface IntegrationCreateInput {
  provider: string;
  displayName: string;
  enabled?: boolean;
  demo?: boolean;
  baseUrl?: string | null;
  endpoint?: string | null;
  apiVersion?: string | null;
  requestIntervalSec?: number;
  minIntervalSec?: number;
  httpMethod?: string;
  headersJson?: string | null;
  queryParamsJson?: string | null;
  paginationJson?: string | null;
  fieldMappingJson?: string | null;
  authMethod?: string | null;
}

export type IntegrationUpdateInput = Partial<IntegrationCreateInput> & {
  status?: string;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
  lastErrorMessage?: string | null;
};

const INTEGRATION_COLUMNS = [
  "provider",
  "displayName",
  "enabled",
  "demo",
  "baseUrl",
  "endpoint",
  "apiVersion",
  "requestIntervalSec",
  "minIntervalSec",
  "httpMethod",
  "headersJson",
  "queryParamsJson",
  "paginationJson",
  "fieldMappingJson",
  "authMethod",
  "status",
  "lastSuccessAt",
  "lastFailureAt",
  "lastErrorMessage",
] as const;

function toSqlValue(key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? 1 : 0;
  return value ?? null;
}

export const integrationRepo = {
  create(input: IntegrationCreateInput): IntegrationRow {
    const id = newId();
    const ts = nowIso();
    sqlite
      .prepare(
        `INSERT INTO Integration (id, provider, displayName, enabled, demo, baseUrl, endpoint, apiVersion, requestIntervalSec, minIntervalSec, httpMethod, headersJson, queryParamsJson, paginationJson, fieldMappingJson, authMethod, status, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        id,
        input.provider,
        input.displayName,
        input.enabled ? 1 : 0,
        input.demo ? 1 : 0,
        input.baseUrl ?? null,
        input.endpoint ?? null,
        input.apiVersion ?? null,
        input.requestIntervalSec ?? 60,
        input.minIntervalSec ?? 15,
        input.httpMethod ?? "GET",
        input.headersJson ?? null,
        input.queryParamsJson ?? null,
        input.paginationJson ?? null,
        input.fieldMappingJson ?? null,
        input.authMethod ?? null,
        "not_configured",
        ts,
        ts
      );
    return this.findById(id)!;
  },
  findById(id: string): IntegrationRow | undefined {
    return sqlite.prepare(`SELECT * FROM Integration WHERE id = ?`).get(id) as IntegrationRow | undefined;
  },
  findAll(): IntegrationRow[] {
    return sqlite.prepare(`SELECT * FROM Integration ORDER BY createdAt ASC`).all() as unknown as IntegrationRow[];
  },
  update(id: string, input: IntegrationUpdateInput): IntegrationRow {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of Object.keys(input) as (keyof IntegrationUpdateInput)[]) {
      if (!(INTEGRATION_COLUMNS as readonly string[]).includes(key)) continue;
      if (input[key] === undefined) continue; // undefined = "not provided", not "clear this field"
      sets.push(`${key} = ?`);
      values.push(toSqlValue(key, input[key]));
    }
    if (sets.length === 0) return this.findById(id)!;
    sets.push(`updatedAt = ?`);
    values.push(nowIso());
    values.push(id);
    sqlite.prepare(`UPDATE Integration SET ${sets.join(", ")} WHERE id = ?`).run(...(values as never[]));
    return this.findById(id)!;
  },
  delete(id: string) {
    sqlite.prepare(`DELETE FROM Integration WHERE id = ?`).run(id);
  },
};

// ---------------------------------------------------------------------------
// Credential
// ---------------------------------------------------------------------------
export const credentialRepo = {
  findByIntegrationId(integrationId: string): CredentialRow | undefined {
    return sqlite.prepare(`SELECT * FROM Credential WHERE integrationId = ?`).get(integrationId) as
      | CredentialRow
      | undefined;
  },
  upsert(integrationId: string, data: Partial<CredentialRow>) {
    const existing = this.findByIntegrationId(integrationId);
    const ts = nowIso();
    if (!existing) {
      sqlite
        .prepare(
          `INSERT INTO Credential (id, integrationId, apiKeyEnc, apiKeyLast4, apiSecretEnc, apiSecretLast4, accessTokenEnc, accessTokenLast4, createdAt, updatedAt)
           VALUES (?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          newId(),
          integrationId,
          data.apiKeyEnc ?? null,
          data.apiKeyLast4 ?? null,
          data.apiSecretEnc ?? null,
          data.apiSecretLast4 ?? null,
          data.accessTokenEnc ?? null,
          data.accessTokenLast4 ?? null,
          ts,
          ts
        );
      return;
    }
    const merged = { ...existing, ...data };
    sqlite
      .prepare(
        `UPDATE Credential SET apiKeyEnc=?, apiKeyLast4=?, apiSecretEnc=?, apiSecretLast4=?, accessTokenEnc=?, accessTokenLast4=?, updatedAt=? WHERE integrationId=?`
      )
      .run(
        merged.apiKeyEnc ?? null,
        merged.apiKeyLast4 ?? null,
        merged.apiSecretEnc ?? null,
        merged.apiSecretLast4 ?? null,
        merged.accessTokenEnc ?? null,
        merged.accessTokenLast4 ?? null,
        ts,
        integrationId
      );
  },
  deleteByIntegrationId(integrationId: string) {
    sqlite.prepare(`DELETE FROM Credential WHERE integrationId = ?`).run(integrationId);
  },
};

// ---------------------------------------------------------------------------
// Listing
// ---------------------------------------------------------------------------
export interface ListingUpsertData {
  title: string;
  description?: string | null;
  price?: number | null;
  currency?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  mileage?: number | null;
  location?: string | null;
  sellerName?: string | null;
  sellerType?: string | null;
  imageUrl?: string | null;
  listingUrl?: string | null;
  postedAt?: Date | null;
  rawData?: string | null;
}

export interface ListingFilters {
  search?: string;
  source?: string;
  minPrice?: number;
  maxPrice?: number;
  minYear?: number;
  maxYear?: number;
  location?: string;
  newOnly?: boolean;
  sort?: "newest" | "price_asc" | "price_desc" | "first_seen";
  limit?: number;
  offset?: number;
}

export const listingRepo = {
  findBySourceAndExternalId(source: string, externalId: string): ListingRow | undefined {
    return sqlite
      .prepare(`SELECT * FROM Listing WHERE source = ? AND externalId = ?`)
      .get(source, externalId) as ListingRow | undefined;
  },
  findById(id: string): ListingRow | undefined {
    return sqlite.prepare(`SELECT * FROM Listing WHERE id = ?`).get(id) as ListingRow | undefined;
  },
  create(source: string, externalId: string, integrationId: string, status: string, data: ListingUpsertData): ListingRow {
    const id = newId();
    const ts = nowIso();
    sqlite
      .prepare(
        `INSERT INTO Listing (id, source, externalId, integrationId, title, description, price, currency, make, model, year, mileage, location, sellerName, sellerType, imageUrl, listingUrl, postedAt, firstSeenAt, lastSeenAt, status, rawData, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        id,
        source,
        externalId,
        integrationId,
        data.title,
        data.description ?? null,
        data.price ?? null,
        data.currency ?? null,
        data.make ?? null,
        data.model ?? null,
        data.year ?? null,
        data.mileage ?? null,
        data.location ?? null,
        data.sellerName ?? null,
        data.sellerType ?? null,
        data.imageUrl ?? null,
        data.listingUrl ?? null,
        data.postedAt ? data.postedAt.toISOString() : null,
        ts,
        ts,
        status,
        data.rawData ?? null,
        ts,
        ts
      );
    return this.findById(id)!;
  },
  update(id: string, status: string, data: ListingUpsertData): ListingRow {
    const ts = nowIso();
    sqlite
      .prepare(
        `UPDATE Listing SET title=?, description=?, price=?, currency=?, make=?, model=?, year=?, mileage=?, location=?, sellerName=?, sellerType=?, imageUrl=?, listingUrl=?, postedAt=?, lastSeenAt=?, status=?, rawData=?, updatedAt=? WHERE id=?`
      )
      .run(
        data.title,
        data.description ?? null,
        data.price ?? null,
        data.currency ?? null,
        data.make ?? null,
        data.model ?? null,
        data.year ?? null,
        data.mileage ?? null,
        data.location ?? null,
        data.sellerName ?? null,
        data.sellerType ?? null,
        data.imageUrl ?? null,
        data.listingUrl ?? null,
        data.postedAt ? data.postedAt.toISOString() : null,
        ts,
        status,
        data.rawData ?? null,
        ts,
        id
      );
    return this.findById(id)!;
  },
  find(filters: ListingFilters): { rows: ListingRow[]; total: number } {
    const clauses: string[] = [];
    const values: unknown[] = [];

    if (filters.search) {
      clauses.push(`(title LIKE ? OR make LIKE ? OR model LIKE ? OR location LIKE ?)`);
      const like = `%${filters.search}%`;
      values.push(like, like, like, like);
    }
    if (filters.source) {
      clauses.push(`source = ?`);
      values.push(filters.source);
    }
    if (filters.minPrice !== undefined) {
      clauses.push(`price >= ?`);
      values.push(filters.minPrice);
    }
    if (filters.maxPrice !== undefined) {
      clauses.push(`price <= ?`);
      values.push(filters.maxPrice);
    }
    if (filters.minYear !== undefined) {
      clauses.push(`year >= ?`);
      values.push(filters.minYear);
    }
    if (filters.maxYear !== undefined) {
      clauses.push(`year <= ?`);
      values.push(filters.maxYear);
    }
    if (filters.location) {
      clauses.push(`location LIKE ?`);
      values.push(`%${filters.location}%`);
    }
    if (filters.newOnly) {
      clauses.push(`status = 'NEW'`);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    let orderBy = "firstSeenAt DESC";
    if (filters.sort === "price_asc") orderBy = "price ASC";
    else if (filters.sort === "price_desc") orderBy = "price DESC";
    else if (filters.sort === "first_seen") orderBy = "firstSeenAt DESC";
    else if (filters.sort === "newest") orderBy = "lastSeenAt DESC";

    const total = (
      sqlite.prepare(`SELECT COUNT(*) as c FROM Listing ${where}`).get(...(values as never[])) as { c: number }
    ).c;

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const rows = sqlite
      .prepare(`SELECT * FROM Listing ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`)
      .all(...(values as never[]), limit, offset) as unknown as ListingRow[];

    return { rows, total };
  },
  stats() {
    const total = (sqlite.prepare(`SELECT COUNT(*) as c FROM Listing`).get() as { c: number }).c;
    const newCount = (sqlite.prepare(`SELECT COUNT(*) as c FROM Listing WHERE status = 'NEW'`).get() as { c: number }).c;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const today = (
      sqlite.prepare(`SELECT COUNT(*) as c FROM Listing WHERE firstSeenAt >= ?`).get(todayStart.toISOString()) as {
        c: number;
      }
    ).c;
    return { total, newCount, today };
  },
  distinctSources(): string[] {
    const rows = sqlite.prepare(`SELECT DISTINCT source FROM Listing`).all() as { source: string }[];
    return rows.map((r) => r.source);
  },
};

// ---------------------------------------------------------------------------
// ListingEvent
// ---------------------------------------------------------------------------
export const listingEventRepo = {
  create(listingId: string, type: string, message: string, fromValue?: string, toValue?: string): ListingEventRow {
    const id = newId();
    const ts = nowIso();
    sqlite
      .prepare(
        `INSERT INTO ListingEvent (id, listingId, type, message, fromValue, toValue, createdAt) VALUES (?,?,?,?,?,?,?)`
      )
      .run(id, listingId, type, message, fromValue ?? null, toValue ?? null, ts);
    return { id, listingId, type, message, fromValue: fromValue ?? null, toValue: toValue ?? null, createdAt: ts };
  },
  findByListingId(listingId: string): ListingEventRow[] {
    return sqlite
      .prepare(`SELECT * FROM ListingEvent WHERE listingId = ? ORDER BY createdAt ASC`)
      .all(listingId) as unknown as ListingEventRow[];
  },
};

// ---------------------------------------------------------------------------
// SyncRun
// ---------------------------------------------------------------------------
export const syncRunRepo = {
  create(integrationId: string): SyncRunRow {
    const id = newId();
    const ts = nowIso();
    sqlite
      .prepare(`INSERT INTO SyncRun (id, integrationId, startedAt, status) VALUES (?,?,?,?)`)
      .run(id, integrationId, ts, "running");
    return { id, integrationId, startedAt: ts, finishedAt: null, status: "running", itemsFetched: 0, itemsNew: 0, itemsUpdated: 0, errorMessage: null, durationMs: null };
  },
  update(id: string, data: Partial<SyncRunRow>) {
    const merged = { ...data };
    sqlite
      .prepare(
        `UPDATE SyncRun SET status=COALESCE(?, status), finishedAt=COALESCE(?, finishedAt), itemsFetched=COALESCE(?, itemsFetched), itemsNew=COALESCE(?, itemsNew), itemsUpdated=COALESCE(?, itemsUpdated), errorMessage=?, durationMs=COALESCE(?, durationMs) WHERE id=?`
      )
      .run(
        merged.status ?? null,
        merged.finishedAt ?? null,
        merged.itemsFetched ?? null,
        merged.itemsNew ?? null,
        merged.itemsUpdated ?? null,
        merged.errorMessage ?? null,
        merged.durationMs ?? null,
        id
      );
  },
  recentForIntegration(integrationId: string, limit = 20): SyncRunRow[] {
    return sqlite
      .prepare(`SELECT * FROM SyncRun WHERE integrationId = ? ORDER BY startedAt DESC LIMIT ?`)
      .all(integrationId, limit) as unknown as SyncRunRow[];
  },
  recentAll(limit = 50): (SyncRunRow & { provider: string; displayName: string })[] {
    return sqlite
      .prepare(
        `SELECT SyncRun.*, Integration.provider as provider, Integration.displayName as displayName
         FROM SyncRun JOIN Integration ON Integration.id = SyncRun.integrationId
         ORDER BY startedAt DESC LIMIT ?`
      )
      .all(limit) as unknown as (SyncRunRow & { provider: string; displayName: string })[];
  },
};

// ---------------------------------------------------------------------------
// ApiLog
// ---------------------------------------------------------------------------
export const apiLogRepo = {
  create(data: Omit<ApiLogRow, "id" | "createdAt">): ApiLogRow {
    const id = newId();
    const ts = nowIso();
    sqlite
      .prepare(
        `INSERT INTO ApiLog (id, integrationId, level, category, message, httpStatus, responseTimeMs, metaJson, createdAt)
         VALUES (?,?,?,?,?,?,?,?,?)`
      )
      .run(id, data.integrationId ?? null, data.level, data.category, data.message, data.httpStatus ?? null, data.responseTimeMs ?? null, data.metaJson ?? null, ts);
    return { id, createdAt: ts, ...data };
  },
  recent(limit = 200, level?: string, category?: string): (ApiLogRow & { provider?: string })[] {
    const clauses: string[] = [];
    const values: unknown[] = [];
    if (level) {
      clauses.push("ApiLog.level = ?");
      values.push(level);
    }
    if (category) {
      clauses.push("ApiLog.category = ?");
      values.push(category);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    return sqlite
      .prepare(
        `SELECT ApiLog.*, Integration.provider as provider FROM ApiLog LEFT JOIN Integration ON Integration.id = ApiLog.integrationId ${where} ORDER BY ApiLog.createdAt DESC LIMIT ?`
      )
      .all(...(values as never[]), limit) as unknown as (ApiLogRow & { provider?: string })[];
  },
};
