import { readFileSync } from "fs";
import { basename, resolve } from "path";
import { agentCapabilityMatrix, ensureDefaultAgents } from "./agents.js";
import { getGoatmezConfig, readConnectorProfiles } from "./config.js";
import { importLegacyGoatmezData, getGoatmezConfigCompatibility } from "./compat.js";
import { getGoatmezConflictRules } from "./conflicts.js";
import { getMcpDiagnostics, getMcpExplorer } from "./diagnostics.js";
import { goatmezId } from "./id.js";
import { ingestKnowledgeText, searchKnowledge } from "./knowledge.js";
import { ensureDefaultModels, modelRegistrySnapshot } from "./models.js";
import { previewCommand, summarizeRunResult } from "./operatorUx.js";
import {
  ensureDefaultPermissionRules,
  evaluatePermissionRule,
  permissionRuleDiagnostics,
  simulatePermissionRules,
  validatePermissionPattern
} from "./permissions.js";
import { checkPluginHook, ensureDefaultPlugins, pluginHookSnapshot, pluginRegistrySnapshot } from "./plugins.js";
import { buildSessionTimeline } from "./sessions.js";
import { GoatmezStateStore, GoatmezVaultStore, emptyGoatmezState } from "./storage.js";
import type {
  GoatmezApprovalRecord,
  GoatmezApprovalStatus,
  GoatmezAgentProfile,
  GoatmezConnectorProfile,
  GoatmezCommandPreview,
  GoatmezMissionRecord,
  GoatmezModelProfile,
  GoatmezOperatorRunSummary,
  GoatmezPermissionRule,
  GoatmezPluginRecord,
  GoatmezRunInput,
  GoatmezRunResult,
  GoatmezSessionRecord,
  GoatmezTaskRecord,
  GoatmezStateSchema
} from "./types.js";
import { GoatmezVault } from "./vault.js";

function statusFromText(message: string): "blocked" | "failed" | "done" {
  if (message.includes("blocked") || message.includes("approval")) return "blocked";
  if (message.includes("failed") || message.includes("error")) return "failed";
  return "done";
}

function safeReadWorkspace(root: string): { path: string; preview: string }[] {
  const entries = ["README.md", "package.json", "tsconfig.json"]
    .map((name) => resolve(root, name))
    .filter((path) => {
      try { readFileSync(path, "utf8"); return true; } catch { return false; }
    });
  return entries.map((path) => {
    const text = readFileSync(path, "utf8");
    return { path: basename(path), preview: text.slice(0, 240) };
  });
}

function summarizeState(state: GoatmezStateSchema): Record<string, unknown> {
  return {
    tasks: state.tasks.length,
    missions: state.missions.length,
    approvals: state.approvals.length,
    sessions: state.sessions.length,
    knowledgeDocuments: state.knowledgeDocuments.length,
    knowledgeChunks: state.knowledgeChunks.length,
    plugins: state.plugins.length,
    models: state.models.length,
    agents: state.agents.length
  };
}

function formatMissionOutput(input: {
  message: string;
  workspacePreview: { path: string; preview: string }[];
  knowledgeHits: ReturnType<typeof searchKnowledge>;
  connectors: ReturnType<typeof readConnectorProfiles>;
}): string {
  const lines: string[] = [];
  lines.push(`Mission: ${input.message}`);
  lines.push("Status: done");
  lines.push("");
  lines.push("Workspace Preview:");
  for (const item of input.workspacePreview.slice(0, 3)) {
    lines.push(`- ${item.path}: ${item.preview.replace(/\s+/g, " ").slice(0, 120)}`);
  }
  lines.push("");
  lines.push("Knowledge:");
  if (!input.knowledgeHits.length) lines.push("- No matching knowledge chunks yet.");
  for (const hit of input.knowledgeHits.slice(0, 3)) {
    lines.push(`- ${hit.document.title} #${hit.chunk.index + 1} (score ${hit.score.toFixed(3)})`);
  }
  lines.push("");
  lines.push("Connector Readiness:");
  for (const connector of input.connectors) {
    lines.push(`- ${connector.id}: ${connector.enabled ? "enabled" : "disabled"} | secrets ${connector.requiredSecrets.length}`);
  }
  return lines.join("\n");
}

