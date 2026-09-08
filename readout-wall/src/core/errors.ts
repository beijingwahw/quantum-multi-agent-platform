/**
 * The refusal envelope — every throw in this repo's kernel and switch layers
 * carries a named code (the nosignal-tariff v0.2.0 idiom, mirrored here).
 *
 * An error whose only identity is prose cannot be convicted by a test: a
 * message edit silently orphans the trial that was supposed to name it. The
 * code is the stable identity; the message text stays the frozen surface it
 * always was (nothing prefixes or rewrites it).
 */

export class RefusalError extends Error {
  readonly code: string;

  constructor(code: string, detail: string) {
    super(detail);
    this.name = "RefusalError";
    this.code = code;
  }
}

/** Refuse with a code — message is exactly `detail`, unchanged. */
export function refuse(code: string, detail: string): never {
  throw new RefusalError(code, detail);
}
