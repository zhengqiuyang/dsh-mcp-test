/**
 * Baseline store: deterministic JSON on disk. The baseline IS the contract —
 * commit it, and any plugin/MCP upgrade that changes the model-visible tool
 * surface fails loud instead of slipping through.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ToolSurfaceEntry, ToolSurfaceSnapshot } from './diff.js';

function stableText(tools: ToolSurfaceEntry[], time: string): string {
  const sorted = [...tools].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return JSON.stringify({ time, tools: sorted }, null, 2) + '\n';
}

export async function saveSnapshot(path: string, tools: ToolSurfaceEntry[], time: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, stableText(tools, time), 'utf8');
}

export type SnapshotLoad =
  | { status: 'absent' }
  | { status: 'unreadable'; error: string }
  | { status: 'malformed'; error: string }
  | { status: 'ok'; value: ToolSurfaceSnapshot };

/**
 * T10: loading distinguishes absent / unreadable / malformed / ok. A damaged
 * baseline is never silently treated as "no baseline yet" — that would reset
 * trust-on-first-use for a surface nobody approved.
 */
export async function loadSnapshot(path: string): Promise<SnapshotLoad> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code ?? '';
    if (code === 'ENOENT') return { status: 'absent' };
    return { status: 'unreadable', error: code || (e as Error).message.slice(0, 60) };
  }
  try {
    const parsed = JSON.parse(text) as ToolSurfaceSnapshot;
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.tools)) {
      return { status: 'malformed', error: 'missing tools array' };
    }
    return { status: 'ok', value: parsed };
  } catch (e) {
    return { status: 'malformed', error: (e as Error).message.slice(0, 60) };
  }
}

/** Exposed for tests: the exact bytes a snapshot produces. */
export function snapshotText(tools: ToolSurfaceEntry[], time: string): string {
  return stableText(tools, time);
}
