import { goatmezId } from "./id.js";
import type {
  GoatmezAgentProfile,
  GoatmezModelProfile,
  GoatmezPluginRecord
} from "./types.js";

const defaultAgents: Array<Omit<GoatmezAgentProfile, "createdAt" | "updatedAt">> = [
  {
    id: "operator",
    name: "Operator",
    role: "operator",
    enabled: true,
    autonomyLevel: "approval-gated",
    allowedConnectors: ["openai", "gmail"],
    allowedPlugins: ["*"],
    allowedModels: ["model_local-custom-llm", "model_openai-responses"],
    description: "Human-facing operator agent for supervised business workflows."
  },
  {
    id: "developer",
    name: "Developer",
    role: "developer",
    enabled: true,
    autonomyLevel: "approval-gated",
    allowedConnectors: ["openai"],
    allowedPlugins: ["plug_knowledge-base", "plug_permission-rules", "plug_session-history"],
    allowedModels: ["model_local-custom-llm", "model_openai-responses", "model_custom-http-model"],
    description: "Build and diagnostics agent for code, tools, and validation."
  },
  {
    id: "researcher",
    name: "Researcher",
    role: "researcher",
    enabled: true,
    autonomyLevel: "supervised",
    allowedConnectors: [],
    allowedPlugins: ["plug_knowledge-base", "plug_session-history"],
    allowedModels: ["model_local-custom-llm"],
    description: "Read-only research agent for local knowledge and summaries."
  }
];

function makeDefaultAgent(input: Omit<GoatmezAgentProfile, "createdAt" | "updatedAt">, now: string): GoatmezAgentProfile {
  return {
    ...input,
    id: input.id || goatmezId("agent"),
    createdAt: now,
    updatedAt: now
  };
}

export function ensureDefaultAgents(current: GoatmezAgentProfile[] = []): GoatmezAgentProfile[] {
  const now = new Date().toISOString();
  const byId = new Map(current.map((agent) => [agent.id, agent]));
  const merged = [...current];

  for (const agent of defaultAgents) {
    if (!byId.has(agent.id)) {
      merged.push(makeDefaultAgent(agent, now));
    }
  }

  return merged;
}

function allows(list: string[], id: string): boolean {
  return list.includes("*") || list.includes(id);
}

export function agentCapabilityMatrix(input: {
  agents: GoatmezAgentProfile[];
  connectors: Array<Record<string, unknown>>;
  plugins: GoatmezPluginRecord[];
  models: GoatmezModelProfile[];
}): Record<string, unknown> {
  const rows = input.agents.map((agent) => {
    const connectors = input.connectors
      .filter((connector) => connector.agentId === agent.id && allows(agent.allowedConnectors, String(connector.id)))
      .map((connector) => ({
        id: connector.id,
        ready: connector.ready,
        enabled: connector.enabled,
        allowedForAgent: connector.allowedForAgent
      }));
    const plugins = input.plugins
      .filter((plugin) => allows(agent.allowedPlugins, plugin.id))
      .map((plugin) => ({ id: plugin.id, enabled: plugin.enabled, kind: plugin.kind }));
    const models = input.models
      .filter((model) => allows(agent.allowedModels, model.id))
      .map((model) => ({ id: model.id, enabled: model.enabled, provider: model.provider }));

    return {
      agentId: agent.id,
      enabled: agent.enabled,
      autonomyLevel: agent.autonomyLevel,
      connectors,
      plugins,
      models
    };
  });

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    agents: rows
  };
}
