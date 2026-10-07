"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type DashboardEvent =
  | { type: "listing.new"; listing: Record<string, unknown> }
  | { type: "listing.updated"; listing: Record<string, unknown>; changes: string[] }
  | { type: "sync.started"; integrationId: string; provider: string }
  | { type: "sync.finished"; integrationId: string; provider: string; itemsNew: number; itemsUpdated: number }
  | { type: "integration.status"; integrationId: string; status: string };

export const OVERWATCH_EVENT = "overwatch:event";

/**
 * Opens a single Server-Sent Events connection for the whole authenticated
 * shell, renders the LIVE status indicator, and rebroadcasts every event as
 * a window CustomEvent so any component (toast list, listings table,
 * integration cards) can react without each owning its own connection.
 */
export default function LiveStatus() {
  const [state, setState] = useState<"connecting" | "live" | "error">("connecting");
  const router = useRouter();
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.onopen = () => setState("live");
    source.onerror = () => setState("error");

    source.onmessage = (msg) => {
      setState("live");
      let event: DashboardEvent;
      try {
        event = JSON.parse(msg.data);
      } catch {
        return;
      }
      window.dispatchEvent(new CustomEvent(OVERWATCH_EVENT, { detail: event }));

      // Debounced soft-refresh of server-rendered data (stats, tables) so
      // the dashboard updates without a full page reload.
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 400);
    };

    return () => {
      source.close();
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const label = state === "live" ? "LIVE" : state === "connecting" ? "CONNECTING" : "OFFLINE";
  const color =
    state === "live" ? "var(--signal-live)" : state === "connecting" ? "var(--signal-warn)" : "var(--signal-error)";

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-mono font-medium tracking-wider"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 35%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
      title="Live updates via Server-Sent Events"
    >
      <span className={`h-1.5 w-1.5 rounded-full ${state === "live" ? "pulse-dot" : ""}`} style={{ background: color }} />
      {label}
    </span>
  );
}
