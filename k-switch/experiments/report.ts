/** Shared report helpers (house style: self-contained markdown to out/reports/). */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Entry-guard law (the batch-33 house form the sibling repos carry): an
 * experiment renders ONLY when run directly (`npm run repro` spawns one
 * process per experiment, where process.argv[1] IS the experiment file),
 * never when imported. The caller MUST pass its own `import.meta.url`.
 */
export function runIfMain(moduleUrl: string, run: () => void): void {
  if (moduleUrl === pathToFileURL(process.argv[1] ?? "").href) run();
}

export const reportDir = resolve(import.meta.dirname, "../out/reports");

export function writeReport(name: string, body: string): string {
  const file = resolve(reportDir, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body, "utf8");
  return file;
}

export function table(headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}
