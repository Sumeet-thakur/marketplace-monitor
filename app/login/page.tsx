"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sign in failed.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <span className="h-2.5 w-2.5 rounded-full bg-signal-live pulse-dot" />
            <span className="font-display font-semibold tracking-tight text-lg">Overwatch</span>
          </div>
          <p className="text-text-muted text-sm">Marketplace monitoring platform</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-xl p-6 space-y-4 shadow-2xl shadow-black/40"
        >
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm outline-none focus:border-signal-info transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-muted mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface-2 border border-border px-3 py-2 text-sm outline-none focus:border-signal-info transition-colors"
            />
          </div>

          {error && (
            <p className="text-sm text-signal-error bg-signal-error/10 border border-signal-error/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-signal-info hover:bg-signal-info/90 disabled:opacity-60 text-white text-sm font-medium py-2.5 transition-colors"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-xs text-text-dim text-center pt-1">
            First run? Any email/password you enter here becomes the admin account.
          </p>
        </form>
      </div>
    </main>
  );
}
