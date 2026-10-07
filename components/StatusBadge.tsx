const STATUS_MAP: Record<string, { label: string; color: string; dot: boolean }> = {
  connected: { label: "Connected", color: "var(--signal-live)", dot: true },
  not_configured: { label: "Not Configured", color: "var(--signal-neutral)", dot: false },
  error: { label: "Error", color: "var(--signal-error)", dot: false },
  disconnected: { label: "Disconnected", color: "var(--signal-error)", dot: false },
  rate_limited: { label: "Rate Limited", color: "var(--signal-warn)", dot: false },
  NEW: { label: "New", color: "var(--signal-live)", dot: false },
  UPDATED: { label: "Updated", color: "var(--signal-info)", dot: false },
  ACTIVE: { label: "Active", color: "var(--signal-neutral)", dot: false },
  REMOVED: { label: "Removed", color: "var(--signal-error)", dot: false },
  success: { label: "Success", color: "var(--signal-live)", dot: false },
  failed: { label: "Failed", color: "var(--signal-error)", dot: false },
  running: { label: "Running", color: "var(--signal-info)", dot: false },
};

export default function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, color: "var(--signal-neutral)", dot: false };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border"
      style={{
        color: info.color,
        borderColor: `color-mix(in srgb, ${info.color} 35%, transparent)`,
        background: `color-mix(in srgb, ${info.color} 12%, transparent)`,
      }}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${info.dot ? "pulse-dot" : ""}`}
        style={{ background: info.color }}
      />
      {info.label}
    </span>
  );
}
