import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkBoard, runWitnesses } from "../src/kernel/audit.js";
import { BOARD, type BoardRow } from "../src/kernel/board.js";
import { makeRng } from "../src/core/rng.js";
import { maximallyMixed, randomStateVec, vecToRho } from "../src/core/states.js";
import { traceDistance } from "../src/core/measures.js";
import { identity, mat, matEq, mAdd, mDagger, mMul } from "../src/core/cmat.js";
import { applyUnitary } from "../src/core/channels.js";
import {
  GAMMA,
  applyLaw,
  applyPerturbed,
  collapseIntoWorld,
  h2,
  inWorldState,
  iterateLaw,
  lawKraus,
  leakage,
  membershipCharge,
  outOfWorldState,
  perturbedLeakageBound,
  randomBranchUnitary,
  randomCptpKraus,
  randomUnitary,
  twoRateInWorld,
  twoRateRecursion,
} from "../src/kernel/law.js";

/** BoardRow with readonly stripped: smuggle deep-copies the board, so
 * in-place mutation of the copy is the whole point of the harness. */
type WritableBoardRow = { -readonly [K in keyof BoardRow]: BoardRow[K] };

function smuggle(mutate: (rows: BoardRow[]) => void): BoardRow[] {
  const copy = JSON.parse(JSON.stringify(BOARD)) as BoardRow[];
  mutate(copy);
  return copy;
}

