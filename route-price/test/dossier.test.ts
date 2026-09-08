import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DOSSIERS, type Criterion, type Dossier, type DossierVerdict, type Milestone } from "../src/kernel/dossier.js";
import { checkDossiers, WORKSPACE_ROOT, type DossierInput } from "../src/kernel/audit.js";
import { runWitnesses, MULTIPLIER_NETLIST, MULTIPLIER_WIRES, applyNetlist } from "../src/kernel/witnesses.js";
import { renderLines, DossierRejectedError, DOSSIER_REJECTED } from "../src/experiments/render.js";
import { Rng } from "../src/kernel/rng.js";
import {
  apply,
  c,
  cabs2,
  cmul,
  cconj,
  dagger,
  gramSchmidtUnitary,
  identity,
  inner,
  kron2,
  matmul,
  normalize,
  type C,
  type Mat,
} from "../src/kernel/linalg.js";

test("R-all: both dossiers balance — every law holds", () => {
  const v = checkDossiers();
  assert.deepEqual(v, [], `violations: ${JSON.stringify(v)}`);
  assert.equal(DOSSIERS.length, 2);
  assert.deepEqual(
    DOSSIERS.map((d) => d.atlasRow).sort(),
    ["choice-primitive", "dtc-clock"],
  );
});

test("R6: the atlas actually carries both anchor rows", () => {
  const atlas = readFileSync(resolve(WORKSPACE_ROOT, "bqp-map", "src", "atlas", "entries.ts"), "utf8");
  for (const d of DOSSIERS) assert.ok(atlas.includes(`id: "${d.atlasRow}"`));
});

test("R5: all executable witnesses pass", () => {
  for (const w of runWitnesses()) assert.ok(w.pass, `${w.name}: ${w.detail}`);
});

test("census: every milestone is priced, falsified, and anchored; every dossier is fully furnished", () => {
  for (const d of DOSSIERS) {
    assert.ok(d.milestones.length >= 4, `${d.id}: too few milestones`);
    assert.ok(d.prices.length >= 3, `${d.id}: too few price lines`);
    assert.ok(d.criteria.length >= 4, `${d.id}: too few criteria`);
    for (const m of d.milestones) {
      assert.ok(m.price.trim().length > 0);
      assert.ok(m.falsifier.trim().length > 0);
      assert.ok(m.anchor.startsWith("cite:") || m.anchor.startsWith("local:"));
    }
    for (const p of d.prices) assert.ok(p.amount.trim().length > 0);
  }
});

test("smuggling: a milestone without a price is rejected by name (R1)", () => {
  const d2 = DOSSIERS[1] as Dossier;
  const smuggled: readonly Dossier[] = [
    {
      ...d2,
      milestones: [...d2.milestones, { id: "D2-M99", statement: "a free ride", anchor: "cite:NOE18", falsifier: "has one", price: "" }],
    },
  ];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R1");
  assert.ok(v[0].detail.includes("D2-M99"));
});

test("smuggling: a milestone without a falsifier is rejected by name (R3)", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly Dossier[] = [
    {
      ...d1,
      milestones: [...d1.milestones, { id: "D1-M98", statement: "cannot fail (it can)", anchor: "cite:MI22", falsifier: "", price: "priced" }],
    },
  ];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R3");
  assert.ok(v[0].detail.includes("D1-M98"));
});

test("smuggling: a settled verdict is rejected by name (R2) — this repo cannot settle", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly Dossier[] = [{ ...d1, verdict: "MECHANISM-SETTLED" as unknown as DossierVerdict }];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R2");
  assert.equal(v[0]?.dossierId, "D1");
});

test("smuggling: a citation that does not resolve is rejected by name (R4)", () => {
  const d2 = DOSSIERS[1] as Dossier;
  const smuggled: readonly Dossier[] = [{ ...d2, citations: [...d2.citations, "XX99"] }];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R4");
  assert.ok(v[0].detail.includes("XX99"));
});

