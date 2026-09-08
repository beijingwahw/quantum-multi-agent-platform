/**
 * The conservation ledger — the catalyst census. Across the settlement ops
 * (teleport burn, dense-code return, Procrustean netting, BBPSSW
 * purification, GHZ withdrawal) the machine measures what is conserved
 * EXACTLY: each row is an exact identity (the catalyst's E_F), an exact
 * counterexample (the fuel's E_F, burned), or an exact never-rises (VIDAL00
 * instantiated). The checker (law H7) recomputes every delta from the
 * machinery; a fake conservation identity does not survive recomputation.
 */
import { PLUS, vecToRho } from "../core/states.js";
import { makeRng } from "../core/rng.js";
import {
  PHI_PLUS,
  concurrence,
  denseCode,
  eF,
  netWeakCoin,
  randomLocalKraus,
  redeem,
} from "./clearing.js";
import { purifyRound, wernerCoin } from "./purify.js";
import { ghzCoin, ghzCutNegativities, ghzLocalCensus, withdrawToAB } from "./ghz.js";
import { applyKraus } from "../core/channels.js";
import { identity, kron, type CMat } from "../core/cmat.js";
import type { Rng } from "../core/rng.js";

export type LedgerClaim = "CONSERVED" | "NOT-CONSERVED" | "NEVER-RISES";

export interface LedgerSpec {
  readonly id: string;
  readonly op: string;
  readonly resource: string;
  readonly claim: LedgerClaim;
  readonly note: string;
}

export interface LedgerEntry extends LedgerSpec {
  readonly before: number;
  readonly after: number;
}

/** The ledger's canonical Procrustean grade. */
export const LEDGER_LMIN = 0.25;
/** The ledger's canonical Werner grade for the purification rows. */
export const LEDGER_F = 0.85;
/** The census depth for the GHZ local-channel row. */
export const LEDGER_CENSUS_ROUNDS = 150;

export const LEDGER_SPECS: readonly LedgerSpec[] = [
  { id: "L1", op: "redeem (E1)", resource: "coin pairwise concurrence", claim: "NOT-CONSERVED", note: "the settlement event burns the pair: 1 -> 0 exactly" },
  { id: "L2", op: "redeem (E1)", resource: "coin E_F", claim: "NOT-CONSERVED", note: "fuel, not catalyst: delta exactly -1" },
  { id: "L3", op: "redeem (E1)", resource: "cbits on the wire", claim: "NOT-CONSERVED", note: "created: the classical leg carries exactly 2 (the Bell-outcome key)" },
  { id: "L4", op: "dense code (E2)", resource: "coin E_F", claim: "CONSERVED", note: "the catalyst identity: returned as a known Bell, E_F 1 -> 1 exactly" },
  { id: "L5", op: "dense code (E2)", resource: "cbits delivered", claim: "NOT-CONSERVED", note: "created: exactly 2 bits of mutual information" },
  { id: "L6", op: "net weak coin (E4, l_min=1/4)", resource: "expected coin E_F", claim: "NEVER-RISES", note: "h2 of the weak grade in, 2*l_min = 1/2 expected out — the filter's toll" },
  { id: "L7", op: "net weak coin (E4, l_min=1/4)", resource: "expected coins", claim: "NOT-CONSERVED", note: "1 -> 2*l_min = 1/2 in expectation" },
  { id: "L8", op: "net weak coin (E4)", resource: "cbits on the wire", claim: "NOT-CONSERVED", note: "created: 1 bit announcing the filter's verdict" },
  { id: "L9", op: "purify round (2 Werner coins, F=0.85)", resource: "expected total E_F", claim: "NEVER-RISES", note: "branch-averaged E_F over keep and discard: the VIDAL00 toll, instantiated" },
  { id: "L10", op: "purify round (2 Werner coins, F=0.85)", resource: "expected coins", claim: "NOT-CONSERVED", note: "2 -> p_succ exactly; the sacrifice pair is measured away" },
  { id: "L11", op: "purify round", resource: "cbits on the wire", claim: "NOT-CONSERVED", note: "created: 2 bits comparing the bilateral measurements (the twirl's coordination adds a bounded constant)" },
  { id: "L12", op: "GHZ withdrawal (E9)", resource: "pairwise concurrence on AB", claim: "NOT-CONSERVED", note: "the refuted wall: 0 -> 1 exactly — a standard coin MOVED onto the AB ledger" },
  { id: "L13", op: "GHZ withdrawal (E9)", resource: "negativity across AB|C", claim: "NEVER-RISES", note: "1/2 -> 0 exactly: the joint holding across this cut is settled and closed" },
  { id: "L14", op: "GHZ withdrawal (E9)", resource: "negativity across A|BC", claim: "CONSERVED", note: "1/2 -> 1/2 exactly, both branches" },
  { id: "L15", op: "GHZ withdrawal (E9)", resource: "negativity across B|AC", claim: "CONSERVED", note: "1/2 -> 1/2 exactly, both branches" },
  { id: "L16", op: "GHZ local-channel census (150 rounds)", resource: "max cut negativity (3 cuts)", claim: "NEVER-RISES", note: "random local channels on all three parties never raise any cut (VW02, cited)" },
];

