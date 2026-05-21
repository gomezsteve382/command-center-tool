const baseUrl = process.env.GOATMEZ_VALIDATE_BASE_URL || "http://127.0.0.1:3101";

async function request(path, init) {
  const res = await fetch(`${baseUrl}${path}`, init);
  const text = await res.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return body;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log(`[goatmez-validate] base=${baseUrl}`);
  const health = await request("/api/goatmez/health");
  assert(health.ok === true, "health.ok must be true");

  const observability = await request("/api/goatmez/observability");
  assert(observability.ok === true, "observability.ok must be true");

  const config = await request("/api/goatmez/config");
  assert(config.ok === true, "config.ok must be true");
  assert(config.config && typeof config.config === "object", "config payload missing");

  const conflicts = await request("/api/goatmez/conflicts");
  assert(conflicts.ok === true, "conflicts.ok must be true");
  assert(Array.isArray(conflicts.rules), "conflict rules must be an array");

  const diagnostics = await request("/api/goatmez/diagnostics");
  assert(diagnostics.ok === true, "diagnostics.ok must be true");
  assert(diagnostics.mcp && typeof diagnostics.mcp === "object", "diagnostics.mcp missing");

  const permissions = await request("/api/goatmez/permissions/dry-run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId: "operator", toolName: "connector.http.request" })
  });
  assert(permissions.ok === true, "permissions dry-run failed");

  const knowledge = await request("/api/goatmez/knowledge/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "dashboard", mode: "hybrid", limit: 3 })
  });
  assert(knowledge.ok === true, "knowledge search failed");
  assert(Array.isArray(knowledge.results), "knowledge search must return results array");

  console.log("[goatmez-validate] ok");
  console.log(
    JSON.stringify(
      {
        healthState: health.state,
        queue: observability.queue,
        connectorSummary: observability.connectors,
        mcpSummary: diagnostics.mcp,
        conflictRules: conflicts.rules.length,
        knowledgeResults: knowledge.results.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("[goatmez-validate] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
