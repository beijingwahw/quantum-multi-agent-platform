/**
 * Assumption-constants audit for the resource estimator (theory.md §2):
 * every constant the estimator consumes is declared here with provenance —
 * either citation-anchored (value taken from a published result, verified
 * against at least two independent works) or an engineering assumption
 * (explicitly labeled, with a rationale). A constant without provenance is
 * rejected by the machine gate `validateConstantsAudit`; a row claiming to
 * bind a live code constant with a drifted value is rejected as well.
 *
 * Provenance anchors were verified during the 2026-09-08 literature pass
 * (two independent sources per anchored value; see docs/theory.md §5).
 */

import { DEFAULT_FT_ASSUMPTIONS } from "./estimate.js";
import { grossCode, surfaceCode } from "./codes.js";

export type ProvenanceKind = "paper" | "vendor" | "database" | "press" | "university";

export interface ProvenanceSource {
  /**
   * Canonical work identifier. Mirrors of one work (arXiv preprint and its
   * journal version) share a workId, so "two sources" cannot be satisfied by
   * citing the same paper twice under different locators.
   */
  readonly workId: string;
  readonly title: string;
  /** arXiv id, DOI, or URL — must match one of the accepted locator shapes. */
  readonly locator: string;
  readonly kind: ProvenanceKind;
}

export type ConstantKind = "citation-anchored" | "engineering-assumption";

export interface ConstantBinding {
  /** Key into LIVE_CONSTANT_VALUES (the actual constant consumed by code). */
  readonly key: string;
  /** Value the audit row claims; the gate cross-checks against the live one. */
  readonly claimed: number;
}

export interface ConstantRow {
  readonly id: string;
  readonly symbol: string;
  readonly value: number | string;
  readonly unit: string;
  readonly kind: ConstantKind;
  readonly provenance: readonly ProvenanceSource[];
  /** Mandatory for engineering-assumption rows (>= 40 chars of substance). */
  readonly rationale?: string;
  readonly binding?: ConstantBinding;
  /** Where this constant enters the estimate / experiments. */
  readonly usedIn: string;
}

/** The live values code actually consumes — the audit's drift oracle. */
export const LIVE_CONSTANT_VALUES: Readonly<Record<string, number>> = {
  "DEFAULT_FT_ASSUMPTIONS.pPhys": DEFAULT_FT_ASSUMPTIONS.pPhys,
  "DEFAULT_FT_ASSUMPTIONS.cycleTimeUs": DEFAULT_FT_ASSUMPTIONS.cycleTimeUs,
  "DEFAULT_FT_ASSUMPTIONS.roundsPerOpDistanceFactor": DEFAULT_FT_ASSUMPTIONS.roundsPerOpDistanceFactor,
  "DEFAULT_FT_ASSUMPTIONS.targetCircuitError": DEFAULT_FT_ASSUMPTIONS.targetCircuitError,
  "DEFAULT_FT_ASSUMPTIONS.logicalErrorModel.amplitude": DEFAULT_FT_ASSUMPTIONS.logicalErrorModel.amplitude,
  "DEFAULT_FT_ASSUMPTIONS.synthesis.epsilon": DEFAULT_FT_ASSUMPTIONS.synthesis.epsilon,
  "DEFAULT_FT_ASSUMPTIONS.synthesis.coefficient": DEFAULT_FT_ASSUMPTIONS.synthesis.coefficient!,
  "DEFAULT_FT_ASSUMPTIONS.synthesis.additiveConstant": DEFAULT_FT_ASSUMPTIONS.synthesis.additiveConstant!,
  "DEFAULT_FT_ASSUMPTIONS.tFactory.epsilonPerT": DEFAULT_FT_ASSUMPTIONS.tFactory.epsilonPerT,
  "surfaceCode.defaultThreshold": surfaceCode(3).threshold,
  "grossCode.threshold": grossCode().threshold,
  "grossCode.n": grossCode().n,
  "grossCode.k": grossCode().k,
  "grossCode.d": grossCode().d,
};

