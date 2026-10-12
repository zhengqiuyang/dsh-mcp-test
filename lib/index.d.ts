/**
 * dsh-mcp-test — tool-surface snapshot and drift gate for DeepSeek Harness.
 *
 * Everything the model can call is a supply-chain surface: first-party tools,
 * plugin tools, MCP tools. This plugin snapshots the full visible tool
 * registry (name / description / parameters via `ctx.tools.schemas()`),
 * stores a baseline, and diffs every change against it. Upgrading a plugin
 * or MCP server that silently adds, removes, or reshapes a tool fails loud.
 * Zero LLM calls in the trust path.
 *
 * Family: read-guard (what agents read) · pr-gate (what they write) ·
 * attest (what they did) · mcp-test (what they can call).
 *
 * v0.1 ships the snapshot + drift pillar (mcp-test's `diff` gate applied to
 * the whole registry); the behavioral probe pillar is on the roadmap.
 */
import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
import '@deepseek-ai/dsh-tools';
export declare const name = "dsh-mcp-test";
export declare const inject: string[];
export interface Config {
    /** Baseline file; committed to the repo, that IS the contract. */
    baselinePath: string;
    /** Re-baseline on drift instead of warning (explicit opt-in). */
    rebaselineOnDrift: boolean;
    /** Tool names excluded from the surface (e.g. your own dynamic tools). */
    ignoreTools: string[];
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
