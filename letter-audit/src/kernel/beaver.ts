/**
 * The Busy-Beaver ladder — the origin claim's precise form, machine-executed.
 *
 * Model (self-defined, census is our own output; only the BB maxima are
 * external, cited): n-state 2-symbol Turing machines on a blank tape. Each
 * (state, symbol) entry is a digit d in 0..4(n+1)-1 decoding as
 *
 *   write = floor(d / (2(n+1)))
 *   rest  = d % (2(n+1))
 *   move  = floor(rest / (n+1)) === 0 ? -1 : +1
 *   next  = (rest % (n+1)) === n ? HALT : (rest % (n+1))
 *
 * so a machine is an array of 2n digits, and the universe has (4(n+1))^(2n)
 * machines. 'Completion' of a universe = the step after the last halter
 * halts = its Busy-Beaver step. The census stabilizes exactly there.
 *
 * Every public entry below rejects malformed input BY NAME (EA:MACHINE /
 * EA:TETRATE / EA:TOWER-*) — a short entry table or an out-of-range digit
 * used to flow into the simulation as `undefined`/NaN and return silent
 * garbage; now it dies at the boundary with the offending value in the
 * message.
 */
import { AuditError } from "./errors.js";

export const HALT = -1;

export interface TMachine {
  readonly n: number;
  readonly entries: readonly number[];
}

/** State counts are positive integers — the universe arithmetic assumes it. */
function checkUniverse(n: number, fn: string): void {
  if (!Number.isInteger(n) || n < 1) {
    throw new AuditError("EA:MACHINE", `${fn}: state count must be a positive integer, got ${n}`);
  }
}

export function machines(n: number): number {
  checkUniverse(n, "machines");
  return (4 * (n + 1)) ** (2 * n);
}

export function decode(n: number, code: number): TMachine {
  checkUniverse(n, "decode");
  const total = machines(n);
  if (!Number.isInteger(code) || code < 0 || code >= total) {
    throw new AuditError("EA:MACHINE", `decode: machine code must be an integer in 0..${total - 1}, got ${code}`);
  }
  const entries: number[] = [];
  let c = code;
  for (let i = 0; i < 2 * n; i++) {
    entries.push(c % (4 * (n + 1)));
    c = Math.floor(c / (4 * (n + 1)));
  }
  return { n, entries };
}

/**
 * A machine is legal iff it has exactly 2n entries, each an integer digit in
 * 0..4(n+1)-1. Outside that range `write` leaves {0,1} and the ones-counter
 * silently loses track — so the boundary check is load-bearing, not cosmetic.
 */
function checkMachine(m: TMachine): void {
  checkUniverse(m.n, "simulate");
  const span = 4 * (m.n + 1);
  if (m.entries.length !== 2 * m.n) {
    throw new AuditError(
      "EA:MACHINE",
      `simulate: a ${m.n}-state machine needs exactly ${2 * m.n} entries, got ${m.entries.length}`,
    );
  }
  for (let i = 0; i < m.entries.length; i++) {
    const d = m.entries[i];
    if (d === undefined || !Number.isInteger(d) || d < 0 || d >= span) {
      throw new AuditError("EA:MACHINE", `simulate: entry ${i} must be an integer in 0..${span - 1}, got ${d}`);
    }
  }
}

export interface SimResult {
  readonly halted: boolean;
  readonly steps: number;
  readonly ones: number;
}

/** Simulate up to `bound` steps on a blank tape; returns halting status, steps taken, ones written. */
export function simulate(m: TMachine, bound: number): SimResult {
  checkMachine(m);
  if (!Number.isInteger(bound) || bound < 0) {
    throw new AuditError("EA:MACHINE", `simulate: step bound must be a non-negative integer, got ${bound}`);
  }
  const span = 2 * (m.n + 1);
  let state = 0;
  let pos = 0;
  let steps = 0;
  let ones = 0;
  const tape = new Map<number, number>();
  while (state !== HALT && steps < bound) {
    const sym = tape.get(pos) ?? 0;
    const d = m.entries[state * 2 + sym]!; // checkMachine proved the table total
    const write = Math.floor(d / span);
    const rest = d % span;
    const move = Math.floor(rest / (m.n + 1)) === 0 ? -1 : 1;
    const nextRaw = rest % (m.n + 1);
    const next = nextRaw === m.n ? HALT : nextRaw;
    if (write === 1 && (tape.get(pos) ?? 0) === 0) ones++;
    if (write === 0 && (tape.get(pos) ?? 0) === 1) ones--;
    tape.set(pos, write);
    pos += move;
    state = next;
    steps++;
  }
  return { halted: state === HALT, steps, ones };
}

export interface Census {
  readonly n: number;
  readonly bound: number;
  readonly halted: number;
  readonly maxSteps: number;
  readonly censusAt: readonly number[]; // halted count after each step, up to maxSteps+2
}

/** Enumerate the whole universe up to `bound`; record the step-by-step halting census. */
export function census(n: number, bound: number): Census {
  const total = machines(n);
  const halted = new Array<number>(bound + 1).fill(0);
  let count = 0;
  let maxSteps = 0;
  for (let code = 0; code < total; code++) {
    const r = simulate(decode(n, code), bound);
    if (r.halted) {
      count++;
      halted[r.steps] = (halted[r.steps] as number) + 1;
      maxSteps = Math.max(maxSteps, r.steps);
    }
  }
  // prefix sums: census after step s
  const cum: number[] = [];
  let acc = 0;
  for (let s = 0; s <= Math.min(bound, maxSteps + 2); s++) {
    acc += halted[s] as number;
    cum.push(acc);
  }
  return { n, bound, halted: count, maxSteps, censusAt: cum };
}

