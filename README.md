# dsh-mcp-test

Tool-surface snapshot and drift gate for
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

Everything the model can call is a supply-chain surface: first-party tools,
plugin tools, MCP tools. This plugin snapshots the full visible tool registry
(name / description / parameters via `ctx.tools.schemas()`), stores a
baseline you commit, and diffs every registry change against it — so
upgrading a plugin or MCP server that silently adds, removes, or reshapes a
tool **fails loud instead of slipping through**. Zero LLM calls in the trust
path.

Family: **dsh-read-guard** (what agents read) · **dsh-pr-gate** (what they
write) · **dsh-attest** (what they did) · **dsh-mcp-test** (what they can
call).

## Why now (checked 2026-10-12)

The dsh supply-chain lane has seven static-scanner plugins (install-time
vetting of package manifests) — none watches the *live* tool surface.
`dsh-plugin-observatory` audits plugin compatibility at the loader level,
not the model-visible schema level. Nobody answers the question that
actually matters at upgrade time: *"did what my model can call just
change?"* The schema-diff methodology is ported from
[mcp-test](https://github.com/zhengqiuyang/mcp-test)'s upgrade gate, applied
to the whole registry instead of one MCP connection.

## How it works

```
boot / tools/change ──> snapshot ctx.tools.schemas()
                   ──> baseline present? diff : establish baseline
                   ──> drift: added / removed / changed(name.description|parameters)
                   ──> warn (default) or rebaseline (explicit opt-in)
```

- The baseline file (`.dsh-mcp-test/baseline.json`, name-sorted, stable JSON)
  is meant to be **committed** — it is the contract.
- Parameter diffs are key-order-insensitive (reordering a schema is not
  drift; changing it is).
- `ignoreTools` excludes your own deliberately-dynamic tools.

v0.1 ships the snapshot + drift pillar. The behavioral probe pillar
(functional + injection tests against running MCP servers, mcp-test's
headline feature) is on the roadmap.

## Install

```sh
dsh plugin --profile default add dsh-mcp-test
```

From npm — no build step, no `allowBuilds` authorization; git installs are equally prebuilt (`lib/` ships in the repo).



## Configure

```yaml
- id: dsh-mcp-test
  name: dsh-mcp-test
  config:
    baselinePath: .dsh-mcp-test/baseline.json
    rebaselineOnDrift: false   # true only when accepting an intended upgrade
    ignoreTools: []
```

## Compatibility

- **DSH**: verified against the 0.2.x line (source snapshot 0.2.1-alpha.2); installs on any profile via `dsh plugin add` (prebuilt `lib/`, no build approval).
- **Node**: >= 20 (CI matrix: Node 20/22/24 on Ubuntu and Windows).
- **Disposable-profile evidence (2026-10-19)**: `dsh plugin --profile <fresh> add github:zhengqiuyang/dsh-mcp-test` → installed in 30s; boot shows `[dsh-mcp-test] active: …`; `dsh plugin --profile <fresh> remove dsh-mcp-test` → dependencies cleared, bundles restored.

## Develop

```sh
npm install
npm test
```

## Roadmap

- Probe pillar: functional + injection probes against running MCP servers
  (port of mcp-test's runner)
- Per-source snapshots (first-party vs plugin vs MCP in separate baselines)
- Drift → CI bridge: surface file usable as a repo-level gate artifact

## Kill criteria

If dsh ships first-party tool-surface pinning, or the observatory-style
plugins add schema-level drift gating, this freezes at its last working
version with a postmortem here.
