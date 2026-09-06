/**
 * Capacity-side machinery: ensembles pushed through the switched channel and
 * its definite-order references, with Holevo χ and single-shot Helstrom
 * success as the information measures. Everything is exact linear algebra —
 * no sampling anywhere in the capacity claims.
 */

import type { CMat } from '../core/cmat.js';
import { partialTrace } from '../core/channels.js';
import { type EnsembleItem, holevo, traceDistance } from '../core/measures.js';
import type { SwitchedChannel } from './isometry.js';
import { kronRho } from './witnesses.js';

export interface ReceiverSlices {
  /** full (control ⊗ target) output */
  full: CMat;
  /** control register only — where ESC-type advantage lands */
  control: CMat;
  /** target register only */
  target: CMat;
}

/** Push one input target state through the switched process (control |+⟩). */
export function switchedSlices(sc: SwitchedChannel, rhoPlus: CMat, rhoS: CMat): ReceiverSlices {
  const full = sc.channel(kronRho(rhoPlus, rhoS));
  return {
    full,
    control: partialTrace(full, [2, sc.sw.d], [1]),
    target: partialTrace(full, [2, sc.sw.d], [0]),
  };
}

/** Holevo χ of an ensemble for each receiver slice of the switched output. */
export function switchedEnsembleChi(
  sc: SwitchedChannel,
  rhoPlus: CMat,
  inputs: readonly CMat[],
): { full: number; control: number; target: number } {
  const mk = (pick: (s: ReceiverSlices) => CMat): number => {
    const items: EnsembleItem[] = inputs.map((rho, k) => ({ key: `x${k}`, state: pick(switchedSlices(sc, rhoPlus, rho)), weight: 1 / inputs.length }));
    return holevo(items);
  };
  return { full: mk((s) => s.full), control: mk((s) => s.control), target: mk((s) => s.target) };
}

/** Holevo χ of an ensemble through a plain single-register channel. */
export function channelEnsembleChi(
  apply: (rho: CMat) => CMat,
  inputs: readonly CMat[],
): number {
  const items: EnsembleItem[] = inputs.map((rho, k) => ({ key: `x${k}`, state: apply(rho), weight: 1 / inputs.length }));
  return holevo(items);
}

/** Equal-prior Helstrom success for two states: ½(1 + T(ρ₀, ρ₁)). */
export function helstromTwo(rho0: CMat, rho1: CMat): number {
  return (1 + traceDistance(rho0, rho1)) / 2;
}

/** Single-use distinguishability of two inputs for each slice / fixed order. */
export function admissionMetrics(
  sc: SwitchedChannel,
  rhoPlus: CMat,
  s0: CMat,
  s1: CMat,
): {
  switchFull: number;
  switchControl: number;
  switchTarget: number;
  fixedAB: number;
  fixedBA: number;
} {
  const a = switchedSlices(sc, rhoPlus, s0);
  const b = switchedSlices(sc, rhoPlus, s1);
  return {
    switchFull: traceDistance(a.full, b.full),
    switchControl: traceDistance(a.control, b.control),
    switchTarget: traceDistance(a.target, b.target),
    fixedAB: traceDistance(sc.fixedAB(s0), sc.fixedAB(s1)),
    fixedBA: traceDistance(sc.fixedBA(s0), sc.fixedBA(s1)),
  };
}
