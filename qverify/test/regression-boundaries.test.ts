/**
 * Boundary-condition and merge-isomorphism regressions (post-v0.3.0 audit):
 *  - SMUGGLING: degenerate inputs that used to be swallowed (empty
 *    distributions, fractional qubit splits, zero sweep steps, rng.int(0))
 *    are now named refusals.
 *  - BIT-ISOMORPHISM: the single-sourcing merges of this wave (vKronAll →
 *    cmat.vKron, shadow rotations → gates.applyLocalVec, inline Kraus sums →
 *    channels.applyKraus, MC mean/stdErr → rng.meanStdErr) must reproduce
 *    the pre-merge bodies cell for cell.
 *  - ENTRY GUARD: runIfMain fires only on a direct hit of process.argv[1].
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { makeRng, meanStdErr } from '../src/core/rng.js';
import { sampleIndex, applyLocalVec, randomCircuit, circuitProbs } from '../src/core/gates.js';
import { vKron, type CMat, type CVec, mat, identity } from '../src/core/cmat.js';
import { vKronAll, fromVec, equatorial, KET0 } from '../src/core/states.js';
import { applyKraus } from '../src/core/channels.js';
import { marginals, cutSpoofDist, xebMC } from '../src/protocol/xeb.js';
import { windowSweep } from '../src/protocol/selftest.js';
import { fidelityShotValue, type PauliBasis } from '../src/protocol/shadows.js';
import { runIfMain } from '../src/experiments/report.js';

// ---------------- smuggling: degenerate inputs are named refusals ----------------

test('regression: sampleIndex refuses an empty distribution (was: index -1)', () => {
  const rng = makeRng(1);
  assert.throws(() => sampleIndex(new Float64Array(0), rng), /QV_EMPTY_INPUT: sampleIndex/);
  // the boundary stays legal: a one-entry distribution always yields 0
  assert.equal(sampleIndex(new Float64Array([1]), rng), 0);
});

test('regression: marginals/cutSpoofDist refuse non-power-of-two lengths and out-of-range nA', () => {
  const notPow2 = new Float64Array([0.25, 0.25, 0.25, 0.25, 0.25, 0.25]);
  assert.throws(() => marginals(notPow2, 1), /QV_SHAPE/);
  assert.throws(() => cutSpoofDist(notPow2, 1), /QV_SHAPE/);
  const p4 = new Float64Array(4).fill(0.25);
  assert.throws(() => marginals(p4, 1.5), /QV_SPLIT/);
  assert.throws(() => marginals(p4, -1), /QV_SPLIT/);
  assert.throws(() => marginals(p4, 3), /QV_SPLIT/); // only 2 qubits present
  // legal endpoints: nA = 0 and nA = log2(len)
  assert.equal(marginals(p4, 0).pa.length, 1);
  assert.equal(marginals(p4, 2).pb.length, 1);
});

test('regression: windowSweep refuses sub-unit step counts (was: 0/0 = NaN gaps)', () => {
  assert.throws(() => windowSweep(0), /QV_STEPS/);
  assert.throws(() => windowSweep(-3), /QV_STEPS/);
  assert.throws(() => windowSweep(2.5), /QV_STEPS/);
  // steps = 1 sweeps exactly the endpoints and stays finite
  const s = windowSweep(1);
  assert.ok(Number.isFinite(s.worstBetaGap) && Number.isFinite(s.worstFidelityGap));
});

test('regression: rng.int refuses maxExclusive < 1 (was: silently 0) and keeps endpoints', () => {
  const rng = makeRng(9);
  assert.throws(() => rng.int(0), /rng\.int/);
  assert.throws(() => rng.int(-2), /rng\.int/);
  assert.throws(() => rng.int(2.5), /rng\.int/);
  assert.equal(rng.int(1), 0); // the degenerate-but-legal bound
  for (let i = 0; i < 50; i++) {
    const k = rng.int(8);
    assert.ok(Number.isInteger(k) && k >= 0 && k < 8);
  }
});

test('regression: meanStdErr refuses an empty sample and matches the inline body', () => {
  assert.throws(() => meanStdErr([]), /meanStdErr/);
  const rng = makeRng(3);
  const vals = Array.from({ length: 97 }, () => rng());
  const { mean, stdErr } = meanStdErr(vals);
  const meanRef = vals.reduce((a, b) => a + b, 0) / vals.length;
  const varRef = vals.reduce((a, b) => a + (b - meanRef) ** 2, 0) / Math.max(1, vals.length - 1);
  assert.ok(Object.is(mean, meanRef) && Object.is(stdErr, Math.sqrt(varRef / vals.length)));
});

// ---------------- bit-isomorphism: this wave's single-sourcing merges ----------------

test('regression: vKronAll === the pre-merge inline pairwise tensor, bit for bit', () => {
  const rng = makeRng(0x15c0a1);
  const randomVec = (n: number): CVec => {
    const v: CVec = { n, re: new Float64Array(n), im: new Float64Array(n) };
    for (let k = 0; k < n; k++) {
      v.re[k] = Math.round((rng() * 2 - 1) * 8) / 8;
      v.im[k] = Math.round((rng() * 2 - 1) * 8) / 8;
    }
    return v;
  };
  for (let t = 0; t < 40; t++) {
    const vs = Array.from({ length: 1 + rng.int(4) }, () => randomVec(1 + rng.int(3)));
    const live = vKronAll(vs);
    // the pre-merge body: progressive inline tensor, same reduction order
    let ref = vs[0]!;
    for (const v of vs.slice(1)) ref = vKron(ref, v);
    assert.equal(live.n, ref.n);
    for (let k = 0; k < live.n; k++) {
      assert.ok(Object.is(live.re[k]!, ref.re[k]!), `re[${k}] ${live.re[k]} vs ${ref.re[k]} (t=${t})`);
      assert.ok(Object.is(live.im[k]!, ref.im[k]!), `im[${k}] ${live.im[k]} vs ${ref.im[k]} (t=${t})`);
    }
  }
});

test('regression: fidelityShotValue matches an independent left-to-right rotation chain', () => {
  // applyLocalVec replaced the private applyRotVec: recompute one per-shot
  // value with explicit sequential rotations in the opposite order (distinct
  // qubits commute, so the order flip is an independent referee)
  const n = 3;
  const target = vKronAll([equatorial(0), equatorial(Math.PI / 4), equatorial(Math.PI / 2)]);
  const assignment: PauliBasis[] = ['X', 'Y', 'Z'];
  const outcome = 0b101;
  const live = fidelityShotValue(target, n, assignment, outcome);
  // manual referee: rotate each qubit with the same basis rotations, then dot
  // with the ±-pattern diagonal
  const rot = (basis: PauliBasis): CMat => {
    if (basis === 'Z') return identity(2);
    if (basis === 'X') {
      const m = mat(2, 2);
      m.re[0] = 1 / Math.SQRT2;
      m.re[1] = 1 / Math.SQRT2;
      m.re[2] = 1 / Math.SQRT2;
      m.re[3] = -1 / Math.SQRT2;
      return m;
    }
    const m = mat(2, 2);
    const s = 1 / Math.SQRT2;
    m.re[0] = s;
    m.re[1] = s;
    m.im[2] = s;
    m.im[3] = -s;
    return m;
  };
  let psi = target;
  const dags = assignment.map((b) => dag2(rot(b)));
  for (let q = n - 1; q >= 0; q--) psi = applyLocalVec(psi, n, q, dags[q]!);
  const d = 1 << n;
  let ref = 0;
  for (let idx = 0; idx < d; idx++) {
    let factor = 1;
    for (let v = 0; v < n; v++) {
      const bit = (idx >> (n - 1 - v)) & 1;
      const want = (outcome >> (n - 1 - v)) & 1;
      factor *= bit === want ? 2 : -1;
    }
    ref += factor * (psi.re[idx]! * psi.re[idx]! + psi.im[idx]! * psi.im[idx]!);
  }
  assert.ok(Math.abs(live - ref) < 1e-12, `${live} vs ${ref}`);
});

test('regression: applyKraus is the exact Σ K ρ K† the MC referees inlined', () => {
  const rho = fromVec(KET0);
  const kraus: CMat[] = [identity(2), pauliXLiteral()];
  const live = applyKraus(rho, kraus);
  // reference: the pre-merge inline accumulation from cloner/attacks
  const out = mat(2, 2);
  for (const k of kraus) {
    const t = matMul(matMul(k, rho), mDaggerLocal(k));
    for (let i = 0; i < 4; i++) {
      out.re[i] = out.re[i]! + t.re[i]!;
      out.im[i] = out.im[i]! + t.im[i]!;
    }
  }
  for (let i = 0; i < 4; i++) {
    assert.ok(Object.is(live.re[i]!, out.re[i]!), `re[${i}] ${live.re[i]} vs ${out.re[i]}`);
    assert.ok(Object.is(live.im[i]!, out.im[i]!), `im[${i}] ${live.im[i]} vs ${out.im[i]}`);
  }
});

// local referee helpers (deliberately hand-written, independent of cmat.mMul)
function pauliXLiteral(): CMat {
  return { rows: 2, cols: 2, re: Float64Array.from([0, 1, 1, 0]), im: new Float64Array(4) };
}

/** Conjugate transpose of a 2×2 matrix (hand-written referee of mDagger). */
function dag2(m: CMat): CMat {
  const out = mat(2, 2);
  out.re[0] = m.re[0]!;
  out.im[0] = -m.im[0]!;
  out.re[3] = m.re[3]!;
  out.im[3] = -m.im[3]!;
  out.re[1] = m.re[2]!;
  out.im[1] = -m.im[2]!;
  out.re[2] = m.re[1]!;
  out.im[2] = -m.im[1]!;
  return out;
}

