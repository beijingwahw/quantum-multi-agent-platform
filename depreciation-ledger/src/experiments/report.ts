import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function writeReport(name: string, content: string): string {
  const dir = resolve(process.cwd(), "out", "reports");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

export function fmt(x: number, digits = 6): string {
  return x.toFixed(digits);
}
