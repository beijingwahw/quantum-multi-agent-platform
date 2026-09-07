import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function writeReport(name: string, content: string): string {
  const dir = resolve(process.cwd(), "out", "reports");
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, name);
  writeFileSync(path, content, "utf8");
  return path;
}

/** The witness-letter guard (b46#5's tier upgrade): every W-[A-Z] that
 * headlines a census line belongs to exactly one census. Lives HERE — the
 * report module is a leaf (node:fs only): render.ts imports this module
 * statically and anchors.ts imports it dynamically, and neither edge can
 * form a cycle. It lived in render.ts until b53#5: with render.ts as the
 * ENTRY (npm run repro), its own top-level await left the module forever
 * mid-evaluation, the dynamic import of it could never resolve, and the
 * repro gate deadlocked silently while every test stayed green (the tests
 * never walk the entry path). */
export function assertUniqueWitnessLetters(reportText: string): void {
  const seen = new Map<string, number>();
  for (const m of reportText.matchAll(/^- (?:PASS|FAIL) — (W-[A-Z])/gm)) {
    seen.set(m[1]!, (seen.get(m[1]!) ?? 0) + 1);
  }
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([w]) => w);
  if (dups.length > 0) {
    throw new Error(
      `the census is illegal — refusing to print it:\n- witnesses [A-board letter guard]: ${dups.join(", ")} each headline two censuses — witness letters must be unique`,
    );
  }
}
