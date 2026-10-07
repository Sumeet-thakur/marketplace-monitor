"use client";

import { useCallback, useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import { timeAgo } from "@/lib/format";

interface Integration {
  id: string;
  provider: string;
  displayName: string;
  enabled: boolean;
  baseUrl: string | null;
  endpoint: string | null;
  apiVersion: string | null;
  requestIntervalSec: number;
  minIntervalSec: number;
  httpMethod: string;
  authMethod: string | null;
  headers: Record<string, string> | null;
  queryParams: Record<string, string> | null;
  pagination: Record<string, unknown> | null;
  fieldMapping: Record<string, string> | null;
  status: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorMessage: string | null;
  credential: {
    apiKeyMasked: string | null;
    apiSecretMasked: string | null;
    accessTokenMasked: string | null;
    configured: boolean;
  };
  providerInfo: { label: string; description: string; minIntervalSec: number; requiresRealCredentials: boolean } | null;
}

interface TestResult {
  success: boolean;
  message: string;
  httpStatus: number | null;
  responseTimeMs: number;
  errorCategory: string | null;
  timestamp: string;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/integrations");
    if (res.ok) {
      const data = await res.json();
      setIntegrations(data.integrations);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-sm text-text-muted mt-0.5">
            Credentials are encrypted at rest and never sent to the browser in full.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="rounded-lg bg-signal-info hover:bg-signal-info/90 text-white text-sm font-medium px-3.5 py-2 transition-colors"
        >
          {showAdd ? "Cancel" : "+ Add Generic API"}
        </button>
      </div>

      {showAdd && (
        <AddGenericForm
          onCreated={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}

      {loading && <div className="text-sm text-text-muted">Loading…</div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {integrations.map((integration) => (
          <IntegrationCard key={integration.id} integration={integration} onChanged={load} />
        ))}
      </div>
    </div>
  );
}

function AddGenericForm({ onCreated }: { onCreated: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/integrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "generic",
        displayName: displayName || "New Generic API",
        baseUrl,
        endpoint,
        httpMethod: "GET",
        authMethod: "bearer",
        requestIntervalSec: 30,
        fieldMapping: {
          "results[].id": "externalId",
          "results[].title": "title",
          "results[].price": "price",
        },
      }),
    });
    setSaving(false);
    if (res.ok) onCreated();
    else setError("Could not create integration.");
  }

  return (
    <form onSubmit={submit} className="bg-surface border border-border rounded-xl p-4 grid grid-cols-1 md:grid-cols-4 gap-2">
      <input
        placeholder="Display name (e.g. AutoTrader API)"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
      />
      <input
        placeholder="Base URL"
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
      />
      <input
        placeholder="Endpoint (e.g. v1/listings)"
        value={endpoint}
        onChange={(e) => setEndpoint(e.target.value)}
        className="rounded-lg bg-surface-2 border border-border px-3 py-1.5 text-sm outline-none focus:border-signal-info"
      />
      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-signal-live/20 border border-signal-live/40 text-signal-live text-sm font-medium px-3 py-1.5 hover:bg-signal-live/30 transition-colors"
      >
        {saving ? "Creating…" : "Create"}
      </button>
      {error && <p className="col-span-full text-xs text-signal-error">{error}</p>}
    </form>
  );
}

