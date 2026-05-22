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
  const [readinessSnapshot, setReadinessSnapshot] = useState<AnyRecord>({});
  const [connectors, setConnectors] = useState<AnyRecord[]>([]);
  const [diagnostics, setDiagnostics] = useState<AnyRecord>({});
  const [mcpExplorer, setMcpExplorer] = useState<AnyRecord>({});
  const [metrics, setMetrics] = useState<AnyRecord>({});
  const [activity, setActivity] = useState<AnyRecord>({});
  const [connectorMatrix, setConnectorMatrix] = useState<AnyRecord>({});
  const [plugins, setPlugins] = useState<AnyRecord[]>([]);
  const [pluginRegistry, setPluginRegistry] = useState<AnyRecord>({});
  const [pluginHooks, setPluginHooks] = useState<AnyRecord>({});
  const [pluginHookInput, setPluginHookInput] = useState("kb.search");
  const [pluginHookCheck, setPluginHookCheck] = useState<AnyRecord>({});
  const [models, setModels] = useState<AnyRecord[]>([]);
  const [modelRegistry, setModelRegistry] = useState<AnyRecord>({});
  const [modelVerifyResult, setModelVerifyResult] = useState<AnyRecord>({});
  const [agents, setAgents] = useState<AnyRecord[]>([]);
  const [agentMatrix, setAgentMatrix] = useState<AnyRecord>({});
  const [configReport, setConfigReport] = useState<AnyRecord>({});
  const [conflictRules, setConflictRules] = useState<AnyRecord[]>([]);
  const [rules, setRules] = useState<AnyRecord[]>([]);
  const [sessions, setSessions] = useState<AnyRecord[]>([]);
  const [approvals, setApprovals] = useState<AnyRecord[]>([]);
  const [runOutput, setRunOutput] = useState("");
  const [runSummary, setRunSummary] = useState<AnyRecord>({});
  const [missionInput, setMissionInput] = useState("inspect this workspace");
  const [commandPreviewInput, setCommandPreviewInput] = useState("npm run typecheck:goatmez");
  const [commandPreviewResult, setCommandPreviewResult] = useState<AnyRecord>({});
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
  const [sessionSearchInput, setSessionSearchInput] = useState("inspect");
  const [sessionReplayPreview, setSessionReplayPreview] = useState<AnyRecord>({});
  const [connectorAgentId, setConnectorAgentId] = useState("operator");
  const [connectorCheckId, setConnectorCheckId] = useState("openai");
  const [connectorDiagnosticsResult, setConnectorDiagnosticsResult] = useState<AnyRecord>({});
  const [connectorVerifyResult, setConnectorVerifyResult] = useState<AnyRecord>({});
  const [approvalFilter, setApprovalFilter] = useState("pending");
  const [artifactPath, setArtifactPath] = useState("C:\\Users\\gomez\\Desktop\\ALL_DELIVERABLES.zip");
  const [artifacts, setArtifacts] = useState<AnyRecord[]>([]);
  const [artifactDetail, setArtifactDetail] = useState<AnyRecord>({});
  const [artifactRisk, setArtifactRisk] = useState<AnyRecord>({});
  const [artifactActionResult, setArtifactActionResult] = useState<AnyRecord>({});

  const refresh = async () => {
    setLoading(true);
    setError("");
    try {
      const [h, o, readyPayload, c, r, s, a, cfg, conflicts, diag, mcpExplorerPayload, metricsPayload, activityPayload, matrixPayload, permDiag, pluginPayload, pluginRegistryPayload, pluginHooksPayload, modelPayload, modelRegistryPayload, agentPayload, agentMatrixPayload, artifactPayload] = await Promise.all([
        api("health"),
        api("observability"),
        api("readiness"),
        api(`connectors?agentId=${encodeURIComponent(connectorAgentId)}`),
        api("permissions/rules"),
        api("sessions"),
        api(`approvals?status=${encodeURIComponent(approvalFilter)}`),
        api("config"),
        api("conflicts"),
        api("diagnostics"),
        api("mcp/explorer"),
        api("metrics"),
        api("activity/recent?limit=20"),
        api("connectors/matrix?agents=operator,developer"),
        api("permissions/diagnostics"),
        api("plugins"),
        api("plugins/registry"),
        api("plugins/hooks"),
        api("models"),
        api("models/registry"),
        api("agents"),
        api("agents/matrix"),
        api("artifacts")
      ]);
      setHealth(h);
      setObservability(o);
      setReadinessSnapshot((readyPayload && typeof readyPayload === "object") ? readyPayload as AnyRecord : {});
      setConnectors(Array.isArray(c) ? c : []);
      setRules(Array.isArray(r) ? r : []);
      setSessions(Array.isArray(s) ? s : []);
      setApprovals((a && Array.isArray(a.approvals)) ? a.approvals as AnyRecord[] : []);
      setConfigReport((cfg && typeof cfg.config === "object" && cfg.config) ? cfg.config as AnyRecord : {});
      setConflictRules((conflicts && Array.isArray(conflicts.rules)) ? conflicts.rules as AnyRecord[] : []);
      setDiagnostics((diag && typeof diag === "object") ? diag as AnyRecord : {});
      setMcpExplorer((mcpExplorerPayload && typeof mcpExplorerPayload === "object") ? mcpExplorerPayload as AnyRecord : {});
      setMetrics((metricsPayload && typeof metricsPayload === "object") ? metricsPayload as AnyRecord : {});
      setActivity((activityPayload && typeof activityPayload === "object") ? activityPayload as AnyRecord : {});
      setConnectorMatrix((matrixPayload && typeof matrixPayload === "object") ? matrixPayload as AnyRecord : {});
      setPermissionDiagnostics((permDiag && typeof permDiag === "object") ? permDiag as AnyRecord : {});
      setPlugins((pluginPayload && Array.isArray(pluginPayload.plugins)) ? pluginPayload.plugins as AnyRecord[] : []);
      setPluginRegistry((pluginRegistryPayload && typeof pluginRegistryPayload === "object") ? pluginRegistryPayload as AnyRecord : {});
      setPluginHooks((pluginHooksPayload && typeof pluginHooksPayload === "object") ? pluginHooksPayload as AnyRecord : {});
      setModels((modelPayload && Array.isArray(modelPayload.models)) ? modelPayload.models as AnyRecord[] : []);
      setModelRegistry((modelRegistryPayload && typeof modelRegistryPayload === "object") ? modelRegistryPayload as AnyRecord : {});
      setAgents((agentPayload && Array.isArray(agentPayload.agents)) ? agentPayload.agents as AnyRecord[] : []);
      setAgentMatrix((agentMatrixPayload && typeof agentMatrixPayload === "object") ? agentMatrixPayload as AnyRecord : {});
      setArtifacts((artifactPayload && Array.isArray(artifactPayload.artifacts)) ? artifactPayload.artifacts as AnyRecord[] : []);
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
  const selectedArtifactId = String(artifacts[0]?.id || "");

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
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                <input
                  value={connectorAgentId}
                  onChange={(event) => setConnectorAgentId(event.target.value)}
                  className="rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                />
                <input
                  value={connectorCheckId}
                  onChange={(event) => setConnectorCheckId(event.target.value)}
                  className="rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                />
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api(`connectors/${encodeURIComponent(connectorCheckId)}/diagnostics?agentId=${encodeURIComponent(connectorAgentId)}`);
                    setConnectorDiagnosticsResult(payload);
                  }}
                >
                  Inspect
                </button>
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api(`connectors/${encodeURIComponent(connectorCheckId)}/verify-dry-run`, {
                      method: "POST",
                      body: JSON.stringify({ agentId: connectorAgentId })
                    });
                    setConnectorVerifyResult(payload);
                  }}
                >
                  Verify Dry Run
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    await api("mcp/reload", { method: "POST", body: "{}" });
                    await refresh();
                  }}
                >
                  Reload MCP
                </button>
              </div>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{JSON.stringify(connectorDiagnosticsResult, null, 2)}</pre>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{JSON.stringify(connectorVerifyResult, null, 2)}</pre>
              {connectors.map((connector) => (
                <div key={String(connector.id)} className="rounded border border-surface-700 p-2">
                  <div className="font-medium">{String(connector.name || connector.id)}</div>
                  <div className="text-surface-400 mt-1">
                    type={String(connector.type)} | enabled={String(connector.enabled)} | ready={String(connector.ready)}
                  </div>
                  <div className="text-surface-500 mt-1">missing: {Array.isArray(connector.missingSecrets) ? connector.missingSecrets.join(", ") || "none" : "none"}</div>
                  <div className="text-surface-500 mt-1">failures: {Array.isArray(connector.failureReasons) ? connector.failureReasons.join(", ") : "none"}</div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Readiness", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(readinessSnapshot, null, 2)}</pre>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Operational Metrics", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(metrics, null, 2)}</pre>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Recent Activity", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(activity, null, 2)}</pre>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Connector Matrix", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(connectorMatrix, null, 2)}</pre>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Plugin / Skill Registry", (
            <div className="space-y-3">
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all">{JSON.stringify(pluginRegistry, null, 2)}</pre>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all">{JSON.stringify(pluginHooks, null, 2)}</pre>
              <div className="flex gap-2">
                <input
                  value={pluginHookInput}
                  onChange={(event) => setPluginHookInput(event.target.value)}
                  className="w-full rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                />
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api("plugins/hooks/check", {
                      method: "POST",
                      body: JSON.stringify({ hook: pluginHookInput })
                    });
                    setPluginHookCheck(payload);
                  }}
                >
                  Check Hook
                </button>
              </div>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all">{JSON.stringify(pluginHookCheck, null, 2)}</pre>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {plugins.map((plugin) => (
                  <div key={String(plugin.id)} className="rounded border border-surface-700 p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium">{String(plugin.name || plugin.id)}</div>
                        <div className="text-surface-400">{String(plugin.kind)} | enabled={String(plugin.enabled)}</div>
                      </div>
                      <button
                        className="rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                        onClick={async () => {
                          const action = plugin.enabled ? "disable" : "enable";
                          await api(`plugins/${String(plugin.id)}/${action}`, { method: "POST", body: "{}" });
                          await refresh();
                        }}
                      >
                        {plugin.enabled ? "Disable" : "Enable"}
                      </button>
                    </div>
                    <p className="text-surface-500 mt-2">{String(plugin.description || "")}</p>
                    <div className="text-surface-500 mt-2">
                      hooks: {Array.isArray(plugin.toolHooks) ? plugin.toolHooks.join(", ") : "none"}
                    </div>
                  </div>
                ))}
                {!plugins.length && <p className="text-surface-500">No plugin records loaded.</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Model Registry", (
            <div className="space-y-3">
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all">{JSON.stringify(modelRegistry, null, 2)}</pre>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all">{JSON.stringify(modelVerifyResult, null, 2)}</pre>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                {models.map((model) => (
                  <div key={String(model.id)} className="rounded border border-surface-700 p-2">
                    <div className="font-medium">{String(model.name || model.id)}</div>
                    <div className="text-surface-400">{String(model.provider)} | enabled={String(model.enabled)}</div>
                    <div className="text-surface-500 mt-1">capabilities: {Array.isArray(model.capabilities) ? model.capabilities.join(", ") : "none"}</div>
                    <div className="text-surface-500 mt-1">secrets: {Array.isArray(model.requiredSecrets) ? model.requiredSecrets.join(", ") || "none" : "none"}</div>
                    <button
                      className="mt-2 rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                      onClick={async () => {
                        const payload = await api(`models/${String(model.id)}/verify-dry-run`, { method: "POST", body: "{}" });
                        setModelVerifyResult(payload);
                      }}
                    >
                      Verify Dry Run
                    </button>
                  </div>
                ))}
                {!models.length && <p className="text-surface-500">No model profiles loaded.</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Agent Capability Matrix", (
            <div className="space-y-3">
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all">{JSON.stringify(agentMatrix, null, 2)}</pre>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
                {agents.map((agent) => (
                  <div key={String(agent.id)} className="rounded border border-surface-700 p-2">
                    <div className="font-medium">{String(agent.name || agent.id)}</div>
                    <div className="text-surface-400">{String(agent.role)} | {String(agent.autonomyLevel)} | enabled={String(agent.enabled)}</div>
                    <p className="text-surface-500 mt-1">{String(agent.description || "")}</p>
                    <div className="text-surface-500 mt-1">connectors: {Array.isArray(agent.allowedConnectors) ? agent.allowedConnectors.join(", ") || "none" : "none"}</div>
                    <div className="text-surface-500 mt-1">models: {Array.isArray(agent.allowedModels) ? agent.allowedModels.join(", ") || "none" : "none"}</div>
                  </div>
                ))}
                {!agents.length && <p className="text-surface-500">No agent profiles loaded.</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {card("Config Compatibility", (
            <pre className="whitespace-pre-wrap break-all">{JSON.stringify(configReport, null, 2)}</pre>
          ))}
          {card("MCP Diagnostics", (
            <div className="space-y-2">
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(diagnostics.mcp || {}, null, 2)}</pre>
              <pre className="whitespace-pre-wrap break-all">{JSON.stringify(mcpExplorer, null, 2)}</pre>
            </div>
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
                  const payload = await api("operator/run-summary", { method: "POST", body: JSON.stringify({ message: missionInput }) });
                  setRunSummary((payload && typeof payload.summary === "object" && payload.summary) ? payload.summary as AnyRecord : {});
                  setRunOutput((payload && typeof payload.result?.output === "string") ? payload.result.output : JSON.stringify(payload, null, 2));
                  await refresh();
                }}
              >
                Execute Mission
              </button>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{JSON.stringify(runSummary, null, 2)}</pre>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{runOutput || "No mission output yet."}</pre>
            </div>
          ))}

          {card("Command Preview", (
            <div className="space-y-2">
              <input
                value={commandPreviewInput}
                onChange={(event) => setCommandPreviewInput(event.target.value)}
                className="w-full rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
              />
              <button
                className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                onClick={async () => {
                  const payload = await api("operator/command-preview", {
                    method: "POST",
                    body: JSON.stringify({ command: commandPreviewInput })
                  });
                  setCommandPreviewResult(payload);
                }}
              >
                Preview
              </button>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{JSON.stringify(commandPreviewResult, null, 2)}</pre>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Artifact Vault", (
            <div className="space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-2">
                <input
                  value={artifactPath}
                  onChange={(event) => setArtifactPath(event.target.value)}
                  className="lg:col-span-2 rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                />
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api("artifacts/register", {
                      method: "POST",
                      body: JSON.stringify({ path: artifactPath })
                    });
                    setArtifactActionResult(payload);
                    setArtifactDetail(payload);
                    await refresh();
                  }}
                >
                  Register
                </button>
                <button
                  disabled={!selectedArtifactId}
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800 disabled:opacity-50"
                  onClick={async () => {
                    const payload = await api(`artifacts/${encodeURIComponent(selectedArtifactId)}/scan`, {
                      method: "POST",
                      body: "{}"
                    });
                    setArtifactActionResult(payload);
                    setArtifactDetail(payload);
                    await refresh();
                  }}
                >
                  Scan
                </button>
                <button
                  disabled={!selectedArtifactId}
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800 disabled:opacity-50"
                  onClick={async () => {
                    const payload = await api(`artifacts/${encodeURIComponent(selectedArtifactId)}/ingest-docs`, {
                      method: "POST",
                      body: "{}"
                    });
                    setArtifactActionResult(payload);
                    await refresh();
                  }}
                >
                  Ingest Docs
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!selectedArtifactId}
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800 disabled:opacity-50"
                  onClick={async () => {
                    const payload = await api(`artifacts/${encodeURIComponent(selectedArtifactId)}`);
                    setArtifactDetail(payload);
                  }}
                >
                  Inspect Latest
                </button>
                <button
                  disabled={!selectedArtifactId}
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800 disabled:opacity-50"
                  onClick={async () => {
                    const payload = await api(`artifacts/${encodeURIComponent(selectedArtifactId)}/risk`);
                    setArtifactRisk(payload);
                  }}
                >
                  Risk Summary
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {artifacts.map((artifact) => (
                  <div key={String(artifact.id)} className="rounded border border-surface-700 p-2">
                    <div className="font-medium">{String(artifact.name || artifact.id)}</div>
                    <div className="text-surface-400">status={String(artifact.status)} | docs={String(artifact.docCount)} | excluded={String(artifact.excludedCount)}</div>
                    <div className="text-surface-500 mt-1">sha256={String(artifact.sha256 || "").slice(0, 24)}</div>
                    <div className="text-surface-500 mt-1">source={String(artifact.sourcePath || "")}</div>
                  </div>
                ))}
                {!artifacts.length && <p className="text-surface-500">No artifact bundles registered.</p>}
              </div>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all">{JSON.stringify(artifactActionResult, null, 2)}</pre>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all">{JSON.stringify(artifactRisk, null, 2)}</pre>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap break-all max-h-[360px] overflow-auto">{JSON.stringify(artifactDetail, null, 2)}</pre>
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
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                        onClick={async () => {
                          const action = rule.enabled ? "disable" : "enable";
                          await api(`permissions/rules/${String(rule.id)}/${action}`, { method: "POST", body: "{}" });
                          await refresh();
                        }}
                      >
                        {rule.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        className="rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                        onClick={async () => {
                          await api(`permissions/rules/${String(rule.id)}`, { method: "DELETE" });
                          await refresh();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {card("Session History", (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  value={sessionSearchInput}
                  onChange={(event) => setSessionSearchInput(event.target.value)}
                  className="w-full rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                />
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api("sessions/search", {
                      method: "POST",
                      body: JSON.stringify({ query: sessionSearchInput })
                    });
                    setSessions(Array.isArray(payload) ? payload : []);
                  }}
                >
                  Search
                </button>
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api("sessions");
                    setSessions(Array.isArray(payload) ? payload : []);
                  }}
                >
                  Reset
                </button>
              </div>
              <pre className="rounded border border-surface-700 bg-surface-950 p-3 whitespace-pre-wrap">{JSON.stringify(sessionReplayPreview, null, 2)}</pre>
              <div className="space-y-2 max-h-[360px] overflow-auto">
              {sessions.map((session) => (
                <div key={String(session.id)} className="rounded border border-surface-700 p-2">
                  <div className="font-medium">{String(session.message)}</div>
                  <div className="text-surface-400">{String(session.status)} | tools={String(session.toolCalls)} | approvals={String(session.approvals)}</div>
                  <p className="text-surface-500 mt-1">{String(session.summary || "").slice(0, 180)}</p>
                  <button
                    className="mt-2 rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                    onClick={async () => {
                      const payload = await api(`sessions/${String(session.id)}/replay-summary`, { method: "POST" });
                      setSessionReplayPreview(payload);
                    }}
                  >
                    Replay Summary
                  </button>
                  <button
                    className="mt-2 ml-2 rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                    onClick={async () => {
                      const payload = await api(`sessions/${String(session.id)}/timeline`);
                      setSessionReplayPreview(payload);
                    }}
                  >
                    Timeline
                  </button>
                  <button
                    className="mt-2 ml-2 rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                    onClick={async () => {
                      const payload = await api(`sessions/${String(session.id)}/export`, { method: "POST" });
                      setSessionReplayPreview(payload);
                    }}
                  >
                    Export
                  </button>
                </div>
              ))}
              {!sessions.length && !loading && <p className="text-surface-500">No session records yet.</p>}
              {loading && <p className="text-surface-500">Loading...</p>}
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-1 gap-4">
          {card("Approval Queue", (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={approvalFilter}
                  onChange={(event) => setApprovalFilter(event.target.value)}
                  className="rounded border border-surface-700 bg-surface-950 px-3 py-2 text-xs"
                >
                  <option value="pending">pending</option>
                  <option value="approved">approved</option>
                  <option value="rejected">rejected</option>
                  <option value="executed">executed</option>
                  <option value="failed">failed</option>
                </select>
                <button
                  className="rounded-md border border-surface-700 px-3 py-2 text-xs hover:bg-surface-800"
                  onClick={async () => {
                    const payload = await api(`approvals?status=${encodeURIComponent(approvalFilter)}`);
                    setApprovals((payload && Array.isArray(payload.approvals)) ? payload.approvals : []);
                  }}
                >
                  Refresh Queue
                </button>
              </div>
              <div className="space-y-2 max-h-[280px] overflow-auto">
                {approvals.map((approval) => (
                  <div key={String(approval.id)} className="rounded border border-surface-700 p-2">
                    <div className="font-medium">{String(approval.toolName || approval.id)}</div>
                    <div className="text-surface-400">{String(approval.status)} | mission={String(approval.missionId || "")}</div>
                    <p className="text-surface-500 mt-1">{String(approval.reason || "")}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                        onClick={async () => {
                          await api(`approvals/${String(approval.id)}/approve`, { method: "POST", body: "{}" });
                          const payload = await api(`approvals?status=${encodeURIComponent(approvalFilter)}`);
                          setApprovals((payload && Array.isArray(payload.approvals)) ? payload.approvals : []);
                        }}
                      >
                        Approve
                      </button>
                      <button
                        className="rounded border border-surface-700 px-2 py-1 text-[11px] hover:bg-surface-800"
                        onClick={async () => {
                          await api(`approvals/${String(approval.id)}/reject`, { method: "POST", body: "{}" });
                          const payload = await api(`approvals?status=${encodeURIComponent(approvalFilter)}`);
                          setApprovals((payload && Array.isArray(payload.approvals)) ? payload.approvals : []);
                        }}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
                {!approvals.length && <p className="text-surface-500">No approvals in this filter.</p>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
