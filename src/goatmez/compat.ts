import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { goatmezId } from "./id.js";
import type { GoatmezConfig } from "./config.js";
import type {
  GoatmezKnowledgeChunk,
  GoatmezKnowledgeDocument,
  GoatmezPermissionRule,
  GoatmezSessionRecord,
  GoatmezStateSchema
} from "./types.js";

interface EnvBinding {
  key: string;
  value: string;
  source: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

function getEnvBinding(primary: string, fallback?: string): EnvBinding {
  const primaryValue = process.env[primary];
  if (primaryValue && primaryValue.trim()) {
    return { key: primary, value: primaryValue.trim(), source: "direct" };
  }
  if (fallback) {
    const fallbackValue = process.env[fallback];
    if (fallbackValue && fallbackValue.trim()) {
      return { key: fallback, value: fallbackValue.trim(), source: `fallback:${primary}` };
    }
  }
  return { key: primary, value: "", source: "default" };
}

function normalizePermissionRule(value: unknown): GoatmezPermissionRule | null {
  if (!isRecord(value)) return null;
  const pattern = String(value.pattern ?? "").trim();
  const decisionRaw = String(value.decision ?? "").trim();
  const decision = decisionRaw === "allow" || decisionRaw === "approval" || decisionRaw === "deny"
    ? decisionRaw
    : "approval";
  if (!pattern) return null;
  const now = nowIso();
  return {
    id: String(value.id ?? goatmezId("rule")),
    pattern,
    decision,
    description: String(value.description ?? "Imported legacy permission rule"),
    enabled: value.enabled !== false,
    createdAt: String(value.createdAt ?? now),
    updatedAt: String(value.updatedAt ?? now)
  };
}

function normalizeSession(value: unknown): GoatmezSessionRecord | null {
  if (!isRecord(value)) return null;
  const message = String(value.message ?? "").trim();
  if (!message) return null;
  const now = nowIso();
  const statusRaw = String(value.status ?? "done");
  const status = statusRaw === "running" || statusRaw === "blocked" || statusRaw === "failed"
    ? statusRaw
    : "done";
  const missionId = String(value.missionId ?? `legacy_${String(value.id ?? goatmezId("msn"))}`);
  return {
    id: String(value.id ?? goatmezId("sesskey")),
    missionId,
    message,
    status,
    summary: String(value.summary ?? ""),
    error: value.error ? String(value.error) : undefined,
    toolCalls: Number(value.toolCalls ?? 0),
    approvals: Number(value.approvals ?? 0),
    createdAt: String(value.createdAt ?? now),
    updatedAt: String(value.updatedAt ?? now),
    completedAt: value.completedAt ? String(value.completedAt) : undefined
  };
}

function normalizeDocument(value: unknown): GoatmezKnowledgeDocument | null {
  if (!isRecord(value)) return null;
  const id = String(value.id ?? goatmezId("kbdoc"));
  const title = String(value.title ?? "").trim();
  if (!title) return null;
  const now = nowIso();
  return {
    id,
    title,
    source: String(value.source ?? "legacy"),
    tags: Array.isArray(value.tags) ? value.tags.map(String) : [],
    chunkCount: Number(value.chunkCount ?? 0),
    createdAt: String(value.createdAt ?? now),
    updatedAt: String(value.updatedAt ?? now)
  };
}

function normalizeChunk(value: unknown): GoatmezKnowledgeChunk | null {
  if (!isRecord(value)) return null;
  const text = String(value.text ?? "").trim();
  const documentId = String(value.documentId ?? "").trim();
  if (!text || !documentId) return null;
  return {
    id: String(value.id ?? goatmezId("kbchunk")),
    documentId,
    index: Number(value.index ?? 0),
    text,
    keywords: Array.isArray(value.keywords) ? value.keywords.map(String) : [],
    vector: Array.isArray(value.vector) ? value.vector.map(Number).filter((n) => Number.isFinite(n)) : []
  };
}

function mergeById<T extends { id: string }>(current: T[], incoming: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of current) map.set(item.id, item);
  for (const item of incoming) map.set(item.id, item);
  return [...map.values()];
}

