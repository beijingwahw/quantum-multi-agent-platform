/**
 * The checker — the route-and-price discipline as a build gate.
 *
 * Laws enforced:
 *   R0. the dossier must be a dossier at all — every column the deeper laws
 *       dereference arrives with the promised shape; an unreadable column or
 *       element is named and excused from the laws that would crash on it,
 *       because a crash is not a rejection and smuggled rows can omit entire
 *       columns (v0.2.1: the shape law, closing the checker's last crash
 *       surface — before it, a milestones column of undefined took the whole
 *       audit down with a TypeError instead of a violation);
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
 *   R6. every dossier anchors to a row that exists in bqp-map's atlas;
 *   R7. every executed milestone pairs its sibling certificate with a PASSING
 *       cross-check witness of THIS repo — a price claimed without its own
 *       re-derivation is a counterfeit certificate, rejected by name.
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
 * `Dossier` type promises well-formed rows, but R0 and R2 exist precisely
 * because smuggled data can lie about that — so the checker's input widens
 * the verdict and every column the laws dereference to `unknown`, the shape
 * law names what cannot be read, and the guards stay. */
export type DossierInput = Omit<
  Dossier,
  "id" | "atlasRow" | "verdict" | "criteria" | "milestones" | "prices" | "citations"
> & {
  readonly id: unknown;
  readonly atlasRow: unknown;
  readonly verdict: unknown;
  readonly criteria: unknown;
  readonly milestones: unknown;
  readonly prices: unknown;
  readonly citations: unknown;
};

// --- the R0 shape layer: unknown runtime data -> readable rows, named drops ---

const isStr = (v: unknown): v is string => typeof v === "string";
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const asArray = (v: unknown): readonly unknown[] | undefined =>
  Array.isArray(v) ? (v as readonly unknown[]) : undefined;

/** How an unreadable value shows up in a rejection — quoted if it is a
 * string, its typeof otherwise; never a crash, never a silent coercion. */
const showValue = (v: unknown): string => (typeof v === "string" ? `"${v}"` : `<${typeof v}>`);

/** The readable core of a row after R0 — exactly the columns R1-R7 read. */
interface ShapedCriterion {
  readonly id: string;
  readonly anchor: string;
}
interface ShapedPrice {
  readonly id: string;
  readonly amount: string;
}
interface ShapedExecution {
  readonly repo: string;
  readonly certificate: string;
  readonly crossCheck: string;
}
interface ShapedMilestone {
  readonly id: string;
  readonly anchor: string;
  readonly falsifier: string;
  readonly price: string;
  readonly execution?: ShapedExecution;
}
interface ShapedDossier {
  readonly id: string;
  readonly atlasRow: string | undefined;
  readonly verdict: unknown;
  readonly criteria: readonly ShapedCriterion[];
  readonly milestones: readonly ShapedMilestone[];
  readonly prices: readonly ShapedPrice[];
  readonly citations: readonly string[];
}

/** R0 for one row: name every unreadable column and element, return the
 * readable core for the deeper laws. Dropped elements are named, never
 * silently skipped — the violation stands on its own. */
function shapedRow(row: DossierInput, out: Violation[]): ShapedDossier {
  const id = isStr(row.id) ? row.id : "UNREADABLE-ID";
  const r0 = (detail: string): void => {
    out.push({ dossierId: id, law: "R0", detail });
  };
  if (!isStr(row.id)) r0("the dossier's own id is not a string — its violations are filed under UNREADABLE-ID");
  if (!isStr(row.atlasRow)) r0("the atlas row anchor is not a string — R6 cannot test wiring it cannot read");

  const criteria: ShapedCriterion[] = [];
  const rawCriteria = asArray(row.criteria);
  if (rawCriteria === undefined) {
    r0("the criteria column is missing — no demonstration is even demanded");
  } else {
    rawCriteria.forEach((raw, i) => {
      if (!isRecord(raw) || !isStr(raw.id) || !isStr(raw.anchor)) {
        r0(`criterion[${i}] is unreadable (id or anchor missing/mistyped) — dropped from R4`);
      } else {
        criteria.push({ id: raw.id, anchor: raw.anchor });
      }
    });
  }

  const milestones: ShapedMilestone[] = [];
  const rawMilestones = asArray(row.milestones);
  if (rawMilestones === undefined) {
    r0("the milestones column is missing — the route itself is absent; R1/R3/R4/R7 have nothing lawful to read");
  } else {
    rawMilestones.forEach((raw, i) => {
      const name = isRecord(raw) && isStr(raw.id) ? raw.id : `milestone[${i}]`;
      if (!isRecord(raw) || !isStr(raw.id) || !isStr(raw.anchor) || !isStr(raw.falsifier) || !isStr(raw.price)) {
        r0(`${name} is unreadable (id/anchor/falsifier/price missing or mistyped) — dropped from R1/R3/R4/R7`);
        return;
      }
      let execution: ShapedExecution | undefined;
      const x = raw.execution;
      if (x !== undefined) {
        if (!isRecord(x) || !isStr(x.repo) || !isStr(x.certificate) || !isStr(x.crossCheck)) {
          r0(`${name} carries an unreadable execution record (repo/certificate/crossCheck missing or mistyped) — the certificate claim is refused until the record can be read`);
        } else {
          execution = { repo: x.repo, certificate: x.certificate, crossCheck: x.crossCheck };
        }
      }
      milestones.push(
        execution === undefined
          ? { id: raw.id, anchor: raw.anchor, falsifier: raw.falsifier, price: raw.price }
          : { id: raw.id, anchor: raw.anchor, falsifier: raw.falsifier, price: raw.price, execution },
      );
    });
  }

  const prices: ShapedPrice[] = [];
  const rawPrices = asArray(row.prices);
  if (rawPrices === undefined) {
    r0("the prices column is missing — no price to audit");
  } else {
    rawPrices.forEach((raw, i) => {
      if (!isRecord(raw) || !isStr(raw.id) || !isStr(raw.amount)) {
        r0(`price[${i}] is unreadable (id or amount missing/mistyped) — dropped from R1`);
      } else {
        prices.push({ id: raw.id, amount: raw.amount });
      }
    });
  }

  const citations: string[] = [];
  const rawCitations = asArray(row.citations);
  if (rawCitations === undefined) {
    r0("the citations column is missing — the bibliography wiring cannot be checked");
  } else {
    for (const raw of rawCitations) {
      if (!isStr(raw)) r0("a citation is not a string — dropped from R4");
      else citations.push(raw);
    }
  }

  return {
    id,
    atlasRow: isStr(row.atlasRow) ? row.atlasRow : undefined,
    verdict: row.verdict,
    criteria,
    milestones,
    prices,
    citations,
  };
}

