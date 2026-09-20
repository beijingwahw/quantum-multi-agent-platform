/** G2-a trap-budget wall: exact two-point Cramér budgets, monotone noise price, MC + smuggling trials. */

import { test } from "node:test";
import assert from "node:assert/strict";
import { makeRng } from "../src/core/rng.js";
import {
  binaryKl,
  cramerTwoPointDev,
  trapBudget,
  budgetSequence,
  mcAboveThreshold,
  checkTrapBudgetClaim,
  honestAcceptance,
} from "../src/protocol/trapwall.js";
import {
  ampDampAcceptanceClosed,
  phaseDampAcceptanceClosed,
} from "../src/protocol/noise.js";
import { hoeffdingN } from "../src/protocol/samplewall.js";

test("TB-a engine anchor: cramerRate on a two-point distribution IS the binary KL, both tails, ≤1e-14", () => {
  let worst = 0;
  let where = "";
  for (let pi = 1; pi < 100; pi++) {
    const p = pi / 100;
    for (let ti = 1; ti < 100; ti++) {
      const tau = ti / 100;
      if (Math.abs(tau - p) < 0.005) continue; // the trivial-rate diagonal
      const dev = cramerTwoPointDev(p, tau);
      if (dev > worst) {
        worst = dev;
        where = `p=${p}, τ=${tau}`;
      }
    }
  }
  assert.ok(
    worst <= 1e-14,
    `worst engine-vs-closed-form deviation ${worst.toExponential(3)} at ${where} exceeds 1e-14`,
  );
});

test("TB-a analytic spot checks: D(1/2‖1/4) = ln(4/3)/2 hand values", () => {
  // hand-checkable points (the closed form is its own second path):
  // D(1/2‖1/4) = ½ln(½/¼) + ½ln(½/¾) = ½ln 2 + ½ln(2/3) = ½ln(4/3)
  assert.ok(
    Math.abs(
      binaryKl(0.5, 0.25) - (0.5 * Math.log(2) + 0.5 * Math.log(2 / 3)),
    ) < 1e-15,
  );
  assert.ok(
    Math.abs(
      binaryKl(0.9, 0.8) - (0.9 * Math.log(1.125) + 0.1 * Math.log(0.5)),
    ) < 1e-15,
  );
  // Pinsker-Bernoulli face at one point: D(1/2‖1/4) ≥ 2·(1/4)²
  assert.ok(binaryKl(0.5, 0.25) >= 2 * 0.0625 - 1e-15);
});

test("TB-b budget row: honest closed forms re-imported, midpoint threshold, exact exponents", () => {
  for (const channel of ["phase", "amplitude"] as const) {
    const gamma = channel === "phase" ? 0.1 : 0.3;
    const b = trapBudget(channel, gamma, 0.4, 0.05);
    assert.ok(
      Math.abs(b.pH - honestAcceptance(channel, gamma)) === 0,
      "pH single-sourced from the T5+ closed form",
    );
    if (channel === "phase")
      assert.ok(Math.abs(b.pH - phaseDampAcceptanceClosed(gamma)) === 0);
    else assert.ok(Math.abs(b.pH - ampDampAcceptanceClosed(gamma)) === 0);
    assert.equal(b.pL, 1 - 0.2); // 1 − ε/2
    assert.ok(Math.abs(b.tau - (b.pH + b.pL) / 2) < 1e-16);
    assert.equal(b.nChernoff, Math.ceil(Math.log(1 / 0.05) / b.rate));
    assert.ok(
      b.pH > b.tau && b.tau > b.pL,
      "the threshold separates the hypotheses",
    );
  }
});

test("TB-b the engine reproduces both working-point exponents to 1e-14", () => {
  const b = trapBudget("phase", 0.15, 0.4, 0.05);
  assert.ok(
    cramerTwoPointDev(b.pH, b.tau) <= 1e-14,
    "honest-side exponent is the engine rate (lower tail via the dual)",
  );
  assert.ok(
    cramerTwoPointDev(b.pL, b.tau) <= 1e-14,
    "attack-side exponent is the engine rate",
  );
});

test("TB-c noise price: N(γ) strictly increasing on both channel families", () => {
  const eps = 0.4;
  const delta = 0.05;
  const phaseGrid = [0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14, 0.16, 0.18]; // γ < ε/2 keeps p̄_H > p̄_L
  const ampGrid = [0.05, 0.15, 0.25, 0.35, 0.45, 0.55, 0.6];
  for (const [channel, grid] of [
    ["phase", phaseGrid],
    ["amplitude", ampGrid],
  ] as const) {
    const seq = budgetSequence(channel, grid, eps, delta);
    for (let i = 1; i < seq.length; i++) {
      assert.ok(
        seq[i]! > seq[i - 1]!,
        `${channel}: N(γ) not strictly increasing at grid step ${i} (${seq[i - 1]} → ${seq[i]}) — noise price monotonicity violated`,
      );
    }
  }
});

test("TB-c the binding exponent strictly decreases along the sweep (the monotonicity root)", () => {
  const eps = 0.4;
  for (const g of [0.05, 0.1, 0.15]) {
    const prev = trapBudget("phase", g, eps, 0.05).rate;
    const next = trapBudget(
      "phase",
      g + 0.05 < 0.2 ? g + 0.05 : 0.19,
      eps,
      0.05,
    ).rate;
    assert.ok(next < prev, `D_min must strictly decrease as γ grows (γ=${g})`);
  }
});

