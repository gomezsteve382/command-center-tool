import { getGoatmezRuntime } from "./runtime.js";

export async function runGoatmezCli(args: string[]): Promise<void> {
  const runtime = getGoatmezRuntime();
  const sub = args[0] || "run";

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
    const message = args.slice(1).join(" ").trim() || "inspect this workspace";
    const result = runtime.run({ message });
    // biome-ignore lint/suspicious/noConsole: CLI output.
    console.log(result.output);
    return;
  }

  // biome-ignore lint/suspicious/noConsole: CLI output.
  console.log("Usage: goatmez run <message> | goatmez health | goatmez observability | goatmez kb-search <query>");
}
