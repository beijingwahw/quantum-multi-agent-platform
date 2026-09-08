/**
 * The named error surface: every public throw in this repo carries a
 * machine-readable code, so a rejected input is named, never silent.
 */

export type KSwitchErrorCode =
  | "GATE-INDEX-OUT-OF-RANGE"
  | "SUPERSEQUENCE-LIMIT-BELOW-QUARTET"
  | "CENSUS-NON-PAULI-PAIR"
  | "MATCHED-PAIR-GENERATOR-NOT-PAULI"
  | "SUPERSEQUENCE-SEARCH-FAILED";

export class KSwitchError extends Error {
  constructor(readonly code: KSwitchErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = "KSwitchError";
  }
}
