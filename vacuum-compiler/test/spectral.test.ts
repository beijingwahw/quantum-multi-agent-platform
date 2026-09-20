import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cmatAdjoint,
  cmatMul,
  eigHermitian,
  VacuumError,
} from "../src/core/cmat.js";
import { assemble, buildDressing } from "../src/compile/hamiltonian.js";
import { program, randomCircuit } from "../src/compile/circuit.js";
import { Rng } from "../src/compile/rng.js";
import {
  auditGapTable,
  certifyTiltedSpectrum,
  isolateRoots,
  jacobiCharacteristicPoly,
  sturmCountRootsUpTo,
  tiltedChain,
  tiltedChainDiagonals,
  type SubmittedGapRow,
} from "../src/compile/spectral.js";

/** Convict by error code, never by message prose (the repo's law). */
function throwsCode(code: string): (err: unknown) => boolean {
  return (err: unknown): boolean =>
    err instanceof VacuumError && err.code === code;
}

const ratFloat = (r: { num: bigint; den: bigint }): number =>
  Number(r.num) / Number(r.den);
const q = (num: bigint, den: bigint): { num: bigint; den: bigint } => ({
  num,
  den,
});

describe("T8 the tilted spectrum: three-term recurrence + Sturm certificate (F16, v0.5.0)", () => {
  it("(SP-a) the fueled H(eps) is block-diagonal in the dressing basis: every data block is the tridiagonal chain, to 1e-12", () => {
    for (const T of [4, 6, 8]) {
      const circuit = randomCircuit(2, T, new Rng(400 + T));
      const prog = program(circuit, [0, 1], new Map());
      const comp = assemble(prog, { output: false, epsilon: 0.37 });
      const w = buildDressing(2, circuit.steps);
      const dressed = cmatMul(cmatMul(cmatAdjoint(w), comp.h), w);
      const C = T + 1;
      const diagV = tiltedChainDiagonals(T, q(37n, 100n), 0);
      const diagX = tiltedChainDiagonals(T, q(37n, 100n), 1);
      let dev = 0;
      for (let d = 0; d < 4; d++) {
        const diag = d === 0 ? diagV : diagX; // only |00> is input-valid
        for (let t = 0; t < C; t++) {
          dev = Math.max(
            dev,
            Math.abs(dressed.re[d * C + t]![d * C + t]! - ratFloat(diag[t]!)),
          );
          if (t > 0)
            dev = Math.max(
              dev,
              Math.abs(dressed.re[d * C + t]![d * C + t - 1]! + 0.5),
            );
          for (let d2 = 0; d2 < 4; d2++) {
            if (d2 !== d)
              dev = Math.max(
                dev,
                Math.abs(dressed.re[d * C + t]![d2 * C + t]!),
              );
          }
        }
      }
      assert.ok(
        dev < 1e-12,
        `T=${T}: max block deviation ${dev.toExponential(2)}`,
      );
    }
  });

  it("(SP-b) the recurrence's roots ARE the chain's float eigenvalues: T sweep, both chains, every root in its own bisection box", () => {
    let worst = 0;
    for (const T of [2, 6, 12]) {
      for (const penalty of [0, 1] as const) {
        const chain = tiltedChain(T, q(7n, 25n), penalty);
        assert.equal(
          chain.squareFreeGcdDeg,
          0,
          `T=${T} pen=${penalty}: spectrum must be simple (gcd(p,p')=const)`,
        );
        const vals = Array.from(eigHermitian(chain.floatMatrix).values).sort(
          (a, b) => a - b,
        );
        const boxes = isolateRoots(chain.poly, 40);
        assert.equal(boxes.length, vals.length);
        for (let j = 0; j < vals.length; j++) {
          const off = Math.abs(ratFloat(boxes[j]!) - (vals[j] as number));
          worst = Math.max(worst, off);
        }
      }
    }
    assert.ok(
      worst < 1e-9,
      `worst |box - float root| ${worst.toExponential(2)}`,
    );
  });

  it("(SP-d) eps=0 anchors, exact: p_V(0)=0 in BigInt, det(M_X)>0, no negative roots, E0=0 exactly", () => {
    const cert = certifyTiltedSpectrum({
      nQubits: 2,
      checkedQubits: [0, 1],
      T: 6,
      epsilon: q(0n, 1n),
    });
    assert.ok(
      cert.zeroTilt.validPolyAtZeroIsRoot,
      "the history-state zero-energy law as a polynomial root",
    );
    assert.ok(cert.zeroTilt.violatingDetPositive);
    assert.ok(
      cert.zeroTilt.noNegativeRoots,
      "PSD certified by Sturm, not by floats",
    );
    assert.equal(cert.e0.num, 0n, "E0 isolated to the exact rational 0");
    assert.equal(cert.multValid, 1);
    assert.equal(cert.multViolating, 3);
  });

  it("(SP-c) the eps=0 full gap at the census instance is the VIOLATING chain's ground — the T4 census's Delta, boxed", () => {
    const cert = certifyTiltedSpectrum({
      nQubits: 2,
      checkedQubits: [0, 1],
      T: 6,
      epsilon: q(0n, 1n),
    });
    // multValid = 1 => E1 = min(valid 2nd, violating 1st); the machine says
    // the violating chain wins: gap(0) ~ 0.025072 < 1 - cos(pi/7) ~ 0.099031
    const gapF = ratFloat(cert.gap);
    assert.ok(
      gapF < 1 - Math.cos(Math.PI / 7) - 1e-6,
      `gap(0) ${gapF} must be the X-chain ground`,
    );
    // cross the float leg: the assembled census instance's own gap
    const circuit = randomCircuit(2, 6, new Rng(601));
    const prog = program(circuit, [0, 1], new Map());
    const vals = eigHermitian(assemble(prog, { output: false }).h).values;
    assert.ok(
      Math.abs(gapF - ((vals[1] as number) - (vals[0] as number))) < 1e-8,
      `box ${gapF} vs float ${(vals[1] as number) - (vals[0] as number)}`,
    );
  });

  it("(T2 leg) the bare-chain gap law certified: gap(0) = 1 - cos(pi/(T+1)) at n=1 (multValid=2), T=2..12", () => {
    for (let T = 2; T <= 12; T++) {
      const cert = certifyTiltedSpectrum({
        nQubits: 1,
        checkedQubits: [],
        T,
        epsilon: q(0n, 1n),
      });
      const closed = 1 - Math.cos(Math.PI / (T + 1));
      assert.ok(
        Math.abs(ratFloat(cert.gap) - closed) < 1e-9,
        `T=${T}: ${ratFloat(cert.gap)} vs ${closed}`,
      );
    }
  });

  it("(SP-c) the sandwich -eps*T <= E0 <= 1/2 - eps*T is Sturm-certified at every rational grid point", () => {
    for (let j = 0; j <= 32; j += 4) {
      const cert = certifyTiltedSpectrum({
        nQubits: 2,
        checkedQubits: [0, 1],
        T: 6,
        epsilon: q(BigInt(j), 20n),
      });
      assert.ok(
        cert.sandwich.noRootBelowLower,
        `eps=${j}/20: no root strictly below the Loewner witness`,
      );
      assert.ok(
        cert.sandwich.rootAtOrBelowUpper,
        `eps=${j}/20: a root at or below the Rayleigh witness`,
      );
      assert.ok(ratFloat(cert.e0) <= ratFloat(cert.sandwich.upper) + 1e-12);
      assert.ok(ratFloat(cert.e0) >= ratFloat(cert.sandwich.lower) - 1e-12);
    }
  });

  it("(SP-c) E0 strictly decreasing and the T-end capture a_T - E0 strictly decreasing across the grid", () => {
    let prevE0 = Number.POSITIVE_INFINITY;
    let prevCap = Number.POSITIVE_INFINITY;
    for (let j = 0; j <= 16; j += 2) {
      const cert = certifyTiltedSpectrum({
        nQubits: 2,
        checkedQubits: [0, 1],
        T: 6,
        epsilon: q(BigInt(j), 10n),
      });
      const e0 = ratFloat(cert.e0);
      const aT = ratFloat(cert.valid.diagonals[6]!);
      assert.ok(
        e0 < prevE0 - 1e-9,
        `j=${j}: E0 must strictly decrease (${e0} vs ${prevE0})`,
      );
      assert.ok(
        aT - e0 < prevCap - 1e-9,
        `j=${j}: the T-end capture must tighten (${aT - e0} vs ${prevCap})`,
      );
      prevE0 = e0;
      prevCap = aT - e0;
    }
  });

  it("(SP-c) the certified gap box matches the assembled Hamiltonian's float gap, and the gap collapses at depth of tilt", () => {
    const circuit = randomCircuit(2, 6, new Rng(601));
    const prog = program(circuit, [0, 1], new Map());
    const cert = certifyTiltedSpectrum({
      nQubits: 2,
      checkedQubits: [0, 1],
      T: 6,
      epsilon: q(7n, 50n),
    });
    const vals = eigHermitian(
      assemble(prog, { output: false, epsilon: 7 / 50 }).h,
    ).values;
    const gapF = (vals[1] as number) - (vals[0] as number);
    assert.ok(
      Math.abs(ratFloat(cert.gap) - gapF) < 1e-8,
      `box ${ratFloat(cert.gap)} vs float ${gapF}`,
    );
    // the collapse: at eps = 8/5 the certified gap is under 1e-6 — both
    // chains' grounds have locked onto the same a_T well
    const big = certifyTiltedSpectrum({
      nQubits: 2,
      checkedQubits: [0, 1],
      T: 6,
      epsilon: q(8n, 5n),
    });
    assert.ok(
      ratFloat(big.gap) < 1e-6,
      `certified gap at eps=8/5: ${ratFloat(big.gap)}`,
    );
  });

  it("(SP-a) the chain multiset equals the assembled spectrum: dressing identity with multiplicities, 1e-12", () => {
    const T = 6;
    const circuit = randomCircuit(2, T, new Rng(601));
    const prog = program(circuit, [0, 1], new Map());
    const chainV = tiltedChain(T, q(7n, 50n), 0);
    const chainX = tiltedChain(T, q(7n, 50n), 1);
    const multiset = [
      ...Array.from(eigHermitian(chainV.floatMatrix).values),
      ...Array.from(eigHermitian(chainX.floatMatrix).values),
      ...Array.from(eigHermitian(chainX.floatMatrix).values),
      ...Array.from(eigHermitian(chainX.floatMatrix).values),
    ].sort((a, b) => a - b);
    const full = Array.from(
      eigHermitian(assemble(prog, { output: false, epsilon: 7 / 50 }).h).values,
    ).sort((a, b) => a - b);
    let dev = 0;
    for (let i = 0; i < full.length; i++)
      dev = Math.max(
        dev,
        Math.abs((multiset[i] as number) - (full[i] as number)),
      );
    assert.ok(dev < 1e-12, `worst ${dev.toExponential(2)}`);
  });

  it("SMUGGLING TRIAL: a counterfeit recurrence (coupling sign flipped) is convicted by the float double path", () => {
    // the forged recurrence uses +1/4 where the Jacobi determinant demands
    // -1/4 — a plausible-looking polynomial whose roots DRIFT away from the
    // chain's true float eigenvalues (the double path is the judge)
    const T = 4;
    const diag = tiltedChainDiagonals(T, q(7n, 25n), 0);
    type F = { num: bigint; den: bigint };
    const norm = (n: bigint, d: bigint): F => {
      let x = n < 0n ? -n : n;
      let y = d;
      while (y !== 0n) {
        const t = x % y;
        x = y;
        y = t;
      }
      const g = x === 0n ? 1n : x;
      return { num: n / g, den: d / g };
    };
    const fAdd = (a: F, b: F): F =>
      norm(a.num * b.den + b.num * a.den, a.den * b.den);
    const fMul = (a: F, b: F): F => norm(a.num * b.num, a.den * b.den);
    const z: F = { num: 0n, den: 1n };
    const pAdd = (a: readonly F[], b: readonly F[]): F[] => {
      const out: F[] = [];
      for (let i = 0; i < Math.max(a.length, b.length); i++)
        out.push(fAdd(a[i] ?? z, b[i] ?? z));
      while (out.length > 1 && out[out.length - 1]!.num === 0n) out.pop();
      return out;
    };
    const pMul = (a: readonly F[], b: readonly F[]): F[] => {
      const out: F[] = Array<F>(a.length + b.length - 1).fill(z);
      for (let i = 0; i < a.length; i++)
        for (let j = 0; j < b.length; j++)
          out[i + j] = fAdd(out[i + j]!, fMul(a[i]!, b[j]!));
      while (out.length > 1 && out[out.length - 1]!.num === 0n) out.pop();
      return out;
    };
    let dPrev: F[] = [{ num: 1n, den: 1n }];
    let dCur: F[] = pAdd(
      [z, { num: 1n, den: 1n }],
      [{ num: -diag[0]!.num, den: diag[0]!.den }],
    );
    for (let t = 1; t < diag.length; t++) {
      const lamMinusA = pAdd(
        [z, { num: 1n, den: 1n }],
        [{ num: -diag[t]!.num, den: diag[t]!.den }],
      );
      // the FORGE: +1/4 coupling
      const next = pAdd(
        pMul(lamMinusA, dCur),
        pMul(dPrev, [{ num: 1n, den: 4n }]),
      );
      dPrev = dCur;
      dCur = next;
    }
    const forged = dCur;
    const chain = tiltedChain(T, q(7n, 25n), 0);
    const forgedIsolated = isolateRoots(forged, 40);
    assert.equal(
      forgedIsolated.length,
      T + 1,
      "same degree — the forge is plausible",
    );
    const vals = Array.from(eigHermitian(chain.floatMatrix).values).sort(
      (a, b) => a - b,
    );
    let worst = 0;
    for (let j = 0; j < vals.length; j++) {
      worst = Math.max(
        worst,
        Math.abs(ratFloat(forgedIsolated[j]!) - (vals[j] as number)),
      );
    }
    assert.ok(
      worst > 1e-3,
      `the forged roots must drift from the true spectrum (worst ${worst})`,
    );
  });

  it("SMUGGLING TRIAL: the gap-table auditor names counterfeit gaps, root-count lies, sandwich violations, duplicates", () => {
    const input = { nQubits: 2, checkedQubits: [0, 1], T: 6 } as const;
    const honestRows: SubmittedGapRow[] = [];
    for (const eps of [q(0n, 1n), q(3n, 20n), q(7n, 50n)]) {
      const cert = certifyTiltedSpectrum({ ...input, epsilon: eps });
      // the honest root count is COMPUTED from the exact layer (the p(0)=0
      // root at eps=0 sits ON the endpoint — the up-to convention counts it)
      const belowZero =
        sturmCountRootsUpTo(cert.valid.poly, q(0n, 1n)) -
        (eps.num === 0n ? 1 : 0);
      honestRows.push({
        eps,
        claimedE0: ratFloat(cert.e0),
        claimedGap: ratFloat(cert.gap),
        claimedRootsBelowZero: belowZero,
      });
    }
    assert.deepEqual(auditGapTable(input, honestRows), []);
    const counterfeit = honestRows.map(
      (r) => (r.eps.num === 7n ? { ...r, claimedGap: 0.5 } : r), // the gap does not survive at 0.5
    );
    const v1 = auditGapTable(input, counterfeit);
    assert.ok(
      v1.some((x) => x.crime === "counterfeit gap"),
      JSON.stringify(v1),
    );
    const liar = honestRows.map((r) =>
      r.eps.num === 3n ? { ...r, claimedRootsBelowZero: 0 } : r,
    );
    const v2 = auditGapTable(input, liar);
    assert.ok(
      v2.some((x) => x.crime === "root-count lie"),
      JSON.stringify(v2),
    );
    const smuggler = honestRows.map((r) =>
      r.eps.num === 3n ? { ...r, claimedE0: 10 } : r,
    ); // above the Rayleigh witness
    const v3 = auditGapTable(input, smuggler);
    assert.ok(
      v3.some((x) => x.crime === "sandwich violated") &&
        v3.some((x) => x.crime === "counterfeit E0"),
      JSON.stringify(v3),
    );
    const v4 = auditGapTable(input, [...honestRows, honestRows[1]!]);
    assert.ok(
      v4.some((x) => x.crime === "duplicate row"),
      JSON.stringify(v4),
    );
  });

  it("entry guards: depth, rational, and qubit-bookkeeping rejections are named", () => {
    assert.throws(
      () => tiltedChainDiagonals(1, q(1n, 2n), 0),
      throwsCode("spectral/depth-out-of-domain"),
    );
    assert.throws(
      () => tiltedChainDiagonals(13, q(1n, 2n), 0),
      throwsCode("spectral/depth-out-of-domain"),
    );
    assert.throws(
      () => tiltedChainDiagonals(6, q(1n, 0n), 0),
      throwsCode("spectral/malformed-rational"),
    );
    assert.throws(
      () => tiltedChainDiagonals(6, q(1n, -2n), 0),
      throwsCode("spectral/malformed-rational"),
    );
    assert.throws(
      () => jacobiCharacteristicPoly([q(1n, 2n)]),
      throwsCode("spectral/depth-out-of-domain"),
    );
    assert.throws(
      () =>
        certifyTiltedSpectrum({
          nQubits: 2,
          checkedQubits: [5],
          T: 6,
          epsilon: q(1n, 2n),
        }),
      throwsCode("spectral/checked-qubit-out-of-range"),
    );
    assert.throws(
      () =>
        certifyTiltedSpectrum({
          nQubits: 2,
          checkedQubits: [0, 0],
          T: 6,
          epsilon: q(1n, 2n),
        }),
      throwsCode("spectral/checked-qubit-duplicate"),
    );
    assert.throws(
      () =>
        certifyTiltedSpectrum({
          nQubits: 0,
          checkedQubits: [],
          T: 6,
          epsilon: q(1n, 2n),
        }),
      throwsCode("spectral/qubits-out-of-domain"),
    );
  });
});
