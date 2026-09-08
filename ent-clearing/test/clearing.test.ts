import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import {
  checkBoard,
  checkGhzClaims,
  checkLedger,
  checkYieldTable,
  runWitnesses,
} from "../src/kernel/audit.js";
import { BOARD, type BoardRow } from "../src/kernel/board.js";
import { makeRng } from "../src/core/rng.js";
import { KET0, KET1, maximallyMixed, randomStateVec, vecToRho } from "../src/core/states.js";
import { traceDistance, shannonBits } from "../src/core/measures.js";
import { at4, isUnitary, kron, mat, matEq, mMul, vAdd, vInner, vKron, vScale } from "../src/core/cmat.js";
import { partialTrace } from "../src/core/channels.js";
import { fmt } from "../src/experiments/report.js";
import {
  bellBasis,
  bellProjectors,
  concurrence,
  corrections,
  denseCode,
  eF,
  efFromConcurrence,
  entropyOfMixedQubit,
  h2,
  h2ViaLn,
  mintByGate,
  netWeakCoin,
  PHI_PLUS,
  pureFidelity,
  randomLocalRound,
  randomMixedPair,
  randomMixedQubit,
  redeem,
  tetrahedronChi,
} from "../src/kernel/clearing.js";
import {
  bellDiagonal,
  bellFidelity,
  bellRoundClosedForm,
  bellTwirl,
  bellWeights,
  cliffords,
  depolCoin,
  hashingLineWerner,
  purifyRound,
  schemePurify,
  wernerCoin,
  wernerRoundClosedForm,
  YIELD_TABLE,
  type YieldRow,
} from "../src/kernel/purify.js";
import { computeLedger, LEDGER_SPECS, type LedgerSpec } from "../src/kernel/ledger.js";
import {
  GHZ_CLAIMS,
  ghzCoin,
  ghzCutNegativities,
  ghzLocalCensus,
  ghzPairwiseConcurrences,
  withdrawToAB,
  type GhzClaimRow,
} from "../src/kernel/ghz.js";

/** A writeable view of a board row — contraband is smuggled into a private copy. */
type MutableBoardRow = { -readonly [K in keyof BoardRow]: BoardRow[K] };

function smuggle(mutate: (rows: MutableBoardRow[]) => void): BoardRow[] {
  const copy = JSON.parse(JSON.stringify(BOARD)) as MutableBoardRow[];
  mutate(copy);
  return copy;
}

function rowAt(rows: MutableBoardRow[], i: number): MutableBoardRow {
  const row = rows[i];
  if (row === undefined) throw new Error(`smuggle: BOARD has no row ${i} to mutate`);
  return row;
}

describe("T1 the board clears", () => {
  it("the checker passes on the real board", () => {
    assert.deepEqual(checkBoard(), []);
  });

  it("all six witnesses pass", () => {
    for (const w of runWitnesses()) assert.ok(w.pass, `${w.name} FAILED: ${w.detail}`);
  });
});

