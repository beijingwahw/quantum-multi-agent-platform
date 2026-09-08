import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function writeReport(name: string, content: string): string {
  const dir = resolve(process.cwd(), "out", "reports");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

/**
 * The report printer's one number formatter. Single source for every number
 * the rendered page speaks; finite input formats identically to toFixed, and
 * non-finite input is refused BY NAME — the printer does not typeset
 * "NaN"/"Infinity" as prose (the family's shipped-defect class, convicted in
 * retro-cache v0.2.1; ent-clearing's renderer carried the unguarded twin).
 */
export function fmt(x: number, digits = 6): string {
  if (!Number.isFinite(x)) {
    throw new Error(`EC_NON_FINITE: the report printer refuses to typeset ${x} as prose`);
  }
  return x.toFixed(digits);
}
