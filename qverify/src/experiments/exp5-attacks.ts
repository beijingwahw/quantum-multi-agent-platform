/** Exp5 — T5 optimal attacks: Helstrom, BB84 games, ½ wall, optimal-copy price tag. */

import { writeReport, mdTable, fmt, sci } from './report.js';
import {
  equatorialPairHelstrom,
  equatorialPairHelstromClosed,
  helstromTwoOptimize,
  bb84LabelGame,
  bb84BitGame,
  projectorSumIdentity,
  commitRevealMC,
  helstromTwo,
} from '../protocol/attacks.js';
import { fromVec, equatorial } from '../core/states.js';
import { pathToFileURL } from "node:url";
import {
  shrinkAcceptanceCurve,
  shrinkIsometryError,
  shrinkDeferredGuess,
  shrinkTrapAcceptanceAveraged,
} from '../protocol/cloner.js';

function main(): void {
  // (a) Helstrom pair game: formula vs closed form vs POVM optimizer
  const pairFormula = equatorialPairHelstrom();
  const pairClosed = equatorialPairHelstromClosed();
  const pairOpt = helstromTwoOptimize(fromVec(equatorial(0)), fromVec(equatorial(Math.PI / 4)));

  // (b) BB84 label game (PGM ½, dual-certified) and bit game ((2+√2)/4)
  const label = bb84LabelGame();
  const bit = bb84BitGame();

  // (d) commit-then-reveal wall
  const wall = projectorSumIdentity();
  const wallMC = commitRevealMC(20000, 0x9a11);

  // (c) optimal universal keep-a-copy attack (exact shrink channel)
  const isometryError = shrinkIsometryError();
  const acceptanceCurve = shrinkAcceptanceCurve();
  const acceptanceAveraged = shrinkTrapAcceptanceAveraged();
  const deferred = shrinkDeferredGuess();
  const deferredDirect = helstromTwo(fromVec(equatorial(0)), fromVec(equatorial(Math.PI / 4)));

  writeReport(
    { name: 'exp5-attacks', title: 'T5 — optimal attack games (exact)' },
    {
      helstromPair: { formula: pairFormula, closed: pairClosed, optimized: pairOpt },
      bb84Label: label,
      bb84Bit: bit,
      wall: { ...wall, mc: wallMC },
      shrinkAttack: {
        isometryError,
        acceptanceCurve,
        acceptanceAveraged,
        deferred,
        deferredDirect,
      },
    },
    `## (a) Helstrom: |+_θ⟩ vs |+_{θ+π/4}⟩

Trace-norm formula ${fmt(pairFormula, 12)} · closed form (1+sin π/8)/2 = ${fmt(pairClosed, 12)} ·
direct POVM optimization ${fmt(pairOpt, 12)} — agreement to ${sci(Math.abs(pairFormula - pairOpt))}.

## (b) BB84: two games, two constants

- **label game** ("which of the four states?"): PGM success = ${fmt(label.pgmSuccess, 12)},
  dual feasible Γ = I/4 certifies optimality ≤ ${fmt(label.dualUpperBound, 12)} —
  the optimum is exactly **½**
- **bit game** ("which bit, basis unknown?"): Helstrom = ${fmt(bit.helstrom, 12)},
  closed form ½ + √2/4 = ${fmt(bit.closed, 12)}, POVM optimizer = ${fmt(bit.optimized, 12)} —
  the SAME constant (2+√2)/4 ≈ 0.853553 as the quantum CHSH game value: both are
  the 22.5° geometry of √2

## (d) Commit-then-reveal wall

Projector-sum identity ‖(1/8)Σ_θ Π_θ⁺ − I/2‖ = ${sci(wall.maxDeviation)}.
MC with random attacking channels (20000 trials): acceptance =
${fmt(wallMC.acceptance, 6)} ± ${fmt(wallMC.stdErr, 6)}. Any returned-qubit strategy
passes with probability exactly ½ — commit-before-reveal is a hard wall.

## (c) Optimal universal keep-a-copy attack (exact, no optimization)

The shrink-(2/3) channel {√(3/4)I, √(1/12)X, √(1/12)Y, √(1/12)Z} is the optimal
individual-copy attack (Bužek–Hillery 5/6 universal-fidelity bound, cited).
Machine-verified here:

- Stinespring isometry error ‖V₀†V₀ − I‖ = ${sci(isometryError)}
- trap acceptance at every secret angle:

${mdTable(
  ['θ', 'acceptance'],
  acceptanceCurve.map((p) => [fmt(p.theta, 4), fmt(p.acceptance, 12)]),
)}

  **Constant 5/6 = ${fmt(5 / 6, 12)}** at every θ (worst deviation
  ${sci(Math.max(...acceptanceCurve.map((p) => Math.abs(p.acceptance - 5 / 6))))}); the
  T2-averaged referee gives ${fmt(acceptanceAveraged, 12)}.
- deferred guess on the kept environment: Helstrom = ${fmt(deferred.helstrom, 12)},
  closed form (1+⅔sin π/8)/2 = ${fmt(0.5 * (1 + (2 / 3) * Math.sin(Math.PI / 8)), 12)};
  measuring the untouched original would give ${fmt(deferredDirect, 12)}.

**Exchange rate (exact):** keeping an optimal copy costs a constant **1/6
detection risk per trap** and buys a deferred guessing edge of
${fmt(deferred.helstrom - 0.5, 6)} over blind guessing (vs ${fmt(deferredDirect - 0.5, 6)}
for holding the original). The symmetric two-clone BH machine (both clones at
exactly 5/6) is cited, not reconstructed here.
`,
  );
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
