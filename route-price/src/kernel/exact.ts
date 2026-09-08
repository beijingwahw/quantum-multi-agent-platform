/**
 * Exact rational arithmetic (BigInt fractions) + the quadratic divisible-good
 * family it prices — zero-dependency, deliberately tiny. The welfare-gap
 * charge cross-check (W-F) runs here: every identity is a BigInt equality,
 * never a tolerance. Floats are banned from this file on purpose; the
 * independent float path lives in the tests (the two-path law).
 */

export interface Q {
  readonly n: bigint;
  readonly d: bigint;
}

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x === 0n ? 1n : x;
}

export const q = (n: bigint, d = 1n): Q => {
  const sign = d < 0n ? -1n : 1n;
  const nn = sign * n;
  const dd = sign * d;
  const g = gcd(nn, dd);
  return { n: nn / g, d: dd / g };
};

export const qAdd = (a: Q, b: Q): Q => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const qSub = (a: Q, b: Q): Q => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const qMul = (a: Q, b: Q): Q => q(a.n * b.n, a.d * b.d);
export const qDiv = (a: Q, b: Q): Q => q(a.n * b.d, a.d * b.n);
export const qIsZero = (a: Q): boolean => a.n === 0n;
export const qEq = (a: Q, b: Q): boolean => a.n === b.n && a.d === b.d;
/** -1 / 0 / +1 — bigint compare, exact. */
export const qCmp = (a: Q, b: Q): number => {
  const l = a.n * b.d;
  const r = b.n * a.d;
  return l < r ? -1 : l > r ? 1 : 0;
};

// ---------------------------------------------------------------------------
// The quadratic divisible-good family (the dsic-noether stage, re-derived):
// v_j(a) = theta_j * a - a^2 / 2, sum_j a_j = 1, efficient allocation
// x_j = theta_j - thetabar + 1/n — affine in the reports, so every identity
// below closes as an exact rational statement.
// ---------------------------------------------------------------------------

/** The efficient allocation under the report vector `reports` (agent 0 is the deviator). */
export function efficientAlloc(reports: readonly Q[]): Q[] {
  const n = BigInt(reports.length);
  let sum = q(0n);
  for (const r of reports) sum = qAdd(sum, r);
  const mean = qDiv(sum, q(n));
  return reports.map((r) => qAdd(qSub(r, mean), qDiv(q(1n), q(n))));
}

/** Welfare of allocation `alloc` under types `types`: sum_j (t_j x_j - x_j^2/2). */
export function welfare(types: readonly Q[], alloc: readonly Q[]): Q {
  let acc = q(0n);
  for (let j = 0; j < types.length; j++) {
    const x = alloc[j] as Q;
    acc = qAdd(acc, qSub(qMul(types[j] as Q, x), qDiv(qMul(x, x), q(2n))));
  }
  return acc;
}

/** The welfare gap Phi_t(x(s)) - Phi_t(x(t)): true types, deviator 0 reporting s vs t. */
export function welfareGap(trueTypes: readonly Q[], s: Q, t: Q): Q {
  const withS = [s, ...trueTypes.slice(1)];
  const withT = [t, ...trueTypes.slice(1)];
  return qSub(welfare(trueTypes, efficientAlloc(withS)), welfare(trueTypes, efficientAlloc(withT)));
}

/** The charge's closed form: G(s;t) = -(n-1)(s-t)^2 / (2n). */
export function chargeClosedForm(n: number, s: Q, t: Q): Q {
  const diff = qSub(s, t);
  return qMul(q(-BigInt(n - 1)), qDiv(qMul(diff, diff), q(2n * BigInt(n))));
}

/** Groves payment for agent 0: gauge - sum_{j != 0} (t_j x_j - x_j^2/2).
 * The gauge is an arbitrary function of the OTHERS' types — constant in the
 * own report, which is exactly what makes the charge gauge-invariant. */
export function grovesPayment(gauge: Q, trueTypes: readonly Q[], report: Q): Q {
  const alloc = efficientAlloc([report, ...trueTypes.slice(1)]);
  let others = q(0n);
  for (let j = 1; j < trueTypes.length; j++) {
    const x = alloc[j] as Q;
    others = qAdd(others, qSub(qMul(trueTypes[j] as Q, x), qDiv(qMul(x, x), q(2n))));
  }
  return qSub(gauge, others);
}

/** Agent 0's utility when reporting `report` under payment `payment`. */
export function agentUtility(trueTypes: readonly Q[], report: Q, payment: Q): Q {
  const alloc = efficientAlloc([report, ...trueTypes.slice(1)]);
  const x = alloc[0] as Q;
  return qSub(qSub(qMul(trueTypes[0] as Q, x), qDiv(qMul(x, x), q(2n))), payment);
}
