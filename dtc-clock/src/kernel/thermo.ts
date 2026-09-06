/**
 * THE THERMODYNAMIC LEDGER — board B4, the price the dossier demanded.
 *
 * Three exact laws and one table:
 *   (T1) ZERO NET WORK on the ideal beat: along the |0...0> orbit every
 *        strobe is a ZZ eigenstate of the same energy, so <H_zz>(k) is
 *        constant and the two-point-measurement work distribution of one
 *        period is delta(W - 0) — the drive's work is throughput, returned.
 *   (T2) THE DETUNED BEAT PAYS: first period exactly — W_0 = J(n-1) sin^2
 *        2 delta >= 0 from the product-state geometry (<H_zz>_1 has a true
 *        closed form); beyond it the chain's heating series is DATA,
 *        SUPPRESSED far below the isolated-qubit echo decay |cos 2d|^k
 *        (which is EXACT) — rigidity on the energy account; no infinite-
 *        time total is claimed (prethermal bounds cited, not proven).
 *   (T3) THE TARIFF TABLE (dossier demand C4 / milestone M4): per-run
 *        erasure obligations, in units of kT ln 2, at equal error (all
 *        machines here are exact): DTC-clocked Bennett machine 0 (garbage
 *        uncomputed, delivery deterministic -> reading a known outcome
 *        destroys no information), DTC as-built 5 (the multiplier's five
 *        garbage wires zeroed on cycle), irreversible rival 9 (4 input
 *        wires + 5 internal), FK spectral clock QUOTED from vacuum-compiler
 *        T4 ((T+1) log2(T+1) per delivery cycle — the UNCERTAIN-readout
 *        schedule; the DTC's deterministic delivery never enters that
 *        regime unless detuned — board B5 numbers). The winner is computed
 *        by the fixed rule FEWEST-UNITS-WINS, legislated before the table.
 *        v0.5.0 adds the MAINTENANCE row: the armor-repaired clock's
 *        amortized syndrome-entropy bill per period top (TC27) — error
 *        correction priced, not free; a per-CYCLE quantity among per-RUN
 *        rows, stated as such in its note.
 */
import { type CMat, mat } from "../core/cmat.js";
import { applyUnitary } from "../core/channels.js";
import { echoFloquet, expectation, polarizedRho, zzEnergies, type EchoParams } from "./beat.js";
import { multiplierCircuit } from "./compile.js";

/** Boltzmann constant, exact by SI 2019 definition. */
export const K_BOLTZMANN = 1.380649e-23;

/** ln 2 by midpoint quadrature of 1/x on [1,2] — the route-price W-A method. */
export function ln2ByQuadrature(steps = 1 << 20): number {
  const h = 1 / steps;
  let s = 0;
  for (let i = 0; i < steps; i++) s += 1 / (1 + (i + 0.5) * h);
  return s * h;
}

/** Landauer's floor per erased bit, in joules, at temperature T (kelvin). */
export function landauerJoules(T: number): number {
  return K_BOLTZMANN * T * ln2ByQuadrature();
}

/** H_zz as a CMat (diagonal), for kernel-path expectations. */
export function zzHamiltonian(p: EchoParams): CMat {
  const dim = 1 << p.n;
  const energies = zzEnergies(p);
  const h = mat(dim, dim);
  for (let z = 0; z < dim; z++) h.re[z * dim + z] = energies[z]!;
  return h;
}

/** T1a: worst |<H_zz>(k) - <H_zz>(0)| along the |0...0> orbit, theta=pi/2, h=0. */
export function beatEnergyDeviation(n: number, couplings: readonly number[], kMax: number): number {
  const p: EchoParams = { n, theta: Math.PI / 2, fields: Array(n).fill(0), couplings };
  const f = echoFloquet(p);
  const h = zzHamiltonian(p);
  let rho = polarizedRho(n);
  const e0 = expectation(rho, h);
  let worst = 0;
  for (let k = 1; k <= kMax; k++) {
    rho = applyUnitary(rho, f);
    worst = Math.max(worst, Math.abs(expectation(rho, h) - e0));
  }
  return worst;
}

