import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import type { GoatmezConfig } from "./config.js";

interface McpServerConfig {
  command?: unknown;
  args?: unknown;
  env?: unknown;
  enabled?: unknown;
  expectedTools?: unknown;
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

function isSensitiveKey(key: string): boolean {
  return /(token|key|secret|password|authorization|bearer)/i.test(key);
}

function redactEnv(env: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => [
      key,
      isSensitiveKey(key) ? "***" : String(value)
    ])
  );
}

function getFailureReasons(input: { enabled: boolean; command: string; args: string[] }): string[] {
  const reasons: string[] = [];
  if (!input.enabled) reasons.push("server-disabled");
  if (!input.command) reasons.push("missing-command");
  if (!input.args.length) reasons.push("missing-args");
  if (!reasons.length) reasons.push("none");
  return reasons;
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

export function getMcpExplorer(config: GoatmezConfig): Record<string, unknown> {
  const path = resolve(config.workspaceRoot, ".mcp.json");
  if (!existsSync(path)) {
    return {
      ok: true,
      configured: false,
      configPath: path,
      servers: []
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    const root = asRecord(parsed);
    const serverObject = asRecord(root?.mcpServers) ?? {};
    const servers = Object.entries(serverObject)
      .map(([id, raw]) => {
        const cfg = asRecord(raw) as McpServerConfig | null;
        const command = cfg?.command ? String(cfg.command) : "";
        const args = Array.isArray(cfg?.args) ? cfg.args.map(String) : [];
        const env = cfg?.env && typeof cfg.env === "object" ? cfg.env as Record<string, unknown> : {};
        const enabled = cfg?.enabled !== false;
        const expectedTools = Array.isArray(cfg?.expectedTools) ? cfg.expectedTools.map(String) : [];
        const status = serverRuntimeStatus({ command, enabled });
        const failureReasons = getFailureReasons({ enabled, command, args });

        return {
          id,
          enabled,
          status,
          transport: "stdio",
          command,
          args,
          env: redactEnv(env),
          launchPreview: [command, ...args].filter(Boolean).join(" "),
          failureReasons,
          toolVisibility: {
            discoveryState: "not-handshaken",
            configuredTools: expectedTools,
            discoveredToolCount: 0,
            note: "Live MCP tool discovery requires a server handshake; this explorer snapshot is config-only."
          }
        };
      })
      .sort((a, b) => a.id.localeCompare(b.id));

    return {
      ok: true,
      configured: true,
      configPath: path,
      serverCount: servers.length,
      readyServers: servers.filter((server) => server.status === "ready").length,
      servers
    };
  } catch (error) {
    return {
      ok: false,
      configured: true,
      configPath: path,
      parseError: error instanceof Error ? error.message : String(error),
      servers: []
    };
  }
}
