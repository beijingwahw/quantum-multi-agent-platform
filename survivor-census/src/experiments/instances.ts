/**
 * The instance family. Integer count tables define the prior (c_x tickets in
 * universe x); the marked set defines "the optimum". Seeded, reproducible.
 */

import { Rng } from "../kernel/survivor.js";

export interface Instance {
  readonly name: string;
  readonly n: number;
  readonly counts: readonly number[];
  readonly marked: readonly number[];
  readonly note: string;
}

export function randomCounts(n: number, seed: number, maxC = 7): number[] {
  const N = 2 ** n;
  const rng = new Rng(seed);
  const counts: number[] = [];
  for (let x = 0; x < N; x++) counts.push(1 + Math.floor(rng.next() * maxC));
  return counts;
}

/** indices of the k smallest / k largest counts (ties broken by index) */
export function extremeIndices(counts: readonly number[], k: number, heaviest: boolean): number[] {
  const order = counts.map((c, x) => ({ c, x })).sort((a, b) => (heaviest ? b.c - a.c : a.c - b.c));
  return order.slice(0, k).map((o) => o.x);
}

export function buildInstances(): Instance[] {
  const n = 4;
  const N = 2 ** n;
  const base = randomCounts(n, 201);
  const single = 9;
  const light = extremeIndices(base, 3, false);
  const heavy = extremeIndices(base, 3, true);
  const quarter: number[] = [];
  for (let x = 0; x < N; x += 4) quarter.push(x);
  const unfunded = [...quarter];
  const unfundedCounts = [...base];
  unfundedCounts[unfunded[0]!] = 0;
  const all: number[] = [];
  for (let x = 0; x < N; x++) all.push(x);

  return [
    { name: "t1-fund", n, counts: base, marked: [single], note: "t=1 — the only regime where 'THE optimum' exists to be read (T1 cross-anchor)" },
    { name: "light-optima", n, counts: base, marked: light, note: "optima are the 3 least-funded branches — maximal depreciation direction" },
    { name: "heavy-optima", n, counts: base, marked: heavy, note: "optima are the 3 best-funded branches — minimal depreciation direction" },
    { name: "quarter-funded", n, counts: base, marked: quarter, note: "t=4 spread across the address space" },
    { name: "unfunded-optimum", n, counts: unfundedCounts, marked: unfunded, note: "one marked branch has zero prior weight — optimal on paper, never comes back" },
    { name: "uniform-prior", n, counts: new Array<number>(N).fill(1), marked: quarter, note: "the uniform prior — postselect-sched's home ground (flat register 1/N)" },
    { name: "full-funding", n, counts: base, marked: all, note: "P=1 — every universe optimal: nothing killed, nothing sorted" },
  ];
}

/** the P=0 probe: marked set with zero total funding — the kernel must refuse */
export function p0Probe(): { n: number; counts: number[]; marked: number[] } {
  const n = 4;
  const counts = randomCounts(n, 211);
  counts[3] = 0;
  counts[11] = 0;
  return { n, counts, marked: [3, 11] };
}

export interface StagePair {
  readonly name: string;
  readonly n: number;
  readonly counts: readonly number[];
  readonly markedA: readonly number[];
  readonly markedB: readonly number[];
  readonly note: string;
}

/** the stacked-ledger family for the composition face (S6) */
export function buildStagePairs(): StagePair[] {
  const n = 4;
  const base = randomCounts(n, 201);
  const quarter: number[] = [];
  for (let x = 0; x < 2 ** n; x += 4) quarter.push(x);
  const all: number[] = [];
  for (let x = 0; x < 2 ** n; x++) all.push(x);
  return [
    {
      name: "overlap-3of4",
      n,
      counts: base,
      markedA: quarter,
      markedB: [4, 8, 12, 1],
      note: "stage B keeps 3 of stage A's 4 survivors and tempts one outsider — the generic overlap",
    },
    {
      name: "shrink-inside",
      n,
      counts: base,
      markedA: [0, 1, 2, 3, 4, 5],
      markedB: [2, 3, 4],
      note: "stage B is a strict subset of stage A — pure narrowing",
    },
    {
      name: "identity-stage",
      n,
      counts: base,
      markedA: quarter,
      markedB: all,
      note: "stage B marks everything — the identity filter: composite must equal stage A alone",
    },
    {
      name: "idempotent",
      n,
      counts: base,
      markedA: quarter,
      markedB: quarter,
      note: "the same filter twice — idempotence",
    },
    {
      name: "starved-intersection",
      n,
      counts: base,
      markedA: quarter,
      markedB: [1, 2, 3],
      note: "funded(A) ∩ funded(B) = empty — the composed P=0 refusal, inherited through the chain",
    },
  ];
}