export class GoatmezRuntime {
  readonly config = getGoatmezConfig();
  readonly stateStore = new GoatmezStateStore(this.config.statePath);
  readonly vaultStore = new GoatmezVaultStore(this.config.vaultPath);
  readonly vault = new GoatmezVault(this.vaultStore, this.config.vaultKey);
  private legacyImportChecked = false;

  private ensureState(): GoatmezStateSchema {
    const state = this.stateStore.read();
    if (!this.legacyImportChecked && process.env.GOATMEZ_IMPORT_LEGACY !== "false") {
      const migration = importLegacyGoatmezData(this.config, state);
      this.legacyImportChecked = true;
      if (migration.imported) {
        this.stateStore.write(state);
      }
    }
    state.permissionRules = ensureDefaultPermissionRules(state.permissionRules);
    state.plugins = ensureDefaultPlugins(state.plugins);
    state.models = ensureDefaultModels(state.models);
    state.agents = ensureDefaultAgents(state.agents);
    this.stateStore.write(state);
    return state;
  }

  readState(): GoatmezStateSchema {
    return this.ensureState();
  }

  run(input: GoatmezRunInput): GoatmezRunResult {
    const message = input.message.trim() || "inspect this workspace";
    const state = this.ensureState();
    const now = new Date().toISOString();
    const task: GoatmezTaskRecord = {
      id: goatmezId("task"),
      title: message,
      status: "running",
      notes: [`planner=${this.config.plannerProvider}`],
      createdAt: now,
      updatedAt: now
    };
    const mission: GoatmezMissionRecord = {
      id: goatmezId("msn"),
      sessionId: goatmezId("sesskey"),
      message,
      status: "running",
      planner: this.config.plannerProvider,
      taskId: task.id,
      createdAt: now,
      updatedAt: now
    };
    state.tasks = [task, ...state.tasks];
    state.missions = [mission, ...state.missions];

    const workspacePreview = safeReadWorkspace(this.config.workspaceRoot);
    const knowledgeHits = searchKnowledge(state, { query: message, limit: 3, mode: "hybrid" });
    const connectors = readConnectorProfiles(this.config);
    const output = formatMissionOutput({ message, workspacePreview, knowledgeHits, connectors });
    const status = statusFromText(output);

    const approvals: GoatmezApprovalRecord[] = [];
    const permission = evaluatePermissionRule(state.permissionRules, "connector.http.request");
    if (permission.decision === "approval") {
      const approval: GoatmezApprovalRecord = {
        id: goatmezId("appr"),
        missionId: mission.id,
        toolName: "connector.http.request",
        reason: permission.reason,
        status: "pending",
        input: { dryRun: true, note: "auto-created by mission planner" },
        createdAt: now,
        updatedAt: now
      };
      approvals.push(approval);
      state.approvals = [approval, ...state.approvals];
    }

    mission.status = status;
    mission.result = output;
    mission.updatedAt = new Date().toISOString();
    task.status = status === "blocked" ? "blocked" : status === "failed" ? "failed" : "done";
    task.notes = [...task.notes, output.slice(0, 300)];
    task.updatedAt = new Date().toISOString();
    const session: GoatmezSessionRecord = {
      id: mission.sessionId,
      missionId: mission.id,
      message,
      status: mission.status,
      summary: output.slice(0, 800),
      toolCalls: 1,
      approvals: approvals.length,
      createdAt: now,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString()
    };
    state.sessions = [session, ...state.sessions];
    this.stateStore.write(state);

    return { mission, task, session, approvals, output };
  }

