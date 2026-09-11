/** Shared report helpers (house style: self-contained markdown to out/reports/). */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const reportDir = resolve(import.meta.dirname, "../out/reports");

/**
 * The house entry guard (batch-33 retrofit; house form since batch 21): run
 * the experiment only when this module is the process entry — imports never
 * render. Formerly a bare `run()` at the foot of all five experiment files;
 * single-sourced in the bqp-map house form (repro is byte-identical: run-all
 * spawns each file as the process entry, so the guard fires exactly there).
 */
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