function IntegrationCard({ integration, onChanged }: { integration: Integration; onChanged: () => void }) {
  const [form, setForm] = useState({
    baseUrl: integration.baseUrl ?? "",
    endpoint: integration.endpoint ?? "",
    apiVersion: integration.apiVersion ?? "",
    requestIntervalSec: integration.requestIntervalSec,
    minIntervalSec: integration.minIntervalSec,
    authMethod: integration.authMethod ?? "bearer",
    apiKey: "",
    apiSecret: "",
    accessToken: "",
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const floorSec = integration.providerInfo?.minIntervalSec ?? integration.minIntervalSec;

  async function save() {
    setSaving(true);
    const body: Record<string, unknown> = {
      baseUrl: form.baseUrl,
      endpoint: form.endpoint,
      apiVersion: form.apiVersion,
      requestIntervalSec: Math.max(Number(form.requestIntervalSec) || floorSec, floorSec),
      minIntervalSec: floorSec,
      authMethod: form.authMethod,
    };
    // Only send credential fields the admin actually typed something into —
    // this is the "change the token without redeploying" path. Leaving a
    // field blank keeps the previously stored (encrypted) value untouched.
    if (form.apiKey.trim()) body.apiKey = form.apiKey.trim();
    if (form.apiSecret.trim()) body.apiSecret = form.apiSecret.trim();
    if (form.accessToken.trim()) body.accessToken = form.accessToken.trim();

    await fetch(`/api/integrations/${integration.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setForm((f) => ({ ...f, apiKey: "", apiSecret: "", accessToken: "" }));
    setSaving(false);
    onChanged();
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const res = await fetch(`/api/integrations/${integration.id}/test`, { method: "POST" });
    const data = await res.json();
    setTestResult(data);
    setTesting(false);
    onChanged();
  }

  async function toggle() {
    await fetch(`/api/integrations/${integration.id}/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !integration.enabled }),
    });
    onChanged();
  }

  const isDemo = integration.provider === "demo";

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-medium">{integration.displayName}</h3>
            <span className="text-[10px] uppercase tracking-wider text-text-dim font-mono">{integration.provider}</span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">{integration.providerInfo?.description}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={integration.enabled ? integration.status : "not_configured"} />
          <button
            onClick={toggle}
            className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
              integration.enabled
                ? "border-signal-live/40 text-signal-live bg-signal-live/10 hover:bg-signal-live/20"
                : "border-border text-text-muted hover:text-text"
            }`}
          >
            {integration.enabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      </div>

      {integration.lastErrorMessage && (
        <p className="text-xs text-signal-error bg-signal-error/10 border border-signal-error/25 rounded-lg px-2.5 py-1.5">
          {integration.lastErrorMessage}
        </p>
      )}

      <div className="text-xs text-text-dim flex gap-4">
        <span>Last success: {timeAgo(integration.lastSuccessAt)}</span>
        <span>Last failure: {timeAgo(integration.lastFailureAt)}</span>
      </div>

      {!isDemo && (
        <div className="grid grid-cols-2 gap-2 pt-1">
          <LabeledInput label="Base URL" value={form.baseUrl} onChange={(v) => setForm((f) => ({ ...f, baseUrl: v }))} span2 />
          <LabeledInput label="Endpoint" value={form.endpoint} onChange={(v) => setForm((f) => ({ ...f, endpoint: v }))} />
          <LabeledInput label="API Version" value={form.apiVersion} onChange={(v) => setForm((f) => ({ ...f, apiVersion: v }))} />
          <div>
            <label className="block text-[11px] text-text-dim mb-1">Request Interval (sec)</label>
            <input
              type="number"
              min={floorSec}
              value={form.requestIntervalSec}
              onChange={(e) => setForm((f) => ({ ...f, requestIntervalSec: Number(e.target.value) }))}
              className="w-full rounded-lg bg-surface-2 border border-border px-2.5 py-1.5 text-sm outline-none focus:border-signal-info font-mono"
            />
            <p className="text-[10px] text-text-dim mt-0.5">Minimum allowed: {floorSec}s</p>
          </div>
          <div>
            <label className="block text-[11px] text-text-dim mb-1">Auth Method</label>
            <select
              value={form.authMethod}
              onChange={(e) => setForm((f) => ({ ...f, authMethod: e.target.value }))}
              className="w-full rounded-lg bg-surface-2 border border-border px-2.5 py-1.5 text-sm outline-none focus:border-signal-info"
            >
              <option value="bearer">Bearer token</option>
              <option value="api_key_header">API key (header)</option>
              <option value="api_key_query">API key (query param)</option>
              <option value="basic">Basic (key + secret)</option>
              <option value="none">None</option>
            </select>
          </div>

          <LabeledInput
            label={`API Key ${integration.credential.apiKeyMasked ? `(${integration.credential.apiKeyMasked})` : ""}`}
            value={form.apiKey}
            onChange={(v) => setForm((f) => ({ ...f, apiKey: v }))}
            placeholder={integration.credential.apiKeyMasked ? "Leave blank to keep current" : "Enter API key"}
            secret
          />
          <LabeledInput
            label={`API Secret ${integration.credential.apiSecretMasked ? `(${integration.credential.apiSecretMasked})` : ""}`}
            value={form.apiSecret}
            onChange={(v) => setForm((f) => ({ ...f, apiSecret: v }))}
            placeholder={integration.credential.apiSecretMasked ? "Leave blank to keep current" : "Enter API secret"}
            secret
          />
          <LabeledInput
            label={`Access Token ${integration.credential.accessTokenMasked ? `(${integration.credential.accessTokenMasked})` : ""}`}
            value={form.accessToken}
            onChange={(v) => setForm((f) => ({ ...f, accessToken: v }))}
            placeholder={integration.credential.accessTokenMasked ? "Leave blank to keep current" : "Enter access token"}
            secret
            span2
          />
        </div>
      )}

      {testResult && (
        <div
          className={`text-xs rounded-lg px-2.5 py-2 border ${
            testResult.success
              ? "border-signal-live/30 bg-signal-live/10 text-signal-live"
              : "border-signal-error/30 bg-signal-error/10 text-signal-error"
          }`}
        >
          <div className="font-medium">{testResult.success ? "Connection successful" : "Connection failed"}</div>
          <div className="font-mono text-[11px] mt-0.5 opacity-90">
            {testResult.message} {testResult.httpStatus ? `· HTTP ${testResult.httpStatus}` : ""} ·{" "}
            {testResult.responseTimeMs}ms
            {testResult.errorCategory ? ` · ${testResult.errorCategory}` : ""}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-1">
        {!isDemo && (
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-surface-3 hover:bg-surface-3/80 text-sm px-3 py-1.5 transition-colors"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
        <button
          onClick={testConnection}
          disabled={testing}
          className="rounded-lg border border-signal-info/40 text-signal-info hover:bg-signal-info/10 text-sm px-3 py-1.5 transition-colors"
        >
          {testing ? "Testing…" : "Test Connection"}
        </button>
      </div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
  secret,
  span2,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  secret?: boolean;
  span2?: boolean;
}) {
  return (
    <div className={span2 ? "col-span-2" : ""}>
      <label className="block text-[11px] text-text-dim mb-1 truncate">{label}</label>
      <input
        type={secret ? "password" : "text"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-surface-2 border border-border px-2.5 py-1.5 text-sm outline-none focus:border-signal-info font-mono"
      />
    </div>
  );
}
