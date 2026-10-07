import { EventEmitter } from "events";

// Simple in-memory pub/sub used to push live updates to connected dashboard
// clients over Server-Sent Events. In a multi-instance production deployment
// this would be backed by Redis pub/sub or similar; for the MVP a single
// Node process is sufficient and keeps the demo dependency-free.

export type DashboardEvent =
  | { type: "listing.new"; listing: Record<string, unknown> }
  | { type: "listing.updated"; listing: Record<string, unknown>; changes: string[] }
  | { type: "sync.started"; integrationId: string; provider: string }
  | { type: "sync.finished"; integrationId: string; provider: string; itemsNew: number; itemsUpdated: number }
  | { type: "integration.status"; integrationId: string; status: string };

class Bus extends EventEmitter {}

const globalForBus = globalThis as unknown as { __marketBus?: Bus };

export const eventBus = globalForBus.__marketBus ?? new Bus();
globalForBus.__marketBus = eventBus;
eventBus.setMaxListeners(100);

export function publish(event: DashboardEvent) {
  eventBus.emit("event", event);
}

export function subscribe(handler: (event: DashboardEvent) => void) {
  eventBus.on("event", handler);
  return () => eventBus.off("event", handler);
}