function mDaggerLocal(a: CMat): CMat {
  const out = mat(a.cols, a.rows);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      out.re[j * a.rows + i] = a.re[i * a.cols + j]!;
      out.im[j * a.rows + i] = -a.im[i * a.cols + j]!;
    }
  }
  return out;
}

function matMul(a: CMat, b: CMat): CMat {
  const out = mat(a.rows, b.cols);
  for (let i = 0; i < a.rows; i++) {
    for (let j = 0; j < a.cols; j++) {
      const ar = a.re[i * a.cols + j]!;
      const ai = a.im[i * a.cols + j]!;
      for (let k = 0; k < b.cols; k++) {
        out.re[i * b.cols + k] = out.re[i * b.cols + k]! + (ar * b.re[j * b.cols + k]! - ai * b.im[j * b.cols + k]!);
        out.im[i * b.cols + k] = out.im[i * b.cols + k]! + (ar * b.im[j * b.cols + k]! + ai * b.re[j * b.cols + k]!);
      }
    }
  }
  return out;
}

// ---------------- entry guard ----------------

test('regression: runIfMain fires only on an exact process.argv[1] hit', () => {
  let calls = 0;
  // any URL other than process.argv[1]'s (here: a manufactured one) must stay
  // silent — this is the imported-by-run-all case the entry-guard law protects
  runIfMain(pathToFileURL('/definitely/not/the/entry.ts').href, () => {
    calls++;
  });
  assert.equal(calls, 0);
  // an exact hit must invoke main exactly once (under node --test the test
  // file itself IS process.argv[1] of its runner process)
  runIfMain(pathToFileURL(process.argv[1] ?? '').href, () => {
    calls++;
  });
  assert.equal(calls, 1);
});

// ---------------- downstream sanity after the xeb guards ----------------

test('regression: xebMC still reproduces the exact depolarized identity', () => {
  const rng = makeRng(0x5a17);
  const probs = circuitProbs(randomCircuit(rng, 5, 5));
  const mc = xebMC(probs, probs, 20000, rng);
  let s = 0;
  for (const p of probs) s += p * p;
  const closed = probs.length * s - 1;
  assert.ok(Math.abs(mc.mean - closed) < 5 * mc.stdErr, `mean=${mc.mean} closed=${closed}`);
});
