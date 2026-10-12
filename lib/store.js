/**
 * Baseline store: deterministic JSON on disk. The baseline IS the contract —
 * commit it, and any plugin/MCP upgrade that changes the model-visible tool
 * surface fails loud instead of slipping through.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
function stableText(tools, time) {
    const sorted = [...tools].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    return JSON.stringify({ time, tools: sorted }, null, 2) + '\n';
}
export async function saveSnapshot(path, tools, time) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, stableText(tools, time), 'utf8');
}
export async function loadSnapshot(path) {
    try {
        const text = await readFile(path, 'utf8');
        return JSON.parse(text);
    }
    catch {
        return null;
    }
}
/** Exposed for tests: the exact bytes a snapshot produces. */
export function snapshotText(tools, time) {
    return stableText(tools, time);
}
