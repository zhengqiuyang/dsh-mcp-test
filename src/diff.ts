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

export type SurfaceChange =
  | { kind: 'added'; name: string; entry: ToolSurfaceEntry }
  | { kind: 'removed'; name: string; entry: ToolSurfaceEntry }
  | { kind: 'changed'; name: string; field: 'description' | 'parameters' };

export interface SurfaceDiff {
  baselineTools: number;
  currentTools: number;
  changes: SurfaceChange[];
}

function stable(value: unknown): string {
  // Key-sorted JSON: two schemas that differ only in key order are not drift.
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v !== null && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        out[key] = sort((v as Record<string, unknown>)[key]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(value));
}

export function diffSurfaces(
  baseline: ToolSurfaceSnapshot,
  current: ToolSurfaceSnapshot,
  ignore: ReadonlySet<string> = new Set(),
): SurfaceDiff {
  const base = new Map(baseline.tools.filter((t) => !ignore.has(t.name)).map((t) => [t.name, t]));
  const cur = new Map(current.tools.filter((t) => !ignore.has(t.name)).map((t) => [t.name, t]));
  const changes: SurfaceChange[] = [];

  for (const name of [...base.keys()].sort()) {
    if (!cur.has(name)) {
      changes.push({ kind: 'removed', name, entry: base.get(name)! });
    }
  }
  for (const name of [...cur.keys()].sort()) {
    const entry = cur.get(name)!;
    const old = base.get(name);
    if (old === undefined) {
      changes.push({ kind: 'added', name, entry });
      continue;
    }
    if (old.description !== entry.description) {
      changes.push({ kind: 'changed', name, field: 'description' });
    }
    if (stable(old.parameters) !== stable(entry.parameters)) {
      changes.push({ kind: 'changed', name, field: 'parameters' });
    }
  }

  return {
    baselineTools: base.size,
    currentTools: cur.size,
    changes,
  };
}

export function summarizeDiff(diff: SurfaceDiff): string {
  if (diff.changes.length === 0) {
    return `tool surface unchanged (${diff.currentTools} tool(s))`;
  }
  const parts = diff.changes.map((c) =>
    c.kind === 'changed' ? `${c.kind}:${c.name}.${c.field}` : `${c.kind}:${c.name}`,
  );
  return `tool surface drift (${diff.baselineTools} -> ${diff.currentTools}): ${parts.join(', ')}`;
}
