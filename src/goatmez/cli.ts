import { getGoatmezRuntime } from "./runtime.js";
import { formatCommandPreview, formatRunSummary, summarizeRunResult } from "./operatorUx.js";

function withoutFlags(args: string[]): string[] {
  return args.filter((arg) => arg !== "--json" && arg !== "--full");
}

export async function runGoatmezCli(args: string[]): Promise<void> {
  const runtime = getGoatmezRuntime();
  const sub = args[0] || "run";
  const json = args.includes("--json");

  if (sub === "health") {
    // biome-ignore lint/suspicious/noConsole: CLI output.
    console.log(JSON.stringify(runtime.health(), null, 2));
    return;
  }

  if (sub === "observability") {
    // biome-ignore lint/suspicious/noConsole: CLI output.
    console.log(JSON.stringify(runtime.observabilitySnapshot(), null, 2));
    return;
  }

  if (sub === "kb-search") {
    const query = args.slice(1).join(" ").trim();
    const results = runtime.searchKnowledge(query || "dashboard", "hybrid", 5);
    // biome-ignore lint/suspicious/noConsole: CLI output.
    console.log(JSON.stringify({ query, results }, null, 2));
    return;
  }

  if (sub === "run") {
    const full = args.includes("--full");
    const message = withoutFlags(args.slice(1)).join(" ").trim() || "inspect this workspace";
    const result = runtime.run({ message });
    if (json) {
      // biome-ignore lint/suspicious/noConsole: CLI output.
      console.log(JSON.stringify({ ok: true, result, summary: summarizeRunResult(result) }, null, 2));
      return;
    }
    if (!full) {
      // biome-ignore lint/suspicious/noConsole: CLI output.
      console.log(formatRunSummary(summarizeRunResult(result)));
      return;
    }
    // biome-ignore lint/suspicious/noConsole: CLI output.
    console.log(result.output);
    return;
  }

  if (sub === "preview-command") {
    const command = args.slice(1).join(" ").trim();
    const preview = runtime.previewCommand(command);
    // biome-ignore lint/suspicious/noConsole: CLI output.
    console.log(json ? JSON.stringify(preview, null, 2) : formatCommandPreview(preview));
    return;
  }

  // biome-ignore lint/suspicious/noConsole: CLI output.
  console.log("Usage: goatmez run [--json|--full] <message> | goatmez preview-command <command> | goatmez health | goatmez observability | goatmez kb-search <query>");
}
