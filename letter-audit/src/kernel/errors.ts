/**
 * The kernel's named error surface — every public throw carries a code the
 * tests can convict by name. Free-text Error messages are for humans; the
 * `code` field is for the smuggling trials.
 */

export type AuditErrorCode =
  /** a malformed machine/universe parameter crossed a public entry (beaver.ts) */
  | "EA:MACHINE"
  /** tetrate's domain: integer height in 1..MAX_MATERIALIZE_HEIGHT */
  | "EA:TETRATE"
  /** a tower expression was built with an illegal height at construction time */
  | "EA:TOWER-SHAPE"
  /** compareTowers was asked to order expressions outside its checked domain */
  | "EA:TOWER-DOMAIN"
  /** an internal invariant broke — not caller error, never silenced */
  | "EA:TOWER-UNREACHABLE"
  /** the renderer refused to print an audit the checker rejected */
  | "EA:RENDER";

export class AuditError extends Error {
  readonly code: AuditErrorCode;

  constructor(code: AuditErrorCode, message: string) {
    super(`[${code}] ${message}`);
    this.name = "AuditError";
    this.code = code;
  }
}
