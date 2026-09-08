/**
 * T1 — switch algebra layer.
 *
 * A. Commutation task (Chiribella et al. 2013): decide whether two black-box
 *    involutions commute or anticommute. The switch solves it DETERMINISTICALLY
 *    with one use of each box: control reads |+⟩ iff commute, |−⟩ iff
 *    anticommute — exact, zero error.
 * B. Irreducibility judge: matched instances from the two promise classes where
 *    every fixed-order strategy (plain composition AND coherent control of
 *    gates) produces IDENTICAL output states (trace distance 0), while the
 *    switch separates them at trace distance 1.
 * C. Control-displacement witness: fixed orders leave the control untouched
 *    (Δ_c = 0 exactly); the replacer-pair switch displaces it by 1/2.
 * D. Dilation independence: same channel, three dilations (unitary env
 *    freedom, padding) — identical switched output to machine precision.
 */

import assert from 'node:assert/strict';
import { type CMat, identity, kron, mat, matEq, mDagger, mMul } from '../core/cmat.js';
import { partialTrace } from '../core/channels.js';
import { makeRng } from '../core/rng.js';
import { MINUS, PLUS, basisRho, randomStateVec, uniformOrthVec, vecToRho, PAULI_X, PAULI_Y, PAULI_Z } from '../core/states.js';
import { traceDistance } from '../core/measures.js';
import {
  envUnitaryFreedom,
  krausToStinespring,
  makeSwitchedChannel,
  padDilation,
} from '../switch/isometry.js';
import { replacerKraus, unitaryKraus } from '../switch/chanlib.js';
import { controlDisplacement, kronRho } from '../switch/witnesses.js';
import { writeReport } from './report.js';
import { pathToFileURL } from "node:url";