const LOCATOR_PATTERN = /^(arXiv:\d{4}\.\d{4,5}(v\d+)?|10\.\d{4,9}\/\S+|https?:\/\/\S+)$/;

export interface AuditRejection {
  readonly id: string;
  readonly reason: string;
}

export interface AuditResult {
  readonly valid: boolean;
  readonly rejected: readonly AuditRejection[];
  readonly rowCount: number;
  readonly anchoredCount: number;
  readonly assumptionCount: number;
}

/**
 * Machine gate for the constants table. A row is rejected (and named) when:
 *  - its id is missing/duplicated;
 *  - an anchored row rests on fewer than two independent works (distinct
 *    workIds) or cites an invalid locator;
 *  - an engineering-assumption row carries no substantive rationale;
 *  - a row bound to a live code constant has drifted from it.
 */
export function validateConstantsAudit(rows: readonly ConstantRow[]): AuditResult {
  const rejected: AuditRejection[] = [];
  const seen = new Set<string>();
  let anchored = 0;
  let assumptions = 0;

  for (const row of rows) {
    if (!row.id || !/^[a-z0-9-]+$/.test(row.id)) {
      rejected.push({ id: row.id || "(empty id)", reason: "id must be a non-empty kebab-case string" });
      continue;
    }
    if (seen.has(row.id)) {
      rejected.push({ id: row.id, reason: "duplicate id" });
      continue;
    }
    seen.add(row.id);

    if (typeof row.value === "number" && !Number.isFinite(row.value)) {
      rejected.push({ id: row.id, reason: `non-finite value ${String(row.value)}` });
    }
    if (typeof row.value === "string" && row.value.trim().length === 0) {
      rejected.push({ id: row.id, reason: "empty string value" });
    }
    if (row.unit.trim().length === 0) {
      rejected.push({ id: row.id, reason: "missing unit" });
    }
    if (row.usedIn.trim().length === 0) {
      rejected.push({ id: row.id, reason: "missing usage note (usedIn)" });
    }

    for (const src of row.provenance) {
      if (src.title.trim().length === 0 || !LOCATOR_PATTERN.test(src.locator)) {
        rejected.push({ id: row.id, reason: `invalid provenance source (bad title/locator): ${src.locator}` });
      }
    }

    if (row.kind === "citation-anchored") {
      const works = new Set(row.provenance.map((s) => s.workId));
      if (row.provenance.length < 2 || works.size < 2) {
        rejected.push({
          id: row.id,
          reason: `citation-anchored row needs >= 2 independent works, got ${works.size} (${[...works].join(", ") || "none"})`,
        });
      }
      anchored++;
    } else {
      if (row.rationale === undefined || row.rationale.trim().length < 40) {
        rejected.push({ id: row.id, reason: "engineering-assumption row needs a substantive rationale (>= 40 chars)" });
      }
      assumptions++;
    }

    if (row.binding !== undefined) {
      const live = LIVE_CONSTANT_VALUES[row.binding.key];
      if (live === undefined) {
        rejected.push({ id: row.id, reason: `binding key '${row.binding.key}' has no live constant` });
      } else if (live !== row.binding.claimed) {
        rejected.push({
          id: row.id,
          reason: `binding drift on '${row.binding.key}': audit claims ${row.binding.claimed}, code uses ${live}`,
        });
      }
    }
  }

  return {
    valid: rejected.length === 0,
    rejected,
    rowCount: rows.length,
    anchoredCount: anchored,
    assumptionCount: assumptions,
  };
}

