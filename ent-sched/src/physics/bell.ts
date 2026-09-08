/**
 * Bell-diagonal algebra on two-qubit states.
 *
 * Label convention (index = z*2 + x on the Pauli frame relative to |Φ+⟩):
 *   0: Φ+  (no error)      1: Φ−  (Z / phase error)
 *   2: Ψ+  (X / bit  error) 3: Ψ−  (Z·X error)
 *
 * A pair carried by the simulator is exactly its Bell vector λ (length 4).
 * Werner states λ = (F, w, w, w), w = (1−F)/3, are closed under every
 * operation we model; the engine keeps full vectors so unequal-fidelity
 * purification stays exact.
 */

export type BellVec = Float64Array;

export function bellVec(p0: number, p1: number, p2: number, p3: number): BellVec {
  const v = new Float64Array(4);
  v[0] = p0;
  v[1] = p1;
  v[2] = p2;
  v[3] = p3;
  return v;
}

/**
 * Single source of the Werner error weight w = (1−F)/3 — the definition of
 * the Werner class. Every site that needs the weight (werner, the BBPSSW
 * recurrence, the referee's density matrix) imports THIS; a second literal
 * copy is how the class definition drifts.
 */
export function wernerWeight(F: number): number {
  return (1 - F) / 3;
}

/** Werner state with fidelity F = ⟨Φ+|ρ|Φ+⟩. */
export function werner(F: number): BellVec {
  const w = wernerWeight(F);
  return bellVec(F, w, w, w);
}

/** Fidelity F = λ₀ of a Bell vector (BellVec is length 4 by construction). */
export function fidelity(l: BellVec): number {
  return l[0]!;
}

export function cloneVec(l: BellVec): BellVec {
  const v = new Float64Array(4);
  v.set(l);
  return v;
}

/** Bell states as real 4-vectors in the computational basis (|00⟩,|01⟩,|10⟩,|11⟩). */
export const BELL_STATES: readonly Float64Array[] = [
  Float64Array.from([1, 0, 0, 1].map((x) => x / Math.SQRT2)), // Φ+
  Float64Array.from([1, 0, 0, -1].map((x) => x / Math.SQRT2)), // Φ−
  Float64Array.from([0, 1, 1, 0].map((x) => x / Math.SQRT2)), // Ψ+
  Float64Array.from([0, 1, -1, 0].map((x) => x / Math.SQRT2)), // Ψ−
];
