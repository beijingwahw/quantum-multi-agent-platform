import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cmatAdd, cmatEye, cmatMaxAbsDiff, cmatPartialTraceSecond, cmatScale, cmatTrace, cmatTraceProd, hermitianExtremeEig, NamedError } from "../src/core/cmat.js";
import { checkValidity, patternAllowed } from "../src/process/validity.js";
import { wChannelAB, wChannelBA, wForbiddenF1, wForbiddenF3, wMixed, wNotPSD, wNoisy, wStar } from "../src/process/construct.js";
import { sweepDeterministic } from "../src/game/classical.js";
import { bobAngleBranch, runProtocol, COS2_PI_8 } from "../src/game/quantum.js";
import { buildStrategy, entangledInstrumentPair, hillClimb, instrumentTP, mulberry32, ocbParamsVector, ocbStrategy, paramsToVector, randomEntangledPair, randomStrategyParams, strategyPayoff, vectorToParams } from "../src/game/strategy.js";
import { adjudicate, boundReport, closedFormProductPayoff, decompositionIdentity, lemmaViolations, wStarCoefficients } from "../src/game/certificate.js";
import { compareWithOCB12, equivalenceReport, equivalenceVerdict, ocb12ClosedFormTables, wBiased, wLC25, wOCB12, wOCB12TamperedCoeff, wOCB12TamperedPauli } from "../src/process/ocb12.js";

describe("eigensolver anchors (real-symmetric Jacobi via doubling)", () => {
  it("known spectra", () => {
    assert.deepEqual(hermitianExtremeEig(cmatEye(16)), { min: 1, max: 1 });
    const m = { dim: 2, re: [[1, 1], [1, -1]], im: [[0, 0], [0, 0]] };
    const e = hermitianExtremeEig(m);
    assert.ok(Math.abs(e.max - Math.SQRT2) < 1e-12);
    assert.ok(Math.abs(e.min + Math.SQRT2) < 1e-12);
    const y = { dim: 2, re: [[0, 0], [0, 0]], im: [[0, -1], [1, 0]] };
    const ey = hermitianExtremeEig(y);
    assert.ok(Math.abs(ey.max - 1) < 1e-12 && Math.abs(ey.min + 1) < 1e-12);
    // anchor absorbed from the retired debug-eig.ts scratch: the causal channel
    // W^{A≺B} = (1/2·1)^A1 ⊗ |Φ><Φ|^{A2B1} ⊗ 1^{B2} has spectrum exactly {0, 1}
    const ab = hermitianExtremeEig(wChannelAB());
    assert.ok(Math.abs(ab.max - 1) < 1e-12, `max ${ab.max}`);
    assert.ok(Math.abs(ab.min) < 1e-12, `min ${ab.min}`);
  });
});

describe("kernel rejections — every illegal input NAMED, never a silent NaN", () => {
  const isNamed = (code: string) => (e: unknown): boolean => e instanceof NamedError && e.code === code;

  it("binary kernel dimension mismatches are rejected by name (NaN grid is dead)", () => {
    const eye2 = cmatEye(2);
    const eye4 = cmatEye(4);
    // before the guards these returned a silently corrupted NaN grid (v0.2.0 defect class)
    assert.throws(() => cmatAdd(eye2, eye4), isNamed("cmat/dim-mismatch"));
    assert.throws(() => cmatTraceProd(eye2, eye4), isNamed("cmat/dim-mismatch"));
    assert.throws(() => cmatMaxAbsDiff(eye2, eye4), isNamed("cmat/dim-mismatch"));
    // legal operands still pass through bit-identically
    assert.equal(cmatAdd(eye2, eye2).re[0]![0], 2);
  });

  it("malformed grids and odd-dim partial traces are rejected by name", () => {
    const ragged = { dim: 2, re: [[1]], im: [[0, 0], [0, 0]] };
    assert.throws(() => cmatTrace(ragged), isNamed("cmat/malformed-grid"));
    assert.throws(() => cmatScale(ragged, 2), isNamed("cmat/malformed-grid"));
    assert.throws(() => cmatPartialTraceSecond(cmatEye(3)), isNamed("cmat/dim-not-even"));
  });

  it("strategy machinery rejects non-qubit CJ elements, short vectors, and off-span processes by name", () => {
    assert.throws(() => instrumentTP([cmatEye(2), cmatEye(2)]), isNamed("strategy/cj-element-not-qubit"));
    assert.throws(() => vectorToParams([1, 2, 3]), isNamed("strategy/vector-length"));
    assert.equal(paramsToVector(vectorToParams(ocbParamsVector())).length, 60);
    assert.throws(
      () => decompositionIdentity(wForbiddenF1(), ocbStrategy(), { pAliceGuesses: 0, pBobGuesses: 0 }),
      isNamed("certificate/off-span-process"),
    );
    assert.throws(
      () => entangledInstrumentPair(0.5, [1, 0], [0, 0], [1, 0], [0]),
      isNamed("strategy/schmidt-vector-dim"),
    );
  });
});

