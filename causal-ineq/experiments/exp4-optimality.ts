/**
 * EXP4 — optimality beyond the rotated-measurement family (v0.2.0 primary face).
 *
 * Family F_q: ALL binary-outcome TPCP instruments on qubit in/out per lab
 * (arbitrary dependence on the local input, entangled CJ elements allowed,
 * shared ancillas reduced to PSD+TP elements). The v0.1.0 claim — z/x optimal
 * within rotated projective measurements — is upgraded to: within F_q on
 * W*(1/√2) the game value is exactly cos²(π/8), proven by the functional
 * relaxation (src/game/certificate.ts), attained by the OCB protocol, and
 * corroborated by a deterministic multistart sweep that never exceeds it.
 * The same number is the global optimum over arbitrary dimensions and
 * operations by LC25 (cited, not re-proven).
 */
import { buildStrategy, hillClimb, mulberry32, ocbParamsVector, ocbStrategy, paramsToVector, randomEntangledPair, randomStrategyParams, strategyPayoff, type StrategyParams } from "../src/game/strategy.js";
import { boundReport, closedFormProductPayoff, decompositionIdentity, lemmaViolations, wStarCoefficients } from "../src/game/certificate.js";
import { checkValidity } from "../src/process/validity.js";
import { wStar } from "../src/process/construct.js";
import { wBiased } from "../src/process/ocb12.js";
import { COS2_PI_8 } from "../src/game/quantum.js";
import { table, writeReport } from "./report.js";

