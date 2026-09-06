/** Exp4 — T4 sampling certification: shadows, mirror echo, XEB + spoof + wall. */

import { writeReport, mdTable, fmt, sci } from './report.js';
import { shadowBias, fidelityShadowMC } from '../protocol/shadows.js';
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
import { randomCircuit, circuitProbs } from '../core/gates.js';
import { fromVec, randomPureState } from '../core/states.js';
import { makeRng } from '../core/rng.js';
import type { CMat } from '../core/cmat.js';
import { pathToFileURL } from "node:url";

function main(): void {
  const rng = makeRng(0x5ade);

  // (1) shadow unbiasedness by exact enumeration
  const biasRows: string[][] = [];
  for (const n of [2, 3]) {
    for (const q of [0, 0.3]) {
      const target = randomPureState(1 << n, rng);
      const pure = fromVec(target);
      const d = pure.rows;
      const mixed = q === 0 ? pure : mixDepolarized(pure, q, d);
      const bias = shadowBias(mixed, n);
      biasRows.push([String(n), fmt(q, 2), sci(bias)]);
    }
  }

  // (2) shadow fidelity MC vs closed form (n=3, depolarized target)
  const n = 3;
  const qDep = 0.3;
  const target = randomPureState(1 << n, rng);
  const rho = mixDepolarized(fromVec(target), qDep, 1 << n);
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
`,
  );
}

function mixDepolarized(rho: CMat, q: number, d: number): CMat {
  const out = { rows: d, cols: d, re: new Float64Array(d * d), im: new Float64Array(d * d) };
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      out.re[i * d + j] = (1 - q) * rho.re[i * d + j]!;
      out.im[i * d + j] = (1 - q) * rho.im[i * d + j]!;
    }
    out.re[i * d + i] = out.re[i * d + i]! + q / d;
  }
  return out;
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
