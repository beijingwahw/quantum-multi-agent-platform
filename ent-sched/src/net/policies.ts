/**
 * Scheduling policies. Everything here answers the same question: who owns
 * each entanglement-generation attempt slot, and when do pairs get swapped,
 * purified, or held. The policies see only what the engine's view exposes: in
 * oracle mode that is physical truth; under a SensorPlan (v0.2) the same
 * accessors return the belief mirror maintained from calibration estimates
 * (src/net/sensors.ts) — the policies are estimator-agnostic by construction.
 *
 *  - SwapAsapPolicy : classic nested repeater — merge adjacent segments the
 *                     moment they exist (minimum latency, maximum swap-failure
 *                     exposure).
 *  - SwapLatePolicy : hold elementary pairs until the whole path is tiled,
 *                     then cascade all swaps in one round (make-before-break).
 *  - TdmPolicy      : time-division — one request owns the whole network per
 *                     epoch (no spatial multiplexing; the strawman).
 *  - ErsPolicy      : entanglement-resource scheduler — k-path routing with
 *                     readiness-aware path choice, deficit-fair attempt-slot
 *                     arbitration, fidelity-aware purification ladder.
 */

import { purify2to1, swapBell } from "../physics/ops.js";
import type {
  EngineView,
  Pair,
  Policy,
  PurifyAction,
  RequestSpec,
  SwapAction,
} from "./engine.js";
import type { Topology } from "./topology.js";

/**
 * Minimum fidelity gain for a purification to fire. Without it, a champion
 * pair "grazes" plateau runners for +5e-5 gains, consuming the material
 * needed to build near-equal partners — the ladder then saturates below
 * target (measured: 0.9497 < 0.95 with F0=0.85, 3 slots, grazing on).
 */
const MIN_GAIN = 1e-3;

/** Split a link's free slots among candidate owners, round-robin from a rotating pointer. */
function allocateRoundRobin(
  st: EngineView,
  candidates: (linkId: string) => string[],
  pointers: Map<string, number>
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const l of st.net.links) {
    const cands = candidates(l.id);
    if (cands.length === 0) continue;
    const free = st.freeSlots(l.id);
    if (free <= 0) continue;
    const start = pointers.get(l.id) ?? 0;
    const owners: string[] = [];
    for (let s = 0; s < free; s++) owners.push(cands[(start + s) % cands.length]!); // cands.length > 0 checked above
    pointers.set(l.id, (start + free) % cands.length);
    out.set(l.id, owners);
  }
  return out;
}

/** Requests whose assigned path crosses the link, in stable order. */
function requestsOnLink(pathByRequest: Map<string, string[]>, linkId: string): string[] {
  const out: string[] = [];
  for (const [rid, links] of pathByRequest) if (links.includes(linkId)) out.push(rid);
  return out;
}

/**
 * Exact tiling of `path` by same-owner segments: an interval exact-cover DP
 * (a greedy first-fit pick silently kills tilings when a short segment with a
 * small id shadows the only long cover of a position — hit live on 6-hop
 * chains). Returns pairs in path order, or null when no exact cover exists.
 */
export function tilePath(
  st: EngineView,
  owner: string,
  path: readonly string[]
): Pair[] | null {
  if (path.length === 0) return null;
  const pos = new Map(path.map((l, i) => [l, i] as const));
  const segments = st
    .pairsOf(owner)
    .filter((p) => p.links.every((l) => pos.has(l)))
    .sort((x, y) => (pos.get(x.links[0]!) ?? 0) - (pos.get(y.links[0]!) ?? 0) || x.id - y.id); // every kept link is in pos (filter above)
  const n = path.length;
  // dp[i]: positions i..n−1 can be exactly covered; pick[i]: segment used at i
  const dp = new Array<boolean>(n + 1).fill(false);
  dp[n] = true;
  const pick = new Array<number>(n).fill(-1);
  for (let i = n - 1; i >= 0; i--) {
    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s]!; // s < segments.length (loop bound)
      const start = pos.get(seg.links[0]!) ?? -1; // links non-empty on every Pair
      if (start !== i) continue;
      if (dp[i + seg.links.length]) {
        dp[i] = true;
        pick[i] = s;
        break;
      }
    }
  }
  if (!dp[0]) return null;
  const out: Pair[] = [];
  let i = 0;
  while (i < n) {
    // reconstruction only walks positions with dp[i] true, and pick[i] was
    // set exactly at those positions by the DP above
    const seg = segments[pick[i]!]!;
    out.push(seg);
    i += seg.links.length;
  }
  return out;
}

