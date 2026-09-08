/**
 * The named error face — every kernel rejection carries a machine-checkable
 * code, and every public entry names the input it refuses.
 *
 * House form (smuggling-trial compatible): a test that feeds an entry an
 * illegal input does not grep prose — it asserts `err.code === "<CODE>"`.
 * The code list below is the single source: `ErrCode` derives from
 * `ERROR_CODES`, so a code that is not in the array is not in the type.
 *
 * Two convicted latent defects this face closes (both shipped silently wrong
 * answers before the guard existed, see test/errors.test.ts for the anchors):
 *   repetitionsFor(gap, delta > 1) returned a NEGATIVE schedule k
 *   binomTailAtMost(k, p = 0, atMost) returned NaN where the tail is exactly 1
 * plus the hang: randomSat with fewer than 3 available variables looped
 * forever instead of refusing.
 */

export const ERROR_CODES = [
  // sorter face
  "BAD-QUBIT-COUNT",
  "EMPTY-MARKED-SET",
  "MARKED-EXCEEDS-SPACE",
  "MARKED-OUT-OF-RANGE",
  "PAYLOAD-LENGTH",
  "ZERO-BRANCH-WEIGHT",
  "EMPTY-BRANCH",
  // restart face
  "EMPTY-PREFIX",
  "EMPTY-SCHEDULE",
  "CUTOFF-NOT-PRECOMPUTED",
  "CYCLE-NEVER-SUCCEEDS",
  "BAD-ROUND-PROBABILITY",
  "BAD-HORIZON",
  "BAD-RATE",
  "BAD-MARKED-COUNT",
  // ledger face
  "BAD-VAR-COUNT",
  "BAD-CLAUSE-COUNT",
  "INSUFFICIENT-VARIABLES",
  "UNSATISFIABLE-INSTANCE",
  "BAD-GAP",
  "BAD-DELTA",
  "BAD-PROBABILITY",
  "BAD-TRIAL-COUNT",
  "BAD-TAIL-INDEX",
  // exact-arithmetic face
  "ZERO-DENOMINATOR",
  "NEGATIVE-SQRT",
  "BAD-ODD-K",
  "EMPTY-TABLE",
  "NO-EXACT-TIE",
  "INCONSISTENT-ROW",
  "BAD-RACE-ORDER",
  "ROOT-AT-ENDPOINT",
  "ROOT-ON-GRID",
  "NO-SIGN-CHANGE",
  // experiment face
  "EXP-SCAN-FAILED",
] as const;

export type ErrCode = (typeof ERROR_CODES)[number];

export class KernelError extends Error {
  readonly code: ErrCode;

  constructor(code: ErrCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "KernelError";
    this.code = code;
  }
}

/** type guard for catch sites and tests — the only sanctioned way to read a code */
export function isKernelError(e: unknown): e is KernelError {
  return e instanceof KernelError;
}