const GROSS_PAPER: ProvenanceSource = {
  workId: "bravyi-2024-gross",
  title: "High-threshold and low-overhead fault-tolerant quantum memory",
  locator: "10.1038/s41586-024-07107-7",
  kind: "paper",
};
const GROSS_BLOG: ProvenanceSource = {
  workId: "ibm-blog-qldpc",
  title: "IBM Quantum blog: qLDPC error correction (gross code context)",
  locator: "https://www.ibm.com/quantum/blog/nature-qldpc-error-correction",
  kind: "vendor",
};
const GROSS_ZOO: ProvenanceSource = {
  workId: "ec-zoo-gross",
  title: "Error Correction Zoo: gross code",
  locator: "https://errorcorrectionzoo.org/c/gross",
  kind: "database",
};
const GOOGLE_BTP_NATURE: ProvenanceSource = {
  workId: "google-2024-below-threshold",
  title: "Quantum error correction below the surface code threshold (Nature 638, 920-926)",
  locator: "10.1038/s41586-024-08449-y",
  kind: "paper",
};
const GOOGLE_BTP_PRINCETON: ProvenanceSource = {
  workId: "princeton-below-threshold",
  title: "Princeton collaboration page: Quantum error correction below the surface code threshold",
  locator: "https://collaborate.princeton.edu/en/publications/quantum-error-correction-below-the-surface-code-threshold/",
  kind: "university",
};
const FOWLER_2012: ProvenanceSource = {
  workId: "fowler-2012-surface",
  title: "Surface codes: Towards practical large-scale quantum computation (Phys. Rev. A 86, 032324)",
  locator: "10.1103/PhysRevA.86.032324",
  kind: "paper",
};
const EC_ZOO_THRESHOLD: ProvenanceSource = {
  workId: "ec-zoo-thresholds",
  title: "Error Correction Zoo: quantum threshold list (SD6/SI1000 circuit-level values)",
  locator: "https://errorcorrectionzoo.org/list/quantum_threshold",
  kind: "database",
};
const ROSS_SELINGER: ProvenanceSource = {
  workId: "ross-selinger-2014",
  title: "Optimal ancilla-free Clifford+T approximation of z-rotations (T-count 3 log2(1/eps) + O(log log))",
  locator: "arXiv:1403.2975",
  kind: "paper",
};
const KMM_2013: ProvenanceSource = {
  workId: "kmm-2013-synthesis",
  title: "Clifford+T synthesis with the Clifford group and T gate (asymptotic scaling)",
  locator: "arXiv:1212.6964",
  kind: "paper",
};
const GIDNEY_EKERA: ProvenanceSource = {
  workId: "gidney-ekera-2021",
  title: "How to factor 2048 bit RSA integers in 8 hours using 20 million noisy qubits (Quantum 5, 433)",
  locator: "10.22331/q-2021-04-15-433",
  kind: "paper",
};
const GIDNEY_2025: ProvenanceSource = {
  workId: "gidney-2025-rsa",
  title: "How to factor 2048 bit RSA integers with less than a million noisy qubits",
  locator: "arXiv:2505.15917",
  kind: "paper",
};
const FPGA_RELAY_BP: ProvenanceSource = {
  workId: "fpga-relay-bp-2025",
  title: "Real-time decoding of the gross code memory with FPGAs (Relay-BP)",
  locator: "arXiv:2510.21600",
  kind: "paper",
};
const BASCONES_2025: ProvenanceSource = {
  workId: "bascones-2025-bposd-hw",
  title: "FPGA and ASIC design space of BP+OSD decoders (EPJ Quantum Technology)",
  locator: "10.1140/epjqt/s40507-025-00446-y",
  kind: "paper",
};
const RIVERLANE: ProvenanceSource = {
  workId: "riverlane-realtime",
  title: "Riverlane: real-time QEC system performance (16.32 us mean decoding latency on real QPU data; sub-us per-round ASIC targets)",
  locator: "https://www.riverlane.com/news/riverlane-s-real-time-qec-system-performance",
  kind: "vendor",
};
const MARSHALL_2020: ProvenanceSource = {
  workId: "marshall-2020-qaoa-noise",
  title: "Characterizing local noise in QAOA circuits (IOP SciNotes 1, 025208; depolarizing >2% caps useful depth near 3)",
  locator: "10.1088/2633-1357/abb0d7",
  kind: "paper",
};
const PAN_2022: ProvenanceSource = {
  workId: "pan-2022-depth-opt",
  title: "Automatic depth optimization for QAOA (Phys. Rev. A 105, 032433; performance declines past a finite optimal depth as noise accumulates)",
  locator: "10.1103/PhysRevA.105.032433",
  kind: "paper",
};