export function checkDossiers(rows: readonly DossierInput[] = DOSSIERS): Violation[] {
  const violations: Violation[] = [];

  const bibPath = resolve(REPO_ROOT, "docs", "theory.md");
  const bib = [...readFileSync(bibPath, "utf8").matchAll(/^\s*-\s*\*\*([A-Z0-9]+)\*\*/gm)].map((m) => m[1] as string);

  const atlasPath = resolve(WORKSPACE_ROOT, "bqp-map", "src", "atlas", "entries.ts");
  const atlas = existsSync(atlasPath) ? readFileSync(atlasPath, "utf8") : "";

  for (const raw of rows) {
    // R0 — the shape law: a row that is not even an object is named, not crashed on
    if (!isRecord(raw)) {
      violations.push({ dossierId: "UNREADABLE-ID", law: "R0", detail: "a dossier row is not even an object — no law can read it" });
      continue;
    }
    const d = shapedRow(raw, violations);

    // R2 — the repo that cannot settle
    if (d.verdict !== "OPEN-ROUTE") {
      violations.push({ dossierId: d.id, law: "R2", detail: `verdict ${showValue(d.verdict)} — this repo can only express OPEN-ROUTE` });
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

    // R6 — the dossier stays wired to the atlas (skipped only when R0 already
    // named the atlas row unreadable — a sentinel string would be noise)
    if (d.atlasRow !== undefined && !atlas.includes(`id: "${d.atlasRow}"`)) {
      violations.push({ dossierId: d.id, law: "R6", detail: `atlas row "${d.atlasRow}" not found in bqp-map entries.ts` });
    }

    // R7 — executions must carry their own cross-check (v0.2.0): a milestone
    // may cite a sibling's certificate only together with a witness of THIS
    // repo that exists and passes — and the sibling repo must exist on disk.
    for (const m of d.milestones) {
      const x = m.execution;
      if (x === undefined) continue;
      if (!existsSync(resolve(WORKSPACE_ROOT, x.repo))) {
        violations.push({ dossierId: d.id, law: "R7", detail: `milestone ${m.id} cites repo ${x.repo} missing on disk — no such certificate source` });
      }
      if (x.certificate.trim().length === 0) {
        violations.push({ dossierId: d.id, law: "R7", detail: `milestone ${m.id} claims execution without naming its sibling certificate` });
      }
      const w = witnessById(x.crossCheck);
      if (w === undefined) {
        violations.push({ dossierId: d.id, law: "R7", detail: `milestone ${m.id} claims execution via cross-check ${x.crossCheck} — no such witness in this repo (counterfeit certificate)` });
      } else if (!w.pass) {
        violations.push({ dossierId: d.id, law: "R7", detail: `milestone ${m.id} cites cross-check ${x.crossCheck}, which FAILS — the certificate is not backed` });
      }
    }
  }

  return violations;
}

/** Resolve a witness id to its result (undefined = no such witness). The
 * R7 path caches one run per process — witness results do not depend on the
 * dossier data under audit, and W-A's quadrature should not run per row. */
let witnessCache: ReturnType<typeof runWitnesses> | undefined;
function witnessById(id: string): ReturnType<typeof runWitnesses>[number] | undefined {
  witnessCache ??= runWitnesses();
  return witnessCache.find((w) => w.id === id);
}
