import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  basisState,
  boundedCensusGain,
  columnState,
  diagonalAdversaryMembership,
  haarCensus,
  haarMeanMembership,
  haarPureSecondMoment,
  haarStepSecondMoment,
  mixedState,
  type HaarCensusSpec,
} from "../src/kernel/haar.js";
import { ChoiceLangError } from "../src/core/errors.js";
import { makeRng } from "../src/core/rng.js";
import { type Program } from "../src/kernel/lang.js";
import {
  randomUnitary,
  engineeredUnitary,
  worldProjector,
  worldState,
  DATA_DIM,
} from "../src/kernel/fixtures.js";

/** The rejection cross-examination: a named code, and a message that names the crime. */
function assertRejects(fn: () => unknown, code: string, needle: RegExp): void {
  assert.throws(fn, (err: unknown) => {
    assert.ok(
      err instanceof ChoiceLangError,
      `expected a ChoiceLangError, got ${String(err)}`,
    );
    assert.equal(err.code, code);
    assert.match(err.message, needle);
    return true;
  });
}

describe("C2 the Haar adversary face", () => {
  it("the closed forms: universal mean d_W/d, pure moment, and the theta=0 collapse", () => {
    for (const [dimW, dim] of [
      [1, 4],
      [2, 4],
      [3, 4],
      [2, 8],
      [5, 8],
    ] as const) {
      assert.ok(Math.abs(haarMeanMembership(dimW, dim) - dimW / dim) < 1e-15);
      assert.ok(
        Math.abs(
          haarPureSecondMoment(dimW, dim) -
            (dimW * (dimW + 1)) / (dim * (dim + 1)),
        ) < 1e-15,
      );
    }
    // one branch only (theta = 0): the step's second moment IS the pure moment
    assert.ok(
      Math.abs(haarStepSecondMoment(0, 2, 4) - haarPureSecondMoment(2, 4)) <
        1e-15,
    );
    // balanced branches: c^4+s^4 = 1/2 at theta = pi/4
    const theta = Math.PI / 4;
    const closed = haarStepSecondMoment(theta, 2, 4);
    const expect = 0.5 * haarPureSecondMoment(2, 4) + 2 * 0.25 * 0.25;
    assert.ok(Math.abs(closed - expect) < 1e-15);
  });

  it("mean universality: every census row sits within 4 sigma of d_W/d, over two seed blocks", () => {
    const specs: HaarCensusSpec[] = [];
    for (const dimW of [1, 2, 3]) {
      for (const theta of [0, 0.8, 1.3]) {
        for (const input of ["in-world", "perp", "mixed"] as const) {
          // perp is the basis state at index dimW — legal for every dimW < dim
          specs.push({ dimW, dim: DATA_DIM, theta, input, draws: 1000 });
        }
      }
    }
    specs.push({
      dimW: 2,
      dim: 4,
      theta: 0.6,
      input: "random-pure",
      draws: 1000,
    });
    specs.push({
      dimW: 5,
      dim: 8,
      theta: 0.6,
      input: "random-pure",
      draws: 800,
    });
    specs.push({
      dimW: 2,
      dim: 8,
      theta: 1.1,
      input: "random-pure",
      draws: 800,
    });
    for (const seedBase of [100, 9000]) {
      for (const row of haarCensus(specs, seedBase)) {
        assert.ok(
          Math.abs(row.sigmaUnits) < 4,
          `mean leg (dimW=${row.dimW}, dim=${row.dim}, theta=${row.theta}, ${row.input}, seed ${seedBase}): ${row.meanMC} vs ${row.closedMean} at ${row.sigmaUnits.toFixed(2)} sigma`,
        );
        // the mixed input is deterministic per draw: q = d_W/d EXACTLY, not just in expectation
        if (row.input === "mixed") {
          assert.ok(Math.abs(row.meanMC - row.closedMean) < 1e-12);
          assert.ok(
            Math.abs(row.moment2MC - row.closedMean ** 2) < 1e-12,
            "E[q^2] = mean^2 for the deterministic face",
          );
        }
      }
    }
  });

  it("the pure-input second moment closes: every pure row within 6 sigma, two seed blocks", () => {
    const specs: HaarCensusSpec[] = [];
    for (const dimW of [1, 2, 3]) {
      for (const theta of [0, 0.8, 1.3]) {
        specs.push({
          dimW,
          dim: DATA_DIM,
          theta,
          input: "random-pure",
          draws: 3000,
        });
      }
    }
    for (const seedBase of [200, 7000]) {
      for (const row of haarCensus(specs, seedBase)) {
        assert.ok(
          Math.abs(row.moment2SigmaUnits) < 6,
          `moment-2 leg (dimW=${row.dimW}, theta=${row.theta}, seed ${seedBase}): ${row.moment2MC} vs ${row.closedMoment2} at ${row.moment2SigmaUnits.toFixed(2)} sigma`,
        );
        assert.ok(
          Math.abs(row.sigmaUnits) < 4,
          "the mean face holds on the same rows",
        );
      }
    }
  });

  it("negative control: a FIXED diagonal adversary breaks universality — convicted off the Haar family", () => {
    // diagonal phases commute with the coordinate world, so membership after
    // the step equals membership before it: 1 for the world resident, not d_W/d
    const q = diagonalAdversaryMembership(
      0.8,
      [0.3, 1.1, 2.2, 3.0],
      worldState(),
      worldProjector(),
    );
    const universal = haarMeanMembership(2, DATA_DIM);
    assert.ok(
      Math.abs(q - 1) < 1e-12,
      "the diagonal adversary cannot move membership at all",
    );
    assert.ok(
      Math.abs(q - universal) > 0.4,
      `deviation ${Math.abs(q - universal)} must be order 1/2, not a rounding floor`,
    );
    // and the mixed input exposes the mechanism's other side: I/d is invariant
    // under every unitary, so the diagonal step matches the universal constant
    // there — universality's failure is about the FAMILY, not the value at one input
    const qMixed = diagonalAdversaryMembership(
      0.8,
      [0.3, 1.1, 2.2, 3.0],
      mixedState(DATA_DIM),
      worldProjector(),
    );
    assert.ok(Math.abs(qMixed - universal) < 1e-12);
  });

  it("the bounded 24-strategy census positioned against the universal mean (DATA)", () => {
    const first: Program = [
      { theta: 0.8, u0: engineeredUnitary(210), u1: engineeredUnitary(211) },
    ];
    const gain = boundedCensusGain(
      first,
      [1],
      1,
      worldState(),
      worldProjector(),
    );
    assert.ok(
      Math.abs(gain.universal - 0.5) < 1e-15,
      "d_W/d = 2/4 for the model's world",
    );
    assert.ok(
      gain.censusMin < 0.3,
      `census min ${gain.censusMin} — the bounded set beats Haar in this cell`,
    );
    assert.ok(gain.censusMax > 0.6, `census max ${gain.censusMax}`);
    assert.ok(
      gain.maxGain > 0.2,
      `max gain ${gain.maxGain} is order 1/4, a real attack surface`,
    );
  });

  it("named rejections at the Haar boundary", () => {
    assert.throws(
      () => haarMeanMembership(0, 4),
      (err: unknown) => {
        assert.ok(err instanceof ChoiceLangError);
        assert.equal(err.code, "HAAR_DIM");
        return true;
      },
    );
    assertRejects(
      () => haarMeanMembership(5, 4),
      "HAAR_DIM",
      /dimW must be an integer in \[1, dim=4\], got 5/,
    );
    assertRejects(
      () => haarStepSecondMoment(Number.NaN, 2, 4),
      "HAAR_THETA",
      /non-finite control angle/,
    );
    assertRejects(
      () =>
        haarCensus(
          [{ dimW: 2, dim: 4, theta: 0.5, input: "mixed", draws: 0 }],
          1,
        ),
      "HAAR_DRAWS",
      /draws/,
    );
    assertRejects(
      () => basisState(4, 4),
      "HAAR_DIM",
      /index k must be in \[0, dim=4\)/,
    );
    assertRejects(
      () =>
        diagonalAdversaryMembership(0.5, [], worldState(), worldProjector()),
      "HAAR_DIM",
      /phases/,
    );
    assertRejects(
      () =>
        diagonalAdversaryMembership(
          0.5,
          [Number.NaN, 1, 2, 3],
          worldState(),
          worldProjector(),
        ),
      "HAAR_THETA",
      /phase 1 is non-finite/,
    );
  });

  it("columnState is a pure state of the complex column (trace 1, idempotent)", () => {
    const u = randomUnitary(makeRng(31337), 4);
    const psi = columnState(u, 0);
    let tr = 0;
    for (let i = 0; i < 4; i++) tr += psi.re[i * 4 + i]!;
    assert.ok(Math.abs(tr - 1) < 1e-15);
    // psi * psi = psi (idempotent to the floor): the imaginary parts are load-bearing
    let worst = 0;
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let re = 0;
        let im = 0;
        for (let k = 0; k < 4; k++) {
          re +=
            psi.re[i * 4 + k]! * psi.re[k * 4 + j]! -
            psi.im[i * 4 + k]! * psi.im[k * 4 + j]!;
          im +=
            psi.re[i * 4 + k]! * psi.im[k * 4 + j]! +
            psi.im[i * 4 + k]! * psi.re[k * 4 + j]!;
        }
        worst = Math.max(
          worst,
          Math.abs(re - psi.re[i * 4 + j]!),
          Math.abs(im - psi.im[i * 4 + j]!),
        );
      }
    }
    assert.ok(worst < 1e-15, `idempotence deviation ${worst}`);
  });
});
