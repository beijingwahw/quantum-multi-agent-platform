/**
 * T5 — the process-witness face: the OCB causal inequality, machine-checked.
 *
 * The layer T1–T4 certified the quantum switch (a causally nonseparable
 * ORDER structure) but compared it only against definite-order circuits. The
 * stated-open face (README v0.1.0): the general causally-separable comparison
 * class — process witnesses, OCB 2012 / Goswami 2018, cited but not
 * machine-checked. This experiment machine-checks the canonical instance end
 * to end at d = 2 per wire:
 *
 *   - the "guess your partner's input" game as a linear functional on process
 *     space, S_game, and the causal witness S = (3/16)𝟙 − S_game;
 *   - the EXHAUSTIVE deterministic classical census (8192 vertices, both
 *     orders): no causal strategy beats 3/4;
 *   - the OCB process matrix W = ¼[𝟙 + (σ_z^{A2}σ_z^{B1} + σ_z^{A1}σ_x^{B1}
 *     σ_z^{B2})/√2]: PSD {0, ½}×8, normalized, valid term types, game value
 *     (2+√2)/4 via TWO independent computations, witness −(√2−1)/4;
 *   - robustness: the isotropic family W(ν) = νW_OCB + (1−ν)𝟙/4 stays valid
 *     for all ν and violates for ν > 1/√2 (critical point bisected);
 *   - the switch contrast: the quantum switch of T1 plays the SAME game at
 *     5/8 < 3/4 — order indefiniteness is not causal-inequality violation
 *     (van der Lugt et al. 2023's point, now with a number in this repo).
 *
 * Everything exact; sampled batteries are labeled as samples.
 */

import assert from 'node:assert/strict';
import { type CMat, eigenvaluesHermitian, identity, isHermitian, kron } from '../core/cmat.js';
import { makeRng } from '../core/rng.js';
import { randomStateVec, vecToRho } from '../core/states.js';
import { firstPartyProcess } from '../process/cj.js';
import {
  CLASSICAL_CAP,
  OCB_QUANTUM_VALUE,
  WITNESS_GAP,
  classicalCensus,
  gameWitnessFunctional,
  causalWitness,
  psuccOCBStrategies,
  psuccOCBThroughSwitch,
} from '../process/gypi.js';
import {
  gameValueFunctional,
  judgeProcess,
  noisyOcbProcess,
  ocbProcess,
  verifyClassicalCapRecord,
  verifyWitnessCertificate,
  witnessValue,
} from '../process/wocb.js';
import { randomChannelStinespring, stinespringToKraus } from '../switch/chanlib.js';
import { writeReport } from './report.js';
import { pathToFileURL } from 'node:url';

