/**
 * THE J-BOARD — the per-error equivalence census (the JIA11 boundary, measured).
 *
 * The E-board ties an error to its class prototype (E2): one mutant guards its
 * whole registered class, honestly coarse — constructing a mutant PER ERROR is
 * the field's open problem precisely because some constructions come out
 * EQUIVALENT to what the battery already cannot distinguish (JIA11). This board
 * does not solve that problem; it MEASURES it on the workspace's own error
 * history, pilot class by pilot class, exhaustively:
 *
 *   PILOTS — conjugation (19/19, v0.8.0) and wrong-object (44/44, v0.12.0):
 *   every MUTANT-KILLED row of each. The remaining two classes (dimension-slot
 *   29, statistics 25) are priced as next steps.
 *
 * For each error, a FAITHFUL family-level re-enactment of that error's own
 * defect (the construction is reviewable data, one line per row) runs against
 * the full ten-property battery. The verdict vocabulary is closed:
 *
 *   COLLAPSES     — battery-indistinguishable from its class prototype: the
 *                   (pass, worst) vectors agree BIT-EXACTLY on all ten
 *                   properties. The class tie is already the fixed point of
 *                   per-error construction for this error.
 *   ERROR-LEVEL   — a distinct construction the battery kills: the tie refines
 *                   from category to error. The declared killer must be among
 *                   the live failing properties.
 *   EQUIVALENT    — a live survivor: nothing in the battery moves it. The open
 *                   problem in person, booked with its reason (J3).
 *   UNBUILDABLE   — the defect's home composition is not a family member; no
 *                   faithful re-enactment exists at this layer. Booked (J3).
 *
 * The decidable exchange, stated as law: PROGRAM equivalence is undecidable
 * (the open problem); BATTERY-indistinguishability is a relation the machine
 * decides bit-exactly. The census claims the second and books the first.
 *
 * Laws (checked live, every run):
 *   J1 COVERAGE — the table's keys are exactly the enrollment's MUTANT-KILLED
 *      rows of the pilot class, both ways; the prototype column must equal the
 *      enrollment's own anchor (no re-labeling); the verdict vocabulary is
 *      closed and the keys are unique;
 *   J2 LIVE VERDICT — every declared verdict equals the computed census:
 *      collapse is bit-exact battery-indistinguishability, an ERROR-LEVEL
 *      killer must fail live, an EQUIVALENT row must survive live, and an
 *      ERROR-LEVEL declared where no construction exists is convicted by the
 *      builder's own refusal;
 *   J3 THE BOOKINGS — every EQUIVALENT and UNBUILDABLE row carries its reason
 *      and is printed on the report (the E4 symmetry).
 */
import { identity, kron, mat, mMul, mScale, vInner as coreVInner, vScale, type CMat } from "../core/cmat.js";
import { vecToRho as coreVecToRho } from "../core/states.js";
import { applyKraus as coreApplyKraus, filterBasisDigit } from "../core/channels.js";
import { GAMMA, lawKraus } from "./law.js";
import { canonicalFamily, mutantFamily, MUTANTS, type Family, type MutantSpec } from "./family.js";
import { runBattery, PROPERTY_IDS, type PropResult } from "./battery.js";
import { ENROLLMENT, type EnrollmentRow } from "./enrollment.js";

export const PILOT_CLASSES: readonly string[] = ["conjugation", "wrong-object", "dimension-slot", "statistics"];

export type PerErrorVerdict = "COLLAPSES" | "ERROR-LEVEL" | "EQUIVALENT" | "UNBUILDABLE";
export const VERDICTS: readonly PerErrorVerdict[] = ["COLLAPSES", "ERROR-LEVEL", "EQUIVALENT", "UNBUILDABLE"];

export interface PerErrorSpec {
  /** "bN#i" — must be a live registry key enrolled MUTANT-KILLED in the pilot class */
  readonly key: string;
  /** the enrollment's own anchor — the class prototype this row sits on (J1) */
  readonly prototype: string;
  readonly verdict: PerErrorVerdict;
  /** ERROR-LEVEL: the declared killer property */
  readonly killer?: string;
  /** COLLAPSES: the prototype the construction is battery-indistinguishable from */
  readonly onto?: string;
  /** the construction, one reviewable line (buildable rows) */
  readonly built?: string;
  /** EQUIVALENT / UNBUILDABLE: the booking is mandatory (J3) */
  readonly reason?: string;
}

