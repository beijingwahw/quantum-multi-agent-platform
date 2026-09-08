/**
 * EXP1 — Executable NP-hardness certificates (the atlas's classical backbone).
 *
 * A: Partition <-> P2||Cmax on random instances
 * B: exhaustive multiset sweep (every instance shape at n=5, values 1..8)
 * C: 3-Partition <-> P||Cmax promise equivalence vs the exhaustive referee
 * D: decoded optimal schedules ARE 3-partitions (the <= direction, run both ways)
 * E: FPTAS ratios for P2||Cmax + unary/binary size gap for the strong variant
 * F: Johnson's rule vs all-permutation brute force (the P island)
 * G: Ising encoding parity: Q(z) = (2C-total)^2 per state, ground state == DP
 */
import { Rng } from "../core/rng.js";
import { randInts } from "../core/stats.js";
import { minMakespanP2, totalOf } from "../reductions/makespan.js";
import { partitionEquivHolds, partitionYes } from "../reductions/partition.js";
import {
  bruteForceThreePartition,
  genPromiseInstance,
  genYesInstance,
  sizeGap,
  solveAndDecode,
  threePartitionEquivHolds,
} from "../reductions/threepartition.js";
import { fptasRatio } from "../reductions/fptas.js";
import { johnsonOptimal } from "../reductions/johnson.js";
import { isingGroundStateParity, isingIdentityHolds } from "../reductions/ising.js";
import { table, writeReport } from "./report.js";
import { pathToFileURL } from "node:url";

function run(): void {
  const rng = new Rng(2026090501);
  const parts: string[] = [];

  // A: random Partition <-> P2
  let yes = 0;
  const gaps: number[] = [];
  for (let t = 0; t < 300; t++) {
    const nums = randInts(rng, 8 + rng.int(12), 1, 30);
    const total = totalOf(nums);
    if (total % 2 !== 0) {
      nums[0] = (nums[0] as number) + 1;
    }
    if (!partitionEquivHolds(nums)) throw new Error(`partition equivalence failed at t=${t}`);
    if (partitionYes(nums)) yes++;
    else gaps.push(minMakespanP2(nums) - totalOf(nums) / 2);
  }
  parts.push(`## A: Partition <-> P2||Cmax (random)\n\n300/300 equivalences hold; ${yes} YES / ${300 - yes} NO. NO instances exceed the target B by a minimum of ${Math.min(...gaps)} (integer gap, never a rounding artifact).\n`);

  // B: exhaustive multiset sweep
  {
    let checked = 0;
    let yesCount = 0;
    const n = 5;
    const a = new Array<number>(n).fill(1);
    const rec = (pos: number, minV: number): void => {
      if (pos === n) {
        const nums = [...a];
        const total = totalOf(nums);
        if (total % 2 === 0) {
          if (!partitionEquivHolds(nums)) throw new Error(`sweep failed on ${nums.join(",")}`);
          if (partitionYes(nums)) yesCount++;
          checked++;
        }
        return;
      }
      for (let v = minV; v <= 8; v++) {
        a[pos] = v;
        rec(pos + 1, v);
      }
    };
    rec(0, 1);
    parts.push(`## B: exhaustive multiset sweep (n=5, values 1..8)\n\n${checked} even-total multisets enumerated exhaustively; equivalence holds on all; ${yesCount} YES (${((100 * yesCount) / checked).toFixed(1)}%). No instance shape is special.\n`);
  }

  // C: 3-partition promise equivalence
  {
    let inst = 0;
    let yesC = 0;
    let nodes = 0;
    for (const m of [3, 4]) {
      for (let t = 0; t < 60; t++) {
        const pi = genPromiseInstance(rng, m, 24 + 8 * rng.int(3));
        const w = bruteForceThreePartition(pi);
        if (!threePartitionEquivHolds(pi, w)) throw new Error(`3-partition equivalence failed`);
        if (w) yesC++;
        nodes += solveAndDecode(pi).solution.nodes;
        inst++;
      }
    }
    parts.push(`## C: 3-Partition <-> P||Cmax (promise instances)\n\n${inst} instances (m=3,4), referee = exhaustive 3-partition solver; equivalence holds on all; ${yesC} YES / ${inst - yesC} NO. Mean B&B nodes per instance: ${(nodes / inst).toFixed(0)} — the exponential meter behind "strong".\n`);
  }

  // D: decode direction
  {
    let ok = 0;
    for (let t = 0; t < 50; t++) {
      const pi = genYesInstance(rng, 4, 28);
      const d = solveAndDecode(pi);
      if (!d.exactlyThreePerMachine || !d.isPartition) throw new Error("decode failed");
      ok++;
    }
    parts.push(`## D: optimal schedules decode into 3-partitions\n\n${ok}/50 generated-YES instances: the B&B optimum has exactly 3 jobs per machine and every machine sums to B — the <= direction is constructive, not just a decision coincidence.\n`);
  }

  // E: FPTAS + size gap
  {
    const rows: Array<readonly string[]> = [];
    for (const eps of [0.02, 0.05, 0.1, 0.2]) {
      let worst = 1;
      for (let t = 0; t < 40; t++) {
        const nums = randInts(rng, 10 + rng.int(14), 1, 50);
        worst = Math.max(worst, fptasRatio(nums, eps));
      }
      rows.push([eps.toFixed(2), worst.toFixed(5), (1 + eps).toFixed(2), worst <= 1 + eps + 1e-9 ? "OK" : "FAIL"]);
    }
    const sg = sizeGap(genYesInstance(rng, 6, 40));
    parts.push(
      `## E: FPTAS for P2||Cmax and the strong-variant size gap\n\n${table(["eps", "worst observed ratio", "1+eps bound", "verdict"], rows)}\n\nStrong side (3-Partition at m=6, B=40): unary size ${sg.unary} vs binary ${sg.binary} — a pseudo-polynomial algorithm in the unary metric would be polynomial; that door is what "strongly NP-hard" closes (GJ78).\n`,
    );
  }

  // F: Johnson
  {
    let ok = 0;
    for (let t = 0; t < 60; t++) {
      const n = 4 + rng.int(5);
      const p1 = randInts(rng, n, 1, 20);
      const p2 = randInts(rng, n, 1, 20);
      if (!johnsonOptimal(p1, p2)) throw new Error("Johnson failed");
      ok++;
    }
    parts.push(`## F: Johnson's rule (F2||Cmax, the P island)\n\n${ok}/60 random instances (n=4..8): Johnson's O(n log n) order attains the all-permutation brute-force optimum. Exactness is machine-checked, not admired.\n`);
  }

  // G: Ising parity
  {
    let identities = 0;
    let parities = 0;
    for (let t = 0; t < 25; t++) {
      const nums = randInts(rng, 7 + rng.int(4), 1, 25);
      const z = nums.map(() => (rng.bernoulli(0.5) ? 1 : -1));
      if (!isingIdentityHolds(nums, z)) throw new Error("Ising identity failed");
      identities++;
      if (!isingGroundStateParity(nums)) throw new Error("ground-state parity failed");
      parities++;
    }
    parts.push(`## G: Ising encoding parity\n\n${identities} per-configuration identities Q(z) = (2*C(z) - total)^2 exact; ${parities}/${parities} ground states match the exact DP optimum (sqrt(min Q) = 2*OPT - total in absolute value). The atlas's quantum rows consume exactly this encoding.\n`);
  }

  const body = `# EXP1 — Executable reduction certificates\n\n${parts.join("\n")}`;
  const file = writeReport("exp1-reductions.md", body);
  console.log(`exp1 done -> ${file}`);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  run();
}