/** Fidelity the tiling would deliver right now (Werner-aware fold). */
export function projectedFidelity(
  st: EngineView,
  tiling: readonly Pair[]
): number {
  if (tiling.length === 0) throw new Error("projectedFidelity: empty tiling");
  let vec = st.currentVec(tiling[0]!, st.round);
  for (let i = 1; i < tiling.length; i++)
    vec = swapBell(vec, st.currentVec(tiling[i]!, st.round)); // i < tiling.length (loop bound)
  return vec[0]!; // Bell vectors are length 4 by construction
}

/** Adjacent same-owner merges available right now (orientation-agnostic). */
function adjacentMerges(st: EngineView, owner: string): SwapAction[] {
  const pairs = st.pairsOf(owner);
  const used = new Set<number>();
  const out: SwapAction[] = [];
  const touches = (p: Pair, node: string): string | null => {
    // every Pair carries at least one elementary link (engine construction)
    if (p.endA === node) return p.links[0]!;
    if (p.endB === node) return p.links[p.links.length - 1]!;
    return null;
  };
  for (const p of pairs) {
    if (used.has(p.id)) continue;
    for (const q of pairs) {
      if (used.has(p.id)) break;
      if (q.id === p.id || used.has(q.id)) continue;
      let shared: string | null = null;
      if (touches(p, q.endA) !== null) shared = q.endA;
      else if (touches(p, q.endB) !== null) shared = q.endB;
      if (shared === null) continue;
      const lp = touches(p, shared);
      const lq = touches(q, shared);
      if (lp === null || lq === null || lp === lq) continue; // same boundary link
      out.push({ left: p.id, right: q.id });
      used.add(p.id);
      used.add(q.id);
    }
  }
  return out;
}

/** Shared machinery for the two single-path chain policies. */
function makePathPolicy(
  name: string,
  topo: Topology,
  requests: readonly RequestSpec[],
  mode: "asap" | "late"
): Policy {
  const pathByRequest = new Map<string, string[]>();
  for (const r of requests) {
    const p = topo.shortestPath(r.src, r.dst);
    if (!p) throw new Error(`request ${r.id}: no path ${r.src}→${r.dst}`);
    pathByRequest.set(r.id, p.links);
  }
  const pointers = new Map<string, number>();
  return {
    name,
    allocateAttempts(st: EngineView): Map<string, string[]> {
      return allocateRoundRobin(
        st,
        (linkId) => requestsOnLink(pathByRequest, linkId),
        pointers
      );
    },
    decideOps(st: EngineView): { swaps: SwapAction[]; purifies: PurifyAction[]; discards: number[] } {
      if (mode === "asap") {
        const swaps: SwapAction[] = [];
        for (const r of st.requests) swaps.push(...adjacentMerges(st, r.id));
        return { swaps, purifies: [], discards: [] };
      }
      const swaps: SwapAction[] = [];
      for (const r of st.requests) {
        const path = pathByRequest.get(r.id)!;
        if (path.length < 2) continue; // single-link requests deliver without swaps
        const tiling = tilePath(st, r.id, path);
        if (!tiling || tiling.length < 2) continue;
        // disjoint joints merge simultaneously (independent BSMs at different
        // nodes); adjacent joints cascade over the next rounds' re-tilings
        for (let i = 0; i + 1 < tiling.length; i += 2)
          swaps.push({ left: tiling[i]!.id, right: tiling[i + 1]!.id }); // i+1 < tiling.length (loop bound)
      }
      return { swaps, purifies: [], discards: [] };
    },
  };
}

export function swapAsapPolicy(topo: Topology, requests: readonly RequestSpec[]): Policy {
  return makePathPolicy("swap-asap", topo, requests, "asap");
}

export function swapLatePolicy(topo: Topology, requests: readonly RequestSpec[]): Policy {
  return makePathPolicy("swap-late", topo, requests, "late");
}