export const PER_ERROR: readonly PerErrorSpec[] = [
  { key: "b4#0", prototype: "MU1", verdict: "UNBUILDABLE", reason: "the defect's home is the objective-to-Hamiltonian convention (H_P := -C), not a family composition — no family member encodes an objective; the class tie stands" },
  { key: "b8#2", prototype: "MU1", verdict: "UNBUILDABLE", reason: "group-element normalization by the first entry instead of the phase ratio b0/a0 — the family carries no group calculus; the class tie stands" },
  { key: "b9#1", prototype: "MU1", verdict: "UNBUILDABLE", reason: "Jacobi rotation handedness — the eigensolver is not a family member (b15#1 is the same home); the class tie stands" },
  { key: "b10#4", prototype: "MU1", verdict: "ERROR-LEVEL", killer: "P3", built: "outer(a,b) drops the conjugate (a_i b_j) — the closed-form element conjugates the wrong side" },
  { key: "b10#7", prototype: "MU2", verdict: "UNBUILDABLE", reason: "Werner/isotropic convention alignment — state-parameterization conventions, no family composition carries them; the class tie stands" },
  { key: "b11#0", prototype: "MU1", verdict: "UNBUILDABLE", reason: "the Szegedy search-step convention (C.S.R, oracle postposed) — the walk construction is not a family member; the class tie stands" },
  { key: "b13#0", prototype: "MU2", verdict: "ERROR-LEVEL", killer: "P2", built: "embedWorld bakes a spurious 1/sqrt(2) into the tensor embedding — trace preservation broken at the composition" },
  { key: "b13#4", prototype: "MU1", verdict: "ERROR-LEVEL", killer: "P6", built: "applyLaw's flip Kraus carries a spurious 0.5 amplitude — K+K != I, the leakage identity breaks" },
  { key: "b15#1", prototype: "MU1", verdict: "UNBUILDABLE", reason: "hand-written complex Hermitian Jacobi — the same home as b9#1, not a family member; the class tie stands" },
  { key: "b15#2", prototype: "MU2", verdict: "ERROR-LEVEL", killer: "P5", built: "conditionalOn ships the raw block with its normalization factor missing (trace = block mass — the trace alarmed)" },
  { key: "b16#0", prototype: "MU1", verdict: "ERROR-LEVEL", killer: "P4", built: "applyKraus computes K rho K — the adjoint forgotten (M.M instead of M+ M), Hermiticity dies" },
  { key: "b18#4", prototype: "MU1", verdict: "UNBUILDABLE", reason: "the Groves payment sign convention — mechanism-design arithmetic, no family member; the class tie stands" },
  { key: "b20#0", prototype: "MU2", verdict: "COLLAPSES", onto: "MU2", built: "vecToRho conjugates the wrong side (rho^T) — MU2's own corruption, bit-exact" },
  { key: "b20#4", prototype: "MU1", verdict: "UNBUILDABLE", reason: "the |Phi_theta> correlation tensor's hand-derived signs (T_zz = +1, T_xy coherent) — a closed-form derivation, not a family composition; the class tie stands" },
  { key: "b26#0", prototype: "MU1", verdict: "ERROR-LEVEL", killer: "P2", built: "vInner's real part truncated to aRe*bRe — the aIm*bIm cross term dropped, imaginary side correct" },
  { key: "b28#2", prototype: "MU1", verdict: "ERROR-LEVEL", killer: "P2", built: "the complex product's real part incomplete (the -im*phIm term missing) — the SAME construction as b26#0: two errors, one mutation shape" },
  { key: "b29#0", prototype: "MU1", verdict: "COLLAPSES", onto: "MU1", built: "vInner returns the conjugate — MU1's own corruption, bit-exact" },
  { key: "b30#0", prototype: "MU2", verdict: "EQUIVALENT", built: "vecToRho receives the globally-negated ket (vScale(v,-1)) — the Bell-basis sign placed on the whole vector", reason: "PROVEN equivalent: global phase is unobservable at the density layer, |−ψ⟩⟨−ψ| = |ψ⟩⟨ψ| elementwise — the re-enacted defect is real at ket level (orthogonality destroyed) and the family is blind to it BY REPRESENTATION. The JIA11 phenomenon with a one-line proof" },
  { key: "b36#7", prototype: "MU1", verdict: "UNBUILDABLE", reason: "expectationAt's observable multiplication (tre*O + i tim*O) — the family carries no observable expectation; the class tie stands" },
  // ---- the wrong-object pilot (v0.12.0, 44/44) — verdicts from the live census run ----
  { key: "b21#0", prototype: "MU5", verdict: "COLLAPSES", onto: "MU5", built: "conditionalOn divides by the joint element P(w=digit, d=0) instead of the block trace — MU5's own corruption (its history cites THIS very error), bit-exact" },
  { key: "b31#3", prototype: "MU7", verdict: "COLLAPSES", onto: "MU7", built: "limitObject keeps the diagonal blocks in place (the dephased twin) — MU7's own corruption (its history cites THIS very error), bit-exact" },
  { key: "b24#2", prototype: "MU5", verdict: "ERROR-LEVEL", killer: "P5", built: "the order-bit readout returns the JOINT cells re[0]/re[3] (world AND data pinned) instead of the data-summed marginals" },
  { key: "b15#3", prototype: "MU5", verdict: "ERROR-LEVEL", killer: "P5", built: "the branch marginal computed by PINNING data=0 (conditioning on the partner's outcome) instead of summing over it" },
  { key: "b14#2", prototype: "MU5", verdict: "ERROR-LEVEL", killer: "P5", built: "the axis readout applies sigma_x (x) I to the state and reads the computational diagonals — applying a unitary is not measuring: the outcome labels come back swapped (the state-damage face lives outside a pure readout member)" },
  { key: "b2#2", prototype: "MU5", verdict: "UNBUILDABLE", reason: "concurrency-cancellation semantics (Promise.race vs the runaway child) — the family has no process layer; the class tie stands" },
  { key: "b3#0", prototype: "MU5", verdict: "UNBUILDABLE", reason: "global-optimum claim for a golden-section search — an optimizer assumption, no family member searches; the class tie stands" },
  { key: "b4#1", prototype: "MU5", verdict: "UNBUILDABLE", reason: "imaginary-time reachability from |+>^n — an algorithm-level spectral assumption; the class tie stands" },
  { key: "b6#1", prototype: "MU5", verdict: "UNBUILDABLE", reason: "s-grid resolution of an avoided crossing — numerics design, not a family composition; the class tie stands" },
  { key: "b6#2", prototype: "MU7", verdict: "UNBUILDABLE", reason: "Lanczos level labeling (lambda_1 as 'the first excited') — no eigensolver in the family (the recorded limitation, b31#2's home); the class tie stands" },
  { key: "b7#3", prototype: "MU5", verdict: "UNBUILDABLE", reason: "Perron-Frobenius read as 'all amplitudes non-negative' — a theorem's hypothesis object; the class tie stands" },
  { key: "b8#0", prototype: "MU5", verdict: "UNBUILDABLE", reason: "purification eligibility of raw BBPSSW output — a protocol-layer assumption; the class tie stands" },
  { key: "b8#4", prototype: "MU5", verdict: "UNBUILDABLE", reason: "greedy interval tiling in id order — a scheduler heuristic, no family member schedules; the class tie stands" },
  { key: "b8#6", prototype: "MU5", verdict: "UNBUILDABLE", reason: "the key-rate collapse variable (n/p vs T2) — a physics-claim object; the class tie stands" },
  { key: "b9#7", prototype: "MU5", verdict: "UNBUILDABLE", reason: "Bell fidelity and concurrence telling one story at the optimum — correlation-measure claims; the family carries neither measure; the class tie stands" },
  { key: "b11#1", prototype: "MU5", verdict: "UNBUILDABLE", reason: "'the walk implementation is broken (when norms decay)' — a diagnosis claim about a walk the family does not carry; the class tie stands" },
  { key: "b11#5", prototype: "MU5", verdict: "UNBUILDABLE", reason: "adversarial regret's sign claim — regret is an external quantity, no family member carries it; the class tie stands" },
  { key: "b12#1", prototype: "MU5", verdict: "UNBUILDABLE", reason: "the ZZ Hamiltonian's max off-diagonal entry — no Hamiltonian member; the class tie stands" },
  { key: "b12#5", prototype: "MU5", verdict: "UNBUILDABLE", reason: "'the advantage factor is a constant' — a claim about an external metric; the class tie stands" },
  { key: "b13#5", prototype: "MU5", verdict: "UNBUILDABLE", reason: "one matched deception pair refuting all fixed-order simulators — a quantifier claim about simulators; the class tie stands" },
  { key: "b15#4", prototype: "MU5", verdict: "UNBUILDABLE", reason: "support signatures as Pauli index strings — a representation-convention object; the class tie stands" },
  { key: "b17#4", prototype: "MU7", verdict: "UNBUILDABLE", reason: "vals[1] as the spectral gap — eigenvalue-slot labeling; no eigensolver member (the recorded limitation); the class tie stands" },
  { key: "b18#0", prototype: "MU5", verdict: "UNBUILDABLE", reason: "a stepwise 1e-15 residual as an integrator certificate — a certification object in mechanism-design arithmetic; the class tie stands" },
  { key: "b19#1", prototype: "MU5", verdict: "UNBUILDABLE", reason: "'trace-preserving equals identity elementwise' — a false CLAIM about channels, not a composition corruption; the class tie stands" },
  { key: "b19#2", prototype: "MU5", verdict: "UNBUILDABLE", reason: "'the average of conditionals is the conditional of the average' — a linearity CLAIM over an averaging pipeline no family member encodes (the true conditional is nonlinear in its normalization); the class tie stands" },
  { key: "b20#2", prototype: "MU5", verdict: "UNBUILDABLE", reason: "no-signaling as I(B; A's outcome)=0 — a mutual-information definition object; the family carries no MI member; the class tie stands" },
  { key: "b20#3", prototype: "MU5", verdict: "UNBUILDABLE", reason: "'B's coin stays uniform' as THE invariant — an invariant-choice claim; the class tie stands" },
  { key: "b21#1", prototype: "MU5", verdict: "UNBUILDABLE", reason: "a numerical clone-gap lower bound as a no-cloning certificate — certification arithmetic outside the family; the class tie stands" },
  { key: "b22#0", prototype: "MU5", verdict: "UNBUILDABLE", reason: "error-shaped objects through a batch-shaped counter — a census-counter shape; no family member counts; the class tie stands" },
  { key: "b24#4", prototype: "MU5", verdict: "UNBUILDABLE", reason: "'ensemble average is I/2' checked against identity(2) — a reference-object comparison in check code; the class tie stands" },
  { key: "b25#4", prototype: "MU5", verdict: "UNBUILDABLE", reason: "control marginal vs prepared state after a choose — no choose member; the class tie stands" },
  { key: "b29#2", prototype: "MU5", verdict: "UNBUILDABLE", reason: "assert.equal(pKeep, 1) on a degenerate case — a float-equality assertion object in test code; the class tie stands" },
  { key: "b30#2", prototype: "MU5", verdict: "UNBUILDABLE", reason: "pure-payload identity via the Uhlmann fidelity — no fidelity member (the pure-state object wanted |<psi|phi>|^2); the class tie stands" },
  { key: "b31#2", prototype: "MU5", verdict: "UNBUILDABLE", reason: "exp(iH) through eigHermitian on an INDEFINITE random Hermitian — the recorded family limitation: the eigensolver is not a member at all; the class tie stands" },
  { key: "b32#2", prototype: "MU5", verdict: "UNBUILDABLE", reason: "P10's entangled states via a global U(4) — the battery's own test-state construction, inside the property, not a Family member; the class tie stands" },
  { key: "b32#8", prototype: "MU5", verdict: "UNBUILDABLE", reason: "the negative control's mismatched pair built legal — a constructed zero in test construction (Q4's birth class); the family members were honest, the control was not; the class tie stands" },
  { key: "b35#0", prototype: "MU5", verdict: "UNBUILDABLE", reason: "resolveAnchor's branches on reg.anchor instead of the split-out path — a variable-object slip in census code, no family member; the class tie stands" },
  { key: "b36#0", prototype: "MU5", verdict: "UNBUILDABLE", reason: "runner-major vs clock-major total index — a dtc-clock permutation convention; no family member permutes; the class tie stands" },
  { key: "b36#1", prototype: "MU5", verdict: "UNBUILDABLE", reason: "the (d1,d2) pair loop collapsed to a single d — an optimization loop object; the class tie stands" },
  { key: "b36#3", prototype: "MU5", verdict: "UNBUILDABLE", reason: "the halted runner's non-injectivity — a permutation-injectivity claim; the class tie stands" },
  { key: "b36#5", prototype: "MU5", verdict: "UNBUILDABLE", reason: "X_0 as the battery probe (EVEN under the chain's Z2) — an operator-parity choice; no observable member; the class tie stands" },
  { key: "b36#6", prototype: "MU5", verdict: "UNBUILDABLE", reason: "V^T O V instead of V O V^T — an eigensolver-transform orientation; no eigensolver member (b31#2's home); the class tie stands" },
  { key: "b36#10", prototype: "MU5", verdict: "UNBUILDABLE", reason: "bit0-as-a0 AND p3-as-LSB — a bit-order convention in the multiplier's verifier; the class tie stands" },
  { key: "b36#11", prototype: "MU5", verdict: "UNBUILDABLE", reason: "(E_0 - E_k)/J(n-1) going negative while the chain heats — a derived-metric orientation; the class tie stands" },
  // ---- the dimension-slot pilot (v0.13.0, 29/29) — verdicts from the live census run ----
  { key: "b24#0", prototype: "MU4", verdict: "COLLAPSES", onto: "MU4", built: "the bare 2x2 projector straight at the 4x4 state — MU4's own corruption (its history cites THIS very error), bit-exact through the crash face" },
  { key: "b31#0", prototype: "MU6", verdict: "COLLAPSES", onto: "MU6", built: "the |1><0| Kraus element written at flat index 1 (element (0,1)) — MU6's own corruption (its history cites THIS very error), bit-exact" },
  { key: "b31#4", prototype: "MU3", verdict: "COLLAPSES", onto: "MU3", built: "the 4x4 full state embedded as if it were the 2x2 cargo — MU3's own corruption (its history cites THIS very error), bit-exact" },
  { key: "b13#2", prototype: "MU6", verdict: "ERROR-LEVEL", killer: "P2", built: "I (x) U computed as a PRODUCT — embedWorld multiplies the world projector by the cargo instead of tensoring (2x2 result, silently accepted)" },
  { key: "b31#1", prototype: "MU3", verdict: "ERROR-LEVEL", killer: "P5", built: "a 4x4 normalized by MULTIPLYING it with a 1x1 scalar matrix through mMul — mScale is the sanctioned route; the shape guard refuses on the spot (crash face on P5, distinct from MU3's P2 face)" },
  { key: "b5#1", prototype: "MU3", verdict: "UNBUILDABLE", reason: "single-edge string flips between N_xx sectors — a spin-chain sector bookkeeping the family does not carry; the class tie stands" },
  { key: "b5#3", prototype: "MU3", verdict: "UNBUILDABLE", reason: "rollback with an inverted ternary — chain-move bookkeeping, no family member proposes moves; the class tie stands" },
  { key: "b6#3", prototype: "MU3", verdict: "UNBUILDABLE", reason: "full-space Lanczos convergence at k = dim-1 — eigensolver numerics (no eigensolver member, the recorded limitation); the class tie stands" },
  { key: "b6#4", prototype: "MU3", verdict: "UNBUILDABLE", reason: "N*m_x^2 for the fully-connected XX term claimed normalization-free — a Hamiltonian-coefficient claim; no Hamiltonian member; the class tie stands" },
  { key: "b7#0", prototype: "MU3", verdict: "UNBUILDABLE", reason: "MPO key-completion terms at station i — tensor-network bookkeeping, no family member; the class tie stands" },
  { key: "b7#1", prototype: "MU3", verdict: "UNBUILDABLE", reason: "environment absorption with = — MPO reduction conventions; the class tie stands" },
  { key: "b7#2", prototype: "MU3", verdict: "UNBUILDABLE", reason: "naive nested contraction with in/out spins as they come — contraction-order design; the class tie stands" },
  { key: "b12#2", prototype: "MU3", verdict: "UNBUILDABLE", reason: "one ascending comparator sorting Johnson's groups — a classical grouping claim; the class tie stands" },
  { key: "b13#1", prototype: "MU3", verdict: "UNBUILDABLE", reason: "environment slots assigned by execution order — scheduler bookkeeping; the class tie stands" },
  { key: "b15#0", prototype: "MU3", verdict: "UNBUILDABLE", reason: "Jacobi row and column rotations inside one k loop — the eigensolver home (no member); the class tie stands" },
  { key: "b17#1", prototype: "MU3", verdict: "UNBUILDABLE", reason: "dedup of degenerate eigenvector clusters — eigensolver post-processing (no member); the class tie stands" },
  { key: "b17#3", prototype: "MU3", verdict: "UNBUILDABLE", reason: "the kron chain seeded with eye unconditionally — the compiler's reduction-chain seed convention; the family's embedWorld carries a fixed chain, no seed parameter; the class tie stands" },
  { key: "b17#5", prototype: "MU3", verdict: "UNBUILDABLE", reason: "comparison target kron(I, chain) — a test-construction convention, not a family composition; the class tie stands" },
  { key: "b18#2", prototype: "MU3", verdict: "UNBUILDABLE", reason: "agent i excluded with a square bijection kept — mechanism-design index algebra; the class tie stands" },
  { key: "b18#3", prototype: "MU3", verdict: "UNBUILDABLE", reason: "injections enumerated in ascending index order — combinatorial enumeration design; the class tie stands" },
  { key: "b20#1", prototype: "MU3", verdict: "UNBUILDABLE", reason: "the B(x)env unitary applied on the 4-dim A(x)B space — a channel-application dimension the family's fixed compositions do not parameterize; the class tie stands" },
  { key: "b23#1", prototype: "MU3", verdict: "UNBUILDABLE", reason: "the wrong-dims expression, void-ed leftover and invalid hex literal in a sub-check — residue in readout-wall's own check code; the class tie stands" },
  { key: "b24#1", prototype: "MU6", verdict: "UNBUILDABLE", reason: "hand-filled constant state matrices (SINGLET/PHI_PLUS) with misplaced flat indices — the family's state builder is parametric (vecToRho), it carries no hand-filled constants; the class tie stands" },
  { key: "b25#0", prototype: "MU3", verdict: "UNBUILDABLE", reason: "a 20-step program run without accounting the register (each choose adds a control qubit) — interpreter-layer dimension accounting; the class tie stands" },
  { key: "b25#3", prototype: "MU3", verdict: "UNBUILDABLE", reason: "the 2x2 control marginal tensored against the 4x4 pair projector — choice-lang's decomposition algebra; the family's embedWorld has one fixed decomposition; the class tie stands" },
  { key: "b27#2", prototype: "MU3", verdict: "UNBUILDABLE", reason: "the right-walker transition encoded as K-1-(n+1) instead of 3(n+1) — a TM-encoding constant; the class tie stands" },
  { key: "b28#0", prototype: "MU3", verdict: "UNBUILDABLE", reason: "the statevector allocated with dim entries but indexed as the [real|imag] split layout — a buffer-layout convention; the class tie stands" },
  { key: "b28#1", prototype: "MU3", verdict: "UNBUILDABLE", reason: "coupling coefficients read from empty rows without a fallback — data-loading robustness, no family member loads data; the class tie stands" },
  { key: "b36#9", prototype: "MU3", verdict: "UNBUILDABLE", reason: "sitePauli seeded with the Pauli itself and n factors prepended — every site operator 2^(n+1)-dimensional; a loop-seed convention in dtc-clock's operator builder; the class tie stands" },
  // ---- the statistics pilot (v0.13.0, 25/25) — verdicts from the live census run ----
  { key: "b31#5", prototype: "MU8", verdict: "COLLAPSES", onto: "MU8", built: "the MC censused 'ever left within K steps' while the closed form priced 'outside at step K' — MU8's own corruption (its history cites THIS very error), bit-exact" },
  { key: "b19#3", prototype: "MU9", verdict: "COLLAPSES", onto: "MU9", built: "the MC conditional frequency divided by the TOTAL sample count — MU9's own corruption (its history cites THIS very error), bit-exact" },
  { key: "b5#2", prototype: "MU9", verdict: "EQUIVALENT", built: "postselectedFreq's ratio left unguarded at a vanishing accepted count — 0/0 accepted as Infinity and flows onward", reason: "PROVEN equivalent on the battery's inputs: the accepted count per run is Binomial(trials, 0.3) with trials >= 60, so P(zero accepted) <= 0.7^60 ~ 5e-10 — the degenerate branch the defect lives on is never exercised, and on every exercised input the construction is the CORRECT estimator (est -> exact). The battery is blind to the degenerate face by input coverage — the JIA11 phenomenon's degenerate-input species, specimen #2, measured with a probability bound rather than asserted" },
  { key: "b3#4", prototype: "MU8", verdict: "UNBUILDABLE", reason: "'p=0 gives <C> exactly 0' — a limit-case claim about an external objective; the class tie stands" },
  { key: "b5#0", prototype: "MU9", verdict: "UNBUILDABLE", reason: "SSE stationary weights without slot combinatorics — statistical-mechanics weight algebra, no family member; the class tie stands" },
  { key: "b5#4", prototype: "MU9", verdict: "UNBUILDABLE", reason: "'square the matrix and take the trace' for Trotter Z — a partition-function identity; the class tie stands" },
  { key: "b5#5", prototype: "MU9", verdict: "UNBUILDABLE", reason: "a fixed block width giving honest MC error bars — blockwise-error design; the family's MC members have fixed event definitions, no block structure; the class tie stands" },
  { key: "b9#2", prototype: "MU8", verdict: "UNBUILDABLE", reason: "the inverse-iteration shift eps = gap/2 splitting clusters — eigensolver numerics (no member, the recorded limitation); the class tie stands" },
  { key: "b9#4", prototype: "MU8", verdict: "UNBUILDABLE", reason: "'detection rate is detection rate' — a definitional-claim object; the class tie stands" },
  { key: "b10#5", prototype: "MU8", verdict: "UNBUILDABLE", reason: "projected gradient descent terminating on the sphere — an optimizer claim; no family member descends; the class tie stands" },
  { key: "b11#3", prototype: "MU8", verdict: "UNBUILDABLE", reason: "first-passage time under a single threshold measuring detection — an event-definition claim about a walk the family does not carry; the class tie stands" },
  { key: "b11#4", prototype: "MU9", verdict: "UNBUILDABLE", reason: "the mean over 20 seeds reported — an estimator-selection claim; the class tie stands" },
  { key: "b11#8", prototype: "MU8", verdict: "UNBUILDABLE", reason: "'the separation margin is physics' — a claim about an external quantity; the class tie stands" },
  { key: "b12#3", prototype: "MU8", verdict: "UNBUILDABLE", reason: "BBHT at ~35*sqrt(N) called close enough — a complexity-constant approximation; the class tie stands" },
  { key: "b14#3", prototype: "MU8", verdict: "UNBUILDABLE", reason: "the tolerance pinned at 1e-16 — tolerance calibration in check code (the b36#13 class); the class tie stands" },
  { key: "b16#1", prototype: "MU9", verdict: "UNBUILDABLE", reason: "Pauli triples sampled with rng.int(3) x 3 — a sampler design inside the battery's own property; the class tie stands" },
  { key: "b16#2", prototype: "MU8", verdict: "UNBUILDABLE", reason: "a 1e-16 tolerance bounding the sqrt amplification — tolerance-vs-amplification calibration in check code; the class tie stands" },
  { key: "b18#5", prototype: "MU8", verdict: "UNBUILDABLE", reason: "a 1e-15 guard called 'strictly better' — guard-calibration claim; the class tie stands" },
  { key: "b19#4", prototype: "MU8", verdict: "UNBUILDABLE", reason: "marked sets sampled with possible repeats — set-sampling design in postselect-sched's experiment code; the class tie stands" },
  { key: "b25#5", prototype: "MU8", verdict: "UNBUILDABLE", reason: "the rounding floor quoted from the probe's seeds for a witness using different seeds — a seed-transfer claim inside battery-internal sampling; the class tie stands" },
  { key: "b27#1", prototype: "MU9", verdict: "UNBUILDABLE", reason: "the universe count as 4*(n+1)^(2n) — a combinatorial count formula; the class tie stands" },
  { key: "b29#1", prototype: "MU8", verdict: "UNBUILDABLE", reason: "E[T] refereed by a plain truncated loop — an estimator design for an expectation referee; the class tie stands" },
  { key: "b30#3", prototype: "MU9", verdict: "UNBUILDABLE", reason: "the Procrustean fail branch normalized unguarded at l_min = 1/2 — the degenerate-normalization class's home is ent-clearing's map; the family layer already carries the b5#2 specimen of the unguarded-ratio shape; the class tie stands" },
  { key: "b32#3", prototype: "MU8", verdict: "UNBUILDABLE", reason: "the CNOT control required to move B's marginal by strictly MORE than 0.5 — a control-threshold convention inside P10's own construction; the class tie stands" },
  { key: "b32#4", prototype: "MU8", verdict: "UNBUILDABLE", reason: "P6's leakage loop advancing one shared state cumulatively — property-internal loop design; the class tie stands" },
];