  runWithSummary(input: GoatmezRunInput): { result: GoatmezRunResult; summary: GoatmezOperatorRunSummary } {
    const result = this.run(input);
    return {
      result,
      summary: summarizeRunResult(result)
    };
  }

  previewCommand(command: string): GoatmezCommandPreview {
    return previewCommand(command);
  }

  addKnowledgeText(input: { title: string; text: string; tags?: string[]; source?: string }): { documentId: string; chunks: number } {
    const state = this.ensureState();
    const result = ingestKnowledgeText(state, input);
    this.stateStore.write(state);
    return { documentId: result.document.id, chunks: result.chunks.length };
  }

  searchKnowledge(query: string, mode: "keyword" | "vector" | "hybrid" = "hybrid", limit = 10) {
    const state = this.ensureState();
    return searchKnowledge(state, { query, mode, limit });
  }

  listPermissionRules(): GoatmezPermissionRule[] {
    return this.ensureState().permissionRules.sort((a, b) => a.pattern.localeCompare(b.pattern));
  }

  createPermissionRule(input: { pattern: string; decision: "allow" | "approval" | "deny"; description?: string; enabled?: boolean }): GoatmezPermissionRule {
    const pattern = validatePermissionPattern(input.pattern);
    const state = this.ensureState();
    const now = new Date().toISOString();
    const rule: GoatmezPermissionRule = {
      id: goatmezId("rule"),
      pattern,
      decision: input.decision,
      description: input.description?.trim() || "Custom operator rule",
      enabled: input.enabled !== false,
      createdAt: now,
      updatedAt: now
    };
    state.permissionRules = [rule, ...state.permissionRules.filter((item) => item.id !== rule.id)];
    this.stateStore.write(state);
    return rule;
  }

  deletePermissionRule(id: string): boolean {
    const state = this.ensureState();
    const before = state.permissionRules.length;
    state.permissionRules = state.permissionRules.filter((rule) => rule.id !== id);
    const deleted = before !== state.permissionRules.length;
    if (deleted) this.stateStore.write(state);
    return deleted;
  }

  setPermissionRuleEnabled(id: string, enabled: boolean): GoatmezPermissionRule | null {
    const state = this.ensureState();
    const rule = state.permissionRules.find((item) => item.id === id);
    if (!rule) return null;
    rule.enabled = enabled;
    rule.updatedAt = new Date().toISOString();
    this.stateStore.write(state);
    return rule;
  }

  dryRunPermission(agentId: string, toolName: string): Record<string, unknown> {
    const state = this.ensureState();
    return {
      agentId,
      toolName,
      rule: evaluatePermissionRule(state.permissionRules, toolName)
    };
  }

  simulatePermissions(agentId: string, toolNames: string[]): Record<string, unknown> {
    const state = this.ensureState();
    return simulatePermissionRules(state.permissionRules, toolNames, agentId);
  }

  permissionDiagnostics(): Record<string, unknown> {
    const state = this.ensureState();
    return permissionRuleDiagnostics(state.permissionRules);
  }

  listPlugins(kind?: string): GoatmezPluginRecord[] {
    const state = this.ensureState();
    const plugins = kind
      ? state.plugins.filter((plugin) => plugin.kind === kind)
      : state.plugins;
    return plugins.sort((a, b) => a.name.localeCompare(b.name));
  }

  setPluginEnabled(id: string, enabled: boolean): GoatmezPluginRecord | null {
    const state = this.ensureState();
    const plugin = state.plugins.find((item) => item.id === id);
    if (!plugin) return null;
    plugin.enabled = enabled;
    plugin.updatedAt = new Date().toISOString();
    this.stateStore.write(state);
    return plugin;
  }

  pluginRegistrySnapshot(): Record<string, unknown> {
    const state = this.ensureState();
    return pluginRegistrySnapshot(state.plugins);
  }

  pluginHookSnapshot(): Record<string, unknown> {
    const state = this.ensureState();
    return pluginHookSnapshot(state.plugins);
  }

