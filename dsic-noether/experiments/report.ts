/** Shared report helpers (house style: self-contained markdown to out/reports/). */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const reportDir = resolve(import.meta.dirname, "../out/reports");

/** Entry guard: `run` fires only when this module IS the process entry —
 * importing an experiment (tests, run-all introspection) must never render. */
export function runIfMain(moduleUrl: string, argv1: string | undefined, run: () => void): void {
  if (moduleUrl === pathToFileURL(argv1 ?? "").href) {
    run();
  }
}

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
