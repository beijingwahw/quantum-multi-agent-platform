/** Exp2 — T2 trap detection calculus: formula vs referees, tightness, blind spot. */

import { writeReport, mdTable, fmt, sci } from './report.js';
import {
  trapAcceptanceFormula,
  trapAcceptanceDirect,
  trapAcceptanceExpansion,
  rejectionLowerBound,
  xAttack,
  randomChannel,
  multiTrapAcceptance,
  garbageBlindSpot,
} from '../protocol/traps.js';
import { makeRng } from '../core/rng.js';
import { identity } from '../core/cmat.js';
import { PAULI_X, PAULI_Y, PAULI_Z } from '../core/states.js';
import { pathToFileURL } from "node:url";

export function main(): void {
  const rng = makeRng(0x7a99);

  // (1) three-way agreement on random channels
  const rows: string[][] = [];
  let worstFormulaGap = 0;
  let worstBoundSlack = 0;
  for (let i = 0; i < 60; i++) {
    const k = 1 + rng.int(4);
    const kraus = randomChannel(rng, k);
    const formula = trapAcceptanceFormula(kraus);
    const direct = trapAcceptanceDirect(kraus);
    const expansion = trapAcceptanceExpansion(kraus);
    const bound = rejectionLowerBound(kraus);
    const reject = 1 - formula;
    worstFormulaGap = Math.max(worstFormulaGap, Math.abs(formula - direct), Math.abs(formula - expansion));
    worstBoundSlack = Math.max(worstBoundSlack, reject - bound); // must be ≥ 0
    if (i < 8) {
      rows.push([String(k), fmt(formula, 12), fmt(direct, 12), fmt(expansion, 12), fmt(1 - formula, 6), fmt(bound, 6)]);
    }
  }

  // (2) tier structure: Pauli anchors
  const tiers = [
    { name: 'I (identity)', acc: trapAcceptanceFormula([identity(2)]) },
    { name: 'X', acc: trapAcceptanceFormula([PAULI_X]) },
    { name: 'Y', acc: trapAcceptanceFormula([PAULI_Y]) },
    { name: 'Z', acc: trapAcceptanceFormula([PAULI_Z]) },
  ];

  // (3) tightness: X-attack family acceptance = 1 − q/2
  const xRows: string[][] = [];
  for (const q of [0.1, 0.25, 0.5, 0.75, 1.0]) {
    const acc = trapAcceptanceFormula(xAttack(q));
    xRows.push([fmt(q, 2), fmt(acc, 12), fmt(1 - q / 2, 12), sci(Math.abs(acc - (1 - q / 2)))]);
  }

  // (4) multi-trap exponential detection (worst X-attack q=1)
  const tRows: string[][] = [];
  for (const t of [1, 2, 4, 8, 12, 16, 20]) {
    tRows.push([String(t), fmt(multiTrapAcceptance(xAttack(1), t), 12)]);
  }

  // (5) blind spot
  const spot = garbageBlindSpot(rng);

  writeReport(
    { name: 'exp2-traps', title: 'T2 — trap detection calculus (exact)' },
    {
      worstThreeWayGap: worstFormulaGap,
      worstBoundSlack,
      tiers,
      xAttack: xRows.map(([q, acc, closed, err]) => ({ q: Number(q), acc: Number(acc), closed: Number(closed), err: Number(err) })),
      multiTrap: tRows.map(([t, acc]) => ({ t: Number(t), acc: Number(acc) })),
      blindSpot: spot,
    },
    `## Three-way machine agreement

p̄(Λ) = Σ_j |c_{j,I}|² + ½ Σ_j |c_{j,X}|², checked against the density-matrix
referee and the Pauli-expansion referee on 60 random CPTP maps (Kraus count
1–4). Worst three-way discrepancy: **${sci(worstFormulaGap)}**. Worst violation
of the bound p̄_reject ≥ ½(1 − idMass): **${sci(worstBoundSlack)}** (must be ≥ 0).

Sample (first 8 channels):

${mdTable(['k Kraus', 'formula', 'density-matrix', 'Pauli expansion', 'reject', 'bound ½(1−idMass)'], rows)}

## Three-tier structure (Pauli anchors)

${mdTable(
  ['deviation', 'p̄_accept'],
  tiers.map((t) => [t.name, fmt(t.acc, 12)]),
)}

Z deviations are detected **with certainty** (⟨+θ|Z|+θ⟩ = 0 at every secret
angle); X and Y deviations are each detected with probability exactly ½
(⟨X⟩ = cos θ, ⟨Y⟩ = sin θ average to zero over the secret angles); the identity
is invisible. The trap is a perfect Z-detector, half-blind to X and Y, blind
only to doing nothing.

## Tightness: the X-attack {√(1−q) I, √q X}

${mdTable(['q', 'p̄_accept', 'closed form 1 − q/2', '|err|'], xRows)}

The bound ½(1 − idMass) is attained exactly by this family — no uniform
improvement is possible.

## t independent traps (worst case: q = 1 X-attack, per-trap acceptance ½)

${mdTable(['t', 'acceptance = (1/2)^t'], tRows)}

At t = 20 the worst non-identity attack survives with probability < 1e-6.

## Honest blind spot

Arbitrary unitary attack on a garbage qubit never touching the trap:
acceptance = ${fmt(spot.trapAcceptance, 12)} (exactly 1), garbage qubit
disturbed (fidelity ${fmt(spot.garbageFidelity, 6)}). Traps constrain only what
they touch — the full FK layout interleaves traps with the computation and
adds output checks for this reason (cited result, not re-proved here).
`,
  );
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
