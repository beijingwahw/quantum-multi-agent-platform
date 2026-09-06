/**
 * The checker — the route-and-price discipline as a build gate.
 *
 * Laws enforced:
 *   R1. every milestone books a price, every price line carries an amount —
 *       numbers never travel without costs (the depreciation-ledger's L1, scoped
 *       to route items: no free rides even for number-free lines);
 *   R2. the only expressible verdict is OPEN-ROUTE — a dossier that claims
 *       settledness is rejected by name (the L2 mirror: this repo CANNOT settle);
 *   R3. every milestone names its own falsifier — a route without a failure
 *       mode is marketing;
 *   R4. every citation resolves in docs/theory.md's verified bibliography, and
 *       every local anchor points at a workspace prototype that exists on disk;
 *   R5. the executable witnesses pass — quoted arithmetic is two-path;
 *   R6. every dossier anchors to a row that exists in bqp-map's atlas.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOSSIERS, type Dossier } from "./dossier.js";
import { runWitnesses } from "./witnesses.js";

export const WORKSPACE_ROOT = resolve(process.cwd(), "..");
const REPO_ROOT = process.cwd();

export interface Violation {
  readonly dossierId: string;
  readonly law: string;
  readonly detail: string;
}

/** What reaches the audit boundary: dossiers as they arrive at runtime. The
 * `Dossier` type promises verdict = OPEN-ROUTE, but R2 exists precisely
 * because smuggled data can lie about that — so the checker's input widens
 * verdict to plain string and the guard stays. */
export type DossierInput = Omit<Dossier, "verdict"> & { readonly verdict: string };

export function checkDossiers(rows: readonly DossierInput[] = DOSSIERS): Violation[] {
  const violations: Violation[] = [];

  const bibPath = resolve(REPO_ROOT, "docs", "theory.md");
  const bib = [...readFileSync(bibPath, "utf8").matchAll(/^\s*-\s*\*\*([A-Z0-9]+)\*\*/gm)].map((m) => m[1] as string);

  const atlasPath = resolve(WORKSPACE_ROOT, "bqp-map", "src", "atlas", "entries.ts");
  const atlas = existsSync(atlasPath) ? readFileSync(atlasPath, "utf8") : "";

  for (const d of rows) {
    // R2 — the repo that cannot settle
    if (d.verdict !== "OPEN-ROUTE") {
      violations.push({ dossierId: d.id, law: "R2", detail: `verdict ${String(d.verdict)} — this repo can only express OPEN-ROUTE` });
    }

    // R1 — prices booked
    for (const m of d.milestones) {
      if (m.price.trim().length === 0) {
        violations.push({ dossierId: d.id, law: "R1", detail: `milestone ${m.id} books no price` });
      }
    }
    for (const p of d.prices) {
      if (p.amount.trim().length === 0) {
        violations.push({ dossierId: d.id, law: "R1", detail: `price line ${p.id} carries no amount` });
      }
    }

    // R3 — falsifiers mandatory
    for (const m of d.milestones) {
      if (m.falsifier.trim().length === 0) {
        violations.push({ dossierId: d.id, law: "R3", detail: `milestone ${m.id} names no falsifier — a route without a failure mode is marketing` });
      }
    }

    // R4 — anchors resolve
    for (const anchor of [...d.milestones.map((m) => m.anchor), ...d.criteria.map((c) => c.anchor)]) {
      if (anchor.startsWith("cite:")) {
        const id = anchor.slice("cite:".length);
        if (!bib.includes(id)) {
          violations.push({ dossierId: d.id, law: "R4", detail: `citation ${id} not in docs/theory.md bibliography` });
        }
      } else if (anchor.startsWith("local:")) {
        const repo = anchor.slice("local:".length).split(/\s+/)[0] as string;
        if (!existsSync(resolve(WORKSPACE_ROOT, repo))) {
          violations.push({ dossierId: d.id, law: "R4", detail: `local anchor ${repo} missing on disk` });
        }
      } else {
        violations.push({ dossierId: d.id, law: "R4", detail: `anchor "${anchor}" is neither cite: nor local:` });
      }
    }
    for (const id of d.citations) {
      if (!bib.includes(id)) {
        violations.push({ dossierId: d.id, law: "R4", detail: `citations list id ${id} not in docs/theory.md bibliography` });
      }
    }

    // R6 — the dossier stays wired to the atlas
    if (!atlas.includes(`id: "${d.atlasRow}"`)) {
      violations.push({ dossierId: d.id, law: "R6", detail: `atlas row "${d.atlasRow}" not found in bqp-map entries.ts` });
    }
  }

  return violations;
}

export function witnessVerdicts(): { pass: boolean; failures: readonly string[] } {
  const results = runWitnesses();
  const failures = results.filter((r) => !r.pass).map((r) => `${r.name}: ${r.detail}`);
  return { pass: failures.length === 0, failures };
}
