/**
 * The named error surface (v0.3.0 face B).
 *
 * Every throw in src/ carries a machine-readable code from the QramErrorCode
 * union, so tests and callers can convict illegal inputs BY NAME instead of
 * matching on prose. Message text is stable; codes are the contract.
 *
 * The two failure disciplines of this repository:
 *  - kernels THROW on illegal inputs (the guards below);
 *  - referees (verifyTightCertificate, verifyQueryLedger) return NAMED
 *    verdicts for counterfeit CLAIMS — smuggling is adjudicated, not thrown.
 * Zero silent catches exist in this tree.
 */
/** The only error type thrown by this repository's kernels. */
export class QramError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.name = "QramError";
        this.code = code;
    }
}
/** Guard helper: call sites read as rejections, not constructions. */
export function reject(code, message) {
    throw new QramError(code, message);
}