/**
 * T1b: the two-point-measurement work distribution of one period on the
 * orbit: measure H_zz, evolve one period, measure again — outcomes identical
 * (both strobes are the same eigenstate family), so P(W=0) = 1 exactly.
 * Returns the worst total variation distance from delta(W-0).
 */
export function beatTpmWorkDelta(n: number, couplings: readonly number[], kMax: number): number {
  const p: EchoParams = { n, theta: Math.PI / 2, fields: Array(n).fill(0), couplings };
  const f = echoFloquet(p);
  const energies = zzEnergies(p);
  const dim = 1 << n;
  let rho = polarizedRho(n);
  let worst = 0;
  for (let k = 0; k < kMax; k++) {
    // first measurement: diagonal in the ZZ basis; on the orbit it is a point mass
    const probs = new Float64Array(dim);
    for (let z = 0; z < dim; z++) probs[z] = rho.re[z * dim + z]!;
    const rhoAfter = applyUnitary(rho, f);
    const probs2 = new Float64Array(dim);
    for (let z = 0; z < dim; z++) probs2[z] = rhoAfter.re[z * dim + z]!;
    // W = E_z' - E_z; accumulate P(W != 0)
    let escape = 0;
    for (let z1 = 0; z1 < dim; z1++) {
      if (probs[z1] === 0) continue;
      for (let z2 = 0; z2 < dim; z2++) {
        if (probs2[z2] === 0) continue;
        if (Math.abs(energies[z2]! - energies[z1]!) > 1e-12) escape += probs[z1]! * probs2[z2]!;
      }
    }
    worst = Math.max(worst, escape);
    rho = rhoAfter;
  }
  return worst;
}

/**
 * T2: the detuned beat pays — what is closed is closed, what is not is DATA.
 *   (i) EXACT, first period: from |0...0> the state is still a product when
 *       the first kick ends, so <H_zz>_1 = -J(n-1) cos^2(2 delta) exactly
 *       (each bond factorizes; the ZZ stroke then only entangles, it cannot
 *       move <ZZ>). The first period's work W_0 = J(n-1) sin^2(2 delta) >= 0.
 *   (ii) EXACT, isolated qubit: the echo decays |<Z>_k| = |cos 2 delta|^k
 *       (no bonds, h = 0, no entangling stroke ever happens).
 *   (iii) DATA, the chain beyond period 1: after the first kick the state is
 *       a superposition and the ZZ stroke entangles it — no product closed
 *       form survives (the scratch run convicted the naive (cos^2)^k law;
 *       recorded batch 36). What the numbers show instead: the chain's
 *       per-period work is SUPPRESSED far below the isolated-qubit echo
 *       error — the same rigidity as board B1, now on the energy account.
 *       The infinite-time total is the heating question — prethermal bounds
 *       are CITED (EBN16/KLS16), not proven here; no total is claimed.
 */
export function detunedHeatingCensus(
  n: number,
  j: number,
  delta: number,
  kMax: number,
): {
  e1ClosedFormDeviation: number;
  w0ClosedForm: number;
  workSeries: readonly number[];
  chainDrift: number; // (E_0 - E_kMax) / (J(n-1)): normalized energy paid
  isolatedEchoDecay: number; // 1 - |cos 2 delta|^kMax: the isolated benchmark
  suppression: number; // isolatedEchoDecay / chainDrift — how much the chain resists
} {
  const p: EchoParams = {
    n,
    theta: Math.PI / 2 + delta,
    fields: Array<number>(n).fill(0),
    couplings: Array<number>(n - 1).fill(j),
  };
  const f = echoFloquet(p);
  const h = zzHamiltonian(p);
  let rho = polarizedRho(n);
  const e0 = expectation(rho, h);
  const workSeries: number[] = [];
  let prev = e0;
  for (let k = 0; k < kMax; k++) {
    rho = applyUnitary(rho, f);
    const e = expectation(rho, h);
    workSeries.push(e - prev);
    prev = e;
  }
  const e1 = e0 + workSeries[0]!;
  const e1Closed = -j * (n - 1) * Math.cos(2 * delta) ** 2;
  const chainDrift = (prev - e0) / (j * (n - 1)); // energy PAID = the rise from E_0
  const isolatedEchoDecay = 1 - Math.abs(Math.cos(2 * delta)) ** kMax;
  return {
    e1ClosedFormDeviation: Math.abs(e1 - e1Closed),
    w0ClosedForm: j * (n - 1) * Math.sin(2 * delta) ** 2,
    workSeries,
    chainDrift,
    isolatedEchoDecay,
    suppression: chainDrift > 1e-15 ? isolatedEchoDecay / chainDrift : Number.POSITIVE_INFINITY,
  };
}

