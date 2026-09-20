import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cmatAdd, cmatMaxAbsDiff, cmatScale } from "../src/core/cmat.js";
import { checkValidity } from "../src/process/validity.js";
import {
  wChannelAB,
  wChannelBA,
  wForbiddenF1,
  wForbiddenF3,
  wMixed,
  wNoisy,
  wNotPSD,
  wStar,
} from "../src/process/construct.js";
import { runProtocol } from "../src/game/quantum.js";
import {
  VERTEX_ORDER,
  adjudicateCausalClaim,
  adjudicateGuaranteedContamination,
  contaminationSpectrum,
  criticalWstarWeight,
  exactCap,
  exactWstarPayoff,
  fToNumber,
  frac,
  hullMembership,
  polytopeExtremes,
  q2,
  q2Sign,
  q2Sub,
  q2ToNumber,
  uniformAnchors,
  vertexMatrix,
} from "../src/process/polytope.js";

const F = frac;
const CAP = 0.75;

describe("E14 polytope — (0) the three vertices: valid, distinct, executed == exact", () => {
  it("all three are valid processes and pairwise distinct (a genuine 2-simplex)", () => {
    for (const v of VERTEX_ORDER) {
      const val = checkValidity(vertexMatrix(v));
      assert.deepEqual(val.violations, [], `${v} must be valid`);
    }
    const [a, b, c] = VERTEX_ORDER;
    assert.ok(a !== undefined && b !== undefined && c !== undefined);
    assert.ok(cmatMaxAbsDiff(vertexMatrix(a), vertexMatrix(b)) > 0.1);
    assert.ok(cmatMaxAbsDiff(vertexMatrix(a), vertexMatrix(c)) > 0.1);
    assert.ok(cmatMaxAbsDiff(vertexMatrix(b), vertexMatrix(c)) > 0.1);
  });

  it("executed payoffs equal the closed forms exactly; the B≺A channel is payoff-isomorphic to white noise under the OCB protocol", () => {
    const pM = runProtocol(wMixed());
    const pAB = runProtocol(wChannelAB());
    const pBA = runProtocol(wChannelBA());
    // branch-level pins: AB saturates the y-branch (Bob reads a); BA stays at chance
    // on BOTH branches (Alice's z-read of A1 returns b XOR t, t private to Bob)
    assert.ok(Math.abs(pAB.pBobGuesses - 1) < 1e-12);
    assert.ok(Math.abs(pAB.pAliceGuesses - 0.5) < 1e-12);
    assert.ok(Math.abs(pBA.pBobGuesses - 0.5) < 1e-12);
    assert.ok(Math.abs(pBA.pAliceGuesses - 0.5) < 1e-12);
    assert.ok(Math.abs(pM.pSuccess - 0.5) < 1e-12);
    assert.ok(Math.abs(pAB.pSuccess - 0.75) < 1e-12);
    assert.ok(Math.abs(pBA.pSuccess - 0.5) < 1e-15);
    // biased closed forms, executed: p_M = p_BA = (c1+c2)/2, p_AB = c1/2 + c2
    for (const [c1, c2] of [
      [0.5, 0.5],
      [1, 0.5],
      [0.5, 1],
      [2, 1],
      [1, 2.5],
    ] as const) {
      const f = (w: ReturnType<typeof wMixed>) => {
        const r = runProtocol(w);
        return c1 * r.pAliceGuesses + c2 * r.pBobGuesses;
      };
      assert.ok(
        Math.abs(f(wMixed()) - (c1 + c2) / 2) < 1e-12,
        `mixed (${c1},${c2})`,
      );
      assert.ok(
        Math.abs(f(wChannelBA()) - (c1 + c2) / 2) < 1e-12,
        `BA (${c1},${c2})`,
      );
      assert.ok(
        Math.abs(f(wChannelAB()) - (c1 / 2 + c2)) < 1e-12,
        `AB (${c1},${c2})`,
      );
    }
  });

  it("the A≺B channel ties the biased cap at the uniform game only — the cap's other branch belongs to a different strategy", () => {
    // p_AB = c1/2 + c2 equals cap = max(c1+c2/2, c1/2+c2) iff c1 ≤ c2;
    // under the fixed protocol the B≺A vertex never ties it
    for (const [c1, c2] of [
      [0.5, 0.5],
      [1, 1],
      [0.5, 1],
    ] as const) {
      const cap = Math.max(c1 + c2 / 2, c1 / 2 + c2);
      assert.ok(
        Math.abs(c1 / 2 + c2 - cap) < 1e-15,
        `AB at cap when c1<=c2 (${c1},${c2})`,
      );
    }
    for (const [c1, c2] of [
      [1, 0.5],
      [2, 1],
    ] as const) {
      const cap = Math.max(c1 + c2 / 2, c1 / 2 + c2);
      assert.ok(
        c1 / 2 + c2 < cap - 1e-12,
        `AB strictly below cap when c1>c2 (${c1},${c2})`,
      );
    }
  });

  it("the Born-rule payoff is affine in the mixing weight: mixture == interpolation to 2e-16 over the grid", () => {
    const wS = wStar(Math.SQRT1_2);
    const pW = runProtocol(wS).pSuccess;
    let worst = 0;
    for (let i = 0; i <= 20; i++) {
      const beta = i / 20;
      for (const v of VERTEX_ORDER) {
        const mix = cmatAdd(
          cmatScale(wS, beta),
          cmatScale(vertexMatrix(v), 1 - beta),
        );
        const lin =
          (1 - beta) * runProtocol(vertexMatrix(v)).pSuccess + beta * pW;
        worst = Math.max(worst, Math.abs(runProtocol(mix).pSuccess - lin));
        assert.deepEqual(
          checkValidity(mix).violations,
          [],
          `mixture ${v} β=${beta} must stay valid`,
        );
      }
    }
    assert.ok(worst < 2.5e-16, `worst linearity deviation ${worst}`);
  });
});

