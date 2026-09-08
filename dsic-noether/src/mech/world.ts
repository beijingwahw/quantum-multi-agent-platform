/**
 * Random GrovesWorld builder with guards: own-report space of K integer bid
 * vectors (index 0 = truthful type), every induced efficient allocation
 * required to have a unique maximizer (exactness arithmetic is then integer
 * AND well-defined — tie-breaking is a DSIC subtlety this prototype excludes
 * by construction, not by silence).
 */
import type { Rng } from "../core/rng.js";
import { KernelError } from "../core/errors.js";
import { randomInstance } from "./instance.js";
import type { GrovesWorld } from "./groves.js";
import { allocationAt } from "./groves.js";

export function buildWorld(rng: Rng, n: number, agent: number, k: number): GrovesWorld {
  for (let attempt = 0; attempt < 200; attempt++) {
    const inst = randomInstance(n, rng);
    const values = inst.values;
    const othersBids: number[][] = [];
    for (let a = 0; a < n; a++) {
      if (a !== agent) othersBids.push([...(values[a] as readonly number[])]);
    }
    const truthful = [...(values[agent] as readonly number[])];
    const reports: number[][] = [truthful];
    for (let j = 1; j < k; j++) {
      reports.push(Array.from({ length: n }, () => rng.intInclusive(1, 60)));
    }
    const w: GrovesWorld = { n, i: agent, othersBids, reports };
    let allUnique = true;
    for (let idx = 0; idx < k; idx++) {
      if (!allocationAt(w, idx).unique) allUnique = false;
    }
    if (allUnique) return w;
  }
  throw new KernelError("world/tie-guard", "buildWorld: could not satisfy unique-argmax guard");
}
