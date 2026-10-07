export default function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "live" | "warn" | "error" | "info" | "neutral";
}) {
  const color = accent ? `var(--signal-${accent})` : "var(--text)";
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <div className="text-xs text-text-muted mb-1.5">{label}</div>
      <div className="font-mono text-2xl font-semibold tracking-tight" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-text-dim mt-1">{sub}</div>}
    </div>
  );
}
