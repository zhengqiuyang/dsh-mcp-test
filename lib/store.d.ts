import type { ToolSurfaceEntry, ToolSurfaceSnapshot } from './diff.js';
export declare function saveSnapshot(path: string, tools: ToolSurfaceEntry[], time: string): Promise<void>;
export declare function loadSnapshot(path: string): Promise<ToolSurfaceSnapshot | null>;
/** Exposed for tests: the exact bytes a snapshot produces. */
export declare function snapshotText(tools: ToolSurfaceEntry[], time: string): string;
