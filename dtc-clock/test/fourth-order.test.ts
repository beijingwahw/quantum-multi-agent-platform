import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  crossingQuotientResidue,
  fourthOrderClosed,
  fourthOrderClosedRational,
  fourthOrderFaces,
  fourthOrderIdentityResidue,
  fourthOrderQuotientGeneral,
  fourthOrderQuotientRational,
  fourthOrderSpecVariant,
  fullChainLinearityResidual,
} from "../src/kernel/fourth-order.js";
import { DtcError } from "../src/core/errors.js";
import {
  rationalResidue,
  secondOrderClosed,
  spectralArmor,
  thirdOrderClosed,
  type BigRational,
} from "../src/kernel/armor.js";

// The rational difference a - b as a cross-multiplied BigInt pair.
function ratDiff(a: BigRational, b: BigRational): BigRational {
  return { num: a.num * b.den - b.num * a.den, den: a.den * b.den };
}

function ratSum(a: BigRational, b: BigRational): BigRational {
  return { num: a.num * b.den + b.num * a.den, den: a.den * b.den };
}

const asFloat = (r: BigRational): number => Number(r.num) / Number(r.den);

describe("R21 — the fourth-order coefficient c_4 (the three repulsion faces beyond the quotient)", () => {
  it("FO1: the four-term series beats the three-term series at every n — exact rationals -1/16, -125/2048, 2765/393216 at n=4/6/8", () => {
    const p = 0.01;
    const ratios: number[] = [];
    for (const n of [4, 6, 8, 10, 12, 14, 16]) {
      const s3 =
        1 - 2 * p + secondOrderClosed(n) * p * p + thirdOrderClosed(n) * p ** 3;
      const s4 = s3 + fourthOrderClosed(n) * p ** 4;
      const lam = spectralArmor(n, p).lambda1;
      const r3 = Math.abs(lam - s3);
      const r4 = Math.abs(lam - s4);
      assert.ok(
        r4 < r3,
        `n=${n}: four-term must improve (r4=${r4.toExponential(3)} r3=${r3.toExponential(3)})`,
      );
      ratios.push(r3 / r4);
    }
    // the improvement factor is 5-80x on the grid (5.4 at n=8, 79.2 at n=4)
    assert.ok(
      Math.min(...ratios) >= 5,
      `worst improvement ${Math.min(...ratios).toFixed(1)}x`,
    );
    assert.ok(
      Math.max(...ratios) <= 100,
      `best improvement ${Math.max(...ratios).toFixed(1)}x`,
    );
    assert.equal(fourthOrderClosed(4), -0.0625); // -1/16
    assert.equal(fourthOrderClosed(6), -0.06103515625); // -125/2048
    assert.ok(Math.abs(fourthOrderClosed(8) - 2765 / 393216) <= 1e-15); // 2765/393216
    assert.ok(
      rationalResidue(fourthOrderClosedRational(4), { num: -1n, den: 16n }) ===
        0n,
    );
    assert.ok(
      rationalResidue(fourthOrderClosedRational(6), {
        num: -125n,
        den: 2048n,
      }) === 0n,
    );
    assert.ok(
      rationalResidue(fourthOrderClosedRational(8), {
        num: 2765n,
        den: 393216n,
      }) === 0n,
    );
  });

  it("FO1-boundary: the R18 spec's '>=100x residual drop on n=4..10' is REFUTED — it holds only at n=4", () => {
    const p = 0.01;
    const ratioAt = (n: number): number => {
      const s3 =
        1 - 2 * p + secondOrderClosed(n) * p * p + thirdOrderClosed(n) * p ** 3;
      const lam = spectralArmor(n, p).lambda1;
      return (
        Math.abs(lam - s3) /
        Math.abs(lam - (s3 + fourthOrderClosed(n) * p ** 4))
      );
    };
    assert.ok(
      ratioAt(4) >= 70,
      `n=4 keeps the >=100x-class drop (${ratioAt(4).toFixed(1)}x measured)`,
    );
    for (const n of [6, 8, 10]) {
      assert.ok(
        ratioAt(n) < 100,
        `n=${n}: the machine's own ratio is ${ratioAt(n).toFixed(1)}x — the spec's uniform 100x does not survive contact`,
      );
    }
  });

  it("FO2: Richardson on the exact eigenvalue agrees with the exact rational within ITS contamination (3-point, every n)", () => {
    for (const n of [4, 6, 8, 10, 12, 16]) {
      const c2 = secondOrderClosed(n);
      const c3 = thirdOrderClosed(n);
      const c4At = (q: number): number =>
        (spectralArmor(n, q).lambda1 - 1 + 2 * q - c2 * q * q - c3 * q ** 3) /
        q ** 4;
      const g = (q: number): number => 2 * c4At(q / 2) - c4At(q);
      const rich = (4 * g(0.01) - g(0.02)) / 3;
      assert.ok(
        Math.abs(rich - fourthOrderClosed(n)) <= 5e-3,
        `n=${n}: ${rich} vs ${fourthOrderClosed(n)}`,
      );
    }
  });

  it("FO3: the identity chain CONTINUES at fourth order — 8<u,Q4u> + (3n-2)<u,Q3u> + 2(n-2)<u,Q2u> = 0 for every even n=4..44", () => {
    for (let n = 4; n <= 44; n += 2) {
      assert.ok(fourthOrderIdentityResidue(n) === 0n, `n=${n}`);
    }
  });

  it("FO4: the chain's consequence — the quotient face inherits c_2's general-n law times (3n-8)(n-2)/24, BigInt-equal to n=40", () => {
    for (let n = 4; n <= 40; n += 2) {
      const q = fourthOrderQuotientRational(n);
      assert.ok(
        rationalResidue(q, fourthOrderQuotientGeneral(n)) === 0n,
        `n=${n}`,
      );
    }
    // the cheap quotient road IS the faces' own quotient on the TC38 grid
    for (const n of [4, 6, 8, 10, 12, 16]) {
      assert.ok(
        rationalResidue(
          fourthOrderQuotientRational(n),
          fourthOrderFaces(n).quotient,
        ) === 0n,
        `n=${n}`,
      );
    }
    assert.equal(asFloat(fourthOrderFaces(4).quotient), 0.5); // (3*4-8)(4-2)/24 * 3/2
  });

  it("FO5: the crossing road — T_k = -X_k in exact BigInt for k=2,3,4, on the full-chain linearity 2T+2X = 2^n n(1-2p) pinned at the float floor", () => {
    for (let n = 4; n <= 16; n += 2) {
      for (const k of [2, 3, 4] as const) {
        assert.ok(crossingQuotientResidue(n, k) === 0n, `n=${n} k=${k}`);
      }
    }
    for (const n of [24, 40]) {
      assert.ok(crossingQuotientResidue(n, 2) === 0n, `wide n=${n}`);
    }
    for (const n of [4, 8, 16]) {
      for (const p of [0.01, 0.1, 0.3]) {
        assert.ok(fullChainLinearityResidual(n, p) <= 1e-14, `n=${n} p=${p}`);
      }
    }
  });

  it("FO6 negative control: the spec-as-written three-face inventory (Q_3-coupling square, no double/no normalization) is CONVICTED by the eigenvalue", () => {
    const p = 0.01;
    for (const n of [4, 6, 8]) {
      const variant = fourthOrderSpecVariant(n);
      assert.notEqual(
        rationalResidue(variant, fourthOrderClosedRational(n)),
        0n,
        `n=${n}: the variant is not c_4`,
      );
    }
    for (const n of [4, 6]) {
      const s3 =
        1 - 2 * p + secondOrderClosed(n) * p * p + thirdOrderClosed(n) * p ** 3;
      const lam = spectralArmor(n, p).lambda1;
      const r3 = Math.abs(lam - s3);
      const rVariant = Math.abs(
        lam - (s3 + asFloat(fourthOrderSpecVariant(n)) * p ** 4),
      );
      assert.ok(
        rVariant > r3,
        `n=${n}: the spec variant's series (${rVariant.toExponential(2)}) is WORSE than omitting c_4 entirely (${r3.toExponential(2)})`,
      );
    }
    // the quotient-only value misses by exactly the three repulsion faces (BigInt)
    for (const n of [4, 6, 8]) {
      const f = fourthOrderFaces(n);
      assert.ok(
        rationalResidue(
          ratDiff(fourthOrderClosedRational(n), f.quotient),
          ratSum(ratSum(f.mixed, f.double), f.normalization),
        ) === 0n,
        `n=${n}`,
      );
      if (n >= 6) {
        assert.notEqual(
          f.double.num,
          0n,
          `n=${n}: the double face the spec omitted is content`,
        );
        assert.notEqual(
          f.normalization.num,
          0n,
          `n=${n}: the normalization face the spec omitted is content`,
        );
      }
    }
  });

  it("FO7: the domain guards refuse wrong objects (odd n, k out of range) by name", () => {
    for (const thunk of [
      () => fourthOrderFaces(5),
      () => fourthOrderIdentityResidue(7),
      () => fourthOrderQuotientGeneral(3),
      () => crossingQuotientResidue(4, 5),
      () => crossingQuotientResidue(6, 1),
    ]) {
      assert.throws(
        thunk,
        (e: unknown) => e instanceof DtcError && e.code === "E/DOMAIN",
      );
    }
  });
});
