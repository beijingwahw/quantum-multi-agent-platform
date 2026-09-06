/**
 * Atlas discipline: claims without certificates do not ship.
 *
 * checkAtlas() enforces three rules:
 *   1. every entry carries at least one certificate;
 *   2. every verdict is backed by at least one certificate of the kind the
 *      discipline map demands for that verdict;
 *   3. every citation resolves to the verified bibliography in docs/theory.md
 *      and every cross-prototype certificate points at a workspace prototype
 *      that actually exists on disk.
 *
 * runMachineCertificates() additionally re-executes FAST versions of every
 * machine certificate referenced by the atlas, so `npm test` re-proves the
 * load-bearing numbers on every run.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Rng } from "../core/rng.js";
import { partitionEquivHolds } from "../reductions/partition.js";
import { bruteForceThreePartition, genPromiseInstance, genYesInstance, threePartitionEquivHolds } from "../reductions/threepartition.js";
import { fptasRatio } from "../reductions/fptas.js";
import { johnsonOptimal } from "../reductions/johnson.js";
import { isingGroundStateParity, isingIdentityHolds } from "../reductions/ising.js";
import { groverRun } from "../upper/grover.js";
import { arrayValuation, dhMin } from "../upper/dhmin.js";
import { bbbvCheck, bbbvExactAnchor } from "../lower/bbbv.js";
import { exhaustiveDecisionTrees, randomTreeSpotCheck } from "../lower/classical.js";
import { hoeffdingCoverage, soundness } from "../witness/verify.js";
import { stoqDichotomy } from "../witness/stoq.js";
import { postselectCount, postselectSearch } from "../genealogy/postselect.js";
import { nosignalTrial, singletAnchors } from "../genealogy/nosignal.js";
import { ATLAS } from "./entries.js";
import { REQUIRED_CERTS, VERDOC_ORDER, type AtlasEntry } from "./types.js";

export interface MachineCheck {
  id: string;
  pass: boolean;
  detail: string;
}

function randInts(rng: Rng, n: number, lo: number, hi: number): number[] {
  return Array.from({ length: n }, () => lo + rng.int(hi - lo + 1));
}

export function runMachineCertificates(seed = 20260905): MachineCheck[] {
  const out: MachineCheck[] = [];
  const rng = new Rng(seed);

  // partition <-> P2||Cmax
  {
    let ok = true;
    let n = 0;
    for (let t = 0; t < 80; t++) {
      const nums = randInts(rng, 6 + rng.int(12), 1, 30);
      const total = nums.reduce((a, b) => a + b, 0);
      if (total % 2 !== 0) continue; // reduction precondition: even totals
      if (!partitionEquivHolds(nums)) ok = false;
      n++;
    }
    if (n < 20) ok = false;
    out.push({ id: "partition-reduction", pass: ok, detail: `${n} random instances, equivalence holds` });
  }

  // 3-partition <-> Pm||Cmax, with the exhaustive referee
  {
    let ok = true;
    let yes = 0;
    let no = 0;
    for (const m of [2, 3]) {
      for (const B of [16, 20, 24, 28]) {
        for (let t = 0; t < 6; t++) {
          const inst = genPromiseInstance(rng, m, B);
          const witness = bruteForceThreePartition(inst);
          if (!threePartitionEquivHolds(inst, witness)) ok = false;
          if (witness) yes++;
          else no++;
        }
      }
    }
    for (let t = 0; t < 10; t++) {
      const inst = genYesInstance(rng, 3, 24);
      const decoded = threePartitionEquivHolds(inst, true);
      if (!decoded) ok = false;
      yes++;
    }
    out.push({ id: "threepartition-reduction", pass: ok, detail: `${yes} YES / ${no} NO instances vs exhaustive referee` });
  }

  // Johnson's rule
  {
    let ok = true;
    for (let t = 0; t < 25; t++) {
      const n = 3 + rng.int(5);
      const p1 = randInts(rng, n, 1, 20);
      const p2 = randInts(rng, n, 1, 20);
      if (!johnsonOptimal(p1, p2)) ok = false;
    }
    out.push({ id: "johnson-exact", pass: ok, detail: "25 random instances vs all-permutation brute force" });
  }

  // FPTAS
  {
    let ok = true;
    let worst = 1;
    for (let t = 0; t < 20; t++) {
      const nums = randInts(rng, 8 + rng.int(10), 1, 40);
      for (const eps of [0.05, 0.1, 0.2]) {
        const r = fptasRatio(nums, eps);
        worst = Math.max(worst, r);
        if (r > 1 + eps + 1e-9) ok = false;
      }
    }
    out.push({ id: "fptas-ratio", pass: ok, detail: `worst observed ratio ${worst.toFixed(4)} <= 1+eps on 60 runs` });
  }

  // Ising parity
  {
    let ok = true;
    for (let t = 0; t < 12; t++) {
      const nums = randInts(rng, 6 + rng.int(5), 1, 25);
      const z = nums.map(() => (rng.bernoulli(0.5) ? 1 : -1));
      if (!isingIdentityHolds(nums, z)) ok = false;
      if (!isingGroundStateParity(nums)) ok = false;
    }
    out.push({ id: "ising-parity", pass: ok, detail: "Q(z) = (2C-total)^2 per state; ground state == DP optimum" });
  }

  // Grover closed form == exact simulation
  {
    const N = 1024;
    const run = groverRun(N, [777]);
    const agree = Math.abs(run.successClosedForm - run.successExact) <= 1e-12;
    out.push({
      id: "grover-three-way",
      pass: agree && run.successExact >= 0.99,
      detail: `N=${N} unique marked: k*=${run.k}, success=${run.successExact.toFixed(6)}, classical same budget=${run.classicalSameQueries.toFixed(6)}`,
    });
  }

  // Durr-Hoyer
  {
    let ok = true;
    let maxQueriesPerRootN = 0;
    for (let t = 0; t < 6; t++) {
      const vals = randInts(rng, 256, 1, 10 ** 6);
      const r = dhMin(arrayValuation(vals), rng);
      if (!r.optimal) ok = false;
      maxQueriesPerRootN = Math.max(maxQueriesPerRootN, r.queries / Math.sqrt(256));
    }
    out.push({
      id: "dh-min",
      pass: ok && maxQueriesPerRootN < 25,
      detail: `6 seeds N=256 all optimal; max queries/√N = ${maxQueriesPerRootN.toFixed(2)}`,
    });
  }

  // BBBV
  {
    let ok = bbbvExactAnchor(256);
    let detail = "q=1 anchor exact 2/√N; ";
    for (const q of [1, 4, 8, 12]) {
      const c = bbbvCheck(256, q);
      ok = ok && c.lemmaHolds && c.corollaryHolds;
      detail += `q=${q}: dist ${c.maxDist.toFixed(4)}<=${c.hybridBound.toFixed(4)}, succ ${c.maxSuccess.toFixed(5)}<=${c.corollaryBound.toFixed(5)}; `;
    }
    out.push({ id: "bbbv-hybrid", pass: ok, detail });
  }

  // classical decision trees
  {
    const sweep1 = exhaustiveDecisionTrees(8, 2);
    const sweep2 = exhaustiveDecisionTrees(6, 3);
    const spot = randomTreeSpotCheck(64, 6, 5000, seed);
    const ok =
      sweep1.maxUniform === 2 / 8 &&
      sweep1.allWithinCap &&
      sweep2.maxUniform === 3 / 6 &&
      sweep2.allWithinCap &&
      spot.maxUniform <= spot.cap + 1e-12;
    out.push({
      id: "classical-trees",
      pass: ok,
      detail: `full trees (8,2): ${sweep1.trees} max=${sweep1.maxUniform}; (6,3): ${sweep2.trees} max=${sweep2.maxUniform}; spot check (64,6): max=${spot.maxUniform.toFixed(5)}<=${spot.cap.toFixed(5)}`,
    });
  }

  // stoquastic dichotomy
  {
    const n = 4;
    const instances = Array.from({ length: 10 }, () => {
      const J = Array.from({ length: 6 }, (_, k) => {
        const i = k % 3;
        return { i, j: i + 1, w: rng.bernoulli(0.5) ? 1 : -1 };
      });
      const h = randInts(rng, n, -3, 3);
      const xx = [
        { i: 0, j: 1 },
        { i: 2, j: 3 },
      ];
      return { J, h, xx };
    });
    const v = stoqDichotomy(n, 1, 0.5, instances);
    out.push({
      id: "stoq-dichotomy",
      pass: v.dichotomyHolds,
      detail: `stoq max off-diag = ${v.stoqMaxOffDiag} (= -Gamma), nonstoq = ${v.nonStoqMaxOffDiag} (= +kappa)`,
    });
  }

  // witness verification law
  {
    const nums = randInts(rng, 8, 1, 20);
    const dim = 2 ** nums.length;
    const w = { amps: Array.from({ length: dim }, () => 1 / Math.sqrt(dim)) };
    const grid = [
      { eps: 2, delta: 0.1 },
      { eps: 1, delta: 0.1 },
      { eps: 1, delta: 0.05 },
    ];
    const cov = hoeffdingCoverage(nums, w, grid, 400, seed);
    const total = nums.reduce((a, b) => a + b, 0);
    const B = total / 2;
    const eps = Math.max(1, (total - B) / 8);
    const snd = soundness(nums, B, eps, 0.1, [1, 2], 400, seed + 1);
    const ok = cov.every((c) => c.holds) && snd.every((s) => s.holds);
    out.push({
      id: "witness-law",
      pass: ok,
      detail: `coverage ${cov.map((c) => c.empiricalCoverage.toFixed(3)).join("/")} at delta 0.1/0.05; rejection ${snd.map((s) => s.rejectionRate.toFixed(3)).join("/")}`,
    });
  }

  // genealogy: postselection depreciation ledger (exp6 machinery)
  {
    let ok = true;
    let worstLedgerRatio = 0;
    const detail: string[] = [];
    for (const n of [4, 8, 12]) {
      const N = 2 ** n;
      const marked = [rng.int(N)];
      const r = postselectSearch(n, marked);
      const ratio = r.expectedRepetitions / r.groverRestartQueries;
      worstLedgerRatio = Math.max(worstLedgerRatio, ratio);
      if (Math.abs(r.pSuccess - 1 / N) > 1e-12) ok = false;
      if (r.conditionalFidelity < 1 - 1e-12) ok = false;
      if (r.expectedRepetitions + 1e-9 < r.groverRestartQueries) ok = false;
      detail.push(`n=${n}: P=2^-${n} exact, fidelity=${r.conditionalFidelity.toFixed(12)}, ledger/E*=${ratio.toFixed(1)}`);
    }
    const g: boolean[] = [];
    const h: boolean[] = [];
    for (let x = 0; x < 256; x++) {
      g.push(rng.bernoulli(0.4));
      h.push(rng.bernoulli(0.5));
    }
    const c = postselectCount(8, g, h);
    if (c.deviation > 1e-12) ok = false;
    out.push({ id: "postselect-ledger", pass: ok, detail: `${detail.join("; ")}; counting ratio ${c.conditionalRatio.toFixed(6)} vs brute ${c.bruteRatio.toFixed(6)}` });
  }

  // genealogy: no-signaling withdrawal clause (exp6 machinery)
  {
    let worstMarginal = 0;
    let minJoint = Number.POSITIVE_INFINITY;
    for (let t = 0; t < 5; t++) {
      const r = nosignalTrial(rng);
      worstMarginal = Math.max(worstMarginal, r.marginalUnitary, r.marginalCptp);
      minJoint = Math.min(minJoint, r.jointUnitary, r.jointCptp);
    }
    const sa = singletAnchors(rng, 8);
    const ok = worstMarginal <= 1e-12 && minJoint > 0.05 && sa.marginalMaxDev <= 1e-15 && sa.correlationMaxErr <= 1e-15 && sa.chshErr <= 1e-12;
    out.push({
      id: "nosignal-withdrawal",
      pass: ok,
      detail: `B-marginal worst ${worstMarginal.toExponential(2)} under unitary+CPTP (joint HS >= ${minJoint.toFixed(3)}); singlet marginal ${sa.marginalMaxDev.toExponential(2)}, corr ${sa.correlationMaxErr.toExponential(2)}, CHSH err ${sa.chshErr.toExponential(2)}`,
    });
  }

  return out;
}

const repoRoot = resolve(import.meta.dirname, "../..");
const workspaceRoot = resolve(repoRoot, "..");

function crossPrototypeExists(ref: string): boolean {
  return existsSync(resolve(workspaceRoot, ref));
}

let bibliographyCache: string[] | null = null;

function bibliographyIds(): string[] {
  if (bibliographyCache === null) {
    const file = resolve(repoRoot, "docs/theory.md");
    const text = readFileSync(file, "utf8");
    bibliographyCache = [...text.matchAll(/^\s*-\s*\*\*([A-Z0-9]+)\*\*/gm)].map((m) => m[1] as string);
  }
  return bibliographyCache;
}