/** A machine that provably never halts: in state 0 it always writes 1, moves right, stays.
 * Invariant (machine-checked): ones === steps at every horizon — one fresh 1 per step. */
export function rightWalker(n: number): TMachine {
  checkUniverse(n, "rightWalker");
  const entries: number[] = [];
  const d = 3 * (n + 1); // write=1, move=+1, next=0
  for (let i = 0; i < 2 * n; i++) {
    entries.push(i < 2 ? d : 0);
  }
  return { n, entries };
}

/**
 * The ladder's sixth rung — base-2 power towers, exact where materializable,
 * structural beyond. 2↑↑5 = 2^65536 is the last tower that fits a BigInt;
 * 2↑↑6 would have ~10^19728 digits. Taller towers are therefore compared
 * STRUCTURALLY: for base 2, a tower of height h+1 equals 2^T(h) > T(h) for
 * every h >= 1 (machine-checked on the materializable prefix), so among
 * base-2 towers, height decides the order — and heights that are themselves
 * towers decide the same way, recursively.
 */
export const MAX_MATERIALIZE_HEIGHT = 5;

/** 2↑↑height, exact BigInt; refuses heights beyond the materializable prefix. */
export function tetrate(height: number): bigint {
  if (!Number.isInteger(height) || height < 1 || height > MAX_MATERIALIZE_HEIGHT) {
    throw new AuditError("EA:TETRATE", `tetrate: height must be an integer in 1..${MAX_MATERIALIZE_HEIGHT}, got ${height}`);
  }
  let v = 2n;
  for (let i = 2; i <= height; i++) v = 2n ** v;
  return v;
}

/** A base-2 tower: either an exact BigInt value, or 2↑↑height with the height
 * itself a tower (heights past 5 are only ever expressible this way). */
export type TowerExpr =
  | { readonly kind: "lit"; readonly n: bigint }
  | { readonly kind: "tet"; readonly height: TowerExpr };

export const lit = (n: bigint): TowerExpr => ({ kind: "lit", n });
/** 2↑↑(the value of `height`) — requires that value to be a positive integer. */
export const tet = (height: TowerExpr): TowerExpr => {
  // a non-positive literal height is not a tower this module can order
  // (tetrate itself refuses it); reject at construction, not mid-comparison
  if (height.kind === "lit" && height.n < 1n) {
    throw new AuditError("EA:TOWER-SHAPE", `tet: tower height must be a positive integer, got ${height.n}`);
  }
  return { kind: "tet", height };
};

function litHeightIsSmallInteger(h: TowerExpr): bigint | null {
  if (h.kind === "lit" && h.n >= 1n && h.n <= BigInt(MAX_MATERIALIZE_HEIGHT)) return h.n;
  return null;
}

/** Exact three-way comparison of base-2 tower expressions.
 * Handles lit/lit numerically, tet/tet by comparing heights recursively, and
 * mixed cases via the monotone materializable bound — throwing on any case
 * outside the checked domain rather than guessing. */
export function compareTowers(a: TowerExpr, b: TowerExpr): -1 | 0 | 1 {
  if (a.kind === "lit" && b.kind === "lit") return a.n < b.n ? -1 : a.n > b.n ? 1 : 0;
  if (a.kind === "tet" && b.kind === "tet") return compareTowers(a.height, b.height);
  // mixed: one tower side, one literal side
  const towerSide = a.kind === "tet" ? a : b;
  const litSide = a.kind === "lit" ? a : b;
  if (towerSide.kind !== "tet" || litSide.kind !== "lit") {
    throw new AuditError("EA:TOWER-UNREACHABLE", "compareTowers: unreachable mixed case");
  }
  const flip = (c: -1 | 0 | 1): -1 | 0 | 1 => (c === 0 ? 0 : c === 1 ? -1 : 1);
  const sign: -1 | 0 | 1 = a.kind === "tet" ? 1 : -1; // result sign as seen from `a`
  const h = litHeightIsSmallInteger(towerSide.height);
  if (h !== null) {
    // tower fully materializable: exact numeric comparison
    const v = tetrate(Number(h));
    const c: -1 | 0 | 1 = v < litSide.n ? -1 : v > litSide.n ? 1 : 0;
    return sign === 1 ? c : flip(c);
  }
  // litHeightIsSmallInteger returned null: a literal height here is either
  // non-positive (refused — 2↑↑0 is not ordered by this module) or >= 6,
  // where a monotone lower bound decides when the tower already exceeds the
  // literal side (tetrate is strictly increasing in height)
  if (towerSide.height.kind === "lit" && towerSide.height.n >= 1n) {
    const bound = tetrate(MAX_MATERIALIZE_HEIGHT);
    if (bound > litSide.n) return sign; // tower > literal, exactly
  }
  throw new AuditError("EA:TOWER-DOMAIN", "compareTowers: comparison outside the checked domain — refusing to guess");
}
