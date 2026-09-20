/**
 * F17 (v0.4.0) — the sigma_E edge-block operator identity.
 *
 * The walk-price census (T4, v0.2.0) measured that a clock-0 start has energy
 * spread sigma_E exactly 1/2 under prop+in, whatever the depth and circuit —
 * "walk bandwidth constancy", law 5 of the README. This file upgrades that
 * census to an OPERATOR identity family, per T, with the structure exposed:
 *
 *   P_0 = I_data ⊗ |0><0|_clock (the clock-0 sector projector). For EVERY
 *   circuit and EVERY T >= 2:
 *
 *     (a)  P_0 H_prop P_0  = 1/2 · P_0          — bit-exact: the t=1 summand
 *          writes exactly 0.5 on the clock-0 diagonal and NOTHING else ever
 *          touches that sector's rows/columns;
 *     (b)  P_0 H_prop^2 P_0 = 1/2 · P_0         — the two 1/4's: the squared
 *          diagonal block plus the norm of the SOLE edge coupling
 *          P_0 H P_1 = -1/2 U_1† ⊗ |0><1|, whose square is 1/4 · U_1† U_1
 *          = 1/4 · I by unitarity of the FIRST gate — the identity's content
 *          is precisely that the clock-0 sector sees H as the CONSTANT 1/2
 *          (no data dependence at all) and leaks into exactly one neighbor;
 *     (c)  P_j H_prop P_0 = 0 EXACTLY for every clock sector j >= 2 — the
 *          clock-0 state touches ONE edge of the chain (the 2x2 block
 *          {0,1}), never the interior.
 *
 *   Corollary (the census upgraded): every unit vector supported in the
 *   clock-0 sector has <H> = <H^2> = 1/2 EXACTLY, hence sigma_E = 1/2 —
 *   independent of depth, circuit, and data superposition. With the input
 *   check on, the same holds on the input-VALID subspace (H_in vanishes
 *   there); on the full clock-0 sector sigma_E^2 = 1/4 + p(1-p) with p the
 *   violation mass (>= 1/4, equality iff one violation class — the walk's
 *   bandwidth is MINIMAL exactly on the valid sector). The output check acts
 *   at clock T and the fuel tilt is clock-diagonal with value -eps·0 = 0 at
 *   clock 0: both assembled forms leave every P_0 block untouched, verified
 *   by the tests as machine remarks.
 *
 *   The far end P_T is the same edge mirrored (the t=T summand alone touches
 *   it): the identity family holds at BOTH ends, while interior sectors
 *   carry P_t H P_t = P_t and P_t H^2 P_t = 3/2 P_t (TWO edges) — bandwidth
 *   1/sqrt(2), the constant the walk's middle never improves on either.
 *
 *   The counterfeit (negative control): closing the clock into a CYCLE
 *   (adding -1/2 (I⊗|0><T| + h.c.)) leaves (a) intact but breaks (b) by
 *   EXACTLY 1/4 (P_0 H^2 P_0 = 3/4 P_0, sigma_E = sqrt(1/2)) — the identity
 *   family convicts a double edge by name and by number.
 *
 * Boundary: prop+in form (input term lifted on invalid data states — the
 * identity survives on the valid sector); the walk's sigma_E CONSERVATION
 * under time evolution is the T4 spectral-flow census face, not re-proved
 * here — this file is the t=0 operator root. Mandelstam–Tamm stays the cited
 * anchor for the floor pi/(2 sigma_E) = pi (ledger.ts).
 */
import {
  type CMat,
  type CVec,
  cmatMul,
  cmatZero,
  requireWellFormed,
  requireWellFormedVec,
  VacuumError,
} from "../core/cmat.js";
import { buildPropagation } from "./hamiltonian.js";

/** The (rowSector, colSector) clock block of h: a (h.dim/C)-square matrix.
 * Domain: a genuine clock tensor structure (dim divisible, sectors in range). */
