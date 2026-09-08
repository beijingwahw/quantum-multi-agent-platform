import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Rng } from "../src/core/rng.js";
import { randInts } from "../src/core/stats.js";
import { bruteForceMakespanPm, minMakespanP2, minMakespanPm } from "../src/reductions/makespan.js";
import { partitionEquivHolds, partitionYes, reducePartitionToP2 } from "../src/reductions/partition.js";
import {
  bruteForceThreePartition,
  enumeratePromiseInstances,
  genPromiseInstance,
  genYesInstance,
  isThreePartitionSolution,
  solveAndDecode,
  threePartitionEquivHolds,
} from "../src/reductions/threepartition.js";
import { fptasP2, fptasRatio } from "../src/reductions/fptas.js";
import { johnsonOptimal } from "../src/reductions/johnson.js";
import { isingGroundStateParity, isingIdentityHolds, makespanOfZ } from "../src/reductions/ising.js";

describe("T1 reductions", () => {
  const rng = new Rng(11);

  it("Partition <-> P2||Cmax equivalence on random even-total instances", () => {
    for (let t = 0; t < 100; t++) {
      const nums = randInts(rng, 8, 1, 30);
      const total = nums.reduce((a, b) => a + b, 0);
      if (total % 2 !== 0) nums[0] = (nums[0] as number) + 1;
      assert.ok(partitionEquivHolds(nums));
    }
  });

  it("reduction precondition enforced; odd totals rejected", () => {
    assert.throws(() => reducePartitionToP2([1, 2]));
    assert.equal(partitionYes([1, 2]), false);
    assert.equal(partitionYes([2, 2, 3, 3, 6]), true);
  });

  it("P2 exact solver vs explicit small enumeration", () => {
    // n=4, exhaustive over 16 subsets
    const nums = [3, 5, 7, 9];
    let best = Infinity;
    for (let mask = 0; mask < 16; mask++) {
      let s = 0;
      for (let i = 0; i < 4; i++) if ((mask >> i) & 1) s += nums[i] as number;
      best = Math.min(best, Math.max(s, 24 - s));
    }
    assert.equal(minMakespanP2(nums), best);
  });

  it("Pm B&B vs brute force on tiny instances (m^n referee)", () => {
    for (let t = 0; t < 25; t++) {
      const nums = randInts(rng, 4 + rng.int(3), 1, 9);
      const m = 2 + rng.int(2);
      assert.equal(minMakespanPm(nums, m).makespan, bruteForceMakespanPm(nums, m));
    }
  });

  it("3-Partition <-> Pm||Cmax vs exhaustive referee (promise instances)", () => {
    for (const m of [2, 3]) {
      for (let t = 0; t < 10; t++) {
        const inst = genPromiseInstance(rng, m, 16 + 4 * rng.int(4));
        assert.ok(threePartitionEquivHolds(inst, bruteForceThreePartition(inst)));
      }
    }
  });

  it("exhaustive promise-instance enumeration: equivalence on EVERY instance", () => {
    let count = 0;
    let yes = 0;
    for (const B of [20, 24, 28]) {
      for (const inst of enumeratePromiseInstances(2, B)) {
        const witness = bruteForceThreePartition(inst);
        assert.ok(threePartitionEquivHolds(inst, witness));
        if (witness) yes++;
        count++;
      }
    }
    assert.ok(count > 10, "enumeration should produce a meaningful number of instances");
    assert.ok(yes > 0 && yes < count, "both YES and NO shapes present");
  });

  it("YES instances decode into genuine 3-partitions", () => {
    for (let t = 0; t < 15; t++) {
      const inst = genYesInstance(rng, 3, 24);
      const d = solveAndDecode(inst);
      assert.equal(d.solution.makespan <= inst.B, true);
      assert.ok(d.exactlyThreePerMachine);
      assert.ok(isThreePartitionSolution(inst, d.groups));
    }
  });

  it("FPTAS respects (1+eps) against the exact optimum", () => {
    for (const eps of [0.05, 0.1, 0.25]) {
      for (let t = 0; t < 15; t++) {
        const nums = randInts(rng, 10, 1, 40);
        assert.ok(fptasRatio(nums, eps) <= 1 + eps + 1e-9);
      }
    }
  });

  it("FPTAS output is a real schedulable makespan (>= optimum)", () => {
    const nums = [7, 11, 13, 17, 19, 23];
    const opt = minMakespanP2(nums);
    const apx = fptasP2(nums, 0.2);
    assert.ok(apx >= opt);
  });

  it("Johnson's rule matches brute force on random flow shops", () => {
    for (let t = 0; t < 30; t++) {
      const n = 3 + rng.int(5);
      const p1 = randInts(rng, n, 1, 15);
      const p2 = randInts(rng, n, 1, 15);
      assert.ok(johnsonOptimal(p1, p2));
    }
  });

  it("Ising identity and ground-state parity", () => {
    for (let t = 0; t < 15; t++) {
      const nums = randInts(rng, 6 + rng.int(4), 1, 20);
      const z = nums.map(() => (rng.bernoulli(0.5) ? 1 : -1));
      assert.ok(isingIdentityHolds(nums, z));
      assert.equal(makespanOfZ(nums, z) >= minMakespanP2(nums), true);
      assert.ok(isingGroundStateParity(nums));
    }
  });
});