function mAddRaw(a: CMat, b: CMat): CMat {
  const out = mat(a.rows, a.cols);
  for (let k = 0; k < a.re.length; k++) {
    out.re[k] = a.re[k]! + b.re[k]!;
    out.im[k] = a.im[k]! + b.im[k]!;
  }
  return out;
}

/** The per-error constructions, machine-verified before the table was written
 * (the scratch census): each is the faithful family-level re-enactment of that
 * error's own defect text. The builder's case list is the ground truth of
 * buildability — a row declared buildable that has no case refuses, live (J2). */
export function perErrorFamily(key: string, base: Family = canonicalFamily()): Family {
  const p1 = mat(2, 2);
  p1.re[3] = 1; // |1><1|
  switch (key) {
    case "b10#4": // the closed-form element conjugates the wrong side
      return {
        ...base,
        outer: (a, b) => {
          const o = mat(a.n, b.n);
          for (let i = 0; i < a.n; i++)
            for (let j = 0; j < b.n; j++) {
              o.re[i * b.n + j] = a.re[i]! * b.re[j]! - a.im[i]! * b.im[j]!;
              o.im[i * b.n + j] = a.re[i]! * b.im[j]! + a.im[i]! * b.re[j]!;
            }
          return o;
        },
      };
    case "b13#0": // a spurious 1/sqrt(2) baked into the embedding
      return { ...base, embedWorld: (cargo) => mScale(kron(p1, cargo), Math.SQRT1_2) };
    case "b13#4": // a law Kraus carries a spurious amplitude
      return {
        ...base,
        applyLaw: (rho) => {
          const [k0, k1] = lawKraus(GAMMA);
          return coreApplyKraus(rho, [k0!, mScale(k1!, 0.5)]);
        },
      };
    case "b15#2": // the composite without its normalization
      return {
        ...base,
        conditionalOn: (rho, digit) => {
          const cond = filterBasisDigit(rho, [2, 2], 0, digit).conditional;
          let bt = 0;
          for (let a = 0; a < 2; a++) bt += rho.re[(2 * digit + a) * 4 + (2 * digit + a)]!;
          return mScale(cond, bt);
        },
      };
    case "b16#0": // the adjoint forgotten in the channel
      return {
        ...base,
        applyKraus: (rho, kraus) => {
          let out = mat(rho.rows, rho.cols);
          for (const k of kraus) out = mAddRaw(out, mMul(mMul(k, rho), k));
          return out;
        },
      };
    case "b20#0": // vecToRho conjugate on the wrong side (MU2's own corruption)
      return {
        ...base,
        vecToRho: (v) => {
          const m = mat(v.n, v.n);
          for (let i = 0; i < v.n; i++)
            for (let j = 0; j < v.n; j++) {
              m.re[i * v.n + j] = v.re[i]! * v.re[j]! + v.im[i]! * v.im[j]!;
              m.im[i * v.n + j] = -(v.im[i]! * v.re[j]! - v.re[i]! * v.im[j]!);
            }
          return m;
        },
      };
    case "b26#0":
    case "b28#2": // the complex product's real part truncated
      return {
        ...base,
        vInner: (a, b) => {
          let re = 0;
          let im = 0;
          for (let i = 0; i < a.n; i++) {
            re += a.re[i]! * b.re[i]!;
            im += a.re[i]! * b.im[i]! - a.im[i]! * b.re[i]!;
          }
          return { re, im };
        },
      };
    case "b29#0": // vInner's imaginary sign flipped (MU1's own corruption)
      return { ...base, vInner: (a, b) => { const r = coreVInner(a, b); return { re: r.re, im: -r.im }; } };
    case "b30#0": // the globally-negated ket handed to the state builder
      return { ...base, vecToRho: (v) => coreVecToRho(vScale(v, -1)) };
    // ---- the wrong-object pilots (v0.12.0) ----
    case "b21#0": // conditionalData normalized by the joint element — MU5's own history
      return {
        ...base,
        conditionalOn: (rho, digit) => {
          const { conditional } = filterBasisDigit(rho, [2, 2], 0, digit);
          const joint = rho.re[digit * 4 + 0]!; // joint element world=digit AND data=0 — the wrong denominator
          const out = mat(4, 4);
          for (let k = 0; k < out.re.length; k++) {
            out.re[k] = conditional.re[k]! / joint;
            out.im[k] = conditional.im[k]! / joint;
          }
          return out;
        },
      };
    case "b31#3": // the limit as the dephased twin — MU7's own history
      return {
        ...base,
        limitObject: (rho) => {
          const out = mat(4, 4);
          for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
              if (Math.floor(r / 2) !== Math.floor(c / 2)) continue; // dephased twin: cross-block cells die
              out.re[r * 4 + c] = rho.re[r * 4 + c]!;
              out.im[r * 4 + c] = rho.im[r * 4 + c]!;
            }
          }
          return out;
        },
      };
    case "b24#2": // the order-bit readout reads JOINT cells as the probabilities
      return { ...base, measureWorldQubit: (rho) => [rho.re[0 * 4 + 0]!, rho.re[2 * 4 + 1]!] };
    case "b15#3": // the branch marginal computed by PINNING the partner's outcome
      return {
        ...base,
        measureWorldQubit: (rho) => {
          const pd0 = rho.re[0]! + rho.re[2]!; // P(data=0) — the pinned branch's mass
          return [rho.re[0 * 4 + 0]! / pd0, rho.re[2 * 4 + 0]! / pd0];
        },
      };
    case "b14#2": // the axis measurement as a unitary application
      return {
        ...base,
        measureWorldQubit: (rho) => {
          const sx = mat(2, 2);
          sx.re[0 * 2 + 1] = 1;
          sx.re[1 * 2 + 0] = 1;
          const rot = coreApplyKraus(rho, [kron(sx, identity(2))]); // sigma_a (x) I APPLIED, not measured
          return [rot.re[0]! + rot.re[1]!, rot.re[2]! + rot.re[3]!];
        },
      };
    // ---- the dimension-slot pilots (v0.13.0) ----
    case "b24#0": // the bare 2x2 projector straight at the 4x4 state — MU4's own history
      return {
        ...base,
        measureWorldQubit: (rho) => {
          const m = mMul(p1, rho); // no (x)I: 2x2 against 4x4 — the shape guard refuses
          return [1 - m.re[0]!, m.re[0]!] as [number, number];
        },
      };
    case "b31#0": // the |1><0| Kraus element at flat index 1 — MU6's own history
      return {
        ...base,
        applyLaw: (rho) => {
          const k0w = mat(2, 2);
          k0w.re[0 * 2 + 0] = Math.sqrt(1 - GAMMA);
          k0w.re[1 * 2 + 1] = 1;
          const k1w = mat(2, 2);
          k1w.re[0 * 2 + 1] = Math.sqrt(GAMMA); // flat index 1 is element (0,1) — damping flows outward
          return coreApplyKraus(rho, [kron(k0w, identity(2)), kron(k1w, identity(2))]);
        },
      };
    case "b31#4": // the 4x4 full state embedded as if it were the 2x2 cargo — MU3's own history
      return { ...base, embedWorld: (cargo) => kron(p1, kron(identity(2), cargo)) };
    case "b13#2": // I (x) U written as a product
      return { ...base, embedWorld: (cargo) => mMul(p1, cargo) };
    case "b31#1": // scaling a 4x4 by MULTIPLYING it with a 1x1 scalar matrix
      return {
        ...base,
        conditionalOn: (rho, digit) => {
          const cond = filterBasisDigit(rho, [2, 2], 0, digit).conditional;
          let bt = 0;
          for (let a = 0; a < 2; a++) bt += rho.re[(2 * digit + a) * 4 + (2 * digit + a)]!;
          const scalar = mat(1, 1);
          scalar.re[0] = 1 / bt;
          return mMul(scalar, cond); // mScale is the sanctioned route; the shape guard refuses this one
        },
      };
    // ---- the statistics pilots (v0.13.0) ----
    case "b31#5": // 'ever left within K' vs 'outside AT K' — MU8's own history
      return {
        ...base,
        mcOutsideAtK: (rng, trials, K, r) => {
          let everOut = 0;
          for (let t = 0; t < trials; t++) {
            let inWorld = true;
            let left = false;
            for (let k = 0; k < K; k++) {
              inWorld = inWorld ? rng() >= r : rng() < GAMMA;
              if (!inWorld) left = true;
            }
            if (left) everOut++;
          }
          return everOut / trials;
        },
      };
    case "b19#3": // the conditional frequency over the TOTAL count — MU9's own history
      return {
        ...base,
        postselectedFreq: (rng, trials) => {
          let x1 = 0;
          for (let t = 0; t < trials; t++) {
            if (rng() < 0.3 && rng() < 0.6) x1++;
          }
          return { est: x1 / trials, exact: 0.6 };
        },
      };
    case "b5#2": // the unguarded ratio at a vanishing denominator
      return {
        ...base,
        postselectedFreq: (rng, trials) => {
          let x1 = 0;
          let accepted = 0;
          for (let t = 0; t < trials; t++) {
            const a = rng() < 0.3;
            const b = rng() < 0.6;
            if (a) accepted++;
            if (a && b) x1++;
          }
          return { est: x1 / accepted, exact: 0.6 }; // 0/0 = Infinity when nothing accepted — accepted as-is
        },
      };
    default:
      throw new Error(`no per-error construction for ${key} — the row is UNBUILDABLE or unknown`);
  }
}