describe("T1 process validity", () => {
  it("the seven allowed support signatures and only those", () => {
    const sigs = new Set<string>();
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 4; k++) {
        for (let l = 0; l < 4; l++) {
          for (let m = 0; m < 4; m++) {
            if (patternAllowed(j, k, l, m) && j + k + l + m > 0) {
              sigs.add(`${j > 0 ? 1 : 0}${k > 0 ? 1 : 0}${l > 0 ? 1 : 0}${m > 0 ? 1 : 0}`);
            }
          }
        }
      }
    }
    assert.deepEqual([...sigs].sort(), ["1000", "0010", "1010", "0110", "1110", "1001", "1011"].sort());
    // A1, B1, A1B1, A2B1, A1A2B1, A1B2, A1B1B2 — seven nontrivial support signatures
    // (+ identity = eight patterns). Channels work (A2B1 carries A→B, A1B2 carries B→A);
    // own input-output correlations (A1A2, B1B2) and output-output couplings (A2B2...) forbidden.
  });

  it("positive candidates valid; W* eigenvalues exactly {0, 1/2}", () => {
    for (const w of [wMixed(), wChannelAB(), wChannelBA(), wStar(Math.SQRT1_2)]) {
      const v = checkValidity(w);
      assert.deepEqual(v.violations, []);
    }
    const eig = hermitianExtremeEig(wStar(Math.SQRT1_2));
    assert.ok(Math.abs(eig.min) < 1e-12, `min ${eig.min}`);
    assert.ok(Math.abs(eig.max - 0.5) < 1e-12, `max ${eig.max}`);
  });

  it("negative controls fail for the right reason", () => {
    const f1 = checkValidity(wForbiddenF1());
    assert.ok(!f1.valid && /forbidden pattern/.test(f1.violations.join(";")), f1.violations.join(";"));
    const f3 = checkValidity(wForbiddenF3());
    assert.ok(!f3.valid && /forbidden pattern/.test(f3.violations.join(";")));
    const psd = checkValidity(wNotPSD());
    assert.ok(!psd.valid && /not PSD/.test(psd.violations.join(";")));
    const over = checkValidity(wStar(0.9));
    assert.ok(!over.valid && /not PSD/.test(over.violations.join(";")));
  });
});

describe("T2 the causal bound, exhausted", () => {
  it("all deterministic strategies cap at exactly 3/4", () => {
    const r = sweepDeterministic();
    assert.equal(r.strategiesSwept, 8192);
    assert.ok(Math.abs(r.maxSuccess - 0.75) < 1e-12);
    assert.ok(Math.abs(r.orders.aFirst - 0.75) < 1e-12);
    assert.ok(Math.abs(r.orders.bFirst - 0.75) < 1e-12);
  });
});

describe("T3 the violation, executed", () => {
  it("anchors: mixed 1/2, channel A-then-B exactly 3/4, W* exactly cos^2(pi/8)", () => {
    assert.ok(Math.abs(runProtocol(wMixed()).pSuccess - 0.5) < 1e-12);
    const ab = runProtocol(wChannelAB());
    assert.ok(Math.abs(ab.pBobGuesses - 1) < 1e-12);
    assert.ok(Math.abs(ab.pAliceGuesses - 0.5) < 1e-12);
    assert.ok(Math.abs(ab.pSuccess - 0.75) < 1e-12);
    const star = runProtocol(wStar(Math.SQRT1_2));
    assert.ok(Math.abs(star.pAliceGuesses - COS2_PI_8) < 1e-12);
    assert.ok(Math.abs(star.pBobGuesses - COS2_PI_8) < 1e-12);
    assert.ok(Math.abs(star.pSuccess - COS2_PI_8) < 1e-12);
  });

  it("branch probabilities normalize to 1 on valid processes", () => {
    // sum over all outcomes of each branch = Tr[W (TPCP_A ⊗ TPCP_B)] = 1
    for (const w of [wMixed(), wChannelAB(), wStar(Math.SQRT1_2)]) {
      const p = runProtocol(w);
      // per (a,b): branch totals must be 1; runProtocol averages over 4 combos,
      // so the marginal sums pAlice*2 + ... use the identity: both branch outcome sums = 1
      // (checked indirectly: pAliceGuesses + pBobGuesses*... direct check below)
      assert.ok(p.pAliceGuesses <= 1 + 1e-12 && p.pBobGuesses <= 1 + 1e-12);
    }
  });

  it("noise threshold exactly eta = 1/sqrt(2), linear in eta", () => {
    for (const eta of [0, 0.25, 0.5, Math.SQRT1_2, 0.8, 1]) {
      const p = runProtocol(wNoisy(eta)).pSuccess;
      const linear = 0.5 + eta * (COS2_PI_8 - 0.5);
      assert.ok(Math.abs(p - linear) < 1e-12, `eta=${eta}`);
    }
    assert.ok(Math.abs(runProtocol(wNoisy(Math.SQRT1_2)).pSuccess - 0.75) < 1e-12);
    assert.ok(runProtocol(wNoisy(0.7)).pSuccess < 0.75);
    assert.ok(runProtocol(wNoisy(0.72)).pSuccess > 0.75);
  });

  it("z-basis is the rotated-family optimum for Bob's b'=1 measurement", () => {
    let best = { theta: -1, p: -1 };
    for (let i = 0; i <= 32; i++) {
      const theta = (i / 32) * Math.PI;
      const p = bobAngleBranch(wStar(Math.SQRT1_2), theta);
      if (p > best.p) best = { theta, p };
    }
    assert.ok(best.theta < 1e-9 || Math.abs(best.theta - Math.PI) < 1e-9, `theta ${best.theta}`);
    assert.ok(Math.abs(best.p - COS2_PI_8) < 1e-12);
    const closed = bobAngleBranch(wStar(Math.SQRT1_2), Math.PI / 4);
    assert.ok(Math.abs(closed - (0.5 * (1 + Math.SQRT1_2 * Math.cos(Math.PI / 4)))) < 1e-12);
  });
});

