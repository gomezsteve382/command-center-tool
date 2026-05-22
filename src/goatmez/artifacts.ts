import { createHash } from "crypto";
import { existsSync, readFileSync } from "fs";
import { basename, extname } from "path";
import { inflateRawSync } from "zlib";
import { ingestKnowledgeText } from "./knowledge.js";
import type {
  GoatmezArtifactBundle,
  GoatmezArtifactEntry,
  GoatmezArtifactEntryKind,
  GoatmezArtifactRisk,
  GoatmezStateSchema
} from "./types.js";

export const DEFAULT_ARTIFACT_SOURCE_PATH = "C:\\Users\\gomez\\Desktop\\ALL_DELIVERABLES.zip";

type ZipDirectoryEntry = {
  path: string;
  length: number;
  compressedLength: number;
  compressionMethod: number;
  localHeaderOffset: number;
};

type EntryClassification = {
  kind: GoatmezArtifactEntryKind;
  mimeType: string;
  allowedForIngestion: boolean;
  exclusionReason?: string;
  risks: GoatmezArtifactRisk[];
};

const TOP_LEVEL_DOC_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);
const SOURCE_EXTENSIONS = new Set([".as", ".cs", ".c", ".cpp", ".h", ".hpp", ".java", ".js", ".jsx", ".mjs", ".py", ".rs", ".ts", ".tsx"]);
const SCRIPT_EXTENSIONS = new Set([".bat", ".cmd", ".ps1", ".sh", ".py"]);
const BINARY_EXTENSIONS = new Set([".bin", ".dat", ".dll", ".exe", ".so"]);
const IMAGE_EXTENSIONS = new Set([".bmp", ".gif", ".ico", ".jpg", ".jpeg", ".png", ".svg", ".webp"]);

function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256Text(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function artifactEntryId(path: string, nestedIn?: string): string {
  return `artifact_entry_${sha256Text(`${nestedIn || "root"}:${path}`).slice(0, 16)}`;
}

function artifactBundleId(sourcePath: string, sha256: string): string {
  return `artifact_${sha256Text(`${sourcePath}:${sha256}`).slice(0, 16)}`;
}

function uniqueRisks(risks: GoatmezArtifactRisk[]): GoatmezArtifactRisk[] {
  return [...new Set(risks)];
}

function mimeForExtension(extension: string): string {
  switch (extension) {
    case ".md":
    case ".markdown":
      return "text/markdown";
    case ".txt":
      return "text/plain";
    case ".zip":
      return "application/zip";
    case ".bin":
    case ".dat":
      return "application/octet-stream";
    case ".py":
      return "text/x-python";
    case ".cs":
      return "text/x-csharp";
    case ".as":
      return "text/x-actionscript";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".ico":
      return "image/x-icon";
    default:
      return "application/octet-stream";
  }
}

function classifyEntry(path: string, nestedIn?: string): EntryClassification {
  const lower = path.toLowerCase();
  const extension = extname(lower);
  const risks: GoatmezArtifactRisk[] = [];
  let kind: GoatmezArtifactEntryKind = "other";
  let allowedForIngestion = false;
  let exclusionReason: string | undefined;

  if (lower.endsWith("/")) {
    return {
      kind: "other",
      mimeType: "inode/directory",
      allowedForIngestion: false,
      exclusionReason: "directory-entry",
      risks: ["excluded"]
    };
  }

  if (TOP_LEVEL_DOC_EXTENSIONS.has(extension)) {
    kind = extension === ".txt" ? "text" : "markdown";
    allowedForIngestion = !nestedIn;
    if (!allowedForIngestion) exclusionReason = "nested-documents-remain-quarantined";
    risks.push("safe-doc");
  } else if (extension === ".zip") {
    kind = "archive";
    exclusionReason = "nested-archives-are-inventory-only";
    risks.push("source-archive", "excluded");
  } else if (BINARY_EXTENSIONS.has(extension)) {
    kind = "binary";
    exclusionReason = "binary-payloads-are-blocked";
    risks.push("binary-payload", "excluded");
  } else if (SCRIPT_EXTENSIONS.has(extension)) {
    kind = "script";
    exclusionReason = "executable-scripts-are-blocked";
    risks.push("executable-script", "excluded");
  } else if (SOURCE_EXTENSIONS.has(extension)) {
    kind = "source";
    exclusionReason = "source-files-are-blocked";
    risks.push("decompiled-source", "excluded");
  } else if (IMAGE_EXTENSIONS.has(extension) || lower.endsWith(".baml")) {
    kind = "image";
    exclusionReason = "images-and-compiled-ui-assets-are-blocked";
    risks.push("excluded");
  } else {
    exclusionReason = "unsupported-artifact-entry-type";
    risks.push("excluded");
  }

  if (/unlock|security|ecu|pcm|rfhub|gateway|seed|key/i.test(path)) risks.push("vehicle-security");
  if (/patch|patched|byte|offset|address/i.test(path)) risks.push("patch-material");
  if (/source|decompil/i.test(path)) risks.push("decompiled-source");
  if (/token|secret|credential|password|authorization/i.test(path)) risks.push("secret-material");

  if (!allowedForIngestion && !risks.includes("excluded")) risks.push("excluded");

  return {
    kind,
    mimeType: mimeForExtension(extension),
    allowedForIngestion,
    exclusionReason,
    risks: uniqueRisks(risks)
  };
}

function locateEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end of central directory not found.");
}