/** The battery fingerprint: (pass, worst) per property, compared bit-exactly.
 * This is the decidable relation the J-board stands on — NOT program
 * equivalence, which is the open problem; battery-indistinguishability only. */
export interface BatteryPrint {
  readonly passing: readonly boolean[];
  readonly worst: readonly number[];
}

export function batteryPrint(f: Family): BatteryPrint {
  const props: readonly PropResult[] = runBattery(f);
  return { passing: props.map((p) => p.pass), worst: props.map((p) => p.worst) };
}

export function printsEqual(a: BatteryPrint, b: BatteryPrint): boolean {
  return a.passing.length === b.passing.length && a.passing.every((p, i) => p === b.passing[i]) && a.worst.every((w, i) => w === b.worst[i]);
}

export interface PerErrorCensusRow {
  readonly key: string;
  readonly computed: PerErrorVerdict;
  /** COLLAPSES: the prototype the construction is indistinguishable from */
  readonly onto: string;
  /** ERROR-LEVEL: the live failing properties, worst margin first */
  readonly killers: readonly string[];
  readonly worst: number;
  readonly detail: string;
}

function protoPrint(id: string): BatteryPrint {
  const spec = MUTANTS.find((m) => m.id === id) as MutantSpec;
  return batteryPrint(mutantFamily(spec));
}

