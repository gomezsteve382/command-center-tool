export interface GoatmezConflictRule {
  concept: "permissions" | "tools" | "sessions" | "approvals" | "connectors";
  canonicalOwner: "code-engine-primary";
  goatmezRole: "adapter" | "namespace";
  translationStrategy: string;
  notes: string;
}

const RULES: GoatmezConflictRule[] = [
  {
    concept: "permissions",
    canonicalOwner: "code-engine-primary",
    goatmezRole: "adapter",
    translationStrategy: "Goatmez wildcard rules are evaluated in Goatmez runtime, then surfaced as advisory decisions to the primary control plane.",
    notes: "Primary app policy is authoritative for final execution."
  },
  {
    concept: "tools",
    canonicalOwner: "code-engine-primary",
    goatmezRole: "namespace",
    translationStrategy: "Goatmez tools remain namespaced under /api/goatmez/* and do not override existing primary tool routes.",
    notes: "Pass 1 avoids endpoint collisions."
  },
  {
    concept: "sessions",
    canonicalOwner: "code-engine-primary",
    goatmezRole: "adapter",
    translationStrategy: "Goatmez mission sessions are persisted in Goatmez state with stable IDs and can be mapped into primary timeline records by adapter.",
    notes: "Schema translation is explicit and reversible."
  },
  {
    concept: "approvals",
    canonicalOwner: "code-engine-primary",
    goatmezRole: "adapter",
    translationStrategy: "Goatmez approvals are generated as pending records and can be bridged to primary approval UX without sharing mutable in-memory state.",
    notes: "No implicit cross-runtime approval mutation."
  },
  {
    concept: "connectors",
    canonicalOwner: "code-engine-primary",
    goatmezRole: "namespace",
    translationStrategy: "Connector readiness is evaluated in Goatmez namespace using vault-backed checks and exported as read-only status snapshots.",
    notes: "Live connector actions remain approval-gated."
  }
];

export function getGoatmezConflictRules(): GoatmezConflictRule[] {
  return RULES.slice();
}
