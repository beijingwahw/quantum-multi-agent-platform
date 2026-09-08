/**
 * The named refusal: every public boundary in this repo rejects illegal
 * input with a DomainError carrying a stable, greppable code
 * (`<entry>:<facet>`) — a NaN channel built from gamma = 2 must die at the
 * boundary by name, not surface as a silent NaN witness downstream.
 */
export class DomainError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

/** Guard: the law's damping constant must lie in [0, 1] (closed — 0 is the
 * do-nothing law, 1 is full damping; both are legal channels). NaN fails the
 * comparison and is rejected with it. */
export function requireGamma(entry: string, gamma: number): void {
  if (!(gamma >= 0 && gamma <= 1)) {
    throw new DomainError(`${entry}:gamma-range`, `${entry}: gamma must lie in [0,1], got ${gamma}`);
  }
}

/** Guard: a perturbation weight must lie in [0, 1) — the law stays present. */
export function requireEps(entry: string, eps: number): void {
  if (!(eps >= 0 && eps < 1)) {
    throw new DomainError(`${entry}:eps-range`, `${entry}: eps must lie in [0,1), got ${eps}`);
  }
}

/** Guard: a step count / horizon must be a non-negative integer. */
export function requireStep(entry: string, k: number): void {
  if (!Number.isInteger(k) || k < 0) {
    throw new DomainError(`${entry}:step-range`, `${entry}: step count must be a non-negative integer, got ${k}`);
  }
}

/** Guard: a rate must be non-negative (NaN fails with it). */
export function requireRate(entry: string, r: number): void {
  if (!(r >= 0)) {
    throw new DomainError(`${entry}:rate-range`, `${entry}: rate must be >= 0, got ${r}`);
  }
}