export interface AtlasCheck {
  violations: string[];
  entries: readonly AtlasEntry[];
}

export function checkAtlas(): AtlasCheck {
  const violations: string[] = [];
  const bib = bibliographyIds();

  for (const entry of ATLAS) {
    if (entry.certs.length === 0) {
      violations.push(`${entry.id}: no certificates`);
      continue;
    }
    const kinds = entry.certs.map((c) => c.kind);
    const required = REQUIRED_CERTS[entry.verdict];
    if (!kinds.some((k) => required.includes(k))) {
      violations.push(`${entry.id}: verdict ${entry.verdict} requires one of [${required.join(", ")}], got [${kinds.join(", ")}]`);
    }
    for (const cert of entry.certs) {
      if (cert.kind === "citation" && !bib.includes(cert.ref)) {
        violations.push(`${entry.id}: citation ${cert.ref} not in docs/theory.md bibliography`);
      }
      if (cert.kind === "cross-prototype" && !crossPrototypeExists(cert.ref)) {
        violations.push(`${entry.id}: cross-prototype path ${cert.ref} missing on disk`);
      }
    }
  }

  return { violations, entries: ATLAS };
}

export function verdictGroups(): ReadonlyMap<string, AtlasEntry[]> {
  const map = new Map<string, AtlasEntry[]>();
  for (const v of VERDOC_ORDER) map.set(v, []);
  for (const e of ATLAS) {
    const list = map.get(e.verdict) as AtlasEntry[];
    list.push(e);
  }
  return map;
}
