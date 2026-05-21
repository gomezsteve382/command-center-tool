import { goatmezId } from "./id.js";
import type { GoatmezModelProfile } from "./types.js";

const defaultModels: Array<Omit<GoatmezModelProfile, "id" | "createdAt" | "updatedAt">> = [
  {
    name: "Local Custom LLM",
    provider: "local",
    enabled: true,
    endpoint: "http://127.0.0.1:11434",
    requiredSecrets: [],
    capabilities: ["chat", "tool-planning"],
    description: "Local model endpoint profile for private development and experimentation."
  },
  {
    name: "OpenAI Responses",
    provider: "openai",
    enabled: true,
    requiredSecrets: ["OPENAI_API_KEY"],
    capabilities: ["chat", "tools", "embeddings"],
    description: "Vault-backed hosted model profile for production-grade agent calls."
  },
  {
    name: "Custom HTTP Model",
    provider: "custom",
    enabled: false,
    endpoint: "${env:GOATMEZ_MODEL_ENDPOINT}",
    requiredSecrets: ["GOATMEZ_MODEL_API_KEY"],
    capabilities: ["chat"],
    description: "Bring-your-own model gateway profile for future Goatmez-native LLM hosting."
  }
];

function normalizeModelName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeDefaultModel(input: Omit<GoatmezModelProfile, "id" | "createdAt" | "updatedAt">, now: string): GoatmezModelProfile {
  return {
    ...input,
    id: `model_${normalizeModelName(input.name) || goatmezId("model")}`,
    createdAt: now,
    updatedAt: now
  };
}

export function ensureDefaultModels(current: GoatmezModelProfile[] = []): GoatmezModelProfile[] {
  const now = new Date().toISOString();
  const byName = new Map(current.map((model) => [model.name.toLowerCase(), model]));
  const merged = [...current];

  for (const model of defaultModels) {
    if (!byName.has(model.name.toLowerCase())) {
      merged.push(makeDefaultModel(model, now));
    }
  }

  return merged;
}

export function modelRegistrySnapshot(models: GoatmezModelProfile[]): Record<string, unknown> {
  const byProvider = models.reduce<Record<string, number>>((acc, model) => {
    acc[model.provider] = (acc[model.provider] || 0) + 1;
    return acc;
  }, {});
  const capabilities = new Set(models.flatMap((model) => model.capabilities));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    total: models.length,
    enabled: models.filter((model) => model.enabled).length,
    disabled: models.filter((model) => !model.enabled).length,
    byProvider,
    capabilities: [...capabilities].sort()
  };
}
