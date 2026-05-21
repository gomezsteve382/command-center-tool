import { goatmezId } from "./id.js";
import type {
  GoatmezKnowledgeChunk,
  GoatmezKnowledgeDocument,
  GoatmezStateSchema
} from "./types.js";

type SearchMode = "keyword" | "vector" | "hybrid";

function normalize(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\t/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

function tokenize(value: string): string[] {
  return [...new Set((value.toLowerCase().match(/[a-z0-9_-]{3,}/g) ?? []))];
}

function chunkText(text: string, size = 900): string[] {
  const normalized = normalize(text);
  if (!normalized) return [];
  if (normalized.length <= size) return [normalized];
  const chunks: string[] = [];
  let start = 0;
  while (start < normalized.length) {
    chunks.push(normalized.slice(start, start + size).trim());
    start += size;
  }
  return chunks.filter(Boolean);
}

function scoreKeyword(queryTokens: string[], doc: GoatmezKnowledgeDocument, chunk: GoatmezKnowledgeChunk): number {
  const corpus = `${doc.title}\n${doc.tags.join(" ")}\n${chunk.text}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (chunk.keywords.includes(token)) score += 4;
    if (corpus.includes(token)) score += 2;
  }
  return score;
}

function deterministicVector(input: string, dims = 64): number[] {
  const out = new Array(dims).fill(0);
  const chars = [...input];
  for (let i = 0; i < chars.length; i += 1) {
    const code = chars[i]!.charCodeAt(0);
    const bucket = i % dims;
    out[bucket] = (out[bucket] + (code % 113) / 113) % 1;
  }
  return out;
}

function cosine(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  if (!len) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0;
  return dot / denom;
}

export function ingestKnowledgeText(
  state: GoatmezStateSchema,
  input: { title: string; text: string; source?: string; tags?: string[] }
): { document: GoatmezKnowledgeDocument; chunks: GoatmezKnowledgeChunk[] } {
  const now = new Date().toISOString();
  const content = normalize(input.text);
  if (!content) throw new Error("Knowledge text is empty.");
  const pieces = chunkText(content);
  const document: GoatmezKnowledgeDocument = {
    id: goatmezId("kbdoc"),
    title: input.title.trim() || "Untitled",
    source: input.source || "manual",
    tags: [...new Set((input.tags || []).map((tag) => tag.trim()).filter(Boolean))],
    chunkCount: pieces.length,
    createdAt: now,
    updatedAt: now
  };
  const chunks: GoatmezKnowledgeChunk[] = pieces.map((piece, index) => ({
    id: goatmezId("kbchunk"),
    documentId: document.id,
    index,
    text: piece,
    keywords: tokenize(piece).slice(0, 50),
    vector: deterministicVector(piece)
  }));
  state.knowledgeDocuments = [document, ...state.knowledgeDocuments];
  state.knowledgeChunks = [...chunks, ...state.knowledgeChunks];
  return { document, chunks };
}

export function searchKnowledge(
  state: GoatmezStateSchema,
  input: { query: string; limit?: number; mode?: SearchMode }
): Array<{
  document: GoatmezKnowledgeDocument;
  chunk: GoatmezKnowledgeChunk;
  score: number;
  keywordScore: number;
  vectorScore: number;
}> {
  const query = input.query.trim();
  if (!query) return [];
  const mode = (input.mode || "hybrid") as SearchMode;
  const queryTokens = tokenize(query);
  const queryVector = deterministicVector(query);
  const docsById = new Map(state.knowledgeDocuments.map((doc) => [doc.id, doc]));
  const scored = state.knowledgeChunks
    .map((chunk) => {
      const doc = docsById.get(chunk.documentId);
      if (!doc) return undefined;
      const keywordScore = scoreKeyword(queryTokens, doc, chunk);
      const vectorScore = cosine(queryVector, chunk.vector);
      const score = mode === "keyword"
        ? keywordScore
        : mode === "vector"
          ? vectorScore
          : keywordScore * 0.45 + vectorScore * 0.55;
      return { document: doc, chunk, score, keywordScore, vectorScore };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, Math.max(1, input.limit || 10));
}