describe("E14 polytope — (a) the worst direction: exact LP, dual certificates, the 1/√2 anchor", () => {
  it("the exact simplex extremizes the payoff over C with dual-certificate gap exactly 0 (uniform + biased pairs)", () => {
    for (const [c1, c2, lbl] of [
      [F(1n), F(1n), "uniform"],
      [F(1n), F(1n, 2n), "(1,1/2)"],
      [F(2n), F(5n), "(2,5)"],
      [F(1n), F(3n), "(1,3)-outside-cone"],
    ] as const) {
      const ex = polytopeExtremes(c1, c2);
      assert.equal(
        ex.best.vertex,
        "channelAB",
        `${lbl}: the channel is the payoff-max vertex`,
      );
      assert.equal(
        ex.worst.vertex,
        "mixed",
        `${lbl}: white noise is the payoff-min vertex`,
      );
      assert.equal(fToNumber(ex.bestDualGap), 0, `${lbl} best dual gap`);
      assert.equal(fToNumber(ex.worstDualGap), 0, `${lbl} worst dual gap`);
    }
    // uniform: max = 3/2 in (1,1) units (= 3/4 game units), min = 1 (= 1/2)
    const u = polytopeExtremes(F(1n), F(1n));
    assert.equal(fToNumber(u.best.value), 1.5);
    assert.equal(fToNumber(u.worst.value), 1);
  });

  it("the critical W*-weights at uniform weights are EXACT: white-noise and BA directions √2/2, channel direction 0", () => {
    const mixed = criticalWstarWeight("mixed", F(1n), F(1n));
    const ba = criticalWstarWeight("channelBA", F(1n), F(1n));
    const ab = criticalWstarWeight("channelAB", F(1n), F(1n));
    // β*(white noise) = 1/√2 = √2/2 — exactly, in ℚ(√2)
    assert.equal(q2Sign(q2Sub(mixed, q2(F(0n), F(1n, 2n)))), 0);
    assert.equal(q2Sign(q2Sub(ba, q2(F(0n), F(1n, 2n)))), 0);
    assert.equal(q2Sign(q2Sub(ab, q2(F(0n), F(0n)))), 0);
    // floats agree with the closed forms
    assert.ok(Math.abs(q2ToNumber(mixed) - Math.SQRT1_2) < 1e-15);
    // σ_guar = 1 − 1/√2 exactly
    const an = uniformAnchors();
    assert.equal(q2Sign(q2Sub(an.sigmaGuaranteed, q2(F(1n), F(-1n, 2n)))), 0);
    assert.ok(
      Math.abs(q2ToNumber(an.sigmaGuaranteed) - (1 - Math.SQRT1_2)) < 1e-15,
    );
  });

  it("biased exact pins: β*(1,1/2) = 2√2/3 (white noise/BA) and (2+3√2)/7 (channel) — floats agree", () => {
    const half = F(1n, 2n);
    const mixed = criticalWstarWeight("mixed", F(1n), half);
    const ab = criticalWstarWeight("channelAB", F(1n), half);
    assert.equal(q2Sign(q2Sub(mixed, q2(F(0n), F(2n, 3n)))), 0); // 2√2/3
    assert.equal(q2Sign(q2Sub(ab, q2(F(2n, 7n), F(3n, 7n)))), 0); // (2+3√2)/7
    assert.ok(Math.abs(q2ToNumber(mixed) - 0.9428090415820634) < 1e-15);
    assert.ok(Math.abs(q2ToNumber(ab) - 0.8918058124456122) < 1e-15);
    // inside the cone every direction now has β* > 0 (no vertex sits at the cap)
    for (const v of VERTEX_ORDER) {
      assert.ok(
        q2ToNumber(criticalWstarWeight(v, F(1n), half)) > 1e-9,
        `${v} β* > 0 at biased weights`,
      );
    }
  });

  it("weight pairs outside the silver-ratio cone are refused BY NAME (no violation to protect)", () => {
    assert.throws(
      () => criticalWstarWeight("mixed", F(1n), F(3n)),
      /no violation to protect/,
    );
    // the executed confirmation: W* itself loses there (E13's face)
    const r = runProtocol(wStar(Math.SQRT1_2));
    assert.ok(1 * r.pAliceGuesses + 3 * r.pBobGuesses < 3.5 - 1e-9);
  });

  it("executed sign flips across β* on the worst direction: β=0.75 violates everywhere, β=0.6 dies on white noise/BA", () => {
    const ok = adjudicateGuaranteedContamination(0.75);
    assert.ok(ok.accepted, ok.reasons.join(" | "));
    for (const p of ok.executedPayoffs) assert.ok(p > CAP + 1e-6);
    const bad = adjudicateGuaranteedContamination(0.6);
    assert.ok(!bad.accepted);
    assert.equal(
      bad.reasons.length,
      2,
      "white noise AND the BA direction both die",
    );
    assert.match(
      bad.reasons.join(" | "),
      /REJECT\[polytope\/claim-beyond-radius\]/,
    );
    assert.match(bad.reasons.join(" | "), /mixed/);
    assert.match(bad.reasons.join(" | "), /channelBA/);
    // ...while the channel direction at β=0.6 STILL violates (the best direction)
    assert.ok((bad.executedPayoffs[1] as number) > CAP + 1e-3);
  });
});

