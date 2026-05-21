import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname } from "path";
import type { GoatmezStateSchema, GoatmezVaultSchema } from "./types.js";

export function emptyGoatmezState(): GoatmezStateSchema {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    tasks: [],
    missions: [],
    approvals: [],
    sessions: [],
    permissionRules: [],
    knowledgeDocuments: [],
    knowledgeChunks: [],
    plugins: [],
    models: [],
    agents: []
  };
}

export function emptyGoatmezVault(): GoatmezVaultSchema {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    secrets: []
  };
}

export function readJsonFile<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJsonFile(path: string, payload: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", "utf8");
}

export class GoatmezStateStore {
  constructor(private readonly path: string) {}

  read(): GoatmezStateSchema {
    const data = readJsonFile(this.path, emptyGoatmezState());
    return {
      ...emptyGoatmezState(),
      ...data,
      version: 1
    };
  }

  write(next: GoatmezStateSchema): void {
    writeJsonFile(this.path, { ...next, version: 1, updatedAt: new Date().toISOString() });
  }

  mutate(fn: (state: GoatmezStateSchema) => GoatmezStateSchema | void): GoatmezStateSchema {
    const current = this.read();
    const maybe = fn(current);
    const next = maybe ?? current;
    this.write(next);
    return next;
  }
}

export class GoatmezVaultStore {
  constructor(private readonly path: string) {}

  read(): GoatmezVaultSchema {
    const data = readJsonFile(this.path, emptyGoatmezVault());
    return {
      ...emptyGoatmezVault(),
      ...data,
      version: 1
    };
  }

  write(next: GoatmezVaultSchema): void {
    writeJsonFile(this.path, { ...next, version: 1, updatedAt: new Date().toISOString() });
  }
}
