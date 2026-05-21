import { readFileSync } from "fs";
import { basename, resolve } from "path";
import { getGoatmezConfig, readConnectorProfiles } from "./config.js";
import { importLegacyGoatmezData, getGoatmezConfigCompatibility } from "./compat.js";
import { getGoatmezConflictRules } from "./conflicts.js";
import { getMcpDiagnostics } from "./diagnostics.js";
import { goatmezId } from "./id.js";
import { ingestKnowledgeText, searchKnowledge } from "./knowledge.js";
import {
  ensureDefaultPermissionRules,
  evaluatePermissionRule,
  permissionRuleDiagnostics,
  simulatePermissionRules,
  validatePermissionPattern
} from "./permissions.js";
import { GoatmezStateStore, GoatmezVaultStore, emptyGoatmezState } from "./storage.js";
import type {
  GoatmezApprovalRecord,
  GoatmezConnectorProfile,
  GoatmezMissionRecord,
  GoatmezPermissionRule,
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
    knowledgeChunks: state.knowledgeChunks.length
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

  getSessionById(sessionId: string): GoatmezSessionRecord | null {
    const state = this.ensureState();
    return state.sessions.find((session) => session.id === sessionId) || null;
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
      vault: {
        configured: this.vault.configured,
        secrets: this.vaultStore.read().secrets.length
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
      }
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