export function main(): void {
  const lines: string[] = [];

  // ---------- A. commutation task ----------
  lines.push('## A. Commutation task — switch readout is deterministic\n');
  lines.push('| pair | d | relation | control out | fidelity to |±⟩ |');
  lines.push('|---|---|---|---|---|');
  const commPairs: Array<{ name: string; u: CMat; v: CMat; d: number; relation: string; want: 'plus' | 'minus' }> = [
    { name: '(X, Z)', u: PAULI_X, v: PAULI_Z, d: 2, relation: 'XZ = −ZX', want: 'minus' },
    { name: '(Z, Y)', u: PAULI_Z, v: PAULI_Y, d: 2, relation: 'ZY = −YZ', want: 'minus' },
    { name: '(X⊗I, I⊗X)', u: kron(PAULI_X, identity(2)), v: kron(identity(2), PAULI_X), d: 4, relation: 'commute', want: 'plus' },
    { name: '(Z⊗I, I⊗Z)', u: kron(PAULI_Z, identity(2)), v: kron(identity(2), PAULI_Z), d: 4, relation: 'commute', want: 'plus' },
  ];
  for (const p of commPairs) {
    const sc = makeSwitchedChannel(krausToStinespring(unitaryKraus(p.u)), krausToStinespring(unitaryKraus(p.v)));
    const out = sc.channel(kronRho(vecToRho(PLUS), basisRho(p.d, 0)));
    const control = partialTrace(out, [2, p.d], [1]);
    const target = p.want === 'plus' ? vecToRho(PLUS) : vecToRho(MINUS);
    const fid = 1 - traceDistance(control, target);
    lines.push(`| ${p.name} | ${p.d} | ${p.relation} | ${p.want === 'plus' ? '|+⟩' : '|−⟩'} | ${fid.toFixed(12)} |`);
    assert.ok(matEq(control, target, 1e-12), `commutation readout failed for ${p.name}`);
  }
  // the two readout states are orthogonal — one shot decides the promise with certainty
  lines.push('\nSwitch: T(|+⟩⟨+|, |−⟩⟨−|) = 1 — **deterministic, one use of each box.**\n');

  // ---------- B. irreducibility judge ----------
  lines.push('## B. Irreducibility — each fixed-order class has a fooling instance pair; the switch has none\n');
  // B1. Plain fixed order (one use of each box, definite order, no ancilla).
  // Matched pair on d=4 with basis (Z-eigenstate) inputs:
  //   minus: A = X⊗I, B = Z⊗I   (anticommute, both involutions)
  //   plus:  A = X⊗I, B = I⊗Z   (commute, both involutions)
  // On every basis input the two orders' outputs coincide up to an invisible
  // global phase -> trace distance 0 between the output states.
  const xI = kron(PAULI_X, identity(2));
  const zI = kron(PAULI_Z, identity(2));
  const Iz = kron(identity(2), PAULI_Z);
  const d = 4;
  const basisInputs = [basisRho(d, 0), basisRho(d, 1), basisRho(d, 2), basisRho(d, 3)];
  let worstPlain = 0;
  for (const rho of basisInputs) {
    worstPlain = Math.max(
      worstPlain,
      traceDistance(vecOut(xI, zI, rho), vecOut(xI, Iz, rho)),
      traceDistance(vecOut(zI, xI, rho), vecOut(Iz, xI, rho)),
    );
  }
  lines.push(`- plain fixed order, fooling pair (X⊗I, Z⊗I) vs (X⊗I, I⊗Z), Z-eigenbasis inputs:`);
  lines.push(`  max cross-class trace distance = **${worstPlain.toExponential(2)}** — identical outputs, zero information.`);
  assert.ok(worstPlain < 1e-12);

  // B2. Coherent control of gates (each box still used once, fixed order,
  // applied iff control = 1). Global phase of the composed product becomes a
  // RELATIVE phase under control, so the B1 pair does not fool this class.
  // Its fooling pair: matrix-EQUAL composed products with different promise —
  // minus (X, Z) with Z·X, plus (XZ, I) with I·(XZ) = XZ = matrix-equal to ZX?
  // No: ZX = -XZ differs by -1. Instead use plus pair (ZX, I): product I·(ZX)
  // = ZX, matrix-EQUAL to minus product Z·X = ZX. I commutes with everything.
  const ZX = mMul(PAULI_Z, PAULI_X);
  const I2 = identity(2);
  let worstCoherent = 0;
  for (let bi = 0; bi < 4; bi++) {
    const rho = basisRho(2, bi);
    worstCoherent = Math.max(
      worstCoherent,
      traceDistance(coherentFixed(PAULI_X, PAULI_Z, rho), coherentFixed(ZX, I2, rho)),
    );
  }
  lines.push(`- coherent control of gates, fooling pair (X, Z) vs (ZX, I) (matrix-equal products):`);
  lines.push(`  max cross-class trace distance = **${worstCoherent.toExponential(2)}** — the control cannot see the difference.`);
  assert.ok(worstCoherent < 1e-12);

  // B3. The switch separates every pair above with certainty.
  const scMinus = makeSwitchedChannel(krausToStinespring(unitaryKraus(PAULI_X)), krausToStinespring(unitaryKraus(PAULI_Z)));
  const scPlusZX = makeSwitchedChannel(krausToStinespring(unitaryKraus(ZX)), krausToStinespring(unitaryKraus(I2)));
  const ctrlMinus = partialTrace(scMinus.channel(kronRho(vecToRho(PLUS), basisRho(2, 0))), [2, 2], [1]);
  const ctrlPlusZX = partialTrace(scPlusZX.channel(kronRho(vecToRho(PLUS), basisRho(2, 0))), [2, 2], [1]);
  const tSwitch = traceDistance(ctrlMinus, ctrlPlusZX);
  lines.push(`- switch readout on the SAME pairs: T(|−⟩⟨−|, |+⟩⟨+|) = **${tSwitch.toFixed(12)}** — deterministic.`);
  assert.ok(Math.abs(tSwitch - 1) < 1e-12);

  lines.push('');
  lines.push('A strategy must succeed on ALL instances. Each fixed-order class has an instance pair on');
  lines.push('which it outputs literally the same state in both promise classes; the switch separates');
  lines.push('both pairs with one use of each box. The full 4-vs-2 query bound over ancilla-assisted');
  lines.push('fixed-order circuits is the theorem of Chiribella et al. 2013 (cited, not re-proven here).\n');

  // ---------- C. control displacement witness ----------
  lines.push('## C. Control-displacement witness Δ_c = T(Tr_S ρ_out, ρ_c^in)\n');
  const ra = krausToStinespring(replacerKraus(2));
  const scRep = makeSwitchedChannel(ra, ra);
  const rhoIn = kronRho(vecToRho(PLUS), vecToRho(uniformOrthVec(2)));
  const dSw = controlDisplacement(scRep.channel(rhoIn), 2, vecToRho(PLUS));
  // fixed order with a spectator control: ρ_c ⊗ (Λ∘Λ)(ρ_s) — control untouched
  const fixedOut = kronRho(vecToRho(PLUS), scRep.fixedAB(vecToRho(uniformOrthVec(2))));
  const dFix = controlDisplacement(fixedOut, 2, vecToRho(PLUS));
  lines.push(`- replacer-pair switch, input |v⊥⟩: Δ_c = **${dSw.toFixed(12)}** (= 1/2 exactly)`);
  lines.push(`- definite-order use (spectator control): Δ_c = **${dFix.toExponential(2)}** (0 exactly)`);
  lines.push('- interpretation: information reached the control through the ORDER degree of freedom —');
  lines.push('  no fixed-order use can offer that channel. Full causal-nonseparability certification');
  lines.push('  lives in the process-matrix framework (OCB 2012; Goswami et al. 2018), cited.\n');
  assert.ok(Math.abs(dSw - 0.5) < 1e-12);
  assert.ok(dFix < 1e-12);

  // ---------- D. dilation independence ----------
  lines.push('## D. Dilation independence of the switched channel\n');
  const rng2 = makeRng(7);
  const psi = randomStateVec(rng2, 2);
  const rhoIn2 = kronRho(vecToRho(PLUS), vecToRho(psi));
  const rot = mat(2, 2);
  const th = 0.7;
  rot.re[0] = Math.cos(th); rot.im[0] = Math.sin(th);
  rot.re[3] = Math.cos(th); rot.im[3] = -Math.sin(th);
  const dilations = [
    { name: 'replacer Kraus (env 2)', st: ra },
    { name: 'env unitary freedom e^{iθσz}', st: envUnitaryFreedom(ra, rot) },
    { name: 'padded with fresh env qubit (env 4)', st: padDilation(ra, 2) },
  ];
  const first = dilations[0];
  if (first === undefined) throw new Error('exp1: dilation list came back empty');
  const base = makeSwitchedChannel(first.st, first.st).channel(rhoIn2);
  lines.push('| dilation | max |ρ_out − ρ_ref| |');
  lines.push('|---|---|');
  for (const dl of dilations) {
    const out = makeSwitchedChannel(dl.st, dl.st).channel(rhoIn2);
    let err = 0;
    for (let k = 0; k < out.re.length; k++) {
      err = Math.max(err, Math.abs(out.re[k]! - base.re[k]!), Math.abs(out.im[k]! - base.im[k]!));
    }
    lines.push(`| ${dl.name} | ${err.toExponential(2)} |`);
    assert.ok(err < 1e-12);
  }
  lines.push('\nThe supermap is well-defined on the CHANNEL, not the dilation — the executable form of');
  lines.push('the well-definedness statement in Chiribella et al. 2013.\n');

  writeReport('exp1-switch-algebra', lines.join('\n'));
}

/** (V∘U) ρ (V∘U)† */
function vecOut(u: CMat, v: CMat, rho: CMat): CMat {
  const w = mMul(v, u);
  return mMul(mMul(w, rho), mDagger(w));
}

/** Coherent control of gates in fixed order AB: (|0⟩⟨0|⊗I + |1⟩⟨1|⊗VU) on |+⟩⊗ρ. */
function coherentFixed(u: CMat, v: CMat, rho: CMat): CMat {
  const w = mMul(v, u);
  const n = u.rows;
  // block-diagonal projector form
  const G = mat(2 * n, 2 * n);
  for (let i = 0; i < n; i++) G.re[i * (2 * n) + i] = 1;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      G.re[(n + i) * (2 * n) + (n + j)] = w.re[i * n + j]!;
      G.im[(n + i) * (2 * n) + (n + j)] = w.im[i * n + j]!;
    }
  }
  const inRho = kronRho(vecToRho(PLUS), rho);
  return mMul(mMul(G, inRho), mDagger(G));
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