  checkPluginHook(hook: string): Record<string, unknown> {
    const state = this.ensureState();
    return checkPluginHook(state.plugins, hook);
  }

  listModels(provider?: string): GoatmezModelProfile[] {
    const state = this.ensureState();
    const models = provider
      ? state.models.filter((model) => model.provider === provider)
      : state.models;
    return [...models].sort((a, b) => a.name.localeCompare(b.name));
  }

  modelRegistrySnapshot(): Record<string, unknown> {
    const state = this.ensureState();
    return modelRegistrySnapshot(state.models);
  }

  verifyModelDryRun(modelId: string): Record<string, unknown> | null {
    const state = this.ensureState();
    const model = state.models.find((item) => item.id === modelId);
    if (!model) return null;
    const missingSecrets = model.requiredSecrets.filter((secretName) => !this.vault.resolve(secretName, model.provider));
    const endpointReady = !model.endpoint || model.endpoint.startsWith("${env:") || /^https?:\/\//i.test(model.endpoint);
    const failureReasons: string[] = [];
    if (!model.enabled) failureReasons.push("model-disabled");
    if (missingSecrets.length) failureReasons.push(`missing-secrets:${missingSecrets.join(",")}`);
    if (!endpointReady) failureReasons.push("invalid-endpoint");
    if (!failureReasons.length) failureReasons.push("none");
    return {
      ok: true,
      dryRun: true,
      modelId: model.id,
      provider: model.provider,
      ready: model.enabled && missingSecrets.length === 0 && endpointReady,
      missingSecrets,
      endpointReady,
      capabilities: model.capabilities,
      failureReasons
    };
  }

  listAgents(role?: string): GoatmezAgentProfile[] {
    const state = this.ensureState();
    const agents = role ? state.agents.filter((agent) => agent.role === role) : state.agents;
    return [...agents].sort((a, b) => a.id.localeCompare(b.id));
  }

  agentCapabilityMatrix(): Record<string, unknown> {
    const state = this.ensureState();
    const connectors = state.agents.flatMap((agent) =>
      this.connectorsStatus(agent.id).map((connector) => ({ ...connector, agentId: agent.id }))
    );
    return agentCapabilityMatrix({
      agents: state.agents,
      connectors,
      plugins: state.plugins,
      models: state.models
    });
  }

  getSessionById(sessionId: string): GoatmezSessionRecord | null {
    const state = this.ensureState();
    return state.sessions.find((session) => session.id === sessionId) || null;
  }

  listApprovals(status?: GoatmezApprovalStatus): GoatmezApprovalRecord[] {
    const state = this.ensureState();
    const approvals = status ? state.approvals.filter((item) => item.status === status) : state.approvals;
    return approvals.slice(0, 200);
  }

  setApprovalStatus(
    approvalId: string,
    status: Extract<GoatmezApprovalStatus, "approved" | "rejected" | "executed" | "failed">
  ): GoatmezApprovalRecord | null {
    const state = this.ensureState();
    const approval = state.approvals.find((item) => item.id === approvalId);
    if (!approval) return null;
    approval.status = status;
    approval.updatedAt = new Date().toISOString();
    this.stateStore.write(state);
    return approval;
  }

  replaySessionSummary(sessionId: string): Record<string, unknown> | null {
    const session = this.getSessionById(sessionId);
    if (!session) return null;
    const replaySafeId = `replay_${session.id}`;
    return {
      ok: true,
      replaySafeId,
      session: {
        id: session.id,
        missionId: session.missionId,
        status: session.status,
        message: session.message,
        summary: session.summary || "",
        toolCalls: session.toolCalls,
        approvals: session.approvals,
        completedAt: session.completedAt || null
      }
    };
  }