test("smuggling: a counterfeit certificate — an execution citing a witness that does not exist — is rejected by name (R7)", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const target = d1.milestones[0] as Milestone; // D1-M1: legal but unexecuted
  const smuggled: readonly Dossier[] = [
    {
      ...d1,
      milestones: [
        { ...target, execution: { repo: "dtc-clock", certificate: "TC1", shipped: "a price without a cross-check", crossCheck: "W-Z" } },
        ...d1.milestones.slice(1),
      ],
    },
  ];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R7");
  assert.ok(v[0].detail.includes("D1-M1"));
  assert.ok(v[0].detail.includes("W-Z"));
});

test("smuggling: an execution citing a sibling repo that is missing on disk is rejected by name (R7)", () => {
  const d2 = DOSSIERS[1] as Dossier;
  const target = d2.milestones[0] as Milestone; // D2-M1: legal but unexecuted
  const smuggled: readonly Dossier[] = [
    {
      ...d2,
      milestones: [
        // the cross-check W-F is real and passes — the repo it hangs on is not
        { ...target, execution: { repo: "phantom-repo", certificate: "T1", shipped: "receipts from nowhere", crossCheck: "W-F" } },
        ...d2.milestones.slice(1),
      ],
    },
  ];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R7");
  assert.ok(v[0].detail.includes("D2-M1"));
  assert.ok(v[0].detail.includes("phantom-repo"));
});

test("the renderer refuses a counterfeit execution, naming the law", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const target = d1.milestones[0] as Milestone;
  const smuggled: readonly Dossier[] = [
    {
      ...d1,
      milestones: [
        { ...target, execution: { repo: "dtc-clock", certificate: "TC1", shipped: "unbacked", crossCheck: "W-Z" } },
        ...d1.milestones.slice(1),
      ],
    },
  ];
  assert.throws(() => renderLines(smuggled), /DOSSIER REJECTED[\s\S]*R7[\s\S]*W-Z/);
});

test("the renderer refuses to print an illegal dossier", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly Dossier[] = [
    { ...d1, milestones: [...d1.milestones, { id: "D1-M97", statement: "unpriced", anchor: "cite:MI22", falsifier: "f", price: "" }] },
  ];
  assert.throws(() => renderLines(smuggled), /DOSSIER REJECTED/);
});

test("smuggling: a dossier with no milestones column at all is rejected by name, not crashed on (R0)", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly DossierInput[] = [{ ...d1, milestones: undefined }];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R0");
  assert.equal(v[0]?.dossierId, "D1");
  assert.ok(v[0].detail.includes("milestones"));
});

test("smuggling: a milestone whose price column is not a string cannot crash the R1 reader (R0)", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly DossierInput[] = [
    {
      ...d1,
      milestones: [...d1.milestones.slice(1), { id: "D1-M96", statement: "shapeless", anchor: "cite:MI22", falsifier: "has one", price: 42 }],
    },
  ];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R0");
  assert.ok(v[0].detail.includes("D1-M96"));
});

test("smuggling: a malformed execution record is refused before R7 can crash on it (R0)", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const target = d1.milestones[0] as Milestone; // D1-M1: legal but unexecuted
  const smuggled: readonly DossierInput[] = [
    {
      ...d1,
      milestones: [
        // crossCheck missing — R7 would dereference it; R0 must refuse it first
        { ...target, execution: { repo: "dtc-clock", certificate: "TC1" } },
        ...d1.milestones.slice(1),
      ],
    },
  ];
  const v = checkDossiers(smuggled);
  assert.equal(v.length, 1);
  assert.equal(v[0]?.law, "R0");
  assert.ok(v[0].detail.includes("D1-M1"));
});

