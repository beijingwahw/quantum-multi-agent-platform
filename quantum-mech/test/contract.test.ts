import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/core/rng.js';
import { fromVec, randomPureState } from '../src/core/states.js';
import { partialTrace } from '../src/core/channels.js';
import { bellFidelity, ckw, ckwAnchors, doublePledgeFamilyScan, searchDoublePledge } from '../src/contract/monogamy.js';
import { wiesnerExperiment } from '../src/contract/wiesner.js';
import { naiveCommitAttack, steeringDemonstration } from '../src/contract/hjw.js';

test('CKW anchors: GHZ (0,1,1) and W (2/3, 2√2/3, 0)', () => {
  const a = ckwAnchors();
  assert.ok(Math.abs(a.ghz.cAB) < 1e-9);
  assert.ok(Math.abs(a.ghz.cABC - 1) < 1e-9);
  assert.ok(Math.abs(a.ghz.tangle - 1) < 1e-9);
  assert.ok(Math.abs(a.w.cAB - 2 / 3) < 1e-9);
  assert.ok(Math.abs(a.w.cABC - Math.sqrt(8) / 3) < 1e-9);
  assert.ok(Math.abs(a.w.tangle) < 1e-9);
});

test('CKW inequality never violated on random pure states', () => {
  const rng = makeRng(31);
  for (let t = 0; t < 300; t++) {
    const r = ckw(fromVec(randomPureState(8, rng)));
    assert.ok(
      r.cAB ** 2 + r.cAC ** 2 - r.cABC ** 2 <= 1e-9,
      `violation ${r.cAB ** 2 + r.cAC ** 2 - r.cABC ** 2}`,
    );
  }
});

// 2026-11-01 修复回归：2×2 Hermitian 行列式必须减 |ρ01|²（含 Im(ρ01)²），
//   旧代码漏掉 Im²，Im(ρ01)≠0 时 cABC/tangle 偏大。
// Regression (2026-11-01 fix): the 2×2 Hermitian determinant must subtract
//   |ρ01|² (INCLUDING Im(ρ01)²); the old code dropped Im², inflating
//   cABC/tangle for states with Im(ρ01) ≠ 0.
test('CKW determinant pins |rho01|² (Im part included) on a complex-amplitude state', () => {
  // ψ = (1/√2)|000⟩ + (i/2)|100⟩ + (1/2)|101⟩ — B factorizes (every term has
  // B=0), so this is a pure AC two-qubit state tensored with |0⟩_B.
  // Hand derivation:
  //   ρ_A = [[1/2, −i/(2√2)], [i/(2√2), 1/2]]  (Re(ρ01)=0, Im(ρ01)=−1/(2√2))
  //   det ρ_A = 1/2·1/2 − |ρ01|² = 1/4 − 1/8 = 1/8  ⟹  C_ABC = 2√(1/8) = 1/√2
  //   C_AB = 0 (B product);  C_AC = 2|ad−bc| = 2·(1/√2·1/2) = 1/√2
  //   tangle = C_ABC² − C_AB² − C_AC² = 1/2 − 0 − 1/2 = 0
  // The dropped-Im² bug gave det = 1/4 − Re² = 1/4 ⟹ C_ABC = 1, tangle = 1/2.
  const psi = {
    n: 8,
    re: Float64Array.of(Math.SQRT1_2, 0, 0, 0, 0, 0.5, 0, 0),
    im: Float64Array.of(0, 0, 0, 0, 0.5, 0, 0, 0),
  };
  const rhoA = partialTrace(fromVec(psi), [2, 2, 2], [1, 2]);
  // the discriminator premise: the off-diagonal is purely imaginary
  assert.ok(Math.abs(rhoA.re[1]!) < 1e-15 && Math.abs(rhoA.im[1]! + 1 / (2 * Math.SQRT2)) < 1e-15, `rho01 = ${rhoA.re[1]}${rhoA.im[1]}i`);
  const r = ckw(fromVec(psi));
  assert.ok(Math.abs(r.cAB) < 1e-12, `cAB ${r.cAB}`);
  assert.ok(Math.abs(r.cAC - Math.SQRT1_2) < 1e-12, `cAC ${r.cAC}`);
  assert.ok(Math.abs(r.cABC - Math.SQRT1_2) < 1e-12, `cABC ${r.cABC} (dropped-Im² bug gives 1)`);
  assert.ok(Math.abs(r.tangle) < 1e-12, `tangle ${r.tangle} (dropped-Im² bug gives 0.5)`);
});