/** The census: every buildable row's construction against the full battery,
 * verdicts computed live (collapse = bit-exact print equality with the row's
 * own prototype). */
export function runPerErrorCensus(specs: readonly PerErrorSpec[] = PER_ERROR): PerErrorCensusRow[] {
  const rows: PerErrorCensusRow[] = [];
  const prints = new Map<string, BatteryPrint>();
  const printOf = (id: string): BatteryPrint => {
    const cached = prints.get(id);
    if (cached !== undefined) return cached;
    const fresh = protoPrint(id);
    prints.set(id, fresh);
    return fresh;
  };
  for (const spec of specs) {
    if (spec.verdict === "UNBUILDABLE") {
      rows.push({ key: spec.key, computed: "UNBUILDABLE", onto: "", killers: [], worst: 0, detail: "no construction exists at the family layer — booked" });
      continue;
    }
    let props: readonly PropResult[];
    try {
      props = runBattery(perErrorFamily(spec.key));
    } catch (err) {
      rows.push({ key: spec.key, computed: "UNBUILDABLE", onto: "", killers: [], worst: 0, detail: `the builder refused: ${(err as Error).message}` });
      continue;
    }
    const failing = props.filter((p) => !p.pass);
    if (failing.length === 0) {
      rows.push({ key: spec.key, computed: "EQUIVALENT", onto: "", killers: [], worst: Math.max(...props.map((p) => p.worst)), detail: "SURVIVOR — nothing in the ten-property battery moves it" });
      continue;
    }
    const print: BatteryPrint = { passing: props.map((p) => p.pass), worst: props.map((p) => p.worst) };
    const onto = printsEqual(print, printOf(spec.prototype)) ? spec.prototype : "";
    if (onto !== "") {
      const worst = Math.max(...failing.map((p) => p.worst));
      rows.push({ key: spec.key, computed: "COLLAPSES", onto, killers: [], worst, detail: `bit-exact with ${onto} on all ten properties — the class tie is the fixed point` });
    } else {
      const killers = [...failing].sort((a, b) => b.worst - a.worst).map((p) => p.id);
      const worst = Math.max(...failing.map((p) => p.worst));
      rows.push({ key: spec.key, computed: "ERROR-LEVEL", onto: "", killers, worst, detail: `distinct construction, killed live by ${killers.join(", ")} (worst ${worst > 1e6 ? worst.toFixed(0) : worst.toExponential(1)})` });
    }
  }
  return rows;
}

