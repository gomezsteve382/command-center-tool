import type {
  GoatmezCommandPreview,
  GoatmezOperatorRunSummary,
  GoatmezRunResult
} from "./types.js";

function previewLines(text: string, limit = 8): string[] {
  return text
    .split(/\r?\n/g)
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .slice(0, limit);
}

export function summarizeRunResult(result: GoatmezRunResult): GoatmezOperatorRunSummary {
  const pending = result.approvals.filter((approval) => approval.status === "pending").length;
  const nextActions: string[] = [];

  if (pending > 0) {
    nextActions.push("Review pending approvals before any live connector execution.");
  }
  if (result.mission.status === "blocked") {
    nextActions.push("Inspect approval or policy blockers, then rerun the mission after resolving them.");
  }
  if (result.mission.status === "failed") {
    nextActions.push("Review the mission error and retry with a narrower instruction.");
  }
  if (!nextActions.length) {
    nextActions.push("No operator action required.");
  }

  return {
    ok: result.mission.status === "done",
    status: result.mission.status,
    message: result.mission.message,
    missionId: result.mission.id,
    taskId: result.task.id,
    sessionId: result.session.id,
    planner: result.mission.planner,
    approvals: {
      total: result.approvals.length,
      pending
    },
    toolCalls: result.session.toolCalls,
    outputPreview: previewLines(result.output),
    nextActions
  };
}

export function formatRunSummary(summary: GoatmezOperatorRunSummary): string {
  const lines: string[] = [
    "Goatmez Mission Summary",
    `status: ${summary.status}`,
    `mission: ${summary.missionId}`,
    `session: ${summary.sessionId}`,
    `planner: ${summary.planner}`,
    `approvals: ${summary.approvals.pending} pending / ${summary.approvals.total} total`,
    `tool calls: ${summary.toolCalls}`,
    "",
    "output preview:"
  ];

  for (const line of summary.outputPreview) {
    lines.push(`  ${line}`);
  }

  lines.push("", "next:");
  for (const action of summary.nextActions) {
    lines.push(`  ${action}`);
  }

  return lines.join("\n");
}

export function previewCommand(command: string): GoatmezCommandPreview {
  const normalized = command.trim();
  const reasons: string[] = [];
  let risk: GoatmezCommandPreview["risk"] = "medium";
  let classification = "operator-command";

  if (!normalized) {
    return {
      ok: false,
      command: normalized,
      blocked: true,
      risk: "high",
      classification: "empty-command",
      reasons: ["command is required"],
      preview: "No command supplied."
    };
  }

  const lower = normalized.toLowerCase();
  const destructivePatterns = [
    /\brm\s+-[^\n]*[rf]/i,
    /\bremove-item\b/i,
    /\bgit\s+reset\s+--hard\b/i,
    /\bgit\s+clean\s+-[^\n]*[fdx]/i,
    /\bformat-volume\b/i,
    /\bdel\s+\/[sq]\b/i,
    /\brmdir\s+\/s\b/i
  ];
  const writePatterns = [
    /\bset-content\b/i,
    /\bout-file\b/i,
    /(^|[^=])>>?([^&]|$)/,
    /\bcurl\b[^\n]*\s-x\s+(post|put|patch|delete)\b/i,
    /\binvoke-restmethod\b[^\n]*-method\s+(post|put|patch|delete)\b/i
  ];
  const readOnlyPrefixes = [
    "git status",
    "git diff",
    "rg ",
    "get-content ",
    "get-childitem ",
    "npm run typecheck",
    "npm run validate",
    "npm run test",
    "invoke-restmethod -uri",
    "curl http"
  ];

  if (destructivePatterns.some((pattern) => pattern.test(normalized))) {
    risk = "high";
    classification = "destructive-command";
    reasons.push("matches a destructive filesystem or git cleanup pattern");
  } else if (writePatterns.some((pattern) => pattern.test(normalized))) {
    risk = "high";
    classification = "state-changing-command";
    reasons.push("appears to write files or call a mutating HTTP method");
  } else if (readOnlyPrefixes.some((prefix) => lower.startsWith(prefix))) {
    risk = "low";
    classification = "read-or-validation-command";
    reasons.push("matches known read-only or validation command shape");
  } else {
    reasons.push("command is not recognized as read-only; review before execution");
  }

  return {
    ok: true,
    command: normalized,
    blocked: risk === "high",
    risk,
    classification,
    reasons,
    preview: normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized
  };
}

export function formatCommandPreview(preview: GoatmezCommandPreview): string {
  return [
    "Goatmez Command Preview",
    `blocked: ${preview.blocked}`,
    `risk: ${preview.risk}`,
    `classification: ${preview.classification}`,
    `command: ${preview.preview}`,
    "reasons:",
    ...preview.reasons.map((reason) => `  ${reason}`)
  ].join("\n");
}
