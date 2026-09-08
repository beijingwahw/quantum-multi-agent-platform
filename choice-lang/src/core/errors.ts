/**
 * The named-error discipline: every throw at a public boundary carries a
 * machine-checkable `code`, so a rejection can be asserted by name in the
 * smuggling trials — an unnamed throw is a witness nobody can cross-examine.
 * Lives in core/ (beside cmat) so both the numeric kernel and the language
 * layer can throw it without a core -> kernel dependency.
 */
export class ChoiceLangError extends Error {
  /** machine-checkable rejection code, e.g. "PATTERN_ARITY" */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ChoiceLangError";
    this.code = code;
  }
}
