/**
 * Scratch witness run — numbers FIRST, board text AFTER (house law: run the
 * witness before writing any number into prose). Not the renderer; not a
 * test. `tsx src/experiments/scratch.ts`.
 */
import { makeRng } from "../core/rng.js";
import {
  alternationDeviation,
  flipIdentityDeviation,
  pairingDeviations,
  rigidityCensus,
} from "../kernel/beat.js";
import { fredkinConservesWeight, multiplierVerdict } from "../kernel/compile.js";
import { detunedCensus, orbitRun, randomClockCensus, readDephasingCensus } from "../kernel/clock.js";
import {
  beatEnergyDeviation,
  beatTpmWorkDelta,
  detunedHeatingCensus,
  joulePrices,
  landauerJoules,
  ln2ByQuadrature,
  tariffTable,
} from "../kernel/thermo.js";
import { tombstoneCensus } from "../kernel/tombstone.js";
import type { RevGate } from "../kernel/compile.js";

const rng = makeRng(0xd7c10c);

// B1
const flip = flipIdentityDeviation(rng, 6, 5);
const alt = alternationDeviation(rng, 6, 5, 12);
const pair = pairingDeviations(rng, 6, 3, 4);
console.log("B1 flipIdentity worst:", flip.toExponential(3));
console.log("B1 alternation worst:", alt.toExponential(3));
console.log("B1 pairing odd/even worst:", pair.odd.toExponential(3), pair.even.toExponential(3));
const rig = rigidityCensus(6, [0.05, 0.1, 0.2], 20);
for (const d of [0.05, 0.1, 0.2]) {
  const rows = rig.filter((r) => r.delta === d);
  const last = rows[rows.length - 1]!;
  const k10 = rows.find((r) => r.k === 10)!;
  console.log(`B1 rigidity d=${d}: k=10 chain ${k10.chainAbsM.toFixed(4)} vs iso ${k10.isolatedAbsM.toFixed(4)}; k=20 chain ${last.chainAbsM.toFixed(4)} vs iso ${last.isolatedAbsM.toFixed(4)}`);
}

// B3
const mul = multiplierVerdict();
console.log("B3 multiplier:", JSON.stringify(mul));
console.log("B3 fredkin weight conservation:", fredkinConservesWeight(6, 0, 1, 2));
{
  // independent classical spec: bit0=a1, bit1=a0, bit2=b1, bit3=b0 (wire order)
  const gates = (await import("../kernel/compile.js")).multiplierCircuit();
  const classicalAfter = (await import("../kernel/compile.js")).classicalAfter;
  const productNibble = (await import("../kernel/compile.js")).productNibble;
  let wrong = 0;
  for (let x = 0; x < 16; x++) {
    const a = (((x >> 0) & 1) << 1) | ((x >> 1) & 1); // wire0=a1 (MSB), wire1=a0
    const b = (((x >> 2) & 1) << 1) | ((x >> 3) & 1); // wire2=b1 (MSB), wire3=b0
    const fin = classicalAfter(gates, x, gates.length);
    if (productNibble(fin) !== a * b) {
      wrong++;
      console.log(`  wrong: x=${x.toString(2).padStart(4, "0")} a=${a} b=${b} got ${productNibble(fin)}`);
    }
  }
  console.log("B3 independent spec wrong:", wrong);
}

// B2 quantum composite — small demo circuit
const demo: RevGate[] = [
  { kind: "CNOT", wires: [0, 2] },
  { kind: "TOFFOLI", wires: [0, 1, 2] },
  { kind: "NOT", wires: [2] },
  { kind: "CNOT", wires: [1, 0] },
];
const orbit = orbitRun(rng, 4, demo, 3, 4);
console.log("B2 orbit run:", JSON.stringify(orbit));
const orbit5 = orbitRun(rng, 5, demo, 3, 2);
console.log("B2 orbit run n=5:", JSON.stringify(orbit5));

// B5 census
const rc = randomClockCensus(rng, 4, demo, 3, 3);
console.log("B5 random-clock last rows:", JSON.stringify(rc.slice(-2), null, 0));
for (const d of [0.05, 0.15, 0.3]) {
  const det = detunedCensus(4, d, demo, 3);
  const last = det[det.length - 1]!;
  console.log(`B5 detuned d=${d}: last-fidelity ${last.advanceFidelity.toFixed(4)}, entropy ${last.clockEntropyBits.toFixed(3)}, orderBA ${last.orderBackAction.toFixed(4)}`);
}
const rd = readDephasingCensus(4, 0.1, demo, 3);
const rdLast = rd[rd.length - 1]!;
console.log(`B5 read-dephase q=0.10: last-fidelity ${rdLast.advanceFidelity.toFixed(4)}, entropy ${rdLast.clockEntropyBits.toFixed(3)}, orderBA ${rdLast.orderBackAction.toFixed(4)}`);

// B4
const ln2 = ln2ByQuadrature();
console.log("B4 ln2 quadrature:", ln2.toExponential(12), "vs Math.LN2", Math.LN2.toExponential(12), "dev", Math.abs(ln2 - Math.LN2).toExponential(3));
console.log("B4 landauer 300K:", landauerJoules(300).toExponential(6), "J; 10mK:", landauerJoules(0.01).toExponential(6), "J");
console.log("B4 beat energy deviation:", beatEnergyDeviation(6, Array(5).fill(1.3), 12).toExponential(3));
console.log("B4 beat TPM work escape:", beatTpmWorkDelta(6, Array(5).fill(1.3), 10).toExponential(3));
const dh = detunedHeatingCensus(6, 1.3, 0.1, 15);
console.log("B4 detuned heating: E1 closed dev", dh.e1ClosedFormDeviation.toExponential(3), "W0", dh.w0ClosedForm.toFixed(4), "series[0..2]", dh.workSeries.slice(0, 3).map((w) => w.toFixed(4)).join(","), "chainDrift", dh.chainDrift.toExponential(3), "isoDecay", dh.isolatedDephasedDecay.toExponential(3), "suppression", dh.suppression.toFixed(1));
const tt = tariffTable();
console.log("B4 tariff winner:", tt.winner);
for (const r of tt.rows) console.log("B4 tariff row:", r.machine, "units", r.units);
console.log("B4 joules: 5 units @300K:", joulePrices(5).t300.toExponential(4), "; 9 units @10mK:", joulePrices(9).t10mK.toExponential(4));

// B6
const tomb = tombstoneCensus(5, 1.0, 0.7, 7);
console.log("B6 tombstone n=5:", JSON.stringify(tomb, (_k: string, v: number) => (typeof v === "number" ? Number(v.toPrecision(6)) : v)));
