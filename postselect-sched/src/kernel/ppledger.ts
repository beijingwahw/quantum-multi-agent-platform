/**
 * T5 kernel — the two-column ledger for counting power.
 *
 * The countersigned sentence: "power and depreciation are two columns of one
 * ledger — your report printed only one column." This kernel prints both.
 *
 * The machine: a random 3-SAT instance phi, postselection flag g =
 * "x satisfies phi", readout h = "x_0 = 1". One branch sample answers the
 * conditional-threshold question "among the models of phi, do more than half
 * set x_0 = 1?" with error exactly 1/2 - gap, gap = |P(h=1|g=1) - 1/2| — a
 * PP-style decision read at the amplitude level (the PostBQP = PP face).
 *
 * The second column: k independent branch samples, majority vote. Hoeffding
 * gives error <= exp(-2 k gap^2); k(delta) = smallest odd k meeting delta.
 * Each branch sample costs 1/P_success = N/m expected queries (the sorter's
 * ledger), so the TOTAL depreciation of deciding at confidence 1-delta is
 * k(delta) * N/m — the exchange rate of postselected counting power, exact.
 */
import { KernelError } from "./errors.js";
import { Rng, runPayload } from "./sorter.js";

export interface SatInstance {
  readonly n: number;
  /** each clause: three signed literals, literal = +/-var (0-based) */
  readonly clauses: ReadonlyArray<readonly [number, number, number]>;
}

export function satisfies(inst: SatInstance, x: number): boolean {
  for (const c of inst.clauses) {
    const a = c[0] < 0 ? ((x >> (-c[0] - 1)) & 1) === 0 : ((x >> (c[0] - 1)) & 1) === 1;
    if (a) continue;
    const b = c[1] < 0 ? ((x >> (-c[1] - 1)) & 1) === 0 : ((x >> (c[1] - 1)) & 1) === 1;
    if (b) continue;
    const d = c[2] < 0 ? ((x >> (-c[2] - 1)) & 1) === 0 : ((x >> (c[2] - 1)) & 1) === 1;
    if (d) continue;
    return false;
  }
  return true;
}

/** random 3-SAT over vars 0..n-1 (skipVar: a variable forced absent — the tie construction) */
export function randomSat(n: number, numClauses: number, seed: number, skipVar = -1): SatInstance {
  if (!Number.isInteger(n) || n < 1) throw new KernelError("BAD-VAR-COUNT", `randomSat: n must be a positive integer (got ${n})`);
  if (!Number.isInteger(numClauses) || numClauses < 0) throw new KernelError("BAD-CLAUSE-COUNT", `randomSat: numClauses must be a non-negative integer (got ${numClauses})`);
  // v0.3.0 hang conviction: with fewer than 3 available variables the clause
  // loop `while (vars.size < 3)` can never terminate — randomSat(2, ...) used
  // to spin forever instead of refusing. Named refusal now.
  const availableVars = n - (skipVar >= 0 && skipVar < n ? 1 : 0);
  if (availableVars < 3) throw new KernelError("INSUFFICIENT-VARIABLES", `randomSat: 3-SAT needs >= 3 distinct variables, but only ${availableVars} are available (n=${n}, skipVar=${skipVar})`);
  const rng = new Rng(seed);
  const clauses: Array<[number, number, number]> = [];
  while (clauses.length < numClauses) {
    const vars = new Set<number>();
    while (vars.size < 3) {
      const v = Math.floor(rng.next() * n);
      if (v !== skipVar) vars.add(v);
    }
    const [a, b, c] = [...vars];
    const lit = (v: number): number => (rng.next() < 0.5 ? v + 1 : -(v + 1));
    clauses.push([lit(a as number), lit(b as number), lit(c as number)]);
  }
  return { n, clauses };
}

export function modelsOf(inst: SatInstance): number[] {
  const out: number[] = [];
  for (let x = 0; x < 2 ** inst.n; x++) if (satisfies(inst, x)) out.push(x);
  return out;
}

export type Decision = "h-majority" | "h-minority" | "tie";

export interface PowerLedgerRow {
  readonly n: number;
  readonly N: number;
  /** number of models m = |{g}| */
  readonly m: number;
  /** models with x_0 = 1 */
  readonly both: number;
  /** P(h=1 | flag=1) via the amplitude path */
  readonly ratio: number;
  /** integer referee ratio */
  readonly brute: number;
  readonly deviation: number;
  readonly gap: number;
  readonly decision: Decision;
  /** single-shot majority-vote error = 1/2 - gap (exactly 1/2 on ties) */
  readonly singleShotError: number;
}

