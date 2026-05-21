import { goatmezId } from "./id.js";
import type { GoatmezPermissionRule } from "./types.js";

const defaultRules: Array<Omit<GoatmezPermissionRule, "id" | "createdAt" | "updatedAt">> = [
  { pattern: "workspace.*", decision: "allow", description: "Workspace read tools are safe by default.", enabled: true },
  { pattern: "kb.*", decision: "allow", description: "Knowledge search is local read-only behavior.", enabled: true },
  { pattern: "connector.*", decision: "approval", description: "Connector actions require approval.", enabled: true },
  { pattern: "shell.*", decision: "approval", description: "Shell access requires approval.", enabled: true },
  { pattern: "vault.*", decision: "approval", description: "Vault mutation requires approval.", enabled: true }
];

export function validatePermissionPattern(pattern: string): string {
  const clean = pattern.trim();
  if (!clean) throw new Error("pattern is required");
  if (!/^[a-zA-Z0-9_.:-]+(?:\*)?$/.test(clean)) {
    throw new Error("pattern may include letters, numbers, dot, underscore, colon, dash, and optional trailing *");
  }
  const stars = [...clean].filter((char) => char === "*").length;
  if (stars > 1 || (stars === 1 && !clean.endsWith("*"))) {
    throw new Error("wildcard can appear only once and only at the end");
  }
  return clean;
}

export function ensureDefaultPermissionRules(
  current: GoatmezPermissionRule[]
): GoatmezPermissionRule[] {
  if (current.length) return current;
  const now = new Date().toISOString();
  return defaultRules.map((rule) => ({
    ...rule,
    id: goatmezId("rule"),
    createdAt: now,
    updatedAt: now
  }));
}

function matches(pattern: string, toolName: string): boolean {
  if (pattern.endsWith("*")) return toolName.startsWith(pattern.slice(0, -1));
  return pattern === toolName;
}

function getEnabledRules(rules: GoatmezPermissionRule[]): GoatmezPermissionRule[] {
  return rules.filter((rule) => rule.enabled);
}

function getSortedMatches(rules: GoatmezPermissionRule[], toolName: string): GoatmezPermissionRule[] {
  return rules
    .filter((rule) => matches(rule.pattern, toolName))
    .sort((a, b) => b.pattern.length - a.pattern.length);
}

export function evaluatePermissionRule(
  rules: GoatmezPermissionRule[],
  toolName: string
): { matched: boolean; decision: "allow" | "approval" | "deny" | "none"; reason: string; rule?: GoatmezPermissionRule } {
  const enabledRules = getEnabledRules(rules);
  const match = getSortedMatches(enabledRules, toolName)[0];
  if (!match) return { matched: false, decision: "none", reason: "No rule matched." };
  return {
    matched: true,
    decision: match.decision,
    reason: `Matched '${match.pattern}' => ${match.decision}.`,
    rule: match
  };
}

export function simulatePermissionRules(
  rules: GoatmezPermissionRule[],
  toolNames: string[],
  agentId = "operator"
): Record<string, unknown> {
  const normalizedTools = [...new Set(toolNames.map((item) => item.trim()).filter(Boolean))];
  const rows = normalizedTools.map((toolName) => {
    const evaluation = evaluatePermissionRule(rules, toolName);
    const matchedRules = getSortedMatches(getEnabledRules(rules), toolName);
    return {
      agentId,
      toolName,
      decision: evaluation.decision,
      matched: evaluation.matched,
      reason: evaluation.reason,
      selectedRule: evaluation.rule
        ? {
            id: evaluation.rule.id,
            pattern: evaluation.rule.pattern,
            decision: evaluation.rule.decision
          }
        : null,
      matchedRuleCount: matchedRules.length
    };
  });
  const summary = rows.reduce<Record<string, number>>((acc, row) => {
    const key = String(row.decision);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  return {
    ok: true,
    agentId,
    evaluatedCount: rows.length,
    summary,
    rows
  };
}

export function permissionRuleDiagnostics(rules: GoatmezPermissionRule[]): Record<string, unknown> {
  const enabledRules = getEnabledRules(rules);
  const wildcardRules = enabledRules.filter((rule) => rule.pattern.endsWith("*"));
  const exactRules = enabledRules.filter((rule) => !rule.pattern.endsWith("*"));
  const patternCounts = new Map<string, number>();
  for (const rule of enabledRules) {
    patternCounts.set(rule.pattern, (patternCounts.get(rule.pattern) || 0) + 1);
  }

  const duplicatePatterns = [...patternCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([pattern, count]) => ({ pattern, count }));

  const overlapHints: Array<Record<string, string>> = [];
  for (let i = 0; i < wildcardRules.length; i += 1) {
    for (let j = i + 1; j < wildcardRules.length; j += 1) {
      const a = wildcardRules[i];
      const b = wildcardRules[j];
      const prefixA = a.pattern.slice(0, -1);
      const prefixB = b.pattern.slice(0, -1);
      if (prefixA.startsWith(prefixB) || prefixB.startsWith(prefixA)) {
        overlapHints.push({
          broader: prefixA.length < prefixB.length ? a.pattern : b.pattern,
          narrower: prefixA.length < prefixB.length ? b.pattern : a.pattern
        });
      }
    }
  }

  const decisionSummary = enabledRules.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.decision] = (acc[rule.decision] || 0) + 1;
    return acc;
  }, {});

  return {
    ok: true,
    totalRules: rules.length,
    enabledRules: enabledRules.length,
    disabledRules: rules.length - enabledRules.length,
    wildcardRules: wildcardRules.length,
    exactRules: exactRules.length,
    duplicatePatterns,
    overlapHints,
    decisionSummary
  };
}