describe("E14 polytope — (b) the best direction: the channel sits at the cap, violation arbitrarily dilutable", () => {
  it("β*(channelAB) = 0 at uniform weights: even β = 1e-9 keeps the executed violation", () => {
    const wS = wStar(Math.SQRT1_2);
    const mix = cmatAdd(cmatScale(wS, 1e-9), cmatScale(wChannelAB(), 1 - 1e-9));
    const p = runProtocol(mix).pSuccess;
    assert.ok(p > CAP + 1e-10, `β=1e-9 mixture payoff ${p} must exceed 3/4`);
    assert.ok(
      Math.abs(p - 0.75) < 1e-8,
      "and it is barely above — the boundary is tight",
    );
    assert.deepEqual(checkValidity(mix).violations, []);
  });

  it("the cap identity behind the zero: p_AB = cap at uniform weights, executed and exact", () => {
    assert.equal(fToNumber(exactCap(F(1n, 2n), F(1n, 2n))), 0.75);
    const pAB = runProtocol(wChannelAB()).pSuccess;
    assert.ok(Math.abs(pAB - 0.75) < 1e-15);
    // payoff-face membership conviction: W* cannot be causal because a causal
    // member's payoff is bounded by the best vertex = the cap
    const ex = polytopeExtremes(F(1n, 2n), F(1n, 2n));
    const pW = q2ToNumber(exactWstarPayoff(F(1n, 2n), F(1n, 2n)));
    assert.ok(
      pW > fToNumber(ex.best.value) + 1e-12,
      "p_W* > max vertex payoff = cap",
    );
  });
});

