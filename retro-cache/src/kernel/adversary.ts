/**
 * Kernel — the adversary census (W6): a bounded family of toy strategies
 * against the withdrawal, every member priced in the tariff ledger on exact
 * joint tables.
 *
 * Family (bounded by law, stated not hidden):
 *   IR(eta)   intercept-resend at tap rate eta — Eve measures her half of the
 *             pair in a random basis and resends; sifted rounds she tapped in
 *             B's eventual basis (a fraction eta/2) she knows EXACTLY.
 *   NS(nu)    noisy storage — the retro-cache twist: the settings
 *             conversation closes AFTER the quantum exchange, so Eve must
 *             carry her data across it through a BSC(nu) memory.
 *   CM(mu)    classical-channel mutation — flips on the transported settings
 *             bits at rate mu.
 * The IR model on a joint table: right-basis taps reproduce the underlying
 * Werner A–E table (Eve's relay is faithful in that basis), wrong-basis taps
 * deliver a fully depolarized table — so the attacked table is
 * (1 - eta/2) honest + (eta/2) flat, and the attacked CHSH is
 * (1 - eta/2) * 2*sqrt(2)*p. At eta = 1 every signal is mediated by Eve's
 * classical data: the column collapses into W3's census, |S| <= 2 (CHSH69's
 * line behind it, executed here by direct table computation).
 */
import { CHSH_AXES, RcError, correlationFromTable, jointTable, wernerPair, type JointTable } from "./state.js";
import { h2, qberOf } from "./tariff.js";

/** Tsirelson's 2*sqrt(2) — the single source for both W6 closed forms: the
 *  attacked-CHSH line and the census-crossing tap must ride the same
 *  constant (W6.B's |S(eta*)| = 2 self-consistency back-stops the coupling).
 *  Exactly 2 * Math.SQRT2 (a power-of-two rescale of the primitive — exact),
 *  so every expression that rides it is bit-identical to the literal form. */
const TSIRELSON = 2 * Math.SQRT2;

/** both rate/visibility parameters live on [0, 1]; anything else (including
 *  NaN) is priced nonsense and is rejected by name. */
function requireRate(name: string, code: string, v: number): void {
  if (!(v >= 0 && v <= 1)) throw new RcError(code, `${name} must lie in [0, 1] (got ${v})`);
}

/** a BSC crossover lives on [0, 1/2] by the repo convention (same as eps in
 *  amplify.ts) — beyond 1/2 it is the mirrored channel, never used here. */
function requireCrossover(name: string, code: string, v: number): void {
  if (!(v >= 0 && v <= 0.5)) throw new RcError(code, `${name} must lie in [0, 1/2] as a BSC crossover (got ${v})`);
}

/** convex mixture of a joint table with the fully depolarized table */
function mixFlat(honest: JointTable, rate: number): JointTable {
  const mix = (v: number): number => (1 - rate) * v + rate * 0.25;
  return [
    [mix(honest[0][0]), mix(honest[0][1])],
    [mix(honest[1][0]), mix(honest[1][1])],
  ];
}

/** the withdrawal joint table under an intercept-resend tap at rate eta:
 *  only the wrong-basis half of taps (eta/2) depolarizes — right-basis taps
 *  relay faithfully and reproduce the underlying table. */
function attackedTable(honest: JointTable, eta: number): JointTable {
  return mixFlat(honest, eta / 2);
}

/** QBER under attack, table path (W4 convention: QBER = P(x = y) of the raw
 * aligned table) vs closed form (1 - eta/2)(1 - p)/2 + eta/4. */
export function qberUnderAttack(p: number, eta: number): { readonly table: number; readonly closed: number } {
  requireRate("qberUnderAttack: p", "RC_P_RANGE", p);
  requireRate("qberUnderAttack: eta", "RC_ETA_RANGE", eta);
  const z = [0, 0, 1];
  const honest = jointTable(wernerPair(p), z, z);
  const t = attackedTable(honest, eta);
  return { table: t[0][0] + t[1][1], closed: (1 - eta / 2) * qberOf(p) + eta / 4 };
}

/** CHSH of the attacked channel at the standard axes, table path vs the
 *  closed form -(1 - eta/2) * 2*sqrt(2)*p (the standard-axes S of the
 *  singlet family is negative; the cap statement uses |S|). */
