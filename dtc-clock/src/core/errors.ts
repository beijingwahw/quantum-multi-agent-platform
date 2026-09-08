/**
 * The named error surface — every refusal this repo makes carries a code.
 *
 * The codes are the machine-readable families of refusal (one per physical
 * kind, not per call site); the message text after the `[E/X]` tag is the
 * call site's own detail and keeps its historical wording (tests pin
 * substrings of it). Law: no silent catch anywhere — a catch that expects a
 * refusal checks `instanceof DtcError` AND the code, and rethrows anything
 * else.
 */

/** The refusal families. */
export type DtcErrorCode =
  | "E/DOMAIN" // index out of range, non-integer/negative dims, empty collection, argument outside the documented domain
  | "E/SHAPE" // matrix/vector shape mismatch between arguments
  | "E/WRONG-OBJECT" // physical impossibility: imaginary expectation, non-real pack, degenerate vacuum — the object itself is wrong
  | "E/BRACKET" // a bisection bracket does not isolate what it must
  | "E/SOLVER" // an eigensolver failed its own reconstruction/completeness check
  | "E/BOARD"; // the board is illegal — the renderer refuses to print it

/** A refusal, named. `err.code` is the family; the message carries `[E/X] <detail>`. */
export class DtcError extends Error {
  readonly code: DtcErrorCode;

  constructor(code: DtcErrorCode, detail: string) {
    super(`[${code}] ${detail}`);
    this.name = "DtcError";
    this.code = code;
  }
}
