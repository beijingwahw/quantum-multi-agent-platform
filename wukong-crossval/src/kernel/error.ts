/**
 * The named error surface — every throw in this repo carries one of these
 * codes, and every public kernel entry rejects contraband input by name
 * (law: no anonymous TypeError, no silent NaN — the dimension-slot family
 * poisons values with undefined, and the poisoning is rejected, not shipped).
 */

export type XvalErrorCode =
  | "XVAL_N_RANGE"
  | "XVAL_QUBO_SHAPE"
  | "XVAL_PARAMS_LENGTH"
  | "XVAL_DEPTH_RANGE"
  | "XVAL_SHOTS_RANGE"
  | "XVAL_FLIP_RANGE"
  | "XVAL_BITS_RANGE"
  | "XVAL_LAYOUT_MISMATCH"
  | "XVAL_MASSES_SHAPE"
  | "XVAL_SHELL_RANGE"
  | "XVAL_INSTANCE_MISSING"
  | "XVAL_MINSHOTS_NULL_RATE"
  | "XVAL_MINSHOTS_ALT_RATE"
  | "XVAL_MINSHOTS_LEVEL"
  | "XVAL_PACKAGE_REJECTED";

export class XvalError extends Error {
  readonly code: XvalErrorCode;
  constructor(code: XvalErrorCode, message: string) {
    super(message);
    this.name = "XvalError";
    this.code = code;
  }
}

/** Qubit-count guard: `1 << n` wraps at n = 32 (and 2^n states are
 * unenumerable well before that), so 30 is the honest ceiling — beyond it
 * the engines would silently produce wrapped tables, not errors. */
export function requireQubitCount(n: number, what: string): void {
  if (!Number.isInteger(n) || n < 0 || n > 30) {
    throw new XvalError("XVAL_N_RANGE", `${what}: qubit count must be an integer in [0,30] (1 << n wraps beyond 30), got ${String(n)}`);
  }
}

/** Probability guard for flip levels and rates: endpoints included
 * (f = 0 is the no-noise anchor, f = 1/2 the uniform anchor). */
export function requireUnitInterval(f: number, what: string): void {
  if (!(f >= 0 && f <= 1)) {
    throw new XvalError("XVAL_FLIP_RANGE", `${what} must be in [0,1], got ${String(f)}`);
  }
}
