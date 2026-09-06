import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** Fixed digits for report tables. */
export function fmt(x: number, digits = 4): string {
  if (!Number.isFinite(x)) return String(x);
  if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e7)) {
    return x.toExponential(digits - 1);
  }
  return x.toFixed(digits);
}

export function fmtInt(x: number): string {
  return Math.round(x).toLocaleString("en-US");
}

export function writeReport(name: string, payload: unknown, markdown: string): void {
  const outDir = join(process.cwd(), "out");
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, `${name}.json`), JSON.stringify(payload, null, 2), "utf8");
  writeFileSync(join(outDir, `${name}.md`), markdown, "utf8");
  console.log(markdown);
}