/** Apply an independent random local channel to every party of a 3-qubit state. */
export function randomTripartiteLocalRound(rng: Rng, rho: CMat): CMat {
  let acc = rho;
  for (let party = 0; party < 3; party++) {
    const kraus = randomLocalKraus(rng);
    const embedded = kraus.map((k) => {
      const parts: CMat[] = [];
      for (let j = 0; j < 3; j++) parts.push(j === party ? k : identity(2));
      return parts.reduce((a, b) => kron(a, b));
    });
    acc = applyKraus(acc, embedded);
  }
  return acc;
}

/** E_F of a PURE two-qubit coin from its concurrence: h2((1+sqrt(1-C^2))/2). */
function efOfPure(c: number): number {
  const x = (1 + Math.sqrt(Math.max(0, 1 - c * c))) / 2;
  let s = 0;
  if (x > 0) s -= x * Math.log2(x);
  if (x < 1) s -= (1 - x) * Math.log2(1 - x);
  return s;
}

/** Recompute every ledger delta from the machinery — the checker's source. */
export function computeLedger(): readonly LedgerEntry[] {
  const out: LedgerEntry[] = [];
  // E1 redemption on a canonical payload
  const r = redeem(vecToRho(PLUS));
  out.push({ ...(LEDGER_SPECS[0] as LedgerSpec), before: concurrence(PHI_PLUS), after: concurrence(r.coinAfter) });
  out.push({ ...(LEDGER_SPECS[1] as LedgerSpec), before: eF(PHI_PLUS), after: eF(r.coinAfter) });
  out.push({ ...(LEDGER_SPECS[2] as LedgerSpec), before: 0, after: 2 });
  // E2 dense code
  const d = denseCode();
  out.push({ ...(LEDGER_SPECS[3] as LedgerSpec), before: eF(PHI_PLUS), after: eF(d.coinReturned) });
  out.push({ ...(LEDGER_SPECS[4] as LedgerSpec), before: 0, after: d.mutualInformation });
  // E4 Procrustean netting at the canonical grade
  const nt = netWeakCoin(LEDGER_LMIN);
  out.push({
    ...(LEDGER_SPECS[5] as LedgerSpec),
    before: efOfPure(nt.weakConcurrence),
    after: nt.pSucc * eF(nt.successState) + nt.pFail * eF(nt.failState),
  });
  out.push({ ...(LEDGER_SPECS[6] as LedgerSpec), before: 1, after: nt.pSucc });
  out.push({ ...(LEDGER_SPECS[7] as LedgerSpec), before: 0, after: 1 });
  // the BBPSSW round at the canonical Werner grade
  const W = wernerCoin(LEDGER_F);
  const pr = purifyRound(W, W);
  out.push({
    ...(LEDGER_SPECS[8] as LedgerSpec),
    before: eF(W) + eF(W),
    after: pr.pSucc * eF(pr.successState) + pr.pFail * eF(pr.failState),
  });
  out.push({ ...(LEDGER_SPECS[9] as LedgerSpec), before: 2, after: pr.pSucc });
  out.push({ ...(LEDGER_SPECS[10] as LedgerSpec), before: 0, after: 2 });
  // the GHZ withdrawal, per branch (each branch is a product AB x C state)
  const wd = withdrawToAB();
  const g = ghzCoin();
  const before = ghzCutNegativities(g);
  const plus = ghzCutNegativities(wd.jointPlus);
  const minus = ghzCutNegativities(wd.jointMinus);
  out.push({
    ...(LEDGER_SPECS[11] as LedgerSpec),
    before: 0,
    after: wd.pPlus * concurrence(wd.abPlus) + wd.pMinus * concurrence(wd.abMinus),
  });
  out.push({ ...(LEDGER_SPECS[12] as LedgerSpec), before: before[0] as number, after: wd.pPlus * (plus[0] as number) + wd.pMinus * (minus[0] as number) });
  out.push({ ...(LEDGER_SPECS[13] as LedgerSpec), before: before[1] as number, after: wd.pPlus * (plus[1] as number) + wd.pMinus * (minus[1] as number) });
  out.push({ ...(LEDGER_SPECS[14] as LedgerSpec), before: before[2] as number, after: wd.pPlus * (plus[2] as number) + wd.pMinus * (minus[2] as number) });
  // the local-channel census
  const census = ghzLocalCensus(makeRng(203), LEDGER_CENSUS_ROUNDS);
  out.push({ ...(LEDGER_SPECS[15] as LedgerSpec), before: Math.max(...before), after: census.worstCut });
  return out;
}
