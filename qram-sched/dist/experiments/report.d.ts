export declare const reportDir: string;
export declare function writeReport(name: string, body: string): string;
export declare function table(headers: readonly string[], rows: ReadonlyArray<readonly string[]>): string;
export declare function fitSlope(xs: readonly number[], ys: readonly number[]): number;
export declare function fmt(x: number, digits?: number): string;
