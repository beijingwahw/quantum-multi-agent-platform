/**
 * The named error surface of the kernel — the single source for every throw
 * in src. Each public entry that can reject an input does so with a
 * KernelError carrying a machine-readable code, so a caller can distinguish
 * the two channels:
 *
 *   - VALIDATION rejections (codes below): a caller smuggled an illegal
 *     input past a public entry — a programming error, named per site
 *     (zero denominators, index/arity violations, range guards).
 *   - CONVICTIONS ("poly/identity-failed"): the zero-polynomial engine
 *     caught a forged identity — a MATHEMATICAL verdict, not a programming
 *     error. This is the channel pAssertZero fires on.
 *
 * Messages are frozen (tests anchor on substrings like "FAILED" and
 * "mismatch"); the code is the structured channel added on top.
 */
export type KernelErrorCode =
  // --- kernel validation: illegal inputs at public entries ---
  | "rat/zero-denominator"
  | "rdiv/zero-divisor"
  | "poly/var-mismatch"
  | "poly/index-range"
  | "poly/arity"
  | "family/n-range"
  | "family/other-index-range"
  | "gauge/arity"
  | "gauge/vars"
  | "gauge/n-range"
  | "control/level-range"
  | "control/not-profitable"
  | "second-price/region"
  | "diamond/pullback-survivor"
  | "cert/d-range"
  | "cert/degree-invalid"
  | "cycles/k-limit"
  | "instance/tie-guard"
  | "world/tie-guard"
  | "rule/unhandled-kind"
  // --- convictions: the zero-polynomial engine's verdicts ---
  | "poly/identity-failed";

export class KernelError extends Error {
  readonly code: KernelErrorCode;

  constructor(code: KernelErrorCode, message: string) {
    super(message);
    this.name = "KernelError";
    this.code = code;
  }
}
