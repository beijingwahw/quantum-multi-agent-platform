/** Shared report helpers: every experiment writes a self-contained markdown report to out/reports/. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export const reportDir = resolve(import.meta.dirname, "../../out/reports");

/** Write one markdown report file; returns the path written. */
export function writeReport(name: string, body: string): string {
  const file = resolve(reportDir, name);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, body, "utf8");
  return file;
}

/** Render a markdown table with a matching separator row. */
export function table(headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  const head = `| ${headers.join(" | ")} |`;
  const sep = `| ${headers.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.join(" | ")} |`).join("\n");
  return [head, sep, body].join("\n");
}

/** Least-squares slope of ys against xs (experiment scaling-law fits). */
export function fitSlope(xs: readonly number[], ys: readonly number[]): number {
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += ((xs[i] as number) - mx) * ((ys[i] as number) - my);
    den += ((xs[i] as number) - mx) ** 2;
  }
  return num / den;
}

/** Fixed-decimal formatting for report prose (NaN/Infinity pass through as strings). */
export function fmt(x: number, digits = 3): string {
  if (!Number.isFinite(x)) return String(x);
  return x.toFixed(digits);
}
