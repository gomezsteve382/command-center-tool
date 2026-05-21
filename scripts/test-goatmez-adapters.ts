import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { getGoatmezConfig } from "../src/goatmez/config.js";
import { getGoatmezConfigCompatibility, importLegacyGoatmezData } from "../src/goatmez/compat.js";
import { emptyGoatmezState } from "../src/goatmez/storage.js";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function writeJson(path: string, payload: unknown): void {
  writeFileSync(path, JSON.stringify(payload, null, 2), "utf8");
}

function main(): void {
  const root = mkdtempSync(join(tmpdir(), "goatmez-adapter-test-"));
  try {
    const legacyDir = join(root, ".goatmez");
    mkdirSync(legacyDir, { recursive: true });

    writeJson(join(legacyDir, "database.json"), {
      sessions: [
        {
          id: "legacy_session_1",
          missionId: "legacy_mission_1",
          message: "legacy session message",
          status: "done",
          summary: "legacy summary",
          toolCalls: 2,
          approvals: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      permissionRules: [
        {
          id: "legacy_rule_1",
          pattern: "connector.*",
          decision: "approval",
          description: "legacy connector approval",
          enabled: true
        }
      ]
    });

    writeJson(join(legacyDir, "knowledge.json"), {
      documents: [
        {
          id: "legacy_doc_1",
          title: "Legacy Knowledge",
          source: "legacy",
          tags: ["legacy"],
          chunkCount: 1
        }
      ],
      chunks: [
        {
          id: "legacy_chunk_1",
          documentId: "legacy_doc_1",
          index: 0,
          text: "legacy chunk text for import validation",
          keywords: ["legacy", "chunk"],
          vector: [0.1, 0.2, 0.3]
        }
      ]
    });

    process.env.GOATMEZ_WORKSPACE_ROOT = root;
    process.env.GOATMEZ_PLANNER_PROVIDER = "rule";
    process.env.GOATMEZ_DB_DRIVER = "memory";

    const config = getGoatmezConfig();
    const compatibility = getGoatmezConfigCompatibility(config);
    const state = emptyGoatmezState();
    const result = importLegacyGoatmezData(config, state);

    assert(result.imported === true, "legacy import should mark imported=true");
    assert(state.sessions.length === 1, "one legacy session should be imported");
    assert(state.permissionRules.length === 1, "one legacy permission rule should be imported");
    assert(state.knowledgeDocuments.length === 1, "one legacy knowledge document should be imported");
    assert(state.knowledgeChunks.length === 1, "one legacy knowledge chunk should be imported");

    const envEntries = Array.isArray((compatibility as { env?: unknown }).env)
      ? (compatibility as { env: Array<{ key: string; source: string }> }).env
      : [];
    const rootEntry = envEntries.find((entry) => entry.key === "GOATMEZ_WORKSPACE_ROOT");
    assert(rootEntry?.source === "direct", "workspace root env binding should be direct");

    // biome-ignore lint/suspicious/noConsole: test output
    console.log("[goatmez-adapters] ok");
    // biome-ignore lint/suspicious/noConsole: test output
    console.log(
      JSON.stringify(
        {
          imported: result.imported,
          notes: result.notes,
          sessions: state.sessions.length,
          permissionRules: state.permissionRules.length,
          knowledgeDocuments: state.knowledgeDocuments.length,
          knowledgeChunks: state.knowledgeChunks.length
        },
        null,
        2
      )
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main();
