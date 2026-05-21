"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";

type AnyRecord = Record<string, unknown>;
type KnowledgeResult = {
  document?: {
    id?: string;
    title?: string;
  };
  chunk?: {
    text?: string;
  };
  score?: number;
};

async function api(path: string, options: RequestInit = {}): Promise<any> {
  const response = await fetch(`/api/goatmez/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(payload.error || `Request failed: ${response.status}`);
  return payload;
}

function card(title: string, body: ReactNode) {
  return (
    <section className="rounded-lg border border-surface-700 bg-surface-900/70 p-4">
      <h2 className="text-sm font-semibold text-surface-100">{title}</h2>
      <div className="mt-3 text-xs text-surface-300">{body}</div>
    </section>
  );
}

export default function GoatmezPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [health, setHealth] = useState<AnyRecord>({});
  const [observability, setObservability] = useState<AnyRecord>({});
  const [connectors, setConnectors] = useState<AnyRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState<AnyRecord>({});
  const [configReport, setConfigReport] = useState<AnyRecord>({});
  const [conflictRules, setConflictRules] = useState<AnyRecord[]>([]);
  const [rules, setRules] = useState<AnyRecord[]>([]);
  const [sessions, setSessions] = useState<AnyRecord[]>([]);
  const [runOutput, setRunOutput] = useState("");
  const [missionInput, setMissionInput] = useState("inspect this workspace");
  const [kbQuery, setKbQuery] = useState("dashboard");
  const [kbResults, setKbResults] = useState<KnowledgeResult[]>([]);
  const [permissionTool, setPermissionTool] = useState("connector.http.request");
  const [permissionResult, setPermissionResult] = useState<AnyRecord | null>(null);
  const [permissionDiagnostics, setPermissionDiagnostics] = useState<AnyRecord>({});
  const [permissionSimulationInput, setPermissionSimulationInput] = useState("connector.http.request\nkb.search\nvault.list");
  const [permissionSimulationResult, setPermissionSimulationResult] = useState<AnyRecord>({});
  const [newRulePattern, setNewRulePattern] = useState("workflow.*");
  const [newRuleDecision, setNewRuleDecision] = useState("approval");
  const [newRuleDescription, setNewRuleDescription] = useState("Workflow actions require approval.");

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [h, o, c, r, s, cfg, conflicts, diag, permDiag] = await Promise.all([
        api("health"),
        api("observability"),
        api("connectors"),
        api("permissions/rules"),
        api("sessions"),
        api("config"),
        api("conflicts"),
        api("diagnostics"),
        api("permissions/diagnostics")
      ]);
      setHealth(h);
      setObservability(o);
      setConnectors(Array.isArray(c) ? c : []);
      setRules(Array.isArray(r) ? r : []);
      setSessions(Array.isArray(s) ? s : []);
      setConfigReport((cfg && typeof cfg.config === "object" && cfg.config) ? cfg.config as AnyRecord : {});
      setConflictRules((conflicts && Array.isArray(conflicts.rules)) ? conflicts.rules as AnyRecord[] : []);
      setDiagnostics((diag && typeof diag === "object") ? diag as AnyRecord : {});
      setPermissionDiagnostics((permDiag && typeof permDiag === "object") ? permDiag as AnyRecord : {});
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const readiness = useMemo(() => {
    const ready = connectors.filter((item) => item.ready).length;
    return `${ready}/${connectors.length}`;
  }, [connectors]);

  return (
    <main className="min-h-screen bg-surface-950 text-surface-100 p-6">
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="flex items-center justify-between rounded-lg border border-surface-800 bg-surface-900 p-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-surface-500">Goatmez Namespace</p>
            <h1 className="text-xl font-semibold">Operator Console</h1>
            <p className="text-xs text-surface-400 mt-1">Code-engine primary runtime with Goatmez mission, MCP-ready connectors, and autonomous telemetry.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => void refresh()} className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800">
              Refresh
            </button>
            <Link href="/" className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800">
              Back To Chat
            </Link>
          </div>
        </header>

        {error && (
          <div className="rounded-lg border border-red-700/60 bg-red-950/40 p-3 text-xs text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {card("Health", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(health, null, 2)}</pre>
          ))}
          {card("Observability", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(observability, null, 2)}</pre>
          ))}
          {card("Connector Readiness", (
            <div className="space-y-2">
              <p className="text-surface-400">Ready: {readiness}</p>
              {connectors.map((connector) => (
                <div key={String(connector.id)} className="rounded border border-surface-700 p-2">
                  <div className="font-medium">{String(connector.name || connector.id)}</div>
                  <div className="text-surface-400 mt-1">
                    type={String(connector.type)} | enabled={String(connector.enabled)} | ready={String(connector.ready)}
                  </div>
                  <div className="text-surface-500 mt-1">missing: {Array.isArray(connector.missingSecrets) ? connector.missingSecrets.join(", ") || "none" : "none"}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {card("Config Compatibility", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(configReport, null, 2)}</pre>
          ))}
          {card("MCP Diagnostics", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(diagnostics.mcp || {}, null, 2)}</pre>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Conflict Rules", (
            <div className="space-y-2">
              {conflictRules.map((rule, index) => (
                <div key={`${String(rule.concept || "rule")}_${index}`} className="rounded border border-surface-700 p-2">
                  <div className="font-medium">{String(rule.concept || "rule")}</div>
                  <div className="text-surface-400">owner={String(rule.canonicalOwner)} | role={String(rule.goatmezRole)}</div>
                  <p className="text-surface-500 mt-1">{String(rule.translationStrategy || "")}</p>
                </div>
              ))}
              {!conflictRules.length && <p className="text-surface-500">No conflict rules loaded.</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {card("Run Mission", (
            <div className="space-y-2">
              <input
                value={missionInput}
                onChange={(event) => setMissionInput(event.target.value)}
                className="w-full rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
              />
              <button
                className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                onClick={async () => {
                  const payload = await api("run", { method: "POST", body: JSON.stringify({ message: missionInput }) });
                  setRunOutput(payload.output || JSON.stringify(payload, null, 2));
                  await refresh();
                }}
              >
                Execute Mission
              </button>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{runOutput || "No mission output yet."}</pre>
            </div>
          ))}

          {card("Knowledge Search (Hybrid)", (
            <div className="space-y-2">
              <input
                value={kbQuery}
                onChange={(event) => setKbQuery(event.target.value)}
                className="w-full rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api("knowledge/search", {
                      method: "POST",
                      body: JSON.stringify({ query: kbQuery, mode: "hybrid", limit: 5 })
                    });
                    setKbResults(Array.isArray(payload.results) ? (payload.results as KnowledgeResult[]) : []);
                  }}
                >
                  Search
                </button>
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    await api("knowledge/text", {
                      method: "POST",
                      body: JSON.stringify({
                        title: "Operator Note",
                        tags: ["manual", "ops"],
                        text: `Mission note captured at ${new Date().toISOString()}`
                      })
                    });
                    await refresh();
                  }}
                >
                  Add Sample Note
                </button>
              </div>
              <div className="space-y-2">
                {kbResults.map((item, index) => (
                  <div key={`${item.document?.id || "doc"}_${index}`} className="rounded border border-surface-700 p-2">
                    <div className="font-medium">{String(item.document?.title || "Unknown")}</div>
                    <div className="text-surface-400">score={Number(item.score || 0).toFixed(3)}</div>
                    <p className="text-surface-500 mt-1">{String(item.chunk?.text || "").slice(0, 220)}</p>
                  </div>
                ))}
                {!kbResults.length && <p className="text-surface-500">No results yet.</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {card("Permission Rules", (
            <div className="space-y-2">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                <input
                  value={newRulePattern}
                  onChange={(event) => setNewRulePattern(event.target.value)}
                  className="rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                />
                <select
                  value={newRuleDecision}
                  onChange={(event) => setNewRuleDecision(event.target.value)}
                  className="rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                >
                  <option value="allow">allow</option>
                  <option value="approval">approval</option>
                  <option value="deny">deny</option>
                </select>
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    await api("permissions/rules", {
                      method: "POST",
                      body: JSON.stringify({
                        pattern: newRulePattern,
                        decision: newRuleDecision,
                        description: newRuleDescription
                      })
                    });
                    await refresh();
                  }}
                >
                  Add Rule
                </button>
              </div>
              <input
                value={newRuleDescription}
                onChange={(event) => setNewRuleDescription(event.target.value)}
                className="w-full rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
              />
              <div className="flex gap-2">
                <input
                  value={permissionTool}
                  onChange={(event) => setPermissionTool(event.target.value)}
                  className="w-full rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                />
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api("permissions/dry-run", {
                      method: "POST",
                      body: JSON.stringify({ agentId: "operator", toolName: permissionTool })
                    });
                    setPermissionResult(payload.output || payload);
                  }}
                >
                  Dry Run
                </button>
              </div>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{JSON.stringify(permissionResult, null, 2)}</pre>
              <div className="space-y-2">
                <textarea
                  value={permissionSimulationInput}
                  onChange={(event) => setPermissionSimulationInput(event.target.value)}
                  className="w-full rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs min-h-[96px]"
                />
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api("permissions/simulate", {
                      method: "POST",
                      body: JSON.stringify({ agentId: "operator", toolsText: permissionSimulationInput })
                    });
                    setPermissionSimulationResult(payload);
                  }}
                >
                  Simulate Batch
                </button>
                <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{JSON.stringify(permissionSimulationResult, null, 2)}</pre>
                <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{JSON.stringify(permissionDiagnostics, null, 2)}</pre>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-auto">
                {rules.map((rule) => (
                  <div key={String(rule.id)} className="rounded border border-surface-700 p-2">
                    <div className="font-medium">{String(rule.pattern)}</div>
                    <div className="text-surface-400">{String(rule.decision)} | enabled={String(rule.enabled)}</div>
                    <button
                      className="mt-2 rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                      onClick={async () => {
                        await api(`permissions/rules/${String(rule.id)}`, { method: "DELETE" });
                        await refresh();
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {card("Session History", (
            <div className="space-y-2 max-h-[360px] overflow-auto">
              {sessions.map((session) => (
                <div key={String(session.id)} className="rounded border border-surface-700 p-2">
                  <div className="font-medium">{String(session.message)}</div>
                  <div className="text-surface-400">{String(session.status)} | tools={String(session.toolCalls)} | approvals={String(session.approvals)}</div>
                  <p className="text-surface-500 mt-1">{String(session.summary || "").slice(0, 180)}</p>
                </div>
              ))}
              {!sessions.length && !loading && <p className="text-surface-500">No session records yet.</p>}
              {loading && <p className="text-surface-500">Loading...</p>}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
