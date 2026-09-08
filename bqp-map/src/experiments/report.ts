/** Shared report helpers: every experiment writes a self-contained markdown report to out/reports/. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const reportDir = resolve(import.meta.dirname, "../../out/reports");

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
