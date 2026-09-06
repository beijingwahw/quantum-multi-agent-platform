/**
 * THE BRIDGE — the burial record imported LIVE, not copied.
 *
 * The E-board's whole point is that no error can be buried without answering
 * for its enforcement: so the enrollment table is checked against the registry
 * ON EVERY RUN, through this bridge. A copy would drift (the batch-23 class);
 * a live import cannot. If burial-record moves or renames its registry, this
 * bridge fails loudly — that is the anchor behaving as designed, not a bug.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { WORKSPACE_ROOT } from "./census.js";

export interface LiveBurialError {
  /** "bN#i" — batch N, the i-th error of that batch, the registry's own addressing */
  readonly key: string;
  readonly batch: number;
  readonly index: number;
  readonly repo: string;
  readonly category: string;
  readonly wrong: string;
  /** the correction — the rule the preflight card prints (v0.6.0) */
  readonly right: string;
}

export interface LiveRegistry {
  readonly errors: readonly LiveBurialError[];
  readonly batchCount: number;
  /** what burial-record DECLARES its totals to be — E5 refuses to let the two
   * registries drift apart even for one delivery */
  readonly declaredBatches: number;
  readonly declaredErrors: number;
}

interface RegistryModule {
  BURIAL_RECORD?: ReadonlyArray<{
    batch: number;
    repo: string;
    errors: ReadonlyArray<{ category: string; wrong: string; right: string }>;
  }>;
  DECLARED_TOTAL_BATCHES?: number;
  DECLARED_TOTAL_ERRORS?: number;
}

export const REGISTRY_PATH = resolve(WORKSPACE_ROOT, "burial-record", "src", "kernel", "registry.ts");

let cache: Promise<LiveRegistry> | null = null;

export function loadLiveRegistry(): Promise<LiveRegistry> {
  cache ??= (async (): Promise<LiveRegistry> => {
    if (!existsSync(REGISTRY_PATH)) {
      throw new Error(`the burial record is not where the census expects it: ${REGISTRY_PATH}`);
    }
    const mod = (await import(pathToFileURL(REGISTRY_PATH).href)) as unknown as RegistryModule;
    if (!mod.BURIAL_RECORD) {
      throw new Error("the burial record no longer exports BURIAL_RECORD — the bridge must follow it, not guess");
    }
    const errors: LiveBurialError[] = [];
    for (const b of mod.BURIAL_RECORD) {
      b.errors.forEach((e, i) => {
        errors.push({ key: `b${b.batch}#${i}`, batch: b.batch, index: i, repo: b.repo, category: e.category, wrong: e.wrong, right: e.right });
      });
    }
    return {
      errors,
      batchCount: mod.BURIAL_RECORD.length,
      declaredBatches: mod.DECLARED_TOTAL_BATCHES ?? -1,
      declaredErrors: mod.DECLARED_TOTAL_ERRORS ?? -1,
    };
  })();
  return cache;
}
