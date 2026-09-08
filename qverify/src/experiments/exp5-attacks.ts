/** Exp5 — T5 optimal attacks: Helstrom, BB84 games, ½ wall, optimal-copy price tag, noisy-device census. */

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
import { noiseCensusRow, noiseCensusSweep, dampedGuessOptimized } from '../protocol/noise.js';

export function main(): void {
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

  // (e) v0.2 noisy-device census: attack games under a second noise model
  const gammas = Array.from({ length: 9 }, (_, k) => k / 8);
  const noiseRows = gammas.map((gamma) => noiseCensusRow(gamma));
  const noiseSweep = noiseCensusSweep(gammas);
  const guessOptAtHalf = dampedGuessOptimized(0.5);
  const guessNumericAtHalf = noiseRows.find((r) => Math.abs(r.gamma - 0.5) < 1e-12)?.guessAfterAmpDamp ?? NaN;

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
      noiseCensus: { rows: noiseRows, sweep: noiseSweep, guessOptAtHalf, guessNumericAtHalf },
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

## (e) v0.2 Noisy-device census: the games under a second noise model

The v0.1 games are noiseless; here the trap calculus and the guessing game run
under amplitude damping and phase damping applied to the trap qubit:

${mdTable(
  ['γ', 'amp.accept (formula)', 'amp.accept (direct)', 'amp.accept (expansion)', 'phase.accept (1−γ)', 'phase.accept (direct)', 'guess amp.', 'guess phase', 'phase closed'],
  noiseRows.map((r) => [
    fmt(r.gamma, 3),
    fmt(r.ampDampFormula, 10),
    fmt(r.ampDampDirect, 10),
    fmt(r.ampDampExpansion, 10),
    fmt(r.phaseDampFormula, 10),
    fmt(r.phaseDampDirect, 10),
    fmt(r.guessAfterAmpDamp, 10),
    fmt(r.guessAfterPhaseDamp, 10),
    fmt(r.phaseDampGuessClosed, 10),
  ]),
)}

- **Phase damping is detected with certainty**: acceptance = 1 − γ exactly (closed
  form vs both T2 referees agree to ${sci(noiseSweep.worstPhaseDampRefereeGap)}) —
  the T2 Z-tier firing on a physical noise model: Z|+θ⟩ is the orthogonal state,
  so every dephasing event fails the revealed-basis test (⟨+θ|Z|+θ⟩ = 0 is
  exactly why). t traps catch damping rate 1−(1−γ)^t, exponential as designed.
- **Amplitude damping is only half-seen**: acceptance = (1+√(1−γ))²/4 + γ/4
  exactly (E₁ = √γ(X+iY)/2 sits in the half-detected tier, E₀'s Z part is
  invisible); formula vs both referees agree to ${sci(noiseSweep.worstAmpDampRefereeGap)}.
  At γ = 1 acceptance is exactly ½ — half of a full decay is forever undetectable
  by the isolated trap.
- **Guessing under noise**: after phase flips p*(γ) = (1+|1−2γ|·sin π/8)/2 exactly
  (worst gap ${sci(noiseSweep.worstPhaseGuessGap)}) — a V, not a line: flips are
  unitary, so at γ = 1 the pair maps to an equally-distinguishable flipped pair
  (p* back to ${fmt((1 + Math.sin(Math.PI / 8)) / 2, 6)}) while the trap rejects every flip
  (acceptance 0) — **coherent noise decouples detection from leakage**; only the
  incoherent midpoint γ = 1/2 destroys both (p* = ½). After amplitude damping the
  pair is computed numerically; endpoints exact: p*(0) = (1+sin π/8)/2 =
  ${fmt((1 + Math.sin(Math.PI / 8)) / 2, 12)}, p*(1) = ½ (both states decay to
  |0⟩ — decay, unlike flipping, erases the phase bit). POVM-optimizer referee at
  γ = 0.5: ${fmt(guessOptAtHalf, 10)} vs trace-norm ${fmt(guessNumericAtHalf, 10)}
  (gap ${sci(Math.abs(guessOptAtHalf - guessNumericAtHalf))}).
`,
  );
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
