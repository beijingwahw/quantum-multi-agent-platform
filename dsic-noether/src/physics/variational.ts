/**
 * The physics half of the bridge: the discrete Noether theorem, executed.
 *
 * Midpoint discrete Lagrangian on R^2 with quadratic potential
 * V(q) = (a_x x^2 + a_y y^2)/2 (isotropic a_x = a_y = rotationally symmetric):
 *
 *     L_d(q, q+) = |q+ - q|^2 / (2h) - h * V((q + q+)/2)
 *
 * DEL equations (quadratic V => LINEAR in the unknown q+):
 *     (q+ - 2q + q-)/h - (h/2)[grad V(mid(q-,q)) + grad V(mid(q,q+))] = 0
 *
 * Rotational generator xi_Q(q) = (-q_y, q_x). The closedness identity
 * (the discrete Noether algebra, pointwise):
 *
 *     D_1 L_d(q,q+) . xi_Q(q) + D_2 L_d(q,q+) . xi_Q(q+) = h (a_x - a_y) mid_x mid_y
 *
 * — derived in closed form and machine-verified below: EXACTLY zero for the
 * symmetric potential (the 1-form is closed), systematically nonzero when the
 * symmetry breaks. Along DEL trajectories the charge
 * J(q, q+) = D_1 L_d(q,q+) . xi_Q(q) is conserved (telescoping = discrete
 * Stokes), so |J_k - J_0| stays at rounding scale for the symmetric case and
 * drifts for the broken one.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Quad {
  readonly ax: number;
  readonly ay: number;
}

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function dot(a: Vec2, b: Vec2): number {
  return a.x * b.x + a.y * b.y;
}

/** xi_Q(q) = (-q_y, q_x) — the rotational generator field. */
export function xiQ(q: Vec2): Vec2 {
  return { x: -q.y, y: q.x };
}

function gradV(q: Vec2, quad: Quad): Vec2 {
  return { x: quad.ax * q.x, y: quad.ay * q.y };
}

export function discreteLagrangian(q: Vec2, qPlus: Vec2, h: number, quad: Quad): number {
  const d = sub(qPlus, q);
  const mid = scale(add(q, qPlus), 0.5);
  return dot(d, d) / (2 * h) - h * 0.5 * (quad.ax * mid.x * mid.x + quad.ay * mid.y * mid.y);
}

/** D_1 L_d (derivative wrt the left argument). */
export function d1Ld(q: Vec2, qPlus: Vec2, h: number, quad: Quad): Vec2 {
  const mid = scale(add(q, qPlus), 0.5);
  return sub(scale(sub(q, qPlus), 1 / h), scale(gradV(mid, quad), h / 2));
}

/** D_2 L_d (derivative wrt the right argument). */
export function d2Ld(q: Vec2, qPlus: Vec2, h: number, quad: Quad): Vec2 {
  const mid = scale(add(q, qPlus), 0.5);
  return sub(scale(sub(qPlus, q), 1 / h), scale(gradV(mid, quad), h / 2));
}

/** The closedness identity, from the derivative definitions. */
export function closednessComputed(q: Vec2, qPlus: Vec2, h: number, quad: Quad): number {
  return dot(d1Ld(q, qPlus, h, quad), xiQ(q)) + dot(d2Ld(q, qPlus, h, quad), xiQ(qPlus));
}

/** The closed form of the SAME identity: h (a_x - a_y) mid_x mid_y. */
export function closednessClosedForm(q: Vec2, qPlus: Vec2, h: number, quad: Quad): number {
  const mid = scale(add(q, qPlus), 0.5);
  return h * (quad.ax - quad.ay) * mid.x * mid.y;
}

/** The discrete Noether charge J(q, q+) = D_1 L_d . xi_Q(q). */
export function chargeJ(q: Vec2, qPlus: Vec2, h: number, quad: Quad): number {
  return dot(d1Ld(q, qPlus, h, quad), xiQ(q));
}

/** One DEL step: solve for q+ given (q-, q). For quadratic V the DEL
 * equation is linear in q+:
 *     (q+ - 2q + q-)/h + (h/2)[grad V(mid(q-,q)) + grad V(mid(q,q+))] = 0
 * (the sign is RESTORING: acceleration = -grad V — an earlier draft had it
 * backwards and the trajectory exploded, which is how the machine caught it)
 * so  [I/h + (h/4) A] q+ = (2q - q-)/h - (h/2) grad V(mid(q-,q)) - (h/4) A q.
 * Returns the residual as a certificate (should be ~1e-16). */
export function delStep(qMinus: Vec2, q: Vec2, h: number, quad: Quad): { qPlus: Vec2; residual: number } {
  const mid1 = scale(add(qMinus, q), 0.5);
  const g1 = gradV(mid1, quad);
  const rhsX = (2 * q.x - qMinus.x) / h - (h / 2) * g1.x - (h / 4) * quad.ax * q.x;
  const rhsY = (2 * q.y - qMinus.y) / h - (h / 2) * g1.y - (h / 4) * quad.ay * q.y;
  // 2x2 system [[1/h + (h/4) ax, 0], [0, 1/h + (h/4) ay]] (diagonal)
  const m11 = 1 / h + (h / 4) * quad.ax;
  const m22 = 1 / h + (h / 4) * quad.ay;
  const qPlus: Vec2 = { x: rhsX / m11, y: rhsY / m22 };
  // residual of the DEL equation at qPlus (machine certificate)
  const mid2 = scale(add(q, qPlus), 0.5);
  const g2 = gradV(mid2, quad);
  const resX = (qPlus.x - 2 * q.x + qMinus.x) / h + (h / 2) * (g1.x + g2.x);
  const resY = (qPlus.y - 2 * q.y + qMinus.y) / h + (h / 2) * (g1.y + g2.y);
  return { qPlus, residual: Math.hypot(resX, resY) };
}

export interface Trajectory {
  readonly points: readonly Vec2[];
  readonly maxResidual: number;
  readonly maxJDrift: number;
  readonly j0: number;
}

/** Evolve N DEL steps from (q0, q1); certifies residuals and charge drift. */
export function trajectory(q0: Vec2, q1: Vec2, n: number, h: number, quad: Quad): Trajectory {
  const points: Vec2[] = [q0, q1];
  let maxResidual = 0;
  let maxJDrift = 0;
  const j0 = chargeJ(q0, q1, h, quad);
  let qMinus = q0;
  let q = q1;
  for (let k = 0; k < n; k++) {
    const { qPlus, residual } = delStep(qMinus, q, h, quad);
    maxResidual = Math.max(maxResidual, residual);
    maxJDrift = Math.max(maxJDrift, Math.abs(chargeJ(q, qPlus, h, quad) - j0));
    points.push(qPlus);
    qMinus = q;
    q = qPlus;
  }
  return { points, maxResidual, maxJDrift, j0 };
}