describe("E14 polytope — (c) the smuggling trial: exact hull membership", () => {
  it("genuine barycentric members are recovered EXACTLY by the Phase-1 LP", () => {
    const thirds = cmatAdd(
      cmatAdd(cmatScale(wChannelAB(), 1 / 3), cmatScale(wChannelBA(), 1 / 3)),
      cmatScale(wMixed(), 1 / 3),
    );
    const m = hullMembership(thirds, "thirds");
    assert.ok(m.inside);
    for (const lam of m.lambda ?? []) {
      assert.ok(
        Math.abs(fToNumber(lam) - 1 / 3) < 1e-12,
        `λ component ${fToNumber(lam)} vs 1/3`,
      );
    }
    const edge = cmatAdd(
      cmatScale(wChannelAB(), 0.5),
      cmatScale(wMixed(), 0.5),
    );
    const e = hullMembership(edge, "edge");
    assert.ok(e.inside);
    assert.ok(e.lambda !== null);
    assert.ok(Math.abs(fToNumber(e.lambda[0]!) - 0.5) < 1e-12);
    assert.ok(Math.abs(fToNumber(e.lambda[1]!) - 0.5) < 1e-12);
    assert.equal(fToNumber(e.lambda[2]!), 0);
  });

  it("forbidden-pattern and PSD-violating processes are convicted by exact infeasibility, BY NAME", () => {
    for (const [w, name] of [
      [wForbiddenF1(), "wForbiddenF1"],
      [wForbiddenF3(), "wForbiddenF3"],
      [wNotPSD(), "wNotPSD"],
    ] as const) {
      const v = adjudicateCausalClaim(w, name);
      assert.ok(!v.accepted, `${name} must be rejected`);
      assert.match(
        v.problems.join(" | "),
        /REJECT\[polytope\/not-in-hull\]/,
        `${name} structural conviction`,
      );
      const m = hullMembership(w, name);
      assert.ok(
        !m.inside && m.infeasibility !== null && fToNumber(m.infeasibility) > 0,
        `${name} exact positive infeasibility`,
      );
    }
  });

  it("W* and its noisy blends are refused at the irrationality gate (1/(4√2) entries), and the payoff face convicts them besides", () => {
    for (const [w, name] of [
      [wStar(Math.SQRT1_2), "W*"],
      [wNoisy(0.9), "noisy-0.9"],
      [wNoisy(0.999), "noisy-0.999"],
    ] as const) {
      const v = adjudicateCausalClaim(w, name);
      assert.ok(!v.accepted, `${name} must be rejected`);
      assert.match(
        v.problems.join(" | "),
        /REJECT\[polytope\/irrational-entry\]/,
      );
    }
    // the behavioral conviction, independent of coordinate rings: a causal
    // member's payoff cannot exceed the cap, W*'s does
    const r = runProtocol(wStar(Math.SQRT1_2));
    assert.ok(r.pSuccess > CAP + 0.1);
  });
});

describe("E14 — certificate divergence: the {0, ½} spectrum dies first, the violation survives", () => {
  it("W* and the channels are isospectral {0, ½}; any contamination spreads the spectrum while the mixture stays valid", () => {
    for (const [beta, v] of [
      [0.5, "channelAB"],
      [0.5, "mixed"],
      [0.99, "channelAB"],
    ] as const) {
      const s = contaminationSpectrum(beta, v);
      assert.ok(s.mixValid, `β=${beta} ${v} mixture must be a valid process`);
      assert.ok(
        s.spectrumBroken,
        `β=${beta} ${v}: the exact {0,½} certificate is broken (eig ${s.mix.min}, ${s.mix.max})`,
      );
      assert.ok(
        Math.abs(s.wstar.min) < 1e-12 && Math.abs(s.wstar.max - 0.5) < 1e-12,
      );
    }
    // the white-noise mixture at β=0.5: eig {1/8, 3/8} — spread INSIDE the window
    const wn = contaminationSpectrum(0.5, "mixed");
    assert.ok(
      Math.abs(wn.mix.min - 0.125) < 1e-9 &&
        Math.abs(wn.mix.max - 0.375) < 1e-9,
    );
  });

  it("the divergence itself: at β=0.5 on the channel direction the spectrum is broken AND the violation alive", () => {
    const wS = wStar(Math.SQRT1_2);
    const mix = cmatAdd(cmatScale(wS, 0.5), cmatScale(wChannelAB(), 0.5));
    const p = runProtocol(mix).pSuccess;
    assert.ok(p > CAP + 1e-3, `payoff ${p} still violates`);
    const s = contaminationSpectrum(0.5, "channelAB");
    assert.ok(s.spectrumBroken);
  });
});