export function clockSectorBlock(
  h: CMat,
  clockStates: number,
  rowSector: number,
  colSector: number,
): CMat {
  requireWellFormed(h, "clockSectorBlock");
  if (!Number.isInteger(clockStates) || clockStates < 2) {
    throw new VacuumError(
      "edge/clock-states-out-of-domain",
      `clockSectorBlock: clockStates ${clockStates} (a clock chain needs >= 2 vertices)`,
    );
  }
  if (h.dim % clockStates !== 0) {
    throw new VacuumError(
      "edge/clock-not-divisor",
      `clockSectorBlock: Hamiltonian dim ${h.dim} is not a multiple of clockStates ${clockStates}`,
    );
  }
  if (
    !Number.isInteger(rowSector) ||
    rowSector < 0 ||
    rowSector >= clockStates ||
    !Number.isInteger(colSector) ||
    colSector < 0 ||
    colSector >= clockStates
  ) {
    throw new VacuumError(
      "edge/sector-out-of-range",
      `clockSectorBlock: sectors (${rowSector}, ${colSector}) outside [0, ${clockStates - 1}]`,
    );
  }
  const d = h.dim / clockStates;
  const b = cmatZero(d);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      b.re[i]![j] = h.re[i * clockStates + rowSector]![
        j * clockStates + colSector
      ] as number;
      b.im[i]![j] = h.im[i * clockStates + rowSector]![
        j * clockStates + colSector
      ] as number;
    }
  }
  return b;
}

function maxAbs(m: CMat): number {
  let v = 0;
  for (let i = 0; i < m.dim; i++) {
    for (let j = 0; j < m.dim; j++) {
      v = Math.max(
        v,
        Math.abs(m.re[i]![j] as number),
        Math.abs(m.im[i]![j] as number),
      );
    }
  }
  return v;
}

/** The scalar a block "is" when it is a·I (its mean diagonal); constancy is
 * audited separately — this is the honest reading, not an assumption. */
function blockScalar(m: CMat): number {
  let s = 0;
  for (let i = 0; i < m.dim; i++) s += m.re[i]![i] as number;
  return s / m.dim;
}

export interface EdgeIdentity {
  readonly clockStates: number;
  /** ||P_0 H P_0 - 1/2 P_0|| — zero BIT-EXACTLY for H_prop */
  readonly diagonalDev: number;
  /** ||P_0 H^2 P_0 - 1/2 P_0|| — float-rounding level (products of gate entries) */
  readonly secondMomentDev: number;
  /** max_{j >= 2} ||P_j H P_0|| — exactly zero: one edge touched */
  readonly farBlockDev: number;
  /** ||P_1 H P_0 - (-1/2 U_1)||, bit-exact against the first step's own matrix */
  readonly edgeBlockDev: number;
  /** ||P_0 H P_1 - (-1/2 U_1^dag)||, bit-exact */
  readonly edgeBlockAdjointDev: number;
}

/** The per-T identity certificate of the clock-0 sector: every deviation is
 * recomputed from the assembled matrix, nothing is assumed. `firstStep` is
 * the circuit's own first gate matrix (for the 2x2 edge-block form checks). */
export function edgeIdentity(
  h: CMat,
  clockStates: number,
  firstStep?: { matrix: CMat },
): EdgeIdentity {
  requireWellFormed(h, "edgeIdentity");
  if (!Number.isInteger(clockStates) || clockStates < 3) {
    // T >= 2: the identity itself survives at C = 2, but the THEOREM family
    // (an interior to be disjoint from the edge) starts at three vertices
    throw new VacuumError(
      "edge/clock-states-out-of-domain",
      `edgeIdentity: clockStates ${clockStates}, expected >= 3 (the T >= 2 sweep — a chain short enough to be all edge is not the theorem's face)`,
    );
  }
  const d = h.dim / clockStates;
  const diag = clockSectorBlock(h, clockStates, 0, 0);
  const h2 = cmatMul(h, h);
  const second = clockSectorBlock(h2, clockStates, 0, 0);
  const half = cmatZero(d);
  for (let i = 0; i < d; i++) half.re[i]![i] = 0.5;
  let far = 0;
  for (let j = 2; j < clockStates; j++)
    far = Math.max(far, maxAbs(clockSectorBlock(h, clockStates, j, 0)));
  let edgeDev = 0;
  let edgeAdjDev = 0;
  if (firstStep !== undefined) {
    requireWellFormed(firstStep.matrix, "edgeIdentity firstStep");
    if (firstStep.matrix.dim !== d) {
      throw new VacuumError(
        "edge/step-dim-mismatch",
        `edgeIdentity: first step dim ${firstStep.matrix.dim}, expected ${d}`,
      );
    }
    const u = firstStep.matrix;
    const handU = cmatZero(d);
    const handUdag = cmatZero(d);
    for (let i = 0; i < d; i++) {
      for (let j = 0; j < d; j++) {
        handU.re[i]![j] = -0.5 * (u.re[i]![j] as number);
        handU.im[i]![j] = -0.5 * (u.im[i]![j] as number);
        handUdag.re[i]![j] = -0.5 * (u.re[j]![i] as number);
        handUdag.im[i]![j] = 0.5 * (u.im[j]![i] as number);
      }
    }
    edgeDev = diffBlock(h, clockStates, 1, 0, handU);
    edgeAdjDev = diffBlock(h, clockStates, 0, 1, handUdag);
  }
  return {
    clockStates,
    diagonalDev: blockDiff(diag, half),
    secondMomentDev: blockDiff(second, half),
    farBlockDev: far,
    edgeBlockDev: edgeDev,
    edgeBlockAdjointDev: edgeAdjDev,
  };
}

