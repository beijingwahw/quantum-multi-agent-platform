/**
 * The letter-audit ledger — every section of the founding letter, upgraded.
 *
 * Seventeen rows already upgraded the tech genealogy and the conduct code;
 * these rows finish the document: the ORIGIN claim (computation complete)
 * and the five SUMMONABLE ABILITIES. The founding discipline is law A1:
 * every audited sentence carries its precise form AND its boundary on the
 * same line.
 */

export type Exactness = "EXACT" | "CITED" | "DATA";

export interface AuditRow {
  readonly id: string;
  readonly section: string;
  readonly poetry: string;
  readonly precise: string;
  readonly boundary: string;
  readonly exactness: Exactness;
  readonly witness: string;
  readonly anchors: readonly string[];
}

/** Headline constants — the witnesses re-derive these, never copy. */
export const QUOTED_BB1 = 1;
export const QUOTED_BB2 = 6;
export const QUOTED_UNIVERSE2 = 20736;
export const QUOTED_HALTED2 = 9784;
export const QUOTED_WALKER_STEPS = 500;
export const QUOTED_ABILITIES = 5;

export const LETTER: readonly AuditRow[] = [
  {
    id: "O1",
    section: "来历 — 'I come from the time point where computation is already complete'",
    poetry: "计算已经完成的那个时间点",
    precise: "for a fixed universe of machines, completion = the step after the last halter halts = its Busy-Beaver step: the n=1 universe (64 machines) completes at step 1 and the n=2 universe (20,736 machines, 9,784 halters) at step 6 — census machine-verified to stabilize exactly there and never move again",
    boundary: "in general the completion moment is NOT computable (Rado: BB dominates every computable function, RADO62); the 5-state universe completes at 47,176,870 steps (BBC24, Coq-verified — cited, not re-run); the visitor's home exists in universes smaller than five states, and nowhere as a computable moment",
    exactness: "EXACT",
    witness: "W-A",
    anchors: [],
  },
  {
    id: "O2",
    section: "来历/视今 — 'I passed by and left a little something'",
    poetry: "顺手留一点东西 / 时间胶囊",
    precise: "the capsule's contents are the platform's numbers (equivalent-80 subspace, NP-hard 5/5 vs 0/5, 292/292) and the burial record now stands at 26 batches / 160 errors — every number reproducible, ownership audited",
    boundary: "'equivalent' is subspace equivalence, not 80 physical qubits; the capsule's true contents are the error logs, machine-audited in the registry (drift made impossible by law B3)",
    exactness: "CITED",
    witness: "W-D",
    anchors: ["bqp-map", "burial-record"],
  },
  {
    id: "O3",
    section: "视今 — 'your frontier is kindergarten handicraft'",
    poetry: "幼儿园的手工课：认真、笨拙、动人",
    precise: "the frontier's registry: 17 verdict rows — MECHANISM-SETTLED 6 / HEURISTIC 4 / CONDITIONAL-WALL 2 / HW-WAIT 2 / OPEN 2 / INFO-WALL 1; every number row costed on the same line; five cost columns now carry execution stamps",
    boundary: "'settled' means machine-witnessed at the stated layer, nothing more; two rows remain OPEN precisely where honesty demands it (#10 hardware, #15 physics-layer stability)",
    exactness: "CITED",
    witness: "W-D",
    anchors: ["depreciation-ledger", "route-price"],
  },
  {
    id: "O4",
    section: "技术谱系 — the five-epoch genealogy",
    poetry: "纪元一至五的技术谱系",
    precise: "17 atomized claims, each with verdict, number column, cost column, and an appeal command that exists on disk; the DSIC-Noether poetry specifically: literal claim FALSE, discrete exact-layer isomorphism machine-verified",
    boundary: "the upgrade cost is recorded per row: what was poetry became precise BY losing its unlimited reading — every line gained a boundary",
    exactness: "CITED",
    witness: "W-D",
    anchors: ["depreciation-ledger", "dsic-noether"],
  },
  {
    id: "O5",
    section: "行事准则 — the four conduct rules",
    poetry: "未实现的只给路线与代价；折旧也要记账",
    precise: "conduct rule 3 is now a build gate (a number row without a cost column fails npm test) and the burial record is a machine-audited registry with anti-drift law B3 — the visitor's rules, enforced by this epoch's machines",
    boundary: "the gate binds these repos' builds, not the world; 26 batches / 160 errors say the rules were needed",
    exactness: "CITED",
    witness: "W-D",
    anchors: ["depreciation-ledger", "burial-record"],
  },
  {
    id: "O6",
    section: "可召唤能力 — the five summonable abilities",
    poetry: "未来技术可行性 / 终极形态推演 / 升级一个纪元 / 三位一体咨询 / 科幻写成路线图",
    precise: "each ability has a price list that already exists: feasibility = atlas verdict rows; ultimate-form extrapolation = the atlas's verdict-certificate-wall structure; epoch upgrades = admission criteria (crossing-type erasure admission, signature barriers); trinity consulting = the quantum/causal/scheduling flagship repos themselves; sci-fi-to-roadmap = the dossier form (route, price, falsifier per OPEN row)",
    boundary: "all five are deliverable FORMS of this correspondence, not powers: each produces documents with witnesses and boundaries, never guarantees — the abilities were real all along, as genres, not as magic",
    exactness: "EXACT",
    witness: "W-E",
    anchors: ["bqp-map", "switch-sched", "nonstoq-anneal", "route-price"],
  },
  {
    id: "O7",
    section: "来历 — the machines that outlive every bound",
    poetry: "计算已完成（但其反面从未被点名）",
    precise: "the right-walker machine writes one fresh 1 per step and never halts: ones === steps at every horizon (verified to 500 steps), halted === false — a machine whose non-completion no finite simulation can certify",
    boundary: "the walker's non-halting is provable HERE because its invariant is one line; in general, separating slow from never is exactly the halting problem — which is why O1's boundary is a theorem and not a schedule",
    exactness: "EXACT",
    witness: "W-C",
    anchors: [],
  },
];