test("the refusal is a named, coded error with structured reasons — not a bare message", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const smuggled: readonly Dossier[] = [
    {
      ...d1,
      milestones: [...d1.milestones, { id: "D1-M95", statement: "unpriced", anchor: "cite:MI22", falsifier: "f", price: "" }],
    },
  ];
  try {
    renderLines(smuggled);
    assert.fail("the renderer must refuse an unpriced milestone");
  } catch (err) {
    assert.ok(err instanceof DossierRejectedError, `expected DossierRejectedError, got ${String(err)}`);
    assert.equal(err.name, "DossierRejectedError");
    assert.equal(err.code, DOSSIER_REJECTED);
    assert.equal(err.violations.length, 1);
    assert.equal(err.violations[0]?.law, "R1");
    assert.equal(err.violations[0]?.dossierId, "D1");
    assert.equal(err.witnessFailures.length, 0);
    assert.match(err.message, /DOSSIER REJECTED[\s\S]*D1-M95/);
  }
});

test("stability is engineered, not default: exact for compiled targets, strictly broken for random programs", () => {
  const psi = normalize([c(1), c(0)]);
  // engineered: |0> is an eigenvector of both branch unitaries — the desired world is invariant
  const engMat0 = [
    [c(Math.cos(1.1), Math.sin(1.1)), c(0)],
    [c(0), c(Math.cos(-1.1), Math.sin(-1.1))],
  ];
  const engMat1 = [
    [c(Math.cos(0.7), Math.sin(0.7)), c(0)],
    [c(0), c(Math.cos(-0.7), Math.sin(-0.7))],
  ];
  for (const u of [engMat0, engMat1]) {
    const out = apply(u, psi);
    // u is a literal 2×2 matrix above, so apply yields a 2-vector; index 0 is in bounds
    assert.ok(Math.abs(cabs2(out[0]!) - 1) < 1e-15);
  }
  // random: seeded Gram-Schmidt unitaries never hand back the target exactly
  const rng = new Rng(99);
  let maxF = 0;
  for (let t = 0; t < 20; t++) {
    const u = gramSchmidtUnitary(() => rng.gaussian(), 2);
    const f = cabs2(inner([c(1), c(0)], apply(u, psi)));
    maxF = Math.max(maxF, f);
    assert.ok(f < 0.999);
  }
  assert.ok(maxF > 0); // the trials actually ran
});

test("the clone mark: the CNOT pair is rephasing-invariant, the clone rotates at twice the rate", () => {
  const base = Math.PI / 4;
  const pairAt = (phi: number) => cmul(c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2), cconj(c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2)));
  const cloneAt = (phi: number) => cmul(c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2), c(Math.cos(base + phi) * Math.SQRT1_2, Math.sin(base + phi) * Math.SQRT1_2));
  const pairBase = pairAt(0);
  const cloneBase = cloneAt(0);
  let bestGap = 0;
  for (const phi of [0, 0.3, 0.785, 1.2, 2.7]) {
    const pair = pairAt(phi);
    const clone = cloneAt(phi);
    // covariance: the pair term never moves
    assert.ok(Math.abs(pair.re - pairBase.re) < 1e-15 && Math.abs(pair.im - pairBase.im) < 1e-15);
    // rotation: the clone term moves at exactly twice the rephasing rate
    const expect = cmul(c(Math.cos(2 * phi), Math.sin(2 * phi)), cloneBase);
    assert.ok(Math.abs(clone.re - expect.re) < 1e-15 && Math.abs(clone.im - expect.im) < 1e-15);
    bestGap = Math.max(bestGap, Math.hypot(pair.re - clone.re, pair.im - clone.im));
  }
  assert.ok(bestGap > 0.99); // the curves separate fully somewhere on the grid
});

test("the uniform-branch toll identity: 1/P = B exact on the powers-of-two grid", () => {
  for (const B of [2, 4, 8, 16]) {
    const P = 1 / B;
    assert.equal(1 / P, B);
    assert.equal(B / 1, B); // the epoch-3 invoice line: N/t at t = 1
  }
});

