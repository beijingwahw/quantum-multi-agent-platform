/**
 * exp4 — The honest wall: entanglement gives hiding and late choice,
 * never binding (Mayers-Lo-Chau no-go, cited; HJW steering, machine-verified).
 *
 * A. Steering table: same |Φ+>, the purifying party's choice of measurement
 *    basis (Z/X/Y) selects WHICH ensemble decomposition of the very same
 *    I/2 the verifier's qubit collapses into — each member with prob ½,
 *    fidelity exactly 1 (up to conjugation, which is itself the point).
 * B. The verifier's marginal during commit is exactly I/2 (trace distance
 *    ~1e-16): perfect concealment.
 * C. Naive "commit by sending |ψ_b>" protocol: the EPR cheater passes each
 *    reveal with prob ½ while fully concealed; a classical equiangular
 *    cheat already reaches 0.8536 — the protocol fails from both sides.
 *    Lesson baked into the auction stack: quantum buys privacy/detection;
 *    binding comes from classical escrow signatures after readout.
 */

import { steeringDemonstration, naiveCommitAttack } from '../contract/hjw.js';
import { mdTable, writeReport, fmt } from './report.js';
import { pathToFileURL } from "node:url";

function main(): void {
  const st = steeringDemonstration();
  const atk = naiveCommitAttack();

  const data = {
    hidingTraceDistance: st.hidingTraceDistance,
    rows: st.rows,
    attack: atk,
  };
  const markdown = [
    '## A. HJW steering table (V holds qubit 0 of |Φ+>)',
    mdTable(
      ["C's basis choice", 'P(member 1)', 'P(member 2)', 'F(V | member 1)', 'F(V | member 2)'],
      st.rows.map((r) => [
        r.basis,
        fmt(r.probs[0]),
        fmt(r.probs[1]),
        fmt(r.fidelities[0]),
        fmt(r.fidelities[1]),
      ]),
    ),
    '',
    `Every row is a decomposition of the SAME I/2 on V. The decomposition the verifier ends up in is decided by the committer's LATE measurement choice — steering freedom, the engine of the Mayers-Lo-Chau impossibility. (Y-basis fidelities are against conj(v): steering of |Φ+> hands V the conjugate — itself a signature of the same structure.)`,
    '',
    '## B. Concealment during commit',
    `Trace distance between V's marginal and I/2 = ${st.hidingTraceDistance.toExponential(2)} — the commit phase carries zero information about the eventual bit.`,
    '',
    '## C. Naive commit protocol under attack',
    mdTable(
      ['quantity', 'value'],
      [
        ['EPR cheater reveal pass, bit 0', fmt(atk.eprPass[0], 4)],
        ['EPR cheater reveal pass, bit 1', fmt(atk.eprPass[1], 4)],
        ['conditional fidelity given steering outcome', `${fmt(atk.conditionalFidelity[0], 4)} / ${fmt(atk.conditionalFidelity[1], 4)}`],
        ['classical equiangular cheat reference', fmt(atk.equiangularPassRate, 4)],
        ['cheater concealment (T to I/2)', atk.concealed.toExponential(2)],
      ],
    ),
    '',
    '**Reading**: concealing ✓ (I/2), late choice ✓ (steering), binding ✗ — and the no-go theorem (Mayers PRL 78, 3414 (1997); Lo & Chau PRL 78, 3410 (1997)) says no quantum protocol gets all three. The quantum market stack therefore assigns each job to the physics that can actually carry it: privacy → locking/monogamy, binding → classical escrow, verification → measurement statistics.',
  ].join('\n');
  writeReport({ name: 'exp4-nogo', title: 'exp4 — the commitment no-go wall, made executable' }, data, markdown);
}

// batch-33 retrofit: entry-guard law (house form since batch 21) — imports never render
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