export interface JViolation {
  readonly row: string;
  readonly law: string;
  readonly detail: string;
}

/** J1-J3 over the table, the live census and the live enrollment. */
export function checkEquivalence(
  specs: readonly PerErrorSpec[],
  census: readonly PerErrorCensusRow[],
  enrollment: readonly EnrollmentRow[] = ENROLLMENT,
): JViolation[] {
  const v: JViolation[] = [];
  const pilotRows = enrollment.filter((r) => PILOT_CLASSES.includes(r.category) && r.tier === "MUTANT-KILLED");
  const pilotKeys = new Set(pilotRows.map((r) => r.key));
  const classByKey = new Map(pilotRows.map((r) => [r.key, r.category] as const));
  const anchorByKey = new Map(pilotRows.map((r) => [r.key, r.anchor] as const));
  const seen = new Set<string>();
  for (const spec of specs) {
    if (!VERDICTS.includes(spec.verdict)) {
      v.push({ row: spec.key, law: "J1", detail: `illegal verdict "${spec.verdict}" — the vocabulary is closed` });
      continue;
    }
    if (seen.has(spec.key)) {
      v.push({ row: spec.key, law: "J1", detail: "duplicate key" });
      continue;
    }
    seen.add(spec.key);
    if (!pilotKeys.has(spec.key)) {
      v.push({ row: spec.key, law: "J1", detail: "not a MUTANT-KILLED row of the pilot class — the census is exhaustive over exactly those" });
      continue;
    }
    const anchor = anchorByKey.get(spec.key)!;
    if (spec.prototype !== anchor) {
      v.push({ row: spec.key, law: "J1", detail: `prototype re-labeled "${spec.prototype}" — the enrollment's own anchor is "${anchor}"` });
    }
    const live = census.find((c) => c.key === spec.key);
    if (!live) {
      v.push({ row: spec.key, law: "J2", detail: "no live census row — the verdict cannot be verified" });
      continue;
    }
    if (live.computed !== spec.verdict) {
      v.push({ row: spec.key, law: "J2", detail: `declared ${spec.verdict} but the live census says ${live.computed} (${live.detail})` });
      continue;
    }
    if (spec.verdict === "ERROR-LEVEL" && (spec.killer === undefined || !live.killers.includes(spec.killer))) {
      v.push({ row: spec.key, law: "J2", detail: `declared killer "${spec.killer ?? ""}" does not fail live — the killers are ${live.killers.join(", ")}` });
    }
    if (spec.verdict === "COLLAPSES" && spec.onto !== live.onto) {
      v.push({ row: spec.key, law: "J2", detail: `declared collapse onto "${spec.onto ?? ""}" but the bit-exact print matches "${live.onto}"` });
    }
    if ((spec.verdict === "EQUIVALENT" || spec.verdict === "UNBUILDABLE") && (spec.reason ?? "").trim() === "") {
      v.push({ row: spec.key, law: "J3", detail: `${spec.verdict} without a reason — the boundary must say why, on the record` });
    }
    if ((spec.verdict === "COLLAPSES" || spec.verdict === "ERROR-LEVEL") && (spec.built ?? "").trim() === "") {
      v.push({ row: spec.key, law: "J3", detail: "a buildable row without its construction line — the re-enactment must be reviewable data" });
    }
  }
  for (const key of pilotKeys) {
    if (!seen.has(key)) {
      v.push({ row: key, law: "J1", detail: `a ${classByKey.get(key)} MUTANT-KILLED row missing from the per-error census — a pilot class is exhaustive or it is nothing` });
    }
  }
  return v;
}

