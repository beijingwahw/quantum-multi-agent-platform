/**
 * qLDPC / surface code catalog for fault-tolerance resource estimation.
 *
 * Every entry carries its published source; thresholds are circuit-level
 * pseudo-thresholds used as estimation inputs, not precision claims.
 */

export interface CodeSpec {
  readonly id: string;
  readonly family: "surface" | "gross";
  /** Data physical qubits n. */
  readonly n: number;
  /** Logical qubits k. */
  readonly k: number;
  /** Code distance d. */
  readonly d: number;
  /** Syndrome ancilla qubits per code block. */
  readonly ancilla: number;
  /** Syndrome bits extracted per round per block (independent checks). */
  readonly checks: number;
  /** Circuit-level pseudo-threshold (estimation input, see source). */
  readonly threshold: number;
  readonly source: string;
}

/**
 * Rotated surface code [[d^2, 1, d]].
 * Threshold default 0.6% reflects commonly cited circuit-level values
 * (Fowler et al., Phys. Rev. A 86, 032324 (2012) and follow-ups).
 */
export function surfaceCode(d: number, threshold = 0.006): CodeSpec {
  if (d < 2 || d % 1 !== 0) throw new Error(`surface distance must be an integer >= 2, got ${d}`);
  return {
    id: `surface-d${d}`,
    family: "surface",
    n: d * d,
    k: 1,
    d,
    ancilla: d * d - 1,
    checks: d * d - 1,
    threshold,
    source: "Fowler et al., Phys. Rev. A 86, 032324 (2012)",
  };
}

/**
 * IBM "gross" bivariate bicycle code [[144, 12, 12]]: 144 data qubits,
 * weight-6 stabilizers, 144 syndrome ancillas (288 qubits per block),
 * BP+OSD circuit-level pseudo-threshold reported in the 0.6-0.8% range.
 */
export function grossCode(threshold = 0.007): CodeSpec {
  return {
    id: "gross-bb-144-12-12",
    family: "gross",
    n: 144,
    k: 12,
    d: 12,
    ancilla: 144,
    checks: 144,
    threshold,
    source: "Bravyi et al., Nature 627, 778-783 (2024); arXiv:2308.07915",
  };
}

/** Number of code blocks needed to hold `logicalQubits` logical qubits. */
export function blocksFor(logicalQubits: number, code: CodeSpec): number {
  return Math.ceil(logicalQubits / code.k);
}

export interface LogicalErrorModel {
  /** Prefactor A in eps_L = A * (p/p_th)^{floor(d/2)+1} per syndrome round. */
  readonly amplitude: number;
}

export const DEFAULT_LOGICAL_ERROR_MODEL: LogicalErrorModel = { amplitude: 0.1 };

/**
 * Heuristic logical error per syndrome round:
 *   eps_L = A * (p_phys / p_th)^{floor(d/2)+1}.
 *
 * This is the standard below-threshold power-law suppression shape; A and the
 * exponent are estimation inputs, deliberately exposed (not hidden constants).
 */
export function logicalErrorPerRound(
  code: CodeSpec,
  pPhys: number,
  model: LogicalErrorModel = DEFAULT_LOGICAL_ERROR_MODEL,
): number {
  const exponent = Math.floor(code.d / 2) + 1;
  return model.amplitude * Math.pow(pPhys / code.threshold, exponent);
}

/** Total physical qubits (data + ancilla) for a given block count. */
export function physicalQubits(blocks: number, code: CodeSpec): number {
  return blocks * (code.n + code.ancilla);
}
