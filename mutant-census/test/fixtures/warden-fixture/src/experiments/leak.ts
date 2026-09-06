/**
 * FIRING FIXTURE for the anchor `census.ts :: unguardedEntryFiles` — a render
 * entry with NO house guard, so the detector can be seen naming it. It is not
 * real code and never runs; the A-board fires the detector against it on
 * every census run.
 */
declare function writeReport(name: string): string;

writeReport("fixture");

export {};