export function tdmPolicy(
  topo: Topology,
  requests: readonly RequestSpec[],
  maxEpochRounds = 400
): Policy {
  if (requests.length === 0) throw new Error("tdm: no requests");
  const paths = new Map<string, string[]>();
  for (const r of requests) {
    const p = topo.shortestPath(r.src, r.dst);
    if (!p) throw new Error(`tdm: no path for ${r.id}`);
    paths.set(r.id, p.links);
  }
  let idx = 0;
  let epochStart = 0;
  let epochDelivered = new Map<string, number>();
  const rotateIfNeeded = (st: EngineView): void => {
    const cur = requests[idx % requests.length]!; // requests non-empty (guarded at construction); idx stays in [0, len)
    const done = st.deliveredCount(cur.id);
    if (st.round - epochStart >= maxEpochRounds || done > (epochDelivered.get(cur.id) ?? 0)) {
      idx = (idx + 1) % requests.length;
      epochStart = st.round;
      epochDelivered = new Map(requests.map((r) => [r.id, st.deliveredCount(r.id)] as const));
    }
  };
  return {
    name: "tdm",
    allocateAttempts(st: EngineView): Map<string, string[]> {
      rotateIfNeeded(st);
      const cur = requests[idx % requests.length]!; // requests non-empty (guarded at construction); idx stays in [0, len)
      const out = new Map<string, string[]>();
      const path = paths.get(cur.id)!;
      for (const l of st.net.links) {
        if (!path.includes(l.id)) continue;
        const free = st.freeSlots(l.id);
        if (free > 0) out.set(l.id, Array.from({ length: free }, () => cur.id));
      }
      return out;
    },
    decideOps(st: EngineView): { swaps: SwapAction[]; purifies: PurifyAction[]; discards: number[] } {
      rotateIfNeeded(st);
      const cur = requests[idx % requests.length]!; // requests non-empty (guarded at construction); idx stays in [0, len)
      return { swaps: adjacentMerges(st, cur.id), purifies: [], discards: [] };
    },
  };
}

export interface ErsOptions {
  /** Candidate paths per request. */
  readonly k?: number;
}

/**
 * ERS: the scheduler treats entanglement as the scheduled resource.
 *  - path choice: readiness (links already holding this request's pairs) then ET
 *  - arbitration: deficit priority — requests with fewer deliveries win slots
 *  - swap timing: coordinated late cascade, gated by projected fidelity
 *  - purification ladder: if the projection misses fMin, purify the weakest
 *    tiled link (2→1) and hold the cascade for a later round
 */