function parseZipDirectory(buffer: Buffer): ZipDirectoryEntry[] {
  const endOffset = locateEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const entries: ZipDirectoryEntry[] = [];
  let offset = centralDirectoryOffset;
  const end = centralDirectoryOffset + centralDirectorySize;

  while (offset < end && entries.length < entryCount) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`Invalid ZIP central directory header at ${offset}.`);
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedLength = buffer.readUInt32LE(offset + 20);
    const length = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + nameLength;
    const entryPath = buffer.subarray(nameStart, nameEnd).toString("utf8").replace(/\\/g, "/");

    entries.push({
      path: entryPath,
      length,
      compressedLength,
      compressionMethod,
      localHeaderOffset
    });
    offset = nameEnd + extraLength + commentLength;
  }

  return entries;
}

function readEntryData(zipBuffer: Buffer, entry: ZipDirectoryEntry): Buffer | null {
  const offset = entry.localHeaderOffset;
  if (zipBuffer.readUInt32LE(offset) !== 0x04034b50) return null;
  const nameLength = zipBuffer.readUInt16LE(offset + 26);
  const extraLength = zipBuffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLength + extraLength;
  const compressed = zipBuffer.subarray(dataStart, dataStart + entry.compressedLength);
  if (entry.compressionMethod === 0) return Buffer.from(compressed);
  if (entry.compressionMethod === 8) return inflateRawSync(compressed);
  return null;
}

function toArtifactEntry(raw: ZipDirectoryEntry, zipBuffer: Buffer | null, nestedIn?: string): GoatmezArtifactEntry {
  const classification = classifyEntry(raw.path, nestedIn);
  let sha256: string | undefined;
  if (zipBuffer) {
    const data = readEntryData(zipBuffer, raw);
    if (data) sha256 = sha256Buffer(data);
  } else {
    sha256 = sha256Text(`${nestedIn || "root"}:${raw.path}:${raw.length}:${raw.compressedLength}`);
  }

  return {
    id: artifactEntryId(raw.path, nestedIn),
    path: raw.path,
    nestedIn,
    kind: classification.kind,
    mimeType: classification.mimeType,
    length: raw.length,
    compressedLength: raw.compressedLength,
    sha256,
    compressionMethod: raw.compressionMethod,
    allowedForIngestion: classification.allowedForIngestion,
    exclusionReason: classification.exclusionReason,
    risks: classification.risks
  };
}

function readNestedZipEntries(parentBuffer: Buffer, parent: ZipDirectoryEntry): GoatmezArtifactEntry[] {
  const nestedZip = readEntryData(parentBuffer, parent);
  if (!nestedZip) return [];
  try {
    return parseZipDirectory(nestedZip).map((entry) => toArtifactEntry(entry, null, parent.path));
  } catch {
    return [];
  }
}

function buildArtifactBundle(sourcePath: string, existing?: GoatmezArtifactBundle, status: GoatmezArtifactBundle["status"] = "registered"): GoatmezArtifactBundle {
  const now = new Date().toISOString();
  if (!existsSync(sourcePath)) {
    const sha256 = sha256Text(sourcePath);
    return {
      id: existing?.id || artifactBundleId(sourcePath, sha256),
      name: basename(sourcePath),
      sourcePath,
      sha256,
      status: "missing",
      entries: [],
      nestedEntries: [],
      docCount: 0,
      excludedCount: 0,
      ingestedDocumentIds: existing?.ingestedDocumentIds || [],
      redactionCount: existing?.redactionCount || 0,
      provenance: "local-source-path-metadata-only",
      createdAt: existing?.createdAt || now,
      updatedAt: now,
      lastScannedAt: now,
      error: "source path does not exist"
    };
  }

  const zipBuffer = readFileSync(sourcePath);
  const sha256 = sha256Buffer(zipBuffer);
  const rawEntries = parseZipDirectory(zipBuffer);
  const entries = rawEntries.map((entry) => toArtifactEntry(entry, zipBuffer));
  const nestedEntries = rawEntries
    .filter((entry) => extname(entry.path).toLowerCase() === ".zip")
    .flatMap((entry) => readNestedZipEntries(zipBuffer, entry));
  const allEntries = [...entries, ...nestedEntries];

  return {
    id: existing?.id || artifactBundleId(sourcePath, sha256),
    name: basename(sourcePath, ".zip") || basename(sourcePath),
    sourcePath,
    sha256,
    status,
    entries,
    nestedEntries,
    docCount: entries.filter((entry) => entry.allowedForIngestion).length,
    excludedCount: allEntries.filter((entry) => !entry.allowedForIngestion).length,
    ingestedDocumentIds: existing?.ingestedDocumentIds || [],
    redactionCount: existing?.redactionCount || 0,
    provenance: "local-zip-source; metadata and redacted documentation only; no executable extraction",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    lastScannedAt: now
  };
}