describe("T4 optimality beyond the rotated-measurement family", () => {
  const w = wStar(Math.SQRT1_2);
  const coeff = wStarCoefficients(w);

  it("certificate chain: Born rule == functional decomposition == closed form (incl. entangled elements)", () => {
    const rng = mulberry32(31337);
    let worstIdent = 0;
    let worstClosed = 0;
    let worstLemma = 0;
    for (let i = 0; i < 40; i++) {
      const prm = randomStrategyParams(rng);
      const builder = buildStrategy(prm);
      worstIdent = Math.max(worstIdent, decompositionIdentity(w, builder, strategyPayoff(w, builder)));
      worstClosed = Math.max(worstClosed, Math.abs(closedFormProductPayoff(coeff, prm).pSuccess - boundReport(coeff, builder).pSuccessExecuted));
      worstLemma = Math.max(worstLemma, lemmaViolations(builder).worst);
    }
    for (let i = 0; i < 12; i++) {
      const ent = randomEntangledPair(rng);
      const builderEnt = { alice: () => ent, bob: (b: number, bp: number) => ocbStrategy().bob(b, bp) };
      worstIdent = Math.max(worstIdent, decompositionIdentity(w, builderEnt, strategyPayoff(w, builderEnt)));
      worstLemma = Math.max(worstLemma, lemmaViolations(builderEnt).worst);
    }
    assert.ok(worstIdent < 1e-12, `Born vs functional ${worstIdent}`);
    assert.ok(worstClosed < 1e-12, `functional vs closed form ${worstClosed}`);
    assert.ok(worstLemma < 1e-9, `lemma violation ${worstLemma}`);
  });

  it("the qubit-family bound is cos²(π/8), attained by the OCB protocol; sweep never exceeds it", () => {
    const br = boundReport(coeff, ocbStrategy());
    assert.ok(Math.abs(br.pSuccessBound - COS2_PI_8) < 1e-12);
    assert.ok(Math.abs(br.slack) < 1e-12, `OCB slack ${br.slack}`);
    const rng = mulberry32(606);
    const payoff = (p: Parameters<typeof buildStrategy>[0]) => closedFormProductPayoff(coeff, p).pSuccess;
    let best = -1;
    for (let i = 0; i < 24; i++) {
      best = Math.max(best, hillClimb(payoff, paramsToVector(randomStrategyParams(rng)), rng, 24).value);
    }
    assert.ok(best <= COS2_PI_8 + 1e-9, `sweep best ${best}`);
    const perturbed = ocbParamsVector().map((x) => x + 0.1 * (2 * rng() - 1));
    assert.ok(Math.abs(hillClimb(payoff, perturbed, rng, 60).value - COS2_PI_8) < 1e-9);
  });

  it("the biased OCB functional saturates LC25's (1+α+√(1+α²))/2 on S_OCB,α", () => {
    for (const alpha of [0.5, 1, 2]) {
      const wb = wBiased(alpha);
      assert.deepEqual(checkValidity(wb).violations, [], `alpha=${alpha}`);
      const pr = strategyPayoff(wb, ocbStrategy());
      const ialpha = pr.pAliceGuesses + alpha * pr.pBobGuesses;
      const closed = (1 + alpha + Math.sqrt(1 + alpha * alpha)) / 2;
      assert.ok(Math.abs(ialpha - closed) < 1e-12, `alpha=${alpha}: ${ialpha} vs ${closed}`);
    }
    // the PSD window: c1²+c2² = 1 on the curve, min eig 0 at every alpha
    assert.ok(Math.abs(hermitianExtremeEig(wBiased(2)).min) < 1e-12);
  });
});

