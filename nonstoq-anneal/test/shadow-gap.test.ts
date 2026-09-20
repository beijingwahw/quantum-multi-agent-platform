/** G3-b shadow first-gap ordering census: the conjecture is machine-refuted, the discovery is witnessed, smuggling is convicted by code. */

import { strict as assert } from "node:assert";
import { test } from "node:test";
import { NonstoqError } from "../src/core/errors.js";
import {
  shadowGapCensus,
  auditOrderingClaim,
  type OrderingClaim,
  type OrderingWitness,
} from "../src/sse/shadow-gap.js";
import { betaLawSpectra } from "../src/sse/beta-law.js";
import { Rng } from "../src/core/rng.js";
import { energies, randomIsing } from "../src/core/ising.js";
import { xBasisEnergies } from "../src/anneal/driver.js";

function driverOf(model: ReturnType<typeof randomIsing>, kappa: number) {
  return {
    gamma: 1,
    couplings: model.couplings.map((c) => ({ j: c.j, k: c.k, w: kappa })),
  };
}

/** The conviction reader: run `fn`, demand a NonstoqError, return its code. */
function codeOf(fn: () => unknown): NonstoqError["code"] {
  try {
    fn();
  } catch (e) {
    assert.ok(
      e instanceof NonstoqError,
      `expected a NonstoqError, got ${String(e)}`,
    );
    return e.code;
  }
  assert.fail("expected a refusal that never came");
}

/** The full default grid, once: 252 rows, ~26 s (the theorem's machine evidence). */
const CENSUS = shadowGapCensus();

test("census: the default grid is complete, deterministic, and internally consistent", () => {
  assert.equal(CENSUS.total, 252);
  assert.equal(CENSUS.rows.length, CENSUS.total);
  assert.equal(
    CENSUS.shadowLarger + CENSUS.plusLarger + CENSUS.degenerate,
    CENSUS.total,
  );
  // determinism: a second run over the same grid reproduces the discovery list verbatim
  const again = shadowGapCensus();
  assert.deepEqual(
    again.rows.filter((r) => r.ordering === "plus-larger"),
    CENSUS.rows.filter((r) => r.ordering === "plus-larger"),
  );
  assert.equal(again.worstRatio, CENSUS.worstRatio);
});

test("census: the discovery exists — the shadow CAN be the sparser spectrum", () => {
  assert.ok(
    CENSUS.plusLarger >= 1,
    "zero counterexamples would flip the theorem back to a conjecture",
  );
  assert.ok(
    CENSUS.shadowLarger > CENSUS.plusLarger,
    "shadow dominance must remain the majority direction",
  );
  for (const r of CENSUS.rows) {
    if (r.ordering === "plus-larger") {
      assert.ok(
        r.gapPlus > r.gapMinus && r.ratio > 1,
        `row (n=${r.n}, s=${r.s}, k=${r.kappa}, seed=${r.seed}) mislabelled`,
      );
    }
  }
  // worstRatio is achieved by some recorded counterexample
  assert.ok(
    CENSUS.rows.some(
      (r) => r.ordering === "plus-larger" && r.ratio === CENSUS.worstRatio,
    ),
  );
});

test("census: the ground-state side is untouched — deltaE0 >= 0 on every row", () => {
  assert.equal(CENSUS.deltaE0Violations, 0);
  for (const r of CENSUS.rows)
    assert.ok(
      r.deltaE0 >= -1e-9,
      `row (n=${r.n}, s=${r.s}, k=${r.kappa}, seed=${r.seed}) has deltaE0 = ${r.deltaE0}`,
    );
});

test("census: counterexamples re-verify against a FRESH betaLawSpectra call (the independent referee)", () => {
  for (const r of CENSUS.rows) {
    if (r.ordering !== "plus-larger") continue;
    const model = randomIsing(new Rng(r.seed), r.n);
    const e = energies(model);
    const live = betaLawSpectra(
      r.n,
      e,
      xBasisEnergies(r.n, driverOf(model, r.kappa)),
      xBasisEnergies(r.n, driverOf(model, -r.kappa)),
      r.s,
    );
    assert.ok(
      Math.abs(live.gapPlus - r.gapPlus) < 1e-9,
      `n=${r.n} gapPlus drift`,
    );
    assert.ok(
      Math.abs(live.gapMinus - r.gapMinus) < 1e-9,
      `n=${r.n} gapMinus drift`,
    );
    assert.ok(
      live.gapPlus > live.gapMinus,
      `n=${r.n} counterexample does not re-verify`,
    );
  }
});