  sessionTimeline(sessionId: string): Record<string, unknown> | null {
    const state = this.ensureState();
    const session = state.sessions.find((item) => item.id === sessionId);
    if (!session) return null;
    const mission = state.missions.find((item) => item.id === session.missionId);
    const task = mission?.taskId ? state.tasks.find((item) => item.id === mission.taskId) : undefined;
    const approvals = state.approvals.filter((item) => item.missionId === session.missionId);
    const events = buildSessionTimeline({ session, mission, task, approvals });
    return {
      ok: true,
      replaySafeId: `timeline_${session.id}`,
      sessionId: session.id,
      missionId: session.missionId,
      eventCount: events.length,
      events
    };
  }

  exportSession(sessionId: string): Record<string, unknown> | null {
    const summary = this.replaySessionSummary(sessionId);
    const timeline = this.sessionTimeline(sessionId);
    if (!summary || !timeline) return null;
    return {
      ok: true,
      replaySafeId: `export_${sessionId}`,
      exportedAt: new Date().toISOString(),
      summary: summary.session,
      timeline
    };
  }

  observabilitySnapshot(): Record<string, unknown> {
    const state = this.ensureState();
    const connectors = readConnectorProfiles(this.config);
    const pendingApprovals = state.approvals.filter((approval) => approval.status === "pending").length;
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      plannerProvider: this.config.plannerProvider,
      dbDriver: this.config.dbDriver,
      storage: {
        statePath: this.config.statePath,
        vaultPath: this.config.vaultPath,
        ...summarizeState(state)
      },
      queue: {
        pendingApprovals,
        runningMissions: state.missions.filter((mission) => mission.status === "running").length,
        blockedMissions: state.missions.filter((mission) => mission.status === "blocked").length
      },
      connectors: {
        total: connectors.length,
        enabled: connectors.filter((connector) => connector.enabled).length
      },
      plugins: {
        total: state.plugins.length,
        enabled: state.plugins.filter((plugin) => plugin.enabled).length
      },
      models: {
        total: state.models.length,
        enabled: state.models.filter((model) => model.enabled).length
      },
      agents: {
        total: state.agents.length,
        enabled: state.agents.filter((agent) => agent.enabled).length
      },
      vault: {
        configured: this.vault.configured,
        secrets: this.vaultStore.read().secrets.length
      }
    };
  }

  readinessSnapshot(): Record<string, unknown> {
    const state = this.ensureState();
    const connectorRows = this.connectorsStatus();
    const mcp = getMcpDiagnostics(this.config);
    const permissionDiagnostics = permissionRuleDiagnostics(state.permissionRules);
    const modelRegistry = modelRegistrySnapshot(state.models);
    const pluginRegistry = pluginRegistrySnapshot(state.plugins);
    const pendingApprovals = state.approvals.filter((approval) => approval.status === "pending").length;
    const blockedMissions = state.missions.filter((mission) => mission.status === "blocked").length;
    const readyConnectors = connectorRows.filter((connector) => connector.ready).length;
    const enabledModels = state.models.filter((model) => model.enabled).length;
    const enabledAgents = state.agents.filter((agent) => agent.enabled).length;

    const blockers: string[] = [];
    if (pendingApprovals > 0) blockers.push(`pending-approvals:${pendingApprovals}`);
    if (blockedMissions > 0) blockers.push(`blocked-missions:${blockedMissions}`);
    if (readyConnectors === 0) blockers.push("no-ready-connectors");
    if (enabledModels === 0) blockers.push("no-enabled-models");
    if (enabledAgents === 0) blockers.push("no-enabled-agents");
    if ((mcp as { parseError?: unknown }).parseError) blockers.push("mcp-config-parse-error");

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      verdict: blockers.length ? "attention-required" : "ready",
      blockers,
      queue: {
        pendingApprovals,
        blockedMissions,
        runningMissions: state.missions.filter((mission) => mission.status === "running").length
      },
      connectors: {
        total: connectorRows.length,
        ready: readyConnectors,
        enabled: connectorRows.filter((connector) => connector.enabled).length
      },
      mcp,
      permissions: permissionDiagnostics,
      plugins: pluginRegistry,
      models: modelRegistry,
      agents: {
        total: state.agents.length,
        enabled: enabledAgents
      },
      knowledge: {
        documents: state.knowledgeDocuments.length,
        chunks: state.knowledgeChunks.length
      }
    };
  }

  private evaluateConnector(connector: GoatmezConnectorProfile, agentId = "operator"): Record<string, unknown> {
    const missing = connector.requiredSecrets.filter((secretName) => !this.vault.resolve(secretName, connector.id));
    const allowedForAgent = connector.allowedAgents.length === 0 || connector.allowedAgents.includes(agentId);
    const ready = connector.enabled && missing.length === 0;
    const failureReasons: string[] = [];
    if (!connector.enabled) failureReasons.push("connector-disabled");
    if (missing.length) failureReasons.push(`missing-secrets:${missing.join(",")}`);
    if (!allowedForAgent) failureReasons.push(`agent-not-allowed:${agentId}`);
    if (!failureReasons.length) failureReasons.push("none");
    return {
      id: connector.id,
      name: connector.name,
      type: connector.type,
      enabled: connector.enabled,
      ready,
      missingSecrets: missing,
      riskLevel: connector.riskLevel,
      allowedAgents: connector.allowedAgents,
      allowedForAgent,
      description: connector.description,
      failureReasons
    };
  }

  connectorsStatus(agentId = "operator"): Array<Record<string, unknown>> {
    const connectors = readConnectorProfiles(this.config);
    return connectors.map((connector) => this.evaluateConnector(connector, agentId));
  }

  connectorDiagnostics(connectorId: string, agentId = "operator"): Record<string, unknown> | null {
    const connectors = readConnectorProfiles(this.config);
    const connector = connectors.find((item) => item.id === connectorId);
    if (!connector) return null;
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      connector: this.evaluateConnector(connector, agentId),
      agentId
    };
  }

  verifyConnectorDryRun(connectorId: string, agentId = "operator"): Record<string, unknown> | null {
    const diagnostics = this.connectorDiagnostics(connectorId, agentId);
    if (!diagnostics) return null;
    const connector = diagnostics.connector as Record<string, unknown>;
    const ready = connector.ready === true;
    return {
      ok: true,
      connectorId,
      agentId,
      dryRun: true,
      verdict: ready ? "ready-for-execution-gate" : "blocked",
      details: diagnostics
    };
  }

  connectorVerificationMatrix(agentIds: string[]): Record<string, unknown> {
    const normalizedAgents = [...new Set(agentIds.map((item) => item.trim()).filter(Boolean))];
    const agents = normalizedAgents.length ? normalizedAgents : ["operator", "developer"];
    const matrix = agents.map((agentId) => ({
      agentId,
      connectors: this.connectorsStatus(agentId)
    }));
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      agents,
      matrix
    };
  }

  health(): Record<string, unknown> {
    const state = this.ensureState();
    return {
      ok: true,
      runtime: "goatmez-adapter-v1",
      plannerProvider: this.config.plannerProvider,
      workspaceRoot: this.config.workspaceRoot,
      state: summarizeState(state),
      vaultConfigured: this.vault.configured
    };
  }

  configCompatibility(): Record<string, unknown> {
    return getGoatmezConfigCompatibility(this.config);
  }

  conflictRules() {
    return getGoatmezConflictRules();
  }

  diagnosticsSnapshot(): Record<string, unknown> {
    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      mcp: getMcpDiagnostics(this.config),
      connectors: this.connectorsStatus(),
      observability: this.observabilitySnapshot()
    };
  }

  mcpExplorerSnapshot(): Record<string, unknown> {
    return getMcpExplorer(this.config);
  }

  metricsSnapshot(): Record<string, unknown> {
    const state = this.ensureState();
    const connectors = this.connectorsStatus();
    const sessionStatus = state.sessions.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    const approvalStatus = state.approvals.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
    const latestSessions = state.sessions
      .slice(0, 5)
      .map((session) => ({
        id: session.id,
        status: session.status,
        message: session.message.slice(0, 120),
        updatedAt: session.updatedAt
      }));

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      queue: {
        pendingApprovals: approvalStatus.pending || 0,
        runningMissions: state.missions.filter((mission) => mission.status === "running").length
      },
      sessions: {
        total: state.sessions.length,
        byStatus: sessionStatus,
        latest: latestSessions
      },
      approvals: {
        total: state.approvals.length,
        byStatus: approvalStatus
      },
      knowledge: {
        documents: state.knowledgeDocuments.length,
        chunks: state.knowledgeChunks.length
      },
      connectors: {
        total: connectors.length,
        ready: connectors.filter((item) => item.ready).length,
        enabled: connectors.filter((item) => item.enabled).length
      },
      plugins: {
        total: state.plugins.length,
        enabled: state.plugins.filter((plugin) => plugin.enabled).length,
        disabled: state.plugins.filter((plugin) => !plugin.enabled).length
      },
      models: {
        total: state.models.length,
        enabled: state.models.filter((model) => model.enabled).length,
        disabled: state.models.filter((model) => !model.enabled).length
      },
      agents: {
        total: state.agents.length,
        enabled: state.agents.filter((agent) => agent.enabled).length,
        autonomyLevels: state.agents.reduce<Record<string, number>>((acc, agent) => {
          acc[agent.autonomyLevel] = (acc[agent.autonomyLevel] || 0) + 1;
          return acc;
        }, {})
      }
    };
  }

  recentActivity(limit = 30): Record<string, unknown> {
    const state = this.ensureState();
    const rows: Array<Record<string, unknown>> = [];

    for (const session of state.sessions.slice(0, limit)) {
      rows.push({
        type: "session",
        id: session.id,
        status: session.status,
        message: session.message,
        timestamp: session.updatedAt
      });
    }
    for (const approval of state.approvals.slice(0, limit)) {
      rows.push({
        type: "approval",
        id: approval.id,
        status: approval.status,
        message: `${approval.toolName} (${approval.reason})`,
        timestamp: approval.updatedAt
      });
    }
    for (const mission of state.missions.slice(0, limit)) {
      rows.push({
        type: "mission",
        id: mission.id,
        status: mission.status,
        message: mission.message,
        timestamp: mission.updatedAt
      });
    }

    const sorted = rows
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
      .slice(0, Math.max(1, limit));

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      count: sorted.length,
      items: sorted
    };
  }

  importLegacyNow(): { imported: boolean; notes: string[] } {
    const state = this.ensureState();
    const result = importLegacyGoatmezData(this.config, state);
    this.legacyImportChecked = true;
    if (result.imported) {
      this.stateStore.write(state);
    }
    return result;
  }

  setSecret(input: { name: string; value: string; scope?: string; provider?: string }): Record<string, unknown> {
    const record = this.vault.set(input);
    return {
      id: record.id,
      name: record.name,
      scope: record.scope,
      provider: record.provider,
      updatedAt: record.updatedAt
    };
  }
}

let singleton: GoatmezRuntime | null = null;

export function getGoatmezRuntime(): GoatmezRuntime {
  if (!singleton) singleton = new GoatmezRuntime();
  return singleton;
}

export function resetGoatmezRuntimeForTests(): void {
  singleton = null;
}

export function bootstrapGoatmezState(): void {
  const runtime = getGoatmezRuntime();
  const state = runtime.readState();
  if (!state.knowledgeDocuments.length) {
    runtime.addKnowledgeText({
      title: "Goatmez Operator Notes",
      source: "bootstrap",
      tags: ["ops", "agent", "mcp"],
      text: [
        "Goatmez runs mission-based autonomous workflows with approval gates.",
        "Connector actions should be dry-run by default and reviewed before live execution.",
        "Knowledge search uses hybrid ranking over keyword and deterministic vectors."
      ].join("\n\n")
    });
  }
}
