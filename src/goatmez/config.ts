import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { GoatmezConnectorProfile } from "./types.js";

export interface GoatmezConfig {
  statePath: string;
  vaultPath: string;
  vaultKey: string;
  connectorsPath: string;
  plannerProvider: string;
  dbDriver: string;
  workspaceRoot: string;
}

function envValue(primary: string, fallback?: string): string | undefined {
  const first = process.env[primary];
  if (first && first.trim()) return first.trim();
  if (!fallback) return undefined;
  const second = process.env[fallback];
  if (second && second.trim()) return second.trim();
  return undefined;
}

export function getGoatmezConfig(): GoatmezConfig {
  const workspaceRoot = resolve(
    envValue("GOATMEZ_WORKSPACE_ROOT", "WORK_DIR") ?? process.cwd()
  );
  return {
    workspaceRoot,
    statePath: resolve(
      workspaceRoot,
      envValue("GOATMEZ_DB_PATH", "CODE_ENGINE_GOATMEZ_DB_PATH") ?? ".code-engine/goatmez/state.json"
    ),
    vaultPath: resolve(
      workspaceRoot,
      envValue("GOATMEZ_VAULT_PATH", "CODE_ENGINE_GOATMEZ_VAULT_PATH") ?? ".code-engine/goatmez/vault.json"
    ),
    vaultKey: envValue("GOATMEZ_VAULT_KEY", "CODE_ENGINE_GOATMEZ_VAULT_KEY") ?? "",
    connectorsPath: resolve(
      workspaceRoot,
      envValue("GOATMEZ_CONNECTORS_CONFIG", "CODE_ENGINE_GOATMEZ_CONNECTORS_CONFIG") ?? "config/connectors.json"
    ),
    plannerProvider: envValue("GOATMEZ_PLANNER_PROVIDER", "CODE_ENGINE_GOATMEZ_PLANNER_PROVIDER") ?? "rule",
    dbDriver: envValue("GOATMEZ_DB_DRIVER", "CODE_ENGINE_GOATMEZ_DB_DRIVER") ?? "json",
  };
}

export function readConnectorProfiles(config: GoatmezConfig): GoatmezConnectorProfile[] {
  const fallback: GoatmezConnectorProfile[] = [
    {
      id: "openai",
      name: "OpenAI",
      type: "http",
      enabled: true,
      requiredSecrets: ["OPENAI_API_KEY"],
      allowedAgents: ["operator", "developer"],
      riskLevel: "medium",
      description: "OpenAI responses and embeddings connector."
    },
    {
      id: "gmail",
      name: "Gmail",
      type: "oauth",
      enabled: false,
      requiredSecrets: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"],
      allowedAgents: ["operator"],
      riskLevel: "high",
      description: "Gmail draft and send workflows."
    }
  ];
  if (!existsSync(config.connectorsPath)) return fallback;
  try {
    const parsed = JSON.parse(readFileSync(config.connectorsPath, "utf8"));
    if (!Array.isArray(parsed)) return fallback;
    return parsed
      .map((item) => ({
        id: String(item.id ?? "").trim(),
        name: String(item.name ?? item.id ?? "").trim(),
        type: String(item.type ?? "http").trim(),
        enabled: item.enabled !== false,
        requiredSecrets: Array.isArray(item.requiredSecrets) ? item.requiredSecrets.map(String) : [],
        allowedAgents: Array.isArray(item.allowedAgents) ? item.allowedAgents.map(String) : [],
        riskLevel: ["low", "medium", "high", "critical"].includes(String(item.riskLevel)) ? item.riskLevel : "medium",
        description: String(item.description ?? "Connector profile")
      }))
      .filter((item) => item.id);
  } catch {
    return fallback;
  }
}