function diffBlock(
  h: CMat,
  clockStates: number,
  rowSector: number,
  colSector: number,
  against: CMat,
): number {
  const b = clockSectorBlock(h, clockStates, rowSector, colSector);
  let v = 0;
  for (let i = 0; i < against.dim; i++) {
    for (let j = 0; j < against.dim; j++) {
      v = Math.max(
        v,
        Math.abs((b.re[i]![j] as number) - (against.re[i]![j] as number)),
        Math.abs((b.im[i]![j] as number) - (against.im[i]![j] as number)),
      );
    }
  }
  return v;
}

function blockDiff(b: CMat, half: CMat): number {
  let v = 0;
  for (let i = 0; i < b.dim; i++) {
    for (let j = 0; j < b.dim; j++) {
      v = Math.max(
        v,
        Math.abs((b.re[i]![j] as number) - (half.re[i]![j] as number)),
        Math.abs((b.im[i]![j] as number) - (half.im[i]![j] as number)),
      );
    }
  }
  return v;
}

/** The cycle-closed counterfeit: H_prop plus the closure -1/2(I⊗|0><T| +
 * I⊗|T><0|) — a clock that touches its own far edge. This is NOT a
 * propagation Hamiltonian of any circuit; it exists to be convicted. */
export function cycleClosedPropagation(
  nQubits: number,
  steps: ReadonlyArray<{ matrix: CMat }>,
): CMat {
  if (steps.length < 2) {
    throw new VacuumError(
      "edge/cycle-needs-interior",
      `cycleClosedPropagation: ${steps.length} steps — a cycle counterfeit needs T >= 2 (an interior sector to be distinct from both edges)`,
    );
  }
  const h = buildPropagation(nQubits, steps);
  const c = steps.length + 1;
  const d = h.dim / c;
  for (let i = 0; i < d; i++) {
    h.re[i * c]![i * c + steps.length] =
      (h.re[i * c]![i * c + steps.length] as number) - 0.5;
    h.re[i * c + steps.length]![i * c] =
      (h.re[i * c + steps.length]![i * c] as number) - 0.5;
  }
  return h;
}

/** Embed a data-space vector into clock sector t (the corollary's inputs). */
export function clockSectorEmbed(
  data: CVec,
  clockStates: number,
  sector: number,
): CVec {
  requireWellFormedVec(data, "clockSectorEmbed");
  if (!Number.isInteger(clockStates) || clockStates < 2) {
    throw new VacuumError(
      "edge/clock-states-out-of-domain",
      `clockSectorEmbed: clockStates ${clockStates} (a clock chain needs >= 2 vertices)`,
    );
  }
  if (!Number.isInteger(sector) || sector < 0 || sector >= clockStates) {
    throw new VacuumError(
      "edge/sector-out-of-range",
      `clockSectorEmbed: sector ${sector} outside [0, ${clockStates - 1}]`,
    );
  }
  const out: CVec = {
    dim: data.dim * clockStates,
    re: new Float64Array(data.dim * clockStates),
    im: new Float64Array(data.dim * clockStates),
  };
  for (let i = 0; i < data.dim; i++) {
    out.re[i * clockStates + sector] = data.re[i] as number;
    out.im[i * clockStates + sector] = data.im[i] as number;
  }
  return out;
}

/** The input-convention violation mass of a data vector: p = 1 - |c_valid|^2
 * under the SAME bit convention buildInputCheck uses (qubit q is bit
 * nQubits-1-q of the index). The variance law sigma_E^2 = 1/4 + p(1-p) is
 * priced against this p. */
