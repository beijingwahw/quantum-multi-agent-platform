/**
 * The composition layer — choose composed with choose.
 *
 * Two faces, one question each:
 *
 * SEQUENTIAL composition (P ++ Q): run P's steps, then Q's, on one register.
 *   The laws probed here, all machine-measured against the flat semantics:
 *     S1  pattern weights are a PRODUCT MEASURE — w(P++Q | q,p) = w(P|p)·w(Q|q)
 *         exactly, independent of the data state (the control diagonals are
 *         untouchable, so the certification toll composes multiplicatively);
 *     S2  conditioning composes — chaining (condition P, then run-and-condition
 *         Q on the conditional) equals conditioning the composed run, to the
 *         rounding floor: the denotation is a homomorphism on the nose;
 *     S3  the denotation products associate — den(Q)·den(P) vs parenthesized
 *         products vs the direct branch product of the flat program agree to
 *         the rounding floor (floating point is not associative; the LAW is).
 *
 * NESTED composition — choose(choose(A,B),C) and choose(A, choose(B,C)):
 *   a TERM tree, leaf(u) | node(theta, t0, t1). Every choose node allocates a
 *   fresh control slot in PREORDER; a slot not reached on a path is DEAD
 *   (prepared |0>, acted on by identity, unentangled — the same default-
 *   evolution move Barsse-Pechoux-Perdrix use for unreached subprograms).
 *   Register width is the node count; dead slots are marginalized when
 *   conditioning on a live path.
 *     N1  CONTEXT-FREEDOM — conditioning a tree on a live path yields exactly
 *         the path's leaf unitary acting on data, weighted by the product of
 *         the path's branch weights: the subtree's standalone numbers survive
 *         in every context (compositionality of the denotation);
 *     N2  NON-INTERCHANGEABILITY (the honest negative) — choose(choose(A,B),C)
 *         and choose(A,choose(B,C)) DENOTE the same products on their common
 *         leaves but PRICE them differently (w_left(A) = cos²θ1·cos²θ2 vs
 *         w_right(A) = cos²θ1): associativity lives in the denotation, never
 *         in the syntax. Exact identity AND exact counterexample, machine-read.
 */
import { type CMat, mat, mDagger, mMul } from "../core/cmat.js";
import { ChoiceLangError } from "../core/errors.js";
import { conditionOnPattern, type Program } from "./lang.js";

/** Sequential composition P ++ Q: Q's steps run after P's, on one register. */
export function concatProgram(p: Program, q: Program): Program {
  return [...p, ...q];
}

/**
 * The composed pattern weight in REGISTER order. The register is NEWEST-first
 * (each step prepends its control), so a pattern named in STEP order must be
 * reversed per program part; P++Q's register reads (Q's controls, P's
 * controls, data).
 */
export function registerPattern(stepBits: ReadonlyArray<0 | 1>): Array<0 | 1> {
  return [...stepBits].reverse();
}

// ---------------------------------------------------------------------------
// terms: choose nested inside choose
// ---------------------------------------------------------------------------

export type Term =
  | { readonly kind: "leaf"; readonly u: CMat }
  | { readonly kind: "node"; readonly theta: number; readonly t0: Term; readonly t1: Term };

export function leaf(u: CMat): Term {
  return { kind: "leaf", u };
}

export function node(theta: number, t0: Term, t1: Term): Term {
  return { kind: "node", theta, t0, t1 };
}

/** The number of choose nodes — the tree's control-slot width (preorder). */
export function termWidth(t: Term): number {
  if (t.kind === "leaf") return 0;
  return 1 + termWidth(t.t0) + termWidth(t.t1);
}

/**
 * The execution isometry of a term, data (d) -> (slots..., data) with slots in
 * preorder. A leaf is its own unitary. A node prepares its fresh control
 * coherently over both sectors, each sector padded with the sibling subtree's
 * DEAD slots (|0...0>, never acted on):
 *
 *   V_node = cos·|0> ⊗ [V_t0 ⊗ |0..0>_{t1}] + sin·|1> ⊗ [|0..0>_{t0} ⊗ V_t1]
 *
 * so V†V = I_d exactly (orthogonal sectors, isometric branches, dead slots
 * orthonormal): the tree's whole evolution is ONE isometry, never an assembly
 * of per-step Kronecker factors.
 */
