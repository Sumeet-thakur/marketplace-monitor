"use client";

import { useCallback, useEffect, useState } from "react";
import { formatDateTime } from "@/lib/format";

interface LogEntry {
  id: string;
  level: string;
  category: string;
  message: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  provider?: string;
  createdAt: string;
}

const LEVEL_COLOR: Record<string, string> = {
  info: "var(--signal-info)",
  warn: "var(--signal-warn)",
  error: "var(--signal-error)",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [level, setLevel] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (level) params.set("level", level);
    if (category) params.set("category", category);
    const res = await fetch(`/api/logs?${params.toString()}`);
    if (res.ok) setLogs((await res.json()).logs);
    setLoading(false);
  }, [level, category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Logs</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Structured, secret-redacted logs. API keys, tokens, and secrets are never written here.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value)}
            className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
          >
            <option value="">All levels</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
          >
            <option value="">All categories</option>
            <option value="request">Request</option>
            <option value="response">Response</option>
            <option value="auth">Auth</option>
            <option value="rate_limit">Rate limit</option>
            <option value="parse">Parse</option>
            <option value="database">Database</option>
            <option value="worker">Worker</option>
          </select>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-dim border-b border-border-soft">
              <th className="px-4 py-2.5 font-normal">Time</th>
              <th className="px-4 py-2.5 font-normal">Level</th>
              <th className="px-4 py-2.5 font-normal">Category</th>
              <th className="px-4 py-2.5 font-normal">Source</th>
              <th className="px-4 py-2.5 font-normal">Message</th>
              <th className="px-4 py-2.5 font-normal">HTTP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-soft font-mono text-xs">
            {loading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted font-sans">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-text-muted font-sans">
                  No log entries match these filters.
                </td>
              </tr>
            )}
            {!loading &&
              logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2 text-text-dim whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                  <td className="px-4 py-2 uppercase" style={{ color: LEVEL_COLOR[log.level] ?? "var(--text-muted)" }}>
                    {log.level}
                  </td>
                  <td className="px-4 py-2 text-text-muted">{log.category}</td>
                  <td className="px-4 py-2 text-text-muted">{log.provider ?? "—"}</td>
                  <td className="px-4 py-2 text-text font-sans">{log.message}</td>
                  <td className="px-4 py-2 text-text-muted">{log.httpStatus ?? "—"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