// ---------------------------------------------------------------------------
// v0.2.0 — the executed milestones and their cross-checks (R7 faces)
// ---------------------------------------------------------------------------

test("R7 wiring: every executed milestone cites a passing cross-check witness and a sibling repo on disk", () => {
  const ws = runWitnesses();
  const byId = new Map(ws.map((w) => [w.id, w] as const));
  const executed: string[] = [];
  for (const d of DOSSIERS) {
    for (const m of d.milestones) {
      if (m.execution) {
        executed.push(m.id);
        const w = byId.get(m.execution.crossCheck);
        assert.ok(w?.pass, `${m.id}: cross-check ${m.execution.crossCheck} missing or failing`);
        assert.ok(existsSync(resolve(WORKSPACE_ROOT, m.execution.repo)), `${m.id}: repo ${m.execution.repo} missing`);
        assert.ok(m.execution.certificate.trim().length > 0);
      }
    }
  }
  assert.deepEqual(executed.sort(), ["D1-M3", "D1-M4", "D2-M4"]);
});

test("the executed faces are receipted honestly: D2-C3 certified-elsewhere, D2-C1 still uncertified", () => {
  const d1 = DOSSIERS[0] as Dossier;
  const d2 = DOSSIERS[1] as Dossier;
  for (const cr of d1.criteria) assert.equal(cr.status, "CERTIFIED-ELSEWHERE");
  assert.equal((d2.criteria.find((x) => x.id === "D2-C3") as Criterion).status, "CERTIFIED-ELSEWHERE");
  assert.equal((d2.criteria.find((x) => x.id === "D2-C1") as Criterion).status, "UNCERTIFIED");
});

test("cross-check W-D physics, independent path: the echo identity rebuilt inline", () => {
  // F = (kron of e^{-i*(pi/2)X}) . e^{-i H_zz}, H_zz = -sum J_i Z_i Z_{i+1}, n = 3
  const n = 3;
  const couplings = [0.9, 1.7];
  const rot = (t: number): Mat => [
    [c(Math.cos(t)), c(0, -Math.sin(t))],
    [c(0, -Math.sin(t)), c(Math.cos(t))],
  ];
  const Zm: Mat = [
    [c(1), c(0)],
    [c(0), c(-1)],
  ];
  const fold = (mats: readonly Mat[]): Mat => mats.reduce((acc, m) => kron2(acc, m));
  const kick = fold(Array.from({ length: n }, () => rot(Math.PI / 2)));
  const dim = 1 << n;
  const energies: number[] = [];
  for (let z = 0; z < dim; z++) {
    let e = 0;
    for (let i = 0; i + 1 < n; i++) {
      const si = (z >> (n - 1 - i)) & 1 ? -1 : 1;
      const sj = (z >> (n - 1 - i - 1)) & 1 ? -1 : 1;
      e -= couplings[i]! * si * sj;
    }
    energies.push(e);
  }
  const free: C[][] = Array.from({ length: dim }, () => Array.from({ length: dim }, () => c(0)));
  for (let z = 0; z < dim; z++) free[z]![z] = c(Math.cos(energies[z]!), -Math.sin(energies[z]!));
  const f = matmul(kick, free);
  const fd = dagger(f);
  let worst = 0;
  for (let i = 0; i < n; i++) {
    const zi = fold(Array.from({ length: n }, (_, k) => (k === i ? Zm : identity(2))));
    const lhs = matmul(fd, matmul(zi, f));
    for (let r = 0; r < dim; r++) {
      for (let cc = 0; cc < dim; cc++) {
        const x = (lhs[r] as readonly C[])[cc] as C;
        const z = (zi[r] as readonly C[])[cc] as C;
        worst = Math.max(worst, Math.hypot(x.re + z.re, x.im + z.im));
      }
    }
  }
  assert.ok(worst < 1e-12, `echo identity deviation ${worst}`);
});

