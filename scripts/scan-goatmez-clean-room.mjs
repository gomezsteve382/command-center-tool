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
const disallowedPayloadExtensions = new Set([".as", ".baml", ".bin", ".cs", ".dat", ".dll", ".exe", ".ico", ".jpg", ".jpeg", ".png", ".py", ".zip"]);
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

function collectAllFiles(path) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) return [];
  const stat = statSync(absolute);
  if (stat.isFile()) return [absolute];
  const files = [];
  for (const entry of readdirSync(absolute)) {
    const child = join(absolute, entry);
    const childStat = statSync(child);
    if (childStat.isDirectory()) {
      files.push(...collectAllFiles(child));
    } else {
      files.push(child);
    }
  }
  return files;
}

const allFiles = [...new Set(scanTargets.flatMap(collectAllFiles))].sort();
const files = allFiles.filter((file) => allowedExtensions.has(extensionOf(file))).sort();
const violations = [];

for (const file of allFiles) {
  const extension = extensionOf(file).toLowerCase();
  if (disallowedPayloadExtensions.has(extension)) {
    violations.push({
      file: relative(root, file),
      pattern: "forbidden-payload-extension",
      match: extension
    });
  }
}

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
