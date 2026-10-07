import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// -----------------------------------------------------------------------------
// Data layer note
// -----------------------------------------------------------------------------
// `prisma/schema.prisma` is the authoritative, portable schema for this
// project (and is what you'd run `prisma migrate` against in an environment
// with normal internet access). This sandbox cannot reach binaries.prisma.sh
// to download Prisma's query engine, so the *runtime* here talks to SQLite
// directly via Node's built-in `node:sqlite` module (zero native/network
// dependencies). The table shapes below are a 1:1 mirror of schema.prisma.
// Moving to Postgres + real Prisma Client in production means: run
// `prisma generate` / `prisma migrate deploy` against schema.prisma, and
// swap the repository functions in lib/repositories/* to call
// `db.<model>.<method>` instead of raw SQL — the rest of the app (providers,
// sync engine, API routes) is written against those repository functions
// and does not need to change.
// -----------------------------------------------------------------------------

const DB_PATH =
  process.env.DATABASE_URL?.replace(/^file:/, "") ?? path.join(process.cwd(), "dev.db");

const resolvedPath = path.isAbsolute(DB_PATH)
  ? DB_PATH
  : path.join(/* turbopackIgnore: true */ process.cwd(), DB_PATH);

const globalForDb = globalThis as unknown as { __marketDb?: DatabaseSync };

function bootstrap(database: DatabaseSync) {
  database.exec("PRAGMA journal_mode = WAL;");
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      passwordHash TEXT NOT NULL,
      name TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Session (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES User(id) ON DELETE CASCADE,
      expiresAt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session_userId ON Session(userId);

    CREATE TABLE IF NOT EXISTS Integration (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      displayName TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      demo INTEGER NOT NULL DEFAULT 0,
      baseUrl TEXT,
      endpoint TEXT,
      apiVersion TEXT,
      requestIntervalSec INTEGER NOT NULL DEFAULT 60,
      minIntervalSec INTEGER NOT NULL DEFAULT 15,
      httpMethod TEXT NOT NULL DEFAULT 'GET',
      headersJson TEXT,
      queryParamsJson TEXT,
      paginationJson TEXT,
      fieldMappingJson TEXT,
      authMethod TEXT,
      status TEXT NOT NULL DEFAULT 'not_configured',
      lastSuccessAt TEXT,
      lastFailureAt TEXT,
      lastErrorMessage TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(provider, displayName)
    );

    CREATE TABLE IF NOT EXISTS Credential (
      id TEXT PRIMARY KEY,
      integrationId TEXT UNIQUE NOT NULL REFERENCES Integration(id) ON DELETE CASCADE,
      apiKeyEnc TEXT,
      apiKeyLast4 TEXT,
      apiSecretEnc TEXT,
      apiSecretLast4 TEXT,
      accessTokenEnc TEXT,
      accessTokenLast4 TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS Listing (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      externalId TEXT NOT NULL,
      integrationId TEXT REFERENCES Integration(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      price REAL,
      currency TEXT,
      make TEXT,
      model TEXT,
      year INTEGER,
      mileage INTEGER,
      location TEXT,
      sellerName TEXT,
      sellerType TEXT,
      imageUrl TEXT,
      listingUrl TEXT,
      postedAt TEXT,
      firstSeenAt TEXT NOT NULL,
      lastSeenAt TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      rawData TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(source, externalId)
    );
    CREATE INDEX IF NOT EXISTS idx_listing_source ON Listing(source);
    CREATE INDEX IF NOT EXISTS idx_listing_externalId ON Listing(externalId);
    CREATE INDEX IF NOT EXISTS idx_listing_firstSeenAt ON Listing(firstSeenAt);
    CREATE INDEX IF NOT EXISTS idx_listing_lastSeenAt ON Listing(lastSeenAt);
    CREATE INDEX IF NOT EXISTS idx_listing_price ON Listing(price);
    CREATE INDEX IF NOT EXISTS idx_listing_make ON Listing(make);
    CREATE INDEX IF NOT EXISTS idx_listing_model ON Listing(model);
    CREATE INDEX IF NOT EXISTS idx_listing_year ON Listing(year);

    CREATE TABLE IF NOT EXISTS ListingEvent (
      id TEXT PRIMARY KEY,
      listingId TEXT NOT NULL REFERENCES Listing(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      fromValue TEXT,
      toValue TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_listingevent_listingId ON ListingEvent(listingId);
    CREATE INDEX IF NOT EXISTS idx_listingevent_createdAt ON ListingEvent(createdAt);

    CREATE TABLE IF NOT EXISTS SyncRun (
      id TEXT PRIMARY KEY,
      integrationId TEXT NOT NULL REFERENCES Integration(id) ON DELETE CASCADE,
      startedAt TEXT NOT NULL,
      finishedAt TEXT,
      status TEXT NOT NULL DEFAULT 'running',
      itemsFetched INTEGER NOT NULL DEFAULT 0,
      itemsNew INTEGER NOT NULL DEFAULT 0,
      itemsUpdated INTEGER NOT NULL DEFAULT 0,
      errorMessage TEXT,
      durationMs INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_syncrun_integrationId ON SyncRun(integrationId);
    CREATE INDEX IF NOT EXISTS idx_syncrun_startedAt ON SyncRun(startedAt);

    CREATE TABLE IF NOT EXISTS ApiLog (
      id TEXT PRIMARY KEY,
      integrationId TEXT REFERENCES Integration(id) ON DELETE SET NULL,
      level TEXT NOT NULL,
      category TEXT NOT NULL,
      message TEXT NOT NULL,
      httpStatus INTEGER,
      responseTimeMs INTEGER,
      metaJson TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_apilog_integrationId ON ApiLog(integrationId);
    CREATE INDEX IF NOT EXISTS idx_apilog_createdAt ON ApiLog(createdAt);
    CREATE INDEX IF NOT EXISTS idx_apilog_level ON ApiLog(level);
  `);
}

function createConnection(): DatabaseSync {
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  const database = new DatabaseSync(resolvedPath);
  bootstrap(database);
  return database;
}

export const sqlite = globalForDb.__marketDb ?? createConnection();
if (process.env.NODE_ENV !== "production") {
  globalForDb.__marketDb = sqlite;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}