// ---------------------------------------------------------------------------
// T3: the tariff table. Criterion legislated BEFORE the numbers: per-run
// erasure obligation in units of kT ln 2 at equal error; FEWEST WINS.
// ---------------------------------------------------------------------------

export const TARIFF_CRITERION =
  "per-run erasure obligation in units of kT ln 2 at equal error (all machines exact): garbage wires zeroed on cycle + information-theoretic readout cost of delivery (a deterministic delivery reads a known outcome and pays 0); fewest units wins";

export interface TariffRow {
  readonly machine: string;
  readonly garbageBits: number;
  readonly readoutBits: number;
  readonly units: number; // garbage + readout
  readonly note: string;
}

/** The tariff table for the demonstrated program (2x2 multiplier, T gates). */
export function tariffTable(): { rows: TariffRow[]; winner: string } {
  const t = multiplierCircuit().length;
  const fkReadout = Number(((t + 1) * Math.log2(t + 1)).toFixed(2));
  const rows: TariffRow[] = [
    {
      machine: "DTC-clocked, Bennett-uncomputed (depth 2T+1)",
      garbageBits: 0,
      readoutBits: 0, // deterministic delivery: the token's absorbing site is known
      units: 0,
      note: "the zero-dissipation reading survives ONLY as this in-model ideal; every deviation pays (rows below, board B5)",
    },
    {
      machine: "DTC-clocked, as built (the multiplier in this repo)",
      garbageBits: 5, // t, u, v, c1, c2 stay dirty
      readoutBits: 0,
      units: 5,
      note: "five garbage wires zeroed per machine cycle",
    },
    {
      machine: "irreversible Boolean rival (same function, workspace reuse)",
      garbageBits: 9, // 4 input wires + 5 internal
      readoutBits: 0,
      units: 9,
      note: "combinational: no clock register, no readout column — pays in erasure what it saves in depth",
    },
    {
      machine: "FK spectral clock (vacuum-compiler T4, quoted)",
      garbageBits: 0,
      readoutBits: fkReadout,
      units: fkReadout,
      note: `QUOTED from vacuum-compiler T4 static mode at T=${t}: the uncertain-readout schedule; a detuned DTC enters this regime (board B5)`,
    },
    {
      machine: "DTC clock, armor-repaired (majority maintenance, n=5 p=0.10)",
      garbageBits: 0,
      readoutBits: 0.4253, // amortized syndrome entropy per period top (TC27/W-K)
      units: 0.4253,
      note: "v0.5.0's maintenance contract: the 1-bit sector read's Shannon entropy per period — 0 while the armor holds strictly (a deterministic read pays 0, the TC14 criterion), metered under fire; the conditional global flip is unitary and pays 0; W-K re-derives this meter reading live and convicts drift",
    },
  ];
  let winner: TariffRow = rows[0]!;
  for (const r of rows) if (r.units < winner.units) winner = r;
  return { rows, winner: winner.machine };
}

/** Joule prices of a per-run obligation at two reference temperatures. */
export function joulePrices(units: number): { t300: number; t10mK: number } {
  return { t300: units * landauerJoules(300), t10mK: units * landauerJoules(0.01) };
}
