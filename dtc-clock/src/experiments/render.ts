/**
 * Renders THE DTC CLOCK — ledger row #10's open core executed, one page.
 *
 * Entry guard (house law since batch 21): rendering fires only when this
 * file is the invoked program, so a test's import never executes the render.
 */
import { pathToFileURL } from "node:url";
import { BOARD, type BoardRow } from "../kernel/board.js";
import { checkBoard, DEMO_CIRCUIT, runWitnesses } from "../kernel/audit.js";
import { chainLifetimeCensus, rigidityCensus } from "../kernel/beat.js";
import { detunedCensus, randomClockCensus, readDephasingCensus } from "../kernel/clock.js";
import {
  absorptionRadius,
  delocalizedFlipCensus,
  localizedDepolCensus,
  localizedFlipCensus,
  popcountShadow,
  radiusCensus,
  repairCensus,
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
  out.push("| delta | k | chain \\|m\\| | isolated \\|m\\| |");
  out.push("| --- | --- | --- | --- |");
  for (const r of rigidityCensus(6, [0.05, 0.1, 0.2], 20).filter((r) => r.k === 10 || r.k === 20)) {
    out.push(`| ${r.delta.toFixed(2)} | ${r.k} | ${r.chainAbsM.toFixed(4)} | ${r.isolatedAbsM.toFixed(4)} |`);
  }

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

  out.push("\n## The lifetime law (v0.2.0 — the priced next steps of TC4/TC13, n = 6, threshold 0.5)\n");
  out.push("| delta | tau_iso (closed form) | tau_chain (measured) | protection |\n");
  out.push("| --- | --- | --- | --- |\n");
  for (const r of chainLifetimeCensus(6, [0.1, 0.15, 0.2, 0.3, 0.4], 1500, 0.5)) {
    const prot = r.tauChain > 0 ? `${(r.tauChain / r.tauIso).toFixed(1)}x` : `>${Math.floor(1500 / r.tauIso)}x (locked at 1500)`;
    out.push(`| ${r.delta} | ${r.tauIso} | ${r.tauChain < 0 ? ">1500 (locked)" : r.tauChain} | ${prot} |`);
  }
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