export function inputViolationMass(
  data: CVec,
  nQubits: number,
  checkedQubits: readonly number[],
): number {
  requireWellFormedVec(data, "inputViolationMass");
  if (data.dim !== 2 ** nQubits) {
    throw new VacuumError(
      "edge/data-dim-mismatch",
      `inputViolationMass: data dim ${data.dim} is not 2^${nQubits}`,
    );
  }
  for (const q of checkedQubits) {
    if (!Number.isInteger(q) || q < 0 || q >= nQubits) {
      throw new VacuumError(
        "edge/checked-qubit-out-of-range",
        `inputViolationMass: checked qubit ${q} outside [0, ${nQubits})`,
      );
    }
  }
  const checked = new Set(checkedQubits);
  let p = 0;
  for (let d = 0; d < data.dim; d++) {
    let violated = false;
    for (let q = 0; q < nQubits; q++) {
      if (!checked.has(q)) continue;
      if (((d >> (nQubits - 1 - q)) & 1) === 1) violated = true;
    }
    if (violated)
      p += (data.re[d] as number) ** 2 + (data.im[d] as number) ** 2;
  }
  return p;
}

export interface SectorBandwidth {
  readonly sector: number;
  /** the scalar P_s H P_s actually is (constancy is audited, not assumed) */
  readonly diagonal: number;
  readonly secondMoment: number;
  /** max off-(block-)diagonal element of both blocks — 0 when scalar */
  readonly scalarDev: number;
}

/** The bandwidth face of ANY clock sector: P_s H P_s and P_s H^2 P_s read as
 * scalars. Edge sectors {0, T} of H_prop: (1/2, 1/2); interior: (1, 3/2). */
export function sectorBandwidth(
  h: CMat,
  clockStates: number,
  sector: number,
): SectorBandwidth {
  requireWellFormed(h, "sectorBandwidth");
  if (!Number.isInteger(sector) || sector < 0 || sector >= clockStates) {
    throw new VacuumError(
      "edge/sector-out-of-range",
      `sectorBandwidth: sector ${sector} outside [0, ${clockStates - 1}]`,
    );
  }
  const diag = clockSectorBlock(h, clockStates, sector, sector);
  const second = clockSectorBlock(cmatMul(h, h), clockStates, sector, sector);
  let scalarDev = 0;
  for (let i = 0; i < diag.dim; i++) {
    for (let j = 0; j < diag.dim; j++) {
      if (i === j) continue;
      scalarDev = Math.max(
        scalarDev,
        Math.abs(diag.re[i]![j] as number),
        Math.abs(diag.im[i]![j] as number),
        Math.abs(second.re[i]![j] as number),
        Math.abs(second.im[i]![j] as number),
      );
    }
  }
  return {
    sector,
    diagonal: blockScalar(diag),
    secondMoment: blockScalar(second),
    scalarDev,
  };
}

// ---------------------------------------------------------------------------
// The smuggling trial — an edge-identity claim is data, not truth.
// ---------------------------------------------------------------------------

export interface EdgeIdentityClaim {
  /** the clock sector the claim is about (0 = the walk family's edge) */
  readonly sector: number;
  /** claims P_s H P_s = c1 · P_s with this scalar */
  readonly claimedDiagonal: number;
  /** claims P_s H^2 P_s = c2 · P_s with this scalar */
  readonly claimedSecondMoment: number;
}

export interface EdgeViolation {
  readonly crime: string;
  readonly detail: string;
}

/** Audit a submitted edge-identity certificate against full recomputation:
 * both blocks are re-derived, their scalar-ness checked, and every deviation
 * is named with its number — a double-edge counterfeit carries its exact
 * 1/4 in the charge. */
export function auditEdgeIdentity(
  h: CMat,
  clockStates: number,
  claim: EdgeIdentityClaim,
): readonly EdgeViolation[] {
  const violations: EdgeViolation[] = [];
  const bw = sectorBandwidth(h, clockStates, claim.sector);
  if (bw.scalarDev > 1e-13) {
    violations.push({
      crime: "block not scalar",
      detail: `P_${claim.sector} H P_${claim.sector} has off-diagonal elements up to ${bw.scalarDev.toExponential(2)} — no scalar identity holds at all`,
    });
    return violations;
  }
  if (Math.abs(bw.diagonal - claim.claimedDiagonal) > 1e-13) {
    violations.push({
      crime: "counterfeit diagonal block",
      detail: `claimed P_${claim.sector} H P_${claim.sector} = ${claim.claimedDiagonal} · P, the block is ${bw.diagonal.toPrecision(12)} · P`,
    });
  }
  if (Math.abs(bw.secondMoment - claim.claimedSecondMoment) > 1e-13) {
    violations.push({
      crime: "counterfeit second-moment block (the double edge)",
      detail: `claimed P_${claim.sector} H^2 P_${claim.sector} = ${claim.claimedSecondMoment} · P, the block is ${bw.secondMoment.toPrecision(12)} · P — a second edge into the sector adds its exact 1/4`,
    });
  }
  return violations;
}
