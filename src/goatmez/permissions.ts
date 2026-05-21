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

export function evaluatePermissionRule(
  rules: GoatmezPermissionRule[],
  toolName: string
): { matched: boolean; decision: "allow" | "approval" | "deny" | "none"; reason: string; rule?: GoatmezPermissionRule } {
  const enabledRules = rules.filter((rule) => rule.enabled);
  const match = enabledRules
    .filter((rule) => matches(rule.pattern, toolName))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];
  if (!match) return { matched: false, decision: "none", reason: "No rule matched." };
  return {
    matched: true,
    decision: match.decision,
    reason: `Matched '${match.pattern}' => ${match.decision}.`,
    rule: match
  };
}
