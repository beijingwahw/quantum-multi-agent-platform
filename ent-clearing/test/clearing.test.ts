import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it } from "node:test";
import { checkBoard, runWitnesses } from "../src/kernel/audit.js";
import { BOARD, type BoardRow } from "../src/kernel/board.js";
import { makeRng } from "../src/core/rng.js";
import { maximallyMixed, randomStateVec, vecToRho } from "../src/core/states.js";
import { traceDistance } from "../src/core/measures.js";
import { kron, type CVec } from "../src/core/cmat.js";
import {
  bellBasis,
  concurrence,
  denseCode,
  eF,
  entropyOfMixedQubit,
  h2,
  h2ViaLn,
  mintByGate,
  netWeakCoin,
  pureFidelity,
  randomLocalRound,
  randomMixedPair,
  randomMixedQubit,
  redeem,
  tetrahedronChi,
} from "../src/kernel/clearing.js";

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
      assert.ok(Math.abs(pureFidelity(nt.successState, bellBasis()[0] as CVec) - 1) <= 1e-12);
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
    assert.ok(Math.abs(pureFidelity(minted, bellBasis()[0] as CVec) - 1) <= 1e-12);
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
});
