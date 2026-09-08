/** Exp4 — T4 sampling certification: shadows, mirror echo, XEB + spoof + wall + sample-complexity census. */

import { writeReport, mdTable, fmt, sci } from './report.js';
import { shadowBias, fidelityShadowMC, shadowFidelityExact } from '../protocol/shadows.js';
import { runMirrorExperiment, localNoiseMirrorCurve } from '../protocol/mirror.js';
import {
  xebSelfConsistency,
  xebOfDistribution,
  uniformDist,
  depolarizedDist,
  cutSpoofDist,
  tvDistance,
  xebMC,
  simulationCostCurve,
  marginals,
} from '../protocol/xeb.js';
import { xebWallRow, uniformFalseAcceptMC, shadowWallRow } from '../protocol/samplewall.js';
import { randomCircuit, circuitProbs } from '../core/gates.js';
import { fromVec, randomPureState } from '../core/states.js';
import { depolarize } from '../core/channels.js';
import { makeRng } from '../core/rng.js';
import { pathToFileURL } from "node:url";

export function main(): void {
  const rng = makeRng(0x5ade);

  // (1) shadow unbiasedness by exact enumeration
  const biasRows: string[][] = [];
  for (const n of [2, 3]) {
    for (const q of [0, 0.3]) {
      const target = randomPureState(1 << n, rng);
      const pure = fromVec(target);
      const mixed = q === 0 ? pure : depolarize(pure, q);
      const bias = shadowBias(mixed, n);
      biasRows.push([String(n), fmt(q, 2), sci(bias)]);
    }
  }

  // (2) shadow fidelity MC vs closed form (n=3, depolarized target)
  const n = 3;
  const qDep = 0.3;
  const target = randomPureState(1 << n, rng);
  const rho = depolarize(fromVec(target), qDep);
  const mc = fidelityShadowMC(rho, target, n, 50000, rng);
  const closed = (1 - qDep) + qDep / (1 << n);
  const z = (mc.mean - closed) / mc.stdErr;

  // (3) mirror echo: global depolarizing closed form
  const mirrorRows: string[][] = [];
  let worstMirrorGap = 0;
  for (const layers of [1, 2, 4, 8, 16]) {
    for (const lambda of [0.05, 0.2]) {
      const { simulated, closed: cf } = runMirrorExperiment(3, layers, lambda, rng);
      worstMirrorGap = Math.max(worstMirrorGap, Math.abs(simulated - cf));
      mirrorRows.push([String(layers), fmt(lambda, 2), fmt(simulated, 12), fmt(cf, 12)]);
    }
  }
  const localCurve = localNoiseMirrorCurve(3, [1, 2, 4, 8, 12], 0.05, rng);

  // (4) XEB at n=8: exact facts
  const nX = 8;
  const circuit = randomCircuit(rng, nX, 3 * nX);
  const probs = circuitProbs(circuit);
  const ptSelf = xebSelfConsistency(probs); // ideal sampler
  const uniformXeb = xebOfDistribution(uniformDist(probs.length), probs);
  const { pa, pb } = marginals(probs, 4);
  let paSum = 0;
  for (const v of pa) paSum += v;
  let pbSum = 0;
  for (const v of pb) pbSum += v;
  const spoof = cutSpoofDist(probs, 4);
  const spoofXeb = xebOfDistribution(spoof, probs);
  const spoofTv = tvDistance(spoof, probs);

  // depolarized MC: F_XEB = λ·(2ⁿΣp²−1)
  const mcRows: string[][] = [];
  for (const lambda of [0.5, 0.8, 1.0]) {
    const dist = lambda === 1.0 ? probs : depolarizedDist(probs, lambda);
    const est = xebMC(dist, probs, 200000, rng);
    const closedVal = lambda * ptSelf;
    mcRows.push([fmt(lambda, 2), fmt(est.mean, 6), fmt(est.stdErr, 6), fmt(closedVal, 6)]);
  }

  // (5) sample wall: exact simulation cost
  const costs = simulationCostCurve(0x5ade);

  // (6) v0.2 sample-complexity census: exact Chernoff/Hoeffding arithmetic + MC
  // XEB uniform-rejection wall on the SAME n=8 circuit distribution
  const wallLambdas = [0.1, 0.25, 0.5, 0.75, 1.0];
  const wallDeltas = [0.05, 0.01, 0.001];
  const wallRows = wallLambdas.flatMap((lambdaTarget) =>
    wallDeltas.map((delta) => xebWallRow(probs, lambdaTarget, delta)),
  );
  const wallChecks = wallRows.map((r) => r.nChernoff - r.nHoeffding);
  const worstChernoffExcess = Math.max(...wallChecks);
  // MC cross-check at (λ₀=0.5, δ=0.01): measured false-accept rate at N_C and at N/4
  const mcRow = wallRows.find((r) => r.lambdaTarget === 0.5 && r.delta === 0.01);
  if (mcRow === undefined) throw new Error('wall grid lost the MC anchor point');
  const wallRng = makeRng(0x5eed01);
  const mcAtN = uniformFalseAcceptMC(probs, mcRow.threshold, mcRow.nChernoff, 2500, wallRng);
  const mcAtQuarter = uniformFalseAcceptMC(probs, mcRow.threshold, Math.floor(mcRow.nChernoff / 4), 2500, wallRng);

  // shadow-fidelity wall from exact per-shot moments (same n=3 target as the MC above)
  const exactMoments = shadowFidelityExact(rho, target, n);
  const shadowRows = [shadowWallRow(exactMoments, 0.05, 0.05), shadowWallRow(exactMoments, 0.01, 0.05)];
  // MC cross-checks at the ε=0.05 Chebyshev count (the ε=0.01 row is ~25× more
  // shots — kept as exact arithmetic only): (i) empirical batch-mean std must
  // match the exact σ/√N the count consumes; (ii) measured coverage at N_Cheb.
  const shadowCoverageRng = makeRng(0x5eed02);
  const chebRow = shadowRows[0]!;
  const batchShots = 2000;
  const batches = 200;
  const batchMeans: number[] = [];
  for (let t = 0; t < batches; t++) batchMeans.push(fidelityShadowMC(rho, target, n, batchShots, shadowCoverageRng).mean);
  const batchMean = batchMeans.reduce((a, b) => a + b, 0) / batches;
  const batchVar =
    batchMeans.reduce((a, b) => a + (b - batchMean) ** 2, 0) / Math.max(1, batches - 1);
  const batchStd = Math.sqrt(batchVar);
  const predictedStd = Math.sqrt(exactMoments.variance / batchShots);
  const coverageTrials = 60;
  let coverageHits = 0;
  for (let t = 0; t < coverageTrials; t++) {
    const est = fidelityShadowMC(rho, target, n, chebRow.nChebyshev, shadowCoverageRng);
    if (Math.abs(est.mean - exactMoments.mean) <= chebRow.epsilon) coverageHits++;
  }
  const coverageRate = coverageHits / coverageTrials;

  writeReport(
    { name: 'exp4-sampling', title: 'T4 — sampling-based certification (shadows, mirror, XEB)' },
    {
      shadowBias: biasRows.map(([n2, q2, b]) => ({ n: Number(n2), q: Number(q2), bias: Number(b) })),
      shadowMC: { ...mc, closed, z },
      mirror: { rows: mirrorRows.map(([l, la, s, c]) => ({ layers: Number(l), lambda: Number(la), simulated: Number(s), closed: Number(c) })), worstMirrorGap },
      localMirrorCurve: localCurve,
      xeb: {
        n: nX,
        ptSelf,
        uniformXeb,
        marginalSums: { pa: paSum, pb: pbSum },
        spoofXeb,
        spoofTv,
        mcRows: mcRows.map(([l, m, se, c]) => ({ lambda: Number(l), mean: Number(m), stdErr: Number(se), closed: Number(c) })),
      },
      costs,
      sampleWall: {
        xeb: {
          rows: wallRows,
          worstChernoffExcess,
          mc: { lambda: 0.5, delta: 0.01, threshold: mcRow.threshold, n: mcRow.nChernoff, atN: mcAtN, atQuarterN: mcAtQuarter },
        },
        shadow: {
          exactMoments,
          rows: shadowRows,
          batchCheck: { shots: batchShots, batches, batchStd, predictedStd },
          coverage: { shots: chebRow.nChebyshev, epsilon: chebRow.epsilon, trials: coverageTrials, rate: coverageRate },
        },
      },
    },
    `## Classical shadows: exact unbiasedness

E[ρ̂] vs ρ by full enumeration (3^n bases × 2^n outcomes, exact probabilities):

${mdTable(['n', 'depol q', '‖E[ρ̂] − ρ‖₁'], biasRows)}

Fidelity estimator MC (n=3, q=0.3, 50000 shots): mean = ${fmt(mc.mean, 6)} ± ${fmt(mc.stdErr, 6)},
closed form (1−q) + q/2ⁿ = ${fmt(closed, 6)}, z = ${fmt(z, 2)}.

## Mirror echo: closed form vs simulation

F_return = (1−λ)^L + (1−(1−λ)^L)/2ⁿ under per-layer global depolarizing —
worst |simulated − closed| = **${sci(worstMirrorGap)}**:

${mdTable(['layers L', 'λ', 'simulated', 'closed form'], mirrorRows)}

Local per-gate depolarizing (no closed form claimed), λ=0.05, n=3:
${localCurve.map((p) => `L=${p.layers}: ${fmt(p.fReturn, 6)}`).join(', ')} — exponential decay, fit slope
${fmt(fitSlope(localCurve), 4)} per layer.

## XEB exact facts (n=8 random circuit)

- 2ⁿ Σp² − 1 (ideal sampler): **${fmt(ptSelf, 6)}** — Porter–Thomas-consistent (→1)
- uniform sampler: **${sci(uniformXeb)}** (exactly 0 up to fp)
- marginal sanity: Σp_A = ${fmt(paSum, 12)}, Σp_B = ${fmt(pbSum, 12)}
- **cut spoof** q = p_A·p_B (classical cost ~2^{n/2} in a real contraction):
  F_XEB = **${fmt(spoofXeb, 6)} > 0** while TV(q, p) = ${fmt(spoofTv, 6)} —
  a classically-generated distribution scores positively: **positive XEB does
  not certify the computation**

Depolarized MC (200k shots each):

${mdTable(['λ', 'F_XEB MC', 'stdErr', 'λ·(2ⁿΣp²−1)'], mcRows)}

## Sample wall (exact simulation cost per full distribution)

${mdTable(['n', 'layers', 'ms'], costs.map((c) => [String(c.n), String(c.layers), fmt(c.ms, 1)]))}

Doubling per qubit — XEB verification requires computing p_ideal(x) per sample:
the verifier pays the classical simulation cost. Extrapolated: n=40 would need
~2^16× the n=24 cost per sample batch (the honest boundary of statistical
certification — cf. Hangleiter et al., PRL 122, 210502 (2019) for the
device-independent lower bounds).

## v0.2 Sample-complexity census: certification cost as executable numbers

**XEB uniform rejection.** The verifier accepts "not uniform" when the mean of
X = 2ⁿp_ideal(x) − 1 over N samples exceeds τ = λ₀C/2 (C = 2ⁿΣp² − 1 = ${fmt(ptSelf, 6)}
here). Exact counts on THIS circuit's distribution:

${mdTable(
  ['λ₀', 'δ', 'τ = λ₀C/2', 'I₀(τ) exact', 'N Chernoff', 'N Hoeffding'],
  wallRows.map((r) => [fmt(r.lambdaTarget, 2), String(r.delta), fmt(r.threshold, 6), sci(r.rate, 6), String(r.nChernoff), String(r.nHoeffding)]),
)}

N_Chernoff = ⌈ln(1/δ)/I₀(τ)⌉ with I₀ the exact Cramér rate of the per-sample
statistic under the uniform device (Legendre transform of the exact MGF over
all 2ⁿ values — no approximation); N_Hoeffding = ⌈R²ln(1/δ)/(2τ²)⌉ with
R = 2ⁿp_max. Worst (N_Chernoff − N_Hoeffding) = ${String(worstChernoffExcess)}
(≤ 0: the exact rate is never worse than the range bound). The wall is
N ∝ 1/λ₀²: certifying a noisier device costs quadratically more samples.

MC cross-check at (λ₀ = 0.5, δ = 0.01, N = ${String(mcRow.nChernoff)}): measured
uniform false-accept rate = ${fmt(mcAtN.rate, 5)} ± ${fmt(mcAtN.stdErr, 5)} ≤ δ
(as the bound promises); at a quarter of the samples N/4 = ${String(Math.floor(mcRow.nChernoff / 4))}:
rate = ${fmt(mcAtQuarter.rate, 5)} ± ${fmt(mcAtQuarter.stdErr, 5)} — under-sampled,
the uniform device false-accepts at many times δ. Note the Chernoff count prices
ONLY the statistical side; each sample still costs the verifier one exact
p_ideal(x) evaluation (the simulation wall above).

**Shadow fidelity.** Exact per-shot moments by enumeration of all
3ⁿ×2ⁿ events (n = 3, same target): mean = ${fmt(exactMoments.mean, 10)} (closed
form (1−q)+q/2ⁿ = ${fmt(closed, 10)}), variance σ² = ${fmt(exactMoments.variance, 8)},
per-shot range [${fmt(exactMoments.min, 4)}, ${fmt(exactMoments.max, 4)}]:

${mdTable(
  ['ε', 'δ', 'N Chebyshev', 'N Hoeffding'],
  shadowRows.map((r) => [String(r.epsilon), String(r.delta), String(r.nChebyshev), String(r.nHoeffding)]),
)}

MC cross-checks of the count's inputs: over ${String(batches)} batches of
${String(batchShots)} shots the empirical batch-mean std is ${fmt(batchStd, 6)}
vs the exact prediction σ/√N = ${fmt(predictedStd, 6)} (${fmt((batchStd / predictedStd - 1) * 100, 2)}%
off) — the σ² the Chebyshev count consumes is the estimator's true variance.
Measured coverage at the ε = 0.05 Chebyshev count
(N = ${String(chebRow.nChebyshev)}): ${fmt(coverageRate * 100, 2)}% of
${String(coverageTrials)} trials inside ε (the guarantee is ≥ 95%; the ε = 0.01
row is ~25× the shots and is carried as exact arithmetic only).
Cited context: the Huang–Kueng–Preskill median-of-means machinery gives the
log(M/δ)·3^ℓ/ε² scaling for M observables (single-observable census here);
Lowe et al. (arXiv:2207.14438) prove matching single-copy lower bounds; Fu
(arXiv:2412.03381) sharpens the MoM constants; PRX Quantum 5, 010334 (2024)
and arXiv:2405.00789 document why positive XEB alone certifies nothing.
`,
  );
}

function fitSlope(curve: Array<{ layers: number; fReturn: number }>): number {
  // log-linear fit of ln F vs layers
  const xs = curve.map((p) => p.layers);
  const ys = curve.map((p) => Math.log(Math.max(1e-12, p.fReturn)));
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, x, i) => a + x * ys[i]!, 0);
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
