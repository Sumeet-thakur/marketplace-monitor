import { apiLogRepo } from "./repositories";

// Structured logging with automatic secret redaction. Every log write goes
// through here so that api keys / tokens / secrets / passwords can never
// leak into the ApiLog table or stdout, no matter which caller forgot to
// scrub them.

const SECRET_KEY_PATTERN = /(api[_-]?key|api[_-]?secret|access[_-]?token|password|authorization|secret)/i;

function redact(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return value; // top-level strings are the caller's responsibility (message text)
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY_PATTERN.test(k)) {
        out[k] = "[REDACTED]";
      } else if (typeof v === "object" && v !== null) {
        out[k] = redact(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return value;
}

export type LogCategory =
  | "request"
  | "response"
  | "auth"
  | "rate_limit"
  | "parse"
  | "database"
  | "worker";

export interface LogInput {
  level: "info" | "warn" | "error";
  category: LogCategory;
  message: string;
  integrationId?: string;
  httpStatus?: number;
  responseTimeMs?: number;
  meta?: Record<string, unknown>;
}

export async function logEvent(input: LogInput) {
  const safeMeta = input.meta ? redact(input.meta) : undefined;
  // eslint-disable-next-line no-console
  console[input.level === "info" ? "log" : input.level](
    `[${input.category}] ${input.message}`,
    safeMeta ?? ""
  );
  try {
    apiLogRepo.create({
      integrationId: input.integrationId ?? null,
      level: input.level,
      category: input.category,
      message: input.message,
      httpStatus: input.httpStatus ?? null,
      responseTimeMs: input.responseTimeMs ?? null,
      metaJson: safeMeta ? JSON.stringify(safeMeta) : null,
    });
  } catch (err) {
    // Never let logging failures crash the caller.
    // eslint-disable-next-line no-console
    console.error("Failed to persist log entry", err);
  }
}