export function getGoatmezConfigCompatibility(config: GoatmezConfig): Record<string, unknown> {
  const env = [
    getEnvBinding("GOATMEZ_WORKSPACE_ROOT", "WORK_DIR"),
    getEnvBinding("GOATMEZ_DB_PATH", "CODE_ENGINE_GOATMEZ_DB_PATH"),
    getEnvBinding("GOATMEZ_VAULT_PATH", "CODE_ENGINE_GOATMEZ_VAULT_PATH"),
    getEnvBinding("GOATMEZ_CONNECTORS_CONFIG", "CODE_ENGINE_GOATMEZ_CONNECTORS_CONFIG"),
    getEnvBinding("GOATMEZ_PLANNER_PROVIDER", "CODE_ENGINE_GOATMEZ_PLANNER_PROVIDER"),
    getEnvBinding("GOATMEZ_DB_DRIVER", "CODE_ENGINE_GOATMEZ_DB_DRIVER"),
    getEnvBinding("GOATMEZ_VAULT_KEY", "CODE_ENGINE_GOATMEZ_VAULT_KEY")
  ];
  const legacyPaths = [
    resolve(config.workspaceRoot, ".goatmez/database.json"),
    resolve(config.workspaceRoot, ".goatmez/knowledge.json"),
    resolve(config.workspaceRoot, ".goatmez/vault.json")
  ].map((path) => ({ path, exists: existsSync(path) }));

  return {
    workspaceRoot: config.workspaceRoot,
    statePath: config.statePath,
    vaultPath: config.vaultPath,
    connectorsPath: config.connectorsPath,
    env,
    legacyPaths
  };
}

export function importLegacyGoatmezData(
  config: GoatmezConfig,
  state: GoatmezStateSchema
): { imported: boolean; notes: string[] } {
  const notes: string[] = [];
  let imported = false;
  const now = nowIso();
  const legacyDatabasePath = resolve(config.workspaceRoot, ".goatmez/database.json");
  const legacyKnowledgePath = resolve(config.workspaceRoot, ".goatmez/knowledge.json");

  if (existsSync(legacyDatabasePath)) {
    const parsed = readJson(legacyDatabasePath);
    if (isRecord(parsed)) {
      const sessionsRaw = Array.isArray(parsed.sessions) ? parsed.sessions : [];
      const rulesRaw = Array.isArray(parsed.permissionRules) ? parsed.permissionRules : [];
      const incomingSessions = sessionsRaw.map(normalizeSession).filter((item): item is GoatmezSessionRecord => Boolean(item));
      const incomingRules = rulesRaw.map(normalizePermissionRule).filter((item): item is GoatmezPermissionRule => Boolean(item));
      if (incomingSessions.length) {
        state.sessions = mergeById(state.sessions, incomingSessions).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        imported = true;
        notes.push(`Imported ${incomingSessions.length} legacy sessions from ${legacyDatabasePath}.`);
      }
      if (incomingRules.length) {
        state.permissionRules = mergeById(state.permissionRules, incomingRules);
        imported = true;
        notes.push(`Imported ${incomingRules.length} legacy permission rules from ${legacyDatabasePath}.`);
      }
    }
  }

  if (existsSync(legacyKnowledgePath)) {
    const parsed = readJson(legacyKnowledgePath);
    if (isRecord(parsed)) {
      const docsRaw = Array.isArray(parsed.documents) ? parsed.documents : Array.isArray(parsed.knowledgeDocuments) ? parsed.knowledgeDocuments : [];
      const chunksRaw = Array.isArray(parsed.chunks) ? parsed.chunks : Array.isArray(parsed.knowledgeChunks) ? parsed.knowledgeChunks : [];
      const incomingDocs = docsRaw.map(normalizeDocument).filter((item): item is GoatmezKnowledgeDocument => Boolean(item));
      const incomingChunks = chunksRaw.map(normalizeChunk).filter((item): item is GoatmezKnowledgeChunk => Boolean(item));
      if (incomingDocs.length) {
        state.knowledgeDocuments = mergeById(state.knowledgeDocuments, incomingDocs);
        imported = true;
        notes.push(`Imported ${incomingDocs.length} legacy knowledge documents from ${legacyKnowledgePath}.`);
      }
      if (incomingChunks.length) {
        state.knowledgeChunks = mergeById(state.knowledgeChunks, incomingChunks);
        imported = true;
        notes.push(`Imported ${incomingChunks.length} legacy knowledge chunks from ${legacyKnowledgePath}.`);
      }
    }
  }

  if (imported) {
    state.updatedAt = now;
  } else {
    notes.push("No legacy Goatmez data found to import.");
  }

  return { imported, notes };
}
