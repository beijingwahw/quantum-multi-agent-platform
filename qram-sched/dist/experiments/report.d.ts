export declare const reportDir: string;
/** Write one markdown report file; returns the path written. */
export declare function writeReport(name: string, body: string): string;
/** Render a markdown table with a matching separator row. */
export declare function table(headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string;
/** Least-squares slope of ys against xs (experiment scaling-law fits). */
export declare function fitSlope(xs: readonly number[], ys: readonly number[]): number;
/** Fixed-decimal formatting for report prose (NaN/Infinity pass through as strings). */
export declare function fmt(x: number, digits?: number): string;