test('double pledge caps at the CKW ceiling 1/sqrt(2)', () => {
  const fam = doublePledgeFamilyScan(200);
  assert.ok(Math.abs(fam.minC - Math.SQRT1_2) < 1e-9, `family minC ${fam.minC}`);
  assert.ok(Math.abs(fam.x - 0.5) < 0.01);
  const rng = makeRng(32);
  const rand = searchDoublePledge(rng, 3000);
  assert.ok(rand.bestMin <= Math.SQRT1_2 + 1e-9);
  assert.ok(rand.bestMin > 0.5, 'random search should approach the ceiling');
});

test('Bell fidelity sum bound: F1 + F2 <= 1 across the double-pledge family', () => {
  for (const x of [0.15, 0.3, 0.5, 0.7, 0.85]) {
    const psi = {
      n: 8,
      re: Float64Array.of(0, Math.sqrt((1 - x) / 2), Math.sqrt((1 - x) / 2), 0, Math.sqrt(x), 0, 0, 0),
      im: new Float64Array(8),
    };
    const rho = fromVec(psi);
    const f1 = bellFidelity(partialTrace(rho, [2, 2, 2], [2]));
    const f2 = bellFidelity(partialTrace(rho, [2, 2, 2], [1]));
    assert.ok(f1 + f2 <= 1 + 1e-9, `x=${x}: ${f1 + f2}`);
  }
});

test('Wiesner collateral: honest passes, naive forge matches (3/4)^m', () => {
  const rng = makeRng(33);
  const stats = wiesnerExperiment(rng, 6, 3000);
  assert.ok(Math.abs(stats.honestPassRate - 1) < 1e-9);
  const sigma = Math.sqrt((0.75 ** 6 * (1 - 0.75 ** 6)) / 3000);
  assert.ok(
    Math.abs(stats.forgePassRate - 0.75 ** 6) < 4 * sigma + 1e-9,
    `forge ${stats.forgePassRate} vs ${0.75 ** 6}`,
  );
});

test('HJW steering: same I/2, three decompositions, each member prob 1/2 fidelity 1', () => {
  const st = steeringDemonstration();
  assert.ok(st.hidingTraceDistance < 1e-12);
  assert.equal(st.rows.length, 3);
  for (const row of st.rows) {
    assert.ok(Math.abs(row.probs[0] - 0.5) < 1e-12);
    assert.ok(Math.abs(row.probs[1] - 0.5) < 1e-12);
    assert.ok(Math.abs(row.fidelities[0] - 1) < 1e-9, `${row.basis} fid0 ${row.fidelities[0]}`);
    assert.ok(Math.abs(row.fidelities[1] - 1) < 1e-9, `${row.basis} fid1 ${row.fidelities[1]}`);
  }
});

test('naive commit attack: concealed cheater passes each reveal at 1/2; classical cheat 0.8536', () => {
  const atk = naiveCommitAttack();
  assert.ok(Math.abs(atk.concealed) < 1e-12);
  assert.ok(Math.abs(atk.eprPass[0] - 0.5) < 1e-12);
  assert.ok(Math.abs(atk.eprPass[1] - 0.5) < 1e-12);
  assert.ok(Math.abs(atk.equiangularPassRate - (1 + Math.SQRT1_2) / 2) < 1e-12);
  assert.ok(Math.abs(atk.conditionalFidelity[0] - 1) < 1e-9);
});
