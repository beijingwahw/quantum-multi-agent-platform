/**
 * The census laws, G1-G5. The census is a book of rate rows; the laws exist
 * because the letter's own epoch-3 sentences are the canonical contraband:
 * "complexity O(1)" and "hit rate 100%" are each ONE face of a rate whose
 * other face is a price. A row that ships a face without its price does not
 * board (G1). The rest of the code is the family discipline: exactness must
 * be witnessed (G2), anchors must resolve (G3), the label vocabulary is
 * closed (G4), ids are unique (G5). The renderer refuses to print an illegal
 * census — the violations are named, not averaged away.
 */

import { existsSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export const LABELS = ["EXACT", "INTEGER-RATIO", "DATA", "QUOTED", "UNDEFINED"] as const;
export type Label = (typeof LABELS)[number];

export interface QuoteAnchor {
  /** workspace directory of the quoted repo, e.g. "postselect-sched" */
  readonly repo: string;
  /** report path inside that repo, e.g. "out/reports/t1-sorter.md" */
  readonly report: string;
}

export interface CensusRow {
  readonly id: string;
  /** what the row asserts, in the survived frame */
  readonly claim: string;
  readonly label: Label;
  /** the conditional-frame statement (what is true GIVEN the branch survived) */
  readonly conditionalFace: string;
  /** the unconditional yield / price statement (what each trial pays) */
  readonly unconditionalFace: string;
  /** witness id — required for EXACT and INTEGER-RATIO (G2) */
  readonly witnessId?: string;
  /** anchor for QUOTED rows — the repo+report the number is quoted from (G3) */
  readonly quote?: QuoteAnchor;
}

export interface Witness {
  readonly id: string;
  readonly description: string;
  readonly passed: boolean;
  readonly detail: string;
}

export interface Census {
  readonly rows: readonly CensusRow[];
  readonly witnesses: readonly Witness[];
}

export function auditCensus(census: Census, workspaceRoot: string): string[] {
  const violations: string[] = [];
  const witnessById = new Map(census.witnesses.map((w) => [w.id, w]));

  const ids = new Set<string>();
  for (const row of census.rows) {
    // G5 — unique ids
    if (ids.has(row.id)) violations.push(`G5: duplicate id '${row.id}'`);
    ids.add(row.id);

    // G1 — both faces, always: a single-face rate is the letter's own smuggling
    if (row.conditionalFace.trim() === "" || row.unconditionalFace.trim() === "") {
      violations.push(`G1: row '${row.id}' ships one face without the other (conditional/unconditional must both be non-empty)`);
    }

    // G4 — closed label vocabulary; UNDEFINED carries no numbers to witness
    if (!LABELS.includes(row.label)) {
      violations.push(`G4: row '${row.id}' uses illegal label '${String(row.label)}'`);
    }
    if (row.label === "UNDEFINED" && row.witnessId !== undefined) {
      violations.push(`G4: row '${row.id}' is UNDEFINED yet carries a witness — undefined faces have no numbers`);
    }

    // G2 — exactness is witnessed or it does not board
    if ((row.label === "EXACT" || row.label === "INTEGER-RATIO") && row.witnessId === undefined) {
      violations.push(`G2: row '${row.id}' claims ${row.label} without a witness id`);
    }
    if (row.witnessId !== undefined) {
      const w = witnessById.get(row.witnessId);
      if (w === undefined) violations.push(`G2: row '${row.id}' cites unknown witness '${row.witnessId}'`);
      else if (!w.passed) violations.push(`G2: row '${row.id}' cites witness '${row.witnessId}' which did NOT pass (${w.detail})`);
    }

    // G3 — quoted numbers resolve to a live repo and a real report on disk
    if (row.label === "QUOTED") {
      if (row.quote === undefined) {
        violations.push(`G3: row '${row.id}' is QUOTED without an anchor`);
      } else {
        const dir = isAbsolute(row.quote.repo) ? row.quote.repo : join(workspaceRoot, row.quote.repo);
        if (!existsSync(join(dir, "package.json"))) {
          violations.push(`G3: row '${row.id}' quotes repo '${row.quote.repo}' which has no package.json on disk`);
        }
        if (!existsSync(join(dir, row.quote.report))) {
          violations.push(`G3: row '${row.id}' quotes report '${row.quote.repo}/${row.quote.report}' which is not on disk`);
        }
      }
    }
    if (row.label !== "QUOTED" && row.quote !== undefined) {
      violations.push(`G4: row '${row.id}' carries a quote anchor but is not labeled QUOTED`);
    }
  }

  return violations;
}
