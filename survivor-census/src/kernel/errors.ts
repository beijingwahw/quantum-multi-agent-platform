/**
 * The error face — every kernel refusal is NAMED, twice: once in prose for
 * the human, once as a machine-readable code for the caller who needs to
 * discriminate refusals without string-matching messages (the v0.2.0
 * composition code discriminated P=0 by `message.includes("undefined")` —
 * a message edit would have silently broken the discrimination; the code
 * makes it structural). Messages are part of the tested surface and stay
 * put; codes are additive.
 */

export const ERROR_CODES = [
  "SC/BAD-N",
  "SC/BAD-COUNTS",
  "SC/BAD-MARKED",
  "SC/BAD-PHASES",
  "SC/P0-UNDEFINED",
  "SC/EMPTY-INTERSECTION",
  "SC/P-DOMAIN",
  "SC/DELTA-DOMAIN",
  "SC/MC-BAD-INPUTS",
  "SC/INTERNAL",
  "ILLEGAL-CENSUS",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class CensusError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "CensusError";
    this.code = code;
  }
}

/**
 * find()-or-refuse: lookups over structurally-guaranteed populations (an
 * instance by name, a family by name). A miss is an internal wiring fault,
 * not a math failure — it is named as one instead of leaking `undefined`
 * into arithmetic as a cryptic TypeError three lines later.
 */
export function expectFound<T>(what: string, v: T | undefined): T {
  if (v === undefined) {
    throw new CensusError("SC/INTERNAL", `expectFound: ${what} not found — internal wiring fault`);
  }
  return v;
}
