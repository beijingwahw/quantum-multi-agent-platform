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
 */
export const HALT = -1;

export interface TMachine {
  readonly n: number;
  readonly entries: readonly number[];
}

export function machines(n: number): number {
  return (4 * (n + 1)) ** (2 * n);
}

export function decode(n: number, code: number): TMachine {
  const entries: number[] = [];
  let c = code;
  for (let i = 0; i < 2 * n; i++) {
    entries.push(c % (4 * (n + 1)));
    c = Math.floor(c / (4 * (n + 1)));
  }
  return { n, entries };
}

export interface SimResult {
  readonly halted: boolean;
  readonly steps: number;
  readonly ones: number;
}

/** Simulate up to `bound` steps on a blank tape; returns halting status, steps taken, ones written. */
export function simulate(m: TMachine, bound: number): SimResult {
  const span = 2 * (m.n + 1);
  let state = 0;
  let pos = 0;
  let steps = 0;
  let ones = 0;
  const tape = new Map<number, number>();
  while (state !== HALT && steps < bound) {
    const sym = tape.get(pos) ?? 0;
    const d = m.entries[state * 2 + sym] as number;
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
  const entries: number[] = [];
  const d = 3 * (n + 1); // write=1, move=+1, next=0
  for (let i = 0; i < 2 * n; i++) {
    entries.push(i < 2 ? d : 0);
  }
  return { n, entries };
}
