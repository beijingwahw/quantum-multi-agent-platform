/**
 * render — the repro entry point. Guarded so a test-side import never
 * executes the render (batch 21 lesson, now a family rule).
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { renderReport } from "./report.js";
import { buildCensus, runAll } from "./run-all.js";

const here = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(here, "..", "..", "..");

function main(): void {
  const o = runAll();
  const census = buildCensus(o);
  const text = renderReport(o, census, workspaceRoot); // throws on illegal census
  const outDir = join(here, "..", "..", "out", "reports");
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, "the-survivor-census.md");
  writeFileSync(outFile, text, "utf8");
  console.log(`rendered -> ${outFile}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] as string).href) {
  main();
}
