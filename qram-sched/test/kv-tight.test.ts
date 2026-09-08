import test from "node:test";
import assert from "node:assert/strict";
import {
  derangement,
  deterministicGreedyHalfInstance,
  feigeRankingExpectation,
  greedyUniformExpectationExact,
  monotoneInstance,
  rankingExpectationExhaustive,
  sampleDnMember,
  verifyQueryLedger,
  verifyTightCertificate,
} from "../src/online/kv-tight.js";
import { greedyMatch, kuhnMaxMatching, randomInstance, rankingMatch } from "../src/online/matching.js";
import { Rng } from "../src/core/rng.js";

function fact(m: number): bigint {
  let f = 1n;
  for (let i = 2; i <= m; i++) f *= BigInt(i);
  return f;
}

test("kv: derangement numbers and Feige's published a(n) table reproduce exactly", () => {
  // d(m) for m = 0..8 (OEIS A000166)
  assert.deepEqual(
    [0, 1, 2, 3, 4, 5, 6, 7, 8].map((m) => derangement(m)),
    [1n, 0n, 1n, 2n, 9n, 44n, 265n, 1854n, 14833n],
  );
  // a(n) = (n+1)! - d(n+1) - d(n); Feige arXiv:1812.11774 Table (Theorem 6):
  // 1, 3, 13, 67, 411, 2921, 23633 for n = 1..7
  for (const [n, a] of [
    [1, 1n],
    [2, 3n],
    [3, 13n],
    [4, 67n],
    [5, 411n],
    [6, 2921n],
    [7, 23633n],
  ] as const) {
    const an = fact(n + 1) - derangement(n + 1) - derangement(n);
    assert.equal(an, a, `a(${n})`);
    assert.equal(Math.round(feigeRankingExpectation(n) * Number(fact(n))), Number(a), `E(${n}) * n!`);
  }
});

test("kv: three independent exact kernels agree — exhaustive = subset DP = derangement formula", () => {
  for (let n = 1; n <= 8; n++) {
    const ex = rankingExpectationExhaustive(n);
    const dp = greedyUniformExpectationExact(n);
    const f = feigeRankingExpectation(n);
    assert.ok(Math.abs(ex - f) < 1e-12, `n=${n} exhaustive ${ex} vs formula ${f}`);
    assert.ok(Math.abs(dp - f) < 1e-12, `n=${n} DP ${dp} vs formula ${f}`);
  }
  // DP carries the Lemma-13 consequence further than exhaustive can
  for (const n of [10, 14, 18, 20]) {
    assert.ok(Math.abs(greedyUniformExpectationExact(n) - feigeRankingExpectation(n)) < 1e-9, `n=${n}`);
  }
});

test("kv: the 1-1/e cap is met with the published additive constant 1-2/e", () => {
  const additive = 1 - 2 / Math.E;
  for (let n = 8; n <= 20; n += 2) {
    const gap = feigeRankingExpectation(n) - n * (1 - 1 / Math.E);
    assert.ok(Math.abs(gap - additive) < 1e-3, `n=${n}: gap ${gap} vs ${additive}`);
    assert.ok(feigeRankingExpectation(n) / n > 1 - 1 / Math.E, `n=${n}: ratio sits above the cap at finite n`);
  }
});

test("kv: MonotoneG member facts — OPT = n, greedy-lowest perfect, greedy-highest exactly n/2", () => {
  for (const n of [8, 16, 64]) {
    const inst = monotoneInstance(n);
    assert.equal(kuhnMaxMatching(inst), n);
    assert.equal(greedyMatch(inst, new Rng(0), "linear", "lowest").size, n);
    const reversed = { n, arrivals: inst.arrivals.map((nb) => [...nb].reverse()) };
    assert.equal(greedyMatch(reversed, new Rng(0), "linear", "lowest").size, n / 2);
  }
});

test("kv: D_n is the tight family — name-aware rules dragged onto a(n)/n! by the average", () => {
  const n = 16;
  const exact = feigeRankingExpectation(n);
  const K = 1500;
  let low = 0;
  let high = 0;
  let rank = 0;
  for (let s = 0; s < K; s++) {
    const inst = sampleDnMember(n, new Rng(90000 + s));
    low += greedyMatch(inst, new Rng(0), "linear", "lowest").size;
    const rev = { n: inst.n, arrivals: inst.arrivals.map((nb) => [...nb].reverse()) };
    high += greedyMatch(rev, new Rng(0), "linear", "lowest").size;
    rank += rankingMatch(inst, new Rng(50000 + s), "linear").size;
  }
  assert.ok(Math.abs(low / K - exact) < 0.15, `lowest ${low / K} vs ${exact}`);
  assert.ok(Math.abs(high / K - exact) < 0.15, `highest ${high / K} vs ${exact}`);
  assert.ok(Math.abs(rank / K - exact) < 0.15, `ranking ${rank / K} vs ${exact}`);
});

