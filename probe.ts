import assert from "node:assert/strict";
import { makeRng } from "./src/core/rng.js";
import { randomStateVec, vecToRho } from "./src/core/states.js";
import { fidelity } from "./src/core/measures.js";
import { redeem } from "./src/kernel/clearing.js";

const rng = makeRng(31);
for (let t = 0; t < 12; t++) {
  const psi = randomStateVec(rng, 2);
  const r = redeem(vecToRho(psi));
  const fid = fidelity(r.delivered, vecToRho(psi));
  console.log(`t=${t} |fid-1| = ${Math.abs(fid - 1).toExponential(6)}`);
  try {
    assert.ok(Math.abs(fid - 1) <= 1e-12);
  } catch {
    console.log("  FAILED at t=" + t);
    break;
  }
}