export function chshUnderAttack(p: number, eta: number): { readonly table: number; readonly closed: number } {
  requireRate("chshUnderAttack: p", "RC_P_RANGE", p);
  requireRate("chshUnderAttack: eta", "RC_ETA_RANGE", eta);
  const rho = wernerPair(p);
  const [a0, a1, b0, b1] = CHSH_AXES;
  const e = (a: readonly number[], b: readonly number[]): number =>
    correlationFromTable(attackedTable(jointTable(rho, a, b), eta));
  const table = e(a0, b0) + e(a0, b1) + e(a1, b0) - e(a1, b1);
  return { table, closed: -(1 - eta / 2) * TSIRELSON * p };
}

/** Eve's per-sifted-bit information under IR(eta): the eta/2 right-basis
 *  fraction is known exactly, the rest is worth 0 bits. */
function eveInfoInterceptResend(eta: number): number {
  return eta / 2;
}

/** NS(nu) on top of IR(eta): each known bit survives Eve's noisy storage as
 *  a BSC(nu) copy, worth 1 - h2(nu) bits. Endpoints: nu = 0 full retention,
 *  nu = 1/2 storage wiped. */
export function eveInfoNoisyStorage(eta: number, nu: number): number {
  requireRate("eveInfoNoisyStorage: eta", "RC_ETA_RANGE", eta);
  requireCrossover("eveInfoNoisyStorage: nu", "RC_NU_RANGE", nu);
  return (eta / 2) * (1 - h2(nu));
}

export interface MutationRow {
  readonly p: number;
  readonly mu: number;
  /** QBER after mutation: kept rounds that were actually cross-basis are fair
   *  coins — q_eff = (1 - mu) q + mu/2, table path vs closed. */
  readonly qberTable: number;
  readonly qberClosed: number;
  /** extra reconciliation tax the mutation costs the ledger */
  readonly extraTax: number;
  /** what the mutator learns about key bits from the settings column: W2's
   *  zero-information face — the question never carries the answer. */
  readonly adversaryGain: 0;
}

export function settingsMutationRow(p: number, mu: number): MutationRow {
  requireRate("settingsMutationRow: p", "RC_P_RANGE", p);
  requireRate("settingsMutationRow: mu", "RC_MU_RANGE", mu);
  const z = [0, 0, 1];
  const honest = jointTable(wernerPair(p), z, z);
  const t = mixFlat(honest, mu); // a mutated round keeps a cross-basis pair: flat table
  const q = qberOf(p);
  const qEff = (1 - mu) * q + mu / 2;
  return {
    p,
    mu,
    qberTable: t[0][0] + t[1][1],
    qberClosed: qEff,
    extraTax: h2(qEff) - h2(q),
    adversaryGain: 0,
  };
}

/** tariff ledger row for one intercept-resend member */
export interface AttackRow {
  readonly p: number;
  readonly eta: number;
  readonly qber: number;
  readonly chsh: number;
  /** the classical census cap (CHSH69, W3's 256-strategy census) */
  readonly censusCap: 2;
  readonly belowCensusCap: boolean;
  readonly eveInfo: number;
  /** per sifted bit: 1 - h2(q_eff) - I_E — the pre-amplification ledger */
  readonly netPrePA: number;
  readonly verdict: "proceed" | "abort";
}

export function interceptResendRow(p: number, eta: number): AttackRow {
  requireRate("interceptResendRow: p", "RC_P_RANGE", p);
  requireRate("interceptResendRow: eta", "RC_ETA_RANGE", eta);
  const q = qberUnderAttack(p, eta);
  const s = chshUnderAttack(p, eta);
  const eveInfo = eveInfoInterceptResend(eta);
  const net = 1 - h2(q.closed) - eveInfo;
  return {
    p,
    eta,
    qber: q.closed,
    chsh: s.closed,
    censusCap: 2,
    belowCensusCap: Math.abs(s.closed) <= 2 + 1e-12,
    eveInfo,
    netPrePA: net,
    verdict: net > 0 ? "proceed" : "abort",
  };
}

/** the tap rate at which the attacked CHSH sinks below the classical census
 *  cap 2 (the adversary depreciates the joint surplus past the shared-seed
 *  price): (1 - eta/2) * 2*sqrt(2)*p = 2 gives eta* = 2 - sqrt(2)/p, defined
 *  for p > 1/sqrt(2); below that visibility the surplus already starts under
 *  the cap and no tap is needed. */
export function censusCrossingTap(p: number): number | null {
  if (!(p > 0 && p <= 1)) throw new RcError("RC_P_RANGE", `censusCrossingTap: visibility p must lie in (0, 1] (got ${p})`);
  if (TSIRELSON * p <= 2) return null;
  return 2 - Math.SQRT2 / p;
}