describe("T2 the clearing machinery", () => {
  it("redemption is the identity channel: pure payloads, <psi|rho|psi> exactly 1", () => {
    const rng = makeRng(31);
    for (let t = 0; t < 12; t++) {
      const psi = randomStateVec(rng, 2);
      const r = redeem(vecToRho(psi));
      assert.ok(Math.abs(pureFidelity(r.delivered, psi) - 1) <= 1e-12);
    }
  });

  it("redemption is the identity channel: mixed payloads by trace distance", () => {
    const rng = makeRng(32);
    const payloads = [maximallyMixed(2)];
    for (let t = 0; t < 5; t++) payloads.push(randomMixedQubit(rng));
    for (const p of payloads) {
      const r = redeem(p);
      assert.ok(traceDistance(r.delivered, p) <= 1e-12);
    }
  });

  it("the coin is burned by the settlement event; the goods freeze until the classical leg settles", () => {
    const rng = makeRng(33);
    for (let t = 0; t < 8; t++) {
      const r = redeem(vecToRho(randomStateVec(rng, 2)));
      assert.ok(concurrence(r.coinAfter) <= 1e-12, "post-trade pairwise concurrence must be 0");
      assert.ok(traceDistance(r.bobPreBits, maximallyMixed(2)) <= 1e-12, "B's pre-bits marginal must be I/2");
    }
  });

  it("dense coding: 4 mutually orthogonal signals, decode probability 1, MI exactly 2 bits", () => {
    const d = denseCode();
    for (let k = 0; k < 4; k++) {
      for (let j = 0; j < 4; j++) {
        const p = d.decode[k]?.[j] ?? 0;
        if (j === k) assert.ok(Math.abs(1 - p) <= 1e-12);
        else assert.ok(Math.abs(p) <= 1e-12);
      }
    }
    assert.ok(Math.abs(d.mutualInformation - 2) <= 1e-12);
  });

  it("the reverse quote returns the coin: post-decode concurrence exactly 1 (catalyst, not fuel)", () => {
    const d = denseCode();
    assert.ok(Math.abs(concurrence(d.coinReturned) - 1) <= 1e-12);
  });

  it("the no-coin floor: tetrahedron chi exactly 1 bit, average state exactly I/2", () => {
    const { chi, avgIsMixed } = tetrahedronChi();
    assert.ok(Math.abs(chi - 1) <= 1e-12);
    assert.ok(avgIsMixed <= 1e-12);
    assert.ok(Math.abs(entropyOfMixedQubit() - 1) <= 1e-12);
  });

  it("Procrustean netting: p = 2*l_min exact, success exactly |Phi+>, failure a product, p <= C", () => {
    for (let i = 1; i <= 10; i++) {
      const lmin = 0.05 * i;
      const nt = netWeakCoin(lmin);
      assert.ok(Math.abs(nt.pSucc - 2 * lmin) <= 1e-12);
      assert.ok(Math.abs(pureFidelity(nt.successState, bellBasis()[0]) - 1) <= 1e-12);
      // at l_min = 1/2 the fail branch has probability exactly 0 (non-state)
      if (nt.pFail > 1e-12) assert.ok(concurrence(nt.failState) <= 1e-12);
      assert.ok(nt.pSucc <= nt.weakConcurrence + 1e-12);
      assert.ok(Math.abs(nt.pSucc + nt.pFail - 1) <= 1e-12);
    }
  });

  it("the mint wall: local rounds never raise E_F; products stay products; one CNOT mints", () => {
    const rng = makeRng(34);
    let worstRise = 0;
    for (let t = 0; t < 60; t++) {
      const rho = randomMixedPair(rng);
      const after = randomLocalRound(rng, rho);
      worstRise = Math.max(worstRise, eF(after) - eF(rho));
    }
    assert.ok(worstRise <= 1e-12, `E_F must not rise under local rounds (worst rise ${worstRise})`);
    for (let t = 0; t < 15; t++) {
      const prod = kron(vecToRho(randomStateVec(rng, 2)), vecToRho(randomStateVec(rng, 2)));
      assert.ok(concurrence(randomLocalRound(rng, prod)) <= 1e-12);
    }
    const minted = mintByGate();
    assert.ok(Math.abs(pureFidelity(minted, bellBasis()[0]) - 1) <= 1e-12);
    assert.ok(Math.abs(concurrence(minted) - 1) <= 1e-12);
  });

  it("h2 on both routes agrees to the last decimal (E_F's currency is honest)", () => {
    for (let i = 1; i <= 99; i++) {
      const x = i / 100;
      assert.ok(Math.abs(h2(x) - h2ViaLn(x)) <= 1e-12);
    }
  });
});