test("kv: deterministic phase adversary — greedy exactly n/2 under both tie-breaks", () => {
  for (const n of [8, 16, 64]) {
    for (const rule of ["lowest", "highest"] as const) {
      const inst = deterministicGreedyHalfInstance(n, rule);
      assert.equal(kuhnMaxMatching(inst), n, `n=${n} ${rule}: OPT`);
      const size = greedyMatch(inst, new Rng(0), "linear", rule).size;
      assert.equal(size, n / 2, `n=${n} ${rule}: greedy`);
      // the adversary is honest: phase 2's neighborhood IS the rule's own phase-1 matches
      const half = n / 2;
      const phase2 = inst.arrivals[half] as readonly number[];
      const sortedSet = [...new Set(phase2)].sort((a, b) => a - b);
      assert.equal(sortedSet.length, half);
    }
  }
});

test("kv: RANKING on MonotoneG equals the exact D_n value within Monte Carlo error", () => {
  const n = 64;
  const inst = monotoneInstance(n);
  const exactRatio = feigeRankingExpectation(n) / n;
  const seeds = 400;
  let mean = 0;
  for (let s = 0; s < seeds; s++) mean += rankingMatch(inst, new Rng(s), "linear").size / n / seeds;
  assert.ok(Math.abs(mean - exactRatio) < 0.01, `${mean} vs ${exactRatio}`);
});

test("kv: random banks stay above 1-1/e (the family is the adversarial one, not random)", () => {
  let minRank = 1;
  for (let s = 0; s < 30; s++) {
    const inst = randomInstance(64, 64, 0.08, new Rng(8100 + s));
    const opt = kuhnMaxMatching(inst);
    if (opt === 0) continue;
    minRank = Math.min(minRank, rankingMatch(inst, new Rng(s), "linear").size / opt);
  }
  assert.ok(minRank > 1 - 1 / Math.E, String(minRank));
});

// ---------------------------------------------------------------------------
// 走私审判 (smuggling trials): counterfeit certificates and fake ledgers must
// be NAMED and REJECTED by the checkers — never silently accepted.
// ---------------------------------------------------------------------------

test("走私审判 #1: counterfeit tight-instance certificates are NAMED and rejected", () => {
  // 走私品 A: "greedy-uniform is 1/2-tight on the KV family, E = n/2" — 把最坏
  // 情形帽(1/2)冒充成 KV 族上的紧值。机器DP给出 a(n)/n! = 0.6652·n。
  const n = 8;
  const trueValue = greedyUniformExpectationExact(n);
  const fakeA = verifyTightCertificate({ family: "kv-monotone", n, algorithm: "greedy-uniform", claimedExpectedSize: n / 2, claimedRatio: 0.5 });
  assert.ok(!fakeA.accepted, "smuggled worst-case cap as the family value");
  const namesA = fakeA.violations.map((v) => v.name).join("; ");
  assert.ok(namesA.includes("counterfeit expectation"), `must name the fake expectation: ${namesA}`);
  assert.ok(namesA.includes("counterfeit ratio cap"), `must name the fake cap: ${namesA}`);
  assert.ok(Math.abs(fakeA.machineExpectedSize - trueValue) < 1e-12);
  assert.ok(trueValue / n > 0.66, `the KV-family value is far above 1/2: ${trueValue / n}`);

  // 走私品 B: "RANKING is perfect on the tight family" — E = n, ratio 1.0。
  const fakeB = verifyTightCertificate({ family: "kv-monotone", n, algorithm: "ranking", claimedExpectedSize: n, claimedRatio: 1 });
  assert.ok(!fakeB.accepted, "smuggled perfection onto the tight family");
  assert.ok(
    fakeB.violations.some((v) => v.name === "counterfeit expectation" && v.detail.includes("5.321")),
    `must name the true machine value: ${JSON.stringify(fakeB.violations)}`,
  );

  // 走私品 C: 把 D_n 分布的紧值贴到单个 MonotoneG 成员上的 name-aware 规则
  // ("greedy-lowest 在紧族上就是 a(n)/n!")。真值:成员上 greedy-lowest = n。
  const fakeC = verifyTightCertificate({ family: "kv-monotone", n, algorithm: "greedy-lowest", claimedExpectedSize: feigeRankingExpectation(n), claimedRatio: feigeRankingExpectation(n) / n });
  assert.ok(!fakeC.accepted, "distribution value smuggled onto a single member");
  assert.ok(
    fakeC.violations.some((v) => v.name === "name-aware rule on a single member"),
    `must name the single-member smuggling: ${JSON.stringify(fakeC.violations.map((v) => v.name))}`,
  );
  assert.equal(fakeC.machineExpectedSize, n, "greedy-lowest on the fixed member matches perfectly");

  // 家族/算法错配:把 randomized 规则的证书贴到确定性 phase 对手族上。
  const fakeD = verifyTightCertificate({ family: "greedy-adversary", n: 16, algorithm: "ranking", claimedExpectedSize: 8, claimedRatio: 0.5 });
  assert.ok(!fakeD.accepted);
  assert.ok(fakeD.violations.some((v) => v.name === "family/algorithm mismatch"));

  // 正品:机器值原样申报的 greedy-adversary 证书必须被接受(裁判不乱杀)。
  const legit = verifyTightCertificate({ family: "greedy-adversary", n: 16, algorithm: "greedy-lowest", claimedExpectedSize: 8, claimedRatio: 0.5 });
  assert.ok(legit.accepted, JSON.stringify(legit.violations));
  const legit2 = verifyTightCertificate({ family: "kv-monotone", n, algorithm: "ranking", claimedExpectedSize: feigeRankingExpectation(n), claimedRatio: feigeRankingExpectation(n) / n });
  assert.ok(legit2.accepted, JSON.stringify(legit2.violations));
});

