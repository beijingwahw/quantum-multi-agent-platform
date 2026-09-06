/** Report plumbing — mirrors the house convention (out/reports/). */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function writeReport(name: string, text: string): string {
  const dir = resolve(process.cwd(), "out", "reports");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, text, "utf8");
  return path;
}