describe("T3 smuggling trials — the board rejects contraband by name", () => {
  it("H1: a single-sided quote is rejected", () => {
    const contraband = smuggle((rows) => {
      rowAt(rows, 0).get = "";
    });
    const hit = checkBoard(contraband).find((v) => v.law === "H1");
    assert.ok(hit, "expected an H1 violation");
    assert.match(hit.detail, /single-sided/);
  });

  it("H2: an unwitnessed rate is rejected as marketing", () => {
    const contraband = smuggle((rows) => {
      rowAt(rows, 0).witness = "W-∞";
    });
    const hit = checkBoard(contraband).find((v) => v.law === "H2");
    assert.ok(hit, "expected an H2 violation");
    assert.match(hit.detail, /marketing/);
  });

  it("H3: a dead anchor is rejected", () => {
    const contraband = smuggle((rows) => {
      rowAt(rows, 0).anchors = ["atlantis"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "H3");
    assert.ok(hit, "expected an H3 violation");
    assert.match(hit.detail, /atlantis/);
  });

  it("H4: an illegal tag is rejected", () => {
    const contraband = smuggle((rows) => {
      rowAt(rows, 0).exactness = "TRUST-ME" as BoardRow["exactness"];
    });
    const hit = checkBoard(contraband).find((v) => v.law === "H4");
    assert.ok(hit, "expected an H4 violation");
  });

  it("H5: a duplicated id is rejected", () => {
    const contraband = smuggle((rows) => {
      rowAt(rows, 1).id = rowAt(rows, 0).id;
    });
    const hit = checkBoard(contraband).find((v) => v.law === "H5");
    assert.ok(hit, "expected an H5 violation");
  });
});

describe("T4 the renderer refuses to print an illegal board", () => {
  it("the smuggled board fails the checker the renderer gates on", () => {
    const contraband = smuggle((rows) => {
      rowAt(rows, 3).give = "";
      rowAt(rows, 3).get = "1 standard coin, guaranteed";
    });
    const violations = checkBoard(contraband);
    assert.ok(violations.length > 0);
    assert.match(violations.map((v) => `${v.row} [${v.law}]`).join(" "), /\[H1\]/);
  });

  it("the entry guard: importing the renderer writes no report", async () => {
    const probe = resolve(process.cwd(), "out", "reports", "guard-probe-should-not-exist.md");
    await import("../src/experiments/render.js");
    assert.ok(!existsSync(probe), "importing the renderer must not execute the render");
  });

  it("the exported render mains really run: every section builder returns non-empty content", async () => {
    const render = await import("../src/experiments/render.js");
    const sections = [
      render.renderPurificationSection(),
      render.renderLedgerSection(),
      render.renderGhzSection(),
    ];
    for (const s of sections) {
      assert.ok(s.length > 500, "a render section came back empty — a silent repro no-op");
    }
    assert.match(sections[0] as string, /purification desk/);
    assert.match(sections[1] as string, /conservation ledger/);
    assert.match(sections[2] as string, /GHZ bank/);
  });
});

describe("T5 the purification desk — mixed coins at bounded exact scale", () => {
  it("the BBPSSW round matches its closed forms on 11 Werner grades (p and F' to 1e-12)", () => {
    for (let i = 0; i <= 10; i++) {
      const F = 0.45 + 0.05 * i;
      const W = wernerCoin(F);
      const r = purifyRound(W, W);
      const cf = wernerRoundClosedForm(F);
      assert.ok(Math.abs(r.pSucc - cf.pSucc) <= 1e-12, `p at F=${F}`);
      assert.ok(Math.abs(bellFidelity(r.successState) - cf.fidelityOut) <= 1e-12, `F' at F=${F}`);
      assert.ok(Math.abs(r.pSucc + r.pFail - 1) <= 1e-12, "branch probabilities partition");
    }
  });

  it("the round matches the general Bell-diagonal XOR closed form on random pairs", () => {
    const rng = makeRng(77);
    for (let t = 0; t < 8; t++) {
      const rand4 = (): number[] => {
        let s = 0;
        const v = Array.from({ length: 4 }, () => {
          const x = rng();
          s += x;
          return x;
        });
        return v.map((x) => x / s);
      };
      const lam = rand4();
      const mu = rand4();
      const r = purifyRound(bellDiagonal(lam), bellDiagonal(mu));
      const ref = bellRoundClosedForm(lam, mu);
      assert.ok(Math.abs(r.pSucc - ref.pSucc) <= 1e-12);
      const out = bellWeights(r.successState);
      for (let k = 0; k < 4; k++) assert.ok(Math.abs(out[k]! - ref.out[k]!) <= 1e-12);
    }
  });

  it("the depolarizing step is the exact isotropic twirl: 24 unitaries, Werner fixed points, lambda1 preserved", () => {
    const group = cliffords();
    assert.strictEqual(group.length, 24);
    assert.ok(group.every((u) => isUnitary(u)));
    for (const F of [0.55, 0.85, 0.95]) {
      assert.ok(matEq(bellTwirl(wernerCoin(F)), wernerCoin(F), 1e-12), `W_${F} must be a fixed point`);
    }
    const r = purifyRound(wernerCoin(0.85), wernerCoin(0.85));
    const t = bellTwirl(r.successState);
    assert.ok(Math.abs(bellWeights(t)[0]! - bellWeights(r.successState)[0]!) <= 1e-12, "lambda1 preserved");
    assert.ok(matEq(t, wernerCoin(bellFidelity(r.successState)), 1e-12), "output is exactly W_{F'}");
  });

  it("honest negatives: without the twirl the nested round DEGRADES the coin; sub-threshold grades degrade", () => {
    const W = wernerCoin(0.85);
    const r1 = purifyRound(W, W);
    const rawNested = purifyRound(r1.successState, r1.successState);
    assert.ok(
      bellFidelity(rawNested.successState) < bellFidelity(r1.successState) - 1e-9,
      "the raw nested round must degrade (the twirl is load-bearing)",
    );
    assert.ok(wernerRoundClosedForm(0.45).fidelityOut < 0.45, "F = 0.45 must degrade");
    assert.ok(wernerRoundClosedForm(0.55).fidelityOut > 0.55, "F = 0.55 must improve");
  });

  it("expected E_F never rises through a round (11 grades, branch-averaged)", () => {
    for (let i = 0; i <= 10; i++) {
      const F = 0.45 + 0.05 * i;
      const W = wernerCoin(F);
      const r = purifyRound(W, W);
      const out = r.pSucc * eF(r.successState) + r.pFail * eF(r.failState);
      assert.ok(out <= 2 * eF(W) + 1e-12, `E_F rose at F=${F}`);
    }
  });

  it("the bounded schemes n=2,3,4: chains recompute, finals are Werner, never standard, E_F monotone", () => {
    for (const F of [0.55, 0.85, 0.95]) {
      const W = wernerCoin(F);
      const r1 = purifyRound(W, W);
      const t1 = bellTwirl(r1.successState);
      const r3 = purifyRound(t1, W);
      const r4 = purifyRound(t1, t1);
      const chains = [r1.pSucc, r1.pSucc * r3.pSucc, r1.pSucc * r1.pSucc * r4.pSucc];
      for (const n of [2, 3, 4] as const) {
        const s = schemePurify(n, W);
        assert.ok(Math.abs(s.pSucc - (chains[n - 2] as number)) <= 1e-12, `chain p at n=${n}, F=${F}`);
        assert.ok(matEq(s.finalState, wernerCoin(s.fidelityOut), 1e-12), `final is Werner at n=${n}`);
        assert.ok(s.fidelityOut < 1 - 1e-9, "bounded netting never mints a standard coin");
        assert.ok(s.pSucc * eF(s.finalState) <= n * eF(W) + 1e-12, `scheme E_F monotone at n=${n}`);
      }
    }
  });

  it("the families agree (depolCoin IS wernerCoin at F=1-3p/4) and the yield table recomputes", () => {
    for (const p of [0.1, 0.2, 0.3]) {
      assert.ok(matEq(depolCoin(p), wernerCoin(1 - (3 * p) / 4), 1e-12));
    }
    assert.deepEqual(checkYieldTable(), []);
  });

  it("the quoted hashing line: 1-H(lambda) exact, bracketing zero between F=0.81 and F=0.82, quoted rows match", () => {
    const F = 0.85;
    const g = (1 - F) / 3;
    assert.ok(Math.abs(hashingLineWerner(F) - (1 - shannonBits([F, g, g, g]))) <= 1e-12);
    assert.ok(hashingLineWerner(0.81) < 0 && hashingLineWerner(0.82) > 0, "the line brackets zero");
    for (const r of YIELD_TABLE) {
      if (r.tag !== "QUOTED") continue;
      assert.strictEqual(r.citation, "BBPS96");
      const Feff = r.family === "WERNER" ? r.param : 1 - (3 * r.param) / 4;
      assert.ok(Math.abs(r.coinYield - hashingLineWerner(Feff)) <= 1e-12, `quoted row ${r.id}`);
    }
  });
});

describe("T6 the conservation ledger", () => {
  it("every ledger claim survives recomputation (16 rows, checker clean)", () => {
    assert.deepEqual(checkLedger(), []);
    assert.strictEqual(computeLedger().length, 16);
  });

  it("the exact extremes: burn delta exactly -1, catalyst delta 0, GHZ cuts 1/2 -> 1/2 and 1/2 -> 0", () => {
    const by = new Map(computeLedger().map((e) => [e.id, e]));
    const burn = by.get("L2");
    const catalyst = by.get("L4");
    assert.ok(burn && Math.abs(burn.after - burn.before + 1) <= 1e-12, "burn delta must be exactly -1");
    assert.ok(catalyst && Math.abs(catalyst.after - catalyst.before) <= 1e-12, "catalyst delta must be 0");
    for (const [id, want] of [
      ["L14", 0.5],
      ["L15", 0.5],
    ] as const) {
      const e = by.get(id);
      assert.ok(e && Math.abs(e.after - want) <= 1e-12 && Math.abs(e.before - want) <= 1e-12);
    }
    const settled = by.get("L13");
    assert.ok(settled && Math.abs(settled.before - 0.5) <= 1e-12 && Math.abs(settled.after) <= 1e-12);
  });
});

describe("T7 the GHZ bank", () => {
  it("pairwise concurrences exactly 0; every cut exactly 1/2 negativity", () => {
    const g = ghzCoin();
    for (const c of ghzPairwiseConcurrences(g)) assert.ok(c <= 1e-12);
    for (const n of ghzCutNegativities(g)) assert.ok(Math.abs(n - 0.5) <= 1e-12);
  });

  it("the withdrawal: probabilities exactly 1/2, both branches pure known standard coins, cost exactly 1 cbit", () => {
    const wd = withdrawToAB();
    assert.ok(Math.abs(wd.pPlus - 0.5) <= 1e-12 && Math.abs(wd.pMinus - 0.5) <= 1e-12);
    assert.ok(Math.abs(pureFidelity(wd.abPlus, bellBasis()[0]) - 1) <= 1e-12);
    assert.ok(Math.abs(pureFidelity(wd.abMinus, bellBasis()[1]) - 1) <= 1e-12);
    assert.ok(Math.abs(concurrence(wd.abPlus) - 1) <= 1e-12 && Math.abs(concurrence(wd.abMinus) - 1) <= 1e-12);
    assert.strictEqual(wd.cbits, 1);
  });

  it("the wall per cut: 150 random local rounds never raise any cut; pairwise reductions stay separable", () => {
    const census = ghzLocalCensus(makeRng(203), 150);
    assert.strictEqual(census.rounds, 150);
    assert.ok(census.worstCutRise <= 1e-12, `a cut rose by ${census.worstCutRise}`);
    assert.ok(census.worstPairwiseC <= 1e-12, "a pairwise reduction became entangled");
  });

  it("the claims table recomputes — including the exact refutation of the pairwise wall", () => {
    assert.deepEqual(checkGhzClaims(), []);
    const refuted = GHZ_CLAIMS.find((c) => c.id === "G5");
    assert.ok(refuted?.tag === "REFUTED");
  });
});

describe("T8 smuggling trials round two — contraband in the new tables is rejected by name", () => {
  /** A writeable view of a yield row — contraband is smuggled into a private copy. */
  type MutableYieldRow = { -readonly [K in keyof YieldRow]: YieldRow[K] };

  function smuggleYield(mutate: (rows: MutableYieldRow[]) => void): ReturnType<typeof checkYieldTable> {
    const copy = JSON.parse(JSON.stringify(YIELD_TABLE)) as MutableYieldRow[];
    mutate(copy);
    return checkYieldTable(copy);
  }

  function yieldRow(rows: MutableYieldRow[], id: string): MutableYieldRow {
    const row = rows.find((r) => r.id === id);
    if (row === undefined) throw new Error(`smuggle: YIELD_TABLE has no row ${id}`);
    return row;
  }

  /** A writeable view of a ledger spec. */
  type MutableLedgerSpec = { -readonly [K in keyof LedgerSpec]: LedgerSpec[K] };

  function smuggleLedger(mutate: (rows: MutableLedgerSpec[]) => void): ReturnType<typeof checkLedger> {
    const copy = JSON.parse(JSON.stringify(LEDGER_SPECS)) as MutableLedgerSpec[];
    mutate(copy);
    return checkLedger(copy);
  }

  /** A writeable view of a GHZ claim. */
  type MutableGhzClaim = { -readonly [K in keyof GhzClaimRow]: GhzClaimRow[K] };

  function smuggleGhz(mutate: (rows: MutableGhzClaim[]) => void): ReturnType<typeof checkGhzClaims> {
    const copy = JSON.parse(JSON.stringify(GHZ_CLAIMS)) as MutableGhzClaim[];
    mutate(copy);
    return checkGhzClaims(copy, 30);
  }

  it("H6: a counterfeit yield row claiming the asymptotic hashing line is rejected and named", () => {
    const hit = smuggleYield((rows) => {
      // the n=4 desk claims the n=infinity hashing rate — laundering the line
      yieldRow(rows, "Y-W85-4").coinYield = hashingLineWerner(0.85);
    }).find((v) => v.law === "H6" && /asymptotic/.test(v.detail));
    assert.ok(hit, "expected an asymptotic-laundering violation");
    assert.match(hit.detail, /counterfeit/);
    assert.match(hit.row, /Y-W85-4/);
  });

  it("H6: a counterfeit mint (F_out = 1 at bounded scale) is rejected", () => {
    const hit = smuggleYield((rows) => {
      yieldRow(rows, "Y-D10-2").fidelityOut = 1;
    }).find((v) => v.law === "H6" && /counterfeit mint/.test(v.detail));
    assert.ok(hit, "expected a counterfeit-mint violation");
    assert.match(hit.detail, /counterfeit mint/);
  });

  it("H6: a misquoted hashing line is rejected", () => {
    const hit = smuggleYield((rows) => {
      yieldRow(rows, "Y-H85").coinYield = 0.16;
    }).find((v) => v.law === "H6");
    assert.ok(hit, "expected an H6 violation");
    assert.match(hit.detail, /misquoted/);
  });

  it("H7: a fake conservation identity is rejected by recomputation and named", () => {
    const hit = smuggleLedger((rows) => {
      // teleportation's burned E_F claimed as conserved — the classic fake
      const row = rows.find((r) => r.id === "L2");
      if (row === undefined) throw new Error("smuggle: no L2");
      row.claim = "CONSERVED";
    }).find((v) => v.law === "H7");
    assert.ok(hit, "expected an H7 violation");
    assert.match(hit.detail, /fake conservation identity/);
    assert.match(hit.detail, /delta/);
  });

  it("H7: a fake never-rises (claiming conservation where the machine sees change) is rejected", () => {
    const hit = smuggleLedger((rows) => {
      const row = rows.find((r) => r.id === "L6");
      if (row === undefined) throw new Error("smuggle: no L6");
      row.claim = "CONSERVED";
    }).find((v) => v.law === "H7");
    assert.ok(hit, "expected an H7 violation");
    assert.match(hit.detail, /fake conservation identity/);
  });

  it("H8: a refuted wall claimed as holding is rejected and named", () => {
    const hit = smuggleGhz((rows) => {
      const row = rows.find((r) => r.id === "G5");
      if (row === undefined) throw new Error("smuggle: no G5");
      row.tag = "HOLDS";
    }).find((v) => v.law === "H8");
    assert.ok(hit, "expected an H8 violation");
    assert.match(hit.detail, /claimed HOLDS/);
    assert.match(hit.detail, /rises/);
  });
});

describe("T9 the quality hardening — named refusals, exact arithmetic anchors, quartet discipline", () => {
  it("every public boundary rejects illegal input BY NAME (the EC_ code is in the message)", () => {
    assert.throws(() => bellDiagonal([1]), /EC_WEIGHTS/);
    assert.throws(() => bellRoundClosedForm([0.5, 0.5], [0.25, 0.25, 0.25, 0.25]), /EC_WEIGHTS/);
    assert.throws(() => schemePurify(5, wernerCoin(0.85)), /EC_SCALE/);
    assert.throws(() => h2(1.5), /EC_H2_RANGE/);
    assert.throws(() => h2ViaLn(-0.1), /EC_H2_RANGE/);
    assert.throws(() => wernerCoin(0), /EC_F_RANGE/);
    assert.throws(() => depolCoin(1.5), /EC_P_RANGE/);
    assert.throws(() => netWeakCoin(0), /EC_LMIN/);
    assert.throws(() => partialTrace(PHI_PLUS, [2, 2], [5]), /EC_INDEX/);
    assert.throws(() => mMul(mat(2, 3), mat(2, 2)), /EC_SHAPE/);
    assert.throws(() => makeRng(1).pick([]), /EC_EMPTY/);
    assert.throws(() => shannonBits([0.5, 0.5, 0.5]), /EC_WEIGHTS/);
    assert.throws(() => at4(corrections(), 4, "correction"), /EC_TUPLE_INDEX/);
  });

  it("the report printer refuses non-finite input — NaN is never prose (the convicted latent defect, now anchored)", () => {
    assert.throws(() => fmt(Number.NaN), /EC_NON_FINITE/);
    assert.throws(() => fmt(Number.POSITIVE_INFINITY), /EC_NON_FINITE/);
    assert.strictEqual(fmt(0.123456789), "0.123457");
    assert.strictEqual(fmt(1, 0), "1");
    assert.strictEqual(fmt(-2.5, 2), "-2.50");
  });

  it("h2 exact values: both routes return exactly 0, 1, 0 at x = 0, 1/2, 1", () => {
    assert.strictEqual(h2(0), 0);
    assert.strictEqual(h2(1), 0);
    assert.strictEqual(h2(0.5), 1);
    assert.strictEqual(h2ViaLn(0), 0);
    assert.strictEqual(h2ViaLn(1), 0);
    assert.strictEqual(h2ViaLn(0.5), 1);
  });

  it("efFromConcurrence is the single E_F source: exact at C = 0 and C = 1, recomputed inline as an anchor", () => {
    assert.strictEqual(efFromConcurrence(0), 0);
    assert.strictEqual(efFromConcurrence(1), 1);
    // independent inline recomputation of the formula (deliberately not shared code)
    const c = 2 * Math.sqrt(0.75 * 0.25); // the canonical l_min = 1/4 weak coin's concurrence
    assert.ok(Math.abs(efFromConcurrence(c) - h2((1 + Math.sqrt(1 - c * c)) / 2)) <= 1e-15);
    assert.ok(Math.abs(eF(PHI_PLUS) - 1) <= 1e-12, "eF of the standard coin is 1 through the shared source");
  });

  it("the Bell quartets are orthonormal in BOTH parts — and the checks have teeth on counterfeits", () => {
    const basis = bellBasis();
    assert.strictEqual(basis.length, 4);
    assert.strictEqual(bellProjectors().length, 4);
    assert.strictEqual(corrections().length, 4);
    for (let i = 0; i < 4; i++) {
      assert.ok(Math.abs(vInner(basis[i]!, basis[i]!).re - 1) <= 1e-12, `norm of Bell ${i}`);
      assert.ok(Math.abs(vInner(basis[i]!, basis[i]!).im) <= 1e-12, `imag self-inner of Bell ${i}`);
      for (let j = i + 1; j < 4; j++) {
        const ip = vInner(basis[i]!, basis[j]!);
        assert.ok(Math.abs(ip.re) <= 1e-12 && Math.abs(ip.im) <= 1e-12, `Bell ${i} x Bell ${j} must be orthogonal in both parts`);
      }
    }
    // NEGATIVE CONTROL — a wrong pairing (product state |00> + |10>) must FAIL the check
    const counterfeit = vScale(vAdd(vKron(KET0, KET0), vKron(KET1, KET0)), 1 / Math.SQRT2);
    const ip = vInner(basis[0], counterfeit);
    assert.ok(Math.abs(ip.re - 0.5) <= 1e-12, "the orthogonality assertion must convict a wrong-pairing counterfeit");
    // NEGATIVE CONTROL — a missing normalization must FAIL the norm check
    const unnormalized = vAdd(vKron(KET0, KET0), vKron(KET1, KET1));
    assert.ok(Math.abs(vInner(unnormalized, unnormalized).re - 2) <= 1e-12);
  });

  it("ghzCoin is the 2-term outer product: exactly four nonzero entries, all on the corners", () => {
    const g = ghzCoin();
    const corners = new Set([0, 7, 56, 63]);
    for (let k = 0; k < 64; k++) {
      if (corners.has(k)) {
        assert.ok(Math.abs(g.re[k]! - 0.5) <= 1e-15, `corner ${k} must be 1/2`);
        assert.strictEqual(g.im[k]!, 0);
      } else {
        assert.strictEqual(g.re[k]!, 0);
        assert.strictEqual(g.im[k]!, 0);
      }
    }
  });
});
