/** Shared report helpers: every experiment writes a self-contained markdown report to out/reports/. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const reportDir = resolve(import.meta.dirname, "../../out/reports");

/**
 * The house entry guard (batch-33 retrofit; house form since batch 21): run
 * the experiment only when this module is the process entry — imports never
 * render. Formerly a token-identical 3-line block at the foot of all six
 * experiment files; single-sourced with identical semantics.
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

/**
 * Fixed-decimal formatting for report prose. The former twin in core/stats.ts
 * (toPrecision — significant digits) was DEAD (zero importers) and was
 * deleted in the wave-7 single-sourcing face WITHOUT merging: the two
 * conventions are semantically different, and the live one is this one.
 */
export function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return String(x);
  return x.toFixed(digits);
}
