export type GoatmezTaskStatus = "queued" | "running" | "blocked" | "done" | "failed";
export type GoatmezMissionStatus = "running" | "blocked" | "done" | "failed";
export type GoatmezApprovalStatus = "pending" | "approved" | "rejected" | "executed" | "failed";

export interface GoatmezTaskRecord {
  id: string;
  title: string;
  status: GoatmezTaskStatus;
  notes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GoatmezMissionRecord {
  id: string;
  sessionId: string;
  message: string;
  status: GoatmezMissionStatus;
  result?: string;
  error?: string;
  taskId?: string;
  planner: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoatmezApprovalRecord {
  id: string;
  missionId: string;
  toolName: string;
  reason: string;
  status: GoatmezApprovalStatus;
  input: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GoatmezSessionRecord {
  id: string;
  missionId: string;
  message: string;
  status: GoatmezMissionStatus;
  summary?: string;
  error?: string;
  toolCalls: number;
  approvals: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface GoatmezPermissionRule {
  id: string;
  pattern: string;
  decision: "allow" | "approval" | "deny";
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GoatmezKnowledgeChunk {
  id: string;
  documentId: string;
  index: number;
  text: string;
  keywords: string[];
  vector: number[];
}

export interface GoatmezKnowledgeDocument {
  id: string;
  title: string;
  source: string;
  tags: string[];
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface GoatmezSecretRecord {
  id: string;
  name: string;
  scope: string;
  provider?: string;
  encryptedValue: string;
  iv: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoatmezConnectorProfile {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  requiredSecrets: string[];
  allowedAgents: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  description: string;
}

export interface GoatmezPluginRecord {
  id: string;
  name: string;
  kind: "plugin" | "skill" | "adapter";
  enabled: boolean;
  source: string;
  toolHooks: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoatmezModelProfile {
  id: string;
  name: string;
  provider: "local" | "openai" | "custom";
  enabled: boolean;
  endpoint?: string;
  requiredSecrets: string[];
  capabilities: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface GoatmezAgentProfile {
  id: string;
  name: string;
  role: "operator" | "developer" | "researcher";
  enabled: boolean;
  autonomyLevel: "supervised" | "approval-gated" | "autonomous";
  allowedConnectors: string[];
  allowedPlugins: string[];
  allowedModels: string[];
  description: string;
  createdAt: string;
  updatedAt: string;
}

export type GoatmezArtifactEntryKind = "markdown" | "text" | "binary" | "archive" | "script" | "source" | "image" | "other";

export type GoatmezArtifactRisk =
  | "safe-doc"
  | "vehicle-security"
  | "binary-payload"
  | "source-archive"
  | "executable-script"
  | "decompiled-source"
  | "secret-material"
  | "patch-material"
  | "excluded";

export interface GoatmezArtifactEntry {
  id: string;
  path: string;
  nestedIn?: string;
  kind: GoatmezArtifactEntryKind;
  mimeType?: string;
  length: number;
  compressedLength: number;
  sha256?: string;
  compressionMethod?: number;
  allowedForIngestion: boolean;
  exclusionReason?: string;
  risks: GoatmezArtifactRisk[];
}

export interface GoatmezArtifactBundle {
  id: string;
  name: string;
  sourcePath: string;
  sha256: string;
  status: "registered" | "scanned" | "ingested" | "missing" | "failed";
  entries: GoatmezArtifactEntry[];
  nestedEntries: GoatmezArtifactEntry[];
  docCount: number;
  excludedCount: number;
  ingestedDocumentIds: string[];
  redactionCount: number;
  provenance: string;
  createdAt: string;
  updatedAt: string;
  lastScannedAt?: string;
  lastIngestedAt?: string;
  error?: string;
}

export interface GoatmezStateSchema {
  version: 1;
  updatedAt: string;
  tasks: GoatmezTaskRecord[];
  missions: GoatmezMissionRecord[];
  approvals: GoatmezApprovalRecord[];
  sessions: GoatmezSessionRecord[];
  permissionRules: GoatmezPermissionRule[];
  knowledgeDocuments: GoatmezKnowledgeDocument[];
  knowledgeChunks: GoatmezKnowledgeChunk[];
  plugins: GoatmezPluginRecord[];
  models: GoatmezModelProfile[];
  agents: GoatmezAgentProfile[];
  artifacts: GoatmezArtifactBundle[];
}

export interface GoatmezVaultSchema {
  version: 1;
  updatedAt: string;
  secrets: GoatmezSecretRecord[];
}

export interface GoatmezRunInput {
  message: string;
  dryRun?: boolean;
}

export interface GoatmezRunResult {
  mission: GoatmezMissionRecord;
  task: GoatmezTaskRecord;
  session: GoatmezSessionRecord;
  approvals: GoatmezApprovalRecord[];
  output: string;
}

export interface GoatmezOperatorRunSummary {
  ok: boolean;
  status: GoatmezMissionStatus;
  message: string;
  missionId: string;
  taskId: string;
  sessionId: string;
  planner: string;
  approvals: {
    total: number;
    pending: number;
  };
  toolCalls: number;
  outputPreview: string[];
  nextActions: string[];
}

export interface GoatmezCommandPreview {
  ok: boolean;
  command: string;
  blocked: boolean;
  risk: "low" | "medium" | "high";
  classification: string;
  reasons: string[];
  preview: string;
}

export interface GoatmezSessionTimelineEvent {
  id: string;
  type: string;
  status: string;
  title: string;
  timestamp: string;
  details: Record<string, unknown>;
}