export function powerLedgerRow(inst: SatInstance): PowerLedgerRow {
  const n = inst.n;
  const N = 2 ** n;
  const models = modelsOf(inst);
  const m = models.length;
  if (m === 0) throw new KernelError("UNSATISFIABLE-INSTANCE", "powerLedgerRow: unsatisfiable instance");
  const payload: boolean[] = new Array<boolean>(N);
  for (let x = 0; x < N; x++) payload[x] = (x & 1) === 1;
  const run = runPayload(n, models, payload);
  const both = models.filter((x) => (x & 1) === 1).length;
  const decision: Decision = 2 * both > m ? "h-majority" : 2 * both < m ? "h-minority" : "tie";
  const gap = decision === "tie" ? 0 : Math.abs(run.branchOutcome - 0.5);
  return {
    n,
    N,
    m,
    both,
    ratio: run.branchOutcome,
    brute: run.closedForm,
    deviation: run.deviation,
    gap,
    decision,
    singleShotError: 0.5 - gap,
  };
}

/** smallest ODD k with exp(-2 k gap^2) <= delta (Infinity on exact ties) */
export function repetitionsFor(gap: number, delta: number): number {
  // v0.3.0 conviction: delta > 1 used to fall through Math.ceil of a negative
  // log and return a NEGATIVE schedule (repetitionsFor(0.1, 2) returned -33)
  // instead of refusing. delta is a confidence bound: it lives in (0,1].
  if (!(delta > 0) || delta > 1) throw new KernelError("BAD-DELTA", `repetitionsFor: delta must be in (0,1] (got ${delta})`);
  if (gap < 0) throw new KernelError("BAD-GAP", `repetitionsFor: gap must be >= 0 (got ${gap})`);
  if (gap <= 0) return Number.POSITIVE_INFINITY;
  const raw = Math.ceil(Math.log(1 / delta) / (2 * gap * gap));
  return raw % 2 === 1 ? raw : raw + 1;
}

/** total expected queries for a 1-delta-confidence decision: k * N/m */
export function depreciation(row: PowerLedgerRow, delta: number): number {
  const k = repetitionsFor(row.gap, delta);
  if (!Number.isFinite(k)) return Number.POSITIVE_INFINITY;
  return k * (row.N / row.m);
}

/** log-factorial table (shared by the exact binomial tail) */
function lnFactTable(k: number): Float64Array {
  const t = new Float64Array(k + 1);
  for (let i = 2; i <= k; i++) t[i] = t[i - 1]! + Math.log(i);
  return t;
}

/** Exact binomial tail P[Bin(k, p) <= atMost] by downward recurrence from
 *  atMost — stable because the pmf decreases to the left of the mode and
 *  p >= 1/2 puts the mode at or right of k/2. */
export function binomTailAtMost(k: number, p: number, atMost: number): number {
  // v0.3.0 conviction: p = 0 used to fall into 0 * log(0) = NaN and return
  // NaN where the tail is exactly 1 (P[Bin(k,0) <= atMost] = 1 for atMost >= 0)
  // — a silent wrong answer. p lives in (0,1]; the p = 1 endpoint is sound.
  if (!(p > 0) || p > 1) throw new KernelError("BAD-PROBABILITY", `binomTailAtMost: p must be in (0,1] (got ${p})`);
  if (!Number.isInteger(k) || k < 1) throw new KernelError("BAD-TRIAL-COUNT", `binomTailAtMost: k must be an integer >= 1 (got ${k})`);
  if (!Number.isInteger(atMost)) throw new KernelError("BAD-TAIL-INDEX", `binomTailAtMost: atMost must be an integer (got ${atMost})`);
  if (atMost < 0) return 0;
  if (atMost >= k) return 1;
  const lnF = lnFactTable(k);
  // lnF has length k+1 and 0 <= atMost < k was established above, so all reads are in-bounds
  const lnPm = lnF[k]! - lnF[atMost]! - lnF[k - atMost]! + atMost * Math.log(p) + (k - atMost) * Math.log(1 - p);
  let term = Math.exp(lnPm);
  let sum = term;
  for (let i = atMost - 1; i >= 0; i--) {
    // pmf(i) = pmf(i+1) * (i+1) / (k-i) * (1-p)/p
    term = (term * (i + 1) * (1 - p)) / ((k - i) * p);
    sum += term;
    if (term < 1e-300 && sum > 0) break;
  }
  return Math.min(1, sum);
}

export interface ExchangeEntry {
  readonly delta: number;
  readonly k: number;
  /** exact P[majority vote wrong] = P[Bin(k, 1/2+gap) <= k/2] */
  readonly tailExact: number;
  /** Hoeffding bound exp(-2 k gap^2) */
  readonly hoeffding: number;
  /** total expected queries k * N/m */
  readonly queries: number;
}

export function exchangeEntry(row: PowerLedgerRow, delta: number): ExchangeEntry {
  const k = repetitionsFor(row.gap, delta);
  if (!Number.isFinite(k)) {
    return { delta, k, tailExact: 0.5, hoeffding: 1, queries: Number.POSITIVE_INFINITY };
  }
  const tailExact = binomTailAtMost(k, 0.5 + row.gap, (k - 1) / 2);
  const hoeffding = Math.exp(-2 * k * row.gap ** 2);
  return { delta, k, tailExact, hoeffding, queries: k * (row.N / row.m) };
}
