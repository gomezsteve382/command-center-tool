import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { GoatmezConfig } from "./config.js";

interface McpServerConfig {
  command?: unknown;
  args?: unknown;
  env?: unknown;
  enabled?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function serverRuntimeStatus(server: { command: string; enabled: boolean }): "ready" | "disabled" | "unknown" {
  if (!server.enabled) return "disabled";
  if (!server.command) return "unknown";
  if (server.command === "node" || server.command.endsWith("node.exe")) return "ready";
  return "unknown";
}

export function getMcpDiagnostics(config: GoatmezConfig): Record<string, unknown> {
  const path = resolve(config.workspaceRoot, ".mcp.json");
  if (!existsSync(path)) {
    return {
      configured: false,
      configPath: path,
      serverCount: 0,
      enabledServers: 0,
      servers: []
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const root = asRecord(parsed);
    const serverObject = asRecord(root?.mcpServers) ?? {};
    const entries = Object.entries(serverObject)
      .map(([id, raw]) => {
        const cfg = asRecord(raw) as McpServerConfig | null;
        const command = cfg?.command ? String(cfg.command) : "";
        const enabled = cfg?.enabled !== false;
        const args = Array.isArray(cfg?.args) ? cfg?.args.map(String) : [];
        const envCount = cfg?.env && typeof cfg.env === "object" ? Object.keys(cfg.env as Record<string, string>).length : 0;
        return {
          id,
          command,
          argsCount: args.length,
          envCount,
          enabled,
          status: serverRuntimeStatus({ command, enabled })
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      configured: true,
      configPath: path,
      serverCount: entries.length,
      enabledServers: entries.filter((server) => server.enabled).length,
      servers: entries
    };
  } catch (error) {
    return {
      configured: true,
      configPath: path,
      parseError: error instanceof Error ? error.message : String(error),
      serverCount: 0,
      enabledServers: 0,
      servers: []
    };
  }
}
