/**
 * THE G-BOARD DERIVATION — v0.31.0, the b84#21/b85#35 guard made a command:
 *
 *   npm run derive
 *
 * The wiring protocol's PRE-WRITE step for every G-board edit. The machine
 * files each error under familyOf (first-match-wins, never the intent),
 * finds each family's LATEST sighting, and derives the tier its resolution
 * row MUST hold from that sighting's enrollment. Draft FROM this table —
 * a row written from the intended category ahead of the machine's filing
 * is the b84#21/b85#35 class, convicted at the suite's first run; this
 * command exists so the conviction never needs to fire again.
 *
 * Exit 0 with CLEAN when every row matches; exit 1 naming each drifted or
 * missing row otherwise. G1's stale rows (a resolution naming a family the
 * registry no longer carries) are printed beside the table by the same
 * checkGenealogy the suite runs — single-sourced, no second law.
 */
import { pathToFileURL } from "node:url";
import { loadLiveRegistry } from "../src/kernel/bridge.js";
import { ENROLLMENT } from "../src/kernel/enrollment.js";
import { checkGenealogy, genealogyCensus, resolutionSkeleton, skeletonDrift, type GenealogyViolation } from "../src/kernel/genealogy.js";

async function main(): Promise<void> {
  const registry = await loadLiveRegistry();
  const census = genealogyCensus(registry.errors, ENROLLMENT);
  const skeleton = resolutionSkeleton(census);

  console.log(`THE G-BOARD DERIVATION — ${census.families.length} families over ${registry.errors.length} errors (${registry.batchCount} batches)`);
  console.log("family | sightings | latest | derived holds (the only legal value) | stated | status");
  for (const r of skeleton) {
    console.log(`${r.family} | ${r.sightings} | ${r.latestKey} | ${r.derivedHolds} | ${r.statedHolds ?? "-"} | ${r.status}`);
  }

  // G1 beside the table: resolutions naming families the registry does not
  // carry — the stale-row face the skeleton table cannot show (a family
  // with zero sightings appears in no census row).
  const stale = checkGenealogy(census).filter((v: GenealogyViolation) => v.law === "G1");
  for (const s of stale) console.log(`STALE ROW: ${s.family} — ${s.detail}`);

  const drift = skeletonDrift(skeleton);
  if (stale.length > 0 || drift.length > 0) {
    for (const d of drift) {
      console.error(
        d.status === "ROW-MISSING"
          ? `ROW-MISSING: ${d.family} carries ${d.sightings} sightings (latest ${d.latestKey}) and NO resolution row — draft one holding ${d.derivedHolds}`
          : `TIER-DRIFT: ${d.family}'s row says ${d.statedHolds} but the latest sighting ${d.latestKey} is enrolled ${d.derivedHolds} — the row drifted`,
      );
    }
    console.error(`\nNOT CLEAN — ${drift.length} drift row(s), ${stale.length} stale row(s). Reconcile before the batch is declared wired.`);
    process.exitCode = 1;
    return;
  }
  console.log("\nCLEAN — every family's derived tier matches its row; new sightings: re-run this BEFORE drafting their notes.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await main();
}
