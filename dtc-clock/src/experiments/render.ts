/**
 * Renders THE DTC CLOCK — ledger row #10's open core executed, one page.
 *
 * Entry guard (house law since batch 21): rendering fires only when this
 * file is the invoked program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { BOARD, type BoardRow } from "../kernel/board.js";
import { checkBoard, DEMO_CIRCUIT, runWitnesses } from "../kernel/audit.js";
import { kappaFace, transferResidual, kappaFromSigma, arcClosureRelative, edgeNextOrder, edgeSeriesAccelerated, phi1Face, phi1GridStructure, kappaRoadCrossDeviation } from "../kernel/assembly.js";
import { richardsonLimit, sigmaFirst, shareFloat, shareFloatIncremental } from "../kernel/armor.js";
import {
  chainLifetimeCensus,
  coherentEchoLawDeviation,
  convictedLawDeviation,
  dephasedEchoExpectationExact,
  isolatedEchoLifetime,
  isolatedEchoTrajectory,
  rigidityCensus,
} from "../kernel/beat.js";
import { detunedCensus, randomClockCensus, readDephasingCensus } from "../kernel/clock.js";
import {
  absorptionRadius,
  binomialPmfClosed,
  delocalizedFlipCensus,
  fullRepairCensus,
  localizedDepolCensus,
  localizedFlipCensus,
  maskPopcountMarginal,
  popcountShadow,
  radiusCensus,
  repairCensus,
  shadowQ,
  spectralArmor,
  repairedStationary,
  decayRateConstant,
  decayEigenpairResidual,
  amputatedSpectrumClosed,
  krawtchoukResidual,
  secondOrderClosed,
  secondOrderCoefficient,
  secondOrderGeneral,
  secondOrderGeneralRational,
  secondOrderRSRational,
  thirdOrderClosed,
  thirdOrderFaces,
  centralBinomialStepResidue,
  rationalResidue,
  stationaryBreach,
  stationaryTie,
  tieResetBits,
} from "../kernel/armor.js";
import { joulePrices, tariffTable, TARIFF_CRITERION } from "../kernel/thermo.js";
import { tombstoneCensus } from "../kernel/tombstone.js";
import { makeRng } from "../core/rng.js";
import { writeReport } from "./report.js";

export function renderBoard(board: readonly BoardRow[] = BOARD): string {
  const violations = checkBoard(board);
  if (violations.length > 0) {
    const lines = violations.map((v) => `- ${v.row} [${v.law}]: ${v.detail}`);
    throw new Error(`the board is illegal — refusing to print it:\n${lines.join("\n")}`);
  }
  const out: string[] = [];
  out.push(
    "# THE DTC CLOCK — the epoch-4 open core executed: the beat clocks general computation, and the price list ships on the same page\n",
  );
  out.push(
    "> The letter's epoch-4 sentence: 'time crystals as the clock wall — a zero-energy eternal beat, the second law a disclaimer clause.' Route-price D1 split it into three truths and left two cells uncertified: the beat clocking GENERAL COMPUTATION (C3) and the energy accounting against rival clocks (C4). This page certifies both at the model layer — an exact driven-echo family whose beat advances a one-hot token that fires a universal reversible gate set with cargo fidelity exactly 1 at every tick, a thermodynamic ledger where the ideal beat costs zero net work in-model and every deviation pays, and the WO15 tombstone executed. The eternal beat is real in-model and metered at every use: the second law stays a price list (#11's verdict, now at the clock layer). Hardware is NOT claimed — MI22 holds the hardware cells.\n",
  );
  out.push("\n## The certificate criterion — fixed law, legislated before the numbers (L5)\n");
  out.push(`\n> ${TARIFF_CRITERION}\n`);
  out.push("\n## The board\n");
  out.push("| id | claim | family | price | tag | witness |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  for (const r of board) {
    out.push(`| ${r.id} | ${r.claim} | ${r.family} | ${r.price} | ${r.exactness} | ${r.witness} |`);
  }

  const rng = makeRng(0xd7c10c);
  out.push("\n## B1 — rigidity census (DATA, horizon 20 periods)\n");
  out.push("| delta | k | chain \\|m\\| | isolated \\|m\\| (rotor, h=0.05) | dephased benchmark \\|E[m~]\\| |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const r of rigidityCensus(6, [0.05, 0.1, 0.2], 20).filter((r) => r.k === 10 || r.k === 20)) {
    out.push(
      `| ${r.delta.toFixed(2)} | ${r.k} | ${r.chainAbsM.toFixed(4)} | ${r.isolatedAbsM.toFixed(4)} | ${Math.abs(Math.cos(2 * r.delta)) ** r.k} |`,
    );
  }
  out.push(
    "\nv0.20.0 reading (TC46): the isolated column is the DETUNED ROTOR — quasi-periodic with recurrences, its dips are beatings (YAO17's peak splitting), not losses; a coherent isolated qubit never decays (m(k) = (-1)^k cos 2k delta exactly through the kernel). The honest isolated DECAY benchmark is the dephased drive's expected echo (cos 2 delta)^k — the last column; the chain's |m| at these horizons sits far above it (the rigidity the census was licensed to find).\n",
  );

  out.push("\n## B5 — the frontier census (off the orbit the wall is real)\n");
  out.push("| probe | last-beat fidelity | entropy (bits) | order back-action |");
  out.push("| --- | --- | --- | --- |");
  const probes: string[][] = [];
  for (const d of [0.05, 0.15, 0.3]) {
    const rows = detunedCensus(4, d, DEMO_CIRCUIT, 3);
    const last = rows[rows.length - 1]!;
    probes.push([
      `detuned delta=${d}`,
      last.advanceFidelity.toFixed(4),
      last.clockEntropyBits.toFixed(3),
      last.orderBackAction.toFixed(4),
    ]);
  }
  const rc = randomClockCensus(rng, 4, DEMO_CIRCUIT, 3, 3);
  probes.push([
    "random clock (worst)",
    Math.min(...rc.map((r) => r.advanceFidelity)).toFixed(4),
    Math.max(...rc.map((r) => r.clockEntropyBits)).toFixed(3),
    Math.max(...rc.map((r) => r.orderBackAction)).toFixed(4),
  ]);
  const rd = readDephasingCensus(4, 0.1, DEMO_CIRCUIT, 3);
  const rdLast = rd[rd.length - 1]!;
  probes.push([
    "phase read q=0.10",
    rdLast.advanceFidelity.toFixed(12),
    rdLast.clockEntropyBits.toFixed(12),
    rdLast.orderBackAction.toFixed(12),
  ]);
  for (const p of probes) out.push(`| ${p[0]} | ${p[1]} | ${p[2]} | ${p[3]} |`);

  out.push(
    "\n## The lifetime law (v0.2.0 — the priced next steps of TC4/TC13, n = 6, threshold 0.5; the isolated face RE-VERIFIED at v0.20.0)\n",
  );
  out.push("| delta | tau_iso (dephased benchmark) | tau_chain (measured) | protection |\n");
  out.push("| --- | --- | --- | --- |\n");
  for (const r of chainLifetimeCensus(6, [0.1, 0.15, 0.2, 0.3, 0.4], 1500, 0.5)) {
    const prot = r.tauChain > 0 ? `${(r.tauChain / r.tauIso).toFixed(1)}x` : `>${Math.floor(1500 / r.tauIso)}x (locked at 1500)`;
    out.push(`| ${r.delta} | ${r.tauIso} | ${r.tauChain < 0 ? ">1500 (locked)" : r.tauChain} | ${prot} |`);
  }
  out.push(
    "\nv0.20.0 CONVICTION (TC46): the tau_iso column is the DEPHASED benchmark's expected-echo crossing — the geometric law is exact IN EXPECTATION under per-period sign noise (E[m~(k)] = (cos 2 delta)^k, exhaustive-verified over all 2^k sign sequences at k = 8/12 to 3.6e-15 and MC-verified at N = 40000). The v0.2.0 verification of this table's isolated face was TAUTOLOGICAL (the 'direct simulation' iterated the formula itself — test, witness, and scratch) and its COHERENT reading is FALSE: the isolated qubit is the quasi-periodic rotor, first crossings at 6/3/2 for delta = 0.1/0.2/0.3 where the retired reading claimed 35/9/4. The chain's measured lifetimes and protection factors stand unchanged — the benchmark's meaning is what changed.\n",
  );
  out.push(
    "\nThe protection cliff: the prethermal shield holds at full strength through delta ~ 0.3 (175x at 0.3, still locked at 1500 strobes for delta <= 0.2) and COLLAPSES to 1.0x by delta = 0.4 — not smooth decay, a cliff. The heating twin (TC20): the window drift is front-loaded (the perturbative first-strobe jump; tau_heat = 2 at every delta) while the empirical diagonal value climbs toward the infinite-temperature face as delta grows. Boundaries: ED-scale horizons — the exponential-prethermal asymptotics beyond the cliff are cited (EBN16/KLS16), not re-proven.\n",
  );

  out.push("\n## The cliff line and the self-synchronizing clock (v0.3.0)\n");
  out.push(
    "\nThe cliff LINE at n = 6, horizon 900, criterion tau >= 10 x tau_iso: delta_c = 0.349 / 0.344 / 0.228 / 0.357 at J = 0.6 / 1.2 / 1.8 / 2.4 — the cliff EXISTS at every J but its location does not track J cleanly at this scale (scatter exceeds trend; the prethermal monotone intuition is not resolvable at n = 6 — reported as the honest negative result it is).\n",
  );
  out.push(
    "\nThe SELF-SYNCHRONIZING CLOCK: under bit-flip reads on the clock register — the honest wall face the free phase channel was not — the token's advance fidelity is EXACTLY 1 (the rounding floor) at every beat and every q <= 0.2. The mechanism: a bit flip shifts a branch's sector phase by one strobe; the branch advances early then pauses; ANY flip history accumulates exactly k advances over 2k strobes, so token(k) is a function of the strobe count alone. The subharmonic period-2 structure is an error absorber at the keying layer — the cost is one bit of clock-load entanglement (entropy 0.067 -> 0.98 as q grows), never a misfire.\n",
  );

  out.push("\n## The Pauli wall and the Hamming armor (v0.4.0)\n");
  out.push(
    "\nThe PAULI WALL, closed: X absorbed (TC22), Z exactly free (TC8), and Y — the composition — also absorbed: Y-flip census advance fidelity exactly 1 at every q probed. The PAULI TRINITY is closed at the keying layer.\n",
  );
  out.push(
    "\nTHE HAMMING ARMOR (TC24, the real mechanism): the orbit states sit at popcount 0 and n — the EXTREME popcounts — so their Hamming distance to the keying boundary (popcount n/2) is floor(n/2), which no single-qubit error can cross. T1 amplitude damping — the DISSIPATIVE channel — is absorbed just like the unitary ones (fidelity exactly 1 at every gamma probed): |0..0> has bit 0 already 0 (T1 does nothing), |1..1> has popcount n (T1 takes it to n-1, still in the minus sector). The armor's thickness is floor(n/2) simultaneous single-qubit errors — growing linearly with the clock register's size. This is why DTCs are experimentally robust (MI22): the subharmonic order parameter is a MAJORITY-VOTE code on the clock register.\n",
  );

  out.push("\n## The armor dynamics (v0.5.0)\n");
  out.push(
    "\nTHE ABSORPTION RADIUS (TC25): the clock register is the repetition code [n,1,n] and the keying is its majority decoder — r = floor((n-1)/2) is the correction radius (HAM50's classical law, holding for a quantum clock register at the keying layer).\n",
  );
  out.push("| n | r | absorbed: worst over ALL \\|S\\|=r subsets (q=0.5) | wall: \\|S\\|=r+1 (q=0.5) | deterministic q=1.0 |");
  out.push("| --- | --- | --- | --- | --- |");
  const detWall5 = localizedFlipCensus(5, [0, 1, 2], 1.0, DEMO_CIRCUIT, 3);
  const wall5 = localizedFlipCensus(5, [0, 1, 2], 0.5, DEMO_CIRCUIT, 3);
  for (const n of [4, 5]) {
    const r = absorptionRadius(n);
    const abs = radiusCensus(n, r, 0.5, DEMO_CIRCUIT, 3);
    if (n === 4) {
      const wall = radiusCensus(4, 2, 0.5, DEMO_CIRCUIT, 3);
      const detAbs = radiusCensus(4, 1, 1.0, DEMO_CIRCUIT, 3);
      const detWall = radiusCensus(4, 2, 1.0, DEMO_CIRCUIT, 3);
      out.push(
        `| 4 | 1 | ${abs.worstFidelity.toFixed(15)} (${abs.subsets}/${abs.subsets} subsets) | ${wall.worstFidelity.toFixed(4)} (${wall.subsets} subsets, exhaustive) | \\|S\\|=r ${detAbs.worstFidelity.toFixed(15)}, \\|S\\|=r+1 ${detWall.worstFidelity.toFixed(15)} (exhaustive) |`,
      );
    } else {
      out.push(
        `| 5 | 2 | ${abs.worstFidelity.toFixed(15)} (${abs.subsets}/${abs.subsets} subsets, exhaustive) | ${wall5[wall5.length - 1]!.advanceFidelity.toFixed(4)} (subset {0,1,2}) | \\|S\\|=r+1 {0,1,2} ${detWall5[detWall5.length - 1]!.advanceFidelity.toFixed(15)} (subset-independent: the deterministic mask alternates 0 and 3, every even strobe misses) |`,
      );
    }
  }
  const depol5 = localizedDepolCensus(5, [0, 1], 0.75, DEMO_CIRCUIT, 3);
  out.push(
    "\nThe mechanism: X-fire on a fixed set S keeps the corrupted orbit |pole(t) XOR mask> inside the keying sector (popcount(mask) <= r < n/2 at even strobes, n - popcount(mask) >= n - r > n/2 at odd), so every history is absorbed — and EVERY CPTP channel on the set is (each Kraus image stays in the set's popcount band): full-strength depolarizing p=0.75 on the radius set gives advance fidelity " +
      depol5[depol5.length - 1]!.advanceFidelity.toFixed(15) +
      " at n=5. The cost is bounded: clock entropy saturates at exactly |S| bits, never grows. n=6/7 radii extend through the classical shadow (below), whose equivalence is machine-checked at n=4/5.\n",
  );
  out.push("\nTHE EROSION LAW (TC26): delocalized X-fire — each clock qubit flips independently, prob p per period — and the token process is EXACTLY the classical shadow (worst |DP - quantum| 7.8e-16). The armor erodes AND PARTIALLY SELF-HEALS: an excursion into the inverted sector refunds its even-strobe miss with an odd-strobe advance.\n");
  out.push("| p (n=4) | fidelity at beats 1..4 (quantum === DP) | shadow dev | strict survival at period 8 | refund |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const p of [0.01, 0.05, 0.1, 0.2]) {
    const dp = popcountShadow(4, p, 8);
    const q = delocalizedFlipCensus(4, p, DEMO_CIRCUIT, 3);
    const fid = q.map((x) => x.advanceFidelity.toFixed(6)).join(" / ");
    let dev = 0;
    for (const row of q) dev = Math.max(dev, Math.abs(dp.fidelity[row.beat * 2 - 1]! - row.advanceFidelity));
    const surv = dp.survival[7]!;
    const last = q[q.length - 1]!.advanceFidelity;
    out.push(`| ${p} | ${fid} | ${dev.toExponential(2)} | ${surv.toFixed(6)} | ${(last / surv).toFixed(2)}x |`);
  }
  out.push("\nTHE REPAIR (TC27): majority decoding at every period top — a 1-bit sector read plus a conditional global flip. At ODD n the decoder can never tie, so the repaired clock is exact under sustained fire; the maintenance is metered; at even n the tie dead zone is the honest boundary.\n");
  out.push("| n | p | repaired (worst beat) | passive twin | syndrome bits/period |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const [n, p] of [
    [5, 0.05],
    [5, 0.1],
    [5, 0.2],
    [4, 0.1],
  ] as const) {
    const v = repairCensus(n, p, DEMO_CIRCUIT, 3);
    const worst = Math.min(...v.rows.map((r) => r.advanceFidelity));
    out.push(
      `| ${n} | ${p} | ${worst.toFixed(15)} | ${v.unrepairedWorstFidelity.toFixed(4)} | ${v.meanSyndromeBits.toFixed(4)} |`,
    );
  }
  {
    const passive6 = popcountShadow(6, 0.2, 64);
    const repaired6 = popcountShadow(6, 0.2, 64, undefined, true);
    const passive8 = popcountShadow(8, 0.2, 64);
    const repaired8 = popcountShadow(8, 0.2, 64, undefined, true);
    out.push(
      `\nThe long-horizon conviction (the machine overruling the expectation that repair always helps): at even n the tie dead zone pins the walk where misses accrue unrecovered, and the PASSIVE refund wins outright — n=6, p=0.2, 64 periods: repaired ${repaired6.fidelity[63]!.toExponential(3)} vs passive ${passive6.fidelity[63]!.toExponential(3)} (${(passive6.fidelity[63]! / repaired6.fidelity[63]!).toFixed(1)}x worse); n=8 the same (${(passive8.fidelity[63]! / repaired8.fidelity[63]!).toFixed(1)}x). At odd n the repair is exact at every horizon probed (n=7, p=0.2, 64 periods: ${popcountShadow(7, 0.2, 64, undefined, true).fidelity[63]!.toFixed(15)}).\n`,
    );
  }

  out.push("\n## The binomial shadow law and the scale census (v0.7.0)\n");
  out.push(
    "\nTHE BINOMIAL SHADOW LAW (TC29): each clock bit's flip history is independent, so the passive mask popcount is EXACTLY w_t ~ Bin(n, q_t) with q_t = (1-(1-2p)^t)/2 — and every passive face closes. The repaired chain's meters stay DP-exact (the repair resets the walk; no binomial law survives it).\n",
  );
  out.push("| n | p | t | worst deviation (machine vs Bin(n,q_t)) |");
  out.push("| --- | --- | --- | --- |");
  for (const [n, p, tt] of [
    [4, 0.1, 5],
    [4, 0.2, 12],
    [6, 0.05, 9],
    [6, 0.2, 16],
    [8, 0.1, 7],
  ] as const) {
    const machine = maskPopcountMarginal(n, p, tt);
    const closed = binomialPmfClosed(n, shadowQ(p, tt));
    let dev = 0;
    for (let k = 0; k <= n; k++) dev = Math.max(dev, Math.abs(machine[k]! - closed[k]!));
    out.push(`| ${n} | ${p} | ${tt} | ${dev.toExponential(2)} |`);
  }
  out.push(
    `\nThe stationary faces (t to infinity, q_t to 1/2 at rate 1-2p), exact to 6.1e-14: breach = 1/2 + C(n,n/2)/2^(n+1) — ${[4, 6, 8, 10].map((n) => `${n}: ${stationaryBreach(n).toFixed(6)}`).join(", ")}; tie = C(n,n/2)/2^n — ${[4, 6, 8, 10].map((n) => `${n}: ${stationaryTie(n).toFixed(6)}`).join(", ")}. The naive relaxation q' = 1-(1-p)^t is wrong by 3.2e-1 — the law is contentful.\n`,
  );
  out.push("\nTHE SCALE CENSUS (TC30, shadow, 64 periods at p=0.2):\n");
  out.push("| n | passive F(64) | full-repair F(64) | tie meter | log2C | stationary tie | stationary breach |");
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const n of [10, 12, 16]) {
    const passive = popcountShadow(n, 0.2, 64);
    const full = popcountShadow(n, 0.2, 64, undefined, true, true);
    out.push(
      `| ${n} | ${passive.fidelity[63]!.toExponential(3)} | ${full.fidelity[63]!.toFixed(15)} | ${full.meanTieBits.toFixed(4)} | ${tieResetBits(n).toFixed(4)} | ${stationaryTie(n).toFixed(6)} | ${stationaryBreach(n).toFixed(6)} |`,
    );
  }
  out.push(
    "\nThe passive fidelity RISES with n at this horizon (2.2e-3 to 1.0e-2): a larger register gives the refund structure more room to balance the drift. The full repair is exactly 1 at every scale probed.\n",
  );

  out.push("\n## The tie reset (v0.6.0)\n");
  out.push(
    "\nTHE TIE RESET (TC28, the priced next step of TC27): the majority decoder's blind spot — the tie set {popcount = n/2}, a fixed point of the global flip — is cleared by an exact-pole reset on the tie branch. The erasure is EXACTLY log2 C(n, n/2) bits by exchangeability (iid per-qubit fire makes the conditioned mask uniform over the tie states), asymptotically the whole register; with the reset the repaired fidelity is EXACTLY 1 at EVERY n, and the v0.5.0 even-n long-horizon liability is cured outright.\n",
  );
  out.push("| n | p | full-repair (worst beat) | passive twin | syndrome bits | tie meter bits/period | erasure constant log2C |");
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const [n, p] of [
    [4, 0.1],
    [4, 0.2],
    [6, 0.1],
  ] as const) {
    const v = fullRepairCensus(n, p, DEMO_CIRCUIT, 3);
    const worst = Math.min(...v.rows.map((r) => r.advanceFidelity));
    out.push(
      `| ${n} | ${p} | ${worst.toFixed(15)} | ${v.unrepairedWorstFidelity.toFixed(4)} | ${v.meanSyndromeBits.toFixed(4)} | ${v.meanTieBits.toFixed(4)} | ${v.tieTariffBits.toFixed(4)} |`,
    );
  }
  {
    const v5 = fullRepairCensus(5, 0.1, DEMO_CIRCUIT, 3);
    out.push(
      `| 5 (odd — the tie set is empty, the reset is a no-op) | 0.1 | ${Math.min(...v5.rows.map((r) => r.advanceFidelity)).toFixed(15)} | ${v5.unrepairedWorstFidelity.toFixed(4)} | ${v5.meanSyndromeBits.toFixed(4)} | ${v5.meanTieBits.toFixed(6)} | ${tieResetBits(5).toFixed(1)} |`,
    );
    const passive6 = popcountShadow(6, 0.2, 64);
    const sector6 = popcountShadow(6, 0.2, 64, undefined, true, false);
    const full6 = popcountShadow(6, 0.2, 64, undefined, true, true);
    const passive8 = popcountShadow(8, 0.2, 64);
    const sector8 = popcountShadow(8, 0.2, 64, undefined, true, false);
    const full8 = popcountShadow(8, 0.2, 64, undefined, true, true);
    out.push(
      `\nThe long-horizon cure (shadow, 64 periods, p=0.2): n=6 — passive ${passive6.fidelity[63]!.toExponential(3)}, sector-only ${sector6.fidelity[63]!.toExponential(3)} (the v0.5.0 liability), FULL ${full6.fidelity[63]!.toFixed(15)} at ${full6.meanTieBits.toFixed(4)} tie bits/period; n=8 — passive ${passive8.fidelity[63]!.toExponential(3)}, sector-only ${sector8.fidelity[63]!.toExponential(3)}, FULL ${full8.fidelity[63]!.toFixed(15)}. The odd/even dichotomy survives as a PRICE dichotomy: the odd-n clock pays only the syndrome bit, the even-n clock pays the tie's erasure too — metered, not argued.\n`,
    );
  }

  out.push("\n## The spectral survival law and the stationary repair (v0.8.0)\n");
  out.push(
    "\nTHE SPECTRAL SURVIVAL LAW (TC31): the strict armor's survival is the absorbing chain of the substochastic Q on {0..n/2-1}; Q is reversible (the hypercube flip chain is uniform-reversible, the popcount lumping equitable), hence symmetrizable, and survival(T) = sum_j c_j lambda_j^T EXACTLY — lambda_1 is the armor's decay constant, and survival(T+1)/survival(T) converges to it to 12 decimals. The repaired chain's meters converge to the stationary faces of the small repaired chain (TC32).\n",
  );
  out.push("| p | n=4 | n=6 | n=8 | n=10 | n=12 | n=16 |");
  out.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const p of [0.05, 0.1, 0.2]) {
    const cells = [4, 6, 8, 10, 12, 16].map((n) => spectralArmor(n, p).lambda1.toFixed(9));
    out.push(`| ${p} | ${cells.join(" | ")} |`);
  }
  {
    const stat = repairedStationary(6, 0.2);
    const dpLong = popcountShadow(6, 0.2, 400, undefined, true, true);
    const dp6 = popcountShadow(6, 0.2, 61);
    const ratio = dp6.survival[60]! / dp6.survival[59]!;
    out.push(
      `\nThe stationary repair (TC32, n=6 p=0.2): p_tie^inf ${stat.pTie.toFixed(6)}, syndrome meter ${stat.syndromeMeter.toFixed(6)}, tie meter ${stat.tieMeter.toFixed(6)} (constant ${stat.tariffConstant.toFixed(4)}) — the DP's 400-period mean ${dpLong.meanTieBits.toFixed(6)} converges from BELOW through the transient (early periods start at w=0 and are cheaper). The ratio test: survival(61)/survival(60) = ${ratio.toFixed(12)} = lambda_1 (${spectralArmor(6, 0.2).lambda1.toFixed(12)}). The half-life at p=0.2: ln2/(-ln lambda_1) = ${(Math.LN2 / -Math.log(spectralArmor(6, 0.2).lambda1)).toFixed(3)} periods — the STRICT armor erodes fast at this fire rate; the token survives by the refund (TC26), and the repair buys exactness at the metered price (TC27/TC28).\n`,
    );
  }

  out.push("\n## The universal decay rate (v0.9.0)\n");
  out.push(
    "\nTHE UNIVERSAL DECAY RATE (TC33): the decay-rate constant is gamma = 2 EXACTLY, at every n — u_w = n-2w is a positive eigenvector of the amputated Ehrenfest birth-death generator with eigenvalue exactly n-2 (every row, both boundaries, solver-free residual 0.00e+0), and Perron-Frobenius makes it the top. So lambda_1(p) = 1 - 2p + O(p^2) is n-INDEPENDENT to first order — the strict armor's small-fire half-life is ln2/(2p) + O(p) periods regardless of register size; the n-trend in the grid below is the O(p^2) face.\n",
  );
  out.push("| n | gamma (house Jacobi) | eigenpair residual (solver-free) |");
  out.push("| --- | --- | --- |");
  for (const n of [4, 6, 8, 10, 12, 16, 20, 24, 32, 40]) {
    out.push(`| ${n} | ${decayRateConstant(n).toFixed(9)} | ${decayEigenpairResidual(n).toExponential(2)} |`);
  }
  {
    const cells = [0.02, 0.01, 0.005, 0.0025].map(
      (p) => `${p}: ${((1 - spectralArmor(6, p).lambda1) / p).toFixed(6)}`,
    );
    out.push(
      `\nThe fit face at n=6 — (1-lambda_1(p))/p: ${cells.join(", ")} — the residual to gamma = 2 halves exactly with p (clean O(p)), same at n=10. Fitted second coefficients (DATA, labeled): -1.87 at n=6, -2.45 at n=10 — the register's size enters the decay only here.\n`,
    );
  }

  out.push("\n## The Krawtchouk spectrum and the second-order face (v0.10.0)\n");
  out.push(
    "\nTHE KRAWTCHOUK SPECTRUM (TC34): the amputated generator's ENTIRE spectrum is the odd Krawtchouk family {n-2, n-6, n-10, ...} — integers, an arithmetic progression with common difference exactly 4. The amputation is Dirichlet at the tie plane, the odd modes are antisymmetric under the reflection and vanish there, so they survive intact; TC33's gamma = 2 is the k = 1 member.\n",
  );
  out.push("| n | closed spectrum | solver-free residual (every odd j) |");
  out.push("| --- | --- | --- |");
  for (const n of [6, 8, 10, 12, 16, 24]) {
    let worst = 0;
    for (let k = 1; k <= n / 2; k++) worst = Math.max(worst, krawtchoukResidual(n, 2 * k - 1));
    out.push(`| ${n} | {${amputatedSpectrumClosed(n).join(", ")}} | ${worst.toExponential(2)} |`);
  }
  {
    const cells = [4, 6, 8, 10, 12, 16, 20, 24].map((n) => `n=${n}: ${secondOrderCoefficient(n).toFixed(6)}`);
    out.push(
      `\nTHE SECOND-ORDER FACE (TC35): c_2(n) by Richardson on the exact eigenvalue — ${cells.join(", ")}. The observed scaling c_2/n * sqrt(n) ~ 0.785 ~ pi/4 is OBSERVED, not claimed (eight points of numerology is not a theorem). The closed form as a finite Rayleigh-Schrodinger sum over the odd modes (denominators exactly 4(k-1) by TC34) is priced as the next step.\n`,
    );
  }

  out.push("\n## The Rayleigh-Schrodinger closed form for c_2 (v0.11.0)\n");
  out.push(
    "\nTHE RS CLOSED FORM (TC36): the second-order coefficient is a single repulsion-free Rayleigh quotient — the level-repulsion term vanishes identically because A_1 is diagonal in its own Krawtchouk eigenbasis (TC34's gift) — and Q^(2) is the exact p^2 coefficient, flip counts times the (1-p) expansion, Dirichlet-truncated.\n",
  );
  out.push("| n | c_2 closed (the quotient) | c_2 Richardson | difference |");
  out.push("| --- | --- | --- | --- |");
  for (const n of [4, 6, 8, 10, 12, 16, 20, 24]) {
    const closed = secondOrderClosed(n);
    const rich = secondOrderCoefficient(n);
    out.push(`| ${n} | ${closed.toFixed(12)} | ${rich.toFixed(6)} | ${(closed - rich).toExponential(2)} |`);
  }
  out.push(
    "\nThe quotient is the exact value; Richardson carries the O(p^2) extrapolation error (3e-6 to 2e-4 across the grid) — the agreement is within that error at every point. The rationals 3/2, 15/8, 35/16, 315/128, 693/256 at n = 4..12 reconstruct at the floating floor; no general-n pattern is claimed (priced, not asserted).\n",
  );

  out.push("\n## The general-n law for c_2 — the central-binomial partial sum (v0.12.0)\n");
  out.push(
    "\nTHE GENERAL-n LAW (TC37): c_2(n) = (n-1) C(n-2, (n-2)/2) / 2^(n-2) for even n >= 4 — with m = (n-2)/2 the CENTRAL-BINOMIAL PARTIAL SUM (2m+1) C(2m,m) / 4^m = sum_{k<=m} C(2k,k)/4^k, each term the simple symmetric walk's return probability P(S_2k = 0): the armor's second-order decay coefficient IS the walk's cumulative return count. BigInt cross-multiplied residue against the RS quotient: zero at every n = 4..40; the identity's induction step 2(m+1) C(2m+2,m+1) = 4(2m+1) C(2m,m): integer residue zero at every m = 1..19.\n",
  );
  out.push("| n | c_2(n) = the law | c_2/sqrt(n) | r = c_2 sqrt(pi/2n) | n(1-r) | 32n^2 (r-1+1/(4n)) |");
  out.push("| --- | --- | --- | --- | --- | --- |");
  for (const n of [4, 6, 8, 10, 12, 16, 20, 24, 32, 40]) {
    const c2 = secondOrderGeneral(n);
    const r = c2 * Math.sqrt(Math.PI / (2 * n));
    out.push(
      `| ${n} | ${c2.toFixed(12)} | ${(c2 / Math.sqrt(n)).toFixed(9)} | ${r.toFixed(9)} | ${(n * (1 - r)).toFixed(6)} | ${(32 * n * n * (r - 1 + 1 / (4 * n))).toFixed(4)} |`,
    );
  }
  {
    let lawWorst = 0n;
    for (let n = 4; n <= 40; n += 2) {
      const residue = rationalResidue(secondOrderRSRational(n), secondOrderGeneralRational(n));
      if (residue > lawWorst || residue < -lawWorst) lawWorst = residue < 0n ? -residue : residue;
    }
    let stepWorst = 0n;
    for (let m = 1; m <= 19; m++) {
      const step = centralBinomialStepResidue(m);
      if (step > stepWorst || step < -stepWorst) stepWorst = step < 0n ? -step : step;
    }
    const scale200 = secondOrderGeneral(200) / Math.sqrt(200);
    out.push(
      `\nExactness: law vs RS residue |${lawWorst}| (n=4..40), induction-step residue |${stepWorst}| (m=1..19), float kernel agreement 0.00e+0. The asymptotic face c_2(n) = sqrt(2n/pi) (1 - 1/(4n) + 1/(32n^2) + O(n^-3)): r rises monotonically to 1 over the census (horizon n = 200), n(1-r) -> 1/4, the second face -> 1 (DATA, machine-fitted). THE pi/4 SCALING OF TC35 IS RETIRED: c_2/sqrt(n) -> sqrt(2/pi) = ${Math.sqrt(2 / Math.PI).toFixed(9)}, not pi/4 = ${(Math.PI / 4).toFixed(9)} — at the horizon n = 200 the ratio reads ${scale200.toFixed(9)}; the curve crosses pi/4 near n = 16, INSIDE TC35's grid (the observation was honest at its horizon and is corrected by the law). Negative controls: the off-by-shift sibling (n+1) C(n,n/2)/2^n and the one-power-off denominator 2^(n-1) both carry nonzero exact residues at every probe n = 4..12.\n`,
    );
  }

  out.push("\n## The third-order coefficient c_3 — the first level-repulsion face (v0.13.0)\n");
  out.push(
    "\nTHE THIRD-ORDER COEFFICIENT (TC38): lambda_1(p) = 1 - 2p + c_2 p^2 + c_3 p^3 + O(p^4) with c_3(n) an exact two-face rational — the plain quotient <u,Q_3 u>/<u,u> PLUS the FIRST NON-VANISHING LEVEL-REPULSION FACE over the odd Krawtchouk modes (mode gaps exactly 2(j-1)). TC36's repulsion-free gift ends at second order: from c_3 on, the whole odd-Krawtchouk spectrum (TC34's edifice) participates in the decay law.\n",
  );
  out.push("| n | quotient face | repulsion face | c_3 exact | series residual at p=1/100 |");
  out.push("| --- | --- | --- | --- | --- |");
  {
    const p = 0.01;
    for (const n of [4, 6, 8, 10, 12, 16]) {
      const { quotient, repulsion } = thirdOrderFaces(n);
      const q = Number(quotient.num) / Number(quotient.den);
      const r = Number(repulsion.num) / Number(repulsion.den);
      const c3 = thirdOrderClosed(n);
      const resid = Math.abs(spectralArmor(n, p).lambda1 - (1 - 2 * p + secondOrderClosed(n) * p * p + c3 * p ** 3));
      out.push(`| ${n} | ${q.toFixed(9)} | ${r.toFixed(9)} | ${c3.toFixed(12)} | ${resid.toExponential(2)} |`);
    }
  }
  out.push(
    "\nExactness: every piece integer (the BigInt rational layer), the rationals -7/16 and -515/512 at n = 4/6; the three-term series reproduces lambda_1(1/100) to 1e-11..1e-8 across the census — the c_4 p^4 face, the decisive witness; Richardson on the exact eigenvalue agrees within its contamination at every n. The repulsion face is NONZERO at every n >= 4 (0.5625 at n=4: the K_3 mode lives even on the two-point block) — the 'gift continues' hypothesis convicted. Negative control: the quotient-only value misses the series by exactly the repulsion face. The general-n pattern of the rationals is observed, NOT claimed (priced as the next step). Q_3 = three-flip counts -(n-2) two-flip + C(n-1,2) one-flip - C(n,3) diagonal, every (1-p) factor expanded, Dirichlet-truncated — the whole-expression assembly law (b52#1) holding at the next order.\n",
  );

  out.push("\n## The quotient-face law — u as the joint Rayleigh vector (v0.14.0)\n");
  out.push(
    "\nTHE QUOTIENT-FACE LAW (TC39): 3<u,Q_3 u> + (n-2)<u,Q_2 u> = 0 EXACTLY for every even n >= 4 (integer residue zero on the cheap path, n = 4..60) — u is a JOINT Rayleigh vector of the second and third orders, and c_3's quotient face inherits TC37's law verbatim: q(n) = -(n-2)/3 · c_2(n) = -(n-1)(n-2)·C(n-2,(n-2)/2)/(3·2^(n-2)) (spots -1, -5/2, -35/8, -105/16, -1155/128, -3003/256). The cancellation face is DATA with a refutation: the combined c_3 is a small difference of large terms (at n=20: r = 14.114 vs |q| = 21.145, c_3 = -7.032), and the naive 2/3-share hypothesis DIES on the grid — the share 9r/(2(n-2)c_2) crosses 1 between n=18 (0.9943) and n=20 (1.0011) and keeps rising to 1.0240 at n=30, the deficit c_3 + (n-2)c_2/9 flipping sign at the same point. The faces' asymptotic split stays open, re-priced; the combined rational's general-n pattern remains observed, NOT claimed.\n",
  );
  out.push("\n## The coupling closed forms — the repulsion face collapses to binomials (v0.15.0)\n");
  out.push(
    "\nTHE COUPLING CLOSED FORMS (TC40): the repulsion face's every ingredient closes — vv(n,j) = C(n,j)·2^(n-1) (the TRUNCATED Krawtchouk norms equal the classical full norms: the odd modes' antisymmetric reflection doubles the missing half exactly), uu = n·2^(n-1) (u = K_1, same family), and |cpl(n,j)| = 2n(n-1)·C(n-2,m)·C(dim-1,(j-1)/2) — the coupling PROPORTIONAL to c_2's central binomial, the mode structure a clean C(dim-1,k). All three verified by BigInt zero-residue over n = 4..36, every odd mode; the closed addend reproduces the kernel's exact repulsion face at the spot checks. The horizon push by pure substitution (no matrices): the share 9r/(2(n-2)c_2) rises monotonically past its n=18..20 crossing to 1.1078 at n=1024, per-doubling increments shrinking by 2^(-1/2) — the a/√n extrapolation lands at 0.125000 stably across five decades: the limit 9/8 IDENTIFIED BY EXTRAPOLATION, not claimed as a theorem. If it holds: r → (n-2)c_2/4 and c_3 → -(n-2)c_2/12. The proof is the Gaussian asymptotics of the k-sum C(dim-1,k)²/C(n,2k+1) — re-priced.\n",
  );

  out.push("\n## The 9/8 limit, assembled — the third-order face closed (v0.16.0)\n");
  out.push(
    "\nTHE 9/8 LIMIT (TC41): the mode ratio factors EXACTLY into central binomials — C(dim-1,k)^2/C(n,2k+1) = [(dim-1)!^2/(2dim)!]·(2k+1)C(2k,k)·(2j+1)C(2j,j), j = dim-1-k — zero BigInt residue over n = 4..30, every k. With the classical C(2t,t) ~ 4^t/sqrt(pi t), the share assembles to share(n) = 9/8 − a/sqrt(n) + O(1/n), and the machine arbitrates on three fronts: the share is monotone with per-doubling increments shrinking geometrically (ratio ~0.70), so the limit EXISTS and is bracketed by the geometric tail at n=2048 — 9/8 sits inside the bracket to four digits; the first correction a(n) = (9/8 − share(n))·sqrt(n) converges to 0.55091 (stable to five digits over n = 256..2048: 0.551133 → 0.550939 → 0.550907). If the limit holds — and every assembly step is either the exact factorization above or the cited classical asymptotic — then r → (n−2)c_2/4 and c_3 → −(n−2)c_2/12: the decay-law arc's third-order face closes in closed form. Boundary honest: the a-constant's closed form is identified by convergence, not derived; the uniform O(1/n) control over all of k-space remains the cited-classical residue.\n",
  );
  out.push("\n## The arcsine law — the profile behind 9/8, and a's structure (v0.17.0)\n");
  out.push(
    "\nTHE ARCSINE LAW (TC42): the share satisfies the exact chain identity share = P(n)·A(n)·S(n)/4 (P = 9n(n−1)/(2(n−2)), A = C(n−2,m)/2^(n−2), S = the mode sum) — and S's k-profile is the ARCSINE density: S·sqrt(dim)·sqrt(pi) → pi/2, the Beta(1/2, 3/2) integral of sqrt((1−x)/x), measured 1.544113 → 1.567750 over dim = 512..32768 and Richardson-extrapolating to pi/2 = 1.570796. Pushed through the chain, pi/2 reproduces share → 9/8 EXACTLY — an independent confirmation of TC41's bracket by a different route (the profile integral, not the tail bound). The correction constant: a = 0.55087 (two-term law a(n) = a + b/n + O(n^−2), b = 0.0664), and the one-term basis is REFUTED at seven digits (a/sqrt(2/pi) = 0.690412(3) — no small rational) — with the structural explanation: the arcsine profile's x^(−1/2) endpoint singularities feed the 1/sqrt(dim) correction through singular Euler–Maclaurin (zeta-flavored) constants, which is why a is not elementary. Boundary honest: a's full closed form = the singular Euler–Maclaurin constants of the arcsine profile — priced as the decay arc's next step.\n",
  );
  out.push("\n## The correction constant pinned — a at ten digits (v0.18.0)\n");
  out.push(
    "\nTHE CORRECTION CONSTANT (TC43): sigma1 = (share/(9/8) − 1)·sqrt(n) converges monotonically to −0.4896664762 (Richardson over n <= 2^18 with 1/n corrections) — so a = 0.550874786, machine-settled at TEN digits. Every one-term closed candidate is REFUTED at that precision: sigma1·sqrt(pi)/zeta(1/2) = 0.59431544 (no small rational), and the two-element lattice (alpha + beta·zeta(1/2)) finds no small pair either — the constant is genuinely a singular-Euler–Maclaurin composite. Its provenance is now fully mapped: the fixed-k edge law is EXACT — summand(n,k)·dim -> (2k+1)C(2k,k)/(2·4^k·k) for fixed k, verified convergent at k = 1..4 — this is the endpoint mass the singular EM must regularize, each coefficient an exact rational multiple of C(2k,k)/4^k. Boundary honest: the final assembly (the exact singular-EM coefficient of the true profile sqrt((1−x)/x)/sqrt(pi) with its discrete 1/k weighting) is delineated to this one step and priced; the numeric value is settled.\n",
  );
  {
    const t = transferResidual(16384);
    const grid = [16384, 65536, 262144].map((n) => ({ n, v: sigmaFirst(n) }));
    const s1 = richardsonLimit(grid, 1);
    const kappa = kappaFromSigma(s1);
    const kgrid = [16384, 65536, 262144].map((D) => ({ n: D, v: kappaFace(D) }));
    const kappaRoad = richardsonLimit(kgrid, 0.5);
    const series = edgeSeriesAccelerated(1 << 20);
    const phi1 = kappa - series.zetaM;
    const nextLim = richardsonLimit([64, 256, 1024, 4096].map((k) => ({ n: k, v: edgeNextOrder(k) })), 1);
    const second8192 = (edgeNextOrder(8192) - 0.375) * 8192;
    const closure16 = arcClosureRelative(16, s1);
    const phi1FaceResult = phi1Face();
    out.push("\n## The singular Euler–Maclaurin assembly — the constant decomposed (v0.19.0)\n");
    out.push(
      `\nTHE EXACT TRANSFER (TC44): sigma1(n) = G(n)·u(D) − sqrt(n) with G = (2·sqrt(2)/9)·P·A and u = S·sqrt(D) is an ALGEBRAIC IDENTITY in the chain pieces — machine residual ${t.residual.toExponential(2)} at n=16384 — so the limit identity sigma1 = 2·sqrt(2/pi)·kappa carries the ten digits to the S-face constant kappa = ${kappa.toFixed(10)}. kappa's own D-grid road Richardson-confirms to ${Math.abs(kappaRoad - kappa).toExponential(2)} (slow mixed-order convergence; the transfer carries the precision). Through it the arc's third-order face closes at theorem grade: c3(n) = −(n−2)·c2(n)/12·(1 − 3·sigma1/sqrt(n) + O(1/n)), the closure face tracking the exact c3 to ${Math.abs(closure16).toExponential(2)} relative at n=16, declining — TC41's IF now ships as a theorem with its full 1/sqrt(n) correction face.\n`,
    );
    out.push(
      `\nTHE DECOMPOSITION (TC45, CORRECTED at v0.20.0): kappa = zeta_m + Phi1 — an additive split, machine-arbitrated. zeta_m = sum_k(m_k − mu_k) − sqrt(2/pi) = ${series.zetaM.toFixed(9)}, the edge-mass series' generalized-zeta constant, with EXACT per-k terms (m_k = (2k+1)C(2k,k)/(2·4^k·k) as exact rationals, mu_k the midpoint masses) and EXACT next-order laws: E_k·sqrt(pi)·k^{3/2} -> ${nextLim.toFixed(8)} (= 3/8), (E·sqrt(pi)k^{3/2} − 3/8)·k -> ${second8192.toFixed(6)} (= −11/128 = ${-11 / 128}, hand-derived from the central-binomial expansion and the midpoint Taylor). The accelerated series sum(E) = (3/8)zeta(3/2)/sqrt(pi) − (11/128)(3/8)zeta(5/2)/sqrt(pi) + R = ${series.sumE.toFixed(9)} with R = ${series.remainder.toFixed(9)} an explicit k^(−7/2)-convergent remainder — THE STRUCTURAL EXPLANATION of the zeta(1/2) refutations stands: the constant is zeta(3/2)/zeta(5/2)-flavored plus an explicit remainder, not a zeta(1/2) composite. And Phi1 = kappa − zeta_m = ${phi1.toExponential(4)} — WITH THE v0.20.0 zetaEM SIGN FIX: the v0.19.0 reading here (−4.547e-4, "SMALL BUT NONZERO") was the Euler–Maclaurin tail's sign error wearing a physical story; the corrected Phi1 sits INSIDE TC47's certified bracket [${phi1FaceResult.lo.toExponential(4)}, ${phi1FaceResult.hi.toExponential(4)}] which CONTAINS ZERO — the sharp-cutoff assembly closes within the certified error (the F-function's singular face remains the priced sub-bracket residue; f(0) = 1 still witnessed in the TC45 test). Boundary honest: Phi1's fate inside the bracket is open, not faked — a's value unchanged at ten digits.\n`,
    );
  }

  // v0.20.0 — TC46/TC47
  {
    out.push("\n## The isolated echo laws — the tautology convicted and re-verified (v0.20.0)\n");
    out.push(
      "\nTHE CONVICTION (TC46, route-price v0.2.0's cross-check confirmed): the v0.2.0 lifetime witness verified the isolated echo's 'geometric decay' |m(k)| = |cos 2 delta|^k against ITSELF — the test, the audit witness W-H, and scratch-life.ts all iterated the formula (m *= c) and compared it to the closed form built from the same c, so the verification could not fail for ANY c. The independent kernel path (a real two-level simulation through the family Floquet builder) convicts the law: the COHERENT isolated qubit never decays — m(k) = (-1)^k cos 2k delta EXACTLY, the detuned rotor (YAO17's beating/peak-splitting; a coherent closed system cannot decay geometrically). The geometric law survives where it is actually true — the DEPHASED drive: under per-period sign noise eps_j = ±delta, E[m~(k)] = (cos 2 delta)^k EXACTLY (independence of the sign product), verified exhaustively over ALL 2^k sign sequences and by Monte Carlo beyond.\n",
    );
    out.push("| delta | coherent law residual (k<=40) | v0.2.0 law deviation (the conviction) | first coherent crossing (vs retired tau*) | dephased exhaustive dev (k=8/12) |\n");
    out.push("| --- | --- | --- | --- | --- |\n");
    for (const d of [0.1, 0.2, 0.3]) {
      const trajFirst = (() => {
        const traj = isolatedEchoTrajectory(d, 0, 100);
        const idx = traj.findIndex((m) => Math.abs(m) < 0.5);
        return idx < 0 ? -1 : idx + 1;
      })();
      const exhaustive = Math.max(
        Math.abs(dephasedEchoExpectationExact(d, 8) - Math.cos(2 * d) ** 8),
        Math.abs(dephasedEchoExpectationExact(d, 12) - Math.cos(2 * d) ** 12),
      );
      out.push(
        `| ${d} | ${coherentEchoLawDeviation(d, 40).toExponential(2)} | ${convictedLawDeviation(d, 40).toFixed(3)} | ${trajFirst} (vs ${isolatedEchoLifetime(d, 0.5)}) | ${exhaustive.toExponential(2)} |`,
      );
    }
    out.push(
      "\nThe benchmark lifetime tau* = ln theta / ln|cos 2 delta| is thereby the DEPHASED expected-echo crossing (MC margins: E[m~] = 0.5161 -> 0.4733 at k = 8/9 for delta = 0.2; 0.5604 -> 0.4627 at k = 3/4 for delta = 0.3), and the chain's protection factors (the cliff table above) stand unchanged. The tautology itself is preserved as the negative control: handed the WRONG constant |cos 3 delta| it certifies it just as happily — named, rejected. Anchors: YAO17's decoupled-echo beating (cited), the 2024-2026 prethermal-DTC stability line (YSB25 PRB 111, MOO26 Nat. Phys. 22 — cited, citations.md).\n",
    );

    const face = phi1Face();
    const struct = phi1GridStructure();
    out.push("\n## The Phi1 machine bracket — the zetaEM sign bug found, the nonzero claim retired (v0.20.0)\n");
    out.push(
      `\nTHE SECOND CONVICTION (TC47): re-deriving TC45's error budget exposed a SIGN ERROR in zetaEM's Euler–Maclaurin tail — the (1/2)N^{-s} term was ADDED where the expansion subtracts it, a +N^{-s} error with an exact fingerprint (err(60) = 60^{-1.5} = 2.1517e-3 on zeta(3/2), err(120) = 120^{-1.5}, err(2.5) = 60^{-2.5} — every digit matches). The contamination +4.542e-4 on zetaFace is numerically almost exactly TC45's reported "Phi1 = -4.547e-4, SMALL BUT NONZERO": the constant was the bug. With the sign fixed (certified by N = 60/120/240 agreement at ~1e-10 where the buggy road disagreed at 1e-3): zeta_m = ${face.zetaM.toFixed(12)}, sum(E) = ${(face.zetaM + Math.sqrt(2 / Math.PI)).toFixed(9)}, and Phi1 = kappa - zeta_m = ${face.point.toExponential(4)}, machine-bracketed to |Phi1| <= ${Math.max(Math.abs(face.lo), Math.abs(face.hi)).toExponential(3)} — THE BRACKET CONTAINS ZERO: the sharp-cutoff assembly closes within the certified error, and whether Phi1 is exactly zero or a sub-bracket constant is left open (NO fake closed form).\n`,
    );
    out.push("| piece | value | what it is |\n");
    out.push("| --- | --- | --- |\n");
    out.push(`| sigma1 point | ${face.sigma1.toFixed(12)} | TC43's grid on the new incremental share road |\n`);
    out.push(`| kappa (transfer) | ${face.kappa.toFixed(12)} | sigma1 / (2 sqrt(2/pi)), the exact transfer |\n`);
    out.push(`| eps_kappa | ${face.epsKappa.toExponential(4)} | cross-family Richardson spread (4 combos, no shared points) |\n`);
    out.push(`| eps_zeta | ${face.epsZeta.toExponential(4)} | series k^{-7/2} tail + fixed zetaEM N-truncation |\n`);
    out.push(`| Phi1 bracket | [${face.lo.toExponential(4)}, ${face.hi.toExponential(4)}] | contains ZERO — the certified bound |\n`);
    out.push(
      `\nThe roads behind it: a NEW incremental-binomial share/kappa road (per-step quotient recurrences; the log-factorial tables' ulp random-walk is what drifts the old road ~1e-4 by n = 2^20), cross-validated against the old roads (share to ${Math.abs(shareFloatIncremental(65536) / shareFloat(65536) - 1).toExponential(2)} relative at n = 2^16, kappa to ${kappaRoadCrossDeviation(65536).toExponential(2)} at D = 2^16); the independent kappa(D) road confirms the transfer kappa to ${face.kappaRoadDeviation.toExponential(2)} — 8x tighter than v0.19's 4.7e-5 confirmation. The D-grid structure certified: Phi1(D) negative and monotone rising on D = 2^12..2^20, increment ratios ${struct.incrementRatios.map((r) => r.toFixed(3)).join("/")} (the 1/sqrt(D) face; the D = 2^22 road point is a named outlier, excluded). Fake brackets are rejected BY NAME by the checker: over-narrow brackets are over-precision fraud, not tighter results.\n`,
    );
  }
  out.push("\n## B4 — the tariff table (per run, units of kT ln 2, equal error)\n");
  const tt = tariffTable();
  out.push("| machine | garbage | readout | units | note |");
  out.push("| --- | --- | --- | --- | --- |");
  for (const r of tt.rows) {
    out.push(`| ${r.machine} | ${r.garbageBits} | ${r.readoutBits} | ${r.units} | ${r.note} |`);
  }
  const jp5 = joulePrices(5);
  const jp9 = joulePrices(9);
  out.push(
    `\nJoule prices: 5 units = ${jp5.t300.toExponential(4)} J at 300 K; 9 units = ${jp9.t10mK.toExponential(4)} J at 10 mK (k = 1.380649e-23 J/K exact, SI 2019; ln 2 by quadrature).`,
  );

  out.push("\n## B6 — the tombstone\n");
  const t = tombstoneCensus(5, 1.0, 0.7, 7);
  out.push(
    `\nTI chain n=5 (J=1, h=0.7), gap ${t.gap.toFixed(4)}: ground stationarity ${t.groundWorst.toExponential(2)}, thermal ${t.thermalWorst.toExponential(2)}; the spent battery swings with amplitude ${t.batteryAmplitude.toFixed(4)} at the Bohr period, exact to ${t.batteryPeriodError.toExponential(2)}; the eigenbasis and projector roads agree to ${t.crossValidationError.toExponential(2)}; the solver reconstructs H to ${t.solverReconstruction.toExponential(2)}.`,
  );

  out.push("\n## Witnesses\n");
  for (const w of runWitnesses()) {
    out.push(`- **${w.witness}**: ${w.ok ? "PASS" : "FAIL"} — ${w.detail}`);
  }

  out.push(
    "\n## The certificate\n\nAt equal error, per the legislated criterion, the winner is **" +
      tt.winner +
      "** — the clock is overhead, not engine (D1-M4's pre-announcement, now with numbers). The zero is the ideal closed model's; every deviation pays: garbage (5 units), detuning (W_0 = J(n-1)sin^2 2delta), readout (the P1/P2 schedule), armor maintenance (the syndrome meter, TC27). Boundaries on the same line: hardware instantiation NOT claimed (MI22) — clock-register noise and its majority repair are modeled at the keying layer since v0.5.0 (TC25–TC27); hardware fault tolerance remains MI22's wall. The eternal beat computes the same program every cycle; halt is a reading, and every reading is metered.\n",
  );
  return out.join("\n");
}

function main(): void {
  const content = renderBoard();
  const path = writeReport("the-dtc-clock.md", content);
  console.log(`rendered ${path}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]!).href) {
  main();
}