function ensureArtifacts(state: GoatmezStateSchema): GoatmezArtifactBundle[] {
  state.artifacts = state.artifacts || [];
  return state.artifacts;
}

function upsertArtifact(state: GoatmezStateSchema, bundle: GoatmezArtifactBundle): GoatmezArtifactBundle {
  const artifacts = ensureArtifacts(state);
  const index = artifacts.findIndex((item) => item.id === bundle.id || item.sourcePath === bundle.sourcePath);
  if (index === -1) {
    artifacts.unshift(bundle);
  } else {
    artifacts[index] = bundle;
  }
  return bundle;
}

function redactionReason(line: string): string | null {
  const lower = line.toLowerCase();
  if (/api[_ -]?key|secret|token|authorization|bearer|password|credential|private key/.test(lower)) return "secret-material";
  if (/https?:\/\/|endpoint|ldap|host[:=]|port[:=]/.test(lower)) return "endpoint-secret";
  if (/seed|keygen|security access|unlock|algorithm|challenge|response/.test(lower)) return "unlock-algorithm";
  if (/patch|patched|byte array|offset|address|calibration|checksum|crc|flash/.test(lower)) return "patch-material";
  if (/(0x[0-9a-f]{2,}){2,}/i.test(line) || /(?:\b[0-9a-f]{2}\b[\s,]+){6,}/i.test(line)) return "byte-array";
  if (/vin|skim|pin|ecu|pcm|rfhub|gateway|uds|can bus|diagnostic/.test(lower)) return "vehicle-security";
  return null;
}

function sanitizeArtifactText(bundle: GoatmezArtifactBundle, entry: GoatmezArtifactEntry, text: string): { text: string; redactions: number } {
  const output: string[] = [
    `Artifact bundle: ${bundle.name}`,
    `Entry: ${entry.path}`,
    "Quarantine decision: documentation-only import with executable, binary, archive, and source material blocked.",
    `Risk labels: ${entry.risks.join(", ") || "safe-doc"}`,
    ""
  ];
  let redactions = 0;

  for (const line of text.replace(/\r\n/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (output.at(-1) !== "") output.push("");
      continue;
    }

    const reason = redactionReason(trimmed);
    if (reason) {
      const marker = `[REDACTED artifact-risk:${reason}]`;
      if (output.at(-1) !== marker) output.push(marker);
      redactions += 1;
      continue;
    }

    const heading = /^#{1,6}\s+/.test(trimmed);
    if (heading || trimmed.length <= 220) {
      output.push(trimmed.slice(0, 260));
    } else {
      output.push(`${trimmed.slice(0, 220)}...`);
    }

    if (output.join("\n").length > 12_000) {
      output.push("[TRUNCATED artifact-risk:document-size]");
      break;
    }
  }

  return { text: output.join("\n").trim(), redactions };
}

function removeIngestedArtifactDocs(state: GoatmezStateSchema, documentIds: string[]): void {
  if (!documentIds.length) return;
  const ids = new Set(documentIds);
  state.knowledgeDocuments = state.knowledgeDocuments.filter((doc) => !ids.has(doc.id));
  state.knowledgeChunks = state.knowledgeChunks.filter((chunk) => !ids.has(chunk.documentId));
}