export const CONSTANTS_AUDIT: readonly ConstantRow[] = [
  {
    id: "gross-code-params",
    symbol: "[[n,k,d]] = [[144,12,12]]",
    value: "[[144,12,12]], 288 total qubits per block incl. 144 ancillas",
    unit: "qubits",
    kind: "citation-anchored",
    provenance: [GROSS_PAPER, GROSS_BLOG, GROSS_ZOO],
    binding: { key: "grossCode.k", claimed: 12 },
    usedIn: "src/ft/codes.ts grossCode(); exp2/exp3 block accounting",
  },
  {
    id: "gross-code-distance",
    symbol: "d_gross",
    value: 12,
    unit: "code distance",
    kind: "citation-anchored",
    provenance: [GROSS_PAPER, GROSS_ZOO],
    binding: { key: "grossCode.d", claimed: 12 },
    usedIn: "logical error exponent floor(d/2)+1; rounds per op",
  },
  {
    id: "gross-code-pseudo-threshold",
    symbol: "p_th(gross)",
    value: 0.007,
    unit: "probability per operation",
    kind: "citation-anchored",
    provenance: [GROSS_PAPER, GROSS_BLOG],
    rationale: "reported BP+OSD circuit-level pseudo-threshold range 0.6-0.8%; midpoint used as estimation input",
    binding: { key: "grossCode.threshold", claimed: 0.007 },
    usedIn: "logicalErrorPerRound denominator",
  },
  {
    id: "surface-threshold-default",
    symbol: "p_th(surface)",
    value: 0.006,
    unit: "probability per operation",
    kind: "engineering-assumption",
    provenance: [FOWLER_2012, EC_ZOO_THRESHOLD],
    rationale:
      "conservative low edge of the published circuit-level window (~0.6%-1.1% depending on noise model and decoder); an estimation input, not a precision claim",
    binding: { key: "surfaceCode.defaultThreshold", claimed: 0.006 },
    usedIn: "surfaceCode() default; logicalErrorPerRound denominator",
  },
  {
    id: "logical-error-prefactor",
    symbol: "A",
    value: 0.1,
    unit: "dimensionless",
    kind: "engineering-assumption",
    provenance: [FOWLER_2012],
    rationale:
      "prefactor of the below-threshold power-law shape eps_L = A (p/p_th)^(floor(d/2)+1); the shape is standard, the amplitude is a scenario input",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.logicalErrorModel.amplitude", claimed: 0.1 },
    usedIn: "logicalErrorPerRound",
  },
  {
    id: "physical-error-default",
    symbol: "p_phys",
    value: 0.001,
    unit: "probability per operation",
    kind: "engineering-assumption",
    provenance: [],
    rationale:
      "scenario physical error rate, chosen below both anchored thresholds (gross 0.7%, surface ~0.6-1%); swept in exp2 sensitivity",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.pPhys", claimed: 0.001 },
    usedIn: "estimateDeepQaoa channel error",
  },
  {
    id: "cycle-time-us",
    symbol: "tau",
    value: 1,
    unit: "microseconds per syndrome round",
    kind: "engineering-assumption",
    provenance: [FOWLER_2012],
    rationale:
      "standard superconducting syndrome-extraction cycle period used across the surface-code roadmap literature; hardware-dependent scenario input",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.cycleTimeUs", claimed: 1 },
    usedIn: "wall time; exp3 arrival stream",
  },
  {
    id: "rounds-per-op-distance-factor",
    symbol: "f",
    value: 1,
    unit: "distance multiples",
    kind: "engineering-assumption",
    provenance: [],
    rationale:
      "lattice-surgery / injection latency heuristic: each logical op consumes ~d syndrome rounds; deliberately exposed, not hardware-anchored",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.roundsPerOpDistanceFactor", claimed: 1 },
    usedIn: "syndromeRoundsPerOp",
  },
  {
    id: "target-circuit-error",
    symbol: "eps_budget",
    value: 0.01,
    unit: "probability per circuit",
    kind: "engineering-assumption",
    provenance: [],
    rationale:
      "acceptable total logical failure probability for one full QAOA execution; a programmatic target, not derived from hardware",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.targetCircuitError", claimed: 0.01 },
    usedIn: "meetsBudget verdict",
  },
  {
    id: "synthesis-tcount-coefficient",
    symbol: "c",
    value: 3,
    unit: "T gates per log2(1/eps)",
    kind: "citation-anchored",
    provenance: [ROSS_SELINGER, KMM_2013],
    rationale: "Ross-Selinger gives T <= 3 log2(1/eps) + O(log log(1/eps)) for ancilla-free z-rotations; KMM establishes the O(log) synthesis route",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.synthesis.coefficient", claimed: 3 },
    usedIn: "tCountForRotation",
  },
  {
    id: "synthesis-tcount-additive",
    symbol: "c0",
    value: 4,
    unit: "T gates",
    kind: "engineering-assumption",
    provenance: [ROSS_SELINGER],
    rationale:
      "additive floor absorbing the O(log log(1/eps)) term and per-rotation gate-count overhead at eps ~ 1e-6; scenario input",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.synthesis.additiveConstant", claimed: 4 },
    usedIn: "tCountForRotation",
  },
  {
    id: "synthesis-epsilon",
    symbol: "eps_syn",
    value: 1e-6,
    unit: "rotation infidelity",
    kind: "engineering-assumption",
    provenance: [],
    rationale:
      "target precision per synthesized rotation, sized so synthesis error stays negligible against the 1e-2 circuit budget; scenario input",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.synthesis.epsilon", claimed: 1e-6 },
    usedIn: "tCountForRotation",
  },
  {
    id: "t-factory-scenarios",
    symbol: "(ns/T, qubits/T, eps_T)",
    value: "(100ns, 5k, 1e-12) / (10us, 5k, 1e-12) / (60us, 12k, 1e-12)",
    unit: "mixed",
    kind: "engineering-assumption",
    provenance: [GIDNEY_EKERA, GIDNEY_2025],
    rationale:
      "two-level distillation scenario brackets in the Gidney-Ekera 2021 class; the specific ns/qubit numbers are assumptions (factory designs moved substantially by 2025), swept across all three tiers in exp2",
    usedIn: "FtAssumptions.tFactory (scenario-swept in exp2)",
  },
  {
    id: "t-factory-eps-per-t",
    symbol: "eps_T",
    value: 1e-12,
    unit: "error per distilled T",
    kind: "engineering-assumption",
    provenance: [GIDNEY_EKERA],
    rationale:
      "distilled-T error for two-level distillation; exp2 shows single-level 1e-8 fails deep-circuit budgets outright, so multi-level is forced",
    binding: { key: "DEFAULT_FT_ASSUMPTIONS.tFactory.epsilonPerT", claimed: 1e-12 },
    usedIn: "epsilonDistillationTotal",
  },
  {
    id: "decoder-cpu-latency",
    symbol: "lambda_CPU",
    value: 1000,
    unit: "microseconds per round",
    kind: "engineering-assumption",
    provenance: [BASCONES_2025, FPGA_RELAY_BP],
    rationale:
      "software BP+OSD per-round decode time on CPU-class hardware; the known three-orders-of-magnitude gap this repo quantifies",
    usedIn: "exp3 scenario cpu-bposd",
  },
  {
    id: "decoder-fpga-latency",
    symbol: "lambda_FPGA",
    value: 100,
    unit: "microseconds per round",
    kind: "engineering-assumption",
    provenance: [GOOGLE_BTP_NATURE, FPGA_RELAY_BP],
    rationale:
      "FPGA-class per-round decode budget; anchors: Google reported 63 us sustained real-time decoder latency at d=5, FPGA Relay-BP decodes gross-code memory in real time",
    usedIn: "exp3 scenarios fpga-100us",
  },
  {
    id: "decoder-asic-latency",
    symbol: "lambda_ASIC",
    value: 1,
    unit: "microseconds per round (aggressive tier)",
    kind: "engineering-assumption",
    provenance: [RIVERLANE, BASCONES_2025],
    rationale:
      "ASIC-class per-round decode budget (10 us moderate, 1 us aggressive); anchors: Riverlane sub-microsecond per-round decoding claims, BP+OSD ASIC design-space study",
    usedIn: "exp3 scenarios asic-10us / asic-1us",
  },
  {
    id: "logical-error-suppression-lambda",
    symbol: "Lambda (d -> d+2)",
    value: 2.14,
    unit: "error-suppression factor",
    kind: "citation-anchored",
    provenance: [GOOGLE_BTP_NATURE, GOOGLE_BTP_PRINCETON],
    rationale:
      "experimental below-threshold suppression factor on Willow (Lambda = 2.14 +- 0.02); not consumed by the estimator — it anchors the exp4 noise grid: today's logical layer is NOT noiseless",
    usedIn: "docs/theory.md noise-face framing; exp4 grid choice",
  },
  {
    id: "d7-logical-error-per-cycle",
    symbol: "eps_L(d=7)",
    value: 0.00143,
    unit: "logical error per cycle",
    kind: "citation-anchored",
    provenance: [GOOGLE_BTP_NATURE, GOOGLE_BTP_PRINCETON],
    rationale:
      "distance-7 logical error per cycle on Willow (0.143% +- 0.003%); brackets the exp4 depolarizing grid (1e-4 .. 1e-2) against real logical-layer noise scales",
    usedIn: "exp4 noise-grid calibration",
  },
  {
    id: "qaoa-noise-finite-depth",
    symbol: "p*(eps)",
    value: "finite optimal QAOA depth under per-layer depolarizing noise; ~2%/gate caps useful depth near 3",
    unit: "regime claim (not consumed numerically)",
    kind: "citation-anchored",
    provenance: [MARSHALL_2020, PAN_2022],
    rationale:
      "two independent lines (local-noise analysis; automatic depth optimization) both find QAOA quality non-monotone in depth under depolarizing noise; anchors the exp4 expectation that monotonicity breaks at a finite depth",
    usedIn: "docs/theory.md noise-face framing; exp4 bend expectation",
  },
];

/** Render the audit as a markdown table with provenance and kind columns. */
export function renderConstantsAudit(rows: readonly ConstantRow[], result: AuditResult): string[] {
  const lines: string[] = [
    "| id | value | kind | provenance (workIds) | bound to |",
    "|---|---|---|---|---|",
  ];
  for (const row of rows) {
    const prov = row.provenance.length > 0 ? row.provenance.map((s) => s.workId).join("; ") : "—";
    const bound = row.binding !== undefined ? `${row.binding.key} = ${row.binding.claimed}` : "—";
    lines.push(`| ${row.id} | ${typeof row.value === "number" ? row.value : String(row.value)} | ${row.kind} | ${prov} | ${bound} |`);
  }
  lines.push("");
  lines.push(
    `Gate: ${result.valid ? "PASS" : "REJECTED"} — ${result.rowCount} rows, ${result.anchoredCount} citation-anchored (>= 2 independent works each), ${result.assumptionCount} labeled engineering assumptions.`,
  );
  for (const r of result.rejected) {
    lines.push(`- REJECTED [${r.id}]: ${r.reason}`);
  }
  return lines;
}