test("TB-d Chernoff never exceeds Hoeffding: D(τ‖p) ≥ 2(τ−p)² on the two-point grid", () => {
  for (let pi = 2; pi < 100; pi += 3) {
    const p = pi / 100;
    for (let ti = 2; ti < 100; ti += 3) {
      const tau = ti / 100;
      if (Math.abs(tau - p) < 0.02) continue;
      const d = tau > p ? binaryKl(tau, p) : binaryKl(tau, p);
      const margin = Math.abs(tau - p);
      assert.ok(
        d >= 2 * margin * margin - 1e-12,
        `Pinsker-Bernoulli violated at p=${p}, τ=${tau}`,
      );
      assert.ok(
        hoeffdingN(1, 0.05, margin) >= Math.ceil(Math.log(20) / d),
        `N_H < N_C at p=${p}, τ=${tau}`,
      );
    }
  }
});

test("TB-b budget rows keep Chernoff ≤ Hoeffding at the binding side", () => {
  for (const b of [
    trapBudget("phase", 0.1, 0.4, 0.05),
    trapBudget("amplitude", 0.3, 0.4, 0.05),
    trapBudget("phase", 0.17, 0.5, 0.01),
  ]) {
    assert.ok(
      b.nChernoff <= b.nHoeffding,
      `N_C=${b.nChernoff} > N_H=${b.nHoeffding}`,
    );
  }
});

test("TB-b MC: both error rates at N_C sit at/below δ; at N_C/4 the acquittal error blows past δ", () => {
  const b = trapBudget("phase", 0.1, 0.4, 0.1); // τ=(pH+pL)/2 with pH=1−γ=0.9, pL=0.8 (separable: γ<ε/2)
  const rng = makeRng(0x7ea2b19);
  // false acquittal: attacker accepts above τ — must be ≤ δ (+ MC slack at 3σ)
  const acquit = mcAboveThreshold(b.pL, b.tau, b.nChernoff, 4000, rng);
  assert.ok(
    acquit.rate <= b.delta + 3 * acquit.stdErr,
    `false-acquittal ${acquit.rate.toFixed(4)} ± ${acquit.stdErr.toFixed(4)} exceeds δ=${b.delta} at N_C=${b.nChernoff}`,
  );
  // false conviction: honest accepts above τ at rate 1 − P[≥τ]; the honest error is P[<τ]
  const honestAbove = mcAboveThreshold(b.pH, b.tau, b.nChernoff, 4000, rng);
  const conviction = 1 - honestAbove.rate;
  assert.ok(
    conviction <= b.delta + 3 * honestAbove.stdErr,
    `false-conviction ${conviction.toFixed(4)} exceeds δ=${b.delta} at N_C`,
  );
  // quarter budget: the acquittal error must be decisively above δ (exponent quartered ⇒ δ^{1/4})
  const quarter = Math.max(1, Math.floor(b.nChernoff / 4));
  const starved = mcAboveThreshold(b.pL, b.tau, quarter, 4000, rng);
  assert.ok(
    starved.rate > b.delta + 5 * starved.stdErr,
    `starved budget N=${quarter} still passes δ=${b.delta} (${starved.rate.toFixed(4)}) — the wall has no teeth`,
  );
});

test("audit: a too-cheap vendor claim is NAMED and rejected; an honest one passes", () => {
  const b = trapBudget("amplitude", 0.2, 0.3, 0.05);
  const cheat = checkTrapBudgetClaim({
    channel: "amplitude",
    gamma: 0.2,
    epsilon: 0.3,
    delta: 0.05,
    claimedN: b.nChernoff - 1,
  });
  assert.equal(cheat.ok, false);
  assert.equal(cheat.name, "below-exact-trap-budget");
  assert.ok(
    cheat.detail.includes("requires N"),
    "the conviction names the requirement",
  );
  const honest = checkTrapBudgetClaim({
    channel: "amplitude",
    gamma: 0.2,
    epsilon: 0.3,
    delta: 0.05,
    claimedN: b.nChernoff,
  });
  assert.equal(honest.ok, true);
  assert.equal(honest.name, "clean");
  const padded = checkTrapBudgetClaim({
    channel: "amplitude",
    gamma: 0.2,
    epsilon: 0.3,
    delta: 0.05,
    claimedN: b.nChernoff * 1001,
  });
  assert.equal(padded.ok, false);
  assert.equal(padded.name, "padded-beyond-any-exponent-slop");
});

test("guards: the degenerate regime and illegal domains are refused by name", () => {
  // ε=2γ (phase) drives p̄_H onto p̄_L — no threshold separates them
  assert.throws(() => trapBudget("phase", 0.1, 0.2, 0.05), /QV_DEGENERATE/);
  assert.throws(() => trapBudget("phase", 0.25, 0.4, 0.05), /QV_DEGENERATE/); // γ > ε/2
  assert.throws(() => trapBudget("phase", 0.1, 0.4, 1), /QV_DELTA/);
  assert.throws(() => honestAcceptance("phase", 0), /QV_PROBABILITY/);
  assert.throws(() => binaryKl(0.5, 1), /QV_PROBABILITY/);
});