export function listArtifactBundles(state: GoatmezStateSchema): GoatmezArtifactBundle[] {
  return [...ensureArtifacts(state)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function artifactBundleSummary(bundle: GoatmezArtifactBundle): Record<string, unknown> {
  const allEntries = [...bundle.entries, ...bundle.nestedEntries];
  const risks = [...new Set(allEntries.flatMap((entry) => entry.risks))].sort();
  return {
    id: bundle.id,
    name: bundle.name,
    sourcePath: bundle.sourcePath,
    sha256: bundle.sha256,
    status: bundle.status,
    docCount: bundle.docCount,
    excludedCount: bundle.excludedCount,
    redactionCount: bundle.redactionCount,
    ingestedDocumentCount: bundle.ingestedDocumentIds.length,
    topLevelEntryCount: bundle.entries.length,
    nestedEntryCount: bundle.nestedEntries.length,
    risks,
    provenance: bundle.provenance,
    createdAt: bundle.createdAt,
    updatedAt: bundle.updatedAt,
    lastScannedAt: bundle.lastScannedAt,
    lastIngestedAt: bundle.lastIngestedAt,
    error: bundle.error
  };
}

export function getArtifactBundle(state: GoatmezStateSchema, id: string): GoatmezArtifactBundle | null {
  return ensureArtifacts(state).find((bundle) => bundle.id === id) || null;
}

export function registerArtifactBundle(state: GoatmezStateSchema, sourcePath: string): GoatmezArtifactBundle {
  const existing = ensureArtifacts(state).find((bundle) => bundle.sourcePath === sourcePath);
  return upsertArtifact(state, buildArtifactBundle(sourcePath, existing, "registered"));
}

export function scanArtifactBundle(state: GoatmezStateSchema, id: string): GoatmezArtifactBundle | null {
  const existing = getArtifactBundle(state, id);
  if (!existing) return null;
  return upsertArtifact(state, buildArtifactBundle(existing.sourcePath, existing, "scanned"));
}

export function ingestArtifactDocuments(state: GoatmezStateSchema, id: string): Record<string, unknown> | null {
  const existing = getArtifactBundle(state, id);
  if (!existing) return null;
  const bundle = upsertArtifact(state, buildArtifactBundle(existing.sourcePath, existing, "scanned"));
  if (!existsSync(bundle.sourcePath)) {
    bundle.status = "missing";
    bundle.error = "source path does not exist";
    return { ok: false, bundleId: bundle.id, error: bundle.error };
  }

  const zipBuffer = readFileSync(bundle.sourcePath);
  const rawByPath = new Map(parseZipDirectory(zipBuffer).map((entry) => [entry.path, entry]));
  removeIngestedArtifactDocs(state, bundle.ingestedDocumentIds);

  const documentIds: string[] = [];
  let redactionCount = 0;
  const skipped: string[] = [];

  for (const entry of bundle.entries) {
    if (!entry.allowedForIngestion) {
      skipped.push(entry.path);
      continue;
    }
    const raw = rawByPath.get(entry.path);
    if (!raw) {
      skipped.push(entry.path);
      continue;
    }
    const data = readEntryData(zipBuffer, raw);
    if (!data) {
      skipped.push(entry.path);
      continue;
    }
    const sanitized = sanitizeArtifactText(bundle, entry, data.toString("utf8"));
    redactionCount += sanitized.redactions;
    const result = ingestKnowledgeText(state, {
      title: `${bundle.name}: ${entry.path}`,
      source: `artifact:${bundle.id}:${entry.path}`,
      tags: ["artifact", `artifact:${bundle.name}`, "artifact:ALL_DELIVERABLES", "quarantined", ...entry.risks],
      text: sanitized.text
    });
    documentIds.push(result.document.id);
  }

  bundle.ingestedDocumentIds = documentIds;
  bundle.redactionCount = redactionCount;
  bundle.status = "ingested";
  bundle.lastIngestedAt = new Date().toISOString();
  bundle.updatedAt = bundle.lastIngestedAt;
  upsertArtifact(state, bundle);

  return {
    ok: true,
    bundleId: bundle.id,
    ingested: documentIds.length,
    skipped: skipped.length,
    redactionCount,
    documentIds
  };
}

export function artifactRiskSummary(bundle: GoatmezArtifactBundle): Record<string, unknown> {
  const allEntries = [...bundle.entries, ...bundle.nestedEntries];
  const byRisk = allEntries.reduce<Record<string, number>>((acc, entry) => {
    for (const risk of entry.risks) acc[risk] = (acc[risk] || 0) + 1;
    return acc;
  }, {});
  const excludedEntries = allEntries
    .filter((entry) => !entry.allowedForIngestion)
    .map((entry) => ({
      path: entry.path,
      nestedIn: entry.nestedIn,
      kind: entry.kind,
      reason: entry.exclusionReason || "blocked-by-quarantine-policy",
      risks: entry.risks
    }));

  return {
    ok: true,
    bundleId: bundle.id,
    status: bundle.status,
    sourcePath: bundle.sourcePath,
    sha256: bundle.sha256,
    counts: {
      entries: bundle.entries.length,
      nestedEntries: bundle.nestedEntries.length,
      docsAllowed: bundle.docCount,
      excluded: bundle.excludedCount,
      ingestedDocuments: bundle.ingestedDocumentIds.length
    },
    byRisk,
    redactionCount: bundle.redactionCount,
    excludedEntries,
    operatorNotes: [
      "Executable scripts, source files, nested archives, images, and binary payloads remain quarantined.",
      "Only redacted markdown/text documentation is eligible for knowledge ingestion.",
      "No artifact payloads are extracted into Goatmez implementation paths."
    ]
  };
}
