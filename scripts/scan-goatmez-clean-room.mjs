import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join, relative, resolve } from "path";

const root = process.cwd();
const scanTargets = [
  "src/goatmez",
  "src/server/api/routes/goatmez.ts",
  "web/app/goatmez",
  "scripts/validate-goatmez-merge.mjs",
  "scripts/test-goatmez-adapters.ts",
  "docs/GOATMEZ_MERGE_VALIDATION.md",
  "docs/CLEAN_ROOM.md"
];

const allowedExtensions = new Set([".ts", ".tsx", ".mjs", ".md", ".json"]);
const forbiddenPatterns = [
  /claude-code-main/i,
  /claude-code-main-clean/i,
  /claude-code-main\(6\)/i,
  /claude code main/i
];

function extensionOf(path) {
  const index = path.lastIndexOf(".");
  return index === -1 ? "" : path.slice(index);
}

function collectFiles(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return [];
  const stat = statSync(absolute);
  if (stat.isFile()) {
    return allowedExtensions.has(extensionOf(absolute)) ? [absolute] : [];
  }
  const files = [];
  for (const entry of readdirSync(absolute)) {
    const child = join(absolute, entry);
    const childStat = statSync(child);
    if (childStat.isDirectory()) {
      files.push(...collectFiles(child));
    } else if (allowedExtensions.has(extensionOf(child))) {
      files.push(child);
    }
  }
  return files;
}

const files = [...new Set(scanTargets.flatMap(collectFiles))].sort();
const violations = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  for (const pattern of forbiddenPatterns) {
    const match = text.match(pattern);
    if (match) {
      violations.push({
        file: relative(root, file),
        pattern: String(pattern),
        match: match[0]
      });
    }
  }
}

if (violations.length) {
  console.error("[goatmez-clean-room] failed");
  console.error(JSON.stringify({ violations }, null, 2));
  process.exit(1);
}

console.log("[goatmez-clean-room] ok");
console.log(JSON.stringify({ scannedFiles: files.length }, null, 2));