export interface WitnessResultShape {
  readonly name: string;
  readonly pass: boolean;
  readonly detail: string;
}

/** W-I — the per-error equivalence census, live. */
export function witnessEquivalence(specs: readonly PerErrorSpec[] = PER_ERROR): {
  result: WitnessResultShape;
  rows: readonly PerErrorCensusRow[];
  violations: readonly JViolation[];
} {
  const census = runPerErrorCensus(specs);
  const violations = checkEquivalence(specs, census);
  const tally = new Map<string, number>();
  for (const c of census) tally.set(c.computed, (tally.get(c.computed) ?? 0) + 1);
  const detail =
    violations.length > 0
      ? `${violations.length} violation(s): ${violations.slice(0, 4).map((x) => `${x.row} [${x.law}]`).join("; ")}`
      : `${census.length} rows censused PER ERROR across ${PILOT_CLASSES.length} pilot classes (${PILOT_CLASSES.join(", ")}): ${tally.get("COLLAPSES") ?? 0} collapses (bit-exact with their prototypes), ${tally.get("ERROR-LEVEL") ?? 0} error-level kills (distinct constructions, killed live), ${tally.get("EQUIVALENT") ?? 0} equivalent survivor(s) (booked with proofs), ${tally.get("UNBUILDABLE") ?? 0} unbuildable (the defect's home is not a family member) — battery-indistinguishability decided on all ten properties (${PROPERTY_IDS.length})`;
  return {
    result: { name: "W-I per-error equivalence census", pass: violations.length === 0, detail },
    rows: census,
    violations,
  };
}
