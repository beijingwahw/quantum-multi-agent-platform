/**
 * T2 — the causal game, classical strategies EXHAUSTED.
 *
 * Game (OCB12): Alice receives random bit a, Bob receives random bits b and
 * b'. If b' = 0, Bob must communicate his bit b to Alice (Alice's output x
 * must equal b); if b' = 1, Bob must guess Alice's bit a (his output y must
 * equal a). Success: p = 1/2 P(x = b | b' = 0) + 1/2 P(y = a | b' = 1).
 *
 * A CAUSAL strategy has a definite order: either Alice acts first (she can
 * send one bit forward with her output) or Bob acts first — or a shared
 * random mixture. Deterministic strategies in each order:
 *   A ≺ B: Alice's forward message m = f(a) (4 functions); her guess
 *          x = g(a) (4); Bob's guess y = h(m, b, b') (256: 3 input bits).
 *   B ≺ A: Bob's forward message m = f(b, b') (16); his guess y = g(b, b')
 *          (16); Alice's guess x = h(m, a) (16).
 * All 4096 + 4096 deterministic strategies enumerated; shared randomness is
 * a convex mixture and cannot exceed the deterministic maximum (linearity).
 */

export interface SweepResult {
  readonly maxSuccess: number;
  readonly strategiesSwept: number;
  readonly argmaxCount: number;
  readonly orders: { readonly aFirst: number; readonly bFirst: number };
}

/** Success probability of one deterministic run, exact rational arithmetic via integers. */
function successAB(f: (a: number) => number, g: (a: number) => number, h: (m: number, b: number, bp: number) => number): number {
  // 8 (a, b, b') combos, uniform; wins counted in eighths
  let wins = 0;
  for (let a = 0; a < 2; a++) {
    for (let b = 0; b < 2; b++) {
      for (let bp = 0; bp < 2; bp++) {
        const m = f(a);
        if (bp === 0) {
          if (g(a) === b) wins++;
        } else {
          if (h(m, b, bp) === a) wins++;
        }
      }
    }
  }
  return wins / 8;
}

export function sweepDeterministic(): SweepResult {
  const funcs1 = [() => 0, () => 1, (x: number) => x, (x: number) => 1 - x];
  // all boolean functions of n input bits, as lookup tables
  const allFns = (n: number): Array<(...xs: number[]) => number> => {
    const out: Array<(...xs: number[]) => number> = [];
    for (let table = 0; table < 2 ** 2 ** n; table++) {
      out.push((...xs: number[]) => (table >> (xs.reduce((acc, x) => acc * 2 + x, 0)) & 1));
    }
    return out;
  };

  let max = 0;
  let argmax = 0;
  let aFirstMax = 0;
  let bFirstMax = 0;
  let swept = 0;

  // A ≺ B: f: a -> m (4), g: a -> x (4), h: (m, b, b') -> y (256)
  for (const f of funcs1) {
    for (const g of funcs1) {
      for (const h of allFns(3)) {
        const p = successAB(f, g, h);
        swept++;
        if (p > aFirstMax) aFirstMax = p;
        if (p > max + 1e-15) {
          max = p;
          argmax = 1;
        } else if (Math.abs(p - max) < 1e-15) {
          argmax++;
        }
      }
    }
  }

  // B ≺ A: f: (b, b') -> m (16), g: (b, b') -> y (16), h: (m, a) -> x (16)
  const fns2 = allFns(2);
  for (const f of fns2) {
    for (const g of fns2) {
      for (const h of fns2) {
        let wins = 0;
        for (let a = 0; a < 2; a++) {
          for (let b = 0; b < 2; b++) {
            for (let bp = 0; bp < 2; bp++) {
              const m = f(b, bp);
              if (bp === 0) {
                if (h(m, a) === b) wins++;
              } else {
                if (g(b, bp) === a) wins++;
              }
            }
          }
        }
        const p = wins / 8;
        swept++;
        if (p > bFirstMax) bFirstMax = p;
        if (p > max + 1e-15) {
          max = p;
          argmax = 1;
        } else if (Math.abs(p - max) < 1e-15) {
          argmax++;
        }
      }
    }
  }

  return { maxSuccess: max, strategiesSwept: swept, argmaxCount: argmax, orders: { aFirst: aFirstMax, bFirst: bFirstMax } };
}
