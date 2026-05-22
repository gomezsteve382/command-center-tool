import { existsSync } from "fs";

const baseUrl = process.env.GOATMEZ_VALIDATE_BASE_URL || "http://127.0.0.1:3101";
const artifactSourcePath = process.env.GOATMEZ_ARTIFACT_SOURCE || "C:\\Users\\gomez\\Desktop\\ALL_DELIVERABLES.zip";

async function request(path, init) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log(`[goatmez-validate] base=${baseUrl}`);
  const health = await request("/api/goatmez/health");
  assert(health.ok === true, "health.ok must be true");

  const observability = await request("/api/goatmez/observability");
  assert(observability.ok === true, "observability.ok must be true");

  const readiness = await request("/api/goatmez/readiness");
  assert(readiness.ok === true, "readiness.ok must be true");
  assert(typeof readiness.verdict === "string", "readiness verdict missing");

  const config = await request("/api/goatmez/config");
  assert(config.ok === true, "config.ok must be true");
  assert(config.config && typeof config.config === "object", "config payload missing");

  const conflicts = await request("/api/goatmez/conflicts");
  assert(conflicts.ok === true, "conflicts.ok must be true");
  assert(Array.isArray(conflicts.rules), "conflict rules must be an array");

  const diagnostics = await request("/api/goatmez/diagnostics");
  assert(diagnostics.ok === true, "diagnostics.ok must be true");
  assert(diagnostics.mcp && typeof diagnostics.mcp === "object", "diagnostics.mcp missing");

  const mcpExplorer = await request("/api/goatmez/mcp/explorer");
  assert(mcpExplorer.ok === true, "mcp explorer must be ok");
  assert(Array.isArray(mcpExplorer.servers), "mcp explorer servers missing");

  const metrics = await request("/api/goatmez/metrics");
  assert(metrics.ok === true, "metrics.ok must be true");

  const connectorDiagnostics = await request("/api/goatmez/connectors/diagnostics?agentId=operator");
  assert(connectorDiagnostics.ok === true, "connector diagnostics must be ok");
  assert(Array.isArray(connectorDiagnostics.connectors), "connector diagnostics list missing");

  const connectorMatrix = await request("/api/goatmez/connectors/matrix?agents=operator,developer");
  assert(connectorMatrix.ok === true, "connector matrix must be ok");
  assert(Array.isArray(connectorMatrix.matrix), "connector matrix rows missing");

  const activity = await request("/api/goatmez/activity/recent?limit=10");
  assert(activity.ok === true, "activity feed must be ok");
  assert(Array.isArray(activity.items), "activity feed items missing");

  const mcpReload = await request("/api/goatmez/mcp/reload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}"
  });
  assert(mcpReload.ok === true, "mcp reload dry action failed");

  const permissionDiagnostics = await request("/api/goatmez/permissions/diagnostics");
  assert(permissionDiagnostics.ok === true, "permission diagnostics must be ok");

  const permissionRules = await request("/api/goatmez/permissions/rules");
  assert(Array.isArray(permissionRules), "permission rules must be an array");
  const firstRule = permissionRules[0];
  if (firstRule?.id) {
    const disabledRule = await request(`/api/goatmez/permissions/rules/${firstRule.id}/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(disabledRule.ok === true, "permission rule disable failed");
    const enabledRule = await request(`/api/goatmez/permissions/rules/${firstRule.id}/enable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(enabledRule.ok === true, "permission rule enable failed");
  }

  const pluginList = await request("/api/goatmez/plugins");
  assert(pluginList.ok === true, "plugin list must be ok");
  assert(Array.isArray(pluginList.plugins), "plugin list missing");

  const pluginRegistry = await request("/api/goatmez/plugins/registry");
  assert(pluginRegistry.ok === true, "plugin registry must be ok");
  assert(pluginRegistry.total >= pluginList.plugins.length, "plugin registry total mismatch");

  const pluginHooks = await request("/api/goatmez/plugins/hooks");
  assert(pluginHooks.ok === true, "plugin hooks must be ok");
  assert(Array.isArray(pluginHooks.enabledHooks), "enabled plugin hooks missing");

  const pluginHookCheck = await request("/api/goatmez/plugins/hooks/check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hook: "kb.search" })
  });
  assert(pluginHookCheck.ok === true, "plugin hook check failed");
  assert(pluginHookCheck.active === true, "kb.search hook should be active");

  const models = await request("/api/goatmez/models");
  assert(models.ok === true, "models must be ok");
  assert(Array.isArray(models.models), "model list missing");

  const modelRegistry = await request("/api/goatmez/models/registry");
  assert(modelRegistry.ok === true, "model registry must be ok");

  const localModel = models.models.find((model) => model.provider === "local") || models.models[0];
  if (localModel?.id) {
    const modelVerify = await request(`/api/goatmez/models/${localModel.id}/verify-dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(modelVerify.ok === true, "model verify dry-run failed");
  }

  const agents = await request("/api/goatmez/agents");
  assert(agents.ok === true, "agents must be ok");
  assert(Array.isArray(agents.agents), "agent list missing");

  const agentMatrix = await request("/api/goatmez/agents/matrix");
  assert(agentMatrix.ok === true, "agent matrix must be ok");
  assert(Array.isArray(agentMatrix.agents), "agent matrix rows missing");

  const firstPlugin = pluginList.plugins[0];
  if (firstPlugin?.id) {
    const disabled = await request(`/api/goatmez/plugins/${firstPlugin.id}/disable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(disabled.ok === true, "plugin disable failed");
    const enabled = await request(`/api/goatmez/plugins/${firstPlugin.id}/enable`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(enabled.ok === true, "plugin enable failed");
  }

  const permissions = await request("/api/goatmez/permissions/dry-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "operator", toolName: "connector.http.request" })
  });
  assert(permissions.ok === true, "permissions dry-run failed");

  const simulation = await request("/api/goatmez/permissions/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "operator", toolNames: ["connector.http.request", "kb.search"] })
  });
  assert(simulation.ok === true, "permissions simulate failed");

  const verify = await request("/api/goatmez/connectors/openai/verify-dry-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "operator" })
  });
  assert(verify.ok === true, "connector verify dry-run failed");

  const runSummary = await request("/api/goatmez/operator/run-summary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "inspect this workspace" })
  });
  assert(runSummary.ok === true, "operator run summary failed");
  assert(runSummary.summary && typeof runSummary.summary === "object", "operator run summary missing");

  const commandPreview = await request("/api/goatmez/operator/command-preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command: "npm run typecheck:goatmez" })
  });
  assert(commandPreview.ok === true, "operator command preview failed");
  assert(commandPreview.blocked === false, "typecheck command preview should not be blocked");

  const knowledge = await request("/api/goatmez/knowledge/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "dashboard", mode: "hybrid", limit: 3 })
  });
  assert(knowledge.ok === true, "knowledge search failed");
  assert(Array.isArray(knowledge.results), "knowledge search must return results array");

  let artifactSummary = { skipped: true, sourcePath: artifactSourcePath };
  if (existsSync(artifactSourcePath)) {
    const registered = await request("/api/goatmez/artifacts/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: artifactSourcePath })
    });
    assert(registered.ok === true, "artifact registration failed");
    assert(registered.bundle && typeof registered.bundle === "object", "artifact bundle missing");
    assert(typeof registered.bundle.sha256 === "string" && registered.bundle.sha256.length === 64, "artifact bundle sha256 missing");
    assert(Array.isArray(registered.bundle.entries), "artifact entries missing");
    assert(Array.isArray(registered.bundle.nestedEntries), "artifact nested entries missing");
    assert(registered.bundle.entries.some((entry) => String(entry.path).toLowerCase().endsWith(".md")), "artifact markdown docs missing");

    const blockedPattern = /\.(bin|zip|py|cs|as)$/i;
    const combinedEntries = [...registered.bundle.entries, ...registered.bundle.nestedEntries];
    assert(combinedEntries.some((entry) => blockedPattern.test(String(entry.path))), "artifact blocked entries not detected");
    assert(
      combinedEntries.filter((entry) => blockedPattern.test(String(entry.path))).every((entry) => entry.allowedForIngestion === false),
      "blocked artifact entries must not be ingestible"
    );
    assert(
      registered.bundle.nestedEntries.every((entry) => entry.allowedForIngestion === false),
      "nested archive entries must remain inventory-only"
    );

    const scanned = await request(`/api/goatmez/artifacts/${registered.bundle.id}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(scanned.ok === true, "artifact scan failed");
    assert(scanned.bundle.status === "scanned", "artifact scan status mismatch");

    const risk = await request(`/api/goatmez/artifacts/${registered.bundle.id}/risk`);
    assert(risk.ok === true, "artifact risk summary failed");
    assert(risk.counts && risk.counts.excluded > 0, "artifact risk summary should include exclusions");

    const ingested = await request(`/api/goatmez/artifacts/${registered.bundle.id}/ingest-docs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(ingested.ok === true, "artifact doc ingestion failed");
    assert(ingested.result && ingested.result.ingested > 0, "artifact doc ingestion should import at least one safe doc");

    const artifactKnowledge = await request("/api/goatmez/knowledge/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "artifact quarantined documentation", mode: "hybrid", limit: 5 })
    });
    assert(artifactKnowledge.ok === true, "artifact knowledge search failed");
    assert(Array.isArray(artifactKnowledge.results), "artifact knowledge results missing");
    assert(artifactKnowledge.results.length > 0, "artifact knowledge search should find imported docs");

    artifactSummary = {
      skipped: false,
      bundleId: registered.bundle.id,
      entries: registered.bundle.entries.length,
      nestedEntries: registered.bundle.nestedEntries.length,
      excluded: risk.counts.excluded,
      ingested: ingested.result.ingested,
      redactions: ingested.result.redactionCount
    };
  }

  const sessions = await request("/api/goatmez/sessions");
  assert(Array.isArray(sessions), "sessions must be an array");
  if (sessions.length > 0 && sessions[0]?.id) {
    const replay = await request(`/api/goatmez/sessions/${sessions[0].id}/replay-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    assert(replay.ok === true, "session replay summary failed");
    const timeline = await request(`/api/goatmez/sessions/${sessions[0].id}/timeline`);
    assert(timeline.ok === true, "session timeline failed");
    assert(Array.isArray(timeline.events), "session timeline events missing");
    const exported = await request(`/api/goatmez/sessions/${sessions[0].id}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    assert(exported.ok === true, "session export failed");
  }

  const approvals = await request("/api/goatmez/approvals?status=pending");
  assert(approvals.ok === true, "approvals endpoint must be ok");
  assert(Array.isArray(approvals.approvals), "approvals list missing");
  if (approvals.approvals.length > 0 && approvals.approvals[0]?.id) {
    const approvalId = approvals.approvals[0].id;
    const approved = await request(`/api/goatmez/approvals/${approvalId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(approved.ok === true, "approve action failed");
    const rejected = await request(`/api/goatmez/approvals/${approvalId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
    assert(rejected.ok === true, "reject action failed");
  }

  console.log("[goatmez-validate] ok");
  console.log(
    JSON.stringify(
      {
        healthState: health.state,
        queue: observability.queue,
        readinessVerdict: readiness.verdict,
        connectorSummary: observability.connectors,
        mcpSummary: diagnostics.mcp,
        mcpExplorerServers: mcpExplorer.servers.length,
        queueMetrics: metrics.queue,
        connectorDiagnostics: connectorDiagnostics.connectors.length,
        connectorMatrixAgents: connectorMatrix.agents,
        activityCount: activity.items.length,
        plugins: pluginRegistry.total,
        enabledPluginHooks: pluginHooks.enabledHooks.length,
        models: modelRegistry.total,
        agents: agents.agents.length,
        permissionRules: permissionRules.length,
        runSummaryStatus: runSummary.summary.status,
        commandPreviewRisk: commandPreview.risk,
        permissionSummary: permissionDiagnostics.decisionSummary,
        simulationCount: simulation.evaluatedCount,
        conflictRules: conflicts.rules.length,
        knowledgeResults: knowledge.results.length,
        artifactSummary
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[goatmez-validate] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
