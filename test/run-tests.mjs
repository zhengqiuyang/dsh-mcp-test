/**
 * Unit tests for the pure diff/store logic — no DSH host needed.
 * Run: npm test
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { diffSurfaces, summarizeDiff } from '../lib/diff.js';
import { loadSnapshot, saveSnapshot, snapshotText } from '../lib/store.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${name}`);
    console.error(err.message);
  }
}

const BASE = {
  time: 't0',
  tools: [
    { name: 'read', description: 'Read a file', parameters: { path: { type: 'string' } } },
    { name: 'mcp__db__query', description: 'Run SQL', parameters: { sql: { type: 'string' } } },
  ],
};

console.log('diff');

await test('identical surfaces produce no changes', () => {
  const d = diffSurfaces(BASE, BASE);
  assert.equal(d.changes.length, 0);
  assert.equal(d.currentTools, 2);
});

await test('added and removed tools are reported', () => {
  const now = {
    time: 't1',
    tools: [
      BASE.tools[0],
      { name: 'mcp__web__fetch', description: 'Fetch', parameters: {} },
    ],
  };
  const d = diffSurfaces(BASE, now);
  const kinds = d.changes.map((c) => `${c.kind}:${c.name}`).sort();
  assert.deepEqual(kinds, ['added:mcp__web__fetch', 'removed:mcp__db__query']);
});

await test('parameter schema change is drift', () => {
  const now = {
    time: 't1',
    tools: [
      BASE.tools[0],
      { name: 'mcp__db__query', description: 'Run SQL', parameters: { sql: { type: 'string' }, limit: { type: 'number' } } },
    ],
  };
  const d = diffSurfaces(BASE, now);
  assert.deepEqual(d.changes, [{ kind: 'changed', name: 'mcp__db__query', field: 'parameters' }]);
});

await test('description-only change reports description field', () => {
  const now = {
    time: 't1',
    tools: [
      BASE.tools[0],
      { name: 'mcp__db__query', description: 'Run SQL safely', parameters: { sql: { type: 'string' } } },
    ],
  };
  const d = diffSurfaces(BASE, now);
  assert.deepEqual(d.changes, [{ kind: 'changed', name: 'mcp__db__query', field: 'description' }]);
});

await test('key order in parameters is not drift', () => {
  const now = {
    time: 't1',
    tools: [
      BASE.tools[0],
      { name: 'mcp__db__query', description: 'Run SQL', parameters: { sql: { type: 'string', description: 'q' } } },
    ],
  };
  const baseReordered = {
    time: 't0',
    tools: [
      BASE.tools[0],
      {
        name: 'mcp__db__query',
        description: 'Run SQL',
        parameters: { sql: { description: 'q', type: 'string' } },
      },
    ],
  };
  assert.equal(diffSurfaces(baseReordered, now).changes.length, 0);
});

await test('ignored tools are excluded from the surface', () => {
  const now = { time: 't1', tools: [BASE.tools[0]] };
  const d = diffSurfaces(BASE, now, new Set(['mcp__db__query']));
  assert.equal(d.changes.length, 0);
});

await test('summary names every change', () => {
  const now = { time: 't1', tools: [BASE.tools[0]] };
  const s = summarizeDiff(diffSurfaces(BASE, now));
  assert.ok(s.includes('removed:mcp__db__query'));
  assert.ok(s.includes('2 -> 1'));
});

console.log('store');

await test('snapshot text is name-sorted and stable', () => {
  const tools = [
    { name: 'zeta', description: 'z', parameters: {} },
    { name: 'alpha', description: 'a', parameters: {} },
  ];
  const text = snapshotText(tools, 't');
  assert.ok(text.indexOf('alpha') < text.indexOf('zeta'));
  assert.equal(snapshotText([...tools].reverse(), 't'), text);
});

await test('save then load roundtrips', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-mcp-test-'));
  try {
    const p = join(dir, 'sub', 'baseline.json');
    await saveSnapshot(p, BASE.tools, 't0');
    const loaded = await loadSnapshot(p);
    assert.equal(loaded.time, 't0');
    // Storage is name-sorted; compare as sets.
    const byName = (arr) => Object.fromEntries(arr.map((t) => [t.name, t]));
    assert.deepEqual(byName(loaded.tools), byName(BASE.tools));
    // Diff against its own stored baseline is clean.
    assert.equal(diffSurfaces(loaded, BASE).changes.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

await test('missing baseline loads as null', async () => {
  assert.equal(await loadSnapshot(join(tmpdir(), 'nope', 'x.json')), null);
});

await test('tampered baseline text is detected on diff', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-mcp-test-'));
  try {
    const p = join(dir, 'baseline.json');
    await saveSnapshot(p, BASE.tools, 't0');
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    const dbTool = raw.tools.find((t) => t.name === 'mcp__db__query');
    dbTool.parameters.sql.type = 'number'; // schema tampered on disk
    writeFileSync(p, JSON.stringify(raw));
    const loaded = await loadSnapshot(p);
    const d = diffSurfaces(loaded, BASE);
    assert.deepEqual(d.changes, [{ kind: 'changed', name: 'mcp__db__query', field: 'parameters' }]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

console.log('');
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
