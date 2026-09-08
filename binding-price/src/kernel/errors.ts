/**
 * The market's named refusals. Every throw the market machinery makes carries
 * a MarketErrorCode, so a caller can convict by name instead of parsing prose
 * — the same discipline the checker's verdict codes (MEMBER-FRAUD,
 * FORGED-TV, ...) already follow. v0.3.0 closes the silent-garbage family:
 * before the guards, a non-qubit matrix handed to the one-coin machinery was
 * multiplied and traced without a word (the qram-sched class, batch 83).
 */

/** Every refusal code the market machinery can throw. */
export type MarketErrorCode =
  /** a 2x2-expected object (qubit state, announcement) is not 2x2 */
  | "QUBIT-FRAUD"
  /** a 4x4-expected object (two-coin joint register) is not 4x4 */
  | "REGISTER-FRAUD"
  /** the renderer refuses to print a market that does not clear */
  | "MARKET-REJECTED";

/** An Error carrying its refusal code — catchable as Error, convictable by name. */
export class MarketError extends Error {
  readonly code: MarketErrorCode;

  constructor(code: MarketErrorCode, message: string) {
    super(message);
    this.name = "MarketError";
    this.code = code;
  }
}
