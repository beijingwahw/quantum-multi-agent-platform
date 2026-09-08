/**
 * The named-error contract: every throw in this repo carries a stable,
 * machine-checkable `code` (SCREAMING_SNAKE) plus a human-readable detail;
 * the message is always exactly `${code}: ${detail}` so a test can grep
 * either surface. SensorGuardError (src/net/sensors.ts) implements the same
 * contract under its own class name for instanceof dispatch at the sensor
 * boundary.
 */

/** Structural contract shared by every coded error in the repo. */
export interface CodedError extends Error {
  /** Stable machine-checkable identifier; never renamed, only added. */
  readonly code: string;
}

/** Type guard used by tests and by callers that catch-and-dispatch. */
export function isCodedError(err: unknown): err is CodedError {
  return (
    err instanceof Error &&
    "code" in err &&
    typeof (err as { code?: unknown }).code === "string" &&
    // the message must open with the code itself (message === `${code}: ...`)
    err.message.startsWith(`${(err as { code: string }).code}: `)
  );
}

/** Coded error for the scheduling core (engine, policies, topology, markov, physics ops). */
export class SchedError extends Error implements CodedError {
  readonly code: string;

  constructor(code: string, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "SchedError";
    this.code = code;
  }
}
