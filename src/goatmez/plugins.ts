import { goatmezId } from "./id.js";
import type { GoatmezPluginRecord } from "./types.js";

const defaultPlugins: Array<Omit<GoatmezPluginRecord, "id" | "createdAt" | "updatedAt">> = [
  {
    name: "Knowledge Base",
    kind: "skill",
    enabled: true,
    source: "goatmez-core",
    toolHooks: ["kb.search", "kb.ingestText"],
    description: "Local knowledge ingestion and hybrid search for mission context."
  },
  {
    name: "Connector Diagnostics",
    kind: "adapter",
    enabled: true,
    source: "goatmez-core",
    toolHooks: ["connector.health", "connector.verifyDryRun"],
    description: "Readiness checks, failure reasons, and dry-run verification for external connectors."
  },
  {
    name: "Permission Rules",
    kind: "plugin",
    enabled: true,
    source: "goatmez-core",
    toolHooks: ["permission.dryRun", "permission.simulate"],
    description: "Wildcard-aware approval, allow, and deny policy controls."
  },
  {
    name: "Session History",
    kind: "skill",
    enabled: true,
    source: "goatmez-core",
    toolHooks: ["session.search", "session.replaySummary"],
    description: "Searchable mission timeline with replay-safe session summaries."
  }
];

function normalizePluginName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeDefaultPlugin(input: Omit<GoatmezPluginRecord, "id" | "createdAt" | "updatedAt">, now: string): GoatmezPluginRecord {
  return {
    ...input,
    id: `plug_${normalizePluginName(input.name) || goatmezId("plug")}`,
    createdAt: now,
    updatedAt: now
  };
}

export function ensureDefaultPlugins(current: GoatmezPluginRecord[] = []): GoatmezPluginRecord[] {
  const now = new Date().toISOString();
  const byName = new Map(current.map((plugin) => [plugin.name.toLowerCase(), plugin]));
  const merged = [...current];

  for (const plugin of defaultPlugins) {
    if (!byName.has(plugin.name.toLowerCase())) {
      merged.push(makeDefaultPlugin(plugin, now));
    }
  }

  return merged;
}

export function pluginRegistrySnapshot(plugins: GoatmezPluginRecord[]): Record<string, unknown> {
  const byKind = plugins.reduce<Record<string, number>>((acc, plugin) => {
    acc[plugin.kind] = (acc[plugin.kind] || 0) + 1;
    return acc;
  }, {});
  const toolHooks = new Set(plugins.flatMap((plugin) => plugin.toolHooks));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    total: plugins.length,
    enabled: plugins.filter((plugin) => plugin.enabled).length,
    disabled: plugins.filter((plugin) => !plugin.enabled).length,
    byKind,
    toolHooks: [...toolHooks].sort()
  };
}