export function termIsometry(t: Term, d: number): CMat {
  if (t.kind === "leaf") {
    if (t.u.rows !== d || t.u.cols !== d) {
      throw new ChoiceLangError(
        "LEAF_SHAPE",
        `termIsometry: a leaf must be ${d}x${d} to act on ${d}-dim data, got ${t.u.rows}x${t.u.cols} — a wrong-dimension leaf is not an isometry of the data register`,
      );
    }
    return t.u;
  }
  const w0 = termWidth(t.t0);
  const w1 = termWidth(t.t1);
  const v0 = termIsometry(t.t0, d);
  const v1 = termIsometry(t.t1, d);
  const out = mat(2 ** (1 + w0 + w1) * d, d);
  const c = Math.cos(t.theta);
  const s = Math.sin(t.theta);
  for (let col = 0; col < d; col++) {
    // branch-0 sector: root=0, t0's slots live, t1's slots dead (x1=0)
    for (let r = 0; r < v0.rows; r++) {
      const dd = r % d;
      const x0 = (r - dd) / d;
      const row = x0 * (2 ** w1 * d) + dd;
      out.re[row * d + col] = out.re[row * d + col]! + c * v0.re[r * d + col]!;
      out.im[row * d + col] = out.im[row * d + col]! + c * v0.im[r * d + col]!;
    }
    // branch-1 sector: root=1, t0's slots dead (x0=0), t1's slots live
    for (let r = 0; r < v1.rows; r++) {
      const dd = r % d;
      const x1 = (r - dd) / d;
      const row = 2 ** (w0 + w1) * d + x1 * d + dd;
      out.re[row * d + col] = out.re[row * d + col]! + s * v1.re[r * d + col]!;
      out.im[row * d + col] = out.im[row * d + col]! + s * v1.im[r * d + col]!;
    }
  }
  return out;
}

/** Run a term on a data density matrix: V rho V-dagger. */
export function runTerm(t: Term, rho: CMat): CMat {
  const v = termIsometry(t, rho.rows);
  return mMul(mMul(v, rho), mDagger(v));
}

export interface TermPath {
  /** branch bits of the choose nodes on the path, ROOT-FIRST */
  readonly bits: ReadonlyArray<0 | 1>;
  /** the leaf unitary the path compiles to */
  readonly leafUnitary: CMat;
  /** the path's certification weight: product of its branch weights */
  readonly weight: number;
}

/** Every live path (root-to-leaf) of a term, with its leaf and its weight. */
export function termPaths(t: Term): TermPath[] {
  if (t.kind === "leaf") return [{ bits: [], leafUnitary: t.u, weight: 1 }];
  const w0 = Math.cos(t.theta) ** 2;
  const w1 = Math.sin(t.theta) ** 2;
  return [
    ...termPaths(t.t0).map((p) => ({ bits: [0 as const, ...p.bits], leafUnitary: p.leafUnitary, weight: w0 * p.weight })),
    ...termPaths(t.t1).map((p) => ({ bits: [1 as const, ...p.bits], leafUnitary: p.leafUnitary, weight: w1 * p.weight })),
  ];
}

/**
 * The full slot pattern (preorder) realizing one live path: nodes ON the path
 * carry their branch bit; unreached (dead) slots carry 0. Conditioning on this
 * pattern marginalizes the dead slots — they were never entangled.
 */
export function pathSlotPattern(t: Term, bits: ReadonlyArray<0 | 1>): Array<0 | 1> {
  if (t.kind === "leaf") {
    if (bits.length > 0) throw new ChoiceLangError("PATH_OVERRUN", "pathSlotPattern: path longer than tree");
    return [];
  }
  const b = bits[0];
  if (b === undefined) throw new ChoiceLangError("PATH_SHORT", "pathSlotPattern: path ended at a choose node");
  const rest = bits.slice(1);
  const sub = b === 0 ? t.t0 : t.t1;
  const otherWidth = termWidth(b === 0 ? t.t1 : t.t0);
  return [b, ...pathSlotPattern(sub, rest), ...Array<0>(otherWidth).fill(0)];
}

/**
 * Condition a term's final state on one live path: the path's weight and the
 * conditional data state (dead slots marginalized away by the pattern).
 */
export function conditionTermOnPath(
  t: Term,
  rho: CMat,
  bits: ReadonlyArray<0 | 1>,
): { p: number; conditional: CMat } {
  return conditionOnPattern(runTerm(t, rho), termWidth(t), pathSlotPattern(t, bits), rho.rows);
}