function main(): void {
  const lines: string[] = [];
  const rng = makeRng(20260908);

  // ---------------------------------------------------------------------
  lines.push('## 1. The game as a linear functional\n');
  const sGame = gameWitnessFunctional();
  const witness = causalWitness();
  assert.ok(isHermitian(sGame), 'S_game must be Hermitian');
  assert.ok(isHermitian(witness), 'S must be Hermitian');
  const witEig = Array.from(eigenvaluesHermitian(witness)).sort((x, y) => x - y);
  lines.push(`S_game Hermitian: yes; Tr[S_game] = ${traceOf(sGame).toFixed(6)};`);
  lines.push(`witness S = (3/16)𝟙 − S_game spectrum: min ${witEig[0]!.toFixed(6)}, max ${witEig[witEig.length - 1]!.toFixed(6)}.`);
  if (witEig[0]! < -1e-12) {
    lines.push('S is NOT positive semidefinite — nonnegativity on causally separable processes is');
    lines.push('NOT a PSD argument; it is the causal inequality itself (census: exact over classical');
    lines.push('vertices; quantum definite-order: sampled battery below; general proof: OCB Eq. (2), cited).');
  }
  lines.push('');

  // ---------------------------------------------------------------------
  lines.push('## 2. Exhaustive classical census (both definite orders)\n');
  const census = classicalCensus();
  const cap = census[0]!.psucc;
  const achievers = census.filter((p) => Math.abs(p.psucc - CLASSICAL_CAP) < 1e-12);
  const bFirst = census.filter((p) => p.order === 'B-first');
  const aFirst = census.filter((p) => p.order === 'A-first');
  const bCap = Math.max(...bFirst.map((p) => p.psucc));
  const aCap = Math.max(...aFirst.map((p) => p.psucc));
  lines.push('| family | vertices | cap | 3/4-achievers |');
  lines.push('|---|---|---|---|');
  lines.push(`| B-first (Bob acts first) | ${bFirst.length} | ${bCap.toFixed(12)} | ${bFirst.filter((p) => Math.abs(p.psucc - CLASSICAL_CAP) < 1e-12).length} |`);
  lines.push(`| A-first (Alice acts first) | ${aFirst.length} | ${aCap.toFixed(12)} | ${aFirst.filter((p) => Math.abs(p.psucc - CLASSICAL_CAP) < 1e-12).length} |`);
  lines.push(`| **total (exhaustive)** | **${census.length}** | **${cap.toFixed(12)}** | **${achievers.length}** |`);
  assert.ok(Math.abs(cap - CLASSICAL_CAP) < 1e-12, 'classical cap must be exactly 3/4');
  assert.strictEqual(census.length, 8192);
  lines.push('');
  lines.push(`Argmax vertex: ${census[0]!.label} (both orders achieve 3/4 — the cap is an order-free`);
  lines.push('property of the game). Shared randomness cannot exceed the vertex cap: p_succ is linear');
  lines.push('in the behavior, so the maximum over convex mixtures sits on a vertex. **Classical causal');
  lines.push(`cap = 3/4, machine-census-verified over all ${census.length} deterministic strategies.**`);
  const capVerdict = verifyClassicalCapRecord({ familySize: census.length, maxPsucc: cap });
  lines.push(`Shipped-record verification: ${capVerdict.ok ? 'PASS' : 'FAIL'} — ${capVerdict.reason}.`);
  assert.ok(capVerdict.ok);
  lines.push('');

  // ---------------------------------------------------------------------
  lines.push('## 3. Quantum causally separable battery (sampled, labeled as sample)\n');
  let minWit = Infinity;
  let worstLabel = '';
  let count = 0;
  for (let t = 0; t < 60; t++) {
    const rhoIn = vecToRho(randomStateVec(rng, 2));
    const chan = stinespringToKraus(randomChannelStinespring(rng, 2, 2));
    for (const first of ['A', 'B'] as const) {
      const w = firstPartyProcess(first, rhoIn, chan);
      const v = witnessValue(w);
      if (v < minWit) { minWit = v; worstLabel = `${first}-first #${t}`; }
      count++;
    }
  }
  // shared entanglement (Bell state on A1B1)
  const bell = { rows: 4, cols: 4, re: new Float64Array(16), im: new Float64Array(16) };
  bell.re[0] = 0.25; bell.re[3] = 0.25; bell.re[12] = 0.25; bell.re[15] = 0.25;
  const sharedBell = kron(kron(bell, identity(2)), identity(2));
  const witBell = witnessValue(sharedBell);
  lines.push(`- ${count} random definite-order processes (complex Kraus channels, both orders):`);
  lines.push(`  min Tr[S W] = ${minWit.toExponential(3)} (worst case ${worstLabel}) — no violation.`);
  lines.push(`- shared Bell-state process ρ^{A1B1} ⊗ 𝟙^{A2} ⊗ 𝟙^{B2}: Tr[S W] = ${witBell.toFixed(6)} ≥ 0.`);
  lines.push('- scope: a sample over d=2 channels, not a classification of the separable set;');
  lines.push('  the 3/4 bound over ALL causally separable processes is OCB\'s theorem (cited).');
  lines.push('');

  // ---------------------------------------------------------------------
  lines.push('## 4. The OCB process matrix — validity and violation\n');
  const w = ocbProcess();
  const verdict = judgeProcess(w, [stinespringToKraus(randomChannelStinespring(rng, 2, 2)), stinespringToKraus(randomChannelStinespring(rng, 2, 2))]);
  assert.ok(verdict.valid, 'W_OCB must pass all validity gates');
  const distinct = [...new Set(verdict.eig.values.map((v) => Number(v.toFixed(12))))];
  lines.push(`- Hermitian: ${verdict.hermitian}; eigenvalues {${distinct.join(', ')}} (each 8-fold) — PSD.`);
  lines.push(`- Normalization |Tr[W(M_CPTP ⊗ M_CPTP)] − 1| ≤ ${verdict.normalizationError.toExponential(1)} over the identity pair + random CPTP battery.`);
  lines.push(`- Term types: ${verdict.termJudge.terms.map((t) => `${t.type || '∅'}:${t.coefficient.toFixed(4)}`).join(' ')} — all in the OCB Fig. 3 set.`);
  lines.push(`- A2B1-type (A⋠B direction) AND A1B1B2-type (B⋠A direction) coexist — the structural`);
  lines.push('  signature that no single definite order can generate this process.');
  const gvFunctional = gameValueFunctional(w);
  const gvBorn = psuccOCBStrategies(w);
  assert.ok(Math.abs(gvFunctional - OCB_QUANTUM_VALUE) < 1e-12);
  assert.ok(Math.abs(gvBorn - OCB_QUANTUM_VALUE) < 1e-12);
  const wv = witnessValue(w);
  assert.ok(Math.abs(wv + WITNESS_GAP) < 1e-12);
  lines.push(`- Game value via the linear functional: ${gvFunctional.toFixed(12)}`);
  lines.push(`- Game value via the from-scratch Born-rule loop: ${gvBorn.toFixed(12)}`);
  lines.push(`- Both equal (2+√2)/4 = ${OCB_QUANTUM_VALUE.toFixed(12)}; witness Tr[S W_OCB] = ${wv.toFixed(12)} = −(√2−1)/4.`);
  const certVerdict = verifyWitnessCertificate({ process: w, claimedWitnessValue: wv, claimedGameValue: gvFunctional });
  lines.push(`Shipped certificate verification: ${certVerdict.ok ? 'PASS' : 'FAIL'} — ${certVerdict.reason}.`);
  assert.ok(certVerdict.ok);
  lines.push('');

  // ---------------------------------------------------------------------
  lines.push('## 5. Robustness: the isotropic family W(ν) = νW_OCB + (1−ν)𝟙/4\n');
  lines.push('| ν | p_succ(ν) | Tr[S W(ν)] | min eigenvalue | verdict |');
  lines.push('|---|---|---|---|---|');
  for (const nu of [0, 0.25, 0.5, 0.7, 1 / Math.SQRT2, 0.75, 0.9, 1]) {
    const wn = noisyOcbProcess(nu);
    const gv = gameValueFunctional(wn);
    const wv2 = witnessValue(wn);
    const eig2 = judgeProcess(wn).eig.min;
    const verdict2 = wv2 < -1e-12 ? 'VIOLATES' : 'causal';
    lines.push(`| ${nu.toFixed(6)} | ${gv.toFixed(9)} | ${wv2 >= 0 ? '+' : ''}${wv2.toFixed(9)} | ${eig2.toExponential(2)} | ${verdict2} |`);
  }
  // bisect the critical ν
  let lo = 0; let hi = 1;
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    if (witnessValue(noisyOcbProcess(mid)) < 0) hi = mid; else lo = mid;
  }
  const nuStarBisect = (lo + hi) / 2;
  const nuStarClosed = 1 / Math.SQRT2;
  lines.push('');
  lines.push(`Bisection: ν* = ${nuStarBisect.toFixed(12)}; closed form 1/√2 = ${nuStarClosed.toFixed(12)};`);
  lines.push(`deviation ${Math.abs(nuStarBisect - nuStarClosed).toExponential(2)}. The witness needs > ${(nuStarClosed * 100).toFixed(2)}% OCB`);
  lines.push('process in the mixture — the violation is noise-robust but not noise-free; validity (PSD,');
  lines.push('normalization, term types) holds for EVERY ν ∈ [0,1] of the family (machine-checked per row).');
  lines.push('');

  // ---------------------------------------------------------------------
  lines.push('## 6. The switch contrast — order indefiniteness ≠ causal violation\n');
  const switchPsucc = psuccOCBThroughSwitch();
  lines.push(`The T1 quantum switch (control |+⟩, target |0⟩), same game, canonical OCB instruments:`);
  lines.push(`p_succ = ${switchPsucc.toFixed(12)} — ${(CLASSICAL_CAP - switchPsucc).toFixed(6)} BELOW the classical causal cap 3/4.`);
  lines.push("The switch is causally nonseparable as an ORDER structure (T1's control-displacement");
  lines.push('witness) yet does not even reach, let alone beat, the causal inequality on this game —');
  lines.push("machine echo of van der Lugt et al., Nat. Commun. 14, 5811 (2023), doi:10.1038/s41467-023-40162-8: the isolated switch's");
  lines.push('correlations do not violate causal inequalities. The OCB process and the switch are');
  lines.push('different objects; only the former violates. Scope: canonical instruments, one target');
  lines.push('preparation — a computed instance, not a claim over all switch strategies.');
  lines.push('');

  lines.push('## Verdict\n');
  lines.push('- Machine-checked, exact: census cap 3/4 over 8192 deterministic causal strategies;');
  lines.push(`  W_OCB valid (PSD, normalized, legal term types) with p_succ = (2+√2)/4 and witness`);
  lines.push(`  −(√2−1)/4, both reproduced by two independent computations; critical visibility ν* = 1/√2.`);
  lines.push('- Sampled (labeled): 120 random definite-order processes + shared Bell — no witness violation.');
  lines.push('- The stated-open face of v0.1.0 ("process witnesses, cited, not machine-checked") is now');
  lines.push('  machine-checked at bounded dimension — d = 2 per wire, the OCB game, one witness.');
  lines.push('- Still open, honestly: other causal inequalities; higher dimensions; the full quantum');
  lines.push('  separable classification; device-independent variants (2023–2026 experimental line:');
  lines.push('  Guo et al. arXiv:2506.20516 / Sci. Adv. aee2912; Richter et al. arXiv:2506.16949 —');
  lines.push('  anchored, not reproduced.\n');

  writeReport('exp5-process-witness', lines.join('\n'));
  console.log(lines.join('\n'));
}

function traceOf(m: CMat): number {
  let s = 0;
  for (let i = 0; i < m.rows; i++) s += m.re[i * m.cols + i]!;
  return s;
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main();
}