test("census: on a sparser-shadow row the enumerable bound's shadow term is binding at every beta > 0", () => {
  const ce = CENSUS.rows.find((r) => r.ordering === "plus-larger")!;
  const dom = CENSUS.rows.find((r) => r.ordering === "shadow-larger")!;
  for (const beta of [0.5, 1, 2, 4]) {
    // shadow term binding <=> e^{-beta*g-} > e^{-beta*g+} <=> g- < g+ (beta-law's bound shape)
    assert.ok(
      Math.exp(-beta * ce.gapMinus) > Math.exp(-beta * ce.gapPlus),
      "counterexample row: shadow term must dominate",
    );
    assert.ok(
      Math.exp(-beta * dom.gapMinus) < Math.exp(-beta * dom.gapPlus),
      "dominant row: plus term must dominate",
    );
  }
});

test("audit: the honest discovery claim (no-universal-law + true witnesses) ships", () => {
  const witnesses: OrderingWitness[] = CENSUS.rows
    .filter((r) => r.ordering === "plus-larger")
    .map((r) => ({
      n: r.n,
      s: r.s,
      kappa: r.kappa,
      seed: r.seed,
      gapPlus: r.gapPlus,
      gapMinus: r.gapMinus,
    }));
  const claim: OrderingClaim = { claimed: "no-universal-law", witnesses };
  auditOrderingClaim(CENSUS, claim); // must not throw — honesty ships
});

test("smuggling trial: the CONJECTURE declared as a law is convicted with the re-verified counterexample", () => {
  const err = codeOf(() => {
    auditOrderingClaim(CENSUS, {
      claimed: "shadow-gap-never-smaller",
      witnesses: [],
    });
  });
  assert.equal(err, "CertificateVerificationFailed");
  // the conviction message carries the counts and the witness coordinates
  let thrown: unknown;
  try {
    auditOrderingClaim(CENSUS, {
      claimed: "shadow-gap-never-smaller",
      witnesses: [],
    });
  } catch (e) {
    thrown = e;
  }
  assert.ok(thrown instanceof NonstoqError);
  assert.match(thrown.message, /REFUTED by \d+ census rows/);
});

test("smuggling trial: a discovery claim without witnesses verifies nothing", () => {
  assert.equal(
    codeOf(() => {
      auditOrderingClaim(CENSUS, {
        claimed: "no-universal-law",
        witnesses: [],
      });
    }),
    "CertificateVerificationFailed",
  );
});

test("smuggling trial: a tampered witness is convicted by code", () => {
  const ce = CENSUS.rows.find((r) => r.ordering === "plus-larger")!;
  const tampered: OrderingClaim = {
    claimed: "no-universal-law",
    witnesses: [{ ...ce, gapPlus: ce.gapPlus * 1.05 }],
  };
  assert.equal(
    codeOf(() => {
      auditOrderingClaim(CENSUS, tampered);
    }),
    "CertificateVerificationFailed",
  );
});

test("smuggling trial: a mislabelled witness (a shadow-dominant row dressed as a discovery) is convicted by code", () => {
  const dom = CENSUS.rows.find((r) => r.ordering === "shadow-larger")!;
  const mislabelled: OrderingClaim = {
    claimed: "no-universal-law",
    witnesses: [
      {
        n: dom.n,
        s: dom.s,
        kappa: dom.kappa,
        seed: dom.seed,
        gapPlus: dom.gapPlus,
        gapMinus: dom.gapMinus,
      },
    ],
  };
  assert.equal(
    codeOf(() => {
      auditOrderingClaim(CENSUS, mislabelled);
    }),
    "CertificateVerificationFailed",
  );
});

test("smuggling trial: a witness with no census row is ReportRowMissing; an empty grid axis is refused by code", () => {
  assert.equal(
    codeOf(() => {
      auditOrderingClaim(CENSUS, {
        claimed: "no-universal-law",
        witnesses: [
          { n: 9, s: 0.25, kappa: 0.2, seed: 31, gapPlus: 1, gapMinus: 0.9 },
        ],
      });
    }),
    "ReportRowMissing",
  );
  assert.equal(
    codeOf(() => shadowGapCensus({ ns: [] })),
    "CertificateVerificationFailed",
  );
  assert.equal(
    codeOf(() => shadowGapCensus({ seeds: [] })),
    "CertificateVerificationFailed",
  );
});

test("census: a small custom grid agrees with the default grid on shared rows (single-source spectra)", () => {
  const small = shadowGapCensus({
    ns: [5, 7],
    ss: [0.75],
    kappas: [0.2, 0.5],
    seeds: [911],
  });
  assert.equal(small.total, 4);
  assert.equal(small.plusLarger, 4); // all four are counterexample rows: n=5 k=0.2, n=5 k=0.5, n=7 k=0.2, n=7 k=0.5
  for (const r of small.rows) {
    const ref = CENSUS.rows.find(
      (x) =>
        x.n === r.n && x.s === r.s && x.kappa === r.kappa && x.seed === r.seed,
    );
    assert.ok(ref !== undefined);
    assert.equal(ref.ordering, r.ordering);
    assert.ok(Math.abs(ref.gapPlus - r.gapPlus) < 1e-12);
  }
});
