/**
 * Classical single-item sealed-bid mechanisms: first price and second price
 * (Vickrey). Canonical tie-break: lowest agent index wins. Quasi-linear
 * utilities. These are the reference mechanisms whose DSIC status the
 * quantum channel is allowed or forbidden to change.
 */

export type AuctionKind = 'first' | 'second';

export interface AuctionOutcome {
  winner: number;
  price: number;
}

function argmaxLow(bids: readonly number[]): number {
  if (bids.length === 0) {
    throw new Error('AUCT01-empty-bids: argmaxLow needs at least one bid, got []');
  }
  let best = 0;
  for (let i = 1; i < bids.length; i++) {
    if (bids[i]! > bids[best]!) best = i;
  }
  return best;
}

function secondHighest(bids: readonly number[]): number {
  const w = argmaxLow(bids);
  let s = -Infinity;
  for (let i = 0; i < bids.length; i++) {
    if (i === w) continue;
    s = Math.max(s, bids[i]!);
  }
  return s === -Infinity ? 0 : s;
}

/** Resolve the auction given submitted bids. */
export function resolveAuction(bids: readonly number[], kind: AuctionKind): AuctionOutcome {
  const winner = argmaxLow(bids); // rejects the empty profile (AUCT01)
  const price = kind === 'first' ? bids[winner]! : secondHighest(bids);
  return { winner, price };
}

/** Quasi-linear utility of `agent` with true value `trueValue` when the
 * submitted bid profile is `bids`. */
export function utilityOf(
  kind: AuctionKind,
  trueValue: number,
  bids: readonly number[],
  agent: number,
): number {
  const { winner, price } = resolveAuction(bids, kind);
  if (winner !== agent) return 0;
  return trueValue - price;
}