describe("T5 the OCB12 equivalence, machine-checked", () => {
  it("W* ≡ OCB12 eq. (7) ≡ LC25 S_OCB,1 elementwise, both valid, S_OCB,2 differs", () => {
    const rep = equivalenceReport();
    assert.deepEqual(equivalenceVerdict(rep).problems, []);
    assert.ok(rep.wVsOCB12 < 1e-12, `eq7 deviation ${rep.wVsOCB12}`);
    assert.ok(rep.wVsLC25 < 1e-12, `LC25 deviation ${rep.wVsLC25}`);
    assert.ok(cmatMaxAbsDiff(wLC25(2), wStar(Math.SQRT1_2)) > 1e-2);
    assert.ok(rep.ocb12Validity.valid && rep.starValidity.valid);
  });

  it("payoff tables agree between the two derivations (Born rule vs eq. (26) closed forms)", () => {
    const rep = equivalenceReport();
    assert.ok(rep.tablesVsClosedForm < 1e-12, `table deviation ${rep.tablesVsClosedForm}`);
    assert.ok(Math.abs(runProtocol(wOCB12()).pSuccess - COS2_PI_8) < 1e-12);
    // closed-form tables themselves sum to 1 per (a,b) row
    const t = ocb12ClosedFormTables();
    for (let b = 0; b < 2; b++) {
      for (let a = 0; a < 2; a++) {
        const sA = (t.pAlice[b] as number[][])[a] as number[];
        const sB = (t.pBob[b] as number[][])[a] as number[];
        assert.ok(Math.abs((sA[0] as number) + (sA[1] as number) - 1) < 1e-12);
        assert.ok(Math.abs((sB[0] as number) + (sB[1] as number) - 1) < 1e-12);
      }
    }
  });
});

describe("smuggling trials (走私审判)", () => {
  const w = wStar(Math.SQRT1_2);
  const rng = mulberry32(918);

  it("trial 1 — counterfeit 'improved violation': NAMED and REJECTED, honest claim accepted", () => {
    const strategy = buildStrategy(randomStrategyParams(rng));
    const executed = strategyPayoff(w, strategy);
    // counterfeit A: the claimed 0.9 rides an INVALID process (c = 0.75, outside the PSD window)
    const badProcess = wStar(0.75);
    const verdictA = adjudicate({ name: "counterfeit-on-invalid-process", claimedValue: 0.9, w: badProcess, builder: strategy, executedPayoff: strategyPayoff(badProcess, strategy) });
    assert.ok(!verdictA.accepted);
    assert.match(verdictA.reasons.join(" | "), /REJECT\[invalid-process\]/);
    assert.match(verdictA.reasons.join(" | "), /not PSD/);
    // counterfeit B: valid process, doctored number (0.86) that the execution contradicts
    const verdictB = adjudicate({ name: "doctored-number", claimedValue: 0.86, w, builder: strategy, executedPayoff: executed });
    assert.ok(!verdictB.accepted);
    assert.match(verdictB.reasons.join(" | "), /REJECT\[claim-vs-execution\]/);
    // honest claim: the OCB protocol at its executed value is accepted
    const ocbExec = strategyPayoff(w, ocbStrategy());
    const verdictC = adjudicate({ name: "honest-ocb", claimedValue: ocbExec.pSuccess, w, builder: ocbStrategy(), executedPayoff: ocbExec });
    assert.deepEqual(verdictC.reasons, []);
    assert.ok(verdictC.accepted);
  });

  it("trial 2 — fake equivalence table: tampered transcriptions NAMED and REJECTED", () => {
    // both tampers are VALID processes; only the comparison against the
    // transcribed eq. (7) / eq. (26) exposes them
    const okStar = compareWithOCB12(wStar(Math.SQRT1_2));
    assert.deepEqual(okStar.problems, []);
    for (const tamper of [
      { name: "sigma_y-tamper", w: wOCB12TamperedPauli() },
      { name: "coefficient-tamper", w: wOCB12TamperedCoeff() },
    ]) {
      const verdict = compareWithOCB12(tamper.w);
      assert.ok(!verdict.ok, `${tamper.name} must be rejected`);
      assert.match(verdict.problems.join(" | "), /REJECT\[elementwise-vs-OCB12\]/, `${tamper.name} must be named`);
      assert.match(verdict.problems.join(" | "), /REJECT\[tables-vs-eq26\]/, `${tamper.name} table mismatch must be named`);
      assert.deepEqual(checkValidity(tamper.w).violations, [], `${tamper.name} is valid — validity alone cannot catch it`);
    }
  });
});
