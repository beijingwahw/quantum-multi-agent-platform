/** v0.2.0 lifetime scratch — numbers first. */
import { chainLifetimeCensus, heatingRelaxation, isolatedEchoLifetime } from "../kernel/beat.js";

// TC18: the isolated closed form vs direct simulation
for (const d of [0.1, 0.2, 0.3]) {
  const tau = isolatedEchoLifetime(d, 0.5);
  const c = Math.abs(Math.cos(2 * d));
  // direct: smallest k with |cos2d|^k < 0.5
  let k = 0;
  let m = 1;
  while (m >= 0.5 && k < 100000) {
    k++;
    m *= c;
  }
  console.log(`TC18 iso δ=${d}: closed τ* ${tau}, simulated ${k} (agree ${tau === k})`);
}

// TC19: chain lifetimes n=6, threshold 0.5
const t0 = Date.now();
const rows = chainLifetimeCensus(6, [0.1, 0.15, 0.2, 0.3, 0.4], 1500, 0.5);
console.log(`TC19 census in ${((Date.now() - t0) / 1000).toFixed(1)}s (kMax 3000)`);
for (const r of rows) {
  const sup = r.tauChain > 0 ? (r.tauChain / r.tauIso).toFixed(1) + "x" : "still-locked";
  console.log(
    `TC19 δ=${r.delta}: τ*_chain ${r.tauChain < 0 ? `>${r.kMax} (locked)` : r.tauChain}, τ*_iso ${r.tauIso}, suppression ${sup}`,
  );
}

// TC20: heating relaxation
for (const d of [0.1, 0.2, 0.4]) {
  const r = heatingRelaxation(6, d, 1500);
  console.log(
    `TC20 δ=${d}: τ_heat ${r.tauHeat < 0 ? ">" + 1500 : r.tauHeat}, drift ${r.totalDrift.toFixed(3)} (E₀ ${r.e0.toFixed(2)} → E∞ ${r.eInf.toFixed(2)})`,
  );
}