function run(): void {
  const failures: string[] = [];
  const w = wStar(Math.SQRT1_2);
  const coeff = wStarCoefficients(w);

  // --- link 1+2: the certificate chain ----------------------------------
  // (i) full Born rule == functional decomposition (random product strategies
  // AND entangled-element probes); (ii) functional == closed form (product).
  const rng = mulberry32(20260908);
  let worstBornVsFunctional = 0;
  let worstFunctionalVsClosed = 0;
  let worstLemma = 0;
  for (let i = 0; i < 240; i++) {
    const prm = randomStrategyParams(rng);
    const builder = buildStrategy(prm);
    const born = strategyPayoff(w, builder);
    worstBornVsFunctional = Math.max(worstBornVsFunctional, decompositionIdentity(w, builder, born));
    worstFunctionalVsClosed = Math.max(
      worstFunctionalVsClosed,
      Math.abs(closedFormProductPayoff(coeff, prm).pSuccess - boundReport(coeff, builder).pSuccessExecuted),
    );
    worstLemma = Math.max(worstLemma, lemmaViolations(builder).worst);
  }
  for (let i = 0; i < 80; i++) {
    const ent = randomEntangledPair(rng);
    const builderEnt = { alice: () => ent, bob: (b: number, bp: number) => ocbStrategy().bob(b, bp) };
    const bornEnt = strategyPayoff(w, builderEnt);
    worstBornVsFunctional = Math.max(worstBornVsFunctional, decompositionIdentity(w, builderEnt, bornEnt));
    worstLemma = Math.max(worstLemma, lemmaViolations(builderEnt).worst);
  }
  if (worstBornVsFunctional > 1e-12) failures.push(`Born-vs-functional identity worst ${worstBornVsFunctional}`);
  if (worstFunctionalVsClosed > 1e-12) failures.push(`functional-vs-closedform worst ${worstFunctionalVsClosed}`);
  if (worstLemma > 1e-9) failures.push(`lemma violation worst ${worstLemma}`);

  // --- the bound, executed ------------------------------------------------
  const ocb = ocbStrategy();
  const br = boundReport(coeff, ocb);
  if (Math.abs(br.pSuccessBound - COS2_PI_8) > 1e-12) failures.push(`bound ${br.pSuccessBound} != cos^2(pi/8)`);
  if (Math.abs(br.slack) > 1e-12) failures.push(`OCB does not attain the bound (slack ${br.slack})`);
  let minSlack = Infinity;
  const rngB = mulberry32(4242);
  for (let i = 0; i < 200; i++) {
    minSlack = Math.min(minSlack, boundReport(coeff, buildStrategy(randomStrategyParams(rngB))).slack);
  }
  if (minSlack < -1e-12) failures.push(`random battery exceeds bound (slack ${minSlack})`);

  // --- the multistart sweep (deterministic) --------------------------------
  const payoff = (p: StrategyParams) => closedFormProductPayoff(coeff, p).pSuccess;
  const rngS = mulberry32(777);
  let bestSweep = -1;
  const STARTS = 640;
  for (let i = 0; i < STARTS; i++) {
    const r = hillClimb(payoff, paramsToVector(randomStrategyParams(rngS)), rngS, 40);
    bestSweep = Math.max(bestSweep, r.value);
  }
  if (bestSweep > COS2_PI_8 + 1e-9) failures.push(`sweep exceeded cos^2(pi/8): ${bestSweep}`);
  let returned = 0;
  for (let i = 0; i < 20; i++) {
    const start = ocbParamsVector().map((x) => x + 0.15 * (2 * rngS() - 1));
    const r = hillClimb(payoff, start, rngS, 80);
    if (COS2_PI_8 - r.value < 1e-9) returned++;
  }
  if (returned < 18) failures.push(`perturbed-OCB return rate ${returned}/20 unexpectedly low`);

  // --- the biased OCB functional (LC25 anchor) ------------------------------
  const alphas = [0, 0.25, 0.5, 1, 2, 4];
  const biasedRows: string[][] = [];
  for (const alpha of alphas) {
    const wb = wBiased(alpha);
    const pr = strategyPayoff(wb, ocb);
    const ialpha = pr.pAliceGuesses + alpha * pr.pBobGuesses;
    const closed = (1 + alpha + Math.sqrt(1 + alpha * alpha)) / 2;
    const valid = checkValidity(wb);
    biasedRows.push([alpha.toFixed(2), ialpha.toFixed(12), closed.toFixed(12), Math.abs(ialpha - closed).toExponential(2), valid.valid ? "VALID" : "INVALID"]);
    if (Math.abs(ialpha - closed) > 1e-12) failures.push(`biased alpha=${alpha}: ${ialpha} != ${closed}`);
    if (!valid.valid) failures.push(`biased alpha=${alpha}: process invalid`);
  }

  const chainTable = table(
    ["chain link", "worst deviation"],
    [
      ["process Born rule (16-dim) == functional decomposition (320 samples)", worstBornVsFunctional.toExponential(2)],
      ["functional decomposition == closed form (240 product samples)", worstFunctionalVsClosed.toExponential(2)],
      ["lemmas L1-L4 on all sampled instruments (incl. entangled elements)", worstLemma.toExponential(2)],
    ],
  );

  const boundTable = table(
    ["quantity", "value"],
    [
      ["branch bound b'=0 (Alice guesses): ½(1+c2)", br.pABound.toFixed(12)],
      ["branch bound b'=1 (Bob guesses): ½(1+c1)", br.pBBound.toFixed(12)],
      ["p_success bound at c1=c2=1/√2", br.pSuccessBound.toFixed(12)],
      ["cos²(π/8)", COS2_PI_8.toFixed(12)],
      ["OCB protocol slack (bound − executed)", br.slack.toExponential(2)],
      ["min slack over 200 random strategies", minSlack.toFixed(6)],
    ],
  );

  const body =
    `# EXP4 — Optimality beyond the rotated-measurement family\n\n` +
    `**Family F_q**: all binary-outcome TPCP instruments on qubit in/out per lab — arbitrary\n` +
    `local-input dependence, entangled CJ elements allowed, shared ancillas reduced to PSD+TP\n` +
    `elements (OCB12's instrument-ancilla reduction). Rotated projective measurements are a\n` +
    `measure-zero corner of this family.\n\n` +
    `## The certificate chain\n\n` +
    chainTable +
    `\n\n## The bound, executed (W* = ¼[1 + c1 T1 + c2 T2], c1 = c2 = 1/√2)\n\n` +
    boundTable +
    `\n\nP_A ≤ ½(1+c2) and P_B ≤ ½(1+c1) hold independently (every input to the chain is a PSD/TP\n` +
    `lemma — see src/game/certificate.ts header); both are ATTAINED simultaneously by the OCB\n` +
    `z/x protocol, so within F_q on W* the supremum is exactly cos²(π/8) = ${COS2_PI_8.toFixed(12)}.\n\n` +
    `## Multistart sweep (deterministic, seed-fixed)\n\n` +
    `${STARTS} random starts + coordinate line-search (40 passes, 60 parameters each): best found\n` +
    `${bestSweep.toFixed(12)}, i.e. ${(COS2_PI_8 - bestSweep).toExponential(2)} BELOW the bound — nothing exceeds it.\n` +
    `Perturbed-OCB restarts return to the optimum ${returned}/20 times; a restart that fell short would\n` +
    `land strictly below the bound — the certificate, not the search, carries the claim.\n\n` +
    `## The biased OCB functional — LC25 anchor, executed\n\n` +
    table(["α", "executed ℐ_α = P_A + α·P_B on S_OCB,α", "closed form (1+α+√(1+α²))/2", "deviation", "process"], biasedRows) +
    `\n\nLC25 (arXiv:2403.02749, Nat. Commun. 16, 3314) prove ℐ^{ICO}_{OCB,α} = (1+α+√(1+α²))/2 is\n` +
    `the exact maximum over ARBITRARY quantum processes and arbitrary local operations; the executed\n` +
    `qubit values saturate it at every α probed, and the qubit-lab relaxation bound above reproduces\n` +
    `the same number — the qubit corner is already tight. At α = 1: ℐ = 1 + 1/√2 = ${((1 + Math.SQRT1_2)).toFixed(12)}\n` +
    `(our normalization: p_success = cos²(π/8)); the PSD window c1²+c2² ≤ 1 touches the curve exactly\n` +
    `where the game value saturates it.\n\n` +
    `## Honest boundary\n\n` +
    `Proven WITHIN F_q (qubit labs, the process W*). Not claimed: optimality over higher-dimensional\n` +
    `labs or other processes — that is LC25's theorem (cited; their SDP hierarchy is out of scope,\n` +
    `see README boundary 2). The sweep corroborates, never certifies: only the relaxation bound does.\n`;

  if (failures.length > 0) throw new Error(`exp4 failures:\n${failures.map((f) => `- ${f}`).join("\n")}`);
  const file = writeReport("exp4-optimality.md", body);
  console.log(`exp4 done -> ${file} — sup within F_q = cos²(π/8) (bound tight, sweep best ${(COS2_PI_8 - bestSweep).toExponential(2)} below)`);
}

run();
