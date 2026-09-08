/**
 * The named error surface of ft-qaoa. Every throw in this repository carries
 * a stable machine-readable `code`, so illegal inputs are rejected by name
 * (conviction tests assert the code) instead of dissolving into free-text
 * messages. Zero silent-corruption paths: a guard clause fires before any
 * arithmetic that would wrap, NaN, or mis-index.
 */
export class FtQaoaError extends Error {
  constructor(
    /** Stable machine-readable identifier, e.g. "QUBIT_COUNT_INVALID". */
    readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = "FtQaoaError";
  }
}

/** Throw `FtQaoaError(code, message)` unless `condition` holds. */
export function requireThat(condition: boolean, code: string, message: string): asserts condition {
  if (!condition) {
    throw new FtQaoaError(code, message);
  }
}

/**
 * Qubit count domain shared by every `1 << n` consumer: JS bit-shift takes
 * `n` mod 32, so n >= 31 silently wraps (e.g. 1 << 32 === 1) instead of
 * failing — the exact corruption class this guard exists to name.
 */
export function requireQubitCount(n: number, code = "QUBIT_COUNT_INVALID"): void {
  requireThat(
    Number.isInteger(n) && n >= 0 && n <= 30,
    code,
    `qubit count must be an integer in [0, 30] (2^n must not wrap a 32-bit shift), got ${n}`,
  );
}
