import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Writes a rendered report under out/reports/, creating the directory —
 *  the one door through which experiment output leaves the process. */
export function writeReport(name: string, content: string): string {
  const dir = resolve(process.cwd(), "out", "reports");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}
