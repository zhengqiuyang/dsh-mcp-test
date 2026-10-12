import Schema from '@deepseek-ai/schemastery';
import '@deepseek-ai/dsh-tools';
import { diffSurfaces, summarizeDiff } from './diff.js';
import { loadSnapshot, saveSnapshot } from './store.js';
export const name = 'dsh-mcp-test';
export const inject = ['tools'];
export const Config = Schema.object({
    baselinePath: Schema.string().default('.dsh-mcp-test/baseline.json').description('committed baseline file'),
    rebaselineOnDrift: Schema.boolean().default(false).description('update the baseline instead of warning (opt-in)'),
    ignoreTools: Schema.array(Schema.string()).default([]).description('tool names excluded from the surface'),
});
export function apply(ctx, config) {
    const ignore = new Set(config.ignoreTools);
    let lastSignature = '';
    const capture = () => ctx.tools.schemas().map((schema) => ({
        name: schema.name,
        description: schema.description,
        parameters: schema.parameters,
    }));
    async function check() {
        const current = { time: new Date().toISOString(), tools: capture() };
        const baseline = await loadSnapshot(config.baselinePath);
        if (baseline === null) {
            await saveSnapshot(config.baselinePath, current.tools, current.time);
            console.log(`[dsh-mcp-test] baseline established: ${current.tools.length} tool(s) -> ${config.baselinePath} (commit it)`);
            return;
        }
        const diff = diffSurfaces(baseline, current, ignore);
        if (diff.changes.length === 0) {
            console.log(`[dsh-mcp-test] ${summarizeDiff(diff)}`);
            return;
        }
        // Identical consecutive drift states log once, not on every re-check.
        const signature = JSON.stringify(diff.changes);
        if (signature === lastSignature)
            return;
        lastSignature = signature;
        if (config.rebaselineOnDrift) {
            await saveSnapshot(config.baselinePath, current.tools, current.time);
            console.warn(`[dsh-mcp-test] rebaselined: ${summarizeDiff(diff)}`);
            return;
        }
        console.warn(`[dsh-mcp-test] DRIFT — ${summarizeDiff(diff)}\n` +
            `  If this upgrade is intended, set rebaselineOnDrift: true once (or delete the baseline) to accept it.`);
    }
    // Composition order races tool registration: the first check and every
    // registry change share one trailing debounce so bursts of registrations
    // coalesce and the baseline is taken after the registry settles.
    let timer;
    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(() => void check(), 1500);
    };
    ctx.on('tools/change', schedule);
    ctx.effect(() => () => clearTimeout(timer));
    schedule();
    console.log('[dsh-mcp-test] active: drift gate armed on tools/change');
}
