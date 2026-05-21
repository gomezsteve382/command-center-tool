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