test("走私审判 #2: fake query ledgers are NAMED and rejected", () => {
  const inst = monotoneInstance(64);
  const arrivals = inst.arrivals.length;

  // 走私品 A: 线性账本"打对折"(reads = n·arrivals/2)——审查重放必须逐字节
  // 复算 n-per-arrival 的线性读数。
  const fakeA = verifyQueryLedger(
    inst,
    { mode: "linear", claimedReads: (inst.n * arrivals) / 2, claimedMeanSize: 0, claimedDisagreements: 0 },
    20,
  );
  assert.ok(!fakeA.accepted, "halved linear ledger");
  assert.ok(
    fakeA.violations.some((v) => v.name === "linear ledger must be exact" && v.detail.includes(`${inst.n * arrivals}`)),
    `must name the exact linear requirement: ${JSON.stringify(fakeA.violations)}`,
  );
  assert.ok(fakeA.violations.some((v) => v.name === "counterfeit mean size"));

  // 走私品 B: 量子账本"免单"(reads = 1)且声称零分歧——每到达至少一次
  // oracle 读数是硬地板,重放里实际发生的 bounded-error 分歧被洗白。
  const replay = verifyQueryLedger(
    inst,
    { mode: "grover", claimedReads: 1e9, claimedMeanSize: 0, claimedDisagreements: -1 },
    20,
  );
  assert.ok(replay.machineMeanDisagreements > 0, "the replay must actually catch misses on this bank");
  const fakeB = verifyQueryLedger(
    inst,
    { mode: "grover", claimedReads: 1, claimedMeanSize: replay.machineMeanSize, claimedDisagreements: 0 },
    20,
  );
  assert.ok(!fakeB.accepted, "free quantum ledger with laundered disagreements");
  const namesB = fakeB.violations.map((v) => v.name).join("; ");
  assert.ok(namesB.includes("ledger below the oracle floor"), `must name the floor: ${namesB}`);
  assert.ok(namesB.includes("disagreement laundering"), `must name the laundering: ${namesB}`);

  // 走私品 C: 虚报量子账单(读取远超重放)——多报也被点名。
  const fakeC = verifyQueryLedger(
    inst,
    { mode: "grover", claimedReads: 1e9, claimedMeanSize: replay.machineMeanSize, claimedDisagreements: replay.machineMeanDisagreements },
    20,
  );
  assert.ok(!fakeC.accepted, "inflated quantum ledger");
  assert.ok(fakeC.violations.some((v) => v.name === "inflated quantum ledger"));

  // 正品:线性账本按机器重放原样申报必须被接受。
  const linReplay = verifyQueryLedger(
    inst,
    { mode: "linear", claimedReads: 0, claimedMeanSize: 0, claimedDisagreements: 0 },
    20,
  );
  const honest = verifyQueryLedger(
    inst,
    { mode: "linear", claimedReads: inst.n * arrivals, claimedMeanSize: linReplay.machineMeanSize, claimedDisagreements: 0 },
    20,
  );
  assert.ok(honest.accepted, JSON.stringify(honest.violations));
});