test("the compiled-cargo kernel: 16/16 products and a permutation of the full wire cube", () => {
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      const s = applyNetlist(MULTIPLIER_NETLIST, a | (b << 2));
      assert.equal((s >> 4) & 15, a * b, `${a}x${b}`);
    }
  }
  const dim = 1 << MULTIPLIER_WIRES;
  const seen = new Set<number>();
  for (let s = 0; s < dim; s++) seen.add(applyNetlist(MULTIPLIER_NETLIST, s));
  assert.equal(seen.size, dim);
});

test("the charge's closed form, independent float path on a binary-exact grid (two-path for W-F)", () => {
  // quarters and halves are exact in binary floating point; n = 2 and n = 4
  // keep the mean and 1/n on that grid, so this path shares no arithmetic with the BigInt kernel
  const alloc = (thetas: readonly number[]): number[] => {
    const mean = thetas.reduce((x, y) => x + y, 0) / thetas.length;
    return thetas.map((t) => t - mean + 1 / thetas.length);
  };
  const phi = (types: readonly number[], x: readonly number[]): number =>
    types.reduce((acc, t, j) => acc + t * x[j]! - (x[j]! * x[j]!) / 2, 0);
  for (const n of [2, 4]) {
    const others = n === 2 ? [0.5] : [0.25, 0.5, 0.75];
    for (const t of [0.25, 0.5, 0.75]) {
      for (const s of [0.25, 0.5, 0.75]) {
        const gap = phi([t, ...others], alloc([s, ...others])) - phi([t, ...others], alloc([t, ...others]));
        const closed = (-(n - 1) * (s - t) ** 2) / (2 * n);
        assert.ok(Math.abs(gap - closed) < 1e-15, `n=${n} s=${s} t=${t}: ${gap} vs ${closed}`);
      }
    }
  }
});

test("the off-gauge deviation, independent float path: worth exactly eps^2*n/(2(n-1)) at s* (n = 2)", () => {
  // gain'(s) = -(n-1)/(2n)(s-t)^2 - eps*(s-t) with t = 1/2, eps = 1/8 — eighths, binary-exact
  const n = 2;
  const t = 0.5;
  const eps = 0.125;
  const gain = (s: number): number => (-(n - 1) / (2 * n)) * (s - t) ** 2 - eps * (s - t);
  let bestS = 0;
  let best = Number.NEGATIVE_INFINITY;
  for (let k = 0; k <= 8; k++) {
    const s = k / 8;
    if (gain(s) > best) {
      best = gain(s);
      bestS = s;
    }
  }
  assert.equal(bestS, 0.25); // s* = t - eps*n/(n-1) = 1/2 - 1/4
  assert.ok(Math.abs(best - eps * eps * (n / (2 * (n - 1)))) < 1e-15); // 1/64 exactly on this grid
  assert.ok(best > 0); // the off-gauge term makes dishonesty profitable — that is the K1 lesson
});

test("the rendered route table receipts the executed milestones with their cross-checks", () => {
  const lines = renderLines();
  const text = lines.join("\n");
  for (const id of ["D1-M3", "D1-M4", "D2-M4"]) {
    const row = lines.find((l) => l.startsWith(`| ${id} |`));
    assert.ok(row?.includes("CERTIFIED-ELSEWHERE"), `${id} not receipted`);
  }
  for (const w of ["W-D", "W-E", "W-F"]) assert.ok(text.includes(`cross-check \`${w}\``), `${w} not cited`);
});

test("workspace wiring: every local anchor exists on disk", () => {
  for (const d of DOSSIERS) {
    for (const anchor of d.criteria.map((c) => c.anchor).concat(d.milestones.map((m) => m.anchor))) {
      if (anchor.startsWith("local:")) {
        const repo = anchor.slice("local:".length).split(/\s+/)[0] as string;
        assert.ok(existsSync(resolve(WORKSPACE_ROOT, repo)), `missing local anchor: ${repo}`);
      }
    }
  }
});