describe("T1 the board stands", () => {
  it("the checker passes on the real board", () => {
    assert.deepEqual(checkBoard(), []);
  });

  it("all six witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the law's machinery", () => {
  it("the law is a CPTP map: Kraus completeness to the rounding floor", () => {
    for (const gamma of [0.1, GAMMA, 0.6]) {
      let completeness = mat(4, 4);
      for (const k of lawKraus(gamma)) completeness = mAdd(completeness, mMul(mDagger(k), k));
      assert.ok(matEq(completeness, identity(4), 1e-14));
    }
  });

  it("random Stinespring channels are CPTP too (the census is fair)", () => {
    const rng = makeRng(77);
    for (let t = 0; t < 30; t++) {
      const kraus = randomCptpKraus(rng, 4, 2);
      let completeness = mat(4, 4);
      for (const k of kraus) completeness = mAdd(completeness, mMul(mDagger(k), k));
      assert.ok(matEq(completeness, identity(4), 1e-13));
    }
  });

  it("random unitaries are unitary (both generators)", () => {
    const rng = makeRng(78);
    for (let t = 0; t < 12; t++) {
      const u = randomUnitary(rng, 4);
      assert.ok(matEq(mMul(mDagger(u), u), identity(4), 1e-12));
      const b = randomBranchUnitary(rng);
      assert.ok(matEq(mMul(mDagger(b), b), identity(4), 1e-12));
    }
  });

  it("quiet on the world: the law is the identity map on in-world states", () => {
    const rng = makeRng(31);
    for (let t = 0; t < 20; t++) {
      const rho = inWorldState(vecToRho(randomStateVec(rng, 2)));
      const out = applyLaw(rho, GAMMA);
      assert.ok(traceDistance(out, rho) <= 1e-15);
    }
  });

  it("sector book: p' = p + γ(1−p) and leakage(k) = (1−γ)^k (1−p0) exact", () => {
    const rng = makeRng(32);
    for (let t = 0; t < 40; t++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      const p0 = membershipCharge(rho);
      assert.ok(Math.abs(membershipCharge(applyLaw(rho, GAMMA)) - (p0 + GAMMA * (1 - p0))) <= 1e-15);
      for (const k of [1, 4, 17, 50]) {
        assert.ok(Math.abs(leakage(iterateLaw(rho, k, GAMMA)) - Math.pow(1 - GAMMA, k) * (1 - p0)) <= 1e-14);
      }
    }
  });

  it("global attraction: k=200 equals the into-world collapse to 1e-12", () => {
    const rng = makeRng(33);
    for (let t = 0; t < 12; t++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      assert.ok(traceDistance(iterateLaw(rho, 200, GAMMA), collapseIntoWorld(rho)) <= 1e-12);
    }
    // the worst start: entirely outside the world, cargo intact after the ride in
    const cargo = vecToRho(randomStateVec(rng, 2));
    const outside = outOfWorldState(cargo);
    assert.ok(traceDistance(iterateLaw(outside, 200, GAMMA), inWorldState(cargo)) <= 1e-12);
    assert.ok(membershipCharge(iterateLaw(outside, 200, GAMMA)) >= 1 - 1e-12);
  });

  it("the Lyapunov increment: ΔV = γ(1−V) with equality exactly on-world", () => {
    const rng = makeRng(34);
    for (let t = 0; t < 50; t++) {
      const rho = vecToRho(randomStateVec(rng, 4));
      const v = membershipCharge(rho);
      const dv = membershipCharge(applyLaw(rho, GAMMA)) - v;
      assert.ok(Math.abs(dv - GAMMA * (1 - v)) <= 1.5e-15);
      if (1 - v > 1e-12) assert.ok(dv > 1e-14, "strict increase off the world");
    }
    const onWorld = inWorldState(maximallyMixed(2));
    assert.ok(Math.abs(membershipCharge(applyLaw(onWorld, GAMMA)) - membershipCharge(onWorld)) <= 1e-15);
  });

  it("engineered branch programs conserve the charge; generic unitaries do not", () => {
    const rng = makeRng(35);
    for (let t = 0; t < 20; t++) {
      const u = randomBranchUnitary(rng);
      for (const rho of [inWorldState(maximallyMixed(2)), vecToRho(randomStateVec(rng, 4)), maximallyMixed(4)]) {
        assert.ok(Math.abs(membershipCharge(applyUnitary(rho, u)) - membershipCharge(rho)) <= 1.5e-15);
      }
    }
    let moved = 0;
    for (let t = 0; t < 10; t++) {
      const u = randomUnitary(rng, 4);
      const rho = vecToRho(randomStateVec(rng, 4));
      moved = Math.max(moved, Math.abs(membershipCharge(applyUnitary(rho, u)) - membershipCharge(rho)));
    }
    assert.ok(moved > 0.3, "a generic unitary must be able to move the charge");
  });

  it("perturbation: asymptotic leakage stays under the exact algebra bound", () => {
    const rng = makeRng(36);
    for (const eps of [0.002, 0.01, 0.05, 0.1]) {
      let worst = 0;
      for (let t = 0; t < 8; t++) {
        const nKraus = randomCptpKraus(rng, 4, 2);
        for (const rho0 of [outOfWorldState(vecToRho(randomStateVec(rng, 2))), maximallyMixed(4)]) {
          let cur = rho0;
          for (let k = 0; k < 400; k++) cur = applyPerturbed(cur, nKraus, eps, GAMMA);
          worst = Math.max(worst, leakage(cur));
        }
      }
      assert.ok(worst <= perturbedLeakageBound(eps, GAMMA) + 1e-12, `eps=${eps}: ${worst} > bound`);
    }
  });

  it("h2 anchors: h2(1/2)=1 exact, h2(0.025) matches the depreciation ledger's W-E", () => {
    assert.ok(Math.abs(h2(0.5) - 1) <= 1e-15);
    assert.ok(Math.abs(h2(0.025) - 0.168660931) <= 1e-9);
    assert.ok(Math.abs(h2(0.1) - 0.4689955935892812) <= 1e-12);
  });

  it("the two-rate escape chain: closed form = recursion, union bound holds", () => {
    for (const r of [0.01, 0.05, 0.2, 0.5]) {
      for (const k of [1, 3, 10, 40, 150]) {
        const closed = twoRateInWorld(k, r, GAMMA);
        assert.ok(Math.abs(closed - twoRateRecursion(k, r, GAMMA)) <= 1e-13);
        assert.ok(1 - closed <= k * r + 1e-12, "union bound");
      }
    }
    // the law's own face: r = 0 gives escape exactly 0 at every horizon
    for (const k of [1, 10, 100]) assert.ok(Math.abs(twoRateInWorld(k, 0, GAMMA) - 1) <= 1e-15);
  });
});

describe("T3 smuggling trials — the board rejects contraband by name", () => {
  it("SW1: naked stability without dynamics is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as WritableBoardRow).dynamics = "miracle" as BoardRow["dynamics"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW1");
    assert.ok(hit, "expected an SW1 violation");
    assert.match(hit.detail, /marketing/);
  });

  it("SW2: an unwitnessed exactness is rejected as hearsay", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as WritableBoardRow).witness = "W-∞";
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW2");
    assert.ok(hit, "expected an SW2 violation");
    assert.match(hit.detail, /hearsay/);
  });

  it("SW2: an illegal tag is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as WritableBoardRow).exactness = "TRUST-ME" as BoardRow["exactness"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW2");
    assert.ok(hit, "expected an SW2 violation");
  });

  it("SW3: a quoted rate without its central bank is rejected", () => {
    const contraband = smuggle((rows) => {
      const at5 = rows.find((r) => r.id === "AT5") as WritableBoardRow;
      at5.anchors = ["vacuum-compiler", "depreciation-ledger"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW3");
    assert.ok(hit, "expected an SW3 violation");
    assert.match(hit.detail, /route-price/);
  });

  it("SW4: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[0] as WritableBoardRow).anchors = ["atlantis"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW4");
    assert.ok(hit, "expected an SW4 violation");
    assert.match(hit.detail, /atlantis/);
  });

  it("SW5: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      (rows[1] as WritableBoardRow).id = (rows[0] as BoardRow).id;
    });
    const hit = checkBoard(contraband).find((v) => v.law === "SW5");
    assert.ok(hit, "expected an SW5 violation");
  });
});

describe("T4 the renderer refuses to print an illegal board", () => {
  it("the smuggled board fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      const at5 = rows.find((r) => r.id === "AT5") as WritableBoardRow;
      at5.anchors = [];
    });
    const violations = checkBoard(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[SW3\]/);
  });

  it("the entry guard: importing the renderer writes no report", async () => {
    const probe = resolve(process.cwd(), "out", "reports", "guard-probe-should-not-exist.md");
    await import("../src/experiments/render.js");
    assert.ok(!existsSync(probe), "importing the renderer must not execute the render");
  });
});
