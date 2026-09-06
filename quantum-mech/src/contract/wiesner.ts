/**
 * Wiesner quantum-money collateral (Wiesner 1983): escrow-private notes.
 * The escrow (bank) mints m-qubit notes with a secret basis+bit string; the
 * note itself is unclonable collateral — no-cloning bounds any forger who
 * must produce TWO notes that both pass the bank's verification.
 *
 * Bank model is PRIVATE-KEY (the escrow knows the secrets): exactly the
 * right trust shape for deposits and bonds. PUBLIC-key quantum money
 * (Aaronson-Christiano 2012 and successors) remains open — stated in the
 * honest-boundaries doc.
 */

import type { Rng } from '../core/rng.js';
import { type Qubit, applyGate, basisUnitary, type Basis } from '../protocol/locking.js';
import { mat } from '../core/cmat.js';

interface BankNote {
  qubits: Qubit[]; // what the holder possesses
  secretBases: Basis[];
  secretBits: number[];
}

function dagger2(u: ReturnType<typeof basisUnitary>): ReturnType<typeof basisUnitary> {
  const m = mat(2, 2);
  // u is a 2x2 matrix: indices 0..3 always defined
  m.re[0] = u.re[0]!;
  m.im[0] = -u.im[0]!;
  m.re[1] = u.re[2]!;
  m.im[1] = -u.im[2]!;
  m.re[2] = u.re[1]!;
  m.im[2] = -u.im[1]!;
  m.re[3] = u.re[3]!;
  m.im[3] = -u.im[3]!;
  return m;
}

function mint(rng: Rng, m: number, nBases: 2 | 3): BankNote {
  const secretBases: Basis[] = [];
  const secretBits: number[] = [];
  const qubits: Qubit[] = [];
  for (let q = 0; q < m; q++) {
    const basis = rng.int(nBases) as Basis;
    const bit = rng.int(2);
    secretBases.push(basis);
    secretBits.push(bit);
    const bitState: Qubit =
      bit === 0 ? { a: { re: 1, im: 0 }, b: { re: 0, im: 0 } } : { a: { re: 0, im: 0 }, b: { re: 1, im: 0 } };
    qubits.push(applyGate(bitState, basisUnitary(basis)));
  }
  return { qubits, secretBases, secretBits };
}

/** Bank verification: measure every qubit in the secret basis; the note
 * passes iff every outcome matches the secret bit. Honest note passes w.p. 1. */
function verify(note: BankNote, rng: Rng): boolean {
  for (let q = 0; q < note.qubits.length; q++) {
    const u = basisUnitary(note.secretBases[q]!);
    const rotated = applyGate(note.qubits[q]!, dagger2(u));
    const p0 = rotated.a.re ** 2 + rotated.a.im ** 2;
    const p1 = rotated.b.re ** 2 + rotated.b.im ** 2;
    const outcome = rng() * (p0 + p1) < p0 ? 0 : 1;
    if (outcome !== note.secretBits[q]) return false;
  }
  return true;
}

/** Naive forge: measure each qubit in a random basis, prepare TWO copies of
 * the observed eigenstate. Pass probability per note ≈ (3/4)^m for 2 bases
 * (½·1 + ½·½ per qubit); the no-cloning theorem (and the optimal 1→2
 * cloner, fidelity (1+1/√2)/2 ≈ 0.854 for BB84 states — cited, not
 * simulated here) bounds ALL forging strategies. */
function forgeTwoCopies(note: BankNote, rng: Rng, nBases: 2 | 3): [BankNote, BankNote] {
  const measured: Qubit[] = [];
  const secretGuessBits: number[] = [];
  for (const qubit of note.qubits) {
    const guess = rng.int(nBases) as Basis;
    const u = basisUnitary(guess);
    const rotated = applyGate(qubit, dagger2(u));
    const p0 = rotated.a.re ** 2 + rotated.a.im ** 2;
    const p1 = rotated.b.re ** 2 + rotated.b.im ** 2;
    const outcome = rng() * (p0 + p1) < p0 ? 0 : 1;
    const eigen: Qubit =
      outcome === 0 ? { a: { re: 1, im: 0 }, b: { re: 0, im: 0 } } : { a: { re: 0, im: 0 }, b: { re: 1, im: 0 } };
    measured.push(applyGate(eigen, u));
    secretGuessBits.push(outcome);
  }
  const clone = (qubits: Qubit[]): BankNote => ({
    qubits: qubits.map((x) => ({ a: { ...x.a }, b: { ...x.b } })),
    secretBases: [...note.secretBases],
    secretBits: [...note.secretBits],
  });
  return [clone(measured), clone(measured)];
}

export interface WiesnerStats {
  noteQubits: number;
  trials: number;
  honestPassRate: number;
  /** a single forged note passes */
  forgePassRate: number;
  analyticForgePassRate: number;
  /** both forged copies pass — measurement-cloning copies are perfectly
   * correlated, so this equals the single-note rate; no-cloning is what
   * bounds cleverer joint attacks below their naive-looking rates */
  forgeBothPassRate: number;
}

export function wiesnerExperiment(rng: Rng, noteQubits: number, trials: number, nBases: 2 | 3 = 2): WiesnerStats {
  let honest = 0;
  let both = 0;
  let single = 0;
  for (let t = 0; t < trials; t++) {
    const note = mint(rng, noteQubits, nBases);
    if (verify(note, rng)) honest++;
    const [c1, c2] = forgeTwoCopies(note, rng, nBases);
    const p1 = verify(c1, rng);
    const p2 = verify(c2, rng);
    if (p1 && p2) both++;
    if (p1) single++;
  }
  const perQubit = (1 + 1 / nBases) / 2; // P(the resent eigenstate passes)
  return {
    noteQubits,
    trials,
    honestPassRate: honest / trials,
    forgePassRate: single / trials,
    analyticForgePassRate: perQubit ** noteQubits,
    forgeBothPassRate: both / trials,
  };
}
