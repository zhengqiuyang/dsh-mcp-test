/**
 * Pure tool-surface diff: two snapshots in, a drift report out. The schema
 * diff pillar is adapted from mcp-test's upgrade-gate methodology — applied
 * to the harness-wide tool registry instead of a single MCP connection.
 */
/** The model-facing projection of one tool (name/description/parameters). */
export interface ToolSurfaceEntry {
    name: string;
    /** Stable serialization of the parameter schema. */
    parameters: unknown;
    description: string;
}
export interface ToolSurfaceSnapshot {
    time: string;
    tools: ToolSurfaceEntry[];
}
export type SurfaceChange = {
    kind: 'added';
    name: string;
    entry: ToolSurfaceEntry;
} | {
    kind: 'removed';
    name: string;
    entry: ToolSurfaceEntry;
} | {
    kind: 'changed';
    name: string;
    field: 'description' | 'parameters';
};
export interface SurfaceDiff {
    baselineTools: number;
    currentTools: number;
    changes: SurfaceChange[];
}
export declare function diffSurfaces(baseline: ToolSurfaceSnapshot, current: ToolSurfaceSnapshot, ignore?: ReadonlySet<string>): SurfaceDiff;
export declare function summarizeDiff(diff: SurfaceDiff): string;