export function ersPolicy(
  topo: Topology,
  requests: readonly RequestSpec[],
  opts: ErsOptions = {}
): Policy {
  const k = opts.k ?? 3;
  const candidates = new Map<string, Array<{ links: string[]; et: number }>>();
  for (const r of requests) {
    const paths = topo.kShortestPaths(r.src, r.dst, k);
    if (paths.length === 0) throw new Error(`ers: no path for ${r.id}`);
    candidates.set(r.id, paths.map((p) => ({ links: p.links, et: p.et })));
  }
  const pairCountOn = (st: EngineView, owner: string, linkId: string): number => {
    const l = st.net.links.find((x) => x.id === linkId);
    if (!l) return 0;
    const a = st.anchoredAt(linkId, l.a).filter((p) => p.owner === owner);
    const b = st.anchoredAt(linkId, l.b).filter((p) => p.owner === owner);
    const ids = new Set(a.map((p) => p.id));
    for (const p of b) ids.add(p.id);
    return ids.size;
  };
  const sticky = new Map<string, string[]>();
  const readiness = (st: EngineView, rid: string, links: readonly string[]): number => {
    let score = 0;
    for (const linkId of links) score += pairCountOn(st, rid, linkId) > 0 ? 1 : 0;
    return score;
  };
  // path stickiness: readiness-following with hysteresis — without it, the
  // scheduler thrashes pairs across alternative paths and no path ever tiles
  // (observed live on the ladder topology: q14 scattered over 3 candidates)
  const choosePath = (st: EngineView, rid: string): string[] => {
    const cands = candidates.get(rid)!;
    const cur = sticky.get(rid);
    const curScore = cur ? readiness(st, rid, cur) : -1;
    let best: { links: string[]; score: number; et: number } | null = null;
    for (const c of cands) {
      const score = readiness(st, rid, c.links);
      if (!best || score > best.score || (score === best.score && c.et < best.et))
        best = { links: c.links, score, et: c.et };
    }
    if (cur && best!.score <= curScore + 1) return cur; // hysteresis margin
    sticky.set(rid, best!.links);
    return best!.links;
  };
  return {
    name: "ers",
    onComplete(_st: EngineView, _pair: Pair): "deliver" | "hold" {
      // strict QoS: ERS never accepts a below-fMin pair; it holds it in
      // memory and keeps purifying. Staleness is bounded by the network's
      // cutoff parameter, not by flushing the ladder top.
      return "hold";
    },
    allocateAttempts(st: EngineView): Map<string, string[]> {
      const chosen = new Map<string, string[]>();
      for (const r of st.requests) chosen.set(r.id, choosePath(st, r.id));
      const out = new Map<string, string[]>();
      for (const l of st.net.links) {
        // deficit priority: fewest deliveries first, stable by request id
        const cands = st.requests
          .filter((r) => chosen.get(r.id)!.includes(l.id))
          .sort((a, b) => st.deliveredCount(a.id) - st.deliveredCount(b.id) || (a.id < b.id ? -1 : 1));
        const free = st.freeSlots(l.id);
        if (cands.length === 0 || free <= 0) continue;
        const owners: string[] = [];
        for (let s = 0; s < free; s++) owners.push(cands[s % cands.length]!.id); // cands.length > 0 checked above
        out.set(l.id, owners);
      }
      return out;
    },
    decideOps(st: EngineView): { swaps: SwapAction[]; purifies: PurifyAction[]; discards: number[] } {
      const swaps: SwapAction[] = [];
      const purifies: PurifyAction[] = [];
      const discards: number[] = [];
      const order = [...st.requests].sort(
        (a, b) => st.deliveredCount(a.id) - st.deliveredCount(b.id) || (a.id < b.id ? -1 : 1)
      );
      for (const r of order) {
        const path = choosePath(st, r.id);
        if (path.length === 0) continue; // adjacent pair: next delivery check handles it
        const tiling = tilePath(st, r.id, path);
        if (!tiling) continue;
        const f = projectedFidelity(st, tiling);
        if (f >= r.fMin) {
          for (let i = 0; i + 1 < tiling.length; i += 2)
            swaps.push({ left: tiling[i]!.id, right: tiling[i + 1]!.id }); // i+1 < tiling.length (loop bound)
          continue;
        }
        // Ladder economics (all learned the hard way, see docs/theory.md):
        //  - only strictly improving pairs fire (mixing at the fresh-fixed
        //    point ≈0.909 is a no-op and would freeze the ladder);
        //  - BOTTOM-UP: among improving pairs take the smallest fHi — small
        //    rungs fuse first, which preserves the champion for a near-equal
        //    partner instead of grazing +0.002 off it;
        //  - pressure relief: frozen (no improving pair) with full slots →
        //    discard the lowest STALE rung (above fresh level) so two fresh
        //    pairs can accumulate and rebuild the ladder.
        let action: { keep: number; sac: number; fHi: number; fOut: number; fSeg: number } | null = null;
        let relief: { discard: number; fSeg: number } | null = null;
        for (const seg of tiling) {
          // seg.links is non-empty on every Pair (engine construction)
          const segFirst = seg.links[0]!;
          const segLast = seg.links[seg.links.length - 1]!;
          const here = st
            .anchoredAt(segFirst, seg.endA)
            .filter((p) => p.owner === r.id)
            .concat(st.anchoredAt(segLast, seg.endB).filter((p) => p.owner === r.id));
          const uniq = new Map(here.map((p) => [p.id, p] as const));
          const sameSegment = (x: Pair): boolean =>
            x.links.length === seg.links.length && x.links.every((l, i) => l === seg.links[i]);
          const onSeg = [...uniq.values()].filter((p) => sameSegment(p));
          const fOf = (p: Pair): number => st.currentVec(p, st.round)[0]!;
          const fSeg = fOf(seg);
          // believed (oracle mode: true) fresh level — the stale-rung threshold
          const f0 = st.believedF0(segFirst);
          const slotsFull = st.freeSlots(segFirst) === 0 || st.freeSlots(segLast) === 0;
          let improved = false;
          for (let i = 0; i < onSeg.length; i++)
            for (let j = i + 1; j < onSeg.length; j++) {
              const pa = onSeg[i]!; // i < onSeg.length (loop bound)
              const pb = onSeg[j]!; // j < onSeg.length (loop bound)
              const hi = fOf(pa) >= fOf(pb) ? pa : pb;
              const lo = hi === pa ? pb : pa;
              const fHi = fOf(hi);
              const { out } = purify2to1(st.currentVec(hi, st.round), st.currentVec(lo, st.round));
              const fOut = out[0]!; // purify2to1 returns a length-4 vector
              if (fOut <= fHi + MIN_GAIN) continue; // degrading, plateau, or grazing mix
              improved = true;
              if (
                !action ||
                fHi < action.fHi - 1e-12 ||
                (Math.abs(fHi - action.fHi) <= 1e-12 && fOut > action.fOut + 1e-12) ||
                fSeg < action.fSeg
              )
                action = { keep: hi.id, sac: lo.id, fHi, fOut, fSeg };
            }
          if (!improved && slotsFull && onSeg.length >= 2) {
            const stale = onSeg.filter((p) => fOf(p) > f0 + 0.01);
            const pool = stale.length > 0 ? stale : onSeg;
            // pool is non-empty: onSeg.length >= 2 checked just above
            const lowest = pool.reduce((a, b) => (fOf(a) <= fOf(b) ? a : b), pool[0]!);
            if (!relief || fSeg < relief.fSeg) relief = { discard: lowest.id, fSeg };
          }
        }
        if (action) purifies.push({ keep: action.keep, sac: action.sac });
        else if (relief) discards.push(relief.discard);
      }
      return { swaps, purifies, discards };
    },
  };
}
