/** Exp3 — T3 CHSH rigidity: Horodecki vs direct optimization, Tsirelson, pure-state law. */

import { writeReport, mdTable, fmt, sci } from './report.js';
import {
  horodeckiSMax,
  optimizeChsh,
  classicalGameWinRate,
  chshGame,
  concurrence,
  pptMinEigenvalue,
} from '../protocol/chsh.js';
import { bellState, schmidtState, wernerFidelity, randomTwoQubitMixed, fromVec } from '../core/states.js';
import { makeRng } from '../core/rng.js';
import type { CMat } from '../core/cmat.js';
import { pathToFileURL } from "node:url";

function main(): void {
  const rng = makeRng(0xc4a7);
  const SQRT2X2 = 2 * Math.SQRT2;

  // (1) anchors: Horodecki formula vs direct optimization
  const anchorRows: string[][] = [];
  const addAnchor = (name: string, rho: CMat): void => {
    const formula = horodeckiSMax(rho);
    const opt = optimizeChsh(rho);
    anchorRows.push([name, fmt(formula, 10), fmt(opt.s, 8), sci(Math.abs(formula - opt.s))]);
  };
  for (const kind of ['phi+', 'psi-'] as const) addAnchor(`Bell |${kind}⟩`, fromVec(bellState(kind)));
  for (const f of [1.0, 0.9, 0.75, 1 / Math.SQRT2, 0.6, 0.5]) {
    addAnchor(`Werner F=${fmt(f, 6)}`, wernerFidelity(f));
  }

  // (2) Werner analytic law: S_max = 2√2·F; CHSH threshold at F = 1/√2
  const wernerRows: string[][] = [];
  let worstWernerGap = 0;
  for (let i = 0; i <= 20; i++) {
    const f = 0.5 + i * 0.025;
    const s = horodeckiSMax(wernerFidelity(f));
    const closed = SQRT2X2 * f;
    worstWernerGap = Math.max(worstWernerGap, Math.abs(s - closed));
    wernerRows.push([fmt(f, 4), fmt(s, 10), fmt(closed, 10)]);
  }
  const thresholdS = horodeckiSMax(wernerFidelity(1 / Math.SQRT2));

  // (3) pure-state law: S_max = 2√(1 + C²), C = sin 2γ
  const schmidtRows: string[][] = [];
  let worstSchmidtGap = 0;
  for (let i = 0; i <= 12; i++) {
    const gamma = (i / 12) * (Math.PI / 4);
    const rho = fromVec(schmidtState(gamma));
    const s = horodeckiSMax(rho);
    const c = concurrence(rho);
    const closed = 2 * Math.sqrt(1 + Math.sin(2 * gamma) ** 2);
    worstSchmidtGap = Math.max(worstSchmidtGap, Math.abs(s - closed), Math.abs(c - Math.sin(2 * gamma)));
    schmidtRows.push([fmt(gamma, 4), fmt(s, 10), fmt(closed, 10), fmt(c, 8)]);
  }

  // (4) random mixed states: formula vs optimizer
  let worstRandomGap = 0;
  let tsirelsonMax = 0;
  for (let i = 0; i < 30; i++) {
    const rho = randomTwoQubitMixed(rng, rng() * 0.8);
    const formula = horodeckiSMax(rho);
    const opt = optimizeChsh(rho);
    worstRandomGap = Math.max(worstRandomGap, Math.abs(formula - opt.s));
    tsirelsonMax = Math.max(tsirelsonMax, formula);
  }

  // (5) game form: W = 1/2 + S/8, MC on |Φ+⟩ with optimizer angles
  const phiPlus = fromVec(bellState('phi+'));
  const opt = optimizeChsh(phiPlus);
  const game = chshGame(phiPlus, opt.angles, 40000, rng);
  const wFromS = 0.5 + opt.s / 8;
  const wClassical = classicalGameWinRate();

  // (6) honest boundary: PPT-entangled but CHSH-local
  const w65 = wernerFidelity(0.65);
  const ppt65 = pptMinEigenvalue(w65);
  const s65 = horodeckiSMax(w65);

  writeReport(
    { name: 'exp3-rigidity', title: 'T3 — CHSH rigidity (Horodecki vs optimizer)' },
    {
      anchors: anchorRows.map(([n, f, o, e]) => ({ name: n, formula: Number(f), optimized: Number(o), err: Number(e) })),
      worstWernerGap,
      thresholdS,
      worstSchmidtGap,
      worstRandomGap,
      tsirelsonMax,
      game: { ...game, wFromS, wClassical },
      boundary: { f: 0.65, pptMin: ppt65, sMax: s65 },
    },
    `## Horodecki formula vs direct optimization

S_max(ρ) = 2√(u₁+u₂) (T-matrix eigenvalues) against a deterministic multistart
compass search over all four measurement directions:

${mdTable(['state', 'S_max formula', 'S optimized', '|err|'], anchorRows)}

Werner curve S_max = 2√2·F over F ∈ [0.5, 1.0]: worst deviation **${sci(worstWernerGap)}**;
at the CHSH threshold F = 1/√2 the formula gives S = ${fmt(thresholdS, 12)} (the
classical boundary 2, to machine precision — nonlocality threshold exact).

## Pure-state rigidity law: S_max = 2√(1 + C²)

${mdTable(['γ', 'S_max', '2√(1+sin²2γ)', 'concurrence'], schmidtRows)}

Worst deviation **${sci(worstSchmidtGap)}**. A CHSH violation on pure states
certifies entanglement and pins the Schmidt angle quantitatively — the exact
self-testing anchor behind rigidity-based verification.

## Random mixed states + Tsirelson

30 random mixed states: worst formula-vs-optimizer gap **${sci(worstRandomGap)}**.
Largest sampled S_max: ${fmt(tsirelsonMax, 12)} ≤ 2√2 = ${fmt(SQRT2X2, 12)} (Tsirelson;
analytic argument in docs/theory.md — sampling is a check, not the proof).

## Game form (MC, 40000 rounds, |Φ+⟩ with optimizer angles)

Empirical win rate ${fmt(game.winRate, 6)} vs formula W = 1/2 + S/8 = ${fmt(wFromS, 6)};
quantum optimum (2+√2)/4 = ${fmt((2 + Math.SQRT2) / 4, 6)}; best classical strategy = ${fmt(wClassical, 6)}.

## Honest boundary: entangled ≠ verifiable-by-CHSH

Werner F = 0.65: PPT minimum eigenvalue ${fmt(ppt65, 6)} (< 0 ⟹ entangled) yet
S_max = ${fmt(s65, 6)} < 2 (CHSH-local). CHSH verification is sufficient, not
necessary: noisy-but-honest devices can fail the rigidity check while being
genuinely quantum.
`,
  );
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
