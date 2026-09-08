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

export type QramErrorCode =
  // core
  | "RNG_EMPTY_PICK"
  | "RNG_INT_RANGE"
  | "RNG_BERNOULLI_RANGE"
  | "LINALG_SHAPE"
  | "LINALG_SINGULAR"
  // amplitude estimation
  | "AE_P_RANGE"
  | "AE_M_RANGE"
  | "AE_K_RANGE"
  | "AE_FULLSPACE_PARAMS"
  | "AE_REGISTER_RANGE"
  | "AE_MC_PARAMS"
  // qram
  | "QRAM_ARG_RANGE"
  | "QRAM_ENUM_LIMIT"
  | "QRAM_CELLS_SHAPE"
  | "QRAM_ADDRESS_RANGE"
  | "QRAM_CELL_RANGE"
  | "QRAM_P_RANGE"
  | "STREAM_DRAWS"
  // online search / matching
  | "GROVER_EMPTY_SCORES"
  | "GROVER_N_RANGE"
  | "OBM_INSTANCE_SHAPE"
  | "OBM_RANK_SHAPE"
  | "MATCH_ARG_RANGE"
  | "MATCH_EVEN_N"
  // bandit schedulers
  | "BANDIT_NO_ARMS"
  | "BANDIT_MEANS_RANGE"
  | "BANDIT_ARG_RANGE"
  // markov-chain walks
  | "WALK_ISOLATED_VERTEX"
  | "WALK_NEIGHBOR_RANGE"
  | "WALK_NO_TRANSIENT"
  | "WALK_ASYMMETRIC_SUPPORT"
  | "WALK_CHAIN_SHAPE"
  | "WALK_TARGET_RANGE"
  | "WALK_MU_SHAPE"
  // experiments
  | "REPRO_INCOMPLETE";

/** The only error type thrown by this repository's kernels. */
export class QramError extends Error {
  readonly code: QramErrorCode;

  constructor(code: QramErrorCode, message: string) {
    super(message);
    this.name = "QramError";
    this.code = code;
  }
}

/** Guard helper: call sites read as rejections, not constructions. */
export function reject(code: QramErrorCode, message: string): never {
  throw new QramError(code, message);
}
